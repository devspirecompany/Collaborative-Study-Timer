import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/StudentDashboard.css';
import '../styles/TutorialModal.css'; // For help button styles
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getRecommendedStudyDuration } from '../services/aiService';
import { getStudySessionStats, getProductivityData, getRecentActivities, getAchievements } from '../services/apiService';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const StudentDashboard = () => {
  const navigate = useNavigate();
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
  const [nextAchievements, setNextAchievements] = useState([]);
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
          // Handle both old format (number) and new format (object)
          let minutes = typeof recommended === 'object' ? recommended.minutes : recommended;
          
          // Validate minutes - ensure it's a valid number
          if (!minutes || isNaN(minutes) || minutes <= 0) {
            console.warn('Invalid AI recommendation, using fallback: 25 minutes');
            minutes = 25; // Default fallback
          }
          
          // Ensure minutes is within reasonable bounds (5-60 minutes)
          minutes = Math.max(5, Math.min(60, Math.round(minutes)));
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
        console.log('📊 Fetching dashboard data for userId:', userId);
        
        // Use Promise.allSettled to prevent one failing request from blocking others
        const [statsResponse, productivityResponse, activitiesResponse, achievementsResponse] = await Promise.allSettled([
          getStudySessionStats(userId, 'week'),
          getProductivityData(userId, 'week'),
          getRecentActivities(userId, 10),
          getAchievements(userId)
        ]);

        // Handle stats response
        if (statsResponse.status === 'fulfilled' && statsResponse.value?.success) {
          const stats = statsResponse.value.stats || {};
          console.log('✅ Stats received:', stats);
          
          setDashboardStats(prev => ({
            ...prev,
            todayStudyHours: stats.todayStudyTime || 0, // Already in hours
            weeklyProgress: stats.totalStudyTime || 0 // Already in hours
          }));
        } else {
          console.warn('⚠️ Stats request failed:', statsResponse.status === 'rejected' ? statsResponse.reason : statsResponse.value);
          // Set default values if stats request fails
          setDashboardStats(prev => ({
            ...prev,
            todayStudyHours: 0,
            weeklyProgress: 0
          }));
        }

        // Handle productivity response
        if (productivityResponse.status === 'fulfilled' && productivityResponse.value?.success) {
          const productivityData = productivityResponse.value.data || {};
          console.log('✅ Productivity data received:', productivityData);
          
          // Update weekly data for chart
          if (productivityData.weeklyData && Array.isArray(productivityData.weeklyData)) {
            // Ensure weekly data is properly formatted (in hours)
            const formattedWeeklyData = productivityData.weeklyData.map(day => ({
              day: day.day || day.date || '',
              hours: typeof day.hours === 'number' 
                ? day.hours 
                : typeof day.studyTime === 'number' 
                  ? day.studyTime / 3600 // Convert seconds to hours
                  : 0
            }));
            setWeeklyData(formattedWeeklyData);
            console.log('📈 Weekly data set:', formattedWeeklyData);
          }
          
          // Update streak from productivity data
          if (productivityData.currentStreak !== undefined) {
            setDashboardStats(prev => ({
              ...prev,
              studyStreak: productivityData.currentStreak || 0
            }));
          }
          
          // Also update weekly progress from productivity data if available (prefer stats if both exist)
          if (productivityData.totalStudyTime !== undefined && !statsResponse.value?.success) {
            setDashboardStats(prev => ({
              ...prev,
              weeklyProgress: typeof productivityData.totalStudyTime === 'number' 
                ? productivityData.totalStudyTime / 3600 // Convert seconds to hours
                : productivityData.totalStudyTime
            }));
          }
        } else {
          console.warn('⚠️ Productivity request failed:', productivityResponse.status === 'rejected' ? productivityResponse.reason : productivityResponse.value);
        }

        // Handle activities response
        if (activitiesResponse.status === 'fulfilled' && activitiesResponse.value?.success && activitiesResponse.value.activities) {
          console.log('✅ Activities received:', activitiesResponse.value.activities.length);
          setRecentActivities(activitiesResponse.value.activities);
        } else {
          console.warn('⚠️ Activities request failed, using empty array');
          // Use empty array instead of default activities - let users see they have no activities yet
          setRecentActivities([]);
        }

        // Handle achievements response
        if (achievementsResponse.status === 'fulfilled' && achievementsResponse.value?.success && achievementsResponse.value.achievements) {
          console.log('✅ Achievements received:', achievementsResponse.value.achievements.length);
          const achievements = achievementsResponse.value.achievements;
          
          // Filter to get next 2 unlocked achievements (or in-progress ones)
          const unlockedOrInProgress = achievements
            .filter(ach => !ach.unlocked) // Get achievements that are not yet unlocked
            .sort((a, b) => {
              // Sort by progress percentage (descending) - show closest to completion first
              const progressA = (a.current / a.target) * 100;
              const progressB = (b.current / b.target) * 100;
              return progressB - progressA;
            })
            .slice(0, 2); // Get top 2
          
          setNextAchievements(unlockedOrInProgress);
        } else {
          console.warn('⚠️ Achievements request failed, using empty array');
          setNextAchievements([]);
        }
        
        // Note: Active groups will need a separate endpoint
        // For now, keeping it at 0
        setDashboardStats(prev => ({
          ...prev,
          activeGroups: 0
        }));
        
      } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        // Set default values on error
        setDashboardStats({
          todayStudyHours: 0,
          weeklyProgress: 0,
          studyStreak: 0,
          activeGroups: 0
        });
        setWeeklyData([
          { day: 'Mon', hours: 0 },
          { day: 'Tue', hours: 0 },
          { day: 'Wed', hours: 0 },
          { day: 'Thu', hours: 0 },
          { day: 'Fri', hours: 0 },
          { day: 'Sat', hours: 0 },
          { day: 'Sun', hours: 0 }
        ]);
        setRecentActivities([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchDashboardData();
    }
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

  const startTimer = () => {
    navigate('/study-timer');
  };
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
    try {
      const recommended = await getRecommendedStudyDuration(studyData);
      // Handle both old format (number) and new format (object)
      let minutes = typeof recommended === 'object' ? recommended.minutes : recommended;
      
      // Validate minutes - ensure it's a valid number
      if (!minutes || isNaN(minutes) || minutes <= 0) {
        console.warn('Invalid AI recommendation, using fallback: 25 minutes');
        minutes = 25; // Default fallback
      }
      
      // Ensure minutes is within reasonable bounds (5-60 minutes)
      minutes = Math.max(5, Math.min(60, Math.round(minutes)));
      setTimeRemaining(minutes * 60);
    } catch (error) {
      console.error('Error getting recommendation for reset:', error);
      // Set default on error
      setTimeRemaining(25 * 60);
    }
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
            <div className="stat-value">
              {(() => {
                // Calculate from weeklyData if available, otherwise use dashboardStats
                const totalHours = weeklyData.length > 0
                  ? weeklyData.reduce((sum, day) => sum + (day.hours || 0), 0)
                  : dashboardStats.weeklyProgress;
                return totalHours.toFixed(1) + 'h';
              })()}
            </div>
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
                      {(() => {
                        // Calculate from weeklyData if available, otherwise use dashboardStats
                        const totalHours = weeklyData.length > 0
                          ? weeklyData.reduce((sum, day) => sum + (day.hours || 0), 0)
                          : dashboardStats.weeklyProgress;
                        const hours = Math.floor(totalHours);
                        const minutes = Math.round((totalHours % 1) * 60);
                        return (
                          <span className="summary-highlight">
                            {hours}h {minutes}m
                          </span>
                        );
                      })()} / 30h
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
                <Link to="/achievements" className="card-action">View All →</Link>
              </div>
              {nextAchievements.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p>No achievements in progress. Start studying to unlock achievements!</p>
                </div>
              ) : (
                nextAchievements.map((achievement, index) => {
                  const progress = Math.min(100, (achievement.current / achievement.target) * 100);
                  const displayValue = achievement.achievementType === 'study_marathon' 
                    ? `${achievement.current}/${achievement.target} hours`
                    : achievement.achievementType === 'streak_master' || achievement.achievementType === 'streak_champion'
                    ? `${achievement.current}/${achievement.target} days`
                    : `${achievement.current}/${achievement.target}`;
                  
                  return (
                    <div key={achievement._id || achievement.id || index} className="achievement-item">
                      <div className="achievement-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                        </svg>
                      </div>
                      <div className="achievement-info">
                        <div className="achievement-title">{achievement.title}</div>
                        <div className="achievement-stat">{displayValue}</div>
                        <div className="achievement-progress-bar">
                          <div className="achievement-progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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