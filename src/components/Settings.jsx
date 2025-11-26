import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/StudentDashboard.css';
import Sidebar from './shared/sidebar.jsx';
import { updateUserProfile } from '../services/apiService';

const Settings = () => {
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

  const userId = userData?._id || userData?.id || 'demo-user';

  // Load settings from localStorage or use defaults
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('userSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return {
      // Study Timer Settings (USED in StudentStudyTimer)
      autoStartBreak: true,
      autoStartStudy: false,
      soundNotifications: true,
      desktopNotifications: true,
      
      // Reviewer Settings (USED in StudentStudyTimer)
      defaultPaperStyle: 'blank', // 'blank', 'lined', 'grid'
      defaultPaperColor: 'white', // 'white', 'cream', 'blue', 'green', 'purple'
      defaultViewMode: 'document', // 'document', 'flashcards'
      
      // Study Preferences (USED for timer defaults)
      defaultStudyDuration: 25, // minutes
      defaultBreakDuration: 5, // minutes
      longBreakDuration: 15, // minutes
    };
  };

  const [settings, setSettings] = useState(loadSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Save settings to localStorage
  const saveSettings = async (newSettings) => {
    try {
      localStorage.setItem('userSettings', JSON.stringify(newSettings));
      
      // Also save to backend if user is logged in
      if (userId && userId !== 'demo-user') {
        try {
          await updateUserProfile(userId, {
            settings: newSettings
          });
        } catch (error) {
          console.error('Error saving settings to backend:', error);
          // Continue anyway - localStorage is saved
        }
      }
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      const defaultSettings = loadSettings();
      setSettings(defaultSettings);
      saveSettings(defaultSettings);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar collapsed={true} />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Customize your study experience and preferences</p>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            background: saveMessage.includes('Error') 
              ? 'rgba(239, 68, 68, 0.1)' 
              : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${saveMessage.includes('Error') ? '#ef4444' : '#10b981'}`,
            borderRadius: '8px',
            color: saveMessage.includes('Error') ? '#ef4444' : '#10b981',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {saveMessage.includes('Error') ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {saveMessage}
          </div>
        )}

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          maxWidth: '1200px',
          width: '100%'
        }}>
          {/* Study Timer Settings */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <h3 className="card-title">Study Timer</h3>
            </div>
            <div className="card-body" style={{ padding: '1.5rem 0' }}>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Auto-start breaks</label>
                  <p className="setting-description">Automatically start break timer after study session ends</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoStartBreak}
                    onChange={(e) => handleSettingChange('autoStartBreak', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Auto-start study sessions</label>
                  <p className="setting-description">Automatically start next study session after break ends</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoStartStudy}
                    onChange={(e) => handleSettingChange('autoStartStudy', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Default study duration (minutes)</label>
                  <p className="setting-description">Default timer duration for study sessions</p>
                </div>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={settings.defaultStudyDuration}
                  onChange={(e) => handleSettingChange('defaultStudyDuration', parseInt(e.target.value) || 25)}
                  style={{
                    width: '100px',
                    padding: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Default break duration (minutes)</label>
                  <p className="setting-description">Default timer duration for short breaks</p>
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.defaultBreakDuration}
                  onChange={(e) => handleSettingChange('defaultBreakDuration', parseInt(e.target.value) || 5)}
                  style={{
                    width: '100px',
                    padding: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Long break duration (minutes)</label>
                  <p className="setting-description">Timer duration for long breaks</p>
                </div>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={settings.longBreakDuration}
                  onChange={(e) => handleSettingChange('longBreakDuration', parseInt(e.target.value) || 15)}
                  style={{
                    width: '100px',
                    padding: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <h3 className="card-title">Notifications</h3>
            </div>
            <div className="card-body" style={{ padding: '1.5rem 0' }}>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Sound notifications</label>
                  <p className="setting-description">Play sounds for timer alerts and achievements</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.soundNotifications}
                    onChange={(e) => handleSettingChange('soundNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Desktop notifications</label>
                  <p className="setting-description">Show browser notifications for important events</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.desktopNotifications}
                    onChange={(e) => {
                      handleSettingChange('desktopNotifications', e.target.checked);
                      if (e.target.checked && 'Notification' in window) {
                        Notification.requestPermission();
                      }
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Reviewer Settings */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <h3 className="card-title">Reviewer Preferences</h3>
            </div>
            <div className="card-body" style={{ padding: '1.5rem 0' }}>
              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Default paper style</label>
                  <p className="setting-description">Default paper style for reviewer view</p>
                </div>
                <select
                  value={settings.defaultPaperStyle}
                  onChange={(e) => handleSettingChange('defaultPaperStyle', e.target.value)}
                  style={{
                    padding: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="blank">Blank</option>
                  <option value="lined">Lined</option>
                  <option value="grid">Grid</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Default paper color</label>
                  <p className="setting-description">Default paper color for reviewer view</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['white', 'cream', 'blue', 'green', 'purple'].map((color) => (
                    <button
                      key={color}
                      onClick={() => handleSettingChange('defaultPaperColor', color)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: settings.defaultPaperColor === color 
                          ? '3px solid var(--primary)' 
                          : '2px solid var(--border)',
                        background: color === 'white' ? '#ffffff' :
                                  color === 'cream' ? '#f5f5dc' :
                                  color === 'blue' ? '#e3f2fd' :
                                  color === 'green' ? '#e8f5e9' :
                                  '#f3e5f5',
                        cursor: 'pointer',
                        boxShadow: settings.defaultPaperColor === color 
                          ? '0 0 0 3px rgba(59, 130, 246, 0.2)' 
                          : 'none',
                        transition: 'all 0.2s'
                      }}
                      title={color.charAt(0).toUpperCase() + color.slice(1)}
                    />
                  ))}
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <label className="setting-label">Default view mode</label>
                  <p className="setting-description">Default view mode when opening a reviewer</p>
                </div>
                <select
                  value={settings.defaultViewMode}
                  onChange={(e) => handleSettingChange('defaultViewMode', e.target.value)}
                  style={{
                    padding: '0.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="document">Document View</option>
                  <option value="flashcards">Flashcards</option>
                </select>
              </div>
            </div>
          </div>


          {/* Actions */}
          <div className="card" style={{ width: '100%' }}>
            <div className="card-header">
              <h3 className="card-title">Actions</h3>
            </div>
            <div className="card-body" style={{ padding: '1.5rem 0' }}>
              <button
                onClick={handleResetSettings}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-input)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;

