const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Video = require('../models/Video');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get user profile
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -watchHistory -likedVideos -dislikedVideos');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's videos
    const videos = await Video.find({ uploader: req.params.id, isPublic: true })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      user,
      videos
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('channelName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Channel name must be between 1 and 50 characters'),
  body('channelDescription')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Channel description must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { channelName, channelDescription, profilePicture } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (channelName) user.channelName = channelName;
    if (channelDescription !== undefined) user.channelDescription = channelDescription;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        channelName: user.channelName,
        channelDescription: user.channelDescription,
        subscriberCount: user.subscriberCount
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/videos
// @desc    Get user's videos
// @access  Public
router.get('/:id/videos', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const videos = await Video.find({ uploader: req.params.id, isPublic: true })
      .populate('uploader', 'username channelName profilePicture subscriberCount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments({ uploader: req.params.id, isPublic: true });

    res.json({
      videos,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get user videos error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/subscribers
// @desc    Get user's subscribers
// @access  Public
router.get('/:id/subscribers', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('subscribers', 'username profilePicture channelName subscriberCount')
      .select('subscribers subscriberCount');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      subscribers: user.subscribers,
      subscriberCount: user.subscriberCount
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/subscriptions
// @desc    Get user's subscriptions
// @access  Public
router.get('/:id/subscriptions', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('subscribers', 'username profilePicture channelName subscriberCount')
      .select('subscribers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      subscriptions: user.subscribers
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
