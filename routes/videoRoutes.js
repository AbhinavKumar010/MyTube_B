import express from "express";
import multer from "multer";
import { getVideos, getVideoById, uploadVideo } from "../controllers/videoController.js";

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Routes
router.get("/", getVideos);
router.get("/:id", getVideoById);
router.post("/", upload.single("video"), uploadVideo); // field name must match frontend FormData

export default router;
