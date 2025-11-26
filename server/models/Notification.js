const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['achievement', 'study_reminder', 'goal_progress', 'streak', 'study_session', 'group_study', 'ai_insight', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🔔'
  },
  color: {
    type: String,
    enum: ['blue', 'green', 'orange', 'purple', 'red'],
    default: 'blue'
  },
  read: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String, // e.g., '/achievements', '/study-timer'
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Store additional data (achievement ID, session ID, etc.)
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null // Auto-delete after expiration (optional)
  }
});

// Indexes for faster queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications

module.exports = mongoose.model('Notification', notificationSchema);

