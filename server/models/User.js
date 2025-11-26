const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  studySessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudySession'
  }],
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  }],
  reviewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reviewer'
  }],
  totalStudyTime: {
    type: Number,
    default: 0 // in seconds
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String,
    default: 'icon1.jpg'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

