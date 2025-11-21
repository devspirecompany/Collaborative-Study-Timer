import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/StudentLogin.css';
import '../styles/StudentRegistration.css'; // Import mo lang yung CSS

const StudentRegistration = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState('');
  const navigate = useNavigate();

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length === 0) return 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const getStrengthColor = () => {
    if (passwordStrength === 0) return 'transparent';
    if (passwordStrength < 40) return '#ef4444';
    if (passwordStrength < 70) return '#f59e0b';
    return '#10b981';
  };

  const getStrengthText = () => {
    if (passwordStrength === 0) return 'Password strength';
    if (passwordStrength < 40) return 'Weak password';
    if (passwordStrength < 70) return 'Moderate password';
    return 'Strong password';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName) {
      alert('Please enter your full name');
      return;
    }
    
    if (formData.username.length < 3) {
      alert('Username must be at least 3 characters');
      return;
    }
    
    if (!validateEmail(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (!formData.agreeTerms) {
      alert('Please agree to the Terms of Service');
      return;
    }

    setIsLoading(true);
    
    try {
      // Send registration data to backend
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ User registered successfully:', data.user);
        
        // Save user data to localStorage (auto-login)
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Show success modal
        setRegisteredUsername(data.user.username);
        setShowSuccessModal(true);
        
        // Navigate directly to dashboard after delay
        setTimeout(() => {
          navigate('/student-dashboard');
        }, 2500);
      } else {
        console.error('❌ Registration failed:', data.message);
        alert(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Registration error:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('❌ Cannot connect to backend server!\n\nPlease:\n1. Start the backend: cd server && npm run dev\n2. Make sure it shows: "✅ MongoDB Connected"\n3. Then try registration again.');
      } else {
        alert(`Error creating account: ${error.message}\n\nPlease make sure the backend server is running.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      {/* LEFT SIDE - BRANDING */}
      <div className="register-left">
        <div className="brand-section">
          <div className="logo">
            <h1>SpireWorks</h1>
          </div>
          <p className="tagline">Elevate your study. Amplify your success.</p>
        </div>

        <div className="features">
          <div className="feature-item">
            <div className="feature-icon">⚡</div>
            <div>
              <h3>Get Started in Seconds</h3>
              <p>Quick and easy registration process</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🎯</div>
            <div>
              <h3>Personalized Experience</h3>
              <p>Customized study plans just for you</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔒</div>
            <div>
              <h3>Secure & Private</h3>
              <p>Your data is protected with us</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🌟</div>
            <div>
              <h3>Join the Community</h3>
              <p>Connect with thousands of learners</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="register-right">
        <div className="register-form-wrapper">
          <div className="form-header">
            <h2>Create Your Account</h2>
            <p>Start your productivity journey today</p>
          </div>

          <form className="register-form" onSubmit={handleSubmit}>
            {/* First Name & Last Name */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 18a6 6 0 1 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input 
                    type="text" 
                    id="firstName" 
                    name="firstName" 
                    placeholder="Ash"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 18a6 6 0 1 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input 
                    type="text" 
                    id="lastName" 
                    name="lastName" 
                    placeholder="Quicho"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Username */}
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 5l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  placeholder="student@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="9" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type={showPassword ? "text" : "password"}
                  id="password" 
                  name="password" 
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg className="eye-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 3C5 3 2 10 2 10s3 7 8 7 8-7 8-7-3-7-8-7z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
              <div className="password-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: `${passwordStrength}%`,
                      background: getStrengthColor()
                    }}
                  />
                </div>
                <p className="strength-text" style={{ color: getStrengthColor() }}>
                  {getStrengthText()}
                </p>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="9" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword" 
                  name="confirmPassword" 
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button 
                  type="button" 
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <svg className="eye-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 3C5 3 2 10 2 10s3 7 8 7 8-7 8-7-3-7-8-7z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  id="agreeTerms"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  required
                />
                <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></span>
              </label>
            </div>

            {/* Submit Button */}
            <button type="submit" className="btn-register" disabled={isLoading}>
              <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </form>

          <div className="form-footer">
            <p>Already have an account? <Link to="/login">Login here</Link></p>
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
            <h2>🎉 Account Created Successfully!</h2>
            <p className="welcome-message">Welcome, <strong>{registeredUsername}</strong>!</p>
            <p className="redirect-message">Redirecting to your dashboard...</p>
            <div className="loading-bar">
              <div className="loading-fill"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentRegistration;