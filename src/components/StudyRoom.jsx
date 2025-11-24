import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getStudyRoom, joinStudyRoom, leaveStudyRoom, controlStudyTimer, startStudyRoomQuiz, submitQuizAnswer, nextQuizQuestion, endStudyRoomQuiz, shareFileInRoom, removeSharedFile, sendChatMessage, setRoomDocument, clearRoomDocument, setRoomReviewer, toggleReadyStatus, startStudySession } from '../services/apiService';
import { getFiles, createFile, getFolders, createFolder } from '../services/apiService';
import { generateQuestionsFromFile, createReviewerFromFile } from '../services/aiService';
import '../styles/StudyRoom.css';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const StudyRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
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
  const username = userData?.username || userData?.firstName || 'Player1';
  const [copiedCode, setCopiedCode] = useState(false);
  const timerIntervalRef = useRef(null);
  
  // Check if user is host from location state or room data
  const isHost = location.state?.isHost || (room?.hostId?.toString() === userId.toString());
  const [localTimeRemaining, setLocalTimeRemaining] = useState(0);
  
  // Quiz states
  const [showFileSelectionModal, setShowFileSelectionModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [testType, setTestType] = useState('multiple_choice');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const answerTimeRef = useRef(null);
  
  // File sharing states
  const [showShareFileModal, setShowShareFileModal] = useState(false);
  const [isSharingFile, setIsSharingFile] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // File upload states
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFolder, setUploadFolder] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [showQuickCreateFolder, setShowQuickCreateFolder] = useState(false);
  const [quickFolderName, setQuickFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showMyFilesList, setShowMyFilesList] = useState(false);
  
  // Document viewer states
  const [viewingFile, setViewingFile] = useState(null);
  const [viewMode, setViewMode] = useState('raw'); // 'raw' or 'reviewer'
  const [reviewerContent, setReviewerContent] = useState(null);
  const [isGeneratingReviewer, setIsGeneratingReviewer] = useState(false);
  
  // Full-screen reviewer UI states (matching Practice component)
  const [paperStyle, setPaperStyle] = useState('blank'); // 'blank', 'lined', 'grid'
  const [paperColor, setPaperColor] = useState('white'); // 'white', 'cream', 'blue', 'green', 'purple'
  const [reviewerViewMode, setReviewerViewMode] = useState('document'); // 'document' or 'flashcards'
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [timerPosition, setTimerPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Chat states
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showChat, setShowChat] = useState(false); // Collapsed by default
  const chatMessagesRef = useRef(null);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('studyRoom')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  // Poll for room updates every 2 seconds
  useEffect(() => {
    if (!roomCode) return;

    const fetchRoom = async () => {
      try {
        const response = await getStudyRoom(roomCode);
        if (response.success) {
          // Check if user is a participant or host
          const isParticipant = response.room.participants?.some(
            p => p.userId.toString() === userId.toString()
          );
          const isHost = response.room.hostId?.toString() === userId.toString();
          
          // Auto-join if not already a participant (but not if they're the host who should already be in)
          if (!isParticipant && !isHost) {
            console.log('🔄 User not in participants, auto-joining room...');
            try {
              const joinResponse = await joinStudyRoom(roomCode, userId, username);
              if (joinResponse.success) {
                console.log('✅ Auto-joined room successfully');
              }
            } catch (joinError) {
              console.error('⚠️ Auto-join failed (user may need to join manually):', joinError);
            }
          }
          
          setRoom(response.room);
          setError('');
          
          // Sync local timer with server timer
          if (response.room.studyTimer) {
            // Calculate time remaining based on server time
            if (response.room.studyTimer.isRunning && response.room.studyTimer.startedAt) {
              const startedAt = new Date(response.room.studyTimer.startedAt);
              const elapsed = Math.floor((new Date() - startedAt) / 1000);
              const remaining = Math.max(0, response.room.studyTimer.duration - elapsed);
              setLocalTimeRemaining(remaining);
            } else {
              setLocalTimeRemaining(response.room.studyTimer.timeRemaining || 0);
            }
          }
          
          // Update quiz state
          if (response.room.quiz && response.room.quiz.isActive) {
            const myAnswer = response.room.quiz.participantAnswers?.find(
              pa => pa.userId === userId
            );
            if (myAnswer) {
              setMyScore(myAnswer.score || 0);
              // Check if current question is already answered
              const currentQIndex = response.room.quiz.currentQuestionIndex || 0;
              const answered = myAnswer.answers?.find(a => a.questionIndex === currentQIndex);
              if (answered) {
                setAnswerSubmitted(true);
                setSelectedAnswer(answered.selectedAnswer);
              } else {
                setAnswerSubmitted(false);
                setSelectedAnswer(null);
              }
            }
          } else {
            setAnswerSubmitted(false);
            setSelectedAnswer(null);
          }
          
          // Sync current document from room
          if (response.room.currentDocument && response.room.currentDocument.fileId) {
            // Find the file in sharedFiles to get full data
            const sharedFile = response.room.sharedFiles?.find(
              sf => sf.fileId === response.room.currentDocument.fileId
            );
            if (sharedFile) {
              setViewingFile({
                fileId: sharedFile.fileId,
                fileName: sharedFile.fileName,
                fileContent: sharedFile.fileContent,
                fileType: sharedFile.fileType,
                subject: sharedFile.subject,
                sharedBy: sharedFile.sharedBy
              });
              setViewMode(response.room.currentDocument.viewMode || 'raw');
              
              // Sync reviewer content if available
              if (response.room.currentDocument.reviewerContent?.reviewContent) {
                setReviewerContent({
                  reviewContent: response.room.currentDocument.reviewerContent.reviewContent,
                  keyPoints: response.room.currentDocument.reviewerContent.keyPoints || []
                });
              } else if (response.room.currentDocument.viewMode === 'reviewer') {
                // Reviewer mode but no content yet - might be generating
                setReviewerContent(null);
              } else {
                setReviewerContent(null);
              }
            }
          } else {
            // Only clear if it was set from room (not if user manually closed)
            if (viewingFile && viewingFile.fileId && !viewingFile.manuallyClosed) {
              setViewingFile(null);
              setReviewerContent(null);
              setViewMode('raw');
            }
          }
        } else {
          setError(response.message || 'Room not found');
        }
      } catch (error) {
        console.error('Error fetching room:', error);
        setError(error.message || 'Failed to load room');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchRoom();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchRoom, 2000);

    return () => clearInterval(interval);
  }, [roomCode, userId]);

  // Local timer countdown (updates every second for smooth display)
  useEffect(() => {
    if (room?.studyTimer?.isRunning && localTimeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimeRemaining(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [room?.studyTimer?.isRunning, localTimeRemaining]);

  // Copy room code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Leave room
  const handleLeaveRoom = async () => {
    if (window.confirm('Are you sure you want to leave this study room?')) {
      try {
        await leaveStudyRoom(roomCode, userId);
        navigate('/group-study');
      } catch (error) {
        console.error('Error leaving room:', error);
        // Navigate anyway
        navigate('/group-study');
      }
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Control shared timer (host only)
  const handleTimerControl = async (action, duration = null) => {
    if (!isHost) {
      alert('Only the host can control the timer');
      return;
    }

    // Check if starting timer requires at least 2 participants
    if (action === 'start' && room?.participants && room.participants.length < 2) {
      alert('⏸️ Please wait for at least one more person to join before starting the timer.\n\nThis is a collaborative study session - invite your friends using the room code!');
      return;
    }

    try {
      await controlStudyTimer(roomCode, action, duration);
      // Room state will update via polling
    } catch (error) {
      console.error('Error controlling timer:', error);
      alert(error.message || 'Failed to control timer. Please try again.');
    }
  };

  // Load files for quiz selection
  const loadFiles = async () => {
    try {
      console.log('📂 Loading files for user:', userId);
      let response = await getFiles(userId);
      
      // If no files found with current userId, also check for 'demo-user' files
      // (for backward compatibility with files uploaded before userId fix)
      if (response.success && (!response.files || response.files.length === 0) && userId !== 'demo-user') {
        console.log('⚠️ No files found for current userId, checking demo-user files...');
        const demoResponse = await getFiles('demo-user');
        if (demoResponse.success && demoResponse.files && demoResponse.files.length > 0) {
          console.log(`✅ Found ${demoResponse.files.length} files from demo-user, using those`);
          response = demoResponse;
        }
      }
      
      if (response.success && response.files) {
        console.log(`✅ Loaded ${response.files.length} files from database`);
        setFiles(response.files);
        return response.files;
      } else {
        console.warn('⚠️ No files found or response unsuccessful');
        setFiles([]);
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading files:', error);
      setFiles([]);
      return [];
    }
  };

  // Open file selection modal
  const handleStartQuiz = () => {
    setShowFileSelectionModal(true);
    loadFiles();
  };

  // Generate questions and start quiz
  const handleGenerateAndStartQuiz = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    setIsGeneratingQuestions(true);
    try {
      // Get file content - check if it's a shared file or user's own file
      let fileContent = selectedFile.fileContent;
      let fileSubject = selectedFile.subject;
      
      // If it's a shared file from the room, use it directly
      if (selectedFile.isSharedFile) {
        fileContent = selectedFile.fileContent;
        fileSubject = selectedFile.subject;
      } else {
        // It's from user's own files, fetch if needed
        if (!fileContent || fileContent.length < 50) {
          const filesResponse = await getFiles(userId, selectedFile.subject);
          if (filesResponse.success && filesResponse.files) {
            const fileFromBackend = filesResponse.files.find(f => f._id === selectedFile._id);
            if (fileFromBackend && fileFromBackend.fileContent) {
              fileContent = fileFromBackend.fileContent;
            }
          }
        }
      }

      if (!fileContent || fileContent.length < 50) {
        throw new Error('File content is too short or missing');
      }

      // Generate questions
      const generatedQuestions = await generateQuestionsFromFile(
        fileContent,
        fileSubject,
        questionCount,
        testType
      );

      if (generatedQuestions && generatedQuestions.length > 0) {
        // Start quiz in room
        const startResponse = await startStudyRoomQuiz(
          roomCode,
          userId,
          generatedQuestions,
          fileSubject,
          testType
        );

        if (startResponse.success) {
          setShowFileSelectionModal(false);
          setSelectedFile(null);
        } else {
          alert(startResponse.message || 'Failed to start quiz');
        }
      } else {
        alert('Failed to generate questions. Please try again.');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert(error.message || 'Failed to generate questions');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Submit quiz answer
  const handleSubmitAnswer = async () => {
    if (selectedAnswer === null || answerSubmitted) return;

    const timeTaken = answerTimeRef.current ? Date.now() - answerTimeRef.current : 0;
    const currentQIndex = room?.quiz?.currentQuestionIndex || 0;

    try {
      const response = await submitQuizAnswer(
        roomCode,
        userId,
        currentQIndex,
        selectedAnswer,
        Math.floor(timeTaken / 1000)
      );

      if (response.success) {
        setAnswerSubmitted(true);
        setMyScore(response.score || 0);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer');
    }
  };

  // Next question (host only)
  const handleNextQuestion = async () => {
    if (!isHost) return;

    try {
      await nextQuizQuestion(roomCode, userId);
      setAnswerSubmitted(false);
      setSelectedAnswer(null);
      answerTimeRef.current = Date.now();
    } catch (error) {
      console.error('Error moving to next question:', error);
    }
  };

  // End quiz (host only)
  const handleEndQuiz = async () => {
    if (!isHost) return;

    if (window.confirm('Are you sure you want to end the quiz?')) {
      try {
        await endStudyRoomQuiz(roomCode, userId);
        setAnswerSubmitted(false);
        setSelectedAnswer(null);
      } catch (error) {
        console.error('Error ending quiz:', error);
      }
    }
  };

  // Start answer timer when question changes
  useEffect(() => {
    if (room?.quiz?.isActive && room?.quiz?.status === 'in-progress' && !answerSubmitted) {
      answerTimeRef.current = Date.now();
    }
  }, [room?.quiz?.currentQuestionIndex, answerSubmitted]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current && showChat) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [room?.chatMessages, showChat]);

  // Load files and folders when share file modal opens
  useEffect(() => {
    if (showShareFileModal) {
      console.log('📂 Share File modal opened, loading files and folders...');
      loadFolders();
      loadFiles();
    }
  }, [showShareFileModal]);

  // Share file in room
  const handleShareFile = async (fileId) => {
    if (isSharingFile) return;
    
    setIsSharingFile(true);
    try {
      console.log(`📤 Sharing file in room: ${roomCode}, fileId: ${fileId}`);
      const response = await shareFileInRoom(roomCode, userId, username, fileId);
      if (response.success) {
        // Success - room will update via polling
        const fileName = files.find(f => f._id === fileId)?.fileName || 'File';
        console.log(`✅ Successfully shared file in database: ${fileName}`);
        // Don't close modal here if called from upload (it will close after upload)
        // Only close if called directly (not from upload flow)
        if (!isUploading) {
        setShowShareFileModal(false);
        }
        return true;
      } else {
        console.error('❌ Failed to share file:', response.message);
        alert(response.message || 'Failed to share file. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('❌ Error sharing file:', error);
      alert(`Failed to share file: ${error.message || 'Please check your connection and try again.'}`);
      return false;
    } finally {
      setIsSharingFile(false);
    }
  };

  // Load folders
  const loadFolders = async () => {
    try {
      const response = await getFolders(userId);
      if (response.success && response.folders) {
        setFolders(response.folders || []);
        return response.folders.map(f => f.subject || f.folderName).filter(Boolean);
      }
      return [];
    } catch (error) {
      console.error('Error loading folders:', error);
      return [];
    }
  };

  // Quick create folder
  const handleQuickCreateFolder = async () => {
    if (!quickFolderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    setIsCreatingFolder(true);
    try {
      console.log('📁 Creating folder:', quickFolderName.trim(), 'for user:', userId);
      const response = await createFolder({
        userId: userId,
        folderName: quickFolderName.trim()
      });
      if (response.success) {
        console.log('✅ Folder created successfully:', response.folder);
        setUploadFolder(quickFolderName.trim());
        setQuickFolderName('');
        setShowQuickCreateFolder(false);
        await loadFolders();
        await loadFiles();
      } else {
        console.error('❌ Folder creation failed:', response.message);
        alert(response.message || 'Failed to create folder');
      }
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      // Show more detailed error message
      const errorMessage = error.message || error.response?.message || 'Failed to create folder. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle file upload
  const handleUploadFile = async () => {
    if (!uploadFolder || !uploadFile) {
      alert('Please select a folder and choose a file');
      return;
    }

    const fileType = uploadFile.name.split('.').pop().toLowerCase();
    
    // Check if file type is supported
    const supportedTypes = ['txt', 'md', 'docx'];
    if (!supportedTypes.includes(fileType)) {
      alert(`File type .${fileType} is not supported.\n\nSupported formats:\n• Word Document (.docx)\n• Text File (.txt)\n• Markdown (.md)`);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (uploadFile.size > maxSize) {
      alert(`File is too large (${(uploadFile.size / 1024 / 1024).toFixed(2)}MB). Maximum file size is 10MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      
      if (fileType === 'txt' || fileType === 'md') {
        reader.readAsText(uploadFile);
      } else if (fileType === 'docx') {
        reader.readAsDataURL(uploadFile);
      }
      
      reader.onload = async (e) => {
        try {
          let fileContent = e.target.result;
          
          const response = await createFile({
            userId,
            fileName: uploadFile.name,
            fileContent: fileContent,
            fileType: fileType,
            subject: uploadFolder,
            size: uploadFile.size
          });

          if (response.success) {
            console.log('✅ File uploaded successfully:', response.file?._id || response.fileId);
            
            // Refresh files list to get the latest data
            await loadFiles();
            
            // Auto-share the newly uploaded file
            const fileIdToShare = response.file?._id || response.fileId;
            if (fileIdToShare) {
              console.log('📤 Auto-sharing file:', fileIdToShare);
              // Small delay to ensure file is saved in database
              setTimeout(async () => {
                try {
                  const shareSuccess = await handleShareFile(fileIdToShare);
                  if (shareSuccess) {
                    console.log('✅ File uploaded and shared successfully in database');
                  }
                  // Reset upload state after sharing (regardless of share success)
                  setUploadFile(null);
                  setUploadFolder(null);
                  setShowQuickCreateFolder(false);
                  setQuickFolderName('');
                  setIsUploading(false);
                  // Close modal after successful upload and share
                  setShowShareFileModal(false);
                } catch (error) {
                  console.error('❌ Error auto-sharing file:', error);
                  // File is already uploaded to database, just reset state
                  setUploadFile(null);
                  setUploadFolder(null);
                  setShowQuickCreateFolder(false);
                  setQuickFolderName('');
                  setIsUploading(false);
                  // Still close modal since file was uploaded successfully
                  setShowShareFileModal(false);
                }
              }, 500);
            } else {
              // If file ID not in response, reload and find it
              console.log('⚠️ File ID not in response, searching for file...');
              await loadFiles();
              setTimeout(async () => {
                try {
                  const updatedFilesResponse = await getFiles(userId);
                  if (updatedFilesResponse.success && updatedFilesResponse.files) {
                    const newFile = updatedFilesResponse.files.find(
                      f => f.fileName === uploadFile.name && f.subject === uploadFolder
                    );
                    if (newFile) {
                      console.log('📤 Found file, auto-sharing:', newFile._id);
                      const shareSuccess = await handleShareFile(newFile._id);
                      if (shareSuccess) {
                        console.log('✅ File uploaded and shared successfully in database');
                      }
                    } else {
                      console.warn('⚠️ Could not find uploaded file in list');
                    }
                  }
                  // Reset upload state
                  setUploadFile(null);
                  setUploadFolder(null);
                  setShowQuickCreateFolder(false);
                  setQuickFolderName('');
                  setIsUploading(false);
                  // Close modal
                  setShowShareFileModal(false);
                } catch (error) {
                  console.error('❌ Error finding and sharing file:', error);
                  // Reset state even on error
                  setUploadFile(null);
                  setUploadFolder(null);
                  setShowQuickCreateFolder(false);
                  setQuickFolderName('');
                  setIsUploading(false);
                  // Still close modal since file was uploaded
                  setShowShareFileModal(false);
                }
              }, 500);
            }
          } else {
            console.error('❌ File upload failed:', response.message);
            alert(response.message || 'Failed to upload file');
            setIsUploading(false);
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          alert(`Failed to upload file: ${error.message || 'Please try again'}`);
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        console.error('FileReader error');
        alert('Error reading file. Please try again.');
        setIsUploading(false);
      };
    } catch (error) {
      console.error('Error in handleUploadFile:', error);
      alert(`Failed to upload file: ${error.message || 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  // Remove shared file
  const handleRemoveSharedFile = async (fileId) => {
    if (!window.confirm('Remove this shared file from the room?')) return;

    try {
      const response = await removeSharedFile(roomCode, fileId, userId);
      if (response.success) {
        // Room will update via polling
        if (viewingFile?.fileId === fileId) {
          setViewingFile(null);
          setReviewerContent(null);
          setViewMode('raw');
        }
      } else {
        alert(response.message || 'Failed to remove file');
      }
    } catch (error) {
      console.error('Error removing shared file:', error);
      alert('Failed to remove file');
    }
  };

  // View shared file (host can set as main document)
  const handleSetAsMainDocument = async (sharedFile, useReviewer = false) => {
    if (!isHost) {
      alert('Only the host can set the main document');
      return;
    }

    const viewMode = useReviewer ? 'reviewer' : 'raw';
    
    // Set document in room (syncs to all participants)
    try {
      const response = await setRoomDocument(roomCode, userId, sharedFile.fileId, viewMode);
      if (response.success) {
        setViewingFile(sharedFile);
        setViewMode(viewMode);
        
        if (useReviewer) {
          setIsGeneratingReviewer(true);
          try {
            const reviewer = await createReviewerFromFile(
              sharedFile.fileName,
              sharedFile.fileContent,
              sharedFile.subject,
              userId,
              sharedFile.fileId
            );
            if (reviewer && reviewer.reviewContent) {
              setReviewerContent(reviewer);
              // Save reviewer content to room so all participants can see it
              await setRoomReviewer(
                roomCode,
                userId,
                reviewer.reviewContent,
                reviewer.keyPoints || []
              );
            } else {
              alert('Failed to generate reviewer. Using raw file instead.');
              await setRoomDocument(roomCode, userId, sharedFile.fileId, 'raw');
              setViewMode('raw');
            }
          } catch (error) {
            console.error('Error generating reviewer:', error);
            alert('Failed to generate reviewer. Using raw file instead.');
            await setRoomDocument(roomCode, userId, sharedFile.fileId, 'raw');
            setViewMode('raw');
          } finally {
            setIsGeneratingReviewer(false);
          }
        } else {
          setReviewerContent(null);
        }
      }
    } catch (error) {
      console.error('Error setting document:', error);
      alert('Failed to set document');
    }
  };

  // Send chat message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatMessage.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      const response = await sendChatMessage(roomCode, userId, username, chatMessage);
      if (response.success) {
        setChatMessage('');
        // Room will update via polling
      } else {
        alert(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Toggle ready status
  const handleToggleReady = async () => {
    try {
      const response = await toggleReadyStatus(roomCode, userId);
      if (response.success) {
        // Room will update via polling
      } else {
        alert(response.message || 'Failed to toggle ready status');
      }
    } catch (error) {
      console.error('Error toggling ready status:', error);
      alert(error.message || 'Failed to toggle ready status');
    }
  };

  // Start study session (host only, requires all ready)
  const handleStartStudySession = async (duration = 25 * 60) => {
    try {
      const response = await startStudySession(roomCode, userId, duration);
      if (response.success) {
        // Room will update via polling, timer will start
      } else {
        alert(response.message || 'Failed to start study session');
      }
    } catch (error) {
      console.error('Error starting study session:', error);
      alert(error.message || 'Failed to start study session');
    }
  };

  // Helper functions for full-screen reviewer UI
  const cleanContent = (content) => {
    if (!content) return '';
    return content
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\n{3,}/g, '\n\n'); // Clean up extra newlines
  };

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

  // Reset flashcard index when reviewer content changes
  useEffect(() => {
    if (reviewerContent) {
      setFlashcardIndex(0);
    }
  }, [reviewerContent]);

  // Reset flashcard index when view mode changes
  useEffect(() => {
    if (reviewerViewMode === 'flashcards') {
      setFlashcardIndex(0);
    }
  }, [reviewerViewMode]);

  // Handle exit reviewer view
  const handleExitReviewer = () => {
    const timerRunning = room?.studyTimer?.isRunning;
    const totalDuration = room?.studyTimer?.duration || 0;
    const timeRemaining = localTimeRemaining || 0;
    const progressPercent = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;
    
    if (timerRunning || progressPercent > 5) {
      setShowExitConfirm(true);
    } else {
      // Exit directly if minimal progress
      setViewingFile(null);
      setReviewerContent(null);
      setViewMode('raw');
    }
  };

  const confirmExit = () => {
    setViewingFile(null);
    setReviewerContent(null);
    setViewMode('raw');
    setShowExitConfirm(false);
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading room...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="error-container">
            <h2>Room Not Found</h2>
            <p>{error || 'The room may have expired or been deleted.'}</p>
            <button className="btn-primary" onClick={() => navigate('/group-study')}>
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Check if we should hide sidebar (when in reviewer mode)
  const showFullScreenReviewer = viewingFile && viewMode === 'reviewer' && reviewerContent;

  return (
    <div>
      {!showFullScreenReviewer ? (
        <Sidebar />
      ) : (
        // Compact header only (no sidebar) - same as Practice
        <div className='dashboard-container'>
          <nav className="topnav" style={{ zIndex: 100 }}>
            <div className="nav-left">
              <div className="logo-nav" style={{ gap: '0.5rem' }}>
                <img src="../imgs/SpireWorksLogo.png" alt="SpireWorks Logo" style={{ width: '32px', height: '32px' }} />
                <h1 style={{ fontSize: '1.25rem' }}>SpireWorks</h1>
              </div>
            </div>
            <div className="nav-right" style={{ gap: '0.75rem' }}>
              <button 
                onClick={handleLeaveRoom}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Leave Room
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content" style={{ position: 'relative' }}>
        {!showFullScreenReviewer && (
          <div className="study-room-header">
            <div>
              <h1 className="page-title">Study Room</h1>
              <p className="page-subtitle">{room.roomName || 'Collaborative Study Session'}</p>
            </div>
            <button className="btn-leave-room" onClick={handleLeaveRoom}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Leave Room
            </button>
          </div>
        )}

        <React.Fragment>
        {viewingFile ? (
          /* Full Screen Document Viewer with Word-Inspired UI (when reviewer mode) */
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Draggable Timer - Only show when in reviewer mode and timer is active */}
            {viewMode === 'reviewer' && room?.studyTimer && (() => {
              const totalDuration = room.studyTimer.duration || 0;
              const timeRemaining = localTimeRemaining || 0;
              const progressPercent = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;
              const wordsRead = Math.floor((totalDuration - timeRemaining) / 60 * 200); // Estimate 200 words/min
              const focusScore = Math.min(100, Math.floor(progressPercent * 1.2)); // Focus score based on progress
              const isRunning = room.studyTimer.isRunning || false;
              
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
                      Study Session
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
                </div>
              );
            })()}

            {/* Full Screen Document Viewer */}
            <div className="document-viewer-container">
            {/* Document Header - Show different UI based on view mode */}
            {viewMode === 'reviewer' && reviewerContent ? (
              /* Word-Inspired Full-Screen Reviewer UI - Same as Practice */
              <div style={{
                position: 'fixed',
                top: '80px', // Below compact header
                left: 0, // No sidebar
                right: 0,
                bottom: 0,
                background: '#f5f5f5',
                zIndex: 50,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Word-like Toolbar */}
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
                        {viewingFile.fileName}
                      </div>
                      <div style={{ 
                        fontSize: '0.7rem', 
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        {viewingFile.subject}
                      </div>
                    </div>
                  </div>
                  
                  {/* Paper Style Selector */}
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
                    {['blank', 'lined', 'grid'].map((style) => (
                      <button
                        key={style}
                        onClick={() => setPaperStyle(style)}
                        style={{
                          background: paperStyle === style 
                            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                            : 'transparent',
                          color: paperStyle === style ? 'white' : '#64748b',
                          border: paperStyle === style ? 'none' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '0.375rem 0.75rem',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          transition: 'all 0.3s ease',
                          boxShadow: paperStyle === style 
                            ? '0 2px 8px rgba(59, 130, 246, 0.3)' 
                            : 'none',
                          transform: paperStyle === style ? 'scale(1.05)' : 'scale(1)',
                          textTransform: 'capitalize'
                        }}
                        title={`${style.charAt(0).toUpperCase() + style.slice(1)} Paper`}
                      >
                        {style}
                      </button>
                    ))}
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
                      onClick={() => setReviewerViewMode('document')}
                      style={{
                        background: reviewerViewMode === 'document' ? '#3b82f6' : 'transparent',
                        color: reviewerViewMode === 'document' ? 'white' : '#666',
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
                      onClick={() => setReviewerViewMode('flashcards')}
                      style={{
                        background: reviewerViewMode === 'flashcards' ? '#3b82f6' : 'transparent',
                        color: reviewerViewMode === 'flashcards' ? 'white' : '#666',
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
                    {['white', 'cream', 'blue', 'green', 'purple'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPaperColor(color)}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: paperColors[color].bg,
                          border: paperColor === color ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: paperColor === color 
                            ? '0 0 0 3px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transform: paperColor === color ? 'scale(1.1)' : 'scale(1)'
                        }}
                        title={`${color.charAt(0).toUpperCase() + color.slice(1)} Paper`}
                      />
                    ))}
                  </div>
                  
                  {/* Exit Button */}
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
                  paddingLeft: '3rem',
                  display: 'flex',
                  justifyContent: 'center',
                  position: 'relative',
                  minHeight: '100%'
                }}>
                  {reviewerViewMode === 'document' ? (
                    <div style={{
                      background: paperColors[paperColor].bg,
                      width: '100%',
                      maxWidth: '816px',
                      minHeight: 'calc(100vh + 500px)',
                      padding: '96px 96px 500px 80px',
                      boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                      fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                      fontSize: '11pt',
                      lineHeight: '1.5',
                      color: paperColors[paperColor].text,
                      position: 'relative',
                      filter: !room?.studyTimer?.isRunning && room?.studyTimer?.duration > 0 ? 'blur(4px)' : 'none',
                      transition: 'filter 0.3s ease',
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
                        backgroundAttachment: 'local'
                      } : paperStyle === 'grid' ? {
                        background: paperColors[paperColor].bg,
                        backgroundImage: `
                          linear-gradient(to right, ${paperColors[paperColor].line} 1px, transparent 1px),
                          linear-gradient(to bottom, ${paperColors[paperColor].line} 1px, transparent 1px)
                        `,
                        backgroundSize: '20px 20px',
                        backgroundPosition: '80px 96px',
                        backgroundRepeat: 'repeat',
                        backgroundAttachment: 'local'
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
                        {viewingFile.fileName}
                      </h1>

                      {/* Study Notes Content */}
                      {reviewerContent.reviewContent && (
                        <div style={{
                          marginBottom: '24pt',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word'
                        }}>
                          {cleanContent(reviewerContent.reviewContent)}
                        </div>
                      )}

                      {/* Key Points Section */}
                      {reviewerContent.keyPoints && reviewerContent.keyPoints.length > 0 && (
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
                            {reviewerContent.keyPoints.map((point, idx) => (
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
                      let flashcards = [];
                      if (reviewerContent.keyPoints && reviewerContent.keyPoints.length > 0) {
                        flashcards = reviewerContent.keyPoints.map((point, idx) => ({
                          type: 'keypoint',
                          number: idx + 1,
                          content: point
                        }));
                      } else {
                        const content = reviewerContent.reviewContent || '';
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
                      const isRunning = room?.studyTimer?.isRunning || false;
                      const totalDuration = room?.studyTimer?.duration || 0;

                      return (
                        <div style={{
                          width: '100%',
                          maxWidth: '900px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2rem',
                          padding: '2rem 0',
                          filter: !isRunning && totalDuration > 0 ? 'blur(4px)' : 'none',
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

                {/* Chat Sidebar in Reviewer Mode - Keep accessible */}
                {showChat && (
                  <div className="chat-sidebar-fullscreen" style={{
                    position: 'fixed',
                    right: 0,
                    top: '80px',
                    bottom: 0,
                    width: '350px',
                    background: 'var(--bg-card)',
                    borderLeft: '1px solid var(--border)',
                    zIndex: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div className="chat-sidebar-header">
                      <h3>💬 Chat ({room.chatMessages?.length || 0})</h3>
                      <button
                        onClick={() => setShowChat(false)}
                        className="btn-collapse-chat"
                        title="Collapse chat"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div 
                      ref={chatMessagesRef}
                      className="chat-messages-container"
                    >
                      {room.chatMessages && room.chatMessages.length > 0 ? (
                        room.chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`chat-message ${msg.userId === userId ? 'own' : 'other'}`}
                          >
                            <div className="chat-message-username">
                              {msg.username} {msg.userId === userId && '(You)'}
                            </div>
                            <div className="chat-message-text">{msg.message}</div>
                            <div className="chat-message-time">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '2rem 1rem' }}>
                          No messages yet. Start the conversation! 💬
                        </p>
                      )}
                    </div>
                    
                    <form onSubmit={handleSendMessage} className="chat-input-form">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={isSendingMessage}
                        className="chat-input"
                      />
                      <button
                        type="submit"
                        disabled={!chatMessage.trim() || isSendingMessage}
                        className="btn-send-message"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* Chat Toggle Button in Reviewer Mode */}
                {!showChat && (
                  <button
                    onClick={() => setShowChat(true)}
                    className="chat-toggle-btn"
                    title="Open chat"
                    style={{
                      position: 'fixed',
                      right: '24px',
                      bottom: '24px',
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      border: 'none',
                      color: 'white',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                    }}
                  >
                    💬
                    {room.chatMessages && room.chatMessages.length > 0 && (
                      <span className="chat-badge" style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        minWidth: '20px',
                        textAlign: 'center'
                      }}>
                        {room.chatMessages.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ) : (
              /* Original Document Viewer for Raw File Mode */
              <div>
                {/* Document Header */}
                <div className="document-viewer-header">
                  <div className="document-viewer-header-info">
                    <h2>📄 {viewingFile.fileName}</h2>
                    <p>
                      {viewingFile.subject} • {viewingFile.fileType.toUpperCase()} • Shared by {viewingFile.sharedBy.username}
                    </p>
                  </div>
                  <div className="document-viewer-header-controls">
                    {isHost && (
                      <div className="view-mode-toggle">
                        <button
                          onClick={async () => {
                            try {
                              await setRoomDocument(roomCode, userId, viewingFile.fileId, 'raw');
                              setViewMode('raw');
                            } catch (error) {
                              console.error('Error switching view mode:', error);
                            }
                          }}
                          className={`view-mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
                        >
                          📄 Raw File
                        </button>
                        <button
                          onClick={async () => {
                            if (!reviewerContent) {
                              await handleSetAsMainDocument(viewingFile, true);
                            } else {
                              try {
                                await setRoomDocument(roomCode, userId, viewingFile.fileId, 'reviewer');
                                setViewMode('reviewer');
                              } catch (error) {
                                console.error('Error switching view mode:', error);
                              }
                            }
                          }}
                          disabled={isGeneratingReviewer}
                          className={`view-mode-btn ${viewMode === 'reviewer' ? 'active' : ''}`}
                        >
                          {isGeneratingReviewer ? '⏳ Generating...' : '🤖 AI Reviewer'}
                        </button>
                      </div>
                    )}
                    {!isHost && (
                      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                        Viewing: {viewMode === 'raw' ? '📄 Raw File' : '🤖 AI Reviewer'}
                      </div>
                    )}
                    
                    {isHost && (
                      <button
                        onClick={async () => {
                          try {
                            await clearRoomDocument(roomCode, userId);
                            setViewingFile(null);
                            setReviewerContent(null);
                            setViewMode('raw');
                          } catch (error) {
                            console.error('Error clearing document:', error);
                          }
                        }}
                        className="btn-close-document"
                      >
                        ✕ Close
                      </button>
                    )}
                  </div>
                </div>

                {/* Document Content - Full Screen with Chat Sidebar */}
                <div className="document-content-wrapper">
                  {/* Document Content */}
                  <div className={`document-content-area ${showChat ? 'with-chat' : ''}`}>
                    {isGeneratingReviewer ? (
                      <div className="generating-reviewer">
                        <div className="spinner"></div>
                        <p>Generating AI reviewer...</p>
                      </div>
                    ) : (
                      <div className="document-content-card">
                        <div className="document-content-text">
                          {viewingFile.fileContent}
                        </div>
                      </div>
                    )}
                  </div>

              {/* Chat Sidebar in Full Screen */}
              {showChat && (
                <div className="chat-sidebar-fullscreen">
                  <div className="chat-sidebar-header">
                    <h3>💬 Chat ({room.chatMessages?.length || 0})</h3>
                    <button
                      onClick={() => setShowChat(false)}
                      className="btn-collapse-chat"
                      title="Collapse chat"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div 
                    ref={chatMessagesRef}
                    className="chat-messages-container"
                  >
                    {room.chatMessages && room.chatMessages.length > 0 ? (
                      room.chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`chat-message ${msg.userId === userId ? 'own' : 'other'}`}
                        >
                          <div className="chat-message-username">
                            {msg.username} {msg.userId === userId && '(You)'}
                          </div>
                          <div className="chat-message-text">{msg.message}</div>
                          <div className="chat-message-time">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '2rem 1rem' }}>
                        No messages yet. Start the conversation! 💬
                      </p>
                    )}
                  </div>
                  
                  <form onSubmit={handleSendMessage} className="chat-input-form">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isSendingMessage}
                      className="chat-input"
                    />
                    <button
                      type="submit"
                      disabled={!chatMessage.trim() || isSendingMessage}
                      className="btn-send-message"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* Chat Toggle Button in Full Screen */}
              {!showChat && (
                <button
                  onClick={() => setShowChat(true)}
                  className="chat-toggle-btn"
                  title="Open chat"
                >
                  💬
                  {room.chatMessages && room.chatMessages.length > 0 && (
                    <span className="chat-badge">
                      {room.chatMessages.length}
                    </span>
                  )}
                </button>
              )}
                </div>
              </div>
            )}
            </div>
          </div>
        ) : (
          /* Normal Layout with Sidebar */
          <div className="study-room-content" style={{ 
            display: 'grid', 
            gridTemplateColumns: '280px 1fr 350px', 
            gap: '1.5rem', 
            transition: 'all 0.3s' 
          }}>
            {/* Left Sidebar - Room Info & Participants */}
            <div className="room-sidebar">
            <div className="room-code-section">
              <h3>Room Code</h3>
              <div className="room-code-display">
                <span className="room-code-text">{room.roomCode}</span>
                <button 
                  className="btn-copy-code" 
                  onClick={handleCopyCode}
                  title="Copy code"
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
                <p className="copy-success">✓ Code copied!</p>
              )}
              <p className="room-code-hint">Share this code with your friends</p>
            </div>

            <div className="participants-section">
              <h3>Participants ({room.participants?.length || 0})</h3>
              <div className="participants-list">
                {room.participants && room.participants.length > 0 ? (
                  room.participants.map((participant, index) => (
                    <div 
                      key={index} 
                      className={`participant-item ${participant.userId === userId ? 'you' : ''} ${participant.userId === room.hostId ? 'host' : ''}`}
                    >
                      <div className="participant-avatar">
                        {participant.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="participant-info">
                        <span className="participant-name">
                          {participant.username}
                          {participant.userId === userId && ' (You)'}
                          {participant.userId === room.hostId && ' 👑'}
                        </span>
                        <span className="participant-status">
                          {participant.userId === room.hostId 
                            ? 'Host' 
                            : (participant.ready ? '✅ Ready' : '⏳ Not Ready')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-participants">No participants yet</p>
                )}
              </div>
            </div>

            {/* Shared Files Section */}
            <div className="shared-files-section" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3>Shared Files ({room.sharedFiles?.length || 0})</h3>
                <button
                  onClick={async () => {
                    setShowShareFileModal(true);
                    await loadFolders();
                    await loadFiles();
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Share a file from your My Files"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Share
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {room.sharedFiles && room.sharedFiles.length > 0 ? (
                  room.sharedFiles.map((sharedFile, index) => {
                    const canRemove = isHost || sharedFile.sharedBy.userId === userId;
                    return (
                      <div
                        key={index}
                        style={{
                          padding: '0.75rem',
                          background: 'var(--bg-input)',
                          borderRadius: '8px',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sharedFile.fileName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {sharedFile.subject} • {sharedFile.fileType.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Shared by {sharedFile.sharedBy.username}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Use buttons - Only visible to host */}
                          {isHost && (
                            <>
                              <button
                                onClick={() => handleSetAsMainDocument(sharedFile, false)}
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  background: viewingFile?.fileId === sharedFile.fileId && viewMode === 'raw' ? '#4caf50' : 'var(--primary)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                                title="Set as main document (Host only)"
                              >
                                📄 Use
                              </button>
                              <button
                                onClick={() => handleSetAsMainDocument(sharedFile, true)}
                                disabled={isGeneratingReviewer}
                                style={{
                                  padding: '0.4rem 0.6rem',
                                  background: viewingFile?.fileId === sharedFile.fileId && viewMode === 'reviewer' ? '#4caf50' : '#9c27b0',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  cursor: isGeneratingReviewer ? 'not-allowed' : 'pointer',
                                  fontWeight: '600',
                                  opacity: isGeneratingReviewer ? 0.6 : 1
                                }}
                                title="Generate AI reviewer and use (Host only)"
                              >
                                {isGeneratingReviewer ? '⏳' : '🤖 AI Review'}
                              </button>
                            </>
                          )}
                          {isHost && (
                            <button
                              onClick={() => handleRemoveSharedFile(sharedFile.fileId)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: 'transparent',
                                color: '#f44336',
                                border: '1px solid #f44336',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                              title="Remove shared file (Host only)"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                    No files shared yet. Click "Share" to add files from your My Files.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Area - Waiting Room */}
          <div className="room-main" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: 'calc(100vh - 200px)',
            background: 'var(--bg-card)'
          }}>
              {/* Waiting Room */}
              <div className="waiting-room">
              <div className="waiting-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h2>Waiting for others to join...</h2>
              <p>Share the room code with your study group to get started</p>
              
              {room.participants && room.participants.length === 1 && (
                <div className="waiting-message">
                  <p>👋 You're the first one here!</p>
                  <p>Invite your friends to join this study session.</p>
                </div>
              )}

              {room.participants && room.participants.length > 1 && (
                <div className="ready-message">
                  <p>✅ {room.participants.length} people in the room</p>
                  {(() => {
                    // Host is automatically ready, only count non-host participants
                    const nonHostParticipants = room.participants.filter(p => p.userId.toString() !== room.hostId.toString());
                    const readyCount = nonHostParticipants.filter(p => p.ready).length;
                    const allReady = nonHostParticipants.every(p => p.ready) && nonHostParticipants.length > 0;
                    return (
                      <p>
                        {allReady 
                          ? '🎉 Everyone is ready! Host can start the study session.' 
                          : `${readyCount}/${nonHostParticipants.length} participants ready`}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Ready/Start Buttons - Only show if no quiz active and no document viewing */}
              {!room?.quiz?.isActive && !viewingFile && (
                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  {!isHost ? (
                    // Non-host: Show Ready button
                    (() => {
                      const currentParticipant = room.participants?.find(p => p.userId === userId);
                      const isReady = currentParticipant?.ready || false;
                      return (
                        <button
                          onClick={handleToggleReady}
                          style={{
                            padding: '1rem 2rem',
                            background: isReady ? '#4caf50' : 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {isReady ? (
                            <>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Ready!
                            </>
                          ) : (
                            <>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              Mark as Ready
                            </>
                          )}
                        </button>
                      );
                    })()
                  ) : (
                    // Host: Show Start button (only when all non-host participants are ready)
                    (() => {
                      // Host is automatically ready, only check non-host participants
                      const nonHostParticipants = room.participants?.filter(p => p.userId.toString() !== room.hostId.toString()) || [];
                      const allReady = nonHostParticipants.every(p => p.ready) && nonHostParticipants.length > 0;
                      const readyCount = nonHostParticipants.filter(p => p.ready).length || 0;
                      const totalNonHost = nonHostParticipants.length || 0;
                      return (
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <button
                            onClick={() => handleStartStudySession(25 * 60)}
                            disabled={!allReady}
                            style={{
                              padding: '1rem 2rem',
                              background: allReady ? '#4caf50' : '#ccc',
                              color: 'white',
                              border: 'none',
                              borderRadius: '12px',
                              fontSize: '1.1rem',
                              fontWeight: '600',
                              cursor: allReady ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              margin: '0 auto',
                              transition: 'all 0.2s',
                              boxShadow: allReady ? '0 4px 12px rgba(76, 175, 80, 0.3)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (allReady) {
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Start Study Session
                          </button>
                          {!allReady && (
                            <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              Waiting for {totalNonHost - readyCount} more participant{totalNonHost - readyCount !== 1 ? 's' : ''} to be ready ({readyCount}/{totalNonHost})
                            </p>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Quiz Feature - Show quiz if active, otherwise show start button */}
              {room?.quiz?.isActive && room?.quiz?.status === 'in-progress' ? (
                <div style={{ 
                  marginTop: '2rem', 
                  padding: '2rem', 
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  borderRadius: '20px',
                  color: 'white',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>📝 Group Quiz</h3>
                    <p style={{ margin: 0, opacity: 0.9 }}>
                      Question {((room.quiz.currentQuestionIndex || 0) + 1)} of {room.quiz.questions?.length || 0}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      Your Score: {myScore} / {room.quiz.questions?.length || 0}
                    </p>
                  </div>

                  {room.quiz.questions && room.quiz.questions[room.quiz.currentQuestionIndex] && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', padding: '1.5rem', color: '#333' }}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                        {room.quiz.questions[room.quiz.currentQuestionIndex].question}
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {room.quiz.questions[room.quiz.currentQuestionIndex].options?.map((option, idx) => {
                          const isSelected = selectedAnswer === idx;
                          const isCorrect = idx === room.quiz.questions[room.quiz.currentQuestionIndex].correctAnswer;
                          const showResult = answerSubmitted;
                          
                          let bgColor = 'white';
                          let borderColor = '#ddd';
                          if (showResult) {
                            if (isCorrect) {
                              bgColor = '#4caf50';
                              borderColor = '#4caf50';
                            } else if (isSelected && !isCorrect) {
                              bgColor = '#f44336';
                              borderColor = '#f44336';
                            }
                          } else if (isSelected) {
                            bgColor = '#e3f2fd';
                            borderColor = '#2196f3';
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => !answerSubmitted && setSelectedAnswer(idx)}
                              disabled={answerSubmitted}
                              style={{
                                padding: '1rem',
                                background: bgColor,
                                border: `2px solid ${borderColor}`,
                                borderRadius: '8px',
                                textAlign: 'left',
                                cursor: answerSubmitted ? 'default' : 'pointer',
                                color: showResult && (isCorrect || (isSelected && !isCorrect)) ? 'white' : '#333',
                                fontWeight: isSelected ? '600' : '400',
                                transition: 'all 0.2s'
                              }}
                            >
                              {option}
                              {showResult && isCorrect && ' ✓'}
                              {showResult && isSelected && !isCorrect && ' ✗'}
                            </button>
                          );
                        })}
                      </div>

                      {answerSubmitted && room.quiz.questions[room.quiz.currentQuestionIndex].explanation && (
                        <div style={{ 
                          padding: '1rem', 
                          background: '#e3f2fd', 
                          borderRadius: '8px', 
                          marginBottom: '1rem',
                          border: '1px solid #2196f3'
                        }}>
                          <strong>Explanation:</strong> {room.quiz.questions[room.quiz.currentQuestionIndex].explanation}
                        </div>
                      )}

                      {!answerSubmitted ? (
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={selectedAnswer === null}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: selectedAnswer !== null ? '#2196f3' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: selectedAnswer !== null ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Submit Answer
                        </button>
                      ) : isHost && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          {room.quiz.currentQuestionIndex < room.quiz.questions.length - 1 ? (
                            <button
                              onClick={handleNextQuestion}
                              style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Next Question
                            </button>
                          ) : (
                            <button
                              onClick={handleEndQuiz}
                              style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              End Quiz
                            </button>
                          )}
                        </div>
                      )}

                      {answerSubmitted && !isHost && (
                        <p style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.8 }}>
                          Waiting for host to proceed...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Leaderboard */}
                  <div style={{ marginTop: '1.5rem', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>📊 Scores</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {room.quiz.participantAnswers?.sort((a, b) => b.score - a.score).map((pa, idx) => (
                        <div key={pa.userId} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          background: pa.userId === userId ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                          borderRadius: '6px'
                        }}>
                          <span>
                            {idx === 0 && '🥇 '}
                            {idx === 1 && '🥈 '}
                            {idx === 2 && '🥉 '}
                            {pa.username} {pa.userId === userId && '(You)'}
                          </span>
                          <strong>{pa.score} / {room.quiz.questions?.length || 0}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : room?.quiz?.status === 'completed' ? (
                <div style={{ 
                  marginTop: '2rem', 
                  padding: '2rem', 
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  borderRadius: '20px',
                  color: 'white',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>🎉 Quiz Completed!</h3>
                  <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '12px', padding: '1rem', marginTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0' }}>Final Scores</h4>
                    {room.quiz.participantAnswers?.sort((a, b) => b.score - a.score).map((pa, idx) => (
                      <div key={pa.userId} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '0.5rem',
                        marginBottom: '0.5rem',
                        background: pa.userId === userId ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                        borderRadius: '6px'
                      }}>
                        <span>
                          {idx === 0 && '🥇 '}
                          {idx === 1 && '🥈 '}
                          {idx === 2 && '🥉 '}
                          {pa.username} {pa.userId === userId && '(You)'}
                        </span>
                        <strong>{pa.score} / {room.quiz.questions?.length || 0}</strong>
                      </div>
                    ))}
                  </div>
                  {isHost && (
                    <button
                      onClick={() => {
                        setShowFileSelectionModal(true);
                        loadFiles();
                      }}
                      style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1.5rem',
                        background: 'white',
                        color: '#4facfe',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Start New Quiz
                    </button>
                  )}
                </div>
              ) : isHost && (
                <div style={{ 
                  marginTop: '2rem', 
                  padding: '1.5rem', 
                  background: 'var(--bg-input)', 
                  borderRadius: '12px',
                  border: '2px solid var(--primary)'
                }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    📝 Start Group Quiz
                  </h3>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Start a collaborative quiz session for all participants in this room. Everyone answers together and sees explanations.
                  </p>
                  <button
                    onClick={handleStartQuiz}
                    style={{
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      margin: '0 auto'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                      <path d="M2 17L12 22L22 17"/>
                      <path d="M2 12L12 17L22 12"/>
                    </svg>
                    Start Quiz Session
                  </button>
                </div>
              )}
              </div>
          </div>

          {/* Right Sidebar - Chat (Collapsible) */}
          <div style={{
            display: showChat ? 'flex' : 'none',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            height: '100%',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 200px)',
            maxHeight: 'calc(100vh - 200px)'
          }}>
                <div style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '2px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                    💬 Chat ({room.chatMessages?.length || 0})
                  </h3>
                  <button
                    onClick={() => setShowChat(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: 'white',
                      borderRadius: '6px',
                      padding: '0.4rem 0.6rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                    title="Collapse chat"
                  >
                    ✕
                  </button>
                </div>
                
                <div 
                  ref={chatMessagesRef}
                  style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  {room.chatMessages && room.chatMessages.length > 0 ? (
                    room.chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          background: msg.userId === userId ? 'var(--primary)' : 'var(--bg-input)',
                          color: msg.userId === userId ? 'white' : 'var(--text-primary)',
                          borderRadius: '8px',
                          alignSelf: msg.userId === userId ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          wordWrap: 'break-word'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem', fontWeight: '600' }}>
                          {msg.username} {msg.userId === userId && '(You)'}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>{msg.message}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.25rem' }}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '2rem 1rem' }}>
                      No messages yet. Start the conversation! 💬
                    </p>
                  )}
                </div>
                
                <form onSubmit={handleSendMessage} style={{ 
                  padding: '1rem', 
                  borderTop: '2px solid var(--border-color)',
                  display: 'flex',
                  gap: '0.5rem',
                  background: 'var(--bg-primary)'
                }}>
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isSendingMessage}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!chatMessage.trim() || isSendingMessage}
                    style={{
                      padding: '0.75rem 1.25rem',
                      background: (!chatMessage.trim() || isSendingMessage) ? '#ccc' : 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: (!chatMessage.trim() || isSendingMessage) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Send
                  </button>
                </form>
          </div>
        </div>
        )}
        
        {/* Chat Toggle Button (when collapsed) - Only show in normal layout */}
        {!viewingFile && !showChat && (
            <button
              onClick={() => setShowChat(true)}
              style={{
                position: 'fixed',
                right: '2rem',
                bottom: '2rem',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                zIndex: 1000,
                transition: 'all 0.2s'
              }}
              title="Open chat"
            >
              💬
              {room.chatMessages && room.chatMessages.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#f44336',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  {room.chatMessages.length}
                </span>
              )}
            </button>
          )}
        </React.Fragment>


        {/* Share File Modal */}
        {showShareFileModal && (
          <div 
            style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSharingFile) {
                setShowShareFileModal(false);
              }
            }}
          >
            <div 
              style={{
                background: 'var(--bg-card)',
                borderRadius: '20px',
                padding: '0',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                margin: '2rem auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '1.75rem 2rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(14, 165, 233, 0.05))'
              }}>
                <div style={{ flex: 1 }}>
            <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <h2 style={{ 
                      margin: 0, 
                      color: 'var(--text-primary)',
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      letterSpacing: '-0.02em'
                    }}>
                Share File in Room
              </h2>
                  </div>
                  <p style={{ 
                    margin: '0 0 0 3.25rem', 
                    color: 'var(--text-secondary)', 
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    opacity: 0.9
                  }}>
                    Share files from your library or upload new ones to collaborate with your study group
                  </p>
                </div>
                <button
                  onClick={() => !isSharingFile && setShowShareFileModal(false)}
                  disabled={isSharingFile}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: isSharingFile ? 'not-allowed' : 'pointer',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    width: '36px',
                    height: '36px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSharingFile) {
                      e.currentTarget.style.background = 'var(--bg-input)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* My Files Button Section */}
              <div style={{ 
                padding: '1.5rem 2rem',
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setShowMyFilesList(!showMyFilesList)}
                  disabled={isSharingFile}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    cursor: isSharingFile ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSharingFile) {
                      e.currentTarget.style.background = 'var(--bg-input)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSharingFile) {
                      e.currentTarget.style.background = 'var(--bg-card)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    flex: 1
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        marginBottom: '0.25rem',
                        color: 'var(--text-primary)'
                      }}>
                        My Files
                      </div>
                      <div style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        opacity: 0.85
                      }}>
                        {files.length} {files.length === 1 ? 'file' : 'files'} uploaded
                      </div>
                    </div>
                  </div>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="var(--text-secondary)" 
                    strokeWidth="2.5"
                    style={{
                      transform: showMyFilesList ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s ease',
                      flexShrink: 0
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {/* Expanded File List */}
                {showMyFilesList && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'var(--bg-input)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}>
                    {isSharingFile ? (
                      <div style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-secondary)'
                      }}>
                        <div className="spinner" style={{ 
                          width: '40px', 
                          height: '40px', 
                          margin: '0 auto 1rem',
                          borderWidth: '3px',
                          borderTopColor: 'var(--primary)'
                        }}></div>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>Sharing file...</p>
                      </div>
                    ) : files.length === 0 ? (
                      <div style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: 'var(--text-secondary)'
                      }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.8 }}>No files available. Upload files below or add them in My Files.</p>
                      </div>
                    ) : (() => {
                      // Group files by folder/subject
                      const filesByFolder = {};
                      files.forEach(file => {
                        const folder = file.subject || 'Uncategorized';
                        if (!filesByFolder[folder]) {
                          filesByFolder[folder] = [];
                        }
                        filesByFolder[folder].push(file);
                      });

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {Object.entries(filesByFolder).map(([folderName, folderFiles]) => (
                            <div key={folderName}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '1px solid var(--border)'
                              }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.8 }}>
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                </svg>
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  color: 'var(--text-primary)'
                                }}>
                                  {folderName}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-secondary)',
                                  marginLeft: 'auto',
                                  opacity: 0.7
                                }}>
                                  {folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {folderFiles.map((file) => {
                    const isAlreadyShared = room?.sharedFiles?.some(sf => sf.fileId === file._id);
                    return (
                      <button
                        key={file._id}
                                      onClick={() => !isAlreadyShared && !isSharingFile && handleShareFile(file._id)}
                        disabled={isSharingFile || isAlreadyShared}
                        style={{
                          width: '100%',
                                        padding: '0.875rem 1rem',
                                        background: isAlreadyShared 
                                          ? 'var(--bg-primary)' 
                                          : 'var(--bg-card)',
                                        color: isAlreadyShared 
                                          ? 'var(--text-secondary)' 
                                          : 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '10px',
                          textAlign: 'left',
                          cursor: (isSharingFile || isAlreadyShared) ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: isAlreadyShared ? 0.65 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        position: 'relative'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isSharingFile && !isAlreadyShared) {
                                          e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary), #0ea5e9)';
                                          e.currentTarget.style.color = 'white';
                                          e.currentTarget.style.borderColor = 'var(--primary)';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isSharingFile && !isAlreadyShared) {
                                          e.currentTarget.style.background = 'var(--bg-card)';
                                          e.currentTarget.style.color = 'var(--text-primary)';
                                          e.currentTarget.style.borderColor = 'var(--border)';
                                          e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                      }}
                                    >
                                      <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: isAlreadyShared 
                                          ? 'var(--bg-primary)' 
                                          : 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        opacity: isAlreadyShared ? 0.5 : 1
                                      }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isAlreadyShared ? 'var(--text-secondary)' : 'white'} strokeWidth="2">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                          <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                      </div>
                                      <div style={{ 
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{ 
                                          fontWeight: '600',
                                          fontSize: '0.9rem',
                                          marginBottom: '0.25rem',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {file.fileName}
                                        </div>
                                        <div style={{ 
                                          fontSize: '0.75rem', 
                                          opacity: 0.8,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem'
                                        }}>
                                          <span>{file.fileType?.toUpperCase() || 'FILE'}</span>
                                        </div>
                        </div>
                        {isAlreadyShared && (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.375rem',
                                          padding: '0.4rem 0.7rem',
                                          background: 'rgba(76, 175, 80, 0.2)',
                                          borderRadius: '6px',
                                          fontSize: '0.7rem',
                                          fontWeight: '600',
                                          color: '#4caf50',
                                          flexShrink: 0,
                                          whiteSpace: 'nowrap',
                                          border: '1px solid rgba(76, 175, 80, 0.3)'
                                        }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                          </svg>
                                          Shared
                          </div>
                        )}
                      </button>
                    );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Upload Section - Scrollable */}
              <div style={{
                flex: '1 1 auto',
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: 0,
                padding: '1.75rem 2rem',
                borderTop: '2px solid var(--border)',
                background: 'var(--bg-card)',
                paddingBottom: '2rem'
              }}>
                <div style={{
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(14, 165, 233, 0.15))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0,
                        color: 'var(--text-primary)',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        letterSpacing: '-0.01em'
                      }}>
                        Upload New File
                      </h3>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        opacity: 0.85
                      }}>
                        Upload and automatically share with the room
                      </p>
                    </div>
                  </div>
                </div>

                {/* Folder Selection */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.625rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Select Folder
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <style>{`
                        select.folder-select option {
                          background: var(--bg-input) !important;
                          color: var(--text-primary) !important;
                          padding: 0.5rem !important;
                        }
                        select.folder-select option:checked {
                          background: var(--primary) !important;
                          color: white !important;
                        }
                        select.folder-select option:hover {
                          background: var(--bg-primary) !important;
                          color: var(--text-primary) !important;
                        }
                      `}</style>
                      <select
                        className="folder-select"
                        value={uploadFolder || ''}
                        onChange={(e) => setUploadFolder(e.target.value)}
                        disabled={isUploading || isCreatingFolder}
                        style={{
                          flex: 1,
                          width: '100%',
                          padding: '0.875rem 1rem',
                          minHeight: '44px',
                          fontSize: '0.9rem',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          cursor: (isUploading || isCreatingFolder) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 1rem center',
                          paddingRight: '2.5rem',
                          fontWeight: '500',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => {
                          if (!isUploading && !isCreatingFolder) {
                            e.target.style.borderColor = 'var(--primary)';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            e.target.style.background = 'var(--bg-primary)';
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border)';
                          e.target.style.boxShadow = 'none';
                          e.target.style.background = 'var(--bg-input)';
                        }}
                      >
                        <option value="" style={{ color: 'var(--text-secondary)' }}>-- Select a folder --</option>
                        {folders.map(folder => (
                          <option 
                            key={folder._id} 
                            value={folder.subject || folder.folderName}
                            style={{ 
                              background: 'var(--bg-input)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {folder.subject || folder.folderName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => setShowQuickCreateFolder(!showQuickCreateFolder)}
                      disabled={isUploading || isCreatingFolder}
                      style={{
                        padding: '0.875rem 1.25rem',
                        height: '100%',
                        minHeight: '44px',
                        background: showQuickCreateFolder ? 'var(--bg-input)' : 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        cursor: (isUploading || isCreatingFolder) ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        boxSizing: 'border-box'
                      }}
                      onMouseEnter={(e) => {
                        if (!isUploading && !isCreatingFolder && !showQuickCreateFolder) {
                          e.currentTarget.style.background = 'var(--primary)';
                          e.currentTarget.style.color = 'white';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!showQuickCreateFolder) {
                          e.currentTarget.style.background = 'var(--bg-input)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {showQuickCreateFolder ? (
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                        ) : (
                          <>
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </>
                        )}
                      </svg>
                      {showQuickCreateFolder ? 'Cancel' : 'New Folder'}
                    </button>
                  </div>
                </div>

                {/* Quick Create Folder */}
                {showQuickCreateFolder && (
                  <div style={{
                    marginBottom: '1.25rem',
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(14, 165, 233, 0.08))',
                    borderRadius: '12px',
                    border: '1px solid var(--border)'
                  }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.625rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      New Folder Name
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        type="text"
                        value={quickFolderName}
                        onChange={(e) => setQuickFolderName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleQuickCreateFolder()}
                        disabled={isCreatingFolder}
                        placeholder="e.g., Mathematics, Physics..."
                        style={{
                          flex: 1,
                          padding: '0.875rem 1rem',
                          fontSize: '0.9rem',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          transition: 'all 0.2s',
                          fontWeight: '500'
                        }}
                        onFocus={(e) => {
                          if (!isCreatingFolder) {
                            e.target.style.borderColor = 'var(--primary)';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            e.target.style.background = 'var(--bg-card)';
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border)';
                          e.target.style.boxShadow = 'none';
                          e.target.style.background = 'var(--bg-primary)';
                        }}
                      />
                      <button
                        onClick={handleQuickCreateFolder}
                        disabled={isCreatingFolder || !quickFolderName.trim()}
                        style={{
                          padding: '0.875rem 1.5rem',
                          background: isCreatingFolder || !quickFolderName.trim() 
                            ? 'var(--bg-input)' 
                            : 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                          color: isCreatingFolder || !quickFolderName.trim() 
                            ? 'var(--text-secondary)' 
                            : 'white',
                          border: 'none',
                          borderRadius: '12px',
                          cursor: (isCreatingFolder || !quickFolderName.trim()) ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexShrink: 0,
                          boxShadow: (isCreatingFolder || !quickFolderName.trim()) 
                            ? 'none' 
                            : '0 2px 8px rgba(59, 130, 246, 0.25)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCreatingFolder && quickFolderName.trim()) {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = (isCreatingFolder || !quickFolderName.trim()) 
                            ? 'none' 
                            : '0 2px 8px rgba(59, 130, 246, 0.25)';
                        }}
                      >
                        {isCreatingFolder ? (
                          <>
                            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: 'white' }}></div>
                            Creating...
                          </>
                        ) : (
                          'Create'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.625rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Choose File
                  </label>
                  <div style={{
                    position: 'relative',
                    border: '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'var(--bg-input)',
                    transition: 'all 0.25s',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    minHeight: '140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!isUploading) {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                      e.currentTarget.style.borderStyle = 'solid';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.borderStyle = 'dashed';
                  }}
                  >
                    <input
                      type="file"
                      accept=".docx,.txt,.md"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      disabled={isUploading}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        top: 0,
                        left: 0,
                        opacity: 0,
                        cursor: isUploading ? 'not-allowed' : 'pointer'
                      }}
                    />
                    {uploadFile ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.875rem',
                          flex: 1,
                          minWidth: 0
                        }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                          }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: '600', 
                              fontSize: '0.95rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginBottom: '0.25rem',
                              color: 'var(--text-primary)'
                            }}>
                              {uploadFile.name}
                            </div>
                            <div style={{ 
                              fontSize: '0.8125rem', 
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <span>{(uploadFile.size / 1024).toFixed(2)} KB</span>
                              <span style={{ opacity: 0.5 }}>•</span>
                              <span>{uploadFile.name.split('.').pop().toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadFile(null);
                          }}
                          disabled={isUploading}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            width: '32px',
                            height: '32px'
                          }}
                          onMouseEnter={(e) => {
                            if (!isUploading) {
                              e.currentTarget.style.background = 'var(--bg-primary)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          width: '64px',
                          height: '64px',
                          margin: '0 auto 1rem',
                          borderRadius: '16px',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(14, 165, 233, 0.1))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ opacity: 0.8 }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <div style={{ 
                          fontWeight: '600', 
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          marginBottom: '0.375rem'
                        }}>
                          Click to choose file
                        </div>
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: 'var(--text-secondary)',
                          opacity: 0.85
                        }}>
                          DOCX, TXT, or MD (max 10MB)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{ 
                padding: '1.5rem 2rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'var(--bg-primary)'
              }}>
                <button
                  onClick={() => {
                    if (!uploadFolder || !uploadFile || isUploading || isCreatingFolder) {
                      // If button is disabled, close the modal
                    setShowShareFileModal(false);
                      setUploadFile(null);
                      setUploadFolder(null);
                      setShowQuickCreateFolder(false);
                      setQuickFolderName('');
                    } else {
                      // If button is enabled, upload and share
                      handleUploadFile();
                    }
                  }}
                  disabled={isSharingFile}
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    background: (!uploadFolder || !uploadFile || isUploading || isCreatingFolder) 
                      ? 'var(--bg-input)' 
                      : 'linear-gradient(135deg, var(--primary), #0ea5e9)',
                    color: (!uploadFolder || !uploadFile || isUploading || isCreatingFolder)
                      ? 'var(--text-secondary)'
                      : 'white',
                    border: (!uploadFolder || !uploadFile || isUploading || isCreatingFolder)
                      ? '1px solid var(--border)'
                      : 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (isSharingFile || isUploading) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    boxShadow: (!uploadFolder || !uploadFile || isUploading || isCreatingFolder)
                      ? 'none'
                      : '0 4px 16px rgba(59, 130, 246, 0.4)',
                    letterSpacing: '0.01em'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSharingFile && !isUploading) {
                      if (!uploadFolder || !uploadFile || isCreatingFolder) {
                        e.currentTarget.style.background = 'var(--bg-card)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      } else {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.5)';
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSharingFile && !isUploading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = (!uploadFolder || !uploadFile || isUploading || isCreatingFolder)
                        ? 'none'
                        : '0 4px 16px rgba(59, 130, 246, 0.4)';
                      if (!uploadFolder || !uploadFile || isCreatingFolder) {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }
                  }}
                >
                  {isUploading ? (
                    <>
                      <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px', borderTopColor: 'white' }}></div>
                      <span>Uploading & Sharing...</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>Upload & Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Selection Modal for Quiz */}
        {showFileSelectionModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Select File for Quiz
              </h2>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Number of Questions:
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                  disabled={isGeneratingQuestions}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    marginBottom: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Test Type:
                </label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  disabled={isGeneratingQuestions}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Select File:
                </label>
                
                {/* Shared Files Section */}
                {room?.sharedFiles && room.sharedFiles.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>
                      📁 Shared Files in Room:
                    </div>
                    <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      {room.sharedFiles.map((sharedFile) => (
                        <button
                          key={`shared-${sharedFile.fileId}`}
                          onClick={() => setSelectedFile({
                            _id: sharedFile.fileId,
                            fileName: sharedFile.fileName,
                            subject: sharedFile.subject,
                            fileType: sharedFile.fileType,
                            fileContent: sharedFile.fileContent,
                            isSharedFile: true
                          })}
                          disabled={isGeneratingQuestions}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: selectedFile?._id === sharedFile.fileId && selectedFile?.isSharedFile ? 'var(--primary)' : 'var(--bg-input)',
                            color: selectedFile?._id === sharedFile.fileId && selectedFile?.isSharedFile ? 'white' : 'var(--text-primary)',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            textAlign: 'left',
                            cursor: isGeneratingQuestions ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{sharedFile.fileName}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                            {sharedFile.subject} • {sharedFile.fileType.toUpperCase()} • Shared by {sharedFile.sharedBy.username}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Your Files Section */}
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: '600' }}>
                    📂 Your Files:
                  </div>
                  <div style={{ maxHeight: '150px', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    {files.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No files available. Please upload files first.
                      </p>
                    ) : (
                      files.map((file) => (
                        <button
                          key={file._id}
                          onClick={() => setSelectedFile({
                            ...file,
                            isSharedFile: false
                          })}
                          disabled={isGeneratingQuestions}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: selectedFile?._id === file._id && !selectedFile?.isSharedFile ? 'var(--primary)' : 'var(--bg-input)',
                            color: selectedFile?._id === file._id && !selectedFile?.isSharedFile ? 'white' : 'var(--text-primary)',
                            border: 'none',
                            borderBottom: '1px solid var(--border-color)',
                            textAlign: 'left',
                            cursor: isGeneratingQuestions ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{file.fileName}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                            {file.subject} • {file.fileType?.toUpperCase()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowFileSelectionModal(false);
                    setSelectedFile(null);
                  }}
                  disabled={isGeneratingQuestions}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isGeneratingQuestions ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAndStartQuiz}
                  disabled={!selectedFile || isGeneratingQuestions}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: (!selectedFile || isGeneratingQuestions) ? '#ccc' : 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (!selectedFile || isGeneratingQuestions) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isGeneratingQuestions ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                      Generating...
                    </>
                  ) : (
                    'Generate & Start Quiz'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

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
          if (!hasSeenTutorial('studyRoom')) {
            markTutorialAsSeen('studyRoom');
          }
        }}
        tutorial={tutorials.studyRoom}
      />
    </div>
  );
};

export default StudyRoom;

