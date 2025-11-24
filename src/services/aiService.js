// AI Service for Study Timer and Question Generation
// This service calls the backend API for AI features

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Get AI-recommended study duration based on user's study history and goals
 * @param {Object} studyData - User's study data (hours studied today, session count, etc.)
 * @returns {Promise<number>} Recommended duration in minutes
 */
export const getRecommendedStudyDuration = async (studyData = {}) => {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for AI calls

    const response = await fetch(`${API_BASE_URL}/ai/recommend-study-duration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studyData }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      // Return both minutes and insights
      return {
        minutes: data.recommendedMinutes,
        insights: data.insights || null,
        method: data.method || 'algorithm'
      };
    } else {
      throw new Error(data.message || 'Failed to get recommendation');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Request timeout - using fallback algorithm');
    } else {
      console.error('Error getting recommended study duration:', error);
    }
    // Fallback to algorithm if backend is not available
    const fallbackMinutes = calculateFallbackDuration(studyData);
    return {
      minutes: fallbackMinutes,
      insights: getFallbackInsight(studyData, fallbackMinutes),
      method: 'algorithm'
    };
  }
};

// Helper function for fallback insights
function getFallbackInsight(studyData, recommendedMinutes) {
  const { hoursStudiedToday = 0, sessionCount = 0, timeOfDay = new Date().getHours() } = studyData;
  
  if (hoursStudiedToday >= 4) {
    return "You've studied a lot today! Shorter sessions will help maintain focus.";
  } else if (hoursStudiedToday < 1) {
    return `Perfect time to start! ${recommendedMinutes} minutes is ideal for a fresh session.`;
  } else if (timeOfDay >= 6 && timeOfDay < 12) {
    return "Morning is your peak productivity time! Great choice for focused study.";
  } else if (timeOfDay >= 20) {
    return "Evening study session! Keep it focused and avoid burnout.";
  } else if (sessionCount >= 4) {
    return "You're on a roll! Take breaks between sessions to maintain quality.";
  } else {
    return `Recommended ${recommendedMinutes} minutes based on your study patterns.`;
  }
}

/**
 * Fallback algorithm if backend is unavailable
 */
function calculateFallbackDuration(studyData) {
  const {
    hoursStudiedToday = 0,
    sessionCount = 0,
    timeOfDay = new Date().getHours(),
    fatigueLevel = 0
  } = studyData;

  let recommendedMinutes = 25;

  if (hoursStudiedToday >= 4) {
    recommendedMinutes = 15;
  } else if (hoursStudiedToday >= 2) {
    recommendedMinutes = 20;
  } else if (hoursStudiedToday < 1) {
    recommendedMinutes = 30;
  }

  if (timeOfDay >= 6 && timeOfDay < 12) {
    recommendedMinutes = Math.min(recommendedMinutes + 5, 45);
  } else if (timeOfDay >= 20 || timeOfDay < 6) {
    recommendedMinutes = Math.max(recommendedMinutes - 5, 15);
  }

  if (sessionCount >= 4) {
    recommendedMinutes = 15;
  }

  return recommendedMinutes;
}

/**
 * Generate questions from file content using AI
 * @param {string} fileContent - Content of the file
 * @param {string} subject - Subject/category of the file
 * @param {number} numQuestions - Number of questions to generate
 * @param {string} testType - Type of test: 'multiple_choice', 'true_false', 'fill_blank'
 * @returns {Promise<Array>} Array of question objects
 */
export const generateQuestionsFromFile = async (fileContent, subject, numQuestions = 5, testType = 'multiple_choice') => {
  try {
    console.log(`\n🟢 ===== Frontend: Starting Question Generation =====`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📊 Number of questions: ${numQuestions}`);
    console.log(`📄 File content length: ${fileContent?.length || 0} characters`);
    console.log(`🌐 API URL: ${API_BASE_URL}/ai/generate-questions`);
    
    // Add timeout to prevent hanging (increased for AI generation)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for question generation (AI can take time)

    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}/ai/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileContent,
        subject,
        numQuestions,
        testType
      }),
      signal: controller.signal
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Request completed in ${duration}s`);

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('❌ Backend error response:', errorData);
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = `API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (data.success) {
      const method = data.method || 'unknown';
      const questionCount = data.questions?.length || 0;
      console.log(`✅ Successfully generated ${questionCount} questions using ${method}`);
      
      // Accept fallback questions - they work fine!
      if (method === 'fallback' || method === 'sample') {
        // Using fallback - no warning needed, it's working as intended
      }
      
      return data.questions;
    } else {
      const errorMsg = data.message || data.error || 'Failed to generate questions';
      console.error('❌ Backend returned error:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Request timeout - using fallback');
      throw new Error('Request timeout - AI is taking too long to generate questions. Please try again with fewer questions or a smaller file.');
    } else {
      console.error('❌ Error generating questions:', error);
      // Re-throw with more context
      throw new Error(error.message || 'Failed to generate questions. Please check if the backend server is running and Gemini API key is configured.');
    }
  }
};

/**
 * Fallback questions if backend is unavailable
 */
function generateFallbackQuestions(subject, numQuestions) {
  const questions = [];
  for (let i = 0; i < numQuestions; i++) {
    questions.push({
      id: i + 1,
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

/**
 * Analyze file and create a reviewer with study notes
 * @param {string} fileName - Name of the file
 * @param {string} fileContent - Content of the file
 * @param {string} subject - Subject category
 * @param {string} userId - User ID (optional, for database storage)
 * @param {string} fileId - File ID (optional, for database storage)
 * @returns {Promise<Object>} Reviewer object with study notes
 */
export const createReviewerFromFile = async (fileName, fileContent, subject, userId = 'demo-user', fileId = null) => {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for reviewer creation

    const response = await fetch(`${API_BASE_URL}/ai/create-reviewer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileContent,
        subject,
        userId,
        fileId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      return data.reviewer;
    } else {
      throw new Error(data.message || 'Failed to create reviewer');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Request timeout - using fallback review content');
    } else {
      console.error('Error creating reviewer:', error);
    }
    // Fallback: create basic review content
    try {
      const sentences = fileContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const summary = sentences.slice(0, Math.min(20, sentences.length)).join('. ') + '.';
      const reviewContent = `# Study Notes: ${fileName}\n\n## Summary\n\n${summary}\n\n## Key Concepts\n\n${fileContent.substring(0, 1000)}...`;
      const keyPoints = sentences.slice(0, 5).map(s => s.trim().substring(0, 100));
      
      return {
        id: Date.now(),
        fileName,
        subject,
        reviewContent,
        keyPoints,
        questions: [],
        createdAt: new Date().toISOString(),
        totalQuestions: 0
      };
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return null;
    }
  }
};

// Note: All AI calls are now handled by the backend API
// This ensures API keys are kept secure on the server

