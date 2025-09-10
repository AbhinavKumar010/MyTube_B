const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Video = require('../models/Video');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/comments/video/:videoId
// @desc    Get comments for a video
// @access  Public
router.get('/video/:videoId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const comments = await Comment.find({ 
      video: req.params.videoId,
      parentComment: null // Only top-level comments
    })
      .populate('author', 'username profilePicture')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'username profilePicture'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments({ 
      video: req.params.videoId,
      parentComment: null 
    });

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private
router.post('/', auth, [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  body('videoId')
    .isMongoId()
    .withMessage('Valid video ID is required'),
  body('parentCommentId')
    .optional()
    .isMongoId()
    .withMessage('Valid parent comment ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, videoId, parentCommentId } = req.body;

    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const comment = new Comment({
      content,
      author: req.userId,
      video: videoId,
      parentComment: parentCommentId || null
    });

    await comment.save();

    // If it's a reply, add to parent comment's replies
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment) {
        parentComment.replies.push(comment._id);
        await parentComment.save();
      }
    }

    // Add comment to video
    video.comments.push(comment._id);
    video.commentCount += 1;
    await video.save();

    // Populate the comment with author info
    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username profilePicture');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', auth, [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this comment' });
    }

    comment.content = req.body.content;
    comment.isEdited = true;
    await comment.save();

    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'username profilePicture');

    res.json(updatedComment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.author.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // If it's a top-level comment, remove from video
    if (!comment.parentComment) {
      await Video.findByIdAndUpdate(comment.video, {
        $pull: { comments: comment._id },
        $inc: { commentCount: -1 }
      });
    } else {
      // If it's a reply, remove from parent comment
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id }
      });
    }

    // Delete the comment and all its replies
    await Comment.deleteMany({
      $or: [
        { _id: comment._id },
        { parentComment: comment._id }
      ]
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments/:id/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.userId;
    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }

    await comment.updateLikeCount();

    res.json({
      isLiked: !isLiked,
      likeCount: comment.likeCount
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
