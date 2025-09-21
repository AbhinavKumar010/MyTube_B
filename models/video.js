import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    thumbnailUrl: { type: String }, // optional
    videoUrl: { type: String, required: true },
    uploader: { type: String, default: "Unknown" },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Video = mongoose.model("Video", videoSchema);

export default Video;
