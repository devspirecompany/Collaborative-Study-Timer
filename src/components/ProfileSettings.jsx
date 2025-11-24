import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import ErrorModal from './shared/ErrorModal.jsx';
import ConfirmationModal from './shared/ConfirmationModal.jsx';
import { getUser } from '../services/apiService';
import { getSettings, saveSettings } from '../utils/settings';
import '../styles/ProfileSettings.css';
import '../styles/ErrorModal.css';
import '../styles/ConfirmationModal.css';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
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
  
  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: userData?.firstName || '',
    lastName: userData?.lastName || '',
    username: userData?.username || '',
    email: userData?.email || ''
  });

  // Settings state - load from localStorage
  const [settings, setSettings] = useState(() => getSettings());

  // UI states
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL hash or location state for tab preference
    if (location.hash === '#settings' || location.state?.tab === 'settings') {
      return 'settings';
    }
    return 'profile';
  }); // 'profile' or 'settings'
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', details: null, type: 'error' });
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', details: null, type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'warning' });

  // Get avatar initials
  const getAvatarInitials = () => {
    if (!userData) return 'U';
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (userData.username) {
      return userData.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Calculate total study hours
  const totalStudyHours = userData?.totalStudyTime 
    ? (userData.totalStudyTime / 3600).toFixed(1) 
    : '0';

  // Fetch updated user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (userId && userId !== 'demo-user') {
        try {
          const response = await getUser(userId);
          if (response.success && response.user) {
            const updatedUser = response.user;
            setUserData(updatedUser);
            setProfileData({
              firstName: updatedUser.firstName || '',
              lastName: updatedUser.lastName || '',
              username: updatedUser.username || '',
              email: updatedUser.email || ''
            });
            // Update localStorage
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserData();
  }, [userId]);

  // Update user data when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          const updated = JSON.parse(stored);
          setUserData(updated);
          setProfileData({
            firstName: updated.firstName || '',
            lastName: updated.lastName || '',
            username: updated.username || '',
            email: updated.email || ''
          });
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    };
    
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle profile update
  const handleProfileUpdate = async () => {
    if (!profileData.firstName.trim() || !profileData.lastName.trim() || !profileData.username.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        details: null,
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Add API endpoint for updating user profile
      // For now, update localStorage
      const updatedUser = {
        ...userData,
        ...profileData
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setUserData(updatedUser);
      
      setIsEditing(false);
      setSuccessModal({
        isOpen: true,
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully!',
        details: null,
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorModal({
        isOpen: true,
        title: 'Update Failed',
        message: 'Failed to update profile. Please try again.',
        details: null,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle settings update - save immediately when toggles change
  const handleSettingChange = (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    // Save immediately to localStorage
    try {
      saveSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      setErrorModal({
        isOpen: true,
        title: 'Save Failed',
        message: 'Failed to save settings. Please try again.',
        details: null,
        type: 'error'
      });
    }
  };

  // Handle settings update (for manual save button if needed)
  const handleSettingsUpdate = async () => {
    setIsSaving(true);
    try {
      saveSettings(settings);
      setSuccessModal({
        isOpen: true,
        title: 'Settings Saved',
        message: 'Your settings have been saved successfully!',
        details: null,
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setErrorModal({
        isOpen: true,
        title: 'Save Failed',
        message: 'Failed to save settings. Please try again.',
        details: null,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
  }, []);

  // Listen for settings updates from other components
  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      setSettings(event.detail);
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  // Handle password change
  const handlePasswordChange = () => {
    setErrorModal({
      isOpen: true,
      title: 'Feature Coming Soon',
      message: 'Password change functionality will be available in a future update.',
      details: null,
      type: 'info'
    });
  };

  // Handle account deletion
  const handleDeleteAccount = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.',
      onConfirm: () => {
        // TODO: Add API endpoint for account deletion
        setErrorModal({
          isOpen: true,
          title: 'Feature Coming Soon',
          message: 'Account deletion functionality will be available in a future update.',
          details: null,
          type: 'info'
        });
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null, type: 'warning' });
      },
      type: 'danger'
    });
  };

  return (
    <div className="profile-settings-container">
      <Sidebar />

      <main className="profile-settings-main">
        <div className="profile-settings-header">
          <h1>Profile & Settings</h1>
          <p>Manage your profile information and preferences</p>
        </div>

        {/* Tabs */}
        <div className="profile-settings-tabs">
          <button
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Profile
          </button>
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
            </svg>
            Settings
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="profile-settings-content">
            <div className="profile-card">
              <div className="profile-header">
                <div className="profile-avatar">
                  <span className="avatar-initials">{getAvatarInitials()}</span>
                </div>
                <div className="profile-info">
                  <h2>{userData?.firstName} {userData?.lastName}</h2>
                  <p className="profile-username">@{userData?.username}</p>
                  <p className="profile-email">{userData?.email}</p>
                </div>
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <div className="stat-value">{totalStudyHours}h</div>
                  <div className="stat-label">Total Study Time</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData?.currentStreak || 0}</div>
                  <div className="stat-label">Day Streak</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{formatDate(userData?.createdAt)}</div>
                  <div className="stat-label">Member Since</div>
                </div>
              </div>
            </div>

            <div className="profile-form-card">
              <div className="card-header">
                <h3>Edit Profile</h3>
                {!isEditing && (
                  <button className="edit-button" onClick={() => setIsEditing(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                  </button>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  disabled={!isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  disabled={!isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  disabled={!isEditing}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email}
                  disabled
                  className="disabled-input"
                />
                <small className="form-hint">Email cannot be changed</small>
              </div>

              {isEditing && (
                <div className="form-actions">
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setIsEditing(false);
                      setProfileData({
                        firstName: userData?.firstName || '',
                        lastName: userData?.lastName || '',
                        username: userData?.username || '',
                        email: userData?.email || ''
                      });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleProfileUpdate}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="profile-actions-card">
              <h3>Account Actions</h3>
              <div className="action-buttons">
                <button className="action-btn change-password" onClick={handlePasswordChange}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Change Password
                </button>
                <button className="action-btn delete-account" onClick={handleDeleteAccount}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="profile-settings-content">
            <div className="settings-section">
              <h3>Notifications</h3>
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="emailNotifications">Email Notifications</label>
                    <p>Receive notifications via email</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      checked={settings.emailNotifications}
                      onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="studyReminders">Study Reminders</label>
                    <p>Get reminders for your study sessions</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="studyReminders"
                      checked={settings.studyReminders}
                      onChange={(e) => handleSettingChange('studyReminders', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="achievementNotifications">Achievement Notifications</label>
                    <p>Get notified when you earn achievements</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="achievementNotifications"
                      checked={settings.achievementNotifications}
                      onChange={(e) => handleSettingChange('achievementNotifications', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Study Timer</h3>
              <div className="settings-group">
                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="soundEnabled">Sound Effects</label>
                    <p>Play sounds for timer notifications</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="soundEnabled"
                      checked={settings.soundEnabled}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="autoStartBreak">Auto-start Break</label>
                    <p>Automatically start break timer after study session</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="autoStartBreak"
                      checked={settings.autoStartBreak}
                      onChange={(e) => handleSettingChange('autoStartBreak', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <label htmlFor="autoStartStudy">Auto-start Study</label>
                    <p>Automatically start study timer after break</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="autoStartStudy"
                      checked={settings.autoStartStudy}
                      onChange={(e) => handleSettingChange('autoStartStudy', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button
                className="btn-save"
                onClick={handleSettingsUpdate}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '', details: null, type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        type={errorModal.type}
      />

      {/* Success Modal */}
      <ErrorModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false, title: '', message: '', details: null, type: 'success' })}
        title={successModal.title}
        message={successModal.message}
        details={successModal.details}
        type={successModal.type}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null, type: 'warning' })}
        onConfirm={confirmModal.onConfirm || (() => {})}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Delete Account"
        cancelText="Cancel"
      />
    </div>
  );
};

export default ProfileSettings;

