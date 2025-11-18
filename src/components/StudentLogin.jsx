import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/StudentLogin.css'; // fixed path

const StudentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const showNotification = (message, type = 'info') => {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    Object.assign(notification.style, {
      position: 'fixed',
      top: '2rem',
      right: '2rem',
      padding: '1rem 1.5rem',
      borderRadius: '0.75rem',
      fontSize: '0.95rem',
      fontWeight: '500',
      zIndex: '1000',
      animation: 'slideIn 0.3s ease',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(10px)',
    });

    if (type === 'success') {
      notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      notification.style.color = 'white';
    } else if (type === 'error') {
      notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      notification.style.color = 'white';
    } else {
      notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
      notification.style.color = 'white';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }

    if (password.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
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
        
        showNotification('Login successful! Redirecting to SpireWorks...', 'success');
        setTimeout(() => {
          navigate('/student-dashboard');
        }, 1200);
      } else {
        showNotification(data.message || 'Invalid email or password', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        showNotification('Connection timeout. Please make sure the backend server is running on port 5000.', 'error');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        showNotification('Cannot connect to server. Please make sure the backend server is running.', 'error');
      } else {
        showNotification(error.message || 'Error logging in. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    showNotification('Password reset link will be sent to your email', 'info');
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

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0);     opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default StudentLogin;