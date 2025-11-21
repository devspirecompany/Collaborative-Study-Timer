const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  userId: {
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
    default: 'txt'
  },
  subject: {
    type: String,
    required: true
  },
  size: {
    type: Number // in bytes
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('File', fileSchema);

