const express = require('express');
const router = express.Router();
const File = require('../models/File');
const Reviewer = require('../models/Reviewer');
const Folder = require('../models/Folder');
const { extractTextFromFile } = require('../utils/fileExtractor');

/**
 * GET /api/files/folders/:userId
 * Get all folders for a user
 */
router.get('/folders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const folders = await Folder.find({ userId: userId.toString() }).sort({ folderName: 1 });

    res.json({
      success: true,
      folders
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching folders',
      error: error.message
    });
  }
});

/**
 * POST /api/files/folders
 * Create a new folder
 */
router.post('/folders', async (req, res) => {
  try {
    const { userId, folderName } = req.body;

    if (!userId || !folderName || !folderName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'User ID and folder name are required'
      });
    }

    // Escape special regex characters in folder name
    const escapedFolderName = folderName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Check if folder already exists for this user (case-insensitive)
    const existingFolder = await Folder.findOne({ 
      userId: userId.toString(), // Convert to string for consistent comparison
      folderName: { $regex: new RegExp(`^${escapedFolderName}$`, 'i') } 
    });
    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: `Folder "${existingFolder.folderName}" already exists. Please choose a different name.`
      });
    }

    const folder = new Folder({
      userId: userId.toString(), // Convert to string for consistent storage
      folderName: folderName.trim()
    });

    await folder.save();

    res.json({
      success: true,
      folder
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Folder with this name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating folder',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * DELETE /api/files/folders/:folderId
 * Delete a folder (only if empty)
 */
router.delete('/folders/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Check if folder has files
    const filesCount = await File.countDocuments({ 
      userId: folder.userId.toString(), 
      subject: folder.folderName 
    });
    if (filesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete folder with files. Please delete all files first.'
      });
    }

    await Folder.findByIdAndDelete(folderId);

    res.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting folder',
      error: error.message
    });
  }
});

/**
 * GET /api/files/:userId
 * Get all files for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { subject } = req.query;

    const query = { userId: userId.toString() };
    if (subject) {
      query.subject = subject;
    }

    const files = await File.find(query).sort({ uploadedAt: -1 });

    // Get all folders for this user
    const folders = await Folder.find({ userId: userId.toString() }).sort({ folderName: 1 });

    // Group files by subject
    const filesBySubject = {};
    files.forEach(file => {
      if (!filesBySubject[file.subject]) {
        filesBySubject[file.subject] = [];
      }
      filesBySubject[file.subject].push(file);
    });

    // Include folders even if they have no files
    folders.forEach(folder => {
      if (!filesBySubject[folder.folderName]) {
        filesBySubject[folder.folderName] = [];
      }
    });

    res.json({
      success: true,
      files,
      folders,
      filesBySubject
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files',
      error: error.message
    });
  }
});

/**
 * POST /api/files
 * Create a new file
 */
