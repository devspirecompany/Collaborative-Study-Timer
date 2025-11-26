const express = require('express');
const router = express.Router();
const Achievement = require('../models/Achievement');
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
 * GET /api/achievements/:userId
 * Get all achievements for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get or create achievements for user
    let achievements = await Achievement.find({ userId });

    // If no achievements exist, initialize them
    if (achievements.length === 0) {
      achievements = await initializeAchievements(userId);
    } else {
      // Update achievement progress
      achievements = await updateAchievementProgress(userId, achievements);
    }

    res.json({
      success: true,
      achievements
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching achievements',
      error: error.message
    });
  }
});

/**
 * POST /api/achievements/check
 * Check and unlock achievements based on user activity
 */
router.post('/check', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const unlockedAchievements = await checkAndUnlockAchievements(userId);

    res.json({
      success: true,
      unlockedAchievements
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking achievements',
      error: error.message
    });
  }
});

// Helper function: Initialize achievements for a user
async function initializeAchievements(userId) {
  const achievementTypes = [
    {
      achievementType: 'early_bird',
      title: 'Early Bird',
      description: 'Study 5 days in a row before 8 AM',
      icon: '🌅',
      target: 5,
      current: 0
    },
    {
      achievementType: 'study_marathon',
      title: 'Study Marathon',
      description: 'Complete 100 hours of study time',
      icon: '🏃',
      target: 100,
      current: 0
    },
    {
      achievementType: 'streak_master',
      title: 'Streak Master',
      description: 'Maintain a 30-day study streak',
      icon: '🔥',
      target: 30,
      current: 0
    },
    {
      achievementType: 'perfect_week',
      title: 'Perfect Week',
      description: 'Study every day for 7 days',
      icon: '⭐',
      target: 7,
      current: 0
    },
    {
      achievementType: 'night_owl',
      title: 'Night Owl',
      description: 'Study 10 sessions after 10 PM',
      icon: '🦉',
      target: 10,
      current: 0
    },
    {
      achievementType: 'focused_mind',
      title: 'Focused Mind',
      description: 'Complete 50 study sessions',
      icon: '🧠',
      target: 50,
      current: 0
    },
    {
      achievementType: 'social_learner',
      title: 'Social Learner',
      description: 'Join 10 group study competitions',
      icon: '👥',
      target: 10,
      current: 0
    },
    {
      achievementType: 'quiz_master',
      title: 'Quiz Master',
      description: 'Win 5 competitions',
      icon: '🏆',
      target: 5,
      current: 0
    },
    {
      achievementType: 'file_organizer',
      title: 'File Organizer',
      description: 'Upload 20 files',
      icon: '📁',
      target: 20,
      current: 0
    },
    {
      achievementType: 'time_warrior',
      title: 'Time Warrior',
      description: 'Study for 4 hours in a single day',
      icon: '⏰',
      target: 4,
      current: 0
    }
  ];

  const achievements = await Promise.all(
    achievementTypes.map(type =>
      Achievement.create({
        userId,
        ...type,
        progress: 0,
        unlocked: false
      })
    )
  );

  return achievements;
}

// Helper function: Update achievement progress
async function updateAchievementProgress(userId, achievements) {
  // Get user's study data
  const sessions = await StudySession.find({ userId });
  const productivity = await Productivity.find({ userId }).sort({ date: -1 });

  const totalStudyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3600; // in hours
  const sessionsCount = sessions.length;
  const currentStreak = productivity[0]?.streak || 0;

  // Update each achievement
  for (const achievement of achievements) {
    let current = 0;
    let progress = 0;

    switch (achievement.achievementType) {
      case 'study_marathon':
        current = totalStudyTime;
        progress = Math.min(100, (current / achievement.target) * 100);
        break;
      case 'streak_master':
        current = currentStreak;
        progress = Math.min(100, (current / achievement.target) * 100);
        break;
      case 'focused_mind':
        current = sessionsCount;
        progress = Math.min(100, (current / achievement.target) * 100);
        break;
      // Add more cases as needed
    }

    achievement.current = current;
    achievement.progress = progress;

    // Check if achievement should be unlocked
    if (!achievement.unlocked && current >= achievement.target) {
      achievement.unlocked = true;
      achievement.unlockedAt = new Date();
      await achievement.save();

      // Generate AI notification for unlocked achievement
      try {
        let notificationMessage = `Congratulations! You've earned the "${achievement.title}" badge.`;
        
        // Try AI enhancement
        if (gemini || openai) {
          try {
            if (gemini) {
              const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
              const prompt = `A student just unlocked the achievement "${achievement.title}". Generate a brief, celebratory notification (max 40 words).`;
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
                    content: 'You are a study motivation assistant. Generate brief, celebratory notifications.'
                  },
                  {
                    role: 'user',
                    content: `A student just unlocked the achievement "${achievement.title}". Generate a brief, celebratory notification (max 40 words).`
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
          type: 'achievement',
          title: `Achievement Unlocked: ${achievement.title}`,
          message: notificationMessage,
          icon: achievement.icon || '🏆',
          color: 'green',
          read: false,
          actionUrl: '/achievements',
          metadata: { achievementId: achievement._id, achievementType: achievement.achievementType }
        });
        await notification.save();
      } catch (notifError) {
        console.error('Error creating achievement notification:', notifError);
        // Don't fail achievement unlock if notification fails
      }
    } else {
      await achievement.save();
    }
  }

  return achievements;
}

// Helper function: Check and unlock achievements
async function checkAndUnlockAchievements(userId) {
  const achievements = await Achievement.find({ userId, unlocked: false });
  const updatedAchievements = await updateAchievementProgress(userId, achievements);
  
  return updatedAchievements.filter(a => a.unlocked);
}

module.exports = router;

