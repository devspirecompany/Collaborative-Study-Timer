// Settings utility for managing user preferences across the app

const SETTINGS_KEY = 'userSettings';

// Default settings
const defaultSettings = {
  emailNotifications: true,
  studyReminders: true,
  achievementNotifications: true,
  soundEnabled: true,
  darkMode: true,
  autoStartBreak: true,
  autoStartStudy: false
};

/**
 * Get all user settings from localStorage
 * @returns {Object} User settings object
 */
export const getSettings = () => {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      // Merge with defaults to ensure all settings exist
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaultSettings;
};

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object to save
 */
export const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch custom event so other components can listen for changes
    window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

/**
 * Update a single setting
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
export const updateSetting = (key, value) => {
  const currentSettings = getSettings();
  const updatedSettings = { ...currentSettings, [key]: value };
  saveSettings(updatedSettings);
  return updatedSettings;
};

/**
 * Get a specific setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if setting doesn't exist
 * @returns {*} Setting value
 */
export const getSetting = (key, defaultValue = null) => {
  const settings = getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
};

/**
 * Reset all settings to defaults
 */
export const resetSettings = () => {
  saveSettings(defaultSettings);
};

/**
 * Check if a notification type should be shown based on user settings
 * @param {string} notificationType - Type of notification ('achievement', 'study_reminder', etc.)
 * @returns {boolean} Whether notification should be shown
 */
export const shouldShowNotification = (notificationType) => {
  const settings = getSettings();
  
  switch (notificationType) {
    case 'achievement':
    case 'achievement_unlocked':
      return settings.achievementNotifications;
    case 'study_reminder':
    case 'study_session':
    case 'study_session_completed':
      return settings.studyReminders;
    default:
      return true; // Show other notifications by default
  }
};

