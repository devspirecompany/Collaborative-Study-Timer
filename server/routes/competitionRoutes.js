const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Competition = require('../models/Competition');

/**
 * POST /api/competitions/create
 * Create a new competition room
 */
router.post('/create', async (req, res) => {
  try {
    const { userId, subject, questions, maxPlayers = 2, isGroupQuiz = false, opponentType, numberOfQuestions, playerName, roomId: customRoomId } = req.body;

    if (!userId || !subject) {
      return res.status(400).json({
        success: false,
        message: 'User ID and subject are required'
      });
    }

    // Use custom roomId if provided, otherwise generate one
    let roomId = customRoomId;
    if (!roomId) {
      // Generate room ID
      roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else {
      // Normalize custom roomId (uppercase) for consistency
      roomId = roomId.toUpperCase().trim();
    }
    
    console.log('🏠 Creating room with ID:', roomId);
    
    // Check if roomId already exists
    const existingRoom = await Competition.findOne({ roomId });
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: 'Room ID already exists. Please try again.'
      });
    }

    // Use provided questions or generate sample questions
    let competitionQuestions = questions || [];
    if (competitionQuestions.length === 0) {
      // Generate sample questions (you can enhance this with AI)
      const numQuestions = numberOfQuestions || 5;
      competitionQuestions = generateSampleQuestions(subject, numQuestions);
    }

    // For group quiz (Quizizz-style), allow more players (default: 10)
    // For 1v1 battle, keep it at 2
    const finalMaxPlayers = isGroupQuiz ? (maxPlayers || 10) : 2;

    const competition = new Competition({
      roomId,
      subject,
      questions: competitionQuestions,
      players: [],
      status: 'waiting',
      maxPlayers: finalMaxPlayers,
      isGroupQuiz: isGroupQuiz || false,
      opponentType: opponentType || undefined // Store opponent type ('player' or 'ai')
    });

    // Add host player to the room (for both 1v1 and group quiz)
    // This ensures the host is in the players list from the start
    competition.players.push({
      userId: userId,
      playerName: playerName || 'Player',
      score: 0,
      answers: [],
      isAI: false
    });
    console.log('👤 Added host player to room:', { userId, playerName });

    // If AI opponent is selected, add both AI player and user player immediately
    if (opponentType === 'ai' && !isGroupQuiz) {
      // Add AI player (host already added above)
      competition.players.push({
        userId: new mongoose.Types.ObjectId(), // AI player has special ID
        playerName: 'AI Opponent',
        score: 0,
        answers: [],
        isAI: true // Mark as AI player
      });
      
      // Start competition immediately with AI and user
      competition.status = 'in-progress';
      competition.startedAt = new Date();
    }

    await competition.save();

    res.json({
      success: true,
      competition: {
        roomId: competition.roomId,
        subject: competition.subject,
        questions: competition.questions,
        status: competition.status,
        players: competition.players,
        opponentType: competition.opponentType
      }
    });
  } catch (error) {
    console.error('Error creating competition:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating competition',
      error: error.message
    });
  }
});

/**
 * POST /api/competitions/join
 * Join a competition room (by roomId) OR find a match automatically
 */
router.post('/join', async (req, res) => {
  try {
    const { roomId, userId, playerName, subject, autoMatch = false } = req.body;

    if (!userId || !playerName) {
      return res.status(400).json({
        success: false,
        message: 'User ID and player name are required'
      });
    }

    // If autoMatch is true, try to find a waiting room first
    // Note: Only auto-match for 1v1 battles, not group quizzes
    if (autoMatch && !roomId) {
      // Find a waiting competition with same subject (or any subject if not specified)
      // Only match 1v1 battles (isGroupQuiz: false or not set)
      const matchQuery = {
        status: 'waiting',
        isGroupQuiz: { $ne: true }, // Exclude group quizzes from auto-matching
        'players.0': { $exists: true }, // Has at least 1 player
        'players.1': { $exists: false } // But not 2 players yet (1v1 only)
      };
      
      if (subject) {
        matchQuery.subject = subject;
      }

      const waitingCompetition = await Competition.findOne(matchQuery)
        .sort({ createdAt: 1 }); // Oldest waiting room first

      if (waitingCompetition) {
        // Found a match! Join this room
        console.log(`🎯 Auto-match found! Joining room ${waitingCompetition.roomId}`);
        
        // Check if player already in this room
        const existingPlayer = waitingCompetition.players.find(p => p.userId.toString() === userId);
        if (existingPlayer) {
          return res.json({
            success: true,
            competition: {
              roomId: waitingCompetition.roomId,
              subject: waitingCompetition.subject,
              questions: waitingCompetition.questions,
              players: waitingCompetition.players,
              status: waitingCompetition.status
            },
            matched: true
          });
        }

        // Add player
        waitingCompetition.players.push({
          userId,
          playerName,
          score: 0,
          answers: []
        });

        // Start competition (now has 2 players)
        waitingCompetition.status = 'in-progress';
        waitingCompetition.startedAt = new Date();

        await waitingCompetition.save();

        return res.json({
          success: true,
          competition: {
            roomId: waitingCompetition.roomId,
            subject: waitingCompetition.subject,
            questions: waitingCompetition.questions,
            players: waitingCompetition.players,
            status: waitingCompetition.status,
            startedAt: waitingCompetition.startedAt
          },
          matched: true
        });
      }
    }

    // If roomId provided, join specific room
    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required or enable auto-match'
      });
    }

    // Normalize roomId (uppercase) to match how it was created
    const normalizedRoomId = roomId.toUpperCase().trim();
    console.log('🔍 Looking for room with ID:', normalizedRoomId);
    
    const competition = await Competition.findOne({ roomId: normalizedRoomId });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition room not found'
      });
    }

    if (competition.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Competition is not accepting new players'
      });
    }

    if (competition.players.length >= competition.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Competition room is full'
      });
    }

    // Check if player already joined
    const existingPlayer = competition.players.find(p => p.userId.toString() === userId.toString());
    if (existingPlayer) {
      console.log('✅ Player already in room, returning existing competition');
      console.log('   Players:', competition.players.map(p => ({ userId: p.userId.toString(), name: p.playerName })));
      return res.json({
        success: true,
        competition: {
          roomId: competition.roomId,
          subject: competition.subject,
          questions: competition.questions,
          players: competition.players,
          status: competition.status
        }
      });
    }

    console.log('➕ Adding new player to room:', { userId, playerName });
    console.log('   Current players before add:', competition.players.map(p => ({ userId: p.userId.toString(), name: p.playerName })));

    // Add player
    competition.players.push({
      userId,
      playerName,
      score: 0,
      answers: []
    });

    console.log('   Players after add:', competition.players.map(p => ({ userId: p.userId.toString(), name: p.playerName })));
    console.log('   Total players:', competition.players.length);

    // Start competition if enough players
    if (competition.players.length >= competition.maxPlayers) {
      competition.status = 'in-progress';
      competition.startedAt = new Date();
      console.log('🚀 Competition starting! Status changed to in-progress');
    }

    await competition.save();

    res.json({
      success: true,
      competition: {
        roomId: competition.roomId,
        subject: competition.subject,
        questions: competition.questions,
        players: competition.players,
        status: competition.status,
        startedAt: competition.startedAt
      }
    });
  } catch (error) {
    console.error('Error joining competition:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining competition',
      error: error.message
    });
  }
});

