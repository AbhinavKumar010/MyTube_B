const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Video = require('../models/Video');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// @route   GET /api/videos
// @desc    Get all public videos with pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'createdAt';

    let query = { isPublic: true };
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const videos = await Video.find(query)
      .populate('uploader', 'username channelName profilePicture subscriberCount')
      .sort({ [sortBy]: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    res.json({
      videos,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/videos/:id
// @desc    Get single video by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('uploader', 'username channelName profilePicture subscriberCount')
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'username profilePicture'
        }
      });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Increment view count
    await video.addView();

    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/videos
// @desc    Upload a new video
// @access  Private
router.post('/', auth, upload.single('video'), [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters'),
  body('category')
    .optional()
    .isIn(['Gaming', 'Music', 'Education', 'Entertainment', 'Sports', 'News', 'Tech', 'Other'])
    .withMessage('Invalid category')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, category, tags } = req.body;
    
    // In a real application, you would upload the video file to a cloud service
    // For now, we'll simulate with a placeholder URL
    const videoUrl = `https://example.com/videos/${Date.now()}.mp4`;
    const thumbnailUrl = `https://example.com/thumbnails/${Date.now()}.jpg`;

    const video = new Video({
      title,
      description,
      videoUrl,
      thumbnailUrl,
      duration: 300, // Placeholder duration in seconds
      uploader: req.userId,
      category: category || 'Other',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    await video.save();

    const populatedVideo = await Video.findById(video._id)
      .populate('uploader', 'username channelName profilePicture subscriberCount');

    res.status(201).json(populatedVideo);
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ message: 'Server error during video upload' });
  }
});

// @route   PUT /api/videos/:id
// @desc    Update video
// @access  Private
router.put('/:id', auth, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.uploader.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this video' });
    }

    const { title, description, category, tags, isPublic } = req.body;

    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (category) video.category = category;
    if (tags) video.tags = tags.split(',').map(tag => tag.trim());
    if (isPublic !== undefined) video.isPublic = isPublic;

    await video.save();

    const updatedVideo = await Video.findById(video._id)
      .populate('uploader', 'username channelName profilePicture subscriberCount');

    res.json(updatedVideo);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/videos/:id
// @desc    Delete video
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.uploader.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this video' });
    }

    await Video.findByIdAndDelete(req.params.id);

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/videos/:id/like
// @desc    Like/unlike a video
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const userId = req.userId;
    const isLiked = video.likes.includes(userId);
    const isDisliked = video.dislikes.includes(userId);

    if (isLiked) {
      // Unlike
      video.likes.pull(userId);
    } else {
      // Like
      video.likes.push(userId);
      // Remove from dislikes if present
      if (isDisliked) {
        video.dislikes.pull(userId);
      }
    }

    await video.updateLikeCount();

    res.json({
      isLiked: !isLiked,
      likeCount: video.likeCount,
      dislikeCount: video.dislikeCount
    });
  } catch (error) {
    console.error('Like video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/videos/:id/dislike
// @desc    Dislike/undislike a video
// @access  Private
router.post('/:id/dislike', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const userId = req.userId;
    const isDisliked = video.dislikes.includes(userId);
    const isLiked = video.likes.includes(userId);

    if (isDisliked) {
      // Undislike
      video.dislikes.pull(userId);
    } else {
      // Dislike
      video.dislikes.push(userId);
      // Remove from likes if present
      if (isLiked) {
        video.likes.pull(userId);
      }
    }

    await video.updateLikeCount();

    res.json({
      isDisliked: !isDisliked,
      likeCount: video.likeCount,
      dislikeCount: video.dislikeCount
    });
  } catch (error) {
    console.error('Dislike video error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
