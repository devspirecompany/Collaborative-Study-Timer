const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const StudySession = require('../models/StudySession');
const Achievement = require('../models/Achievement');
const Productivity = require('../models/Productivity');
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
 * GET /api/notifications/:userId
 * Get all notifications for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, unreadOnly = false } = req.query;

    const query = { userId: userId.toString() };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: userId.toString(),
      read: false
    });

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/:userId/read
 * Mark notification(s) as read
 */
router.post('/:userId/read', async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationId, markAllAsRead } = req.body;

    if (markAllAsRead) {
      await Notification.updateMany(
        { userId: userId.toString(), read: false },
        { $set: { read: true } }
      );
    } else if (notificationId) {
      await Notification.updateOne(
        { _id: notificationId, userId: userId.toString() },
        { $set: { read: true } }
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either notificationId or markAllAsRead is required'
      });
    }

    res.json({
      success: true,
      message: markAllAsRead ? 'All notifications marked as read' : 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification',
      error: error.message
    });
  }
});

/**
 * DELETE /api/notifications/:userId/:notificationId
 * Delete a notification
 */
router.delete('/:userId/:notificationId', async (req, res) => {
  try {
    const { userId, notificationId } = req.params;

    await Notification.deleteOne({
      _id: notificationId,
      userId: userId.toString()
    });

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/generate-ai
 * Generate AI-powered notification based on user activity
 * This is called automatically by the system
 */
router.post('/generate-ai', async (req, res) => {
  try {
    const { userId, activityType, activityData } = req.body;

    if (!userId || !activityType) {
      return res.status(400).json({
        success: false,
        message: 'User ID and activity type are required'
      });
    }

    let notification = null;

    // Generate AI-powered notification based on activity
    if (gemini || openai) {
      try {
        const aiNotification = await generateAINotification(userId, activityType, activityData);
        if (aiNotification) {
          notification = new Notification(aiNotification);
          await notification.save();
        }
      } catch (aiError) {
        console.error('AI notification generation error:', aiError);
        // Fall back to system notification
        notification = await createSystemNotification(userId, activityType, activityData);
      }
    } else {
      // Use system notification if AI not available
      notification = await createSystemNotification(userId, activityType, activityData);
    }

    if (notification) {
      res.json({
        success: true,
        notification
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Could not generate notification'
      });
    }
  } catch (error) {
    console.error('Error generating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating notification',
      error: error.message
    });
  }
});

// Helper: Generate AI-powered notification
async function generateAINotification(userId, activityType, activityData) {
  let prompt = '';
  let notificationType = 'ai_insight';
  let defaultTitle = '';
  let defaultMessage = '';

  // Prepare context based on activity type
  switch (activityType) {
    case 'study_session_completed':
      const hours = (activityData.duration || 0) / 3600;
      prompt = `A student just completed a ${hours.toFixed(1)}-hour study session. Generate a brief, encouraging notification (max 50 words) to motivate them.`;
      defaultTitle = 'Study Session Completed!';
      defaultMessage = `Great work! You've completed ${hours.toFixed(1)} hours of focused study.`;
      break;
    
    case 'achievement_unlocked':
      prompt = `A student just unlocked the achievement "${activityData.title}". Generate a brief, celebratory notification (max 50 words).`;
      defaultTitle = 'Achievement Unlocked!';
      defaultMessage = `Congratulations! You've earned the "${activityData.title}" badge.`;
      break;
    
    case 'streak_milestone':
      prompt = `A student reached a ${activityData.streak}-day study streak. Generate a brief, motivational notification (max 50 words).`;
      defaultTitle = 'Streak Milestone!';
      defaultMessage = `Amazing! You've maintained a ${activityData.streak}-day study streak. Keep it up!`;
      break;
    
    case 'goal_progress':
      const progress = activityData.progress || 0;
      prompt = `A student reached ${progress}% of their weekly study goal. Generate a brief, encouraging notification (max 50 words).`;
      defaultTitle = 'Goal Progress Update';
      defaultMessage = `You're ${progress}% towards your weekly goal! Keep going!`;
      break;
    
    default:
      return null;
  }

  let aiMessage = defaultMessage;

  // Try Gemini AI first (FREE)
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      aiMessage = response.text().trim();
      
      // Limit message length
      if (aiMessage.length > 100) {
        aiMessage = aiMessage.substring(0, 97) + '...';
      }
      
      console.log('✅ AI notification generated using Gemini');
    } catch (error) {
      console.error('Gemini AI error:', error.message);
    }
  }

  // Fallback to OpenAI if Gemini fails
  if (aiMessage === defaultMessage && openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a study motivation assistant. Generate brief, encouraging notifications.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      });

      aiMessage = completion.choices[0].message.content.trim();
      if (aiMessage.length > 100) {
        aiMessage = aiMessage.substring(0, 97) + '...';
      }
      
      console.log('✅ AI notification generated using OpenAI');
    } catch (error) {
      console.error('OpenAI error:', error.message);
    }
  }

  return {
    userId: userId.toString(),
    type: notificationType,
    title: defaultTitle,
    message: aiMessage,
    icon: getIconForActivity(activityType),
    color: getColorForActivity(activityType),
    read: false,
    actionUrl: getActionUrlForActivity(activityType),
    metadata: activityData
  };
}

