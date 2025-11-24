import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorModal from './shared/ErrorModal.jsx';
import '../styles/StudentLogin.css'; // fixed path
import '../styles/ErrorModal.css'; // For error modal styles

const StudentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', details: null, type: 'error' });
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setErrorModal({
        isOpen: true,
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
        details: null,
        type: 'error'
      });
      return;
    }

    if (password.length < 6) {
      setErrorModal({
        isOpen: true,
        title: 'Invalid Password',
        message: 'Password must be at least 6 characters',
        details: null,
        type: 'error'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Send login data to backend with timeout
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Save user data to localStorage
        if (rememberMe) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Show success modal
        setLoggedInUsername(data.user.username || data.user.firstName);
        setShowSuccessModal(true);
        
        setTimeout(() => {
          navigate('/student-dashboard');
        }, 2500);
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Login Failed',
          message: data.message || 'Invalid email or password',
          details: null,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        setErrorModal({
          isOpen: true,
          title: 'Connection Timeout',
          message: 'Connection timeout. Please make sure the backend server is running on port 5000.',
          details: null,
          type: 'error'
        });
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setErrorModal({
          isOpen: true,
          title: 'Connection Error',
          message: 'Cannot connect to server. Please make sure the backend server is running.',
          details: null,
          type: 'error'
        });
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Login Error',
          message: error.message || 'Error logging in. Please try again.',
          details: null,
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setErrorModal({
      isOpen: true,
      title: 'Password Reset',
      message: 'Password reset link will be sent to your email',
      details: null,
      type: 'info'
    });
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand-section">
          <div className="logo">
            <img src="/imgs/SpireWorksLogo.png" alt="SpireWorks Logo" className="logo-img" />
            <h1>SpireWorks</h1>
          </div>
          <p className="tagline">Elevate your study. Amplify your success.</p>
        </div>

        <div className="features">
          <div className="feature-item">
            <div className="feature-icon">⏱️</div>
            <div>
              <h3>Smart Timer Sessions</h3>
              <p>Personalized study and break intervals</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">👥</div>
            <div>
              <h3>Collaborative Study</h3>
              <p>Join groups and track progress together</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🏆</div>
            <div>
              <h3>Achievements & Rewards</h3>
              <p>Earn badges as you reach your goals</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🤖</div>
            <div>
              <h3>AI Study Tools</h3>
              <p>Generate summaries and practice questions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="form-header">
            <h2>Welcome Back!</h2>
            <p>Login to continue your learning journey</p>
          </div>

          <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M3 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 5l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="student@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <rect x="4" y="9" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <svg
                    className="eye-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    style={{ opacity: showPassword ? '1' : '0.6' }}
                    aria-hidden
                  >
                    <path d="M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 3C5 3 2 10 2 10s3 7 8 7 8-7 8-7-3-7-8-7z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-password" onClick={handleForgotPassword}>
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="btn-login"
              disabled={isLoading}
              style={{ opacity: isLoading ? '0.7' : '1' }}
            >
              <span>{isLoading ? 'Logging in...' : 'Login'}</span>
              {!isLoading && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </form>

          <div className="form-footer">
            <p>Don't have an account? <Link to="/register">Sign up now</Link></p>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="modal-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" fill="#10b981" fillOpacity="0.1"/>
                <circle cx="32" cy="32" r="24" fill="#10b981" fillOpacity="0.2"/>
                <path d="M20 32l8 8 16-16" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>✨ Login Successful!</h2>
            <p className="welcome-message">Welcome back, <strong>{loggedInUsername}</strong>!</p>
            <p className="redirect-message">Redirecting to your dashboard...</p>
            <div className="loading-bar">
              <div className="loading-fill"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error/Info Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '', details: null, type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        type={errorModal.type}
      />
    </div>
  );
};

export default StudentLogin;