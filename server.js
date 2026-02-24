require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/video", express.static(path.join(__dirname, "video")));

const PORT = process.env.PORT || 5000;

// Ensure folders exist
if (!fs.existsSync("audio")) fs.mkdirSync("audio");
if (!fs.existsSync("video")) fs.mkdirSync("video");

app.post("/generate-video", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const audioPath = `audio/output-${Date.now()}.mp3`;
    const videoPath = `video/video-${Date.now()}.mp4`;

    // STEP 1: Generate AI Voice
    const response = await axios.post(
      "https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID",
      {
        text: text,
        model_id: "eleven_monolingual_v1"
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }
    );

    fs.writeFileSync(audioPath, response.data);

    // STEP 2: Create simple video with black background + audio
    ffmpeg()
      .input(audioPath)
      .inputOptions(["-f lavfi", "-i color=c=black:s=1280x720:r=25"])
      .complexFilter([
        {
          filter: "anull"
        }
      ])
      .outputOptions([
        "-shortest",
        "-c:v libx264",
        "-c:a aac",
        "-pix_fmt yuv420p"
      ])
      .save(videoPath)
      .on("end", () => {
        res.json({
          videoUrl: `${req.protocol}://${req.get("host")}/${videoPath}`
        });
      });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Video generation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
