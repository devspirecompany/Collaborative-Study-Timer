// API Service for backend communication

// Validate environment variable
const validateApiUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
  // Check if URL is valid
  try {
    new URL(apiUrl);
  } catch (error) {
    console.error('❌ Invalid REACT_APP_API_URL:', apiUrl);
    console.error('   Please set a valid URL in your .env file: REACT_APP_API_URL=http://localhost:5000/api');
    return 'http://localhost:5000/api'; // Fallback to default
  }
  
  // Log in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 API Base URL:', apiUrl);
    if (!process.env.REACT_APP_API_URL) {
      console.warn('⚠️  REACT_APP_API_URL not set, using default: http://localhost:5000/api');
      console.warn('   To set a custom URL, create a .env file in the root directory with:');
      console.warn('   REACT_APP_API_URL=http://your-backend-url/api');
    }
  }
  
  return apiUrl;
};

const API_BASE_URL = validateApiUrl();

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  try {
    // Longer timeout for file uploads (60 seconds for PDF/DOCX processing)
    const isFileUpload = endpoint.includes('/files') && options.method === 'POST';
    const timeoutDuration = isFileUpload ? 60000 : 30000; // 60s for files, 30s for others
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    // Parse JSON response
    let data;
    try {
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse JSON:', parseErr);
        console.error('Response text:', text.substring(0, 500));
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }
    } catch (parseError) {
      // If response is not JSON, create error from status
      console.error('Failed to parse response as JSON:', parseError);
      throw new Error(`Server error: ${response.status} ${response.statusText}. Please check if the backend server is running.`);
    }
    
    // If response is not ok, throw error with message from backend
    if (!response.ok) {
      // Try to get error message from response
      const errorMessage = data?.message || data?.error || (typeof data?.error === 'string' ? data.error : data?.error?.message) || `Server error: ${response.status}`;
      const error = new Error(errorMessage);
      error.response = data;
      error.status = response.status;
      console.error('API error response:', { 
        status: response.status, 
        statusText: response.statusText,
        data: data,
        errorMessage: errorMessage
      });
      throw error;
    }
    
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('API call timeout:', endpoint);
      throw new Error('Request timeout - the server took too long to respond. For large DOCX files, this may take up to 60 seconds.');
    }
    // Network errors
    if (error.message && error.message.includes('Failed to fetch')) {
      console.error('Network error - backend may not be running:', endpoint);
      throw new Error('Cannot connect to server. Please ensure the backend server is running on http://localhost:5000');
    }
    // If error already has a message (from above), re-throw it
    if (error.message) {
      throw error;
    }
    console.error('API call error:', error);
    throw new Error(error.message || 'Something went wrong! Please check the console for details.');
  }
};

