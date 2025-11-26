import { useState, useEffect } from 'react';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import '../styles/Achievements.css';
import '../styles/TutorialModal.css'; // For help button styles
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';
import { getAchievements } from '../services/apiService';

const Achievements = () => {
  const [showTutorial, setShowTutorial] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overallProgress, setOverallProgress] = useState(0);

  // Get user data from localStorage
  const [userData] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  });

  const userId = userData?._id || userData?.id || 'demo-user';

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('achievements')) {
      setShowTutorial(true);
    }
  }, []);

  // Fetch achievements from API
  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true);
        const response = await getAchievements(userId);
        if (response && response.success && response.achievements) {
          setAchievements(response.achievements);
          
          // Calculate overall progress
          const totalAchievements = response.achievements.length;
          const unlockedCount = response.achievements.filter(a => a.unlocked).length;
          const overallPercentage = totalAchievements > 0 
            ? Math.round((unlockedCount / totalAchievements) * 100) 
            : 0;
          setOverallProgress(overallPercentage);
        } else {
          console.warn('Failed to fetch achievements:', response);
          setAchievements([]);
          setOverallProgress(0);
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setAchievements([]);
        setOverallProgress(0);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  // Categorize achievements
  const studyMilestones = achievements.filter(a => 
    ['study_marathon', 'focused_mind', 'time_warrior'].includes(a.achievementType) ||
    a.title?.toLowerCase().includes('study') || 
    a.title?.toLowerCase().includes('session') ||
    a.title?.toLowerCase().includes('hour')
  );

  const streakRecords = achievements.filter(a => 
    ['streak_master', 'perfect_week', 'early_bird'].includes(a.achievementType) ||
    a.title?.toLowerCase().includes('streak') ||
    a.title?.toLowerCase().includes('day')
  );

  const otherAchievements = achievements.filter(a => 
    !studyMilestones.includes(a) && !streakRecords.includes(a)
  );

  // Get recently unlocked achievements (most recent 3)
  const recentlyUnlocked = achievements
    .filter(a => a.unlocked)
    .sort((a, b) => new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0))
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

        {/* Overall Progress Card */}
        {!loading && achievements.length > 0 && (
          <div className="card" style={{ 
            marginBottom: '2rem', 
            background: 'linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)',
            color: 'white',
            border: 'none'
          }}>
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Overall Progress</h2>
                <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{overallProgress}%</div>
              </div>
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.2)', 
                borderRadius: '10px', 
                height: '12px', 
                overflow: 'hidden',
                marginBottom: '0.5rem'
              }}>
                <div style={{ 
                  background: 'white', 
                  height: '100%', 
                  width: `${overallProgress}%`,
                  transition: 'width 0.5s ease',
                  borderRadius: '10px'
                }}></div>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                {achievements.filter(a => a.unlocked).length} of {achievements.length} achievements unlocked
                {overallProgress < 100 && ` • ${100 - overallProgress}% remaining to complete all`}
              </p>
            </div>
          </div>
        )}

        {/* Recently Unlocked Section */}
        <div className="recently-unlocked-section">
          <h2 className="recently-unlocked-title">Recently Unlocked</h2>
          {recentlyUnlocked.length > 0 ? (
            <div className="recently-unlocked-grid">
              {recentlyUnlocked.map((achievement) => (
                <div key={achievement._id || achievement.id} className={`recently-unlocked-card ${(achievement.tier || 'SILVER').toLowerCase()}-highlight`}>
                  <div className={`milestone-badge ${(achievement.tier || 'SILVER').toLowerCase()}`}>
                    {achievement.tier || 'SILVER'}
                  </div>
                  <div className="recently-unlocked-icon">
                    {achievement.icon || '⭐'}
                  </div>
                  <h3 className="recently-unlocked-name">{achievement.title}</h3>
                  <p className="recently-unlocked-desc">{achievement.description}</p>
                  <div className="recently-unlocked-date">
                    <span className="unlock-badge">🔓</span>
                    Unlocked {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div className="waiting-spinner"></div>
            <p>Loading achievements...</p>
          </div>
        ) : (
          <>
            {studyMilestones.length > 0 && (
              <div className="milestones-section">
                <h2 className="section-title">
                  <span className="title-icon">🏅</span>
                  Study Milestones
                </h2>
                <div className="milestones-grid">
                  {studyMilestones.map((achievement) => (
                    <div key={achievement._id || achievement.id} className={`milestone-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                      <div className={`milestone-badge ${(achievement.tier || 'SILVER').toLowerCase()}`}>
                        {achievement.tier || 'SILVER'}
                      </div>
                      <div className="milestone-icon-wrapper">
                        {achievement.unlocked ? (
                          <div className="milestone-icon">{achievement.icon || '⭐'}</div>
                        ) : (
                          <div className="milestone-icon locked-icon">🔒</div>
                        )}
                      </div>
                      <h3 className="milestone-title">{achievement.title}</h3>
                      <p className="milestone-description">{achievement.description}</p>
                      
                      {achievement.unlocked ? (
                        <div className="milestone-unlocked">
                          <span className="unlock-icon">🔓</span>
                          <span className="unlock-text">Unlocked {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}</span>
                        </div>
                      ) : (
                        <div className="milestone-progress-section">
                          <div className="progress-label-row">
                            <span className="progress-label">Progress</span>
                            <span className="progress-value">{achievement.current || 0}/{achievement.target}</span>
                          </div>
                          <div className="progress-bar-wrapper">
                            <div 
                              className="progress-bar-fill"
                              style={{ width: `${achievement.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streak Records */}
            {streakRecords.length > 0 && (
              <div className="milestones-section">
                <h2 className="section-title">
                  <span className="title-icon">🔥</span>
                  Streak Records
                </h2>
                <div className="milestones-grid">
                  {streakRecords.map((achievement) => (
                    <div key={achievement._id || achievement.id} className={`milestone-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                      <div className={`milestone-badge ${(achievement.tier || 'SILVER').toLowerCase()}`}>
                        {achievement.tier || 'SILVER'}
                      </div>
                      <div className="milestone-icon-wrapper">
                        {achievement.unlocked ? (
                          <div className="milestone-icon">{achievement.icon || '🔥'}</div>
                        ) : (
                          <div className="milestone-icon locked-icon">🔒</div>
                        )}
                      </div>
                      <h3 className="milestone-title">{achievement.title}</h3>
                      <p className="milestone-description">{achievement.description}</p>
                      
                      {achievement.unlocked ? (
                        <div className="milestone-unlocked">
                          <span className="unlock-icon">🔓</span>
                          <span className="unlock-text">Unlocked {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}</span>
                        </div>
                      ) : (
                        <div className="milestone-progress-section">
                          {achievement.achievementType === 'streak_master' || achievement.achievementType === 'perfect_week' ? (
                            <div className="progress-label-row">
                              <span className="progress-label">Current Streak</span>
                              <span className="progress-value streak-value">{achievement.current || 0}/{achievement.target} days</span>
                            </div>
                          ) : (
                            <div className="progress-label-row">
                              <span className="progress-label">Progress</span>
                              <span className="progress-value">{achievement.current || 0}/{achievement.target}</span>
                            </div>
                          )}
                          <div className="progress-bar-wrapper">
                            <div 
                              className="progress-bar-fill"
                              style={{ width: `${achievement.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Achievements */}
            {otherAchievements.length > 0 && (
              <div className="milestones-section">
                <h2 className="section-title">
                  <span className="title-icon">⭐</span>
                  Other Achievements
                </h2>
                <div className="milestones-grid">
                  {otherAchievements.map((achievement) => (
                    <div key={achievement._id || achievement.id} className={`milestone-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                      <div className={`milestone-badge ${(achievement.tier || 'SILVER').toLowerCase()}`}>
                        {achievement.tier || 'SILVER'}
                      </div>
                      <div className="milestone-icon-wrapper">
                        {achievement.unlocked ? (
                          <div className="milestone-icon">{achievement.icon || '⭐'}</div>
                        ) : (
                          <div className="milestone-icon locked-icon">🔒</div>
                        )}
                      </div>
                      <h3 className="milestone-title">{achievement.title}</h3>
                      <p className="milestone-description">{achievement.description}</p>
                      
                      {achievement.unlocked ? (
                        <div className="milestone-unlocked">
                          <span className="unlock-icon">🔓</span>
                          <span className="unlock-text">Unlocked {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}</span>
                        </div>
                      ) : (
                        <div className="milestone-progress-section">
                          <div className="progress-label-row">
                            <span className="progress-label">Progress</span>
                            <span className="progress-value">{achievement.current || 0}/{achievement.target}</span>
                          </div>
                          <div className="progress-bar-wrapper">
                            <div 
                              className="progress-bar-fill"
                              style={{ width: `${achievement.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
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