/**
 * POST /api/competitions/answer
 * Submit an answer in a competition
 */
router.post('/answer', async (req, res) => {
  try {
    const { roomId, userId, questionId, answer, timeTaken } = req.body;

    if (!roomId || !userId || !questionId || answer === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Room ID, user ID, question ID, and answer are required'
      });
    }

    const competition = await Competition.findOne({ roomId });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition room not found'
      });
    }

    // Handle AI opponent answers
    let player;
    if (userId === 'ai-opponent') {
      player = competition.players.find(p => p.isAI || p.playerName === 'AI Opponent');
    } else {
      player = competition.players.find(p => p.userId && p.userId.toString() === userId);
    }
    
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found in competition'
      });
    }

    // Find the question by index or ID
    let question;
    if (typeof questionId === 'number' || !isNaN(questionId)) {
      // questionId is an index
      question = competition.questions[parseInt(questionId)];
    } else {
      // questionId is an ID
      question = competition.questions.find(q => q._id?.toString() === questionId || q.id === questionId);
    }
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if already answered
    const existingAnswer = player.answers.find(a => a.questionId === questionId);
    if (existingAnswer) {
      return res.json({
        success: true,
        message: 'Answer already submitted',
        isCorrect: existingAnswer.isCorrect,
        correctAnswer: question.correctAnswer
      });
    }

    // Check answer
    const isCorrect = answer === question.correctAnswer;

    // Add answer
    player.answers.push({
      questionId,
      answer,
      isCorrect,
      timeTaken: timeTaken || 0
    });

    // Update score
    if (isCorrect) {
      player.score += 1;
    }

    await competition.save();

    res.json({
      success: true,
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      playerScore: player.score
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting answer',
      error: error.message
    });
  }
});

/**
 * POST /api/competitions/complete
 * Mark competition as completed
 */
router.post('/complete', async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    const competition = await Competition.findOne({ roomId });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition room not found'
      });
    }

    competition.status = 'completed';
    competition.completedAt = new Date();

    // Determine winner
    if (competition.players.length > 0) {
      const sortedPlayers = [...competition.players].sort((a, b) => b.score - a.score);
      competition.winner = sortedPlayers[0].userId;
    }

    await competition.save();

    res.json({
      success: true,
      competition: {
        roomId: competition.roomId,
        players: competition.players,
        winner: competition.winner,
        status: competition.status
      }
    });
  } catch (error) {
    console.error('Error completing competition:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing competition',
      error: error.message
    });
  }
});

/**
 * GET /api/competitions/:roomId
 * Get competition details
 */
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const competition = await Competition.findOne({ roomId });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: 'Competition room not found'
      });
    }

    res.json({
      success: true,
      competition
    });
  } catch (error) {
    console.error('Error fetching competition:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching competition',
      error: error.message
    });
  }
});

// Helper function: Generate sample questions
function generateSampleQuestions(subject, numQuestions) {
  const questions = [];
  for (let i = 0; i < numQuestions; i++) {
    questions.push({
      question: `What is an important concept in ${subject}? (Question ${i + 1})`,
      options: [
        `Concept A for ${subject}`,
        `Concept B for ${subject}`,
        `Concept C for ${subject}`,
        `Concept D for ${subject}`
      ],
      correctAnswer: i % 4,
      explanation: `This is the correct answer based on ${subject} principles.`
    });
  }
  return questions;
}

module.exports = router;

