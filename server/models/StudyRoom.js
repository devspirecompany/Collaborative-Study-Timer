const mongoose = require('mongoose');

const studyRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  roomName: {
    type: String,
    trim: true,
    default: 'Study Room'
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  participants: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentDocument: {
    fileId: {
      type: String,
      default: null
    },
    fileName: {
      type: String,
      default: null
    },
    content: {
      type: String,
      default: null
    },
    fileContent: {
      type: String,
      default: null
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'txt', 'md', null],
      default: null
    },
    subject: {
      type: String,
      default: null
    },
    sharedBy: {
      userId: {
        type: String,
        default: null
      },
      username: {
        type: String,
        default: null
      }
    },
    viewMode: {
      type: String,
      enum: ['raw', 'reviewer', null],
      default: 'raw'
    },
    reviewerContent: {
      reviewContent: {
        type: String,
        default: null
      },
      keyPoints: [{
        type: String
      }]
    }
  },
  sharedFiles: [{
    fileId: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileContent: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['docx', 'txt', 'md'],
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    sharedBy: {
      userId: {
        type: String,
        required: true
      },
      username: {
        type: String,
        required: true
      }
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  scrollPosition: {
    type: Number,
    default: 0
  },
  sharedNotes: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    note: {
      type: String,
      required: true,
      trim: true
    },
    position: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  chatMessages: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  studyTimer: {
    isRunning: {
      type: Boolean,
      default: false
    },
    timeRemaining: {
      type: Number,
      default: 0 // in seconds
    },
    startedAt: {
      type: Date,
      default: null
    },
    duration: {
      type: Number,
      default: 0 // in seconds
    }
  },
  quiz: {
    isActive: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['waiting', 'in-progress', 'completed'],
      default: 'waiting'
    },
    questions: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      explanation: String
    }],
    currentQuestionIndex: {
      type: Number,
      default: 0
    },
    participantAnswers: [{
      userId: String,
      username: String,
      answers: [{
        questionIndex: Number,
        selectedAnswer: Number,
        isCorrect: Boolean,
        timeTaken: Number
      }],
      score: {
        type: Number,
        default: 0
      }
    }],
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Auto-expire after 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
});

// Index for faster lookups
// roomCode already has unique index from schema definition
studyRoomSchema.index({ hostId: 1 });

// Auto-delete expired rooms
studyRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('StudyRoom', studyRoomSchema);

