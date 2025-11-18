const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StudySession = require('../models/StudySession');
const Achievement = require('../models/Achievement');
const Competition = require('../models/Competition');

/**
 * GET /api/activities/:userId
 * Get recent activities for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    const activities = [];

    // Get recent study sessions
    const recentSessions = await StudySession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentSessions.forEach(session => {
      const hours = (session.duration || 0) / 3600;
      activities.push({
        type: 'study_session',
        title: 'Study Session Completed',
        description: `Completed ${hours.toFixed(1)}-hour ${session.mode || 'study'} session`,
        icon: 'session',
        timestamp: session.createdAt,
        data: session
      });
    });

    // Get recent achievements
    const recentAchievements = await Achievement.find({
      userId,
      unlocked: true
    })
      .sort({ unlockedAt: -1 })
      .limit(5)
      .lean();

    recentAchievements.forEach(achievement => {
      activities.push({
        type: 'achievement',
        title: 'Achievement Unlocked!',
        description: `You've earned the "${achievement.title}" badge${achievement.description ? ` - ${achievement.description}` : ''}`,
        icon: 'achievement',
        timestamp: achievement.unlockedAt,
        data: achievement
      });
    });

    // Get recent competitions
    let competitionQuery = { status: 'completed' };
    
    // Try to match userId as ObjectId first, then as string
    try {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        competitionQuery['players.userId'] = new mongoose.Types.ObjectId(userId);
      } else {
        // If userId is not a valid ObjectId, match by string
        competitionQuery['players.userId'] = userId;
      }
    } catch (error) {
      competitionQuery['players.userId'] = userId;
    }

    const recentCompetitions = await Competition.find(competitionQuery)
      .sort({ completedAt: -1 })
      .limit(5)
      .lean();

    recentCompetitions.forEach(competition => {
      const player = competition.players.find(p => {
        const playerUserId = p.userId ? p.userId.toString() : '';
        return playerUserId === userId || playerUserId === userId.toString();
      });
      const isWinner = competition.winner && (
        competition.winner.toString() === userId || 
        competition.winner.toString() === userId.toString()
      );
      activities.push({
        type: 'competition',
        title: isWinner ? 'Competition Won!' : 'Competition Completed',
        description: `Completed "${competition.subject}" competition with score ${player?.score || 0}/${competition.questions?.length || 0}`,
        icon: 'competition',
        timestamp: competition.completedAt || competition.createdAt,
        data: competition
      });
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limitedActivities = activities.slice(0, parseInt(limit));

    // Format timestamps to relative time
    const formattedActivities = limitedActivities.map(activity => ({
      ...activity,
      timeAgo: getTimeAgo(activity.timestamp)
    }));

    res.json({
      success: true,
      activities: formattedActivities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activities',
      error: error.message
    });
  }
});

// Helper function: Get time ago string
function getTimeAgo(date) {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  
  if (seconds < 60) {
    return 'Just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

module.exports = router;

