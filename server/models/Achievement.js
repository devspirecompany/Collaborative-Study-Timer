const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementType: {
    type: String,
    required: true,
    enum: [
      'early_bird',
      'study_marathon',
      'streak_master',
      'perfect_week',
      'night_owl',
      'focused_mind',
      'social_learner',
      'quiz_master',
      'file_organizer',
      'time_warrior'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  target: {
    type: Number,
    required: true
  },
  current: {
    type: Number,
    default: 0
  },
  unlocked: {
    type: Boolean,
    default: false
  },
  unlockedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
achievementSchema.index({ userId: 1, achievementType: 1 });
achievementSchema.index({ userId: 1, unlocked: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);

