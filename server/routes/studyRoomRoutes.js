const express = require('express');
const router = express.Router();
const StudyRoom = require('../models/StudyRoom');

/**
 * Generate a unique room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'STUDY-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/study-rooms
 * Create a new study room
 */
router.post('/', async (req, res) => {
  try {
    const { userId, username, roomName } = req.body;

    if (!userId || !username) {
      return res.status(400).json({
        success: false,
        message: 'User ID and username are required'
      });
    }

    // Generate unique room code
    let roomCode;
    let isUnique = false;
    while (!isUnique) {
      roomCode = generateRoomCode();
      const existing = await StudyRoom.findOne({ roomCode });
      if (!existing) {
        isUnique = true;
      }
    }

    // Create room
    const studyRoom = new StudyRoom({
      roomCode,
      roomName: roomName || 'Study Room',
      hostId: userId.toString(),
      hostName: username,
      participants: [{
        userId: userId.toString(),
        username: username,
        joinedAt: new Date()
      }]
    });

    await studyRoom.save();

    res.json({
      success: true,
      room: {
        roomCode: studyRoom.roomCode,
        roomName: studyRoom.roomName,
        hostId: studyRoom.hostId,
        hostName: studyRoom.hostName,
        participants: studyRoom.participants,
        createdAt: studyRoom.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating study room:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating study room',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/join
 * Join a study room by room code
 */
router.post('/join', async (req, res) => {
  try {
    const { roomCode, userId, username } = req.body;

    if (!roomCode || !userId || !username) {
      return res.status(400).json({
        success: false,
        message: 'Room code, user ID, and username are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or has expired'
      });
    }

    // Check if user is already in room
    const existingParticipant = studyRoom.participants.find(
      p => p.userId === userId.toString()
    );

    if (existingParticipant) {
      return res.json({
        success: true,
        message: 'Already in room',
        room: studyRoom
      });
    }

    // Add participant
    studyRoom.participants.push({
      userId: userId.toString(),
      username: username,
      joinedAt: new Date()
    });

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Joined room successfully',
      room: studyRoom
    });
  } catch (error) {
    console.error('Error joining study room:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining study room',
      error: error.message
    });
  }
});

/**
 * GET /api/study-rooms/:roomCode
 * Get current room state (for polling)
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or has expired'
      });
    }

    res.json({
      success: true,
      room: studyRoom
    });
  } catch (error) {
    console.error('Error fetching study room:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching study room',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/set-document
 * Set the main document for the room (host only)
 */
router.post('/:roomCode/set-document', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, fileId, viewMode = 'raw' } = req.body;

    if (!userId || !fileId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and file ID are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can set document
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can set the main document'
      });
    }

    // Find the file in shared files
    const sharedFile = studyRoom.sharedFiles.find(sf => sf.fileId === fileId.toString());

    if (!sharedFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found in shared files'
      });
    }

    // Set as current document
    studyRoom.currentDocument = {
      fileId: sharedFile.fileId,
      fileName: sharedFile.fileName,
      content: sharedFile.fileContent,
      fileContent: sharedFile.fileContent,
      fileType: sharedFile.fileType,
      subject: sharedFile.subject,
      sharedBy: sharedFile.sharedBy,
      viewMode: viewMode
    };
    
    // If switching to reviewer mode, keep existing reviewer content if available
    if (viewMode === 'reviewer' && !studyRoom.currentDocument.reviewerContent?.reviewContent) {
      // Reviewer content will be set separately when generated
      studyRoom.currentDocument.reviewerContent = {
        reviewContent: null,
        keyPoints: []
      };
    } else if (viewMode === 'raw') {
      // Clear reviewer content when switching to raw
      studyRoom.currentDocument.reviewerContent = {
        reviewContent: null,
        keyPoints: []
      };
    }

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Document set successfully',
      currentDocument: studyRoom.currentDocument
    });
  } catch (error) {
    console.error('Error setting document:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting document',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/set-reviewer
 * Set reviewer content for current document (host only, after generating)
 */
router.post('/:roomCode/set-reviewer', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, reviewContent, keyPoints } = req.body;

    if (!userId || !reviewContent) {
      return res.status(400).json({
        success: false,
        message: 'User ID and review content are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can set reviewer
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can set reviewer content'
      });
    }

    if (!studyRoom.currentDocument || !studyRoom.currentDocument.fileId) {
      return res.status(400).json({
        success: false,
        message: 'No document is currently set'
      });
    }

    // Set reviewer content
    studyRoom.currentDocument.reviewerContent = {
      reviewContent: reviewContent,
      keyPoints: keyPoints || []
    };

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Reviewer content set successfully'
    });
  } catch (error) {
    console.error('Error setting reviewer:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting reviewer content',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/clear-document
 * Clear the main document (host only)
 */
router.post('/:roomCode/clear-document', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can clear document
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can clear the main document'
      });
    }

    // Clear current document
    studyRoom.currentDocument = {
      fileId: null,
      fileName: null,
      content: null,
      fileContent: null,
      fileType: null,
      subject: null,
      sharedBy: {
        userId: null,
        username: null
      },
      viewMode: 'raw'
    };

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Document cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing document:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing document',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/scroll
 * Update scroll position (synchronized viewing)
 */
