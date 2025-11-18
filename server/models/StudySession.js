const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: Number,
    required: true // in seconds
  },
  mode: {
    type: String,
    enum: ['study', 'break', 'longbreak'],
    default: 'study'
  },
  aiRecommended: {
    type: Boolean,
    default: true
  },
  aiRecommendedDuration: {
    type: Number // in minutes
  },
  completed: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  studyData: {
    hoursStudiedToday: Number,
    sessionCount: Number,
    timeOfDay: Number,
    fatigueLevel: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StudySession', studySessionSchema);

