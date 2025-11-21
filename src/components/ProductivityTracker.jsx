import { useState, useEffect } from 'react';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import '../styles/ProductivityTracker.css';
import '../styles/TutorialModal.css'; // For help button styles
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ProductivityTracker = () => {
  const [productivityData, setProductivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [trackerView, setTrackerView] = useState('day'); // day, month, year
  const [userId] = useState('demo-user');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    fetchProductivityData();
  }, [period]);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('productivityTracker')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/productivity/${userId}?period=${period}`);
      const data = await response.json();

      if (data.success) {
        setProductivityData(data.data);
      }
    } catch (error) {
      console.error('Error fetching productivity data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate tracker data based on selected view
  const getTrackerData = () => {
    if (trackerView === 'day') {
      // Last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          hours: Math.random() * 5 + 1, // Mock data: 1-6 hours
          fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
      });
    } else if (trackerView === 'month') {
      // Last 4 weeks
      return Array.from({ length: 4 }, (_, i) => ({
        label: `Week ${i + 1}`,
        hours: Math.random() * 30 + 10, // Mock data: 10-40 hours
      }));
    } else {
      // Last 12 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      return Array.from({ length: 12 }, (_, i) => {
        const monthIndex = (currentMonth - 11 + i + 12) % 12;
        return {
          label: months[monthIndex],
          hours: Math.random() * 100 + 20, // Mock data: 20-120 hours
        };
      });
    }
  };

  const trackerData = getTrackerData();
  const maxTrackerHours = Math.max(...trackerData.map(d => d.hours), 1);

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading productivity data...</p>
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
            if (!hasSeenTutorial('productivityTracker')) {
              markTutorialAsSeen('productivityTracker');
            }
          }}
          tutorial={tutorials.productivityTracker}
        />
      </div>
    );
  }

  if (!productivityData) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Productivity Tracker</h1>
              <p className="page-subtitle">Track your study habits and productivity</p>
            </div>
          </div>
          
          <div className="empty-state-enhanced">
            <div className="empty-state-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h2>Ready to Start Tracking?</h2>
            <p className="empty-state-message">
              You haven't started any study sessions yet. Begin your productivity journey today!
            </p>

            <div className="empty-state-actions">
              <button 
                className="btn-primary-empty"
                onClick={() => window.location.href = '/study-timer'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Start Your First Study Session
              </button>
            </div>
          </div>

          {/* Study Time Tracker - Empty State */}
          <div className="chart-card tracker-card">
            <div className="card-header">
              <h3 className="card-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                  <path d="M3 3v18h18"/>
                  <rect x="7" y="10" width="3" height="8"/>
                  <rect x="14" y="5" width="3" height="13"/>
                </svg>
                Study Time Tracker
              </h3>
              <div className="tracker-toggle">
                <button
                  className={`tracker-btn ${trackerView === 'day' ? 'active' : ''}`}
                  onClick={() => setTrackerView('day')}
                >
                  Day
                </button>
                <button
                  className={`tracker-btn ${trackerView === 'month' ? 'active' : ''}`}
                  onClick={() => setTrackerView('month')}
                >
                  Month
                </button>
                <button
                  className={`tracker-btn ${trackerView === 'year' ? 'active' : ''}`}
                  onClick={() => setTrackerView('year')}
                >
                  Year
                </button>
              </div>
            </div>
            <div className="tracker-subtitle">
              {trackerView === 'day' && 'Hours studied per day (Last 7 days)'}
              {trackerView === 'month' && 'Hours studied per week (Last 4 weeks)'}
              {trackerView === 'year' && 'Hours studied per month (Last 12 months)'}
            </div>
            <div className="tracker-chart">
              {trackerData.map((data, index) => (
                <div key={index} className="tracker-bar-wrapper">
                  <div className="tracker-bar-container">
                    <div
                      className="tracker-bar empty-bar"
                      style={{
                        height: '20px',
                        opacity: 0.3,
                        transition: `all 0.8s ease ${index * 50}ms`
                      }}
                    >
                      <div className="tracker-tooltip">
                        {trackerView === 'day' && data.fullDate && <div className="tooltip-date">{data.fullDate}</div>}
                        <div className="tooltip-hours">0h</div>
                      </div>
                    </div>
                    <div className="tracker-value" style={{ opacity: 0.5 }}>0h</div>
                  </div>
                  <div className="tracker-label">{data.label}</div>
                </div>
              ))}
            </div>
            <div className="tracker-legend">
              <div className="legend-item">
                <div className="legend-color"></div>
                <span>Study Hours (No data yet)</span>
              </div>
            </div>
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
            if (!hasSeenTutorial('productivityTracker')) {
              markTutorialAsSeen('productivityTracker');
            }
          }}
          tutorial={tutorials.productivityTracker}
        />
      </div>
    );
  }

  const maxHours = Math.max(...productivityData.weeklyData.map(d => d.hours), 1);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Productivity Tracker</h1>
            <p className="page-subtitle">Track your study habits, productivity, and time budgets</p>
          </div>
          <div className="period-selector">
            <button
              className={`period-btn ${period === 'week' ? 'active' : ''}`}
              onClick={() => setPeriod('week')}
            >
              Week
            </button>
            <button
              className={`period-btn ${period === 'month' ? 'active' : ''}`}
              onClick={() => setPeriod('month')}
            >
              Month
            </button>
            <button
              className={`period-btn ${period === 'year' ? 'active' : ''}`}
              onClick={() => setPeriod('year')}
            >
              Year
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-label">Total Study Time</div>
            <div className="stat-value">{productivityData.totalStudyTime.toFixed(1)}h</div>
            <div className="stat-footer">This {period}</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V6.5A2.5 2.5 0 0 0 17.5 4H6.5A2.5 2.5 0 0 0 4 6.5V19.5Z" />
              </svg>
            </div>
            <div className="stat-label">Sessions Completed</div>
            <div className="stat-value">{productivityData.totalSessions}</div>
            <div className="stat-footer">Average: {productivityData.averageSessionLength.toFixed(0)} min</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" />
              </svg>
            </div>
            <div className="stat-label">Current Streak</div>
            <div className="stat-value">{productivityData.currentStreak} days</div>
            <div className="stat-footer">Keep it up!</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="stat-label">Weekly Goal (Time Budget)</div>
            <div className="stat-value">
              {((productivityData.totalStudyTime / productivityData.goals.weekly) * 100).toFixed(0)}%
            </div>
            <div className="stat-footer">{productivityData.goals.weekly}h goal (budget)</div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="chart-card">
          <div className="card-header">
            <h3 className="card-title">Study Time This Week</h3>
          </div>
          <div className="progress-chart">
            {productivityData.weeklyData.map((data, index) => (
              <div key={data.day} className="progress-bar-wrapper">
                <div className="progress-bar" style={{ height: '200px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      height: `${(data.hours / maxHours) * 100}%`,
                      transition: `height 0.8s ease ${index * 100}ms`
                    }}
                  >
                    <div className="progress-value">{data.hours.toFixed(1)}h</div>
                  </div>
                </div>
                <div className="progress-label">{data.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Budgets/Goals Explanation */}
        <div className="insights-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="card-title">📊 Time Budgets & Goals</h3>
          <div className="insights-list">
            <div className="insight-item">
              <div className="insight-icon">⏰</div>
              <div className="insight-content">
                <div className="insight-title">What are Time Budgets?</div>
                <div className="insight-text">
                  Time budgets are your daily and weekly study time goals. Think of them as targets you set for yourself to maintain consistent study habits.
                </div>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">🎯</div>
              <div className="insight-content">
                <div className="insight-title">Current Goals</div>
                <div className="insight-text">
                  Daily: {productivityData.goals.daily ? (productivityData.goals.daily / 3600).toFixed(1) : '2.0'}h | 
                  Weekly: {productivityData.goals.weekly ? productivityData.goals.weekly.toFixed(1) : '4.0'}h
                </div>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">🤖</div>
              <div className="insight-content">
                <div className="insight-title">AI-Suggested Goals</div>
                <div className="insight-text">
                  AI analyzes your study patterns and suggests optimized goals to help you maintain consistent progress.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI-Powered Productivity Insights */}
        {productivityData.aiInsights && (
          <div className="ai-insights-card">
            <div className="card-header">
              <h3 className="card-title">
                <span className="ai-badge">🤖 AI</span>
                Productivity Insights
              </h3>
            </div>
            <div className="ai-insights-content">
              <p className="ai-insight-text">{productivityData.aiInsights}</p>
              
              {productivityData.aiRecommendations && productivityData.aiRecommendations.length > 0 && (
                <div className="ai-recommendations">
                  <h4>AI Recommendations:</h4>
                  <ul>
                    {productivityData.aiRecommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {productivityData.optimizedGoals && (
                <div className="optimized-goals">
                  <h4>AI-Suggested Goals:</h4>
                  <div className="goals-display">
                    <div className="goal-item">
                      <span className="goal-label">Daily:</span>
                      <span className="goal-value">{productivityData.optimizedGoals.daily.toFixed(1)}h</span>
                    </div>
                    <div className="goal-item">
                      <span className="goal-label">Weekly:</span>
                      <span className="goal-value">{productivityData.optimizedGoals.weekly.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Basic Productivity Insights */}
        <div className="insights-card">
          <h3 className="card-title">Quick Stats</h3>
          <div className="insights-list">
            <div className="insight-item">
              <div className="insight-icon">📊</div>
              <div className="insight-content">
                <div className="insight-title">Best Study Day</div>
                <div className="insight-text">
                  {productivityData.weeklyData.reduce((max, day) =>
                    day.hours > max.hours ? day : max,
                    productivityData.weeklyData[0]
                  )?.day || 'N/A'}
                </div>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">⏰</div>
              <div className="insight-content">
                <div className="insight-title">Average Session Length</div>
                <div className="insight-text">{productivityData.averageSessionLength.toFixed(0)} minutes</div>
              </div>
            </div>
            <div className="insight-item">
              <div className="insight-icon">🎯</div>
              <div className="insight-content">
                <div className="insight-title">Goal Progress</div>
                <div className="insight-text">
                  {((productivityData.totalStudyTime / productivityData.goals.weekly) * 100).toFixed(0)}% of weekly goal
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Study Time Tracker */}
        <div className="chart-card tracker-card">
          <div className="card-header">
            <h3 className="card-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                <path d="M3 3v18h18"/>
                <rect x="7" y="10" width="3" height="8"/>
                <rect x="14" y="5" width="3" height="13"/>
              </svg>
              Study Time Tracker
            </h3>
            <div className="tracker-toggle">
              <button
                className={`tracker-btn ${trackerView === 'day' ? 'active' : ''}`}
                onClick={() => setTrackerView('day')}
              >
                Day
              </button>
              <button
                className={`tracker-btn ${trackerView === 'month' ? 'active' : ''}`}
                onClick={() => setTrackerView('month')}
              >
                Month
              </button>
              <button
                className={`tracker-btn ${trackerView === 'year' ? 'active' : ''}`}
                onClick={() => setTrackerView('year')}
              >
                Year
              </button>
            </div>
          </div>
          <div className="tracker-subtitle">
            {trackerView === 'day' && 'Hours studied per day (Last 7 days)'}
            {trackerView === 'month' && 'Hours studied per week (Last 4 weeks)'}
            {trackerView === 'year' && 'Hours studied per month (Last 12 months)'}
          </div>
          <div className="tracker-chart">
            {trackerData.map((data, index) => (
              <div key={index} className="tracker-bar-wrapper">
                <div className="tracker-bar-container">
                  <div
                    className="tracker-bar"
                    style={{
                      height: `${(data.hours / maxTrackerHours) * 100}%`,
                      transition: `height 0.8s ease ${index * 50}ms`
                    }}
                  >
                    <div className="tracker-tooltip">
                      {trackerView === 'day' && data.fullDate && <div className="tooltip-date">{data.fullDate}</div>}
                      <div className="tooltip-hours">{data.hours.toFixed(1)}h</div>
                    </div>
                  </div>
                  <div className="tracker-value">{data.hours.toFixed(1)}h</div>
                </div>
                <div className="tracker-label">{data.label}</div>
              </div>
            ))}
          </div>
          <div className="tracker-legend">
            <div className="legend-item">
              <div className="legend-color"></div>
              <span>Study Hours</span>
            </div>
          </div>
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
          if (!hasSeenTutorial('productivityTracker')) {
            markTutorialAsSeen('productivityTracker');
          }
        }}
        tutorial={tutorials.productivityTracker}
      />
    </div>
  );
};

export default ProductivityTracker;

