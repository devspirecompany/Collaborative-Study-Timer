import { useState, useEffect } from 'react';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import '../styles/Achievements.css';
import '../styles/TutorialModal.css'; // For help button styles
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Achievements = () => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId] = useState('demo-user'); // In production, get from auth context
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    fetchAchievements();
  }, []);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('achievements')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/achievements/${userId}`);
      const data = await response.json();

      if (data.success) {
        setAchievements(data.achievements);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAchievements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/achievements/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      if (data.success && data.unlockedAchievements.length > 0) {
        alert(`🎉 New achievements unlocked!`);
        fetchAchievements();
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading achievements...</p>
          </div>
        </main>
      </div>
    );
  }

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const lockedAchievements = achievements.filter(a => !a.unlocked);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Achievements</h1>
            <p className="page-subtitle">Track your progress and unlock rewards</p>
          </div>
          <button className="btn-primary" onClick={checkAchievements}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Check Achievements
          </button>
        </div>

        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <div className="achievements-section">
            <h2 className="section-title">Unlocked Achievements</h2>
            <div className="achievements-grid">
              {unlockedAchievements.map((achievement) => (
                <div key={achievement._id} className="achievement-card unlocked">
                  <div className="achievement-icon">{achievement.icon}</div>
                  <div className="achievement-content">
                    <h3 className="achievement-title">{achievement.title}</h3>
                    <p className="achievement-description">{achievement.description}</p>
                    <div className="achievement-reward">
                      <strong>Reward:</strong> {achievement.icon} Badge + Achievement Unlocked
                    </div>
                    <div className="achievement-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: '100%' }}></div>
                      </div>
                      <span className="progress-text">100% Complete ({achievement.current}/{achievement.target})</span>
                    </div>
                    {achievement.unlockedAt && (
                      <div className="achievement-date">
                        Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements */}
        <div className="achievements-section">
          <h2 className="section-title">In Progress</h2>
          <div className="achievements-grid">
            {lockedAchievements.map((achievement) => (
              <div key={achievement._id} className="achievement-card locked">
                <div className="achievement-icon locked-icon">🔒</div>
                <div className="achievement-content">
                  <h3 className="achievement-title">{achievement.title}</h3>
                  <p className="achievement-description">{achievement.description}</p>
                  <div className="achievement-reward">
                    <strong>Reward:</strong> {achievement.icon} Badge + Achievement Unlocked
                  </div>
                  <div className="achievement-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${achievement.progress}%` }}></div>
                    </div>
                    <span className="progress-text">
                      {achievement.current} / {achievement.target} ({Math.round(achievement.progress)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="achievements-stats">
          <div className="stat-card">
            <div className="stat-value">{unlockedAchievements.length}</div>
            <div className="stat-label">Unlocked</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{lockedAchievements.length}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{achievements.length}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {achievements.length > 0
                ? Math.round((unlockedAchievements.length / achievements.length) * 100)
                : 0}%
            </div>
            <div className="stat-label">Completion Rate</div>
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
          if (!hasSeenTutorial('achievements')) {
            markTutorialAsSeen('achievements');
          }
        }}
        tutorial={tutorials.achievements}
      />
    </div>
  );
};

export default Achievements;

