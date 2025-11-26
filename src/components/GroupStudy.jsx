import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { createCompetition, joinCompetition, submitAnswer, completeCompetition, getCompetition, getFiles, createFile, getFolders, createFolder } from '../services/apiService';
import { createStudyRoom, joinStudyRoom, getAllStudyRooms, getStudyRoom } from '../services/apiService';
import { generateQuestionsFromFile } from '../services/aiService';
import '../styles/GroupStudy.css';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const GroupStudy = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isInCompetition, setIsInCompetition] = useState(false);
  const [competitionData, setCompetitionData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [groupQuizPlayers, setGroupQuizPlayers] = useState([]); // For Group Quiz player list
  const [groupQuizPollInterval, setGroupQuizPollInterval] = useState(null); // Store polling interval
  
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
  
  const userId = userData?._id || userData?.id || 'demo-user';
  const playerName = userData?.username || userData?.firstName || 'Player1';
  const [competitionSubject, setCompetitionSubject] = useState('Computer Science');
  const [studyMode, setStudyMode] = useState('competition'); // 'competition' or 'collaborative'
  const [competitionType, setCompetitionType] = useState('1v1'); // '1v1' or 'group' (Quizizz-style)
  const [maxPlayers, setMaxPlayers] = useState(10); // For group quiz
  
  // Quiz Setup Modal States (for 1v1)
  const [showQuizSetupModal, setShowQuizSetupModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // Selected file for quiz generation
  const [files, setFiles] = useState([]); // User's files
  const [filesBySubject, setFilesBySubject] = useState({}); // Files grouped by subject
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null); // For file selection
  const [showUploadSection, setShowUploadSection] = useState(false); // Show/hide upload UI
  const [uploadFile, setUploadFile] = useState(null); // File to upload
  const [uploadFolder, setUploadFolder] = useState(''); // Folder/subject for upload
  const [newFolderName, setNewFolderName] = useState(''); // For creating new folder
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [folders, setFolders] = useState([]); // Available folders/subjects
  const [showNewFolderInput, setShowNewFolderInput] = useState(false); // Show input for new folder
  const [quizType, setQuizType] = useState(''); // 'enumeration', 'multiple-choice', 'identification', 'true-false'
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [opponentType, setOpponentType] = useState(''); // 'player' or 'ai'
  const [quizSetupStep, setQuizSetupStep] = useState(1); // 1 = file selection, 2 = quiz type, 3 = number of questions, 4 = opponent type
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showInvitePlayerModal, setShowInvitePlayerModal] = useState(false); // Room code modal for invite player
  const aiSimulationCleanupRef = useRef(null); // Store cleanup function for AI simulation
  
  // Collaborative Study States
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [showRoomBrowserModal, setShowRoomBrowserModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState('');
  const [joinRoomError, setJoinRoomError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingRoomParticipants, setWaitingRoomParticipants] = useState([]);
  const [isWaitingRoomHost, setIsWaitingRoomHost] = useState(false);
  const waitingRoomPollIntervalRef = useRef(null);
  
  // Notification Modal States
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'
  
  // Get questions from location state (if coming from MyFiles)
  const reviewerQuestions = location.state?.questions || null;
  const reviewerSubject = location.state?.subject || null;

  // Sample questions (will be replaced by backend/AI or reviewer questions)
  const defaultQuestions = [
    {
      id: 1,
      question: 'What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      correctAnswer: 1,
      explanation: 'Binary search has O(log n) time complexity because it divides the search space in half at each step.'
    },
    {
      id: 2,
      question: 'Which data structure follows LIFO (Last In First Out) principle?',
      options: ['Queue', 'Stack', 'Array', 'Linked List'],
      correctAnswer: 1,
      explanation: 'Stack follows LIFO principle where the last element added is the first one to be removed.'
    },
    {
      id: 3,
      question: 'What is the main difference between SQL and NoSQL databases?',
      options: [
        'SQL is faster',
        'NoSQL uses tables, SQL uses documents',
        'SQL is relational, NoSQL is non-relational',
        'There is no difference'
      ],
      correctAnswer: 2,
      explanation: 'SQL databases are relational and use structured schemas, while NoSQL databases are non-relational and use flexible schemas.'
    },
    {
      id: 4,
      question: 'What does HTTP stand for?',
      options: [
        'HyperText Transfer Protocol',
        'HyperText Transmission Protocol',
        'High Transfer Text Protocol',
        'Hyper Transfer Text Protocol'
      ],
      correctAnswer: 0,
      explanation: 'HTTP stands for HyperText Transfer Protocol, the foundation of data communication for the World Wide Web.'
    },
    {
      id: 5,
      question: 'Which algorithm is used for finding the shortest path in a graph?',
      options: ['BFS', 'DFS', "Dijkstra's Algorithm", 'Merge Sort'],
      correctAnswer: 2,
      explanation: "Dijkstra's algorithm is used to find the shortest path between nodes in a graph."
    }
  ];

  // Use reviewer questions if available, otherwise use default questions
  const [sampleQuestions, setSampleQuestions] = useState(() => {
    if (reviewerQuestions && reviewerQuestions.length > 0) {
      // Convert reviewer questions to the format expected by GroupStudy
      return reviewerQuestions.map((q, index) => ({
        id: index + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'No explanation available.'
      }));
    }
    return defaultQuestions;
  });

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('groupStudy')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  // Fetch available rooms from database
  useEffect(() => {
    const fetchAvailableRooms = async () => {
      try {
        console.log('🔄 Fetching available rooms...');
        const response = await getAllStudyRooms();
        console.log('📥 Rooms API response:', response);
        
        if (response && response.success) {
          console.log(`✅ Found ${response.rooms?.length || 0} room(s)`);
          setAvailableRooms(response.rooms || []);
        } else {
          console.error('❌ Failed to fetch rooms:', response?.message);
          setAvailableRooms([]);
        }
      } catch (error) {
        console.error('❌ Error fetching available rooms:', error);
        console.error('Error details:', error.message);
        setAvailableRooms([]);
      }
    };

    fetchAvailableRooms();
    
    // Refresh rooms every 10 seconds
    const interval = setInterval(fetchAvailableRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fixed 20 seconds per question
  useEffect(() => {
    setTimePerQuestion(20);
    setTimeRemaining(20);
  }, [sampleQuestions.length]);

  // Update subject if coming from reviewer
  useEffect(() => {
    if (reviewerSubject) {
      setCompetitionSubject(reviewerSubject);
    }
  }, [reviewerSubject]);

  // Fetch files when quiz setup modal opens
  useEffect(() => {
    if (showQuizSetupModal && quizSetupStep === 1) {
      fetchFiles();
    }
  }, [showQuizSetupModal, quizSetupStep]);

  const fetchFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const filesResponse = await getFiles(userId);
      if (filesResponse.success && filesResponse.files) {
        const filesList = filesResponse.files;
        setFiles(filesList);
        
        // Group files by subject
        const grouped = {};
        filesList.forEach(file => {
          if (!grouped[file.subject]) {
            grouped[file.subject] = [];
          }
          grouped[file.subject].push({
            id: file._id,
            name: file.fileName,
            type: file.fileType,
            subject: file.subject,
            content: file.fileContent,
            hasContent: !!file.fileContent && file.fileContent.length > 50
          });
        });
        setFilesBySubject(grouped);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
      setFilesBySubject({});
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const foldersResponse = await getFolders(userId);
      if (foldersResponse.success && foldersResponse.folders) {
        setFolders(foldersResponse.folders.map(f => f.folderName));
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    }
  };

  // Fetch folders when upload section is shown
  useEffect(() => {
    if (showUploadSection) {
      fetchFolders();
    }
  }, [showUploadSection]);

  // Notification helper function
  const showNotificationModal = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    
    // Modal will only close when OK button is pressed
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      showNotificationModal('Please enter a folder name', 'error');
      return;
    }

    setIsCreatingFolder(true);
    try {
      const folderName = newFolderName.trim();
      const response = await createFolder({
        userId,
        folderName: folderName
      });

      if (response.success) {
        await fetchFolders();
        setUploadFolder(folderName);
        setNewFolderName('');
        setShowNewFolderInput(false);
        showNotificationModal(`Folder "${folderName}" created successfully!`, 'success');
      } else {
        showNotificationModal(response.message || 'Failed to create folder', 'error');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      showNotificationModal(`Failed to create folder: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUploadFile = async () => {
    if (!uploadFolder || !uploadFolder.trim()) {
      showNotificationModal('Please select or create a folder/subject first', 'error');
      return;
    }
    
    if (!uploadFile) {
      showNotificationModal('Please choose a file to upload', 'error');
      return;
    }

    const fileType = uploadFile.name.split('.').pop().toLowerCase();
    
    // Check if file type is supported
    const supportedTypes = ['txt', 'md', 'docx'];
    if (!supportedTypes.includes(fileType)) {
      showNotificationModal(`File type .${fileType} is not supported.\n\nSupported formats:\n• Word Document (.docx)\n• Text File (.txt)\n• Markdown (.md)`, 'error');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (uploadFile.size > maxSize) {
      showNotificationModal(`File is too large (${(uploadFile.size / 1024 / 1024).toFixed(2)}MB). Maximum file size is 10MB.`, 'error');
      return;
    }

    // Warn for very large files
    if (uploadFile.size > 5 * 1024 * 1024) {
      const proceed = window.confirm(`This file is large (${(uploadFile.size / 1024 / 1024).toFixed(2)}MB). Processing may take longer. Continue?`);
      if (!proceed) {
        return;
      }
    }

    setIsUploading(true);
    try {
      console.log('📤 Starting file upload...', {
        fileName: uploadFile.name,
        fileType: fileType,
        fileSize: uploadFile.size,
        folder: uploadFolder,
        userId: userId
      });

      // Read file content
      const reader = new FileReader();
      
      // For text files, read as text; for DOCX, read as data URL (base64)
      if (fileType === 'txt' || fileType === 'md') {
        reader.readAsText(uploadFile);
      } else if (fileType === 'docx') {
        reader.readAsDataURL(uploadFile);
      }
      
      reader.onload = async (e) => {
        try {
          let fileContent = e.target.result;
          console.log('📄 File content read, length:', fileContent?.length || 0);
          
          const response = await createFile({
            userId,
            fileName: uploadFile.name,
            fileContent: fileContent,
            fileType: fileType,
            subject: uploadFolder.trim(),
            size: uploadFile.size
          });

          console.log('📥 Upload response:', response);

          if (response.success) {
            // Refresh file list
            await fetchFiles();
            const uploadedFileName = uploadFile.name;
            const fileTypeName = fileType === 'docx' ? 'Word Document' : fileType.toUpperCase();
            
            setUploadFile(null);
            setUploadFolder('');
            setShowUploadSection(false);
            
            showNotificationModal(`${fileTypeName} file "${uploadedFileName}" uploaded successfully!\n\nThe file is now available for quiz generation.`, 'success');
          } else {
            console.error('❌ Upload failed:', response);
            showNotificationModal(response.message || 'Failed to upload file. Please check the console for details.', 'error');
          }
        } catch (error) {
          console.error('❌ Error uploading file:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response
          });
          const errorMessage = error.message || 'Failed to upload file';
          showNotificationModal(`Failed to upload file: ${errorMessage}\n\nPlease check:\n• Backend server is running\n• File is not corrupted\n• File contains readable text`, 'error');
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
        showNotificationModal('Error reading file. Please try again.', 'error');
        setIsUploading(false);
      };
    } catch (error) {
      console.error('❌ Error in handleUploadFile:', error);
      showNotificationModal(`Failed to upload file: ${error.message || 'Unknown error'}`, 'error');
      setIsUploading(false);
    }
  };

  // Handle Create Room (Auto-generate code like Google Meet)
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    setCreateRoomError('');

    try {
      // Auto-generate room name or use default
      const autoRoomName = `Study Room ${new Date().toLocaleTimeString()}`;
      console.log('Creating room with:', { userId, playerName, autoRoomName });
      
      const response = await createStudyRoom(userId, playerName, autoRoomName);
      console.log('Create room response:', response);
      
      if (response && response.success) {
        // Show room code modal instead of navigating immediately
        setCreatedRoomCode(response.room.roomCode);
        setShowCreateRoomModal(false);
        setShowRoomCodeModal(true);
      } else {
        const errorMsg = response?.message || 'Failed to create room';
        setCreateRoomError(errorMsg);
        showNotificationModal(errorMsg, 'error');
        console.error('Failed to create room:', response);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      let errorMsg = 'Failed to create room. ';
      if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
        errorMsg += 'Backend server may not be running. Please start the backend server.';
      } else if (error.message.includes('Route not found') || error.message.includes('404')) {
        errorMsg += 'Backend route not found. Please restart the backend server.';
      } else {
        errorMsg += error.message || 'Please check if backend is running.';
      }
      setCreateRoomError(errorMsg);
      showNotificationModal(errorMsg, 'error');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Copy room code to clipboard
  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(createdRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      
      // For Group Quiz, show waiting room modal after copying (same as 1v1)
      if (competitionType === 'group' && roomId) {
        setTimeout(() => {
          setShowRoomCodeModal(false);
          setShowWaitingRoom(true);
          setIsWaitingRoomHost(true);
          // Initialize with current user
          setWaitingRoomParticipants([{
            userId: userId,
            username: playerName,
            joinedAt: new Date()
          }]);
          // Start polling for players using roomId
          pollForGroupQuizPlayers(roomId);
        }, 1000); // 1 second delay to show "Copied!" feedback
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Enter waiting room
  const handleEnterWaitingRoom = () => {
    // Close any open modals
    setShowInvitePlayerModal(false);
    setShowRoomCodeModal(false);
    setShowWaitingRoom(true);
    
    // User is entering as host (they created the room)
    setIsWaitingRoomHost(true);
    
    // Initialize with current user
    setWaitingRoomParticipants([{
      userId: userId,
      username: playerName,
      joinedAt: new Date()
    }]);
    
    // Start polling for participants (works for both collaborative study and competition rooms)
    startWaitingRoomPolling();
  };

  // Start polling for room participants
  const startWaitingRoomPolling = () => {
    if (waitingRoomPollIntervalRef.current) {
      clearInterval(waitingRoomPollIntervalRef.current);
    }

    const pollRoom = async () => {
      try {
        const response = await getStudyRoom(createdRoomCode);
        if (response && response.success && response.room) {
          const participants = response.room.participants || [];
          setWaitingRoomParticipants(participants);
          
          // Check if user is host (by comparing userId with hostId)
          const isHost = response.room.hostId === userId || 
                        response.room.hostId === userId.toString();
          
          // If opponent joined (more than 1 participant), navigate to room
          // For host: wait for at least one other participant
          // For opponent: navigate once both are in the room
          if (participants.length >= 2) {
            stopWaitingRoomPolling();
            setShowWaitingRoom(false);
            navigate(`/study-room/${createdRoomCode}`, {
              state: {
                roomCode: createdRoomCode,
                isHost: isHost,
                room: response.room
              }
            });
          }
        }
      } catch (error) {
        console.error('Error polling room:', error);
      }
    };

    // Poll immediately, then every 2 seconds
    pollRoom();
    waitingRoomPollIntervalRef.current = setInterval(pollRoom, 2000);
  };

  // Stop polling for room participants
  const stopWaitingRoomPolling = () => {
    if (waitingRoomPollIntervalRef.current) {
      clearInterval(waitingRoomPollIntervalRef.current);
      waitingRoomPollIntervalRef.current = null;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopWaitingRoomPolling();
      // Cleanup group quiz polling
      if (groupQuizPollInterval) {
        clearInterval(groupQuizPollInterval);
        setGroupQuizPollInterval(null);
      }
    };
  }, [groupQuizPollInterval]);

  // Join room after showing code
  const handleJoinCreatedRoom = () => {
    navigate(`/study-room/${createdRoomCode}`, {
      state: {
        roomCode: createdRoomCode,
        isHost: true
      }
    });
  };

  // Handle Join Room (for both Study Together and Group Quiz)
  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setJoinRoomError('Please enter a room code');
      return;
    }

    setIsJoiningRoom(true);
    setJoinRoomError('');

    try {
      // If in competition mode, try joining competition first
      if (studyMode === 'competition') {
        const joinResponse = await joinCompetition({
          roomId: roomCode.trim(),
          userId,
          playerName
        });
        
        if (joinResponse.success) {
          setRoomId(joinResponse.competition.roomId);
          setSampleQuestions(joinResponse.competition.questions);
          setTimePerQuestion(20);
          setTimeRemaining(20);
          
          // If quiz already started, join immediately
          if (joinResponse.competition.status === 'in-progress') {
            setIsInCompetition(true);
            const opponent = joinResponse.competition.players?.find(p => p.userId !== userId);
            setCompetitionData({
              opponentName: competitionType === 'group' ? 'Group Quiz' : (opponent?.playerName || 'Opponent'),
              opponentAvatar: competitionType === 'group' ? '👥' : (opponent?.playerName?.charAt(0) || 'O'),
              totalQuestions: joinResponse.competition.questions.length,
              subject: joinResponse.competition.subject
            });
            setCurrentQuestionIndex(0);
            setScore(0);
            setOpponentScore(0);
            setAnsweredQuestions(new Set());
            setSelectedAnswer(null);
            setShowJoinRoomModal(false);
            return;
          } else {
            // Waiting for competition to start
            setShowJoinRoomModal(false);
            if (competitionType === 'group') {
              // For Group Quiz, show waiting room modal (same as 1v1)
              setCreatedRoomCode(joinResponse.competition.roomId);
              setShowWaitingRoom(true);
              setIsWaitingRoomHost(false); // Joining player is not host
              // Initialize with current user
              setWaitingRoomParticipants([{
                userId: userId,
                username: playerName,
                joinedAt: new Date()
              }]);
              // Start polling for players
              pollForGroupQuizPlayers(joinResponse.competition.roomId);
            } else {
              // For 1v1, show waiting room modal (same as Group Quiz)
              setCreatedRoomCode(joinResponse.competition.roomId);
              setShowWaitingRoom(true);
              setIsWaitingRoomHost(false); // Joining player is not host
              // Initialize with current user and existing players
              const existingPlayers = joinResponse.competition.players || [];
              const participants = existingPlayers.map(player => ({
                userId: player.userId?.toString() || player.userId,
                username: player.playerName,
                joinedAt: player.joinedAt || new Date()
              }));
              setWaitingRoomParticipants(participants);
              // Start polling for opponent
              pollForOpponent(joinResponse.competition.roomId);
            }
            return;
          }
        } else {
          setJoinRoomError(joinResponse.message || 'Competition room not found');
        }
      } else {
        // Join Study Together room
        const response = await joinStudyRoom(roomCode.trim().toUpperCase(), userId, playerName);
        
        if (response.success) {
          // Set the room code and show waiting room
          setCreatedRoomCode(response.room.roomCode);
          setShowJoinRoomModal(false);
          setShowWaitingRoom(true);
          
          // User is joining as opponent (not host)
          setIsWaitingRoomHost(false);
          
          // Initialize with current user and existing participants
          const participants = response.room.participants || [];
          setWaitingRoomParticipants(participants);
          
          // Start polling to check for when host starts the room or when both are ready
          startWaitingRoomPolling();
        } else {
          setJoinRoomError(response.message || 'Failed to join room');
        }
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setJoinRoomError(error.message || 'Room not found or has expired');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // Timer for each question - using setInterval for proper countdown
  useEffect(() => {
    if (isInCompetition && timeRemaining > 0 && !answeredQuestions.has(currentQuestionIndex)) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - mark as incorrect
            handleAnswerSelect(null, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isInCompetition, timeRemaining, currentQuestionIndex, answeredQuestions]);

  const handleStartCompetitionClick = () => {
    // For 1v1, show quiz setup modal first
    if (competitionType === '1v1') {
      setShowQuizSetupModal(true);
      setQuizSetupStep(1); // Start with file selection
      setSelectedFile(null);
      setQuizType('');
      setNumberOfQuestions(10);
      setOpponentType('');
      setSelectedSubject(null);
    } else {
      // For group quiz, start directly
      startCompetition();
    }
  };

  const handleFileSelect = (file) => {
    if (file.hasContent) {
      setSelectedFile(file);
      setQuizSetupStep(2); // Move to quiz type selection
    } else {
      showNotificationModal('This file does not have extractable content. Please select a different file.', 'error');
    }
  };

  const handleQuizTypeSelect = (type) => {
    setQuizType(type);
    setQuizSetupStep(3); // Move to number of questions step
  };

  const handleNumberOfQuestionsSelect = (count) => {
    setNumberOfQuestions(count);
    setQuizSetupStep(4); // Move to opponent type step
  };

  const handleOpponentTypeSelect = async (type) => {
    setOpponentType(type);
    
    if (type === 'player') {
      // Show room code modal for invite player
      setShowQuizSetupModal(false);
      // Create competition and show room code
      await createCompetitionForInvite();
    } else if (type === 'ai') {
      // Generate questions from file and start AI battle immediately
      setShowQuizSetupModal(false);
      await generateAndStartAIBattle();
    }
  };

  const createCompetitionForInvite = async () => {
    setIsWaitingForOpponent(true);
    setIsGeneratingQuestions(true);
    try {
      // Generate a random room code (6 characters)
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Generate questions from file first
      if (!selectedFile || !selectedFile.content) {
        throw new Error('No file selected or file content is missing');
      }

      // Map quiz types to API test types
      const testTypeMap = {
        'enumeration': 'fill_blank',
        'multiple-choice': 'multiple_choice',
        'identification': 'fill_blank',
        'true-false': 'true_false'
      };
      const apiTestType = testTypeMap[quizType] || 'multiple_choice';

      // Generate questions from file
      const generatedQuestions = await generateQuestionsFromFile(
        selectedFile.content,
        selectedFile.subject,
        numberOfQuestions,
        apiTestType
      );

      if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('Failed to generate questions from file');
      }

      // Format questions for competition
      const formattedQuestions = generatedQuestions.map(q => ({
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
      }));
      
      // Create competition with generated questions (use short roomCode as roomId)
      const createResponse = await createCompetition({
        userId,
        playerName,
        subject: selectedFile.subject,
        questions: formattedQuestions,
        quizType: quizType,
        numberOfQuestions: numberOfQuestions,
        opponentType: 'player',
        maxPlayers: 2,
        isGroupQuiz: false,
        roomId: roomCode // Use the short roomCode as roomId
      });

      if (createResponse.success) {
        setRoomId(createResponse.competition.roomId);
        setCreatedRoomCode(roomCode);
        setSampleQuestions(formattedQuestions);
        setCompetitionSubject(selectedFile.subject);
        setShowInvitePlayerModal(true);
        setIsWaitingForOpponent(false);
        // Start polling for opponent
        pollForOpponent(createResponse.competition.roomId);
      }
    } catch (error) {
      console.error('Error creating competition for invite:', error);
      showNotificationModal(`Failed to create competition: ${error.message || 'Please try again.'}`, 'error');
      setIsWaitingForOpponent(false);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const generateAndStartAIBattle = async () => {
    setIsGeneratingQuestions(true);
    setIsWaitingForOpponent(true);
    
    try {
      if (!selectedFile || !selectedFile.content) {
        throw new Error('No file selected or file content is missing');
      }

      // Map quiz types to API test types
      const testTypeMap = {
        'enumeration': 'fill_blank',
        'multiple-choice': 'multiple_choice',
        'identification': 'fill_blank',
        'true-false': 'true_false'
      };
      const apiTestType = testTypeMap[quizType] || 'multiple_choice';

      // Generate questions from file
      const generatedQuestions = await generateQuestionsFromFile(
        selectedFile.content,
        selectedFile.subject,
        numberOfQuestions,
        apiTestType
      );

      if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('Failed to generate questions from file');
      }

      // Format questions for competition
      const formattedQuestions = generatedQuestions.map(q => ({
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || ''
      }));

      // Create competition with AI opponent and generated questions
      const createResponse = await createCompetition({
        userId,
        playerName,
        subject: selectedFile.subject,
        questions: formattedQuestions,
        quizType: quizType,
        numberOfQuestions: numberOfQuestions,
        opponentType: 'ai',
        maxPlayers: 2,
        isGroupQuiz: false
      });

      if (createResponse.success) {
        setRoomId(createResponse.competition.roomId);
        const questions = createResponse.competition.questions;
        setSampleQuestions(questions);
        setCompetitionSubject(selectedFile.subject);

        // Start competition immediately with AI
        setTimePerQuestion(20);
        const calculatedTime = 20;
        setTimeRemaining(calculatedTime);
        setIsWaitingForOpponent(false);
        setIsInCompetition(true);
        
        const aiOpponent = createResponse.competition.players.find(p => p.isAI || p.playerName === 'AI Opponent');
        setCompetitionData({
          opponentName: aiOpponent?.playerName || 'AI Opponent',
          opponentAvatar: '🤖',
          totalQuestions: questions.length,
          subject: selectedFile.subject,
          isAI: true
        });
        
        setCurrentQuestionIndex(0);
        setScore(0);
        setOpponentScore(0);
        setAnsweredQuestions(new Set());
        setSelectedAnswer(null);
        
        // Start AI answer simulation
        if (aiSimulationCleanupRef.current) {
          aiSimulationCleanupRef.current();
        }
        aiSimulationCleanupRef.current = startAISimulation(createResponse.competition.roomId, questions);
      }
    } catch (error) {
      console.error('Error generating and starting AI battle:', error);
      let errorMessage = error.message || 'Please try again.';
      
      // Don't show error for AI configuration - fallback will work
      // Questions will be generated using fallback method
      
      showNotificationModal(`Failed to start AI battle: ${errorMessage}`, 'error');
      setIsWaitingForOpponent(false);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const startCompetition = async () => {
    setIsWaitingForOpponent(true);
    
    try {
      const isGroupQuiz = competitionType === 'group';
      const isAIOpponent = competitionType === '1v1' && opponentType === 'ai';

      // Skip auto-match if AI opponent is selected
      if (!isAIOpponent) {
        // First, try to find an existing waiting room (auto-match)
        // Only for 1v1 battles, not group quizzes
        let autoMatchResponse = null;
        if (competitionType === '1v1') {
          console.log('🔍 Attempting auto-match for 1v1 battle...');
          autoMatchResponse = await joinCompetition({
            userId,
            playerName,
            subject: competitionSubject,
            autoMatch: true // Enable automatic matching (1v1 only)
          });
        }

        if (autoMatchResponse && autoMatchResponse.success && autoMatchResponse.matched) {
          // Found a match! Join the existing room
          console.log('✅ Auto-matched with existing room!');
          setRoomId(autoMatchResponse.competition.roomId);
          const questions = autoMatchResponse.competition.questions;
          setSampleQuestions(questions);
          setTimePerQuestion(20);
          setTimeRemaining(20);
          
          setIsWaitingForOpponent(false);
          setIsInCompetition(true);
          const opponent = autoMatchResponse.competition.players.find(p => p.userId !== userId);
          setCompetitionData({
            opponentName: opponent?.playerName || 'Player2',
            opponentAvatar: opponent?.playerName?.charAt(0) || 'P2',
            totalQuestions: questions.length,
            subject: autoMatchResponse.competition.subject
          });
          setCurrentQuestionIndex(0);
          setScore(0);
          setOpponentScore(0);
          setAnsweredQuestions(new Set());
          setSelectedAnswer(null);
          return;
        }
      }

      // No match found (or AI selected), create new room
      console.log(isAIOpponent ? '🤖 Creating competition with AI opponent...' : '📝 No match found, creating new room...');
      
      // Generate short roomCode for group quiz or 1v1 with player opponent (not AI)
      let roomCodeForCompetition = null;
      if (isGroupQuiz || (!isAIOpponent && competitionType === '1v1')) {
        roomCodeForCompetition = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      
      const createResponse = await createCompetition({
        userId,
        playerName, // Pass playerName for AI competitions
        subject: competitionSubject,
        questions: sampleQuestions,
        quizType: competitionType === '1v1' ? quizType : undefined, // Pass quiz type for 1v1
        numberOfQuestions: competitionType === '1v1' ? numberOfQuestions : undefined, // Pass number of questions for 1v1
        opponentType: competitionType === '1v1' ? opponentType : undefined, // Pass opponent type for 1v1 ('player' or 'ai')
        maxPlayers: isGroupQuiz ? maxPlayers : 2,
        isGroupQuiz: isGroupQuiz,
        roomId: roomCodeForCompetition // Use short roomCode as roomId for group quiz and 1v1 with player
      });

      if (createResponse.success) {
        setRoomId(createResponse.competition.roomId);
        if (roomCodeForCompetition) {
          setCreatedRoomCode(roomCodeForCompetition);
        }
        const questions = createResponse.competition.questions;
        setSampleQuestions(questions);

        // Fixed 20 seconds per question
        setTimePerQuestion(20);
        const calculatedTime = 20;
        setTimeRemaining(calculatedTime);

        // For AI competitions, user is already added during creation, so skip join
        if (isAIOpponent) {
          // AI opponent: Start immediately (user already added)
          console.log('🤖 Starting competition with AI opponent...');
          setIsWaitingForOpponent(false);
          setIsInCompetition(true);
          const aiOpponent = createResponse.competition.players.find(p => p.isAI || p.playerName === 'AI Opponent');
          setCompetitionData({
            opponentName: aiOpponent?.playerName || 'AI Opponent',
            opponentAvatar: '🤖',
            totalQuestions: createResponse.competition.questions.length,
            subject: createResponse.competition.subject,
            isAI: true
          });
          setCurrentQuestionIndex(0);
          setScore(0);
          setOpponentScore(0);
          setTimeRemaining(calculatedTime);
          setAnsweredQuestions(new Set());
          setSelectedAnswer(null);
          // Start AI answer simulation
          if (aiSimulationCleanupRef.current) {
            aiSimulationCleanupRef.current(); // Cleanup previous simulation if any
          }
          aiSimulationCleanupRef.current = startAISimulation(createResponse.competition.roomId, questions);
        } else {
          // For regular competitions, join as first player
          const joinResponse = await joinCompetition({
            roomId: createResponse.competition.roomId,
            userId,
            playerName
          });

          if (joinResponse.success) {
            // For group quiz, show room code modal (same as 1v1)
            if (isGroupQuiz) {
              setIsWaitingForOpponent(false);
              // Show room code modal for group quiz (use short roomCode if available)
              if (roomCodeForCompetition) {
                setCreatedRoomCode(roomCodeForCompetition);
              } else {
                setCreatedRoomCode(createResponse.competition.roomId);
              }
              setShowRoomCodeModal(true);
              // Don't start polling yet - wait for user to copy code or click "Wait for Players"
            } else {
              // For 1v1 with real player, wait for opponent or start if already 2 players
              if (joinResponse.competition.players.length >= 2) {
                setIsWaitingForOpponent(false);
                setIsInCompetition(true);
                const opponent = joinResponse.competition.players.find(p => p.userId !== userId);
                setCompetitionData({
                  opponentName: opponent?.playerName || 'Player2',
                  opponentAvatar: opponent?.playerName?.charAt(0) || 'P2',
                  totalQuestions: joinResponse.competition.questions.length,
                  subject: joinResponse.competition.subject
                });
                setCurrentQuestionIndex(0);
                setScore(0);
                setOpponentScore(0);
                setTimeRemaining(calculatedTime);
                setAnsweredQuestions(new Set());
                setSelectedAnswer(null);
              } else {
                // Poll for opponent (with auto-match attempts)
                pollForOpponent(createResponse.competition.roomId);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error starting competition:', error);
      console.error('Error details:', error.message, error.stack);
      showNotificationModal(`Failed to start competition. ${error.message || 'Please try again.'}`, 'error');
      setIsWaitingForOpponent(false);
    }
  };

  // Poll for group quiz players (different from 1v1)
  const pollForGroupQuizPlayers = async (roomIdToPoll) => {
    // Clear any existing interval
    if (groupQuizPollInterval) {
      clearInterval(groupQuizPollInterval);
    }
    
    // Store interval reference for cleanup
    const pollInterval = setInterval(async () => {
      try {
        const response = await getCompetition(roomIdToPoll);
        if (response.success && response.competition) {
          const players = response.competition.players || [];
          const playerCount = players.length;
          const maxPlayers = response.competition.maxPlayers || 10;
          
          // Update player list for modal display
          const participants = players.map(player => ({
            userId: player.userId?.toString() || player.userId,
            username: player.playerName,
            joinedAt: player.joinedAt || new Date()
          }));
          setWaitingRoomParticipants(participants);
          setGroupQuizPlayers(players);
          console.log(`👥 Group quiz: ${playerCount}/${maxPlayers} players joined`);
          
          // Check if competition has started (host clicked start)
          if (response.competition.status === 'in-progress') {
            clearInterval(pollInterval);
            setGroupQuizPollInterval(null);
            setShowWaitingRoom(false);
            setIsWaitingForOpponent(false);
            setIsInCompetition(true);
            
            // Set up competition data
            const questions = response.competition.questions;
            setTimePerQuestion(20);
            setTimeRemaining(20);
            setSampleQuestions(questions);
            setCompetitionData({
              opponentName: 'Group Quiz',
              opponentAvatar: '👥',
              totalQuestions: questions.length,
              subject: response.competition.subject,
              isGroupQuiz: true
            });
            setCurrentQuestionIndex(0);
            setScore(0);
            setOpponentScore(0);
            setAnsweredQuestions(new Set());
            setSelectedAnswer(null);
          }
        }
      } catch (error) {
        console.error('Error polling for group quiz players:', error);
        clearInterval(pollInterval);
        setGroupQuizPollInterval(null);
      }
    }, 2000); // Poll every 2 seconds
    
    // Store interval for cleanup
    setGroupQuizPollInterval(pollInterval);
  };

  const pollForOpponent = async (roomIdToPoll) => {
    const maxAttempts = 60; // 60 seconds (increased for better matching)
    let attempts = 0;
    let autoMatchAttempts = 0;

    const pollInterval = setInterval(async () => {
      try {
        // Check if someone joined our room
        const response = await getCompetition(roomIdToPoll);
        if (response.success && response.competition) {
          // Update waiting room participants if modal is open
          if (showWaitingRoom) {
            const players = response.competition.players || [];
            const participants = players.map(player => ({
              userId: player.userId?.toString() || player.userId,
              username: player.playerName,
              joinedAt: player.joinedAt || new Date()
            }));
            setWaitingRoomParticipants(participants);
          }
          
          // Check if we have 2 players
          if (response.competition.players.length >= 2) {
            clearInterval(pollInterval);
            
            // Fixed 20 seconds per question
            const questions = response.competition.questions;
            setTimePerQuestion(20);
            
            // Close waiting room modal if open
            setShowWaitingRoom(false);
            setIsWaitingForOpponent(false);
            setIsInCompetition(true);
            const opponent = response.competition.players.find(p => p.userId !== userId);
            setCompetitionData({
              opponentName: opponent?.playerName || 'Player2',
              opponentAvatar: opponent?.playerName?.charAt(0) || 'P2',
              totalQuestions: questions.length,
              subject: response.competition.subject
            });
            setCurrentQuestionIndex(0);
            setScore(0);
            setOpponentScore(0);
            setTimeRemaining(20);
            setAnsweredQuestions(new Set());
            setSelectedAnswer(null);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            showNotificationModal('No opponent found after 60 seconds. You can try again or share your room code with a friend.', 'error');
            setShowWaitingRoom(false);
            setIsWaitingForOpponent(false);
          }
        }
        attempts++;
        
        // Every 5 seconds, also try auto-matching (in case someone else is looking)
        if (attempts % 5 === 0 && autoMatchAttempts < 3) {
          autoMatchAttempts++;
          console.log(`🔄 Auto-match attempt ${autoMatchAttempts}...`);
          // Note: Auto-match happens when others click "Start Competition"
        }
      } catch (error) {
        console.error('Error polling for opponent:', error);
        clearInterval(pollInterval);
        setShowWaitingRoom(false);
        setIsWaitingForOpponent(false);
      }
    }, 1000);
  };

  const handleAnswerSelect = async (answerIndex, timeUp = false) => {
    if (answeredQuestions.has(currentQuestionIndex) || !roomId) return;

    setSelectedAnswer(answerIndex);
    setAnsweredQuestions(prev => new Set([...prev, currentQuestionIndex]));

    const currentQuestion = sampleQuestions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    // Submit answer to backend
    try {
      const answerResponse = await submitAnswer({
        roomId,
        userId,
        questionId: currentQuestionIndex.toString(),
        answer: answerIndex,
        timeTaken: 30 - timeRemaining
      });

      if (answerResponse.success && answerResponse.isCorrect && !timeUp) {
        setScore(prev => prev + 1);
      }

      // Update opponent score from backend
      if (answerResponse.success) {
        updateOpponentScore();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      // Fallback to local logic
      if (isCorrect && !timeUp) {
        setScore(prev => prev + 1);
      }
    }

    // Move to next question after 2 seconds
    setTimeout(() => {
      if (currentQuestionIndex < sampleQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setTimeRemaining(timePerQuestion);
      } else {
        // Competition ended
        endCompetition();
      }
    }, 2000);
  };

  // AI Answer Simulation - answers questions as they appear
  const startAISimulation = (roomIdToSimulate, questions) => {
    const answeredQuestions = new Set(); // Track which questions AI has answered
    const timers = []; // Store all timers for cleanup
    
    const answerQuestion = async (questionIndex) => {
      // Don't answer if already answered or out of bounds
      if (answeredQuestions.has(questionIndex) || questionIndex >= questions.length) return;
      
      const question = questions[questionIndex];
      if (!question || !question.options) return;
      
      // Mark as answered to prevent duplicate answers
      answeredQuestions.add(questionIndex);
      
      // AI has 75% chance of getting it right (adjustable difficulty)
      const isCorrect = Math.random() < 0.75;
      let aiAnswer;
      
      if (isCorrect) {
        aiAnswer = question.correctAnswer;
      } else {
        // Pick a wrong answer randomly
        const wrongAnswers = question.options
          .map((_, idx) => idx)
          .filter(idx => idx !== question.correctAnswer);
        aiAnswer = wrongAnswers.length > 0 
          ? wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]
          : 0;
      }
      
      // AI answers after a random delay (3-15 seconds) to simulate thinking
      const delay = 3000 + Math.random() * 12000; // 3-15 seconds
      
      const timer = setTimeout(async () => {
        // Double-check competition is still active
        if (!isInCompetition || !roomId) return;
        
        // Submit AI answer to backend
        try {
          const timeTaken = Math.floor(3 + Math.random() * 12); // 3-15 seconds
          const answerResponse = await submitAnswer({
            roomId: roomIdToSimulate,
            userId: 'ai-opponent', // Special AI user ID
            questionId: questionIndex.toString(),
            answer: aiAnswer,
            timeTaken: timeTaken
          });
          
          // Update opponent score from backend
          if (answerResponse.success) {
            const compResponse = await getCompetition(roomIdToSimulate);
            if (compResponse.success) {
              const aiPlayer = compResponse.competition.players.find(p => p.isAI || p.playerName === 'AI Opponent');
              if (aiPlayer) {
                setOpponentScore(aiPlayer.score);
              }
            }
          }
        } catch (error) {
          console.error('Error submitting AI answer:', error);
        }
      }, delay);
      
      timers.push(timer);
    };
    
    // Answer the first question immediately
    answerQuestion(0);
    
    // Watch for question changes and answer new questions
    let lastQuestionIndex = 0;
    const checkQuestionChange = setInterval(() => {
      if (!isInCompetition || !roomId) {
        clearInterval(checkQuestionChange);
        return;
      }
      
      // If question changed, answer the new question
      if (currentQuestionIndex !== lastQuestionIndex && currentQuestionIndex < questions.length) {
        lastQuestionIndex = currentQuestionIndex;
        answerQuestion(currentQuestionIndex);
      }
    }, 500);
    
    // Return cleanup function
    return () => {
      clearInterval(checkQuestionChange);
      timers.forEach(timer => clearTimeout(timer));
    };
  };

  const updateOpponentScore = async () => {
    if (!roomId) return;

    try {
      const response = await getCompetition(roomId);
      if (response.success) {
        // Find opponent (either real player or AI)
        // First try to find a non-AI opponent (real player)
        let opponent = response.competition.players.find(p => 
          p.userId && p.userId.toString() !== userId && !p.isAI
        );
        
        // If no real player found, look for AI opponent
        if (!opponent) {
          opponent = response.competition.players.find(p => p.isAI || p.playerName === 'AI Opponent');
        }
        
        if (opponent) {
          setOpponentScore(opponent.score);
        }
      }
    } catch (error) {
      console.error('Error updating opponent score:', error);
    }
  };

  // Poll for opponent score updates
  useEffect(() => {
    if (isInCompetition && roomId && userId) {
      const scoreInterval = setInterval(() => {
        updateOpponentScore();
      }, 2000);

      return () => clearInterval(scoreInterval);
    }
  }, [isInCompetition, roomId, userId]);

  const endCompetition = async () => {
    setIsInCompetition(false);
    
    // Cleanup AI simulation
    if (aiSimulationCleanupRef.current) {
      aiSimulationCleanupRef.current();
      aiSimulationCleanupRef.current = null;
    }
    
    try {
      if (roomId) {
        await completeCompetition(roomId);
      }
    } catch (error) {
      console.error('Error completing competition:', error);
    }

    const winner = score > opponentScore ? 'You' : score < opponentScore ? competitionData?.opponentName : 'Tie';
    setTimeout(() => {
      showNotificationModal(`Competition ended!\n\nYour Score: ${score}/${sampleQuestions.length}\n${competitionData?.opponentName}'s Score: ${opponentScore}/${sampleQuestions.length}\n\nWinner: ${winner}`, 'success');
      setCompetitionData(null);
      setCurrentQuestionIndex(0);
      setScore(0);
      setOpponentScore(0);
      setAnsweredQuestions(new Set());
      setRoomId(null);
    }, 500);
  };

  const getCurrentQuestion = () => {
    return sampleQuestions[currentQuestionIndex];
  };

  const getAnswerClass = (index) => {
    if (!answeredQuestions.has(currentQuestionIndex)) {
      return selectedAnswer === index ? 'selected' : '';
    }

    const currentQuestion = getCurrentQuestion();
    if (index === currentQuestion.correctAnswer) {
      return 'correct';
    }
    if (selectedAnswer === index && index !== currentQuestion.correctAnswer) {
      return 'incorrect';
    }
    return '';
  };

  if (isWaitingForOpponent) {
    const isGroupQuizMode = competitionType === 'group';
    const playerCount = isGroupQuizMode ? groupQuizPlayers.length : 0;
    const maxPlayersForQuiz = isGroupQuizMode ? maxPlayers : 2;
    
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="waiting-container">
            <div className="waiting-spinner">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            {isGroupQuizMode ? (
              <>
                <h2>Waiting for players...</h2>
                <p>Share your room code: <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{createdRoomCode}</strong></p>
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--card-bg)', borderRadius: '0.75rem', minWidth: '300px' }}>
                  <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                    <strong>Players joined: {playerCount}/{maxPlayersForQuiz}</strong>
                  </p>
                  {groupQuizPlayers.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {groupQuizPlayers.map((player, index) => (
                        <div key={index} style={{ 
                          padding: '0.5rem', 
                          margin: '0.25rem 0', 
                          background: 'var(--bg-secondary)', 
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            background: 'var(--primary)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {player.playerName?.charAt(0) || 'P'}
                          </div>
                          <span>{player.playerName || `Player ${index + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Waiting for more players to join...
                </p>
              </>
            ) : (
              <>
                <h2>Finding an opponent...</h2>
                <p>Searching for available players to match with you...</p>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <p>💡 <strong>How matching works:</strong></p>
                  <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '0.5rem' }}>
                    <li>System automatically finds waiting players</li>
                    <li>Matches by same subject (if available)</li>
                    <li>If no match found, creates a room and waits</li>
                    <li>Others can join when they click "Start Competition"</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (isInCompetition && competitionData) {
    const currentQuestion = getCurrentQuestion();
    const progress = ((currentQuestionIndex + 1) / sampleQuestions.length) * 100;

    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="competition-container">
            {/* Competition Header */}
            <div className="competition-header">
              <div className="player-info">
                <div className="player-card you">
                  <div className="player-avatar">You</div>
                  <div className="player-name">You</div>
                  <div className="player-score">{score}</div>
                </div>
                <div className="vs-badge">VS</div>
                <div className="player-card opponent">
                  <div className="player-avatar">{competitionData.opponentAvatar}</div>
                  <div className="player-name">{competitionData.opponentName}</div>
                  <div className="player-score">{opponentScore}</div>
                </div>
              </div>
              <div className="competition-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-text">
                  Question {currentQuestionIndex + 1} of {sampleQuestions.length}
                </div>
              </div>
            </div>

            {/* Question Card */}
            <div className="question-card">
              <div className="question-header">
                <div className={`question-timer ${timeRemaining <= 10 ? 'timer-warning' : ''} ${timeRemaining === 0 ? 'timer-expired' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{timeRemaining}s</span>
                </div>
                <div className="question-number">Question {currentQuestionIndex + 1}</div>
              </div>

              <div className="question-content">
                <h2 className="question-text">{currentQuestion.question}</h2>
              </div>

              <div className="answers-grid">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    className={`answer-option ${getAnswerClass(index)}`}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={answeredQuestions.has(currentQuestionIndex)}
                  >
                    <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="answer-text">{option}</span>
                    {answeredQuestions.has(currentQuestionIndex) && index === currentQuestion.correctAnswer && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {answeredQuestions.has(currentQuestionIndex) && selectedAnswer === index && index !== currentQuestion.correctAnswer && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {answeredQuestions.has(currentQuestionIndex) && (
                <div className="answer-explanation">
                  <strong>Explanation:</strong> {currentQuestion.explanation}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Competition Lobby
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Group Study</h1>
            <p className="page-subtitle">Study together or compete with other students</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
          maxWidth: '800px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <button
            onClick={() => setStudyMode('competition')}
            style={{
              padding: '2rem',
              background: studyMode === 'competition' 
                ? 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.8))' 
                : 'var(--bg-card)',
              color: studyMode === 'competition' ? 'white' : 'var(--text-primary)',
              border: `2px solid ${studyMode === 'competition' ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: studyMode === 'competition' 
                ? '0 8px 20px rgba(59, 130, 246, 0.3)' 
                : '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              if (studyMode !== 'competition') {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (studyMode !== 'competition') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              background: studyMode === 'competition' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.6))',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17"/>
                <path d="M2 12L12 17L22 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Study Battle
              </div>
              <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
                Compete in quiz competitions
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setStudyMode('collaborative')}
            style={{
              padding: '2rem',
              background: studyMode === 'collaborative' 
                ? 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.8))' 
                : 'var(--bg-card)',
              color: studyMode === 'collaborative' ? 'white' : 'var(--text-primary)',
              border: `2px solid ${studyMode === 'collaborative' ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: studyMode === 'collaborative' 
                ? '0 8px 20px rgba(59, 130, 246, 0.3)' 
                : '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              if (studyMode !== 'collaborative') {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (studyMode !== 'collaborative') {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              background: studyMode === 'collaborative' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.6))',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Study Together
              </div>
              <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
                Collaborate and study synchronously
              </div>
            </div>
          </button>
        </div>

        {/* Competition Mode */}
        {studyMode === 'competition' && (
          <div style={{
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: '1fr',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            {/* Main Competition Card */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '2.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                textAlign: 'center',
                marginBottom: '2rem'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 1.5rem',
                  background: 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.6))',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                </div>
                <h2 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>Ready to compete?</h2>
                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  margin: 0
                }}>Test your knowledge against other students in real-time. Answer questions faster and more accurately to win!</p>
              </div>
              
              {reviewerQuestions && reviewerQuestions.length > 0 && (
                <div className="reviewer-info-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    <path d="M2 17L12 22L22 17"/>
                    <path d="M2 12L12 17L22 12"/>
                  </svg>
                  <span>Using reviewer: {reviewerQuestions.length} questions from {reviewerSubject || 'your file'}</span>
                </div>
              )}
              
              {/* Competition Type Selector */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'var(--bg-input)',
                borderRadius: '16px',
                border: '1px solid var(--border)'
              }}>
                <h4 style={{
                  marginBottom: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>Select Competition Type:</h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  <button
                    onClick={() => setCompetitionType('1v1')}
                    style={{
                      padding: '1.25rem',
                      background: competitionType === '1v1' 
                        ? 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.8))' 
                        : 'var(--bg-secondary)',
                      color: competitionType === '1v1' ? 'white' : 'var(--text-primary)',
                      border: `2px solid ${competitionType === '1v1' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: competitionType === '1v1' ? '600' : '500',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                      boxShadow: competitionType === '1v1' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (competitionType !== '1v1') {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (competitionType !== '1v1') {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚔️</div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>1v1 Battle</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>2 Players Only</div>
                  </button>
                  <button
                    onClick={() => setCompetitionType('group')}
                    style={{
                      padding: '1.25rem',
                      background: competitionType === 'group' 
                        ? 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.8))' 
                        : 'var(--bg-secondary)',
                      color: competitionType === 'group' ? 'white' : 'var(--text-primary)',
                      border: `2px solid ${competitionType === 'group' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: competitionType === 'group' ? '600' : '500',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                      boxShadow: competitionType === 'group' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (competitionType !== 'group') {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (competitionType !== 'group') {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👥</div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>Group Quiz</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Up to {maxPlayers} Players</div>
                  </button>
                </div>
                
                {competitionType === 'group' && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      Max Players: {maxPlayers}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>

              {/* Competition Rules Card */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, var(--primary), rgba(59, 130, 246, 0.8))',
                borderRadius: '16px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                {competitionType === '1v1' && (
                  <>
                    <h4 style={{
                      marginBottom: '1rem',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🎯</span> Automatic Matching Logic (1v1 Only)
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '1.5rem',
                      fontSize: '0.95rem',
                      lineHeight: '1.8',
                      listStyle: 'none'
                    }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Step 1:</strong> When you click "Start Competition", system first searches for waiting players
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Step 2:</strong> If found → Auto-match! Battle starts immediately
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Step 3:</strong> If not found → Creates your room and waits (up to 60 seconds)
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Step 4:</strong> When another player clicks "Start Competition", they'll find your room and join automatically
                      </li>
                      <li>
                        <strong>Matching Priority:</strong> Same subject first, then any available player
                      </li>
                    </ul>
                  </>
                )}
                
                {competitionType === 'group' && (
                  <>
                    <h4 style={{
                      marginBottom: '1rem',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>👥</span> Group Quiz (Quizizz-style)
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '1.5rem',
                      fontSize: '0.95rem',
                      lineHeight: '1.8',
                      listStyle: 'none'
                    }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>No Auto-Matching:</strong> Group quizzes use room codes
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Room Code:</strong> After creating, you'll get a room code to share
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Join via Code:</strong> Players join using the room code (like Quizizz)
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Real-time Leaderboard:</strong> See all players' scores as they answer
                      </li>
                      <li>
                        <strong>Multiple Players:</strong> Up to {maxPlayers} players can join
                      </li>
                    </ul>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '2rem'
              }}>
                <button
                  className="btn-start-competition"
                  onClick={handleStartCompetitionClick}
                  style={{
                    minWidth: '220px',
                    padding: '1rem 2rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {competitionType === 'group' ? 'Create Group Quiz' : 'Start Competition'}
                </button>
                
                {competitionType === '1v1' && (
                  <button
                    onClick={() => setShowJoinRoomModal(true)}
                    style={{
                      minWidth: '220px',
                      width: '100%',
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--primary)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                      <polyline points="10 17 15 12 10 7"/>
                      <line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    Join 1v1 Battle
                  </button>
                )}
                
                {competitionType === 'group' && (
                  <button
                    onClick={() => setShowJoinRoomModal(true)}
                    style={{
                      minWidth: '220px',
                      width: '100%',
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--primary)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                      <polyline points="10 17 15 12 10 7"/>
                      <line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                    Join Group Quiz
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collaborative Study Mode - Direct Study Rooms List */}
        {studyMode === 'collaborative' && (
          <div style={{
            display: 'grid',
            gap: '2rem',
            gridTemplateColumns: '1fr',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '20px',
              padding: '2.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--border)'
            }}>
            {/* Header with Create Button and Join Input */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '1.5rem',
              marginBottom: '1.5rem',
              paddingBottom: '1.5rem',
              borderBottom: '2px solid var(--border)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  📚 Study Rooms
                </h2>
                <button 
                  className="btn-primary" 
                  onClick={handleCreateRoom}
                  disabled={isCreatingRoom}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    whiteSpace: 'nowrap',
                    minWidth: '160px',
                    justifyContent: 'center'
                  }}
                >
                  {isCreatingRoom ? (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
                        <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"/>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Create New Room
                    </>
                  )}
                </button>
              </div>
              
              {/* Join Room Input */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                width: '100%',
                maxWidth: '600px'
              }}>
                <input
                  type="text"
                  placeholder="Enter room code (e.g., STUDY-ABC123)"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    if (joinRoomError) setJoinRoomError(''); // Clear error when typing
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && roomCode.trim()) {
                      handleJoinRoom();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    textTransform: 'uppercase',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
                <button
                  className="btn-primary"
                  onClick={handleJoinRoom}
                  disabled={!roomCode.trim() || isJoiningRoom}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.875rem 1.5rem',
                    whiteSpace: 'nowrap',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  {isJoiningRoom ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
                        <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"/>
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                      Join Room
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Error Message Display */}
            {joinRoomError && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {joinRoomError}
              </div>
            )}

            {/* Room List */}
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              {availableRooms.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No active rooms available</p>
                  <p style={{ fontSize: '0.9rem' }}>Create a new room to get started!</p>
                </div>
              ) : (
                availableRooms.map((room) => (
                  <div 
                    key={room.id}
                    onClick={() => {
                      // Show join room modal with pre-filled room code
                      if (room.roomCode || room.id) {
                        setRoomCode(room.roomCode || room.id);
                      } else {
                        setRoomCode('');
                      }
                      setJoinRoomError(''); // Clear any previous errors
                      setShowJoinRoomModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1.25rem',
                      marginBottom: '1rem',
                      background: 'var(--bg-input)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-input)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Subject Icon */}
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginRight: '1rem',
                      fontSize: '1.5rem',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                    }}>
                      📚
                    </div>

                    {/* Room Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                        {room.name || room.roomName || 'Study Room'}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Host: {room.host || room.hostName}
                        {room.participants !== undefined && ` • ${room.participants} participant${room.participants !== 1 ? 's' : ''}`}
                      </div>
                    </div>

                    {/* Player Count */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-primary)',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      marginRight: '1rem',
                      border: '1px solid var(--border)'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      {room.players || 0}/{room.maxPlayers || 10}
                    </div>

                    {/* Join Arrow */}
                    <div style={{ color: 'var(--primary)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        )}

        {/* Room Code Modal (Shown after creating room) */}
        {showRoomCodeModal && createdRoomCode && (
          <div className="modal-overlay" onClick={() => setShowRoomCodeModal(false)}>
            <div className="modal-content room-code-modal" onClick={(e) => e.stopPropagation()} style={{ 
              maxWidth: '600px',
              width: '90%',
              padding: '0'
            }}>
              <div className="modal-header" style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{competitionType === 'group' ? 'Group Quiz Created!' : 'Room Created!'}</h2>
                <button className="modal-close" onClick={() => setShowRoomCodeModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                {competitionType === 'group' && (
                  <div style={{ 
                    padding: '0.875rem', 
                    background: 'var(--bg-input)', 
                    borderRadius: '8px', 
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <p style={{ margin: '0 0 0.375rem 0' }}>👥 <strong>Group Quiz (Quizizz-style)</strong></p>
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>Share this code with up to {maxPlayers} players. Once everyone joins, you can start the quiz!</p>
                  </div>
                )}
                <div className="room-code-display" style={{ 
                  marginBottom: '0', 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%'
                }}>
                  {/* Room Code Box - Centered and Compact */}
                  <div style={{ 
                    width: '100%',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'center'
                  }}>
                    <div className="room-code-box" style={{ 
                      width: '100%',
                      maxWidth: '100%',
                      padding: '1.5rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1rem',
                      margin: '0 auto'
                    }}>
                      <span className="room-code-text" style={{ 
                        fontSize: '1.5rem', 
                        fontFamily: 'Courier New, monospace',
                        fontWeight: '600',
                        letterSpacing: '0.15em',
                        color: 'var(--primary)',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        width: '100%',
                        display: 'block'
                      }}>{createdRoomCode}</span>
                      <button 
                        className="btn-copy-code" 
                        onClick={handleCopyRoomCode}
                        title="Copy code"
                        style={{ 
                          padding: '0.625rem 1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}
                      >
                        {copiedCode ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Instruction Text - Below the code box, centered */}
                  <p style={{ 
                    fontSize: '0.95rem', 
                    color: 'var(--text-secondary)',
                    marginTop: '0',
                    marginBottom: '0',
                    lineHeight: '1.5',
                    textAlign: 'center',
                    width: '100%'
                  }}>
                    {competitionType === 'group' 
                      ? `Share this quiz code with up to ${maxPlayers} players` 
                      : 'Share this code with your friends'}
                  </p>
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', marginTop: '0', gap: '0.75rem' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowRoomCodeModal(false)} 
                  style={{ 
                    flex: 1,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Close
                </button>
                {competitionType === 'group' ? (
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setShowRoomCodeModal(false);
                      setShowWaitingRoom(true);
                      setIsWaitingRoomHost(true);
                      // Initialize with current user
                      setWaitingRoomParticipants([{
                        userId: userId,
                        username: playerName,
                        joinedAt: new Date()
                      }]);
                      // Start polling for players - quiz will start when host clicks start
                      if (roomId) {
                        pollForGroupQuizPlayers(roomId);
                      }
                    }}
                    style={{ 
                      flex: 1,
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    Wait for Players
                  </button>
                ) : (
                  <>
                    {/* Check if this is a collaborative study room */}
                    {studyMode === 'collaborative' || (createdRoomCode && createdRoomCode.startsWith('STUDY-')) ? (
                      <button 
                        className="btn-primary" 
                        onClick={handleEnterWaitingRoom}
                        style={{ 
                          flex: 1,
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21h18"/>
                          <path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/>
                          <path d="M9 21v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8"/>
                        </svg>
                        Enter Room
                      </button>
                    ) : (
                      <button 
                        className="btn-primary" 
                        onClick={handleEnterWaitingRoom}
                        style={{ 
                          flex: 1,
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21h18"/>
                          <path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/>
                          <path d="M9 21v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8"/>
                        </svg>
                        Enter room
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Join Room Modal */}
        {showJoinRoomModal && (
          <div className="modal-overlay" onClick={() => setShowJoinRoomModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
              maxWidth: '420px',
              width: '90%',
              padding: '0'
            }}>
              <div className="modal-header" style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                  {studyMode === 'competition' && competitionType === 'group' 
                    ? 'Join Group Quiz' 
                    : studyMode === 'competition' && competitionType === '1v1'
                    ? 'Join 1v1 Battle'
                    : 'Join Study Room'}
                </h2>
                <button className="modal-close" onClick={() => setShowJoinRoomModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.9rem', 
                    fontWeight: '500',
                    color: 'var(--text-primary)'
                  }}>
                    Enter Room Code
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={studyMode === 'competition' && competitionType === '1v1' 
                      ? 'e.g., BATTLE-ABC123' 
                      : studyMode === 'competition' && competitionType === 'group'
                      ? 'e.g., QUIZ-ABC123'
                      : 'e.g., STUDY-ABC123'}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                    style={{ 
                      textTransform: 'uppercase',
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.95rem'
                    }}
                  />
                  <p className="form-hint" style={{ 
                    fontSize: '0.8rem', 
                    marginTop: '0.5rem',
                    marginBottom: '0',
                    color: 'var(--text-secondary)'
                  }}>
                    {studyMode === 'competition' && competitionType === 'group' 
                      ? 'Enter the quiz room code from the host' 
                      : studyMode === 'competition' && competitionType === '1v1'
                      ? 'Enter the 1v1 battle room code from your opponent'
                      : 'Ask your friend for the room code'}
                  </p>
                </div>
                {joinRoomError && (
                  <div className="error-message" style={{ 
                    marginTop: '0.75rem',
                    fontSize: '0.85rem'
                  }}>
                    {joinRoomError}
                  </div>
                )}
              </div>
              <div className="modal-actions" style={{ 
                padding: '1rem 1.5rem 1.5rem 1.5rem', 
                marginTop: '0',
                display: 'flex',
                justifyContent: 'center',
                gap: '0.75rem'
              }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowJoinRoomModal(false)}
                  style={{ 
                    minWidth: '100px',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleJoinRoom}
                  disabled={isJoiningRoom}
                  style={{ 
                    minWidth: '100px',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isJoiningRoom ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room Browser Modal */}
        {showRoomBrowserModal && (
          <div className="modal-overlay" onClick={() => setShowRoomBrowserModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
              <div className="modal-header">
                <h2>📚 Study Rooms</h2>
                <button className="modal-close" onClick={() => setShowRoomBrowserModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body" style={{ padding: '0' }}>
                {/* Create Room Button at top */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setShowRoomBrowserModal(false);
                      handleCreateRoom();
                    }}
                    disabled={isCreatingRoom}
                    style={{ width: '100%' }}
                  >
                    {isCreatingRoom ? (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
                          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"/>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Create New Room
                      </>
                    )}
                  </button>
                </div>

                {/* Room List */}
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {availableRooms.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <p>No active rooms available</p>
                      <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Create a new room to get started!</p>
                    </div>
                  ) : (
                    availableRooms.map((room) => (
                      <div 
                        key={room.id}
                        onClick={() => {
                          // Close browser modal and show join room modal (user must enter code manually for security)
                          setShowRoomBrowserModal(false);
                          setRoomCode(''); // Clear room code - user must enter it manually
                          setShowJoinRoomModal(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '1rem 1.5rem',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-input)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Subject Icon */}
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: 'var(--primary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: '1rem',
                          fontSize: '1.2rem'
                        }}>
                          📚
                        </div>

                        {/* Room Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem' }}>
                            {room.name || room.roomName || 'Study Room'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Host: {room.host || room.hostName}
                            {room.participants !== undefined && ` • ${room.participants} participant${room.participants !== 1 ? 's' : ''}`}
                          </div>
                        </div>

                        {/* Player Count */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          padding: '0.5rem 1rem',
                          background: 'var(--bg-input)',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          {room.players}/{room.maxPlayers}
                        </div>

                        {/* Join Arrow */}
                        <div style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quiz Setup Modal (for 1v1) - 4 Steps: File -> Quiz Type -> Number -> Opponent */}
      {showQuizSetupModal && (
        <div className="modal-overlay" onClick={() => setShowQuizSetupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Quiz Setup</h3>
              <button className="modal-close" onClick={() => setShowQuizSetupModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* Step 1: File Selection */}
            {quizSetupStep === 1 ? (
              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: 0, textAlign: 'center', flex: 1 }}>Select File</h4>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowUploadSection(!showUploadSection)}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      fontSize: '0.9rem',
                      marginLeft: '1rem',
                      background: showUploadSection ? 'var(--primary)' : 'var(--bg-input)',
                      color: showUploadSection ? 'white' : 'var(--text-primary)'
                    }}
                  >
                    {showUploadSection ? '✕ Cancel' : '+ Upload File'}
                  </button>
                </div>

                {/* Upload Section */}
                {showUploadSection && (
                  <div style={{ 
                    padding: '1.5rem', 
                    background: 'var(--bg-input)', 
                    borderRadius: '8px', 
                    marginBottom: '1.5rem',
                    border: '2px solid var(--primary)'
                  }}>
                    <h5 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Upload New File</h5>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600' }}>
                          Select Folder/Subject:
                        </label>
                        {!showNewFolderInput && (
                          <button
                            type="button"
                            onClick={() => setShowNewFolderInput(true)}
                            style={{
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.8rem',
                              background: 'transparent',
                              border: '1px solid var(--primary)',
                              borderRadius: '4px',
                              color: 'var(--primary)',
                              cursor: 'pointer'
                            }}
                          >
                            + New Folder
                          </button>
                        )}
                      </div>
                      
                      {showNewFolderInput ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Enter folder name..."
                            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              color: 'var(--text-primary)',
                              fontSize: '0.9rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCreateFolder}
                            disabled={!newFolderName.trim() || isCreatingFolder}
                            className="btn-primary"
                            style={{ padding: '0.75rem 1rem' }}
                          >
                            {isCreatingFolder ? 'Creating...' : 'Create'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewFolderInput(false);
                              setNewFolderName('');
                            }}
                            className="btn-secondary"
                            style={{ padding: '0.75rem 1rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <select
                          value={uploadFolder}
                          onChange={(e) => setUploadFolder(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem'
                          }}
                        >
                          <option value="">-- Select a folder --</option>
                          {folders.map(folder => (
                            <option key={folder} value={folder}>{folder}</option>
                          ))}
                          {Object.keys(filesBySubject).map(subject => (
                            !folders.includes(subject) && (
                              <option key={subject} value={subject}>{subject}</option>
                            )
                          ))}
                        </select>
                      )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                        Choose File (DOCX, TXT, MD):
                      </label>
                      <input
                        type="file"
                        accept=".docx,.txt,.md"
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem'
                        }}
                      />
                      {uploadFile && (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          padding: '0.5rem', 
                          background: 'var(--bg-primary)', 
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}>
                          <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(2)} KB)
                        </div>
                      )}
                    </div>

                    <button
                      className="btn-primary"
                      onClick={handleUploadFile}
                      disabled={!uploadFolder || !uploadFile || isUploading}
                      style={{ width: '100%' }}
                    >
                      {isUploading ? 'Uploading...' : 'Upload File'}
                    </button>
                  </div>
                )}

                {isLoadingFiles ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="waiting-spinner"></div>
                    <p>Loading files...</p>
                  </div>
                ) : Object.keys(filesBySubject).length === 0 && !showUploadSection ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: '1rem' }}>No files available. Click "+ Upload File" above to add files.</p>
                  </div>
                ) : Object.keys(filesBySubject).length > 0 ? (
                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {Object.entries(filesBySubject).map(([subject, subjectFiles]) => (
                      <div key={subject} style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ 
                          fontSize: '0.9rem', 
                          fontWeight: '600', 
                          color: 'var(--text-secondary)', 
                          marginBottom: '0.75rem',
                          padding: '0.5rem',
                          background: 'var(--bg-input)',
                          borderRadius: '6px'
                        }}>
                          📂 {subject}
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                          {subjectFiles.map((file) => (
                            <button
                              key={file.id}
                              onClick={() => handleFileSelect(file)}
                              disabled={!file.hasContent}
                              style={{
                                padding: '1rem',
                                background: selectedFile?.id === file.id ? 'var(--primary)' : 'var(--bg-input)',
                                border: `2px solid ${selectedFile?.id === file.id ? 'var(--primary)' : 'var(--border)'}`,
                                borderRadius: '8px',
                                color: selectedFile?.id === file.id ? 'white' : 'var(--text-primary)',
                                cursor: file.hasContent ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s',
                                textAlign: 'center',
                                opacity: file.hasContent ? 1 : 0.5
                              }}
                              onMouseEnter={(e) => {
                                if (file.hasContent && selectedFile?.id !== file.id) {
                                  e.currentTarget.style.borderColor = 'var(--primary)';
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedFile?.id !== file.id) {
                                  e.currentTarget.style.borderColor = 'var(--border)';
                                  e.currentTarget.style.background = 'var(--bg-input)';
                                }
                              }}
                            >
                              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                {file.type === 'pdf' ? '📄' : file.type === 'docx' ? '📝' : '📄'}
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', wordBreak: 'break-word' }}>
                                {file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedFile && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--primary)', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
                    Selected: {selectedFile.name}
                    <button
                      onClick={() => setSelectedFile(null)}
                      style={{
                        marginLeft: '1rem',
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
                {selectedFile && (
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                      className="btn-primary"
                      onClick={() => setQuizSetupStep(2)}
                      disabled={!selectedFile}
                    >
                      Continue to Quiz Type →
                    </button>
                  </div>
                )}
              </div>
            ) : quizSetupStep === 2 ? (
              /* Step 2: Quiz Type Selection */
              <div className="modal-body">
                <h4 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Select Quiz Type</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <button
                    className="quiz-type-btn"
                    onClick={() => handleQuizTypeSelect('enumeration')}
                    style={{
                      padding: '1.5rem',
                      background: quizType === 'enumeration' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${quizType === 'enumeration' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: quizType === 'enumeration' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (quizType !== 'enumeration') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (quizType !== 'enumeration') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>Enumeration</div>
                  </button>
                  
                  <button
                    className="quiz-type-btn"
                    onClick={() => handleQuizTypeSelect('multiple-choice')}
                    style={{
                      padding: '1.5rem',
                      background: quizType === 'multiple-choice' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${quizType === 'multiple-choice' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: quizType === 'multiple-choice' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (quizType !== 'multiple-choice') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (quizType !== 'multiple-choice') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☑️</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>Multiple Choice</div>
                  </button>
                  
                  <button
                    className="quiz-type-btn"
                    onClick={() => handleQuizTypeSelect('identification')}
                    style={{
                      padding: '1.5rem',
                      background: quizType === 'identification' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${quizType === 'identification' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: quizType === 'identification' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (quizType !== 'identification') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (quizType !== 'identification') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>Identification</div>
                  </button>
                  
                  <button
                    className="quiz-type-btn"
                    onClick={() => handleQuizTypeSelect('true-false')}
                    style={{
                      padding: '1.5rem',
                      background: quizType === 'true-false' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${quizType === 'true-false' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: quizType === 'true-false' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (quizType !== 'true-false') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (quizType !== 'true-false') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓✗</div>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>True or False</div>
                  </button>
                </div>
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setQuizSetupStep(1)}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : quizSetupStep === 3 ? (
              /* Step 3: Number of Questions */
              <div className="modal-body">
                <h4 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Number of Questions</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[5, 10, 15, 20].map((count) => (
                    <button
                      key={count}
                      className="question-count-btn"
                      onClick={() => handleNumberOfQuestionsSelect(count)}
                      style={{
                        padding: '1.5rem',
                        background: numberOfQuestions === count ? 'var(--primary)' : 'var(--bg-input)',
                        border: `2px solid ${numberOfQuestions === count ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: '12px',
                        color: numberOfQuestions === count ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '1.25rem'
                      }}
                      onMouseEnter={(e) => {
                        if (numberOfQuestions !== count) {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (numberOfQuestions !== count) {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.background = 'var(--bg-input)';
                        }
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setQuizSetupStep(2)}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              /* Step 4: Opponent Type */
              <div className="modal-body">
                <h4 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Choose Your Opponent</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <button
                    className="opponent-type-btn"
                    onClick={() => handleOpponentTypeSelect('player')}
                    style={{
                      padding: '2rem',
                      background: opponentType === 'player' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${opponentType === 'player' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: opponentType === 'player' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (opponentType !== 'player') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (opponentType !== 'player') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>👥</div>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Invite Player</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Battle against another player</div>
                  </button>
                  
                  <button
                    className="opponent-type-btn"
                    onClick={() => handleOpponentTypeSelect('ai')}
                    style={{
                      padding: '2rem',
                      background: opponentType === 'ai' ? 'var(--primary)' : 'var(--bg-input)',
                      border: `2px solid ${opponentType === 'ai' ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      color: opponentType === 'ai' ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (opponentType !== 'ai') {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (opponentType !== 'ai') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-input)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🤖</div>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Fight AI</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Battle against computer</div>
                  </button>
                </div>
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setQuizSetupStep(3)}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Player Modal (Room Code) */}
      {showInvitePlayerModal && createdRoomCode && (
        <div className="modal-overlay" onClick={() => setShowInvitePlayerModal(false)}>
          <div className="modal-content room-code-modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '600px',
            width: '90%'
          }}>
            <div className="modal-header">
              <h2>Invite Player</h2>
              <button className="modal-close" onClick={() => setShowInvitePlayerModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="room-code-display" style={{ 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}>
                {/* Room Code Box - Centered and Compact */}
                <div style={{ 
                  width: '100%',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <div className="room-code-box" style={{ 
                    width: '100%',
                    maxWidth: '100%',
                    padding: '1.5rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    margin: '0 auto'
                  }}>
                    <span className="room-code-text" style={{ 
                      fontSize: '1.5rem', 
                      fontFamily: 'Courier New, monospace',
                      fontWeight: '600',
                      letterSpacing: '0.15em',
                      color: 'var(--primary)',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      width: '100%',
                      display: 'block'
                    }}>{createdRoomCode}</span>
                    <button 
                      className="btn-copy-code" 
                      onClick={handleCopyRoomCode}
                      title="Copy code"
                      style={{ 
                        padding: '0.625rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                      }}
                    >
                      {copiedCode ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Instruction Text - Below the code box, centered */}
                <p style={{ 
                  fontSize: '0.95rem', 
                  color: 'var(--text-secondary)',
                  marginTop: '0',
                  marginBottom: '0',
                  lineHeight: '1.5',
                  textAlign: 'center',
                  width: '100%'
                }}>
                  Share this code with your opponent
                </p>
              </div>
            </div>
            <div className="modal-actions" style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              justifyContent: 'flex-end',
              padding: '1rem 1.5rem 1.5rem 1.5rem'
            }}>
              <button className="btn-secondary" onClick={() => setShowInvitePlayerModal(false)}>
                Close
              </button>
              <button 
                className="btn-primary" 
                onClick={handleEnterWaitingRoom}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18"/>
                  <path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/>
                  <path d="M9 21v-8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8"/>
                </svg>
                Enter room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Room Modal */}
      {showWaitingRoom && createdRoomCode && (
        <div className="modal-overlay" onClick={() => {
          setShowWaitingRoom(false);
          stopWaitingRoomPolling();
        }}>
          <div className="modal-content room-code-modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: '600px',
            width: '90%'
          }}>
            <div className="modal-header">
              <h2>Waiting Room</h2>
              <button className="modal-close" onClick={() => {
                setShowWaitingRoom(false);
                stopWaitingRoomPolling();
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                gap: '1.5rem'
              }}>
                {/* Room Code Display */}
                <div style={{ 
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <div className="room-code-box" style={{ 
                    width: '100%',
                    maxWidth: '100%',
                    padding: '1.5rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    margin: '0 auto'
                  }}>
                    <span className="room-code-text" style={{ 
                      fontSize: '1.5rem', 
                      fontFamily: 'Courier New, monospace',
                      fontWeight: '600',
                      letterSpacing: '0.15em',
                      color: 'var(--primary)',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      width: '100%',
                      display: 'block'
                    }}>{createdRoomCode}</span>
                    <button 
                      className="btn-copy-code" 
                      onClick={handleCopyRoomCode}
                      title="Copy code"
                      style={{ 
                        padding: '0.625rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                      }}
                    >
                      {copiedCode ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Waiting Status */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div className="spinner" style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid var(--bg-secondary)',
                      borderTop: '3px solid var(--primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{ fontSize: '1rem' }}>
                      {competitionType === 'group' 
                        ? `Waiting for players to join... (${waitingRoomParticipants.length}/${maxPlayers})`
                        : isWaitingRoomHost 
                          ? 'Waiting for opponent to join...' 
                          : waitingRoomParticipants.length >= 2 
                            ? 'Both players ready! Starting room...' 
                            : 'Waiting for host to start the room...'}
                    </span>
                  </div>

                  {/* Participants List */}
                  <div style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    minHeight: '100px'
                  }}>
                    <p style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.75rem',
                      textAlign: 'center'
                    }}>
                      Participants ({waitingRoomParticipants.length}/{competitionType === 'group' ? maxPlayers : 2})
                    </p>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {waitingRoomParticipants.map((participant, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '6px'
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            {participant.username?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <span style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.95rem'
                          }}>
                            {participant.username || 'Unknown'}
                            {(participant.userId === userId || participant.userId?.toString() === userId?.toString()) && ' (You)'}
                          </span>
                        </div>
                      ))}
                      {waitingRoomParticipants.length < (competitionType === 'group' ? maxPlayers : 2) && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '6px',
                          opacity: 0.5
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            ?
                          </div>
                          <span style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.95rem',
                            fontStyle: 'italic'
                          }}>
                            {competitionType === 'group' 
                              ? 'Waiting for more players...' 
                              : 'Waiting for opponent...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: 'var(--text-secondary)',
                    marginTop: '0.5rem',
                    textAlign: 'center',
                    lineHeight: '1.5'
                  }}>
                    {isWaitingRoomHost 
                      ? 'Share the room code with your opponent. You\'ll be automatically taken to the room when they join.'
                      : 'You\'ve successfully joined the room! Waiting for the host to start the session. You\'ll be automatically taken to the room when ready.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              justifyContent: 'flex-end',
              padding: '1rem 1.5rem 1.5rem 1.5rem'
            }}>
              <button className="btn-secondary" onClick={() => {
                setShowWaitingRoom(false);
                stopWaitingRoomPolling();
              }}>
                Cancel
              </button>
            </div>
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
          if (!hasSeenTutorial('groupStudy')) {
            markTutorialAsSeen('groupStudy');
          }
        }}
        tutorial={tutorials.groupStudy}
      />

      {/* Notification Modal */}
      {showNotification && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div 
            className="notification-modal" 
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
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              {notificationType === 'success' ? 'Success!' : 'Error'}
            </h3>
            <div style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-line',
              textAlign: 'center',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {notificationMessage.split('\n').map((line, index) => (
                <div key={index} style={{ marginBottom: line.trim() === '' ? '0.5rem' : '0.25rem', textAlign: 'center' }}>
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
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupStudy;

