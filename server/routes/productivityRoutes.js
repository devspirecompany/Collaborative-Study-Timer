const express = require('express');
const router = express.Router();
const Productivity = require('../models/Productivity');
const StudySession = require('../models/StudySession');
const Achievement = require('../models/Achievement');
const Competition = require('../models/Competition');
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
 * GET /api/productivity/:userId
 * Get productivity data for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'week' } = req.query; // week, month, year

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

    // Get productivity data
    const productivityData = await Productivity.find({
      userId,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    // Get study sessions
    const sessions = await StudySession.find({
      userId,
      createdAt: { $gte: startDate }
    });

    // Calculate statistics
    const totalStudyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalSessions = sessions.length;
    const averageSessionLength = totalSessions > 0 ? totalStudyTime / totalSessions : 0;

    // Get current streak
    const latestProductivity = await Productivity.findOne({ userId }).sort({ date: -1 });
    const currentStreak = latestProductivity?.streak || 0;

    // Get weekly data for charts
    const weeklyData = await getWeeklyData(userId);

    // Get AI-powered insights and recommendations
    let aiInsights = null;
    let aiRecommendations = null;
    let optimizedGoals = null;
    
    try {
      const insightsData = await generateAIInsights({
        totalStudyTime: totalStudyTime / 3600,
        totalSessions,
        averageSessionLength: averageSessionLength / 60,
        currentStreak,
        weeklyData,
        period
      });
      
      aiInsights = insightsData.insights;
      aiRecommendations = insightsData.recommendations;
      optimizedGoals = insightsData.optimizedGoals;
    } catch (error) {
      console.error('Error generating AI insights:', error);
      // Use fallback insights if AI fails
      aiInsights = generateFallbackInsights(totalStudyTime / 3600, totalSessions, currentStreak);
    }

    res.json({
      success: true,
      data: {
        totalStudyTime: totalStudyTime / 3600, // in hours
        totalSessions,
        averageSessionLength: averageSessionLength / 60, // in minutes
        currentStreak,
        weeklyData,
        productivityData,
        goals: {
          daily: (latestProductivity?.dailyGoal || 7200) / 3600, // in hours
          weekly: (latestProductivity?.weeklyGoal || 14400) / 3600 // in hours
        },
        aiInsights,
        aiRecommendations,
        optimizedGoals
      }
    });
  } catch (error) {
    console.error('Error fetching productivity data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching productivity data',
      error: error.message
    });
  }
});

/**
 * POST /api/productivity/update
 * Update productivity data for a user
 */
router.post('/update', async (req, res) => {
  try {
    const { userId, studyTime, sessionsCompleted, subjectsStudied } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's productivity record
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

    // Update productivity data
    if (studyTime !== undefined) {
      productivity.totalStudyTime += studyTime;
    }
    if (sessionsCompleted !== undefined) {
      productivity.sessionsCompleted += sessionsCompleted;
    }
    if (subjectsStudied && Array.isArray(subjectsStudied)) {
      subjectsStudied.forEach(subject => {
        if (!productivity.subjectsStudied.includes(subject)) {
          productivity.subjectsStudied.push(subject);
        }
      });
    }

    // Update streak
    await updateStreak(userId, productivity);

    await productivity.save();

    res.json({
      success: true,
      productivity
    });
  } catch (error) {
    console.error('Error updating productivity:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating productivity',
      error: error.message
    });
  }
});

// Helper function: Get weekly data
async function getWeeklyData(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get the start of the current week (Monday)
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday = 0
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  
  // Get the end of the current week (Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const sessions = await StudySession.find({
    userId,
    createdAt: { $gte: weekStart, $lte: weekEnd }
  });

  // Day names in order (Monday to Sunday)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayIndexMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }; // Map getDay() to our array index

  // Initialize all days with 0 in correct order
  const dailyData = dayNames.map(day => ({ day, hours: 0 }));

  // Calculate study time per day
  sessions.forEach(session => {
    const sessionDate = new Date(session.createdAt);
    sessionDate.setHours(0, 0, 0, 0);
    
    // Check if session is within current week
    if (sessionDate >= weekStart && sessionDate <= weekEnd) {
      const dayOfWeek = sessionDate.getDay();
      const dayIndex = dayIndexMap[dayOfWeek];
      
      if (dayIndex !== undefined && dailyData[dayIndex]) {
        dailyData[dayIndex].hours += (session.duration || 0) / 3600; // in hours
      }
    }
  });

  return dailyData;
}

