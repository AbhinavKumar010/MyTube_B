const express = require('express');
const User = require('../models/User');
const Video = require('../models/Video');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/subscriptions/:channelId
// @desc    Subscribe/unsubscribe to a channel
// @access  Private
router.post('/:channelId', auth, async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const userId = req.userId;

    if (channelId === userId.toString()) {
      return res.status(400).json({ message: 'Cannot subscribe to your own channel' });
    }

    const channel = await User.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const user = await User.findById(userId);
    const isSubscribed = channel.subscribers.includes(userId);

    if (isSubscribed) {
      // Unsubscribe
      channel.subscribers.pull(userId);
      user.subscribers.pull(channelId);
    } else {
      // Subscribe
      channel.subscribers.push(userId);
      user.subscribers.push(channelId);
    }

    await channel.updateSubscriberCount();
    await user.save();

    res.json({
      isSubscribed: !isSubscribed,
      subscriberCount: channel.subscriberCount
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/subscriptions/feed
// @desc    Get subscription feed
// @access  Private
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const user = await User.findById(req.userId);
    const subscribedChannels = user.subscribers;

    const videos = await Video.find({
      uploader: { $in: subscribedChannels },
      isPublic: true
    })
      .populate('uploader', 'username channelName profilePicture subscriberCount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments({
      uploader: { $in: subscribedChannels },
      isPublic: true
    });

    res.json({
      videos,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/subscriptions/check/:channelId
// @desc    Check if user is subscribed to a channel
// @access  Private
router.get('/check/:channelId', auth, async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const userId = req.userId;

    const channel = await User.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const isSubscribed = channel.subscribers.includes(userId);

    res.json({
      isSubscribed,
      subscriberCount: channel.subscriberCount
    });
  } catch (error) {
    console.error('Check subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
