import React from 'react';
import '../../styles/TutorialModal.css';

const TutorialModal = ({ isOpen, onClose, tutorial }) => {
  if (!isOpen || !tutorial) return null;

  return (
    <div className="tutorial-modal-overlay" onClick={onClose}>
      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-modal-header">
          <div className="tutorial-icon">{tutorial.icon}</div>
          <h2>{tutorial.title}</h2>
          <button className="tutorial-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="tutorial-modal-body">
          <p className="tutorial-description">{tutorial.description}</p>

          <div className="tutorial-steps">
            {tutorial.steps.map((step, index) => (
              <div key={index} className="tutorial-step">
                <div className="step-number">{index + 1}</div>
                <div className="step-content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {step.hint && (
                    <div className="step-hint">
                      <span className="hint-icon">💡</span>
                      <span>{step.hint}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {tutorial.tips && tutorial.tips.length > 0 && (
            <div className="tutorial-tips">
              <h3>💡 Pro Tips</h3>
              <ul>
                {tutorial.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="tutorial-modal-footer">
          <button className="tutorial-btn-primary" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;

