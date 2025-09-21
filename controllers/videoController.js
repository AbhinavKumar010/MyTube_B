import Video from "../models/video.js";

export const getVideos = async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "Video not found" });
    res.json(video);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadVideo = async (req, res) => {
  try {
    const { title, description, uploader } = req.body;
    const videoUrl = req.file ? `/uploads/${req.file.filename}` : "";
    const thumbnailUrl = req.body.thumbnailUrl || ""; // optional thumbnail

    const newVideo = new Video({
      title,
      description,
      uploader: uploader || "Unknown",
      videoUrl,
      thumbnailUrl,
      views: 0,
    });

    const savedVideo = await newVideo.save();
    res.status(201).json(savedVideo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
