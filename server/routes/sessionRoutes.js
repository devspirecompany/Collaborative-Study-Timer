const express = require('express');
const router = express.Router();
const StudySession = require('../models/StudySession');
const Productivity = require('../models/Productivity');
const Notification = require('../models/Notification');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

// Initialize AI (if API keys provided)
const gemini = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * GET /api/sessions/:userId
 * Get all study sessions for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const sessions = await StudySession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await StudySession.countDocuments({ userId });

    res.json({
      success: true,
      sessions,
      total
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions',
      error: error.message
    });
  }
});

/**
 * POST /api/sessions
 * Create a new study session
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      duration,
      mode,
      aiRecommended,
      aiRecommendedDuration,
      studyData
    } = req.body;

    if (!userId || !duration) {
      return res.status(400).json({
        success: false,
        message: 'User ID and duration are required'
      });
    }

    const session = new StudySession({
      userId,
      duration,
      mode: mode || 'study',
      aiRecommended: aiRecommended || false,
      aiRecommendedDuration,
      studyData,
      completed: true,
      endTime: new Date()
    });

    await session.save();

    // Update productivity
    await updateProductivity(userId, duration, mode);

    // Generate AI notification for completed study session
    if (mode === 'study' && duration > 0) {
      try {
        let notificationMessage = `Great work! You've completed ${Math.floor(duration / 60)} minutes of focused study.`;
        
        // Try AI enhancement
        if (gemini || openai) {
          try {
            if (gemini) {
              const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
              const prompt = `A student just completed ${Math.floor(duration / 60)} minutes of study. Generate a brief, encouraging notification (max 40 words).`;
              const result = await model.generateContent(prompt);
              const response = await result.response;
              notificationMessage = response.text().trim();
              if (notificationMessage.length > 100) {
                notificationMessage = notificationMessage.substring(0, 97) + '...';
              }
            } else if (openai) {
              const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a study motivation assistant. Generate brief, encouraging notifications.'
                  },
                  {
                    role: 'user',
                    content: `A student just completed ${Math.floor(duration / 60)} minutes of study. Generate a brief, encouraging notification (max 40 words).`
                  }
                ],
                temperature: 0.7,
                max_tokens: 50
              });
              notificationMessage = completion.choices[0].message.content.trim();
              if (notificationMessage.length > 100) {
                notificationMessage = notificationMessage.substring(0, 97) + '...';
              }
            }
          } catch (aiError) {
            console.log('AI notification generation failed, using default');
          }
        }

        const notification = new Notification({
          userId: userId.toString(),
          type: 'study_session',
          title: 'Study Session Completed!',
          message: notificationMessage,
          icon: '⏱️',
          color: 'blue',
          read: false,
          actionUrl: '/productivity-tracker',
          metadata: { sessionId: session._id, duration }
        });
        await notification.save();
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't fail the session creation if notification fails
      }
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating session',
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/stats/:userId
 * Get study session statistics for a user
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'week' } = req.query;

    let startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const sessions = await StudySession.find({
      userId,
      createdAt: { $gte: startDate },
      mode: 'study'
    });

    const totalStudyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalSessions = sessions.length;
    const averageSessionLength = totalSessions > 0 ? totalStudyTime / totalSessions : 0;

    // Calculate today's study time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySessions = sessions.filter(s => {
      const sessionDate = new Date(s.createdAt);
      return sessionDate >= today && sessionDate < tomorrow;
    });

    const todayStudyTime = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    res.json({
      success: true,
      stats: {
        totalStudyTime: totalStudyTime / 3600, // in hours
        totalSessions,
        averageSessionLength: averageSessionLength / 60, // in minutes
        sessionsToday: todaySessions.length,
        todayStudyTime: todayStudyTime / 3600 // in hours
      }
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session stats',
      error: error.message
    });
  }
});

// Helper function: Update productivity
async function updateProductivity(userId, duration, mode) {
  if (mode !== 'study') return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let productivity = await Productivity.findOne({
    userId,
    date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
  });

  if (!productivity) {
    productivity = new Productivity({
      userId,
      date: today
    });
  }

  productivity.totalStudyTime += duration;
  productivity.sessionsCompleted += 1;

  await productivity.save();
}

module.exports = router;

