import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/StudentDashboard.css';
import Sidebar from './shared/sidebar.jsx';

const Profile = () => {
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

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: userData?.firstName || '',
    lastName: userData?.lastName || '',
    username: userData?.username || '',
    email: userData?.email || '',
        avatar: userData?.avatar || 'icon1.jpg'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Available avatars (5 options)
  const availableAvatars = [
    'icon1.jpg',
    'icon2.jpg',
    'icon3.jpg',
    'icon4.jpg',
    'icon5.jpg'
  ];

  // Update profile data when userData changes
  useEffect(() => {
    if (userData) {
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        username: userData.username || '',
        email: userData.email || '',
        avatar: userData.avatar || 'icon1.jpg'
      });
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarSelect = (avatar) => {
    setProfileData(prev => ({
      ...prev,
      avatar
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // Update localStorage
      const updatedUserData = {
        ...userData,
        ...profileData
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedUserData));
      setUserData(updatedUserData);

      // TODO: Update backend API when ready
      // const response = await updateUserProfile(userData._id, profileData);
      
      setSaveMessage('Profile updated successfully!');
      setIsEditing(false);
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage('Error saving profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original data
    if (userData) {
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        username: userData.username || '',
        email: userData.email || '',
        avatar: userData.avatar || 'icon1.jpg'
      });
    }
    setIsEditing(false);
    setSaveMessage('');
  };

  const getAvatarPath = (avatar) => {
    return `/imgs/${avatar}`;
  };

  const getAvatarInitials = () => {
    const firstName = profileData.firstName || '';
    const lastName = profileData.lastName || '';
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (profileData.username) {
      return profileData.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="dashboard-container">
      <Sidebar collapsed={true} />

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">Manage your profile information and preferences</p>
          </div>
        </div>

        <div className="content-grid">
          {/* Profile Card */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3 className="card-title">Profile Information</h3>
              {!isEditing && (
                <button 
                  className="btn-primary"
                  onClick={() => setIsEditing(true)}
                  style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>

            <div className="card-body" style={{ padding: '2rem' }}>
              {/* Avatar Selection */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                marginBottom: '2rem',
                paddingBottom: '2rem',
                borderBottom: '1px solid var(--border)'
              }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'var(--gradient-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  border: '4px solid var(--primary)',
                  boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                  overflow: 'hidden'
                }}>
                  {profileData.avatar ? (
                    <img 
                      src={getAvatarPath(profileData.avatar)} 
                      alt="Profile Avatar"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div style={{
                    display: profileData.avatar ? 'none' : 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    color: 'white'
                  }}>
                    {getAvatarInitials()}
                  </div>
                </div>

                {isEditing && (
                  <div style={{ width: '100%', maxWidth: '600px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-secondary)'
                    }}>
                      Choose Avatar
                    </label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '1rem',
                      marginBottom: '1rem'
                    }}>
                      {availableAvatars.map((avatar, index) => (
                        <button
                          key={avatar}
                          onClick={() => handleAvatarSelect(avatar)}
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            border: profileData.avatar === avatar 
                              ? '3px solid var(--primary-light)' 
                              : '2px solid var(--border)',
                            background: 'var(--bg-input)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: profileData.avatar === avatar 
                              ? '0 0 0 3px rgba(59, 130, 246, 0.2)' 
                              : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (profileData.avatar !== avatar) {
                              e.currentTarget.style.borderColor = 'var(--primary-light)';
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (profileData.avatar !== avatar) {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }
                          }}
                        >
                          <img 
                            src={getAvatarPath(avatar)} 
                            alt={`Avatar ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              // Show initials as fallback if image fails
                              e.target.style.display = 'none';
                              const fallback = document.createElement('div');
                              fallback.style.cssText = `
                                width: 100%;
                                height: 100%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 1.5rem;
                                font-weight: 700;
                                background: var(--gradient-1);
                                color: white;
                              `;
                              fallback.textContent = getAvatarInitials();
                              e.target.parentElement.appendChild(fallback);
                            }}
                          />
                          {profileData.avatar === avatar && (
                            <div style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'var(--primary-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>
                    First Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="firstName"
                      value={profileData.firstName}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem'
                    }}>
                      {profileData.firstName || 'Not set'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>
                    Last Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="lastName"
                      value={profileData.lastName}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem'
                    }}>
                      {profileData.lastName || 'Not set'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>
                    Username
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="username"
                      value={profileData.username}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem'
                    }}>
                      {profileData.username || 'Not set'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)'
                  }}>
                    Email
                  </label>
                  <div style={{
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '0.95rem'
                  }}>
                    {profileData.email || 'Not set'}
                  </div>
                </div>
              </div>

              {/* Save Message */}
              {saveMessage && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem 1rem',
                  background: saveMessage.includes('Error') 
                    ? 'rgba(239, 68, 68, 0.1)' 
                    : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${saveMessage.includes('Error') ? '#ef4444' : '#10b981'}`,
                  borderRadius: '8px',
                  color: saveMessage.includes('Error') ? '#ef4444' : '#10b981',
                  fontSize: '0.875rem'
                }}>
                  {saveMessage}
                </div>
              )}

              {/* Action Buttons */}
              {isEditing && (
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '2rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.6 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'var(--gradient-1)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="spinner-small" style={{ width: '16px', height: '16px' }}></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;