// Helper: Create system notification (fallback)
async function createSystemNotification(userId, activityType, activityData) {
  const notificationData = {
    userId: userId.toString(),
    type: 'system',
    title: getSystemTitle(activityType, activityData),
    message: getSystemMessage(activityType, activityData),
    icon: getIconForActivity(activityType),
    color: getColorForActivity(activityType),
    read: false,
    actionUrl: getActionUrlForActivity(activityType),
    metadata: activityData
  };

  const notification = new Notification(notificationData);
  await notification.save();
  return notification;
}

// Helper functions
function getIconForActivity(activityType) {
  const icons = {
    'study_session_completed': '⏱️',
    'achievement_unlocked': '🏆',
    'streak_milestone': '🔥',
    'goal_progress': '🎯',
    'study_reminder': '⏰',
    'group_study': '👥'
  };
  return icons[activityType] || '🔔';
}

function getColorForActivity(activityType) {
  const colors = {
    'study_session_completed': 'blue',
    'achievement_unlocked': 'green',
    'streak_milestone': 'orange',
    'goal_progress': 'purple',
    'study_reminder': 'orange',
    'group_study': 'blue'
  };
  return colors[activityType] || 'blue';
}

function getActionUrlForActivity(activityType) {
  const urls = {
    'study_session_completed': '/productivity-tracker',
    'achievement_unlocked': '/achievements',
    'streak_milestone': '/productivity-tracker',
    'goal_progress': '/productivity-tracker',
    'study_reminder': '/study-timer',
    'group_study': '/group-study'
  };
  return urls[activityType] || null;
}

function getSystemTitle(activityType, activityData) {
  const titles = {
    'study_session_completed': 'Study Session Completed!',
    'achievement_unlocked': `Achievement Unlocked: ${activityData.title || 'New Badge'}`,
    'streak_milestone': `🔥 ${activityData.streak || 0}-Day Streak!`,
    'goal_progress': 'Goal Progress Update',
    'study_reminder': 'Study Reminder',
    'group_study': 'Group Study Update'
  };
  return titles[activityType] || 'New Notification';
}

function getSystemMessage(activityType, activityData) {
  switch (activityType) {
    case 'study_session_completed':
      const hours = (activityData.duration || 0) / 3600;
      return `Great work! You've completed ${hours.toFixed(1)} hours of focused study.`;
    
    case 'achievement_unlocked':
      return `Congratulations! You've earned the "${activityData.title || 'New Badge'}" achievement.`;
    
    case 'streak_milestone':
      return `Amazing! You've maintained a ${activityData.streak || 0}-day study streak. Keep it up!`;
    
    case 'goal_progress':
      const progress = activityData.progress || 0;
      return `You're ${progress}% towards your weekly goal! Keep going!`;
    
    default:
      return 'You have a new update!';
  }
}

module.exports = router;

