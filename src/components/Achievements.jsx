import { useState, useEffect } from 'react';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import '../styles/Achievements.css';
import '../styles/TutorialModal.css'; // For help button styles
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Achievements = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('achievements')) {
      setShowTutorial(true);
    }
  }, []);

  // Study Milestones - All in progress for new accounts
  const studyMilestones = [
    {
      id: 1,
      icon: '📚',
      title: 'First Steps',
      description: 'Complete your first study session',
      tier: 'SILVER',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 1
    },
    {
      id: 2,
      icon: '⏱️',
      title: 'Time Master',
      description: 'Complete 25 study sessions',
      tier: 'SILVER',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 25
    },
    {
      id: 3,
      icon: '🎓',
      title: 'Scholar Club',
      description: 'Complete 100 total study sessions',
      tier: 'GOLD',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 100
    },
    {
      id: 4,
      icon: '🏆',
      title: 'Study Legend',
      description: 'Complete 500 total study sessions',
      tier: 'PLATINUM',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 500
    }
  ];

  // Streak Records - All in progress for new accounts
  const streakRecords = [
    {
      id: 5,
      icon: '📅',
      title: 'Consistency Starter',
      description: 'Maintain a 7-day study streak',
      tier: 'SILVER',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 7
    },
    {
      id: 6,
      icon: '📆',
      title: 'Two Week Warrior',
      description: 'Maintain a 14-day study streak',
      tier: 'SILVER',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 14
    },
    {
      id: 7,
      icon: '🔥',
      title: '30-Day Streak Master',
      description: 'Maintain a 30-day study streak',
      tier: 'GOLD',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 30
    },
    {
      id: 8,
      icon: '⚡',
      title: 'Unstoppable Force',
      description: 'Maintain a 100-day study streak',
      tier: 'PLATINUM',
      unlocked: false,
      progress: 0,
      current: 0,
      target: 100,
      currentStreak: true
    }
  ];

  // Get recently unlocked achievements (most recent 3)
  const allAchievements = [...studyMilestones, ...streakRecords];
  const recentlyUnlocked = allAchievements
    .filter(a => a.unlocked)
    .sort((a, b) => new Date(b.unlockedDate) - new Date(a.unlockedDate))
    .slice(0, 3);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Achievements</h1>
            <p className="page-subtitle">Track your study progress and unlock rewards</p>
          </div>
        </div>

        {/* Recently Unlocked Section */}
        <div className="recently-unlocked-section">
          <h2 className="recently-unlocked-title">Recently Unlocked</h2>
          {recentlyUnlocked.length > 0 ? (
            <div className="recently-unlocked-grid">
              {recentlyUnlocked.map((achievement) => (
                <div key={achievement.id} className={`recently-unlocked-card ${achievement.tier.toLowerCase()}-highlight`}>
                  <div className={`milestone-badge ${achievement.tier.toLowerCase()}`}>
                    {achievement.tier}
                  </div>
                  <div className="recently-unlocked-icon">
                    {achievement.icon}
                  </div>
                  <h3 className="recently-unlocked-name">{achievement.title}</h3>
                  <p className="recently-unlocked-desc">{achievement.description}</p>
                  <div className="recently-unlocked-date">
                    <span className="unlock-badge">🔓</span>
                    Unlocked {achievement.unlockedDate}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="recently-unlocked-empty">
              <div className="empty-icon">🏆</div>
              <h3 className="empty-title">No Achievements Unlocked Yet</h3>
              <p className="empty-message">
                Start studying to unlock your first achievement! Complete study sessions and maintain streaks to earn rewards.
              </p>
            </div>
          )}
        </div>

        {/* Study Milestones */}
        <div className="milestones-section">
          <h2 className="section-title">
            <span className="title-icon">🏅</span>
            Study Milestones
          </h2>
          <div className="milestones-grid">
            {studyMilestones.map((achievement) => (
              <div key={achievement.id} className={`milestone-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                <div className={`milestone-badge ${achievement.tier.toLowerCase()}`}>
                  {achievement.tier}
                </div>
                <div className="milestone-icon-wrapper">
                  {achievement.unlocked ? (
                    <div className="milestone-icon">{achievement.icon}</div>
                  ) : (
                    <div className="milestone-icon locked-icon">🔒</div>
                  )}
                </div>
                <h3 className="milestone-title">{achievement.title}</h3>
                <p className="milestone-description">{achievement.description}</p>
                
                {achievement.unlocked ? (
                  <div className="milestone-unlocked">
                    <span className="unlock-icon">🔓</span>
                    <span className="unlock-text">Unlocked {achievement.unlockedDate}</span>
                  </div>
                ) : (
                  <div className="milestone-progress-section">
                    <div className="progress-label-row">
                      <span className="progress-label">Progress</span>
                      <span className="progress-value">{achievement.current}/{achievement.target}</span>
                    </div>
                    <div className="progress-bar-wrapper">
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${achievement.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Streak Records */}
        <div className="milestones-section">
          <h2 className="section-title">
            <span className="title-icon">🔥</span>
            Streak Records
          </h2>
          <div className="milestones-grid">
            {streakRecords.map((achievement) => (
              <div key={achievement.id} className={`milestone-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                <div className={`milestone-badge ${achievement.tier.toLowerCase()}`}>
                  {achievement.tier}
                </div>
                <div className="milestone-icon-wrapper">
                  {achievement.unlocked ? (
                    <div className="milestone-icon">{achievement.icon}</div>
                  ) : (
                    <div className="milestone-icon locked-icon">🔒</div>
                  )}
                </div>
                <h3 className="milestone-title">{achievement.title}</h3>
                <p className="milestone-description">{achievement.description}</p>
                
                {achievement.unlocked ? (
                  <div className="milestone-unlocked">
                    <span className="unlock-icon">🔓</span>
                    <span className="unlock-text">Unlocked {achievement.unlockedDate}</span>
                  </div>
                ) : (
                  <div className="milestone-progress-section">
                    {achievement.currentStreak ? (
                      <div className="progress-label-row">
                        <span className="progress-label">Current Streak</span>
                        <span className="progress-value streak-value">{achievement.current}/{achievement.target} days</span>
                      </div>
                    ) : (
                      <div className="progress-label-row">
                        <span className="progress-label">Progress</span>
                        <span className="progress-value">{achievement.current}/{achievement.target}</span>
                      </div>
                    )}
                    <div className="progress-bar-wrapper">
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${achievement.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
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

