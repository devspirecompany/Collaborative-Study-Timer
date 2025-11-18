const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 4;
      },
      message: 'Question must have exactly 4 options'
    }
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    max: 3
  },
  explanation: {
    type: String,
    required: true
  }
});

const reviewerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  // Study notes/review material (main content)
  reviewContent: {
    type: String,
    required: true
  },
  // Key points/summary
  keyPoints: [{
    type: String
  }],
  // Optional: Questions can still be stored but are separate from review content
  questions: [questionSchema],
  totalQuestions: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reviewerSchema.pre('save', function(next) {
  this.totalQuestions = this.questions.length;
  next();
});

module.exports = mongoose.model('Reviewer', reviewerSchema);

