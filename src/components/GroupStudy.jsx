import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { createCompetition, joinCompetition, submitAnswer, completeCompetition, getCompetition, getFiles, createFile, getFolders, createFolder } from '../services/apiService';
import { createStudyRoom, joinStudyRoom, getAllStudyRooms } from '../services/apiService';
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
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

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
      // If in competition mode and group quiz, try joining competition first
      if (studyMode === 'competition' && competitionType === 'group') {
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
            setCompetitionData({
              opponentName: 'Group Quiz',
              opponentAvatar: '👥',
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
            // Waiting for quiz to start
            setShowJoinRoomModal(false);
            setIsWaitingForOpponent(true);
            pollForGroupQuizPlayers(joinResponse.competition.roomId);
            return;
          }
        } else {
          setJoinRoomError(joinResponse.message || 'Quiz room not found');
        }
      } else {
        // Join Study Together room
        const response = await joinStudyRoom(roomCode.trim().toUpperCase(), userId, playerName);
        
        if (response.success) {
          // Show success message before navigating
          showNotificationModal(`Joining ${response.room.name || 'Study Group'}...`, 'success');
          setShowJoinRoomModal(false);
          
          // Navigate to study room page after a short delay
          setTimeout(() => {
            navigate(`/study-room/${response.room.roomCode}`, {
              state: {
                room: response.room,
                isHost: false
              }
            });
          }, 1500);
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

  // Timer for each question
  useEffect(() => {
    if (isInCompetition && timeRemaining > 0 && !answeredQuestions.has(currentQuestionIndex)) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - mark as incorrect
            handleAnswerSelect(null, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearTimeout(timer);
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
      
      // Create competition with generated questions
      const createResponse = await createCompetition({
        userId,
        playerName,
        subject: selectedFile.subject,
        questions: formattedQuestions,
        quizType: quizType,
        numberOfQuestions: numberOfQuestions,
        opponentType: 'player',
        maxPlayers: 2,
        isGroupQuiz: false
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
      
      // Provide helpful instructions for API key errors
      if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('AI service not configured')) {
        errorMessage = `AI service not configured.\n\nTo fix this:\n1. Open server/.env file\n2. Replace "your-gemini-api-key-here" with your actual Gemini API key\n3. Get a FREE key from: https://aistudio.google.com/app/apikey\n4. Restart the backend server\n\nOr run: .\\setup-gemini-key.ps1`;
      }
      
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
      const createResponse = await createCompetition({
        userId,
        playerName, // Pass playerName for AI competitions
        subject: competitionSubject,
        questions: sampleQuestions,
        quizType: competitionType === '1v1' ? quizType : undefined, // Pass quiz type for 1v1
        numberOfQuestions: competitionType === '1v1' ? numberOfQuestions : undefined, // Pass number of questions for 1v1
        opponentType: competitionType === '1v1' ? opponentType : undefined, // Pass opponent type for 1v1 ('player' or 'ai')
        maxPlayers: isGroupQuiz ? maxPlayers : 2,
        isGroupQuiz: isGroupQuiz
      });

      if (createResponse.success) {
        setRoomId(createResponse.competition.roomId);
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
            // For group quiz, show room code and wait for players
            if (isGroupQuiz) {
              setIsWaitingForOpponent(false);
              // Show room code modal for group quiz
              setCreatedRoomCode(createResponse.competition.roomId);
              setShowRoomCodeModal(true);
              // Start polling for players
              pollForGroupQuizPlayers(createResponse.competition.roomId);
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
    const pollInterval = setInterval(async () => {
      try {
        const response = await getCompetition(roomIdToPoll);
        if (response.success && response.competition) {
          // Check if host wants to start (you can add a start button)
          // For now, just show player count
          const playerCount = response.competition.players.length;
          console.log(`👥 Group quiz: ${playerCount} players joined`);
          
          // Auto-start when at least 2 players (optional - you can make it manual)
          // if (playerCount >= 2 && response.competition.status === 'waiting') {
          //   // Host can manually start
          // }
        }
      } catch (error) {
        console.error('Error polling for group quiz players:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
    
    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  };

  const pollForOpponent = async (roomIdToPoll) => {
    const maxAttempts = 60; // 60 seconds (increased for better matching)
    let attempts = 0;
    let autoMatchAttempts = 0;

    const pollInterval = setInterval(async () => {
      try {
        // Check if someone joined our room
        const response = await getCompetition(roomIdToPoll);
        if (response.success && response.competition.players.length >= 2) {
          clearInterval(pollInterval);
          
          // Fixed 20 seconds per question
          const questions = response.competition.questions;
          setTimePerQuestion(20);
          
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
          setIsWaitingForOpponent(false);
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
        <div className="study-mode-selector">
          <button 
            className={`mode-btn ${studyMode === 'competition' ? 'active' : ''}`}
            onClick={() => setStudyMode('competition')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
              <path d="M2 17L12 22L22 17"/>
              <path d="M2 12L12 17L22 12"/>
            </svg>
            <span>Study Battle</span>
            <p>Compete in quiz competitions</p>
          </button>
          <button 
            className={`mode-btn ${studyMode === 'collaborative' ? 'active' : ''}`}
            onClick={() => setStudyMode('collaborative')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Study Together</span>
            <p>Collaborate and study synchronously</p>
          </button>
        </div>

        {/* Competition Mode */}
        {studyMode === 'competition' && (
          <div className="competition-lobby">
            <div className="lobby-card">
              <div className="lobby-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                  <path d="M2 17L12 22L22 17"/>
                  <path d="M2 12L12 17L22 12"/>
                </svg>
              </div>
              <h2>Ready to compete?</h2>
              <p>Test your knowledge against other students in real-time. Answer questions faster and more accurately to win!</p>
              
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
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Select Competition Type:</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCompetitionType('1v1')}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.75rem',
                      background: competitionType === '1v1' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: competitionType === '1v1' ? 'white' : 'var(--text-primary)',
                      border: '2px solid',
                      borderColor: competitionType === '1v1' ? 'var(--primary)' : 'var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: competitionType === '1v1' ? 'bold' : 'normal'
                    }}
                  >
                    ⚔️ 1v1 Battle
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                      2 Players Only
                    </div>
                  </button>
                  <button
                    onClick={() => setCompetitionType('group')}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.75rem',
                      background: competitionType === 'group' ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: competitionType === 'group' ? 'white' : 'var(--text-primary)',
                      border: '2px solid',
                      borderColor: competitionType === 'group' ? 'var(--primary)' : 'var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: competitionType === 'group' ? 'bold' : 'normal'
                    }}
                  >
                    👥 Group Quiz (Quizizz-style)
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                      Up to {maxPlayers} Players
                    </div>
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

              <div className="competition-rules">
                {competitionType === '1v1' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--primary)', borderRadius: '8px', color: 'white' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>🎯 Automatic Matching Logic (1v1 Only):</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', textAlign: 'left' }}>
                      <li><strong>Step 1:</strong> When you click "Start Competition", system first searches for waiting players</li>
                      <li><strong>Step 2:</strong> If found → Auto-match! Battle starts immediately</li>
                      <li><strong>Step 3:</strong> If not found → Creates your room and waits (up to 60 seconds)</li>
                      <li><strong>Step 4:</strong> When another player clicks "Start Competition", they'll find your room and join automatically</li>
                      <li><strong>Matching Priority:</strong> Same subject first, then any available player</li>
                    </ul>
                  </div>
                )}
                
                {competitionType === 'group' && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#10b981', borderRadius: '8px', color: 'white' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>👥 Group Quiz (Quizizz-style):</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', textAlign: 'left' }}>
                      <li><strong>No Auto-Matching:</strong> Group quizzes use room codes</li>
                      <li><strong>Room Code:</strong> After creating, you'll get a room code to share</li>
                      <li><strong>Join via Code:</strong> Players join using the room code (like Quizizz)</li>
                      <li><strong>Real-time Leaderboard:</strong> See all players' scores as they answer</li>
                      <li><strong>Multiple Players:</strong> Up to {maxPlayers} players can join</li>
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn-start-competition" onClick={handleStartCompetitionClick}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {competitionType === 'group' ? 'Create Group Quiz' : 'Start Competition'}
                </button>
                
                {competitionType === 'group' && (
                  <button 
                    className="btn-join-room" 
                    onClick={() => {
                      // Use join room modal but for group quiz
                      setShowJoinRoomModal(true);
                    }}
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      color: 'var(--text-primary)',
                      border: '2px solid var(--primary)'
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

        {/* Collaborative Study Mode */}
        {studyMode === 'collaborative' && (
          <div className="collaborative-lobby">
            <div className="lobby-card">
              <div className="lobby-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h2>Study Together</h2>
              <p>Create or join a study room to collaborate with other students. Share documents, take notes together, and study synchronously!</p>
              
              <div className="collaborative-features">
                <h3>Key Features:</h3>
                <ul>
                  <li>✏️ <strong>Shared Notes</strong> - Collaborate on study notes in real-time</li>
                  <li>💬 <strong>Live Chat</strong> - Discuss and ask questions together</li>
                  <li>📚 <strong>Document Sharing</strong> - Upload and share study materials</li>
                </ul>
                
                <h3 style={{ marginTop: '1.5rem' }}>Question Generation:</h3>
                <ul>
                  <li>🤖 <strong>AI Generation</strong> - Questions automatically generated from uploaded files</li>
                  <li>📁 <strong>File Selection</strong> - Choose which file to use for question generation</li>
                </ul>
              </div>

              <div className="room-actions">
                <button 
                  className="btn-create-room" 
                  onClick={() => setShowRoomBrowserModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                  Browse Study Rooms
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room Code Modal (Shown after creating room) */}
        {showRoomCodeModal && createdRoomCode && (
          <div className="modal-overlay" onClick={() => setShowRoomCodeModal(false)}>
            <div className="modal-content room-code-modal" onClick={(e) => e.stopPropagation()} style={{ 
              maxWidth: '450px',
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
                <div className="room-code-display" style={{ marginBottom: '0' }}>
                  <p className="room-code-label" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    {competitionType === 'group' ? `Share this quiz code with up to ${maxPlayers} players:` : 'Share this code with your friends:'}
                  </p>
                  <div className="room-code-box">
                    <span className="room-code-text" style={{ fontSize: '0.95rem', wordBreak: 'break-all' }}>{createdRoomCode}</span>
                    <button 
                      className="btn-copy-code" 
                      onClick={handleCopyRoomCode}
                      title="Copy code"
                      style={{ padding: '0.5rem' }}
                    >
                      {copiedCode ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {copiedCode && (
                    <p className="copy-success" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>✓ Code copied to clipboard!</p>
                  )}
                  <p className="room-code-hint" style={{ fontSize: '0.8rem', marginTop: '0.75rem', marginBottom: '0' }}>Your friends can join by entering this code</p>
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', marginTop: '0', gap: '0.75rem' }}>
                <button className="btn-secondary" onClick={() => setShowRoomCodeModal(false)} style={{ flex: 1 }}>
                  Close
                </button>
                {competitionType === 'group' ? (
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setShowRoomCodeModal(false);
                      // Start polling for players - quiz will start when host clicks start
                      pollForGroupQuizPlayers(createdRoomCode);
                    }}
                    style={{ flex: 1 }}
                  >
                    Wait for Players
                  </button>
                ) : (
                  <button 
                    className="btn-primary" 
                    onClick={handleJoinCreatedRoom}
                    style={{ flex: 1 }}
                  >
                    Enter Room
                  </button>
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
                  {studyMode === 'competition' && competitionType === 'group' ? 'Join Group Quiz' : 'Join Study Room'}
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
                    placeholder="e.g., STUDY-ABC123"
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
                    minWidth: '100px'
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleJoinRoom}
                  disabled={isJoiningRoom}
                  style={{ 
                    minWidth: '100px'
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
          <div className="modal-content room-code-modal" onClick={(e) => e.stopPropagation()}>
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
              <div className="room-code-display">
                <p className="room-code-label">Share this code with your opponent:</p>
                <div className="room-code-box">
                  <span className="room-code-text">{createdRoomCode}</span>
                  <button 
                    className="btn-copy-code" 
                    onClick={handleCopyRoomCode}
                    title="Copy code"
                  >
                    {copiedCode ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>
                {copiedCode && (
                  <p className="copy-success">✓ Code copied to clipboard!</p>
                )}
                <p className="room-code-hint">Waiting for opponent to join...</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowInvitePlayerModal(false)}>
                Close
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