// Helper function: Update streak
async function updateStreak(userId, productivity) {
  const yesterday = new Date(productivity.date);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const yesterdayProductivity = await Productivity.findOne({
    userId,
    date: { $gte: yesterday, $lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000) }
  });

  if (yesterdayProductivity && yesterdayProductivity.totalStudyTime > 0) {
    // Continue streak
    productivity.streak = (yesterdayProductivity.streak || 0) + 1;
  } else if (productivity.totalStudyTime > 0) {
    // Start new streak
    productivity.streak = 1;
  }
}

// AI-powered insights and recommendations
async function generateAIInsights(productivityStats) {
  const { totalStudyTime, totalSessions, averageSessionLength, currentStreak, weeklyData, period } = productivityStats;

  // Prepare data summary for AI
  const dataSummary = `
Productivity Statistics (${period}):
- Total Study Time: ${totalStudyTime.toFixed(1)} hours
- Total Sessions: ${totalSessions}
- Average Session Length: ${averageSessionLength.toFixed(0)} minutes
- Current Streak: ${currentStreak} days
- Weekly Pattern: ${weeklyData.map(d => `${d.day}: ${d.hours.toFixed(1)}h`).join(', ')}
`;

  let insights = null;
  let recommendations = null;
  let optimizedGoals = null;

  // Try Gemini AI first (FREE)
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `You are a study productivity AI coach. Analyze this student's productivity data and provide:

1. **Insights** (2-3 sentences): Key observations about their study patterns, strengths, and areas for improvement.
2. **Recommendations** (3-4 actionable tips): Specific, practical advice to improve productivity.
3. **Optimized Goals** (JSON format): Suggest realistic daily and weekly study goals based on their current performance.

${dataSummary}

Return your response in this JSON format:
{
  "insights": "Your insights here",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "optimizedGoals": {
    "daily": 2.5,
    "weekly": 15
  }
}

Make insights encouraging and recommendations actionable.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiData = JSON.parse(jsonMatch[0]);
        insights = aiData.insights;
        recommendations = aiData.recommendations || [];
        optimizedGoals = aiData.optimizedGoals;
        console.log('✅ AI insights generated using Gemini');
      }
    } catch (error) {
      console.error('Gemini AI error:', error.message);
    }
  }

  // Fallback to OpenAI if Gemini fails
  if (!insights && openai) {
    try {
      const prompt = `Analyze this student's productivity data and provide insights, recommendations, and optimized goals:

${dataSummary}

Return JSON with: insights (string), recommendations (array), optimizedGoals (object with daily and weekly hours).`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a study productivity coach. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const aiData = JSON.parse(completion.choices[0].message.content.trim());
      insights = aiData.insights;
      recommendations = aiData.recommendations || [];
      optimizedGoals = aiData.optimizedGoals;
      console.log('✅ AI insights generated using OpenAI');
    } catch (error) {
      console.error('OpenAI error:', error.message);
    }
  }

  // Fallback to algorithm-based insights
  if (!insights) {
    insights = generateFallbackInsights(totalStudyTime, totalSessions, currentStreak);
    recommendations = generateFallbackRecommendations(totalStudyTime, totalSessions, averageSessionLength);
    optimizedGoals = {
      daily: Math.max(1, Math.min(4, totalStudyTime / 7 + 0.5)),
      weekly: Math.max(5, Math.min(20, totalStudyTime + 2))
    };
  }

  return {
    insights,
    recommendations,
    optimizedGoals
  };
}

// Fallback insights (algorithm-based)
function generateFallbackInsights(totalStudyTime, totalSessions, currentStreak) {
  if (totalStudyTime === 0) {
    return "You're just getting started! Begin with short study sessions to build a consistent habit.";
  }
  
  if (currentStreak >= 7) {
    return `Amazing! You've maintained a ${currentStreak}-day streak. Your consistency is paying off!`;
  }
  
  if (totalStudyTime < 5) {
    return `You've studied ${totalStudyTime.toFixed(1)} hours this week. Consider increasing your daily study time gradually.`;
  }
  
  return `Great progress! You've completed ${totalSessions} sessions with an average of ${(totalStudyTime / totalSessions).toFixed(1)} hours per session. Keep up the momentum!`;
}

// Fallback recommendations
function generateFallbackRecommendations(totalStudyTime, totalSessions, averageSessionLength) {
  const recommendations = [];
  
  if (averageSessionLength < 30) {
    recommendations.push("Try extending your study sessions to 30-45 minutes for better focus and retention.");
  }
  
  if (totalSessions < 5) {
    recommendations.push("Aim for at least 5 study sessions per week to build a consistent routine.");
  }
  
  if (totalStudyTime < 10) {
    recommendations.push("Gradually increase your weekly study time to reach your goals.");
  }
  
  recommendations.push("Take regular breaks between study sessions to maintain productivity.");
  recommendations.push("Track your progress daily to stay motivated and identify patterns.");
  
  return recommendations;
}

module.exports = router;