router.post('/:roomCode/scroll', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { scrollPosition } = req.body;

    if (scrollPosition === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Scroll position is required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    studyRoom.scrollPosition = scrollPosition;
    await studyRoom.save();

    res.json({
      success: true,
      scrollPosition: studyRoom.scrollPosition
    });
  } catch (error) {
    console.error('Error updating scroll position:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating scroll position',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/notes
 * Add a shared note
 */
router.post('/:roomCode/notes', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, username, note, position } = req.body;

    if (!userId || !username || !note) {
      return res.status(400).json({
        success: false,
        message: 'User ID, username, and note are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    studyRoom.sharedNotes.push({
      userId: userId.toString(),
      username: username,
      note: note.trim(),
      position: position || 0,
      timestamp: new Date()
    });

    await studyRoom.save();

    res.json({
      success: true,
      note: studyRoom.sharedNotes[studyRoom.sharedNotes.length - 1]
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding note',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/chat
 * Send a chat message
 */
router.post('/:roomCode/chat', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, username, message } = req.body;

    if (!userId || !username || !message) {
      return res.status(400).json({
        success: false,
        message: 'User ID, username, and message are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    studyRoom.chatMessages.push({
      userId: userId.toString(),
      username: username,
      message: message.trim(),
      timestamp: new Date()
    });

    // Keep only last 100 messages
    if (studyRoom.chatMessages.length > 100) {
      studyRoom.chatMessages = studyRoom.chatMessages.slice(-100);
    }

    await studyRoom.save();

    res.json({
      success: true,
      message: studyRoom.chatMessages[studyRoom.chatMessages.length - 1]
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending chat message',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/timer
 * Control shared study timer
 */
router.post('/:roomCode/timer', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { action, duration } = req.body; // action: 'start', 'pause', 'reset', 'tick'

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (action === 'start') {
      // Require at least 2 participants to start timer (collaborative study)
      if (!studyRoom.participants || studyRoom.participants.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Please wait for at least one more person to join before starting the timer. This is a collaborative study session!'
        });
      }

      studyRoom.studyTimer.isRunning = true;
      studyRoom.studyTimer.duration = duration || 25 * 60; // Default 25 minutes
      studyRoom.studyTimer.timeRemaining = duration || 25 * 60;
      studyRoom.studyTimer.startedAt = new Date();
    } else if (action === 'pause') {
      studyRoom.studyTimer.isRunning = false;
    } else if (action === 'reset') {
      studyRoom.studyTimer.isRunning = false;
      studyRoom.studyTimer.timeRemaining = duration || 25 * 60;
      studyRoom.studyTimer.startedAt = null;
    } else if (action === 'tick') {
      // Update time remaining based on elapsed time
      if (studyRoom.studyTimer.isRunning && studyRoom.studyTimer.startedAt) {
        const elapsed = Math.floor((new Date() - studyRoom.studyTimer.startedAt) / 1000);
        studyRoom.studyTimer.timeRemaining = Math.max(0, studyRoom.studyTimer.duration - elapsed);
        
        // Auto-pause when time reaches 0
        if (studyRoom.studyTimer.timeRemaining <= 0) {
          studyRoom.studyTimer.isRunning = false;
        }
      }
    }

    await studyRoom.save();

    res.json({
      success: true,
      timer: studyRoom.studyTimer
    });
  } catch (error) {
    console.error('Error controlling timer:', error);
    res.status(500).json({
      success: false,
      message: 'Error controlling timer',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/leave
 * Leave a study room
 */
router.post('/:roomCode/leave', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Remove participant
    studyRoom.participants = studyRoom.participants.filter(
      p => p.userId !== userId.toString()
    );

    // If host leaves and no participants, delete room
    if (studyRoom.hostId === userId.toString() && studyRoom.participants.length === 0) {
      studyRoom.isActive = false;
      await studyRoom.save();
      return res.json({
        success: true,
        message: 'Room closed (host left and no participants)'
      });
    }

    // If host leaves, assign new host (first participant)
    if (studyRoom.hostId === userId.toString() && studyRoom.participants.length > 0) {
      studyRoom.hostId = studyRoom.participants[0].userId;
      studyRoom.hostName = studyRoom.participants[0].username;
    }

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Error leaving study room:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving study room',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/share-file
 * Share a file in the study room (any participant)
 */
router.post('/:roomCode/share-file', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, username, fileId } = req.body;

    if (!userId || !username || !fileId) {
      return res.status(400).json({
        success: false,
        message: 'User ID, username, and file ID are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is a participant
    const isParticipant = studyRoom.participants.some(
      p => p.userId === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You must be a participant to share files'
      });
    }

    // Check if file is already shared
    const alreadyShared = studyRoom.sharedFiles.some(
      sf => sf.fileId === fileId.toString()
    );

    if (alreadyShared) {
      return res.status(400).json({
        success: false,
        message: 'This file is already shared in this room'
      });
    }

    // Get file from File model
    const File = require('../models/File');
    const file = await File.findOne({ 
      _id: fileId,
      userId: userId.toString()
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found or you do not have permission to share it'
      });
    }

    // Add file to shared files
    studyRoom.sharedFiles.push({
      fileId: file._id.toString(),
      fileName: file.fileName,
      fileContent: file.fileContent,
      fileType: file.fileType,
      subject: file.subject,
      sharedBy: {
        userId: userId.toString(),
        username: username
      },
      sharedAt: new Date()
    });

    await studyRoom.save();

    res.json({
      success: true,
      message: 'File shared successfully',
      sharedFile: studyRoom.sharedFiles[studyRoom.sharedFiles.length - 1]
    });
  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing file',
      error: error.message
    });
  }
});

/**
 * DELETE /api/study-rooms/:roomCode/shared-files/:fileId
 * Remove a shared file (only the person who shared it or host can remove)
 */
router.delete('/:roomCode/shared-files/:fileId', async (req, res) => {
  try {
    const { roomCode, fileId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const sharedFileIndex = studyRoom.sharedFiles.findIndex(
      sf => sf.fileId === fileId
    );

    if (sharedFileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Shared file not found'
      });
    }

    const sharedFile = studyRoom.sharedFiles[sharedFileIndex];
    const isHost = studyRoom.hostId === userId.toString();
    const isOwner = sharedFile.sharedBy.userId === userId.toString();

    // Only host or file owner can remove
    if (!isHost && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only the host or file owner can remove shared files'
      });
    }

    // Remove file
    studyRoom.sharedFiles.splice(sharedFileIndex, 1);
    await studyRoom.save();

    res.json({
      success: true,
      message: 'Shared file removed successfully'
    });
  } catch (error) {
    console.error('Error removing shared file:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing shared file',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/quiz/start
 * Start a quiz session in the study room (host only)
 */
router.post('/:roomCode/quiz/start', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, questions, subject, testType } = req.body;

    if (!userId || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and questions are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can start quiz
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can start a quiz'
      });
    }

    // Initialize quiz for all participants
    studyRoom.quiz.isActive = true;
    studyRoom.quiz.status = 'in-progress';
    studyRoom.quiz.questions = questions;
    studyRoom.quiz.currentQuestionIndex = 0;
    studyRoom.quiz.startedAt = new Date();
    
    // Initialize answers for all participants
    studyRoom.quiz.participantAnswers = studyRoom.participants.map(p => ({
      userId: p.userId,
      username: p.username,
      answers: [],
      score: 0
    }));

    await studyRoom.save();

    res.json({
      success: true,
      quiz: studyRoom.quiz
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting quiz',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/quiz/answer
 * Submit an answer in the quiz
 */
router.post('/:roomCode/quiz/answer', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, questionIndex, selectedAnswer, timeTaken } = req.body;

    if (!userId || questionIndex === undefined || selectedAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID, question index, and answer are required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!studyRoom.quiz.isActive || studyRoom.quiz.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Quiz is not active'
      });
    }

    const question = studyRoom.quiz.questions[questionIndex];
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Find or create participant answer entry
    let participantAnswer = studyRoom.quiz.participantAnswers.find(
      pa => pa.userId === userId.toString()
    );

    if (!participantAnswer) {
      // Add participant if not found (shouldn't happen, but safety check)
      const participant = studyRoom.participants.find(p => p.userId === userId.toString());
      if (!participant) {
        return res.status(403).json({
          success: false,
          message: 'You are not a participant in this room'
        });
      }
      participantAnswer = {
        userId: participant.userId,
        username: participant.username,
        answers: [],
        score: 0
      };
      studyRoom.quiz.participantAnswers.push(participantAnswer);
    }

    // Check if already answered this question
    const existingAnswer = participantAnswer.answers.find(
      a => a.questionIndex === questionIndex
    );

    if (existingAnswer) {
      return res.json({
        success: true,
        isCorrect: existingAnswer.isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        score: participantAnswer.score
      });
    }

    // Check answer
    const isCorrect = selectedAnswer === question.correctAnswer;

    // Add answer
    participantAnswer.answers.push({
      questionIndex,
      selectedAnswer,
      isCorrect,
      timeTaken: timeTaken || 0
    });

    // Update score
    if (isCorrect) {
      participantAnswer.score += 1;
    }

    await studyRoom.save();

    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      score: participantAnswer.score
    });
  } catch (error) {
    console.error('Error submitting quiz answer:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting answer',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/quiz/next
 * Move to next question (host only)
 */
router.post('/:roomCode/quiz/next', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can control quiz
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can control the quiz'
      });
    }

    if (!studyRoom.quiz.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Quiz is not active'
      });
    }

    // Move to next question
    if (studyRoom.quiz.currentQuestionIndex < studyRoom.quiz.questions.length - 1) {
      studyRoom.quiz.currentQuestionIndex += 1;
    } else {
      // Quiz completed
      studyRoom.quiz.status = 'completed';
      studyRoom.quiz.completedAt = new Date();
    }

    await studyRoom.save();

    res.json({
      success: true,
      quiz: studyRoom.quiz
    });
  } catch (error) {
    console.error('Error moving to next question:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving to next question',
      error: error.message
    });
  }
});

/**
 * POST /api/study-rooms/:roomCode/quiz/end
 * End quiz session (host only)
 */
router.post('/:roomCode/quiz/end', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can end quiz
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can end the quiz'
      });
    }

    studyRoom.quiz.isActive = false;
    studyRoom.quiz.status = 'completed';
    studyRoom.quiz.completedAt = new Date();

    await studyRoom.save();

    res.json({
      success: true,
      message: 'Quiz ended',
      quiz: studyRoom.quiz
    });
  } catch (error) {
    console.error('Error ending quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending quiz',
      error: error.message
    });
  }
});

/**
 * DELETE /api/study-rooms/:roomCode
 * Delete/close a study room (host only)
 */
router.delete('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const studyRoom = await StudyRoom.findOne({ 
      roomCode: roomCode.toUpperCase(),
      isActive: true
    });

    if (!studyRoom) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Only host can delete
    if (studyRoom.hostId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can delete the room'
      });
    }

    studyRoom.isActive = false;
    await studyRoom.save();

    res.json({
      success: true,
      message: 'Room closed successfully'
    });
  } catch (error) {
    console.error('Error deleting study room:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting study room',
      error: error.message
    });
  }
});

module.exports = router;

