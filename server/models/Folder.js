const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: {
    type: String, // Use String instead of Mixed for consistency
    required: true
  },
  folderName: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure unique folder names per user (case-insensitive)
// Note: MongoDB unique indexes are case-sensitive by default
// We'll handle case-insensitivity in the application logic
folderSchema.index({ userId: 1, folderName: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);

