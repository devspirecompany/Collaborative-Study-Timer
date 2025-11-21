import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';

const ReviewerStudy = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reviewer = location.state?.reviewer;

  // Redirect to Study Timer with reviewer selected
  useEffect(() => {
    if (reviewer) {
      // Redirect to study timer and pass reviewer via state
      navigate('/study-timer', { 
        state: { 
          selectedReviewer: reviewer,
          autoStart: true 
        },
        replace: true 
      });
    } else {
      // No reviewer, go to study timer anyway
      navigate('/study-timer', { replace: true });
    }
  }, [reviewer, navigate]);

  // Show loading while redirecting
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Redirecting to Study Timer...</p>
        </div>
      </main>
    </div>
  );
};

export default ReviewerStudy;
