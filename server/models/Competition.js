const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow null for AI players
  },
  playerName: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  answers: [{
    questionId: String,
    answer: Number,
    isCorrect: Boolean,
    timeTaken: Number // in seconds
  }],
  joinedAt: {
    type: Date,
    default: Date.now
  },
  isAI: {
    type: Boolean,
    default: false
  }
});

const competitionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  questions: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String
  }],
  players: [playerSchema],
  maxPlayers: {
    type: Number,
    default: 2
  },
  isGroupQuiz: {
    type: Boolean,
    default: false // true for Quizizz-style group quiz, false for 1v1 battle
  },
  opponentType: {
    type: String,
    enum: ['player', 'ai'],
    default: undefined // 'player' for real player, 'ai' for AI opponent
  },
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'completed'],
    default: 'waiting'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// roomId already has unique index from schema definition
competitionSchema.index({ status: 1 });
competitionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Competition', competitionSchema);

