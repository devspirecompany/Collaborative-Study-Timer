import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/StudentDashboard.css';
import '../styles/TutorialModal.css'; // For help button styles
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getRecommendedStudyDuration } from '../services/aiService';
import { getStudySessionStats, getProductivityData, getRecentActivities } from '../services/apiService';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const StudentDashboard = () => {
  // Get user data from localStorage
  const [userData, setUserData] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  });

  // Timer states - AI recommended duration
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const userId = userData?._id || userData?.id || 'demo-user';
  // Show username in banner
  const userName = userData 
    ? (userData.username || userData.firstName || 'User')
    : 'Ash';
  const [dashboardStats, setDashboardStats] = useState({
    todayStudyHours: 0,
    weeklyProgress: 0,
    studyStreak: 0,
    activeGroups: 0
  });
  const [weeklyData, setWeeklyData] = useState([
    { day: 'Mon', hours: 0 },
    { day: 'Tue', hours: 0 },
    { day: 'Wed', hours: 0 },
    { day: 'Thu', hours: 0 },
    { day: 'Fri', hours: 0 },
    { day: 'Sat', hours: 0 },
    { day: 'Sun', hours: 0 }
  ]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get AI recommended duration on mount
  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const statsResponse = await getStudySessionStats(userId, 'week');
        if (statsResponse && statsResponse.success) {
          const studyData = {
            hoursStudiedToday: statsResponse.stats?.totalStudyTime || 0,
            sessionCount: statsResponse.stats?.totalSessions || 0,
            averageSessionLength: statsResponse.stats?.averageSessionLength || 25,
            timeOfDay: new Date().getHours(),
            fatigueLevel: 0
          };
          const recommended = await getRecommendedStudyDuration(studyData);
          const minutes = typeof recommended === 'object' ? recommended.minutes : recommended;
          setTimeRemaining(minutes * 60);
        } else {
          // Set default if API fails
          setTimeRemaining(25 * 60);
        }
      } catch (error) {
        console.error('Error fetching recommendation:', error);
        // Set default on error - don't block UI
        setTimeRemaining(25 * 60);
      }
    };
    fetchRecommendation();
  }, [userId]);

  // Update user data when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          setUserData(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    };
    
    // Check on mount
    handleStorageChange();
    
    // Listen for storage events
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Show tutorial on first visit - immediately for new users
  useEffect(() => {
    // Show tutorial immediately when feature is accessed
    if (!hasSeenTutorial('dashboard')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Use Promise.allSettled to prevent one failing request from blocking others
        const [statsResponse, productivityResponse, activitiesResponse] = await Promise.allSettled([
          getStudySessionStats(userId, 'week'),
          getProductivityData(userId, 'week'),
          getRecentActivities(userId, 10)
        ]);

        // Handle stats response
        if (statsResponse.status === 'fulfilled' && statsResponse.value?.success) {
          setDashboardStats({
            todayStudyHours: statsResponse.value.stats?.todayStudyTime || 0,
            weeklyProgress: statsResponse.value.stats?.totalStudyTime || 0,
            studyStreak: 0,
            activeGroups: 0
          });
        }

        // Handle productivity response
        if (productivityResponse.status === 'fulfilled' && productivityResponse.value?.success) {
          if (productivityResponse.value.data?.weeklyData) {
            setWeeklyData(productivityResponse.value.data.weeklyData);
          }
          if (productivityResponse.value.data?.currentStreak) {
            setDashboardStats(prev => ({
              ...prev,
              studyStreak: productivityResponse.value.data.currentStreak
            }));
          }
        }

        // Handle activities response
        if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value?.success && activitiesResponse.value.activities) {
          setRecentActivities(activitiesResponse.value.activities);
        } else {
          // Set default activities if backend fails
          setRecentActivities([
            {
              type: 'achievement',
              title: 'Achievement Unlocked!',
              description: 'You\'ve earned the "Early Bird" badge for studying 5 days in a row before 8 AM',
              timeAgo: '2 hours ago',
              icon: 'achievement'
            },
            {
              type: 'competition',
              title: 'Joined Group Study',
              description: 'You joined "CS101 Finals Prep" study group with 8 members',
              timeAgo: '5 hours ago',
              icon: 'competition'
            },
            {
              type: 'study_session',
              title: 'Study Session Completed',
              description: 'Completed 2-hour focus session on Data Structures',
              timeAgo: 'Yesterday',
              icon: 'session'
            }
          ]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set default activities if backend fails
        setRecentActivities([
          {
            type: 'achievement',
            title: 'Achievement Unlocked!',
            description: 'You\'ve earned the "Early Bird" badge for studying 5 days in a row before 8 AM',
            timeAgo: '2 hours ago',
            icon: 'achievement'
          },
          {
            type: 'competition',
            title: 'Joined Group Study',
            description: 'You joined "CS101 Finals Prep" study group with 8 members',
            timeAgo: '5 hours ago',
            icon: 'competition'
          },
          {
            type: 'study_session',
            title: 'Study Session Completed',
            description: 'Completed 2-hour focus session on Data Structures',
            timeAgo: 'Yesterday',
            icon: 'session'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userId]);
  
  // UI states
  const [userDropdownActive, setUserDropdownActive] = useState(false);
  const [notificationSidebarActive, setNotificationSidebarActive] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'blue', title: 'New Achievement Unlocked!', text: "You've earned the \"Early Bird\" badge", time: '5 minutes ago', unread: true },
    { id: 2, type: 'green', title: 'Study Group Invitation', text: 'Sarah invited you to "Math Finals Review"', time: '1 hour ago', unread: true },
    { id: 3, type: 'orange', title: 'Study Reminder', text: "Don't forget your Physics study session at 3 PM", time: '2 hours ago', unread: false }
  ]);

  // Timer logic
  useEffect(() => {
    let interval;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            showTimerCompleteAlert();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);
  const resetTimer = async () => {
    setIsRunning(false);
    const studyData = {
      hoursStudiedToday: 0,
      sessionCount: 0,
      averageSessionLength: 25,
      timeOfDay: new Date().getHours(),
      fatigueLevel: 0
    };
    const recommended = await getRecommendedStudyDuration(studyData);
    setTimeRemaining(recommended * 60);
  };

  const showTimerCompleteAlert = () => {
    alert('🎉 Session Completed! Great work!');
  };

  const handleNotificationClick = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, unread: false } : notif
      )
    );
    setUnreadCount(notifications.filter(n => n.unread && n.id !== id).length);
  };

  const closeNotificationSidebar = () => {
    setNotificationSidebarActive(false);
  };

  const maxHours = Math.max(...weeklyData.map(d => d.hours), 1);

  return (
    <div className="dashboard-container">
     <Sidebar/>

      {/* Main Content */}
      <main className="main-content">
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-content">
            <h2>Welcome back, {userName}!</h2>
            <p>Ready to conquer your goals today? Let's make it productive!</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon blue">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="stat-trend up">
                <span>▲</span>
                <span>12%</span>
              </div>
            </div>
            <div className="stat-label">Today's Study Hours</div>
            <div className="stat-value">{dashboardStats.todayStudyHours.toFixed(1)}h</div>
            <div className="stat-footer">{dashboardStats.todayStudyHours.toFixed(1)} hours completed today</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon green">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"></path>
                  <path d="M18 7a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V7z"></path>
                  <path d="M9 9v6"></path>
                  <path d="M15 9v6"></path>
                </svg>
              </div>
              <div className="stat-trend up">
                <span>▲</span>
                <span>8%</span>
              </div>
            </div>
            <div className="stat-label">Weekly Progress</div>
            <div className="stat-value">{dashboardStats.weeklyProgress.toFixed(0)}h</div>
            <div className="stat-footer">Target: 30 hours per week</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon orange">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4"></path>
                  <path d="M12 18v4"></path>
                  <path d="M4.93 4.93l2.83 2.83"></path>
                  <path d="M16.24 16.24l2.83 2.83"></path>
                  <path d="M2 12h4"></path>
                  <path d="M18 12h4"></path>
                  <path d="M4.93 19.07l2.83-2.83"></path>
                  <path d="M16.24 7.76l2.83-2.83"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
              <div className="stat-trend up">
                <span>▲</span>
                <span>3 days</span>
              </div>
            </div>
            <div className="stat-label">Study Streak</div>
            <div className="stat-value">{dashboardStats.studyStreak} days</div>
            <div className="stat-footer">Keep it up! Personal best: 21 days</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon cyan">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
            </div>
            <div className="stat-label">Active Group Sessions</div>
            <div className="stat-value">{dashboardStats.activeGroups}</div>
            <div className="stat-footer">Join competitions to start</div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="content-grid">
          {/* Weekly Progress Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Weekly Progress</h3>
              <a href="#" className="card-action">View Details →</a>
            </div>
            <div className="progress-chart">
              {weeklyData.map((data, index) => {
                const displayHours = typeof data.hours === 'number' ? data.hours : parseFloat(data.hours) || 0;
                return (
                  <div key={data.day} className="progress-bar-wrapper">
                    <div className="progress-bar" style={{ height: '200px' }}>
                      <div 
                        className="progress-fill" 
                        style={{ 
                          height: `${(displayHours / maxHours) * 100}%`,
                          transition: `height 0.8s ease ${index * 100}ms`
                        }}
                      >
                        <div className="progress-value">{displayHours.toFixed(1)}h</div>
                      </div>
                    </div>
                    <div className="progress-label">{data.day}</div>
                  </div>
                );
              })}
            </div>
            
            {/* Performance Summary */}
            <div className="performance-summary">
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <div className="summary-label">Best Day</div>
                    <div className="summary-value">
                      {weeklyData.length > 0 && Math.max(...weeklyData.map(d => d.hours || 0)) > 0 ? (() => {
                        const bestDay = weeklyData.reduce((max, day) => (day.hours || 0) > (max.hours || 0) ? day : max, weeklyData[0]);
                        const hours = Math.floor(bestDay.hours || 0);
                        const minutes = Math.round(((bestDay.hours || 0) % 1) * 60);
                        return (
                          <>{bestDay.day} <span className="summary-highlight">{hours}h {minutes}m</span></>
                        );
                      })() : (
                        <>No data yet</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <div className="summary-label">Weekly Total</div>
                    <div className="summary-value">
                      <span className="summary-highlight">
                        {Math.floor(dashboardStats.weeklyProgress)}h {Math.round((dashboardStats.weeklyProgress % 1) * 60)}m
                      </span> / 30h
                    </div>
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                  </div>
                  <div className="summary-content">
                    <div className="summary-label">Productivity</div>
                    <div className="summary-value">
                      {dashboardStats.weeklyProgress > 0 ? (
                        <>On track with <span className="summary-highlight">{Math.round((dashboardStats.weeklyProgress / 30) * 100)}%</span> of weekly goal</>
                      ) : (
                        <>Start studying to track your productivity!</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {dashboardStats.weeklyProgress > 0 && (
                <div className="insight">
                  <div className="insight-icon">💡</div>
                  <div className="insight-text">
                    {dashboardStats.todayStudyHours > 0 
                      ? `Great job! You've studied ${dashboardStats.todayStudyHours.toFixed(1)} hours today. Keep it up!`
                      : 'You\'re most productive in the morning. Try scheduling focused study sessions before 11 AM.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timer and Achievements */}
          <div>
            {/* Timer Widget */}
            <div className="timer-widget">
              <div className="timer-display-container">
                <div className="timer-display-wrapper">
                  <div className="timer-display">{formatTime(timeRemaining)}</div>
                  <div className="timer-preset">AI Recommended</div>
                </div>
              </div>
              <div className="timer-controls">
                {!isRunning ? (
                  <button className="timer-btn" id="startBtn" onClick={startTimer}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </button>
                ) : (
                  <button className="timer-btn" id="pauseBtn" onClick={pauseTimer}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                  </button>
                )}
                <button className="timer-btn" id="resetBtn" onClick={resetTimer}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                  </svg>
                </button>
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <Link to="/study-timer" style={{ color: 'var(--primary-light)', textDecoration: 'none', fontSize: '0.9rem' }}>
                  Go to Study Timer →
                </Link>
              </div>
            </div>

            {/* Achievements */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Next Achievement</h3>
                <a href="#" className="card-action">View All →</a>
              </div>
              <div className="achievement-item">
                <div className="achievement-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                  </svg>
                </div>
                <div className="achievement-info">
                  <div className="achievement-title">Study Marathon</div>
                  <div className="achievement-stat">75/100 hours</div>
                  <div className="achievement-progress-bar">
                    <div className="achievement-progress-fill" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
              <div className="achievement-item">
                <div className="achievement-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
                <div className="achievement-info">
                  <div className="achievement-title">Streak Master</div>
                  <div className="achievement-stat">15/30 days</div>
                  <div className="achievement-progress-bar">
                    <div className="achievement-progress-fill" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <a href="#" className="card-action">View All →</a>
          </div>
          {recentActivities.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No recent activity. Start studying to see your activity here!</p>
            </div>
          ) : (
            recentActivities.slice(0, 3).map((activity, index) => (
              <div key={index} className="activity-item">
                <div className={`activity-icon ${
                  activity.type === 'achievement' ? 'blue' :
                  activity.type === 'competition' ? 'green' :
                  activity.type === 'study_session' ? 'cyan' : 'blue'
                }`}>
                  {activity.type === 'achievement' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
                    </svg>
                  )}
                  {activity.type === 'competition' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  )}
                  {activity.type === 'study_session' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  )}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{activity.title}</div>
                  <div className="activity-description">{activity.description}</div>
                  <div className="activity-time">{activity.timeAgo || 'Recently'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Help Button */}
      <button 
        className="help-button" 
        onClick={() => setShowTutorial(true)}
        title="Show tutorial"
      >
        ?
      </button>

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => {
          setShowTutorial(false);
          // Mark tutorial as seen when user closes it
          if (!hasSeenTutorial('dashboard')) {
            markTutorialAsSeen('dashboard');
          }
        }}
        tutorial={tutorials.dashboard}
      />
    </div>
  );
};

export default StudentDashboard;