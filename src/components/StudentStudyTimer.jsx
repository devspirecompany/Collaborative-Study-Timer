import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getRecommendedStudyDuration } from '../services/aiService';
import { createStudySession, getFiles, getFolders, getReviewers } from '../services/apiService';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';
import '../styles/StudentStudyTimer.css';

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

  // Load settings from localStorage
  const loadUserSettings = () => {
    try {
      const saved = localStorage.getItem('userSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return {
      autoStartBreak: true,
      autoStartStudy: false,
      soundNotifications: true,
      desktopNotifications: true,
      defaultPaperStyle: 'blank',
      defaultPaperColor: 'white',
      defaultViewMode: 'document'
    };
  };

  // Settings (loaded from localStorage)
  const [autoStartBreak, setAutoStartBreak] = useState(() => {
    const settings = loadUserSettings();
    return settings.autoStartBreak ?? true;
  });
  const [autoStartStudy, setAutoStartStudy] = useState(() => {
    const settings = loadUserSettings();
    return settings.autoStartStudy ?? false;
  });
  const [soundNotifications, setSoundNotifications] = useState(() => {
    const settings = loadUserSettings();
    return settings.soundNotifications ?? true;
  });
  const [desktopNotifications, setDesktopNotifications] = useState(() => {
    const settings = loadUserSettings();
    return settings.desktopNotifications ?? true;
  });

  // Reload settings when component mounts or when navigating back
  useEffect(() => {
    const settings = loadUserSettings();
    setAutoStartBreak(settings.autoStartBreak ?? true);
    setAutoStartStudy(settings.autoStartStudy ?? false);
    setSoundNotifications(settings.soundNotifications ?? true);
    setDesktopNotifications(settings.desktopNotifications ?? true);
    setPaperStyle(settings.defaultPaperStyle || 'blank');
    setPaperColor(settings.defaultPaperColor || 'white');
    setViewMode(settings.defaultViewMode || 'document');
  }, [location.pathname]);
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
  const [paperStyle, setPaperStyle] = useState(() => {
    const settings = loadUserSettings();
    return settings.defaultPaperStyle || 'blank';
  }); // 'blank', 'lined', 'grid'
  const [paperColor, setPaperColor] = useState(() => {
    const settings = loadUserSettings();
    return settings.defaultPaperColor || 'white';
  }); // 'white', 'cream', 'blue', 'green', 'purple'
  const [viewMode, setViewMode] = useState(() => {
    const settings = loadUserSettings();
    return settings.defaultViewMode || 'document';
  }); // 'document' (Word docu vibe) or 'flashcards'
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: null, y: null }); // For draggable timer
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasEnteredFullScreenReviewer, setHasEnteredFullScreenReviewer] = useState(false); // Track if we've entered full-screen mode
  
  // Notification and Confirmation Modal States
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationCallback, setConfirmationCallback] = useState(null);
  
  // Get user data from localStorage
  const [userData] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  });
  
  const timerRef = useRef(null);
  const navigate = useNavigate();
  
  // Confirmation modal handlers
  const handleConfirmationCancel = () => {
    setShowConfirmationModal(false);
    setConfirmationMessage('');
    setConfirmationCallback(null);
  };
  
  const handleConfirmationConfirm = () => {
    if (confirmationCallback) {
      confirmationCallback();
    }
    setShowConfirmationModal(false);
    setConfirmationMessage('');
    setConfirmationCallback(null);
  };

  // Handle reviewer from redirect (from ReviewerStudy or MyFiles)
  useEffect(() => {
    if (location.state?.selectedReviewer) {
      setSelectedReviewer(location.state.selectedReviewer);
      setFlashcardIndex(0); // Reset flashcard index when reviewer changes
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

  // Reset flashcard index when switching to flashcards view
  useEffect(() => {
    if (viewMode === 'flashcards') {
      setFlashcardIndex(0);
    }
  }, [viewMode]);

  // Check if we should show full-screen reviewer view (defined early for use in useEffect)
  // Once entered, stay in full-screen mode even when paused
  const showFullScreenReviewer = selectedReviewer && currentMode === 'study' && (hasEnteredFullScreenReviewer || isRunning || location.state?.fromMyFiles);
  
  // Track when we enter full-screen reviewer mode
  useEffect(() => {
    if (selectedReviewer && currentMode === 'study' && (isRunning || location.state?.fromMyFiles)) {
      setHasEnteredFullScreenReviewer(true);
    }
  }, [selectedReviewer, currentMode, isRunning, location.state?.fromMyFiles]);
  
  // Reset when exiting reviewer mode
  useEffect(() => {
    if (!selectedReviewer || currentMode !== 'study') {
      setHasEnteredFullScreenReviewer(false);
    }
  }, [selectedReviewer, currentMode]);

  // Prevent navigation when paused in reviewer view
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (showFullScreenReviewer && !isRunning && totalTimeForSession > 0) {
        e.preventDefault();
        e.returnValue = 'Timer is paused. Resume timer to continue or exit properly.';
        return e.returnValue;
      }
    };

    const handlePopState = (e) => {
      if (showFullScreenReviewer && !isRunning && totalTimeForSession > 0) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.pathname);
        // Show message to user
        setNotificationMessage('Timer is paused. Resume timer to continue studying or exit properly.');
        setNotificationType('error');
        setShowNotification(true);
      }
    };

    if (showFullScreenReviewer && !isRunning && totalTimeForSession > 0) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showFullScreenReviewer, isRunning, totalTimeForSession]);

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
    setupDailyProgressCircle();
  }, []);

  const setupProgressCircle = () => {
    if (progressCircleRef.current) {
      const radius = 140;
      const circumference = radius * 2 * Math.PI;
      progressCircleRef.current.style.strokeDasharray = `${circumference} ${circumference}`;
      progressCircleRef.current.style.strokeDashoffset = circumference;
    }
  };

  const setupDailyProgressCircle = () => {
    if (dailyProgressCircleRef.current) {
      const radius = 52;
      const circumference = radius * 2 * Math.PI;
      dailyProgressCircleRef.current.style.strokeDasharray = `${circumference} ${circumference}`;
      dailyProgressCircleRef.current.style.strokeDashoffset = circumference;
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
        const radius = 52;
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - ((percent / 100) * circumference);
      dailyProgressCircleRef.current.style.strokeDasharray = `${circumference} ${circumference}`;
      dailyProgressCircleRef.current.style.strokeDashoffset = offset;
    }
  };

  const switchMode = (mode) => {
    // Prevent switching to break modes if no study session completed
    if (mode !== 'study' && !hasCompletedStudySession && mode !== currentMode) {
      alert('Please complete a study session first before taking a break!');
      return;
    }

    // Allow mode switching even when running, but pause first
    if (isRunning) {
      if (window.confirm('Switch mode? The current timer will be paused.')) {
        pauseTimer();
        setCurrentMode(mode);
        if (mode !== 'study') {
          setCurrentDurationIndex(modeConfig[mode].defaultIndex || 0);
        }
        setSuggestBreak(false); // Clear break suggestion when manually switching
      }
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
      const effectiveUserId = userId || 'demo-user';
      console.log('🔄 Modal opened, fetching reviewers for userId:', effectiveUserId);
      fetchReviewersAndFiles(effectiveUserId);
    }
  }, [showReviewerSelectionModal]);

  const fetchReviewersAndFiles = async (effectiveUserId = null) => {
    // Use provided userId or fallback to 'demo-user' to match MyFiles behavior
    const userIdToUse = effectiveUserId || userId || 'demo-user';
    
    if (!userIdToUse) {
      console.warn('⚠️ Cannot fetch reviewers: userId is not available');
      setReviewers({});
      setFiles([]);
      setIsLoadingReviewers(false);
      return;
    }

    // Always show loading when modal is open
    if (showReviewerSelectionModal) {
      setIsLoadingReviewers(true);
    }
    
    try {
      console.log('🔄 Fetching reviewers and files for userId:', userIdToUse);
      console.log('🔄 Original userId from userData:', userId);
      
      // Fetch AI-generated reviewers
      const reviewersResponse = await getReviewers(userIdToUse);
      console.log('📚 Reviewers response:', reviewersResponse);
      const reviewersList = reviewersResponse && reviewersResponse.success ? (reviewersResponse.reviewers || []) : [];
      
      // Fetch uploaded files (these can also be used as reviewers)
      const filesResponse = await getFiles(userIdToUse);
      console.log('📁 Files response:', filesResponse);
      const filesList = filesResponse && filesResponse.success ? (filesResponse.files || []) : [];
      
      console.log(`✅ Found ${reviewersList.length} reviewers and ${filesList.length} files`);
      
      // Combine reviewers and files
      const allReviewers = [
        // AI-generated reviewers (have reviewContent)
        ...reviewersList.map(r => {
          const reviewer = {
            id: r._id || r.id,
            name: r.fileName || r.name || 'Untitled Reviewer',
            subject: r.subject || 'Uncategorized',
            type: 'ai-generated',
            reviewContent: r.reviewContent || r.content || '',
            keyPoints: r.keyPoints || [],
            createdAt: r.createdAt,
            hasContent: !!(r.reviewContent || r.content) && (r.reviewContent || r.content).trim().length > 0
          };
          console.log('📝 Mapped reviewer:', reviewer.name, 'hasContent:', reviewer.hasContent);
          return reviewer;
        }),
        // Uploaded files (can be used as reviewers)
        ...filesList.map(f => {
          const file = {
            id: f._id || f.id,
            name: f.fileName || f.name || 'Untitled File',
            subject: f.subject || 'Uncategorized',
            type: f.fileType || 'txt',
            content: f.fileContent || f.content || '',
            createdAt: f.createdAt,
            hasContent: !!(f.fileContent || f.content) && (f.fileContent || f.content).trim().length > 50
          };
          console.log('📄 Mapped file:', file.name, 'hasContent:', file.hasContent);
          return file;
        })
      ];
      
      console.log(`📊 Total reviewers/files: ${allReviewers.length}`);
      console.log('📋 All reviewers:', allReviewers.map(r => ({ name: r.name, subject: r.subject, hasContent: r.hasContent })));
      
      // Group by subject - include ALL reviewers, even without content
      const groupedBySubject = {};
      allReviewers.forEach(reviewer => {
        const subject = reviewer.subject || 'Uncategorized';
        if (!groupedBySubject[subject]) {
          groupedBySubject[subject] = [];
        }
        groupedBySubject[subject].push(reviewer);
      });
      
      console.log('📂 Grouped by subject:', Object.keys(groupedBySubject));
      console.log('📂 Number of subjects:', Object.keys(groupedBySubject).length);
      console.log('📂 Total items in grouped data:', Object.values(groupedBySubject).reduce((sum, arr) => sum + arr.length, 0));
      
      // Set state with the grouped data
      setReviewers(groupedBySubject);
      setFiles(filesList);
      
      console.log('✅ State updated with reviewers:', Object.keys(groupedBySubject).length, 'subjects');
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

  // Handle exit with confirmation
  const handleExitReviewer = () => {
    if (isRunning) {
      setShowExitConfirm(true);
    } else {
      // Calculate progress to show in confirmation
      const progressPercent = ((totalTimeForSession - timeRemaining) / totalTimeForSession) * 100;
      if (progressPercent > 5) { // If more than 5% progress, ask for confirmation
        setShowExitConfirm(true);
      } else {
        // Exit directly if minimal progress
        setSelectedReviewer(null);
        setHasEnteredFullScreenReviewer(false); // Reset full-screen mode flag
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  };

  const confirmExit = () => {
    setIsRunning(false);
    setSelectedReviewer(null);
    setHasEnteredFullScreenReviewer(false); // Reset full-screen mode flag
    setShowExitConfirm(false);
    navigate(location.pathname, { replace: true, state: {} });
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
  };

  // Paper color configurations
  const paperColors = {
    white: { bg: '#ffffff', text: '#000000', line: 'rgba(224, 224, 224, 0.5)' },
    cream: { bg: '#fefcf8', text: '#2c2416', line: 'rgba(200, 180, 150, 0.4)' },
    blue: { bg: '#f0f7ff', text: '#1a365d', line: 'rgba(147, 197, 253, 0.4)' },
    green: { bg: '#f0fdf4', text: '#14532d', line: 'rgba(134, 239, 172, 0.4)' },
    purple: { bg: '#faf5ff', text: '#581c87', line: 'rgba(196, 181, 253, 0.4)' }
  };

  // Draggable timer handlers
  const handleTimerMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag if clicking button
    setIsDragging(true);
    const rect = timerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };


  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      if (timerRef.current) {
        const maxX = window.innerWidth - timerRef.current.offsetWidth;
        const maxY = window.innerHeight - timerRef.current.offsetHeight;
        
        setTimerPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(80, Math.min(newY, maxY))
        });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div>
     {!showFullScreenReviewer ? (
     <Sidebar/>
     ) : (
       // Compact header only (no sidebar)
       <div className='dashboard-container'>
         <nav className="topnav" style={{ zIndex: 100 }}>
           <div className="nav-left">
             <div className="logo-nav" style={{ gap: '0.5rem' }}>
               <img src="../imgs/SpireWorksLogo.png" alt="SpireWorks Logo" style={{ width: '32px', height: '32px' }} />
               <h1 style={{ fontSize: '1.25rem' }}>SpireWorks</h1>
             </div>
           </div>
           <div className="nav-right" style={{ gap: '0.75rem' }}>
             <div className="nav-icon" onClick={() => {/* Handle notification */}} style={{ padding: '0.5rem' }}>
               <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                 <path d="M10 5a5 5 0 0 1 5 5v2l1.5 3H3.5L5 12v-2a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.5"/>
                 <path d="M8 17a2 2 0 1 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
               </svg>
             </div>
             <div className="user-menu" style={{ padding: '0.25rem 0.5rem', gap: '0.5rem' }}>
               <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                 {userData?.firstName?.[0] || userData?.username?.[0] || 'U'}
               </div>
             </div>
           </div>
         </nav>
       </div>
     )}

      {/* Main Content */}
      <main className="main-content" style={{ position: 'relative' }}>
        {/* Enhanced Draggable Timer (when reviewer is selected) */}
        {showFullScreenReviewer && (() => {
          const progressPercent = ((totalTimeForSession - timeRemaining) / totalTimeForSession) * 100;
          const wordsRead = Math.floor((totalTimeForSession - timeRemaining) / 60 * 200); // Estimate 200 words/min
          const focusScore = Math.min(100, Math.floor(progressPercent * 1.2)); // Focus score based on progress
          
          // Use saved position or default to upper right
          const defaultTop = 80;
          const defaultRight = 32;
          const top = timerPosition.y !== null ? timerPosition.y : defaultTop;
          const left = timerPosition.x !== null ? timerPosition.x : null;
          const right = timerPosition.x !== null ? null : defaultRight;
          
          return (
            <div 
              ref={timerRef}
              onMouseDown={handleTimerMouseDown}
              style={{
                position: 'fixed',
                top: `${top}px`,
                left: left !== null ? `${left}px` : undefined,
                right: right !== null ? `${right}px` : undefined,
                zIndex: 1000,
                background: 'linear-gradient(135deg, rgba(15, 26, 46, 0.98) 0%, rgba(30, 58, 138, 0.98) 100%)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '20px',
                padding: '1.5rem',
                minWidth: '240px',
                boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                transition: isDragging ? 'none' : 'box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.7)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDragging) {
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.6)';
                }
              }}
            >
              {/* Drag handle indicator */}
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40px',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
                cursor: 'grab'
              }}></div>
              {/* Timer Display */}
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '0.25rem',
                  lineHeight: '1'
                }}>
                  {formatTime(timeRemaining)}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'rgba(255, 255, 255, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '0.5rem'
                }}>
                  {modeConfig[currentMode].label}
                </div>
                
                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #0ea5e9)',
                    borderRadius: '3px',
                    transition: 'width 1s ease'
                  }}></div>
                </div>
                
                {/* Stats Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginTop: '0.75rem'
                }}>
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginBottom: '0.25rem'
                    }}>Progress</div>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#3b82f6'
                    }}>{Math.round(progressPercent)}%</div>
                  </div>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginBottom: '0.25rem'
                    }}>Focus</div>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#10b981'
                    }}>{focusScore}%</div>
                  </div>
                </div>
                
                {isRunning && (
                  <div style={{
                    marginTop: '0.75rem',
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontStyle: 'italic'
                  }}>
                    ~{wordsRead.toLocaleString()} words read
                  </div>
                )}
              </div>
              
              {/* Control Button */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {!isRunning ? (
                  <button 
                    onClick={startTimer}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.75rem 1.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Start
                  </button>
                ) : (
                  <button 
                    onClick={pauseTimer}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.75rem 1.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    Pause
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {!showFullScreenReviewer && (
        <div style={{
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: 'white',
            margin: '0 0 0.5rem 0'
          }}>Study Timer</h1>
          <p style={{
            fontSize: '1.1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            margin: 0
          }}>Focus, track progress, and achieve your study goals</p>
        </div>
        )}

        {/* Reviewer Selection Card - Prominent at Top */}
        {currentMode === 'study' && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            border: '1px solid var(--border)'
          }}>
            {!selectedReviewer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  flex: 1,
                  minWidth: '300px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.6))',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: '#FFFFFF',
                      marginBottom: '0.5rem',
                      fontFamily: 'sans-serif'
                    }}>Select Study Material</h3>
                    <p style={{
                      margin: 0,
                      fontSize: '0.95rem',
                      color: 'var(--text-secondary)'
                    }}>Choose a reviewer or file to study with</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/my-files')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.875rem 1.75rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Select File
                </button>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flex: 1
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.6))',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>{selectedReviewer.name || selectedReviewer.fileName}</h3>
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>{selectedReviewer.subject || 'Study Material'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/my-files')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        {!showFullScreenReviewer && (
        <div style={{
          display: 'flex',
          gap: '2rem',
          maxWidth: '1400px',
          margin: '0 auto',
          alignItems: 'stretch'
        }}>
          {/* Timer Main Card */}
          <div className="timer-main-card" style={{ 
            flex: 1,
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '3rem 2.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border)',
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            {/* Mode Selector - Horizontal at Top */}
            <div className="timer-mode-selector" style={{
              display: 'flex',
              gap: '0.375rem',
              margin: '0px 0px 48px 0px',
              justifyContent: 'center',
              background: '#1A2942',
              padding: '8px',
              borderRadius: '10px',
              width: 'fit-content',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <button
                className={`mode-btn ${currentMode === 'study' ? 'active' : ''}`}
                onClick={() => switchMode('study')}
                disabled={false}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 2.5rem',
                  background: currentMode === 'study' 
                    ? '#1E40AF' 
                    : 'transparent',
                  color: currentMode === 'study' ? '#FFFFFF' : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  fontSize: '10px',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: currentMode === 'study' ? '700' : '500',
                  minWidth: '160px',
                  height: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (currentMode !== 'study') {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentMode !== 'study') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={currentMode === 'study' ? '#FFFFFF' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  <path d="M8 7h6"></path>
                  <path d="M8 11h6"></path>
                  <path d="M8 15h4"></path>
                </svg>
                <span>Study</span>
              </button>
              
              <button
                className={`mode-btn ${currentMode === 'break' ? 'active' : ''} ${!hasCompletedStudySession && currentMode !== 'break' ? 'disabled' : ''}`}
                onClick={() => switchMode('break')}
                disabled={!hasCompletedStudySession && currentMode !== 'break'}
                title={!hasCompletedStudySession && currentMode !== 'break' ? 'Complete a study session first!' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 2.5rem',
                  background: currentMode === 'break' 
                    ? '#1E40AF' 
                    : 'transparent',
                  color: currentMode === 'break' ? '#FFFFFF' : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!hasCompletedStudySession && currentMode !== 'break') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  fontSize: '10px',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: currentMode === 'break' ? '700' : '500',
                  opacity: (!hasCompletedStudySession && currentMode !== 'break') ? 0.5 : 1,
                  minWidth: '160px',
                  height: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (currentMode !== 'break' && hasCompletedStudySession) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentMode !== 'break') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={currentMode === 'break' ? '#FFFFFF' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
                  <path d="M8 6h8"/>
                  <path d="M10 8h4"/>
                  <path d="M10 10h4"/>
                  <path d="M10 12h2"/>
                  <path d="M12 16v2"/>
                  <path d="M10 18h4"/>
                </svg>
                <span>Short Break</span>
              </button>
              
              <button
                className={`mode-btn ${currentMode === 'longbreak' ? 'active' : ''} ${!hasCompletedStudySession && currentMode !== 'longbreak' ? 'disabled' : ''}`}
                onClick={() => switchMode('longbreak')}
                disabled={!hasCompletedStudySession && currentMode !== 'longbreak'}
                title={!hasCompletedStudySession && currentMode !== 'longbreak' ? 'Complete a study session first!' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 2.5rem',
                  background: currentMode === 'longbreak' 
                    ? '#1E40AF' 
                    : 'transparent',
                  color: currentMode === 'longbreak' ? '#FFFFFF' : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!hasCompletedStudySession && currentMode !== 'longbreak') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  fontSize: '10px',
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: currentMode === 'longbreak' ? '700' : '500',
                  opacity: (!hasCompletedStudySession && currentMode !== 'longbreak') ? 0.5 : 1,
                  minWidth: '160px',
                  height: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (currentMode !== 'longbreak' && hasCompletedStudySession) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentMode !== 'longbreak') {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={currentMode === 'longbreak' ? '#FFFFFF' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l8 4 8-4v16l-8-4-8 4V4z"/>
                  <path d="M4 4v16"/>
                  <path d="M12 8v8"/>
                </svg>
                <span>Long Break</span>
              </button>
            </div>

            {/* Timer Display */}
            <div className="timer-display-section" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '3rem 0',
              padding: '1rem 0'
            }}>
              <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="320" height="320" style={{
                  transform: 'rotate(-90deg)',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}>
                  <defs>
                    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1e40af" />
                    </linearGradient>
                  </defs>
                  {/* Background circle (full outline) */}
                  <circle
                    cx="160"
                    cy="160"
                    r="140"
                    fill="none"
                    stroke="url(#timerGradient)"
                    strokeWidth="8"
                    opacity="0.3"
                  />
                  {/* Progress circle */}
                  <circle
                    ref={progressCircleRef}
                    cx="160"
                    cy="160"
                    r="140"
                    fill="none"
                    stroke="url(#timerGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 0.5s ease'
                    }}
                  />
                </svg>
                <div style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '320px',
                  height: '320px'
                }}>
                  <div style={{
                    fontSize: '4.5rem',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    lineHeight: '1',
                    marginBottom: '0.5rem',
                    fontFamily: 'sans-serif'
                  }}>
                    {formatTime(timeRemaining)}
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    color: '#FFFFFF',
                    fontWeight: '400',
                    fontFamily: 'sans-serif'
                  }}>
                    {modeConfig[currentMode].label}
                  </div>
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
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '2.5rem'
            }}>
              <button 
                onClick={resetTimer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1.5rem',
                  background: 'transparent',
                  color: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Reset
              </button>
              {!isRunning ? (
                <button 
                  onClick={startTimer}
                  disabled={currentMode === 'study' && !selectedReviewer}
                  title={currentMode === 'study' && !selectedReviewer ? 'Please select a file first' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '1rem 2.25rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: (currentMode === 'study' && !selectedReviewer) ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    opacity: (currentMode === 'study' && !selectedReviewer) ? 0.5 : 1,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!(currentMode === 'study' && !selectedReviewer)) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Start
                </button>
              ) : (
                <button 
                  onClick={pauseTimer}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '1rem 2.25rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause
                </button>
              )}
              <button 
                onClick={skipSession}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1.5rem',
                  background: 'transparent',
                  color: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 4 15 12 5 20 5 4"></polygon>
                  <line x1="19" y1="5" x2="19" y2="19"></line>
                </svg>
                Skip
              </button>
            </div>

            {/* Session Info */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'flex-start',
              marginTop: '3rem',
              paddingTop: '2rem',
              width: '100%'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'rgba(148, 163, 184, 0.9)',
                  fontWeight: '400',
                  marginBottom: '0.5rem',
                  fontFamily: 'sans-serif'
                }}>Session Count</div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: '700',
                  color: '#3b82f6',
                  fontFamily: 'sans-serif',
                  lineHeight: '1.2'
                }}>{sessionCount}</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'rgba(148, 163, 184, 0.9)',
                  fontWeight: '400',
                  marginBottom: '0.5rem',
                  fontFamily: 'sans-serif'
                }}>Total Today</div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: '700',
                  color: '#3b82f6',
                  fontFamily: 'sans-serif',
                  lineHeight: '1.2'
                }}>{formatTotalTime(totalStudyTimeToday)}</div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  color: 'rgba(148, 163, 184, 0.9)',
                  fontWeight: '400',
                  marginBottom: '0.5rem',
                  fontFamily: 'sans-serif'
                }}>Current Goal</div>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: '700',
                  color: '#3b82f6',
                  fontFamily: 'sans-serif',
                  lineHeight: '1.2'
                }}>4h 0m</div>
              </div>
            </div>

            {/* Reviewer Content Display (shown when reviewer is selected, even before starting) */}
            {selectedReviewer && currentMode === 'study' && !showFullScreenReviewer && (
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
                      onClick={() => navigate('/my-files')}
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
          <div className="timer-sidebar" style={{ 
            minWidth: '280px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignSelf: 'flex-start'
          }}>
            {/* Today's Progress */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid var(--border)',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.95rem',
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                fontFamily: 'sans-serif',
                textAlign: 'left'
              }}>Today's Progress</h3>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '1.25rem'
              }}>
                <div style={{
                  position: 'relative',
                  width: '120px',
                  height: '120px',
                  marginBottom: '0.75rem'
                }}>
                  <svg width="120" height="120" style={{
                    transform: 'rotate(-90deg)',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}>
                    <defs>
                      <linearGradient id="dailyProgressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#9ca3af" />
                        <stop offset="50%" stopColor="#6b7280" />
                        <stop offset="100%" stopColor="#4b5563" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="rgba(156, 163, 184, 0.3)"
                      strokeWidth="4"
                    />
                    <circle
                      ref={dailyProgressCircleRef}
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="url(#dailyProgressGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      style={{
                        transition: 'stroke-dashoffset 0.5s ease'
                      }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#FFFFFF',
                      fontFamily: 'sans-serif',
                      lineHeight: '1.2',
                      marginBottom: '0.25rem'
                    }}>{getDailyProgressPercent()}%</div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#FFFFFF',
                      fontFamily: 'sans-serif',
                      opacity: 0.8
                    }}>of 4h goal</div>
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '0.625rem',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#3b82f6',
                    fontFamily: 'sans-serif',
                    marginBottom: '0.375rem'
                  }}>{completedSessions}</div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#FFFFFF',
                    fontFamily: 'sans-serif',
                    opacity: 0.9
                  }}>Completed</div>
                </div>
                <div style={{
                  flex: 1,
                  background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#3b82f6',
                    fontFamily: 'sans-serif',
                    marginBottom: '0.375rem'
                  }}>{currentStreak}</div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#FFFFFF',
                    fontFamily: 'sans-serif',
                    opacity: 0.9
                  }}>Streak</div>
                </div>
              </div>
            </div>

            {/* Session Settings */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid var(--border)',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.95rem',
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                fontFamily: 'sans-serif',
                textAlign: 'left'
              }}>Session Settings</h3>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#FFFFFF',
                  fontFamily: 'sans-serif',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={autoStartBreak}
                    onChange={(e) => {
                      setAutoStartBreak(e.target.checked);
                      // Save to localStorage
                      const currentSettings = loadUserSettings();
                      localStorage.setItem('userSettings', JSON.stringify({
                        ...currentSettings,
                        autoStartBreak: e.target.checked
                      }));
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Auto-start breaks</span>
                </label>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#FFFFFF',
                  fontFamily: 'sans-serif',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={autoStartStudy}
                    onChange={(e) => {
                      setAutoStartStudy(e.target.checked);
                      // Save to localStorage
                      const currentSettings = loadUserSettings();
                      localStorage.setItem('userSettings', JSON.stringify({
                        ...currentSettings,
                        autoStartStudy: e.target.checked
                      }));
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Auto-start study sessions</span>
                </label>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border)'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#FFFFFF',
                  fontFamily: 'sans-serif',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={soundNotifications}
                    onChange={(e) => {
                      setSoundNotifications(e.target.checked);
                      // Save to localStorage
                      const currentSettings = loadUserSettings();
                      localStorage.setItem('userSettings', JSON.stringify({
                        ...currentSettings,
                        soundNotifications: e.target.checked
                      }));
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Sound notifications</span>
                </label>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: 'none'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#FFFFFF',
                  fontFamily: 'sans-serif',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={desktopNotifications}
                    onChange={(e) => {
                      setDesktopNotifications(e.target.checked);
                      if (e.target.checked) requestNotificationPermission();
                      // Save to localStorage
                      const currentSettings = loadUserSettings();
                      localStorage.setItem('userSettings', JSON.stringify({
                        ...currentSettings,
                        desktopNotifications: e.target.checked
                      }));
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Desktop notifications</span>
                </label>
              </div>
            </div>

            {/* Recent Sessions */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid var(--border)',
              marginBottom: '0'
            }}>
              <h3 style={{
                fontSize: '0.95rem',
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: '1.25rem',
                fontFamily: 'sans-serif',
                textAlign: 'left'
              }}>Recent Sessions</h3>
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
        )}

        {/* Full-Screen Word-Inspired Reviewer View */}
        {showFullScreenReviewer && (
          <div style={{
            position: 'fixed',
            top: '80px', // Below header
            left: 0, // No sidebar
            right: 0,
            bottom: 0,
            background: '#f5f5f5',
            zIndex: 50,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Word-like Toolbar - Redesigned */}
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              borderBottom: '1px solid #e0e0e0',
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}>
              {/* Document Name with Icon */}
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: 1,
                minWidth: 0
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '0.875rem',
                    color: '#1f2937',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedReviewer.name || selectedReviewer.fileName}
                  </div>
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: '#6b7280',
                    marginTop: '2px'
                  }}>
                    {selectedReviewer.subject}
                  </div>
                </div>
              </div>
              
              {/* Paper Style Selector - Redesigned */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.5rem',
                background: '#f1f5f9',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  fontWeight: '600',
                  marginRight: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Style
                </span>
                <button
                  onClick={() => setPaperStyle('blank')}
                  style={{
                    background: paperStyle === 'blank' 
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                      : 'transparent',
                    color: paperStyle === 'blank' ? 'white' : '#64748b',
                    border: paperStyle === 'blank' ? 'none' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.375rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: paperStyle === 'blank' 
                      ? '0 2px 8px rgba(59, 130, 246, 0.3)' 
                      : 'none',
                    transform: paperStyle === 'blank' ? 'scale(1.05)' : 'scale(1)'
                  }}
                  title="Blank Paper"
                  onMouseEnter={(e) => {
                    if (paperStyle !== 'blank') {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperStyle !== 'blank') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  Blank
                </button>
                <button
                  onClick={() => setPaperStyle('lined')}
                  style={{
                    background: paperStyle === 'lined' 
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                      : 'transparent',
                    color: paperStyle === 'lined' ? 'white' : '#64748b',
                    border: paperStyle === 'lined' ? 'none' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.375rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: paperStyle === 'lined' 
                      ? '0 2px 8px rgba(59, 130, 246, 0.3)' 
                      : 'none',
                    transform: paperStyle === 'lined' ? 'scale(1.05)' : 'scale(1)'
                  }}
                  title="Lined Paper"
                  onMouseEnter={(e) => {
                    if (paperStyle !== 'lined') {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperStyle !== 'lined') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  Lined
                </button>
                <button
                  onClick={() => setPaperStyle('grid')}
                  style={{
                    background: paperStyle === 'grid' 
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                      : 'transparent',
                    color: paperStyle === 'grid' ? 'white' : '#64748b',
                    border: paperStyle === 'grid' ? 'none' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.375rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: paperStyle === 'grid' 
                      ? '0 2px 8px rgba(59, 130, 246, 0.3)' 
                      : 'none',
                    transform: paperStyle === 'grid' ? 'scale(1.05)' : 'scale(1)'
                  }}
                  title="Grid Paper"
                  onMouseEnter={(e) => {
                    if (paperStyle !== 'grid') {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperStyle !== 'grid') {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  Grid
                </button>
              </div>

              {/* View Mode Toggle */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginRight: '1rem',
                padding: '0.25rem',
                background: '#f5f5f5',
                borderRadius: '8px'
              }}>
                <button
                  onClick={() => setViewMode('document')}
                  style={{
                    background: viewMode === 'document' ? '#3b82f6' : 'transparent',
                    color: viewMode === 'document' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.375rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem'
                  }}
                  title="Document View (Word-like)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  Document
                </button>
                <button
                  onClick={() => setViewMode('flashcards')}
                  style={{
                    background: viewMode === 'flashcards' ? '#3b82f6' : 'transparent',
                    color: viewMode === 'flashcards' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.375rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem'
                  }}
                  title="Flashcards View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Flashcards
                </button>
              </div>

              {/* Paper Color Selector - Circular Design */}
              <div style={{
                display: 'flex',
                gap: '0.625rem',
                alignItems: 'center',
                padding: '0.5rem',
                background: '#f1f5f9',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#64748b',
                  fontWeight: '600',
                  marginRight: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Color
                </span>
                <button
                  onClick={() => setPaperColor('white')}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#ffffff',
                    border: paperColor === 'white' ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: paperColor === 'white' 
                      ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transform: paperColor === 'white' ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title="White Paper"
                  onMouseEnter={(e) => {
                    if (paperColor !== 'white') {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperColor !== 'white') {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                />
                <button
                  onClick={() => setPaperColor('cream')}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#fefcf8',
                    border: paperColor === 'cream' ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: paperColor === 'cream' 
                      ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transform: paperColor === 'cream' ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title="Cream Paper"
                  onMouseEnter={(e) => {
                    if (paperColor !== 'cream') {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperColor !== 'cream') {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                />
                <button
                  onClick={() => setPaperColor('blue')}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#f0f7ff',
                    border: paperColor === 'blue' ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: paperColor === 'blue' 
                      ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transform: paperColor === 'blue' ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title="Blue Paper"
                  onMouseEnter={(e) => {
                    if (paperColor !== 'blue') {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperColor !== 'blue') {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                />
                <button
                  onClick={() => setPaperColor('green')}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#f0fdf4',
                    border: paperColor === 'green' ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: paperColor === 'green' 
                      ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transform: paperColor === 'green' ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title="Green Paper"
                  onMouseEnter={(e) => {
                    if (paperColor !== 'green') {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperColor !== 'green') {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                />
                <button
                  onClick={() => setPaperColor('purple')}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#faf5ff',
                    border: paperColor === 'purple' ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: paperColor === 'purple' 
                      ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transform: paperColor === 'purple' ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title="Purple Paper"
                  onMouseEnter={(e) => {
                    if (paperColor !== 'purple') {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paperColor !== 'purple') {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                />
              </div>
              
              {/* Exit Button - Redesigned */}
              <button
                onClick={handleExitReviewer}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                }}
                title="Exit reviewer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Exit
              </button>
            </div>

            {/* Word-like Document Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: '#f5f5f5',
              padding: '3rem',
              paddingLeft: '3rem', // No left padding since no sidebar
              display: 'flex',
              justifyContent: 'center', // Center the paper
              position: 'relative',
              minHeight: '100%' // Ensure container extends
            }}>
              {viewMode === 'document' ? (
                <div style={{
                  background: paperColors[paperColor].bg,
                  width: '100%',
                  maxWidth: '816px', // A4 width at 96 DPI
                  minHeight: 'calc(100vh + 500px)', // Extend beyond viewport for scrolling
                  padding: '96px 96px 500px 80px', // Extra padding at bottom for scrolling
                  boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                  fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                  fontSize: '11pt',
                  lineHeight: '1.5',
                  color: paperColors[paperColor].text,
                  position: 'relative',
                  filter: !isRunning && totalTimeForSession > 0 ? 'blur(4px)' : 'none',
                  transition: 'filter 0.3s ease',
                  // Paper style backgrounds - ensure they repeat and extend fully
                  ...(paperStyle === 'lined' ? {
                    background: paperColors[paperColor].bg,
                    backgroundImage: `repeating-linear-gradient(
                      transparent,
                      transparent 31px,
                      ${paperColors[paperColor].line} 31px,
                      ${paperColors[paperColor].line} 32px
                    )`,
                    backgroundPosition: '80px 96px',
                    backgroundSize: 'calc(100% - 160px) 32px',
                    backgroundRepeat: 'repeat-y',
                    backgroundAttachment: 'local' // Ensures background scrolls with content
                  } : paperStyle === 'grid' ? {
                    background: paperColors[paperColor].bg,
                    backgroundImage: `
                      linear-gradient(to right, ${paperColors[paperColor].line} 1px, transparent 1px),
                      linear-gradient(to bottom, ${paperColors[paperColor].line} 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '80px 96px',
                    backgroundRepeat: 'repeat',
                    backgroundAttachment: 'local' // Ensures background scrolls with content
                  } : {
                    background: paperColors[paperColor].bg
                  })
                }}>
                {/* Document Title */}
                <h1 style={{
                  fontSize: '18pt',
                  fontWeight: 'bold',
                  marginBottom: '12pt',
                  color: paperColors[paperColor].text,
                  textAlign: 'left'
                }}>
                  {selectedReviewer.name || selectedReviewer.fileName}
                </h1>

                {/* Study Notes Content */}
                {(selectedReviewer.reviewContent || selectedReviewer.content) && (
                  <div style={{
                    marginBottom: '24pt',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}>
                    {selectedReviewer.reviewContent 
                      ? cleanContent(selectedReviewer.reviewContent)
                      : selectedReviewer.content 
                        ? cleanContent(selectedReviewer.content)
                        : 'No content available'}
                  </div>
                )}

                {/* Key Points Section */}
                {selectedReviewer.keyPoints && selectedReviewer.keyPoints.length > 0 && (
                  <div style={{
                    marginTop: '24pt',
                    paddingTop: '24pt',
                    borderTop: '1px solid #e0e0e0'
                  }}>
                    <h2 style={{
                      fontSize: '14pt',
                      fontWeight: 'bold',
                      marginBottom: '12pt',
                      color: paperColors[paperColor].text
                    }}>
                      Key Points
                    </h2>
                    <ul style={{
                      listStyle: 'disc',
                      paddingLeft: '36pt',
                      margin: 0
                    }}>
                      {selectedReviewer.keyPoints.map((point, idx) => (
                        <li key={idx} style={{
                          marginBottom: '6pt',
                          color: paperColors[paperColor].text,
                          lineHeight: '1.5'
                        }}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </div>
              ) : (
                // Flashcards View - Single Large Card with Navigation
                (() => {
                  // Prepare flashcards data
                  let flashcards = [];
                  if (selectedReviewer.keyPoints && selectedReviewer.keyPoints.length > 0) {
                    flashcards = selectedReviewer.keyPoints.map((point, idx) => ({
                      type: 'keypoint',
                      number: idx + 1,
                      content: point
                    }));
                  } else {
                    const content = selectedReviewer.reviewContent || selectedReviewer.content || '';
                    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
                    flashcards = sentences.slice(0, 20).map((chunk, idx) => ({
                      type: 'note',
                      number: idx + 1,
                      content: chunk.trim()
                    }));
                  }

                  if (flashcards.length === 0) {
                    return (
                      <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4rem',
                        color: paperColors[paperColor].text
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                          <p style={{ fontSize: '1.1rem', fontWeight: '500' }}>No content available for flashcards</p>
                        </div>
                      </div>
                    );
                  }

                  const currentCard = flashcards[flashcardIndex];
                  const canGoPrev = flashcardIndex > 0;
                  const canGoNext = flashcardIndex < flashcards.length - 1;

                  return (
                    <div style={{
                      width: '100%',
                      maxWidth: '900px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2rem',
                      padding: '2rem 0',
                      filter: !isRunning && totalTimeForSession > 0 ? 'blur(4px)' : 'none',
                      transition: 'filter 0.3s ease',
                      position: 'relative'
                    }}>
                      {/* Previous Arrow */}
                      <button
                        onClick={() => setFlashcardIndex(prev => Math.max(0, prev - 1))}
                        disabled={!canGoPrev}
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: canGoPrev ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          border: canGoPrev ? '2px solid #3b82f6' : '2px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: canGoPrev ? 'pointer' : 'not-allowed',
                          transition: 'all 0.3s ease',
                          opacity: canGoPrev ? 1 : 0.4,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (canGoPrev) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (canGoPrev) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={canGoPrev ? '#3b82f6' : '#999'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>

                      {/* Large Flashcard */}
                      <div style={{
                        flex: 1,
                        background: paperColors[paperColor].bg,
                        border: `3px solid ${paperColors[paperColor].line}`,
                        borderRadius: '24px',
                        padding: '4rem 3rem',
                        minHeight: '500px',
                        maxHeight: '600px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                      }}>
                        {/* Card Number Indicator */}
                        <div style={{
                          position: 'absolute',
                          top: '1.5rem',
                          right: '1.5rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#3b82f6',
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '0.5rem 1rem',
                          borderRadius: '20px'
                        }}>
                          {flashcardIndex + 1} / {flashcards.length}
                        </div>

                        {/* Card Type Label */}
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#3b82f6',
                          marginBottom: '2rem',
                          textTransform: 'uppercase',
                          letterSpacing: '2px'
                        }}>
                          {currentCard.type === 'keypoint' ? 'Key Point' : 'Study Note'} {currentCard.number}
                        </div>

                        {/* Card Content */}
                        <div style={{
                          fontSize: '1.5rem',
                          color: paperColors[paperColor].text,
                          lineHeight: '1.8',
                          fontWeight: '500',
                          textAlign: 'center',
                          wordWrap: 'break-word'
                        }}>
                          {currentCard.content}
                        </div>
                      </div>

                      {/* Next Arrow */}
                      <button
                        onClick={() => setFlashcardIndex(prev => Math.min(flashcards.length - 1, prev + 1))}
                        disabled={!canGoNext}
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: canGoNext ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          border: canGoNext ? '2px solid #3b82f6' : '2px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: canGoNext ? 'pointer' : 'not-allowed',
                          transition: 'all 0.3s ease',
                          opacity: canGoNext ? 1 : 0.4,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (canGoNext) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (canGoNext) {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={canGoNext ? '#3b82f6' : '#999'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </main>

      {/* Reviewer Selection Modal */}
      {showReviewerSelectionModal && (
        <div className="modal-overlay" onClick={() => setShowReviewerSelectionModal(false)}>
          <div className="modal-content file-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Reviewer for Study Session</h2>
              <div className="modal-header-actions">
                <button
                  onClick={() => {
                    const effectiveUserId = userId || 'demo-user';
                    fetchReviewersAndFiles(effectiveUserId);
                  }}
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
            <div className="modal-body">
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
                      <p className="modal-hint">Select a reviewer to study. You can choose from AI-generated study notes or uploaded files:</p>
                      <div className="files-list-modal">
                        {Object.entries(reviewers).map(([subject, subjectReviewers]) => (
                          <div key={subject} className="subject-group">
                            <h3 className="subject-group-title">{subject}</h3>
                            <div className="files-grid-modal">
                              {subjectReviewers.map((reviewer) => (
                                <button
                                  key={reviewer.id}
                                  className={`file-item-modal ${selectedReviewer?.id === reviewer.id ? 'selected' : ''}`}
                                  onClick={() => handleReviewerSelect(reviewer)}
                                  disabled={!reviewer.hasContent}
                                >
                                  <div className="file-icon-modal">
                                    {reviewer.type === 'ai-generated' ? (
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                        <polyline points="10 9 9 9 8 9"/>
                                      </svg>
                                    ) : (
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="file-info-modal">
                                    <h4>{reviewer.name}</h4>
                                    <span className="file-subject-modal">
                                      {reviewer.type === 'ai-generated' ? '📚 AI Study Notes' : `${reviewer.type.toUpperCase()} File`}
                                    </span>
                                    {!reviewer.hasContent && (
                                      <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>No content available</span>
                                    )}
                                  </div>
                                </button>
                              ))}
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
              <div className="modal-footer">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setShowReviewerSelectionModal(false);
                    navigate('/my-files');
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

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="modal-overlay" onClick={cancelExit} style={{ zIndex: 10001 }}>
          <div 
            className="notification-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #111f3a 0%, #0f1a2e 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '450px',
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
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.75rem'
            }}>
              Exit Study Session?
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
              {(() => {
                const progressPercent = ((totalTimeForSession - timeRemaining) / totalTimeForSession) * 100;
                const timeStudied = Math.floor((totalTimeForSession - timeRemaining) / 60);
                return `Are you sure you want to exit?\n\n` +
                  `You've studied for ${timeStudied} minute${timeStudied !== 1 ? 's' : ''} (${Math.round(progressPercent)}% progress).\n\n` +
                  `⚠️ Your progress will be saved, but the current session will end.\n\n` +
                  `Don't waste your progress! Continue studying?`;
              })()}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={cancelExit}
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
                onClick={confirmExit}
                style={{
                  flex: 1,
                  padding: '0.75rem 2rem',
                  background: '#ef4444',
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
                Exit Anyway
              </button>
            </div>
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