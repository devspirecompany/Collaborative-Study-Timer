const mongoose = require('mongoose');

const productivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  totalStudyTime: {
    type: Number,
    default: 0 // in seconds
  },
  sessionsCompleted: {
    type: Number,
    default: 0
  },
  averageFocusScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  subjectsStudied: [{
    type: String
  }],
  filesUploaded: {
    type: Number,
    default: 0
  },
  reviewersCreated: {
    type: Number,
    default: 0
  },
  competitionsJoined: {
    type: Number,
    default: 0
  },
  competitionsWon: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  weeklyGoal: {
    type: Number,
    default: 14400 // 4 hours in seconds
  },
  dailyGoal: {
    type: Number,
    default: 7200 // 2 hours in seconds
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
productivitySchema.index({ userId: 1, date: -1 });
productivitySchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Productivity', productivitySchema);