// Study Sessions
export const createStudySession = async (sessionData) => {
  return apiCall('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
};

export const getStudySessions = async (userId, limit = 50, skip = 0) => {
  return apiCall(`/sessions/${userId}?limit=${limit}&skip=${skip}`);
};

export const getStudySessionStats = async (userId, period = 'week') => {
  return apiCall(`/sessions/stats/${userId}?period=${period}`);
};

// Files
export const getFiles = async (userId, subject = null) => {
  const url = subject
    ? `/files/${userId}?subject=${subject}`
    : `/files/${userId}`;
  return apiCall(url);
};

export const createFile = async (fileData) => {
  return apiCall('/files', {
    method: 'POST',
    body: JSON.stringify(fileData),
  });
};

export const deleteFile = async (fileId) => {
  return apiCall(`/files/${fileId}`, {
    method: 'DELETE',
  });
};

// Folders
export const getFolders = async (userId) => {
  return apiCall(`/files/folders/${userId}`);
};

export const createFolder = async (folderData) => {
  return apiCall('/files/folders', {
    method: 'POST',
    body: JSON.stringify(folderData),
  });
};

export const deleteFolder = async (folderId) => {
  return apiCall(`/files/folders/${folderId}`, {
    method: 'DELETE',
  });
};

export const getReviewers = async (userId) => {
  return apiCall(`/files/reviewers/${userId}`);
};

// Achievements
export const getAchievements = async (userId) => {
  return apiCall(`/achievements/${userId}`);
};

export const checkAchievements = async (userId) => {
  return apiCall('/achievements/check', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// Productivity
export const getProductivityData = async (userId, period = 'week') => {
  return apiCall(`/productivity/${userId}?period=${period}`);
};

export const updateProductivity = async (productivityData) => {
  return apiCall('/productivity/update', {
    method: 'POST',
    body: JSON.stringify(productivityData),
  });
};

// Competitions
export const createCompetition = async (competitionData) => {
  return apiCall('/competitions/create', {
    method: 'POST',
    body: JSON.stringify(competitionData),
  });
};

export const joinCompetition = async (joinData) => {
  return apiCall('/competitions/join', {
    method: 'POST',
    body: JSON.stringify(joinData),
  });
};

export const submitAnswer = async (answerData) => {
  return apiCall('/competitions/answer', {
    method: 'POST',
    body: JSON.stringify(answerData),
  });
};

export const completeCompetition = async (roomId) => {
  return apiCall('/competitions/complete', {
    method: 'POST',
    body: JSON.stringify({ roomId }),
  });
};

export const getCompetition = async (roomId) => {
  return apiCall(`/competitions/${roomId}`);
};

// Activities
export const getRecentActivities = async (userId, limit = 10) => {
  return apiCall(`/activities/${userId}?limit=${limit}`);
};

// User Authentication
export const registerUser = async (userData) => {
  return apiCall('/users/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (email, password) => {
  return apiCall('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

// Study Rooms (Collaborative Study)
export const createStudyRoom = async (userId, username, roomName) => {
  return apiCall('/study-rooms', {
    method: 'POST',
    body: JSON.stringify({ userId, username, roomName }),
  });
};

export const joinStudyRoom = async (roomCode, userId, username) => {
  return apiCall('/study-rooms/join', {
    method: 'POST',
    body: JSON.stringify({ roomCode, userId, username }),
  });
};

export const getStudyRoom = async (roomCode) => {
  return apiCall(`/study-rooms/${roomCode}`);
};

export const updateScrollPosition = async (roomCode, scrollPosition) => {
  return apiCall(`/study-rooms/${roomCode}/scroll`, {
    method: 'POST',
    body: JSON.stringify({ scrollPosition }),
  });
};

export const addSharedNote = async (roomCode, userId, username, note, position) => {
  return apiCall(`/study-rooms/${roomCode}/notes`, {
    method: 'POST',
    body: JSON.stringify({ userId, username, note, position }),
  });
};

// Study Room Quiz
export const startStudyRoomQuiz = async (roomCode, userId, questions, subject, testType) => {
  return apiCall(`/study-rooms/${roomCode}/quiz/start`, {
    method: 'POST',
    body: JSON.stringify({ userId, questions, subject, testType }),
  });
};

export const submitQuizAnswer = async (roomCode, userId, questionIndex, selectedAnswer, timeTaken) => {
  return apiCall(`/study-rooms/${roomCode}/quiz/answer`, {
    method: 'POST',
    body: JSON.stringify({ userId, questionIndex, selectedAnswer, timeTaken }),
  });
};

export const nextQuizQuestion = async (roomCode, userId) => {
  return apiCall(`/study-rooms/${roomCode}/quiz/next`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const endStudyRoomQuiz = async (roomCode, userId) => {
  return apiCall(`/study-rooms/${roomCode}/quiz/end`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// Study Room File Sharing
export const shareFileInRoom = async (roomCode, userId, username, fileId) => {
  return apiCall(`/study-rooms/${roomCode}/share-file`, {
    method: 'POST',
    body: JSON.stringify({ userId, username, fileId }),
  });
};

export const removeSharedFile = async (roomCode, fileId, userId) => {
  return apiCall(`/study-rooms/${roomCode}/shared-files/${fileId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
};

export const setRoomDocument = async (roomCode, userId, fileId, viewMode = 'raw') => {
  return apiCall(`/study-rooms/${roomCode}/set-document`, {
    method: 'POST',
    body: JSON.stringify({ userId, fileId, viewMode }),
  });
};

export const clearRoomDocument = async (roomCode, userId) => {
  return apiCall(`/study-rooms/${roomCode}/clear-document`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const setRoomReviewer = async (roomCode, userId, reviewContent, keyPoints) => {
  return apiCall(`/study-rooms/${roomCode}/set-reviewer`, {
    method: 'POST',
    body: JSON.stringify({ userId, reviewContent, keyPoints }),
  });
};

export const sendChatMessage = async (roomCode, userId, username, message) => {
  return apiCall(`/study-rooms/${roomCode}/chat`, {
    method: 'POST',
    body: JSON.stringify({ userId, username, message }),
  });
};

export const controlStudyTimer = async (roomCode, action, duration) => {
  return apiCall(`/study-rooms/${roomCode}/timer`, {
    method: 'POST',
    body: JSON.stringify({ action, duration }),
  });
};

export const leaveStudyRoom = async (roomCode, userId) => {
  return apiCall(`/study-rooms/${roomCode}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const deleteStudyRoom = async (roomCode, userId) => {
  return apiCall(`/study-rooms/${roomCode}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
};

export const getUser = async (userId) => {
  return apiCall(`/users/${userId}`);
};

// Notifications
export const getNotifications = async (userId, limit = 50, unreadOnly = false) => {
  return apiCall(`/notifications/${userId}?limit=${limit}&unreadOnly=${unreadOnly}`);
};

export const markNotificationAsRead = async (userId, notificationId) => {
  return apiCall(`/notifications/${userId}/read`, {
    method: 'POST',
    body: JSON.stringify({ notificationId }),
  });
};

export const markAllNotificationsAsRead = async (userId) => {
  return apiCall(`/notifications/${userId}/read`, {
    method: 'POST',
    body: JSON.stringify({ markAllAsRead: true }),
  });
};

export const deleteNotification = async (userId, notificationId) => {
  return apiCall(`/notifications/${userId}/${notificationId}`, {
    method: 'DELETE',
  });
};

export const generateAINotification = async (userId, activityType, activityData) => {
  return apiCall('/notifications/generate-ai', {
    method: 'POST',
    body: JSON.stringify({ userId, activityType, activityData }),
  });
};

