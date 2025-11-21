import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getRecommendedStudyDuration } from '../services/aiService';
import { createStudySession, getFiles, getFolders, getReviewers } from '../services/apiService';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const StudentStudyTimer = () => {
  const location = useLocation();
  // Timer State
  const [timerInterval, setTimerInterval] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMode, setCurrentMode] = useState('study');
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [totalTimeForSession, setTotalTimeForSession] = useState(25 * 60);
  const [aiRecommendedMinutes, setAiRecommendedMinutes] = useState(25);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiMethod, setAiMethod] = useState('algorithm');

  // Session tracking
  const [sessionCount, setSessionCount] = useState(0);
  const [totalStudyTimeToday, setTotalStudyTimeToday] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [recentSessions, setRecentSessions] = useState([]);
  const [userId] = useState('demo-user'); // In production, get from auth context

  // Settings
  const [autoStartBreak, setAutoStartBreak] = useState(true);
  const [autoStartStudy, setAutoStartStudy] = useState(false);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [hasCompletedStudySession, setHasCompletedStudySession] = useState(false);
  const [suggestBreak, setSuggestBreak] = useState(false);
  
  // Reviewer selection for study
  const [showReviewerSelectionModal, setShowReviewerSelectionModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(location.state?.selectedReviewer || null);
  const [isLoadingReviewers, setIsLoadingReviewers] = useState(false);
  const navigate = useNavigate();
  
  // Notification Modal States
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('error'); // 'success' or 'error'
  
  // Confirmation Modal States
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationOnConfirm, setConfirmationOnConfirm] = useState(null);
  const [confirmationOnCancel, setConfirmationOnCancel] = useState(null);

  // Handle reviewer from redirect (from ReviewerStudy or MyFiles)
  useEffect(() => {
    if (location.state?.selectedReviewer) {
      setSelectedReviewer(location.state.selectedReviewer);
      // Auto-start if requested
      if (location.state.autoStart) {
        setTimeout(() => {
          setIsRunning(true);
        }, 500);
      }
      // Clear state to prevent re-applying on re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Mode configurations (AI will determine study duration, but we keep break options)
  const modeConfig = {
    study: {
      label: 'Focus Time',
      color: '#3b82f6'
    },
    break: {
      durations: [5, 10, 15],
      defaultIndex: 0,
      label: 'Short Break',
      color: '#10b981'
    },
    longbreak: {
      durations: [15, 20, 30],
      defaultIndex: 0,
      label: 'Long Break',
      color: '#0ea5e9'
    }
  };

  const [currentDurationIndex, setCurrentDurationIndex] = useState(0);

  // Refs for SVG circles
  const progressCircleRef = useRef(null);
  const dailyProgressCircleRef = useRef(null);
  const lastSavedTimeRef = useRef(0);
  const sessionStartTimeRef = useRef(null);

  // Clean up review content - remove markdown
  const cleanContent = (content) => {
    if (!content) return '';
    return content
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\n{3,}/g, '\n\n'); // Clean up extra newlines
  };

  // Get AI recommendation for study duration
  useEffect(() => {
    const fetchRecommendation = async () => {
      if (currentMode === 'study' && !isRunning) {
        setIsLoadingRecommendation(true);
        const studyData = {
          hoursStudiedToday: totalStudyTimeToday / 3600,
          sessionCount: completedSessions,
          averageSessionLength: completedSessions > 0 ? (totalStudyTimeToday / completedSessions) / 60 : 25,
          timeOfDay: new Date().getHours(),
          fatigueLevel: completedSessions >= 4 ? 1 : 0
        };
        
        try {
          const recommendation = await getRecommendedStudyDuration(studyData);
          // Handle both old format (number) and new format (object)
          let minutes = typeof recommendation === 'object' ? recommendation.minutes : recommendation;
          const insights = typeof recommendation === 'object' ? recommendation.insights : null;
          const method = typeof recommendation === 'object' ? recommendation.method : 'algorithm';
          
          // Validate minutes - ensure it's a valid number
          if (!minutes || isNaN(minutes) || minutes <= 0) {
            console.warn('Invalid AI recommendation, using fallback: 25 minutes');
            minutes = 25; // Default fallback
          }
          
          // Ensure minutes is within reasonable bounds (5-60 minutes)
          minutes = Math.max(5, Math.min(60, Math.round(minutes)));
          
          setAiRecommendedMinutes(minutes);
          setAiInsights(insights);
          setAiMethod(method);
          const newTime = minutes * 60;
          setTimeRemaining(newTime);
          setTotalTimeForSession(newTime);
          updateProgressRing(newTime, newTime);
        } catch (error) {
          console.error('Error fetching AI recommendation:', error);
          // Use safe fallback values
          const fallbackMinutes = 25;
          setAiRecommendedMinutes(fallbackMinutes);
          setAiInsights('Using default recommendation due to connection issue.');
          setAiMethod('algorithm');
          const newTime = fallbackMinutes * 60;
          setTimeRemaining(newTime);
          setTotalTimeForSession(newTime);
          updateProgressRing(newTime, newTime);
        } finally {
          setIsLoadingRecommendation(false);
        }
      }
    };
    
    fetchRecommendation();
  }, [currentMode, completedSessions, totalStudyTimeToday]);

  // Initialize timer on mount and mode change (for breaks)
  useEffect(() => {
    if (currentMode !== 'study') {
      const durations = modeConfig[currentMode].durations;
      const newTime = durations[currentDurationIndex] * 60;
      setTimeRemaining(newTime);
      setTotalTimeForSession(newTime);
      updateProgressRing(newTime, newTime);
    }
  }, [currentMode, currentDurationIndex]);

  // Auto-save study session every 60 seconds
  const saveStudySession = async (duration) => {
    if (!selectedReviewer || currentMode !== 'study') return;
    
    try {
      await createStudySession({
        userId,
        duration: duration,
        mode: 'study',
        aiRecommended: false,
        studyData: {
          reviewerId: selectedReviewer?.id || selectedReviewer?._id,
          reviewerName: selectedReviewer?.name || selectedReviewer?.fileName,
          subject: selectedReviewer?.subject,
          timeElapsed: duration,
          sessionStartTime: sessionStartTimeRef.current,
          hoursStudiedToday: totalStudyTimeToday / 3600,
          sessionCount: completedSessions,
          averageSessionLength: completedSessions > 0 ? (totalStudyTimeToday / completedSessions) / 60 : 25,
          timeOfDay: new Date().getHours(),
          fatigueLevel: completedSessions >= 4 ? 1 : 0
        }
      });
    } catch (error) {
      console.error('Error auto-saving study session:', error);
    }
  };

  // Timer interval effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      // Set session start time when timer starts
      if (!sessionStartTimeRef.current) {
        sessionStartTimeRef.current = new Date();
      }

      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            completeSession();
            return 0;
          }
          
          // Auto-save every 60 seconds
          const elapsed = totalTimeForSession - (prev - 1);
          if (elapsed > 0 && elapsed - lastSavedTimeRef.current >= 60) {
            saveStudySession(elapsed);
            lastSavedTimeRef.current = elapsed;
          }
          
          return prev - 1;
        });
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else {
      // Reset refs when timer stops
      if (!isRunning) {
        sessionStartTimeRef.current = null;
        lastSavedTimeRef.current = 0;
      }
    }
  }, [isRunning, timeRemaining, totalTimeForSession, selectedReviewer, currentMode]);

  // Update progress ring whenever time changes
  useEffect(() => {
    updateProgressRing(timeRemaining, totalTimeForSession);
  }, [timeRemaining, totalTimeForSession]);

  // Update daily progress ring
  useEffect(() => {
    const goalSeconds = 4 * 3600;
    const progressPercent = Math.min(100, (totalStudyTimeToday / goalSeconds) * 100);
    updateDailyProgressRing(progressPercent);
  }, [totalStudyTimeToday]);

  // Setup progress circle on mount
  useEffect(() => {
    setupProgressCircle();
  }, []);

  const setupProgressCircle = () => {
    if (progressCircleRef.current) {
      const radius = 140;
      const circumference = radius * 2 * Math.PI;
      progressCircleRef.current.style.strokeDasharray = `${circumference} ${circumference}`;
      progressCircleRef.current.style.strokeDashoffset = circumference;
    }
  };

  const updateProgressRing = (remaining, total) => {
    if (progressCircleRef.current) {
      const radius = 140;
      const circumference = radius * 2 * Math.PI;
      const percent = remaining / total;
      const offset = circumference - (percent * circumference);
      progressCircleRef.current.style.strokeDashoffset = offset;
    }
  };

  const updateDailyProgressRing = (percent) => {
    if (dailyProgressCircleRef.current) {
      const radius = 60;
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - ((percent / 100) * circumference);
      dailyProgressCircleRef.current.style.strokeDasharray = `${circumference} ${circumference}`;
      dailyProgressCircleRef.current.style.strokeDashoffset = offset;
    }
  };

  // Notification helper function
  const showNotificationModal = (message, type = 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  // Confirmation modal helper function
  const showConfirmationModalPrompt = (message, onConfirm, onCancel = null) => {
    setConfirmationMessage(message);
    setConfirmationOnConfirm(() => onConfirm);
    setConfirmationOnCancel(() => onCancel);
    setShowConfirmationModal(true);
  };

  const handleConfirmationConfirm = () => {
    setShowConfirmationModal(false);
    if (confirmationOnConfirm) {
      confirmationOnConfirm();
    }
    // Clear callbacks
    setConfirmationOnConfirm(null);
    setConfirmationOnCancel(null);
  };

  const handleConfirmationCancel = () => {
    setShowConfirmationModal(false);
    if (confirmationOnCancel) {
      confirmationOnCancel();
    }
    // Clear callbacks
    setConfirmationOnConfirm(null);
    setConfirmationOnCancel(null);
  };

  const switchMode = (mode) => {
    // Prevent switching to break modes if no study session completed
    if (mode !== 'study' && !hasCompletedStudySession && mode !== currentMode) {
      showNotificationModal('Please complete a study session first before taking a break!', 'error');
      return;
    }

    // Allow mode switching even when running, but pause first
    if (isRunning) {
      showConfirmationModalPrompt(
        'Switch mode? The current timer will be paused.',
        () => {
          pauseTimer();
          setCurrentMode(mode);
          if (mode !== 'study') {
            setCurrentDurationIndex(modeConfig[mode].defaultIndex || 0);
          }
          setSuggestBreak(false); // Clear break suggestion when manually switching
        }
      );
      return;
    } else {
      setCurrentMode(mode);
      if (mode !== 'study') {
        setCurrentDurationIndex(modeConfig[mode].defaultIndex || 0);
      }
      setSuggestBreak(false); // Clear break suggestion when manually switching
    }
  };

  const setTimerDuration = (minutes) => {
    if (!isRunning && currentMode !== 'study') {
      const durations = modeConfig[currentMode].durations;
      const index = durations.indexOf(minutes);
      setCurrentDurationIndex(index);
      const newTime = minutes * 60;
      setTimeRemaining(newTime);
      setTotalTimeForSession(newTime);
    }
  };

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('studyTimer')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  // Fetch files and folders for file selection
  useEffect(() => {
    if (showReviewerSelectionModal) {
      // Always fetch fresh data when modal opens
      fetchReviewersAndFiles();
    }
  }, [showReviewerSelectionModal]);
  
  // Also fetch when component mounts to have data ready
  useEffect(() => {
    // Pre-fetch reviewers and files so they're ready when modal opens
    fetchReviewersAndFiles();
  }, []);

  const fetchReviewersAndFiles = async () => {
    // Only show loading if modal is open
    if (showReviewerSelectionModal) {
      setIsLoadingReviewers(true);
    }
    try {
      console.log('🔄 Fetching reviewers and files for userId:', userId);
      
      // Fetch AI-generated reviewers
      const reviewersResponse = await getReviewers(userId);
      console.log('📚 Reviewers response:', reviewersResponse);
      const reviewersList = reviewersResponse.success ? reviewersResponse.reviewers || [] : [];
      
      // Fetch uploaded files (these can also be used as reviewers)
      const filesResponse = await getFiles(userId);
      console.log('📁 Files response:', filesResponse);
      const filesList = filesResponse.success ? filesResponse.files || [] : [];
      
      console.log(`✅ Found ${reviewersList.length} reviewers and ${filesList.length} files`);
      
      // Combine reviewers and files
      const allReviewers = [
        // AI-generated reviewers (have reviewContent)
        ...reviewersList.map(r => ({
          id: r._id || r.id,
          name: r.fileName,
          subject: r.subject,
          type: 'ai-generated',
          reviewContent: r.reviewContent,
          keyPoints: r.keyPoints || [],
          createdAt: r.createdAt,
          hasContent: true
        })),
        // Uploaded files (can be used as reviewers)
        ...filesList.map(f => ({
          id: f._id,
          name: f.fileName,
          subject: f.subject,
          type: f.fileType,
          content: f.fileContent,
          createdAt: f.createdAt,
          hasContent: !!f.fileContent && f.fileContent.length > 50
        }))
      ];
      
      console.log(`📊 Total reviewers/files: ${allReviewers.length}`);
      
      // Group by subject
      const groupedBySubject = {};
      allReviewers.forEach(reviewer => {
        if (!groupedBySubject[reviewer.subject]) {
          groupedBySubject[reviewer.subject] = [];
        }
        groupedBySubject[reviewer.subject].push(reviewer);
      });
      
      console.log('📂 Grouped by subject:', Object.keys(groupedBySubject));
      
      setReviewers(groupedBySubject);
      setFiles(filesList);
    } catch (error) {
      console.error('❌ Error fetching reviewers:', error);
      console.error('Error details:', error.message, error.stack);
      
      // Don't show error alert - just log and continue with empty data
      // The API should return success with empty array even on errors
      setReviewers({});
      setFiles([]);
      
      // Only show error if it's a network/server error (not just empty results)
      if (showReviewerSelectionModal && error.message && !error.message.includes('empty')) {
        console.warn('⚠️ Error fetching data, but continuing with empty list');
      }
    } finally {
      if (showReviewerSelectionModal) {
        setIsLoadingReviewers(false);
      }
    }
  };

  const handleReviewerSelect = (reviewer) => {
    setSelectedReviewer(reviewer);
    setShowReviewerSelectionModal(false);
    // Reset session tracking when new reviewer is selected
    sessionStartTimeRef.current = null;
    lastSavedTimeRef.current = 0;
    // Start the timer
    setTimeout(() => {
      setIsRunning(true);
    }, 300);
  };

  const startTimer = () => {
    // If study mode and no reviewer selected, scroll to file selection with vertigo effect
    if (currentMode === 'study' && !selectedReviewer && !isRunning && timeRemaining > 0) {
      const fileSelectionCard = document.querySelector('.reviewer-selection-card');
      if (fileSelectionCard) {
        // Add vertigo effect class
        fileSelectionCard.classList.add('vertigo-effect');
        
        // Scroll to the file selection card
        fileSelectionCard.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Remove vertigo effect after animation completes
        setTimeout(() => {
          fileSelectionCard.classList.remove('vertigo-effect');
        }, 1000);
      }
      return;
    }
    
    // If reviewer is selected or break mode, start immediately
    if (!isRunning && timeRemaining > 0) {
      setIsRunning(true);
    }
  };

  const pauseTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      if (timerInterval) clearInterval(timerInterval);
    }
  };

  const resetTimer = () => {
    pauseTimer();
    if (currentMode === 'study') {
      // Reset to AI recommended time
      const minutes = aiRecommendedMinutes && !isNaN(aiRecommendedMinutes) ? aiRecommendedMinutes : 25;
      const newTime = minutes * 60;
      setTimeRemaining(newTime);
      setTotalTimeForSession(newTime);
      updateProgressRing(newTime, newTime);
    } else {
      const durations = modeConfig[currentMode].durations;
      const newTime = durations[currentDurationIndex] * 60;
      setTimeRemaining(newTime);
      setTotalTimeForSession(newTime);
      updateProgressRing(newTime, newTime);
    }
  };

  const skipSession = () => {
    pauseTimer();
    completeSession();
  };

  const completeSession = async () => {
    pauseTimer();

    if (currentMode === 'study') {
      setSessionCount(prev => prev + 1);
      setCompletedSessions(prev => prev + 1);
      setTotalStudyTimeToday(prev => prev + totalTimeForSession);
      setCurrentStreak(prev => prev + 1);
      addRecentSession('Study Session', totalTimeForSession);
      setHasCompletedStudySession(true); // Mark that study session is completed

      // Save session to backend
      try {
        await createStudySession({
          userId,
          duration: totalTimeForSession,
          mode: 'study',
          aiRecommended: true,
          aiRecommendedDuration: aiRecommendedMinutes,
          studyData: {
            reviewerId: selectedReviewer?.id || selectedReviewer?._id,
            reviewerName: selectedReviewer?.name || selectedReviewer?.fileName,
            subject: selectedReviewer?.subject,
            hoursStudiedToday: (totalStudyTimeToday + totalTimeForSession) / 3600,
            sessionCount: completedSessions + 1,
            averageSessionLength: ((totalStudyTimeToday + totalTimeForSession) / (completedSessions + 1)) / 60,
            timeOfDay: new Date().getHours(),
            fatigueLevel: completedSessions >= 4 ? 1 : 0
          }
        });
      } catch (error) {
        console.error('Error saving session:', error);
      }

      // Auto-switch to break mode after study session
      if (autoStartBreak) {
        setTimeout(() => {
          setSuggestBreak(true);
          switchMode('break');
          // Reset break timer to selected duration
          const durations = modeConfig['break'].durations;
          const breakTime = durations[currentDurationIndex] * 60;
          setTimeRemaining(breakTime);
          setTotalTimeForSession(breakTime);
          updateProgressRing(breakTime, breakTime);
          
          // Auto-start break timer
          setTimeout(() => {
            setIsRunning(true);
          }, 1000);
        }, 2000);
      } else {
        // Show break suggestion even if auto-start is off
        setSuggestBreak(true);
        switchMode('break');
        // Reset break timer
        const durations = modeConfig['break'].durations;
        const breakTime = durations[currentDurationIndex] * 60;
        setTimeRemaining(breakTime);
        setTotalTimeForSession(breakTime);
        updateProgressRing(breakTime, breakTime);
      }
    } else {
      // Break completed - switch back to study mode
      addRecentSession(currentMode === 'break' ? 'Short Break' : 'Long Break', totalTimeForSession);
      setSuggestBreak(false);
      
      // Auto-start next study session if enabled
      if (autoStartStudy) {
        setTimeout(() => {
          switchMode('study');
          // Reset to AI recommended time for next study session
          const minutes = aiRecommendedMinutes && !isNaN(aiRecommendedMinutes) ? aiRecommendedMinutes : 25;
          const newTime = minutes * 60;
          setTimeRemaining(newTime);
          setTotalTimeForSession(newTime);
          updateProgressRing(newTime, newTime);
          
          // Show reviewer selection again for next study session
          setTimeout(() => {
            setShowReviewerSelectionModal(true);
          }, 1000);
        }, 2000);
      } else {
        // Reset to study mode but don't auto-start
        switchMode('study');
        const minutes = aiRecommendedMinutes && !isNaN(aiRecommendedMinutes) ? aiRecommendedMinutes : 25;
        const newTime = minutes * 60;
        setTimeRemaining(newTime);
        setTotalTimeForSession(newTime);
        updateProgressRing(newTime, newTime);
      }
    }

    showCompletionNotification();
  };

  const addRecentSession = (type, duration) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const minutes = Math.floor(duration / 60);

    const newSession = {
      type,
      time: timeStr,
      duration: minutes,
      isBreak: type.includes('Break')
    };

    setRecentSessions(prev => [newSession, ...prev].slice(0, 5));
  };

  const showCompletionNotification = () => {
    const modeLabel = modeConfig[currentMode].label;

    if (soundNotifications) {
      playNotificationSound();
    }

    if (desktopNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('SpireWorks Study Timer', {
        body: `${modeLabel} completed!`,
        icon: '../imgs/SpireWorksLogo.png'
      });
    }
  };

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const formatTime = (seconds) => {
    // Handle NaN, undefined, or invalid values
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getDailyProgressPercent = () => {
    const goalSeconds = 4 * 3600;
    return Math.min(100, Math.round((totalStudyTimeToday / goalSeconds) * 100));
  };

  return (
    <div>
     <Sidebar/>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Study Timer</h1>
            <p className="page-subtitle">Focus, track progress, and achieve your study goals</p>
          </div>
        </div>

        {/* Reviewer Selection Card - Prominent at Top */}
        {currentMode === 'study' && (
          <div className="reviewer-selection-card">
            {!selectedReviewer ? (
              <div className="reviewer-selection-empty">
                <div className="reviewer-selection-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div className="reviewer-selection-content">
                  <h3>Select Study Material</h3>
                  <p>Choose a reviewer or file to study with</p>
                </div>
                <button 
                  className="reviewer-select-btn"
                  onClick={() => setShowReviewerSelectionModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Select File
                </button>
              </div>
            ) : (
              <div className="reviewer-selection-active">
                <div className="reviewer-selection-info">
                  <div className="reviewer-selection-icon-small">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="reviewer-selection-details">
                    <h3>{selectedReviewer.name || selectedReviewer.fileName}</h3>
                    <p>{selectedReviewer.subject || 'Study Material'}</p>
                  </div>
                </div>
                <button 
                  className="reviewer-change-btn"
                  onClick={() => setShowReviewerSelectionModal(true)}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        <div className="timer-container">
          <div className="timer-main-card">
            {/* Mode Selector */}
            <div className="timer-mode-selector">
              <button
                className={`mode-btn ${currentMode === 'study' ? 'active' : ''}`}
                onClick={() => switchMode('study')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  <path d="M8 7h6"></path>
                  <path d="M8 11h6"></path>
                  <path d="M8 15h4"></path>
                </svg>
                Study
              </button>
              <button
                className={`mode-btn ${currentMode === 'break' ? 'active' : ''} ${!hasCompletedStudySession ? 'disabled' : ''}`}
                onClick={() => switchMode('break')}
                disabled={!hasCompletedStudySession && currentMode !== 'break'}
                title={!hasCompletedStudySession && currentMode !== 'break' ? 'Complete a study session first!' : ''}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V6L18 2H6Z"/>
                  <path d="M3 6H21"/>
                  <path d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10"/>
                </svg>
                Short Break
              </button>
              <button
                className={`mode-btn ${currentMode === 'longbreak' ? 'active' : ''} ${!hasCompletedStudySession ? 'disabled' : ''}`}
                onClick={() => switchMode('longbreak')}
                disabled={!hasCompletedStudySession && currentMode !== 'longbreak'}
                title={!hasCompletedStudySession && currentMode !== 'longbreak' ? 'Complete a study session first!' : ''}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21V7C20 5.89543 19.1046 5 18 5H6C4.89543 5 4 5.89543 4 7V21"/>
                  <path d="M20 5L12 9L4 5"/>
                </svg>
                Long Break
              </button>
            </div>

            {/* Timer Display */}
            <div className="timer-display-section">
              <div className="timer-circle">
                <svg className="timer-progress-ring" width="320" height="320">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e40af" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                  </defs>
                  <circle className="timer-progress-ring-bg" cx="160" cy="160" r="140" />
                  <circle
                    ref={progressCircleRef}
                    className="timer-progress-ring-fill"
                    cx="160"
                    cy="160"
                    r="140"
                  />
                </svg>
                <div className="timer-inner">
                  <div className="timer-display">{formatTime(timeRemaining)}</div>
                  <div className="timer-session-label">{modeConfig[currentMode].label}</div>
                </div>
              </div>
            </div>

            {/* Preset Selector for Break Modes */}
            {currentMode !== 'study' && (
              <div className="break-mode-info">
                <div className="timer-preset-selector">
                  {modeConfig[currentMode].durations.map((minutes, index) => (
                    <button
                      key={minutes}
                      className={`preset-btn ${index === currentDurationIndex ? 'active' : ''}`}
                      onClick={() => setTimerDuration(minutes)}
                      disabled={isRunning}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
                {suggestBreak ? (
                  <div className="break-suggestion-active">
                    🎉 Great work! Take a well-deserved break. Select your break duration above.
                  </div>
                ) : (
                  <div className="break-mode-hint">
                    💡 You can select your break duration above. Switch back to <strong>Study</strong> mode when ready to study again.
                  </div>
                )}
              </div>
            )}


            {/* Controls */}
            <div className="timer-controls-main">
              <button className="control-btn control-btn-secondary" onClick={resetTimer}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Reset
              </button>
              {!isRunning ? (
                <button 
                  className="control-btn control-btn-primary" 
                  onClick={startTimer}
                  disabled={currentMode === 'study' && !selectedReviewer}
                  title={currentMode === 'study' && !selectedReviewer ? 'Please select a file first' : ''}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Start
                </button>
              ) : (
                <button className="control-btn control-btn-primary" onClick={pauseTimer}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause
                </button>
              )}
              <button className="control-btn control-btn-secondary" onClick={skipSession}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 4 15 12 5 20 5 4"></polygon>
                  <line x1="19" y1="5" x2="19" y2="19"></line>
                </svg>
                Skip
              </button>
            </div>

            {/* Session Info */}
            <div className="session-info">
              <div className="info-item">
                <div className="info-label">Session Count</div>
                <div className="info-value">{sessionCount}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Total Today</div>
                <div className="info-value">{formatTotalTime(totalStudyTimeToday)}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Current Goal</div>
                <div className="info-value">4h 0m</div>
              </div>
            </div>

            {/* Reviewer Content Display (shown when reviewer is selected, even before starting) */}
            {selectedReviewer && currentMode === 'study' && (
              <div className="reviewer-content-display" style={{
                marginTop: '2rem',
                padding: '2rem',
                background: 'var(--bg-card)',
                borderRadius: '20px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                maxHeight: '600px',
                overflowY: 'auto',
                border: '1px solid var(--border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid var(--border)'
                }}>
                  <div>
                    <h3 style={{ 
                      margin: 0, 
                      color: 'var(--text-primary)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem',
                      fontSize: '1.25rem',
                      fontWeight: '600'
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {selectedReviewer.name}
                    </h3>
                    <p style={{ 
                      margin: '0.25rem 0 0 0', 
                      color: 'var(--text-secondary)', 
                      fontSize: '0.875rem' 
                    }}>
                      {selectedReviewer.subject}
                    </p>
                  </div>
                  {!isRunning && (
                    <button
                      onClick={() => {
                        setSelectedReviewer(null);
                        setShowReviewerSelectionModal(true);
                      }}
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        padding: '0.5rem 1rem',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(59, 130, 246, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                      }}
                      title="Change reviewer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Change
                    </button>
                  )}
                </div>

                {/* Study Notes Section */}
                {(selectedReviewer.reviewContent || selectedReviewer.content) && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ 
                      marginBottom: '1rem', 
                      color: 'var(--text-primary)', 
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      Study Notes
                    </h4>
                    <div 
                      style={{ 
                        whiteSpace: 'pre-wrap', 
                        lineHeight: '1.8',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        background: 'var(--bg-input)',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {selectedReviewer.reviewContent 
                        ? cleanContent(selectedReviewer.reviewContent)
                        : selectedReviewer.content 
                          ? cleanContent(selectedReviewer.content.substring(0, 5000)) + (selectedReviewer.content.length > 5000 ? '...' : '')
                          : 'No content available'}
                    </div>
                  </div>
                )}

                {/* Key Points Section */}
                {selectedReviewer.keyPoints && selectedReviewer.keyPoints.length > 0 && (
                  <div style={{ 
                    marginTop: '2rem', 
                    paddingTop: '2rem', 
                    borderTop: '2px solid var(--border)' 
                  }}>
                    <h4 style={{ 
                      marginBottom: '1rem', 
                      color: 'var(--text-primary)', 
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10b981' }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      Key Points
                    </h4>
                    <ul style={{ 
                      listStyle: 'none', 
                      padding: 0,
                      background: 'var(--bg-input)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid var(--border)'
                    }}>
                      {selectedReviewer.keyPoints.map((point, idx) => (
                        <li key={idx} style={{ 
                          marginBottom: idx < selectedReviewer.keyPoints.length - 1 ? '1rem' : '0', 
                          paddingLeft: '2rem',
                          position: 'relative',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                          lineHeight: '1.6'
                        }}>
                          <span style={{ 
                            position: 'absolute', 
                            left: '0.5rem', 
                            top: '0.25rem',
                            background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                            color: 'white',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                          }}>
                            {idx + 1}
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="timer-sidebar">
            {/* Today's Progress */}
            <div className="card quick-stats">
              <h3 className="card-title-small">Today's Progress</h3>
              <div className="progress-ring-container">
                <svg className="progress-ring-small" width="140" height="140">
                  <circle className="progress-ring-bg-small" cx="70" cy="70" r="60" />
                  <circle
                    ref={dailyProgressCircleRef}
                    className="progress-ring-fill-small"
                    cx="70"
                    cy="70"
                    r="60"
                  />
                </svg>
                <div className="progress-ring-text">
                  <div className="progress-percentage">{getDailyProgressPercent()}%</div>
                  <div className="progress-label-small">of 4h goal</div>
                </div>
              </div>
              <div className="stats-mini">
                <div className="stat-mini">
                  <div className="stat-mini-value">{completedSessions}</div>
                  <div className="stat-mini-label">Completed</div>
                </div>
                <div className="stat-mini">
                  <div className="stat-mini-value">{currentStreak}</div>
                  <div className="stat-mini-label">Streak</div>
                </div>
              </div>
            </div>

            {/* Session Settings */}
            <div className="card session-settings">
              <h3 className="card-title-small">Session Settings</h3>
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={autoStartBreak}
                    onChange={(e) => setAutoStartBreak(e.target.checked)}
                  />
                  <span>Auto-start breaks</span>
                </label>
              </div>
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={autoStartStudy}
                    onChange={(e) => setAutoStartStudy(e.target.checked)}
                  />
                  <span>Auto-start study sessions</span>
                </label>
              </div>
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={soundNotifications}
                    onChange={(e) => setSoundNotifications(e.target.checked)}
                  />
                  <span>Sound notifications</span>
                </label>
              </div>
              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={desktopNotifications}
                    onChange={(e) => {
                      setDesktopNotifications(e.target.checked);
                      if (e.target.checked) requestNotificationPermission();
                    }}
                  />
                  <span>Desktop notifications</span>
                </label>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="card recent-sessions">
              <h3 className="card-title-small">Recent Sessions</h3>
              <div className="session-list">
                {recentSessions.length === 0 ? (
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <p>No sessions yet today</p>
                  </div>
                ) : (
                  recentSessions.map((session, index) => (
                    <div key={index} className="session-item">
                      <div className="session-item-left">
                        <div className={`session-icon ${session.isBreak ? 'break' : ''}`}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </div>
                        <div className="session-details">
                          <div className="session-type">{session.type}</div>
                          <div className="session-time">{session.time}</div>
                        </div>
                      </div>
                      <div className="session-duration">{session.duration}m</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reviewer Selection Modal */}
      {showReviewerSelectionModal && (
        <div className="modal-overlay" onClick={() => setShowReviewerSelectionModal(false)}>
          <div className="modal-content file-selection-modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '720px',
            width: '90%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '0'
          }}>
            <div className="modal-header" style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Select Reviewer for Study Session</h2>
              <div className="modal-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={fetchReviewersAndFiles}
                  disabled={isLoadingReviewers}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.875rem',
                    cursor: isLoadingReviewers ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoadingReviewers) {
                      e.target.style.background = 'rgba(59, 130, 246, 0.2)';
                      e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoadingReviewers) {
                      e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                      e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    }
                  }}
                  title="Refresh list"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className={isLoadingReviewers ? 'spinner' : ''}
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                  Refresh
                </button>
                <button 
                  className="modal-close" 
                  onClick={() => setShowReviewerSelectionModal(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ 
              padding: '1rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0
            }}>
              {isLoadingReviewers ? (
                <div className="reviewer-creating">
                  <svg className="spinner" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p>Loading reviewers...</p>
                </div>
              ) : (
                <>
                  {Object.keys(reviewers).length === 0 ? (
                    <div className="empty-files-state">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <h3>No reviewers available</h3>
                      <p>Upload files or create reviewers in "My Files" to start studying</p>
                      <button 
                        className="btn-primary"
                        onClick={() => {
                          setShowReviewerSelectionModal(false);
                          navigate('/my-files');
                        }}
                        style={{ marginTop: '1rem' }}
                      >
                        Go to My Files
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="modal-hint" style={{ 
                        fontSize: '0.9rem', 
                        color: 'var(--text-secondary)', 
                        marginBottom: '1.25rem',
                        marginTop: '0'
                      }}>
                        Select a reviewer to study. You can choose from AI-generated study notes or uploaded files:
                      </p>
                      <div className="files-list-modal">
                        {Object.entries(reviewers).map(([subject, subjectReviewers]) => (
                          <div key={subject} className="subject-group">
                            <h3 className="subject-group-title">{subject}</h3>
                            <div className="files-grid-modal">
                              {subjectReviewers.map((reviewer) => {
                                // Get file type configuration
                                const getFileTypeConfig = (type) => {
                                  if (type === 'ai-generated') {
                                    return {
                                      primary: '#8B5CF6',
                                      secondary: '#7C3AED',
                                      background: '#F5F3FF',
                                      label: 'AI Study Notes',
                                      emoji: '📚'
                                    };
                                  }
                                  const configs = {
                                    docx: { 
                                      primary: '#4A90E2',
                                      secondary: '#357ABD',
                                      background: '#E8F4FF',
                                      label: 'DOCX File',
                                      emoji: '📝'
                                    },
                                    txt: { 
                                      primary: '#6B7280',
                                      secondary: '#4B5563',
                                      background: '#F3F4F6',
                                      label: 'TXT File',
                                      emoji: '📄'
                                    },
                                    md: { 
                                      primary: '#8B5CF6',
                                      secondary: '#7C3AED',
                                      background: '#F5F3FF',
                                      label: 'MD File',
                                      emoji: '📝'
                                    }
                                  };
                                  return configs[type] || configs.txt;
                                };

                                const config = getFileTypeConfig(reviewer.type);

                                return (
                                  <button
                                    key={reviewer.id}
                                    className={`file-item-modal ${selectedReviewer?.id === reviewer.id ? 'selected' : ''}`}
                                    onClick={() => handleReviewerSelect(reviewer)}
                                    disabled={!reviewer.hasContent}
                                    style={{
                                      background: 'white',
                                      borderRadius: '12px',
                                      padding: '1rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      border: selectedReviewer?.id === reviewer.id 
                                        ? '2px solid #3b82f6' 
                                        : '1px solid var(--border)',
                                      cursor: reviewer.hasContent ? 'pointer' : 'not-allowed',
                                      transition: 'all 0.3s ease',
                                      opacity: reviewer.hasContent ? 1 : 0.6,
                                      boxShadow: selectedReviewer?.id === reviewer.id
                                        ? '0 4px 12px rgba(59, 130, 246, 0.2)'
                                        : '0 2px 8px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (reviewer.hasContent && selectedReviewer?.id !== reviewer.id) {
                                        e.currentTarget.style.borderColor = '#3b82f6';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (selectedReviewer?.id !== reviewer.id) {
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }
                                    }}
                                  >
                                    {/* File Icon */}
                                    <div style={{ 
                                      width: '80px', 
                                      height: '80px', 
                                      position: 'relative',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: config.background,
                                      borderRadius: '12px',
                                      transition: 'all 0.3s ease'
                                    }}>
                                      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        {/* Back Document (shadow/duplicate effect) */}
                                        <path 
                                          d="M16 6H28L36 14V38C36 39.1046 35.1046 40 34 40H16C14.8954 40 14 39.1046 14 38V8C14 6.89543 14.8954 6 16 6Z" 
                                          fill={config.secondary}
                                          opacity="0.2"
                                        />
                                        
                                        {/* Main Document Body */}
                                        <path 
                                          d="M13 4H25L33 12V36C33 37.1046 32.1046 38 31 38H13C11.8954 38 11 37.1046 11 36V6C11 4.89543 11.8954 4 13 4Z" 
                                          fill={config.primary}
                                        />
                                        
                                        {/* Folded Corner */}
                                        <path 
                                          d="M25 4V10C25 11.1046 25.8954 12 27 12H33L25 4Z" 
                                          fill={config.secondary}
                                          opacity="0.5"
                                        />
                                        
                                        {/* Document Lines - white */}
                                        <line x1="16" y1="18" x2="28" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                                        <line x1="16" y1="23" x2="28" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                                        <line x1="16" y1="28" x2="24" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                                      </svg>
                                      
                                      {/* File Type Badge */}
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '6px',
                                        right: '6px',
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        color: 'white',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        padding: '3px 6px',
                                        background: config.primary,
                                        borderRadius: '4px',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                      }}>
                                        {reviewer.type === 'ai-generated' ? 'AI' : reviewer.type}
                                      </div>
                                    </div>
                                    
                                    {/* File Info */}
                                    <div style={{ 
                                      textAlign: 'center',
                                      width: '100%'
                                    }}>
                                      <h4 style={{ 
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#1f2937',
                                        marginBottom: '0.25rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {reviewer.name}
                                      </h4>
                                      <span style={{ 
                                        fontSize: '0.75rem',
                                        color: '#6b7280',
                                        display: 'block'
                                      }}>
                                        {config.emoji} {config.label}
                                      </span>
                                      {!reviewer.hasContent && (
                                        <span style={{ 
                                          color: '#ef4444', 
                                          fontSize: '0.7rem',
                                          display: 'block',
                                          marginTop: '0.25rem'
                                        }}>
                                          No content available
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            
            {/* Modal Footer */}
            {Object.keys(reviewers).length > 0 && (
              <div className="modal-footer" style={{ 
                padding: '1rem 1.5rem 1.5rem 1.5rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setShowReviewerSelectionModal(false);
                    navigate('/my-files');
                  }}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Upload Files or Create Reviewers
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="modal-overlay" onClick={handleConfirmationCancel} style={{ zIndex: 10000 }}>
          <div 
            className="notification-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #111f3a 0%, #0f1a2e 100%)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.75rem'
            }}>
              Confirm Action
            </h3>
            <div style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
              textAlign: 'left',
              padding: '0.5rem'
            }}>
              {confirmationMessage.split('\n').map((line, index) => (
                <div key={index} style={{ marginBottom: line.trim() === '' ? '0.5rem' : '0.25rem' }}>
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={handleConfirmationCancel}
                style={{
                  flex: 1,
                  padding: '0.75rem 2rem',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmationConfirm}
                style={{
                  flex: 1,
                  padding: '0.75rem 2rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotification && (
        <div className="modal-overlay" onClick={() => setShowNotification(false)} style={{ zIndex: 10000 }}>
          <div 
            className="notification-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #111f3a 0%, #0f1a2e 100%)',
              border: `1px solid ${notificationType === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              background: notificationType === 'success' 
                ? 'rgba(16, 185, 129, 0.1)' 
                : 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {notificationType === 'success' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.75rem'
            }}>
              {notificationType === 'success' ? 'Success!' : 'Notice'}
            </h3>
            <div style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
              textAlign: 'left',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {notificationMessage.split('\n').map((line, index) => (
                <div key={index} style={{ marginBottom: line.trim() === '' ? '0.5rem' : '0.25rem' }}>
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowNotification(false)}
              style={{
                padding: '0.75rem 2rem',
                background: notificationType === 'success' ? '#10b981' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Help Button */}
      <button 
        className="help-button" 
        onClick={() => setShowTutorial(true)}
        title="Show tutorial"
      >
        ?
      </button>

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => {
          setShowTutorial(false);
          // Mark tutorial as seen when user closes it
          if (!hasSeenTutorial('studyTimer')) {
            markTutorialAsSeen('studyTimer');
          }
        }}
        tutorial={tutorials.studyTimer}
      />
    </div>
  );
};

export default StudentStudyTimer;