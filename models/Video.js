const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 5000
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likeCount: {
    type: Number,
    default: 0
  },
  dislikeCount: {
    type: Number,
    default: 0
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['Gaming', 'Music', 'Education', 'Entertainment', 'Sports', 'News', 'Tech', 'Other'],
    default: 'Other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  commentCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Update like/dislike counts
videoSchema.methods.updateLikeCount = function() {
  this.likeCount = this.likes.length;
  this.dislikeCount = this.dislikes.length;
  return this.save();
};

// Add view
videoSchema.methods.addView = function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Video', videoSchema);
