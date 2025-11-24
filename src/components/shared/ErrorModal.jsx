import React from 'react';
import '../../styles/ErrorModal.css';

const ErrorModal = ({ isOpen, onClose, title, message, details, type = 'error' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '⚠️';
    }
  };

  const getTitleColor = () => {
    switch(type) {
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'info': return 'var(--primary)';
      default: return 'var(--error)';
    }
  };

  const icon = getIcon();
  const titleColor = getTitleColor();

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className={`error-modal ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="error-modal-header">
          <div className="error-icon" style={{ color: titleColor }}>{icon}</div>
          <h2 style={{ color: titleColor }}>{title || 'Error'}</h2>
          <button className="error-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="error-modal-body">
          <p className="error-message">{message}</p>
          
          {details && (
            <div className="error-details">
              <h3>Details:</h3>
              <ul>
                {Array.isArray(details) ? (
                  details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))
                ) : (
                  <li>{details}</li>
                )}
              </ul>
            </div>
          )}

          {type === 'error' && message && message.includes('GEMINI_API_KEY') && (
            <div className="error-solution">
              <h3>🔧 How to Fix:</h3>
              <ol>
                <li>Navigate to the <code>server</code> directory in your project</li>
                <li>Create or edit the <code>.env</code> file</li>
                <li>Add the following line: <code>GEMINI_API_KEY=your-actual-api-key-here</code></li>
                <li>Replace <code>your-actual-api-key-here</code> with your actual Gemini API key</li>
                <li>Restart the backend server for changes to take effect</li>
              </ol>
              <div className="error-note">
                <strong>Note:</strong> You can get a Gemini API key from{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                  Google AI Studio
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="error-modal-footer">
          <button className="error-btn-primary" onClick={onClose}>
            {type === 'success' ? 'Got it!' : 'Understood'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;

