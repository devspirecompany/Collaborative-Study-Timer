import React from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom';
import '../../styles/StudentDashboard.css';
import { useState, useEffect } from "react";
import { getNotifications, markNotificationAsRead } from '../../services/apiService';

const Sidebar = ({ collapsed = false }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // UI states
    const [userDropdownActive, setUserDropdownActive] = useState(false);
    const [notificationSidebarActive, setNotificationSidebarActive] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
    
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
    // Show full name in sidebar (user profile)
    const userName = userData 
      ? (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : userData.firstName || userData.username || 'User')
      : 'Ash';
    const userRole = userData?.role || 'Student';
    
    // Get avatar initials
    const getAvatarInitials = () => {
      if (!userData) return 'AQ';
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
      
      // Listen for storage events (when user logs in from another tab)
      window.addEventListener('storage', handleStorageChange);
      
      return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const fetchNotifications = async () => {
      try {
        setIsLoadingNotifications(true);
        const response = await getNotifications(userId, 50, false);
        
        if (response.success) {
          // Format notifications for display
          const formattedNotifications = response.notifications.map(notif => ({
            id: notif._id,
            type: notif.color || 'blue',
            title: notif.title,
            text: notif.message,
            time: formatTimeAgo(new Date(notif.createdAt)),
            unread: !notif.read,
            icon: notif.icon,
            actionUrl: notif.actionUrl
          }));
          
          setNotifications(formattedNotifications);
          setUnreadCount(response.unreadCount || 0);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        // Keep empty state if fetch fails
        setNotifications([]);
        setUnreadCount(0);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    // Fetch notifications from backend
    useEffect(() => {
      if (userId && userId !== 'demo-user') {
        fetchNotifications();
        
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
      }
    }, [userId]);

    const formatTimeAgo = (date) => {
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      return date.toLocaleDateString();
    };
  
    const handleNotificationClick = async (id) => {
      // Mark as read in backend
      try {
        await markNotificationAsRead(userId, id);
        
        // Update local state
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === id ? { ...notif, unread: false } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Navigate if actionUrl exists
        const notification = notifications.find(n => n.id === id);
        if (notification?.actionUrl) {
          window.location.href = notification.actionUrl;
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    };
  
    const closeNotificationSidebar = () => {
      setNotificationSidebarActive(false);
    };

    const handleLogout = () => {
      // Close dropdown first
      setUserDropdownActive(false);
      // Show logout confirmation modal
      setShowLogoutModal(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    };

    const confirmLogout = () => {
      // Clear user data from localStorage
      localStorage.removeItem('currentUser');
      localStorage.removeItem('user');
      
      // Close modal
      setShowLogoutModal(false);
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Navigate to login page
      navigate('/login');
    };

    const cancelLogout = () => {
      setShowLogoutModal(false);
      // Restore body scroll
      document.body.style.overflow = '';
    };
  
    const isActive = (path) => location.pathname === path;
  return (
    <div className='dashboard-container'>
        
         {/* Top Navigation */}
      <nav className="topnav">
        <div className="nav-left">
          <div className="logo-nav">
            <img src="../imgs/SpireWorksLogo.png" alt="SpireWorks Logo" />
            <h1>SpireWorks</h1>
          </div>
        </div>
        <div className="nav-right">
          <div className="nav-icon" onClick={() => setNotificationSidebarActive(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 5a5 5 0 0 1 5 5v2l1.5 3H3.5L5 12v-2a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 17a2 2 0 1 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
          <div className="user-menu" onClick={() => setUserDropdownActive(!userDropdownActive)}>
            {userData?.avatar ? (
              <div className="user-avatar" style={{ 
                background: 'transparent',
                overflow: 'hidden',
                padding: 0
              }}>
                <img 
                  src={`/imgs/${userData.avatar}`} 
                  alt="Profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    // Fallback to initials if image fails
                    e.target.style.display = 'none';
                    const parent = e.target.parentElement;
                    parent.textContent = getAvatarInitials();
                    parent.style.background = 'var(--gradient-1)';
                    parent.style.display = 'flex';
                    parent.style.alignItems = 'center';
                    parent.style.justifyContent = 'center';
                  }}
                />
              </div>
            ) : (
              <div className="user-avatar">{getAvatarInitials()}</div>
            )}
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role">{userRole}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* User Dropdown */}
          <div className={`user-dropdown ${userDropdownActive ? 'active' : ''}`}>
            <a href="#" className="dropdown-item" onClick={(e) => { e.preventDefault(); setUserDropdownActive(false); navigate('/profile'); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>View Profile</span>
            </a>
            <a href="#" className="dropdown-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m5.66-15.66l-4.24 4.24m0 6.84l-4.24 4.24M23 12h-6m-6 0H1m18.36-5.66l-4.24 4.24m0 6.84l-4.24 4.24"></path>
              </svg>
              <span>Settings</span>
            </a>
            <a href="#" className="dropdown-item logout" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Notification Sidebar */}
      <div className={`notification-sidebar ${notificationSidebarActive ? 'active' : ''}`}>
        <div className="notification-header">
          <h3>Notifications</h3>
          <button className="close-notification" onClick={closeNotificationSidebar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="notification-list">
          {isLoadingNotifications ? (
            <div className="notification-loading">
              <div className="spinner-small"></div>
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications yet</p>
              <span>You'll see updates here when you start studying!</span>
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id}
                className={`notification-item ${notif.unread ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notif.id)}
              >
                <div className={`notification-icon ${notif.type}`}>
                  {notif.icon ? (
                    <span style={{ fontSize: '18px' }}>{notif.icon}</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
                    </svg>
                  )}
                </div>
                <div className="notification-content">
                  <div className="notification-title">{notif.title}</div>
                  <div className="notification-text">{notif.text}</div>
                  <div className="notification-time">{notif.time}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notification Overlay */}
      {notificationSidebarActive && (
        <div className="notification-overlay" onClick={closeNotificationSidebar}></div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={cancelLogout}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-header">
              <div className="logout-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </div>
              <h3>Confirm Logout</h3>
            </div>
            <div className="logout-modal-body">
              <p>Are you sure you want to log out?</p>
              <p className="logout-modal-hint">You'll need to log in again to access your account.</p>
            </div>
            <div className="logout-modal-actions">
              <button className="logout-btn-cancel" onClick={cancelLogout}>
                Cancel
              </button>
              <button className="logout-btn-confirm" onClick={confirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <Link to="/student-dashboard" className={`menu-item ${isActive('/student-dashboard') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3V17H17" />
              <path d="M5 13L9 9L12 12L17 7" />
            </svg>
          </span>
          <span className="menu-text">Dashboard</span>
        </Link>
        <Link to="/study-timer" className={`menu-item ${isActive('/study-timer') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 6V10L13 11" />
            </svg>
          </span>
          <span className="menu-text">Study Timer</span>
        </Link>
        <Link to="/solo-practice" className={`menu-item ${isActive('/solo-practice') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
              <path d="M2 17L12 22L22 17"/>
              <path d="M2 12L12 17L22 12"/>
            </svg>
          </span>
          <span className="menu-text">Practice</span>
        </Link>
        <Link to="/my-files" className={`menu-item ${isActive('/my-files') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V16C4 17.1046 4.89543 18 6 18H14C15.1046 18 16 17.1046 16 16V4C16 2.89543 15.1046 2 14 2Z" />
            </svg>
          </span>
          <span className="menu-text">My Files</span>
        </Link>
        <Link to="/group-study" className={`menu-item ${isActive('/group-study') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <span className="menu-text">Group Study</span>
        </Link>
        <Link to="/achievements" className={`menu-item ${isActive('/achievements') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 18L5 15L3 7L10 2L17 7L15 15L10 18Z" />
              <path d="M8 10L10 12L13 9" />
            </svg>
          </span>
          <span className="menu-text">Achievements</span>
        </Link>
        <Link to="/productivity-tracker" className={`menu-item ${isActive('/productivity-tracker') ? 'active' : ''}`}>
          <span className="menu-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 13V17M7 10V17M13 7V17M3 17H17" />
            </svg>
          </span>
          <span className="menu-text">Productivity Tracker</span>
        </Link>
      </aside>
    </div>
  )
}

export default Sidebar