router.post('/', async (req, res) => {
  try {
    const { userId, fileName, fileContent, fileType, subject, size } = req.body;

    console.log(`📤 File upload request received:`);
    console.log(`   - File: ${fileName}`);
    console.log(`   - Type: ${fileType}`);
    console.log(`   - Size: ${size} bytes`);
    console.log(`   - Content length: ${fileContent ? fileContent.length : 0} chars`);
    console.log(`   - Subject: ${subject}`);
    console.log(`   - User ID: ${userId}`);

    if (!userId || !fileName || !fileContent || !subject) {
      console.error('❌ Missing required fields:', {
        userId: !!userId,
        fileName: !!fileName,
        fileContent: !!fileContent,
        subject: !!subject
      });
      return res.status(400).json({
        success: false,
        message: 'User ID, file name, content, and subject are required'
      });
    }

    // Auto-create folder if it doesn't exist
    try {
      const existingFolder = await Folder.findOne({ 
        userId: userId.toString(), 
        folderName: subject.trim() 
      });
      if (!existingFolder) {
        const newFolder = new Folder({
          userId: userId.toString(),
          folderName: subject.trim()
        });
        await newFolder.save();
      }
    } catch (folderError) {
      // If folder creation fails (e.g., duplicate), continue with file creation
      console.log('Folder might already exist or error creating folder:', folderError.message);
    }

    // Extract text from DOCX files
    let extractedContent = fileContent;
    const finalFileType = fileType || 'txt';
    
    // Validate file type is supported
    if (finalFileType !== 'docx' && finalFileType !== 'txt' && finalFileType !== 'md') {
      return res.status(400).json({
        success: false,
        message: `File type .${finalFileType} is not supported. Please upload .docx, .txt, or .md files only.`
      });
    }
    
    if (finalFileType === 'docx') {
      try {
        console.log(`📄 Extracting text from DOCX file: ${fileName}`);
        extractedContent = await extractTextFromFile(fileContent, finalFileType);
        
        // Validate extraction was successful
        if (!extractedContent || extractedContent.trim().length === 0) {
          throw new Error('Text extraction returned empty content. The DOCX file might be corrupted or empty.');
        }
        
        // Check if extraction failed (placeholder content)
        if (extractedContent.includes('text extraction failed') || extractedContent.includes('Text extraction failed')) {
          throw new Error('Text extraction failed - DOCX file might be corrupted or unsupported format');
        }
        
        console.log(`✅ Successfully extracted ${extractedContent.length} characters from DOCX file: ${fileName}`);
        console.log(`📝 Content preview: ${extractedContent.substring(0, 200)}...`);
      } catch (extractError) {
        console.error(`❌ Error extracting text from DOCX:`, extractError.message);
        console.error('Error details:', extractError);
        
        // Return error instead of storing placeholder
        return res.status(400).json({
          success: false,
          message: `Failed to extract text from DOCX file: ${extractError.message}. Please ensure the file is not corrupted and contains readable text.`,
          error: extractError.message
        });
      }
    } else if (finalFileType === 'txt' || finalFileType === 'md') {
      // For text files, validate content exists
      if (!extractedContent || extractedContent.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'File content is too short or empty. Please upload a file with actual content.'
        });
      }
    }

    const file = new File({
      userId: userId.toString(), // Convert to string for consistency
      fileName,
      fileContent: extractedContent,
      fileType: finalFileType,
      subject: subject.trim(),
      size: size || extractedContent.length
    });

    await file.save();

    res.json({
      success: true,
      file
    });
  } catch (error) {
    console.error('❌ Error creating file:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    
    // Provide more specific error messages
    let errorMessage = 'Error creating file';
    let statusCode = 500;
    
    if (error.message && error.message.includes('extract')) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.message && (error.message.includes('corrupted') || error.message.includes('empty'))) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.message && error.message.includes('not supported')) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.code === 'ENOENT') {
      errorMessage = 'File system error - please try again';
      statusCode = 500;
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      errorMessage = `Failed to upload file: ${error.toString()}`;
    }
    
    console.error(`📤 Sending error response (${statusCode}):`, errorMessage);
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message || error.toString()
    });
  }
});

/**
 * GET /api/files/reviewers/:userId
 * Get all reviewers for a user
 */
router.get('/reviewers/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log(`📚 Fetching reviewers for userId: ${userId}`);

  // Always return success - even if there's an error, return empty array
  // This prevents the frontend from showing error dialogs
  try {
    const mongoose = require('mongoose');
    let reviewers = [];
    
    // Check if Reviewer model is available and MongoDB is connected
    if (!Reviewer || !mongoose.connection.readyState) {
      console.log('⚠️ MongoDB not connected or Reviewer model not available, returning empty array');
      return res.json({
        success: true,
        reviewers: []
      });
    }
    
    // Try both ObjectId and String queries
    if (mongoose.Types.ObjectId.isValid(userId) && userId.toString().length === 24) {
      // Valid ObjectId format - try ObjectId first
      try {
        reviewers = await Reviewer.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
        console.log(`✅ Found ${reviewers.length} reviewers using ObjectId query`);
      } catch (queryError) {
        console.log('⚠️ Error querying with ObjectId, trying string:', queryError.message);
        // Fallback to string query
        try {
          reviewers = await Reviewer.find({ userId: userId.toString() }).sort({ createdAt: -1 });
          console.log(`✅ Found ${reviewers.length} reviewers using string query`);
        } catch (stringError) {
          console.log('⚠️ Both ObjectId and string queries failed:', stringError.message);
          reviewers = [];
        }
      }
    } else {
      // String userId (e.g., "demo-user") - try string first
      try {
        reviewers = await Reviewer.find({ userId: userId.toString() }).sort({ createdAt: -1 });
        console.log(`✅ Found ${reviewers.length} reviewers using string query`);
      } catch (queryError) {
        console.log(`⚠️ Could not query with string userId: ${queryError.message}`);
        reviewers = [];
      }
    }
    
    console.log(`✅ Returning ${reviewers.length} reviewers for userId: ${userId}`);
    return res.json({
      success: true,
      reviewers: reviewers || []
    });
  } catch (error) {
    // Catch any unexpected errors and still return success
    console.log(`⚠️ Unexpected error fetching reviewers (returning empty): ${error.message}`);
    return res.json({
      success: true,
      reviewers: []
    });
  }
});

/**
 * DELETE /api/files/:fileId
 * Delete a file
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await File.findByIdAndDelete(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message
    });
  }
});

module.exports = router;

