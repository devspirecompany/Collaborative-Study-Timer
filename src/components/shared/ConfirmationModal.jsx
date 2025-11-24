import React from 'react';
import '../../styles/ConfirmationModal.css';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'danger': return '⚠️';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  };

  const getTitleColor = () => {
    switch(type) {
      case 'danger': return 'var(--error)';
      case 'warning': return 'var(--warning)';
      case 'info': return 'var(--primary)';
      default: return 'var(--text-primary)';
    }
  };

  const icon = getIcon();
  const titleColor = getTitleColor();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="confirmation-modal-overlay" onClick={onClose}>
      <div className={`confirmation-modal ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-modal-header">
          <div className="confirmation-icon" style={{ color: titleColor }}>{icon}</div>
          <h2 style={{ color: titleColor }}>{title || 'Confirm Action'}</h2>
          <button className="confirmation-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="confirmation-modal-body">
          <p className="confirmation-message">{message}</p>
        </div>

        <div className="confirmation-modal-footer">
          <button className="confirmation-btn-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button className={`confirmation-btn-confirm ${type}`} onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

