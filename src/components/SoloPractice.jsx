import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getFiles, getFolders } from '../services/apiService';
import { generateQuestionsFromFile } from '../services/aiService';
import '../styles/SoloPractice.css';
import '../styles/StudentStudyTimer.css'; // For reviewer selection modal styles
import '../styles/TutorialModal.css'; // For help button styles
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const SoloPractice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reviewerFromState = location.state?.reviewer || null;
  const questionsFromState = location.state?.questions || [];
  
  // State for file/folder selection
  const [selectedReviewer, setSelectedReviewer] = useState(reviewerFromState);
  const [questions, setQuestions] = useState(questionsFromState);
  const [filesBySubject, setFilesBySubject] = useState({});
  const [folders, setFolders] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showQuestionCountModal, setShowQuestionCountModal] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [testType, setTestType] = useState('multiple_choice'); // multiple_choice, true_false, fill_blank
  const userId = 'demo-user'; // In production, get from auth context

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]); // Store all user answers
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [timeRemaining, setTimeRemaining] = useState(20); // Fixed 20 seconds
  const [timeStarted, setTimeStarted] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Fetch folders and files on mount
  useEffect(() => {
    if (!selectedReviewer || !questions.length) {
      fetchFoldersAndFiles();
    }
  }, []);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('soloPractice')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  const fetchFoldersAndFiles = async () => {
    setIsLoadingFiles(true);
    try {
      // Fetch folders
      const foldersResponse = await getFolders(userId);
      const foldersList = foldersResponse.success ? foldersResponse.folders || [] : [];
      setFolders(foldersList.map(f => f.folderName));

      // Fetch files
      const filesResponse = await getFiles(userId);
      if (filesResponse.success) {
        const filesBySubjectMap = {};
        
        // Include folders (even if empty)
        foldersList.forEach(folder => {
          filesBySubjectMap[folder.folderName] = [];
        });
        
        // Add files to their respective folders
        if (filesResponse.files && filesResponse.files.length > 0) {
          filesResponse.files.forEach(file => {
            if (!filesBySubjectMap[file.subject]) {
              filesBySubjectMap[file.subject] = [];
            }
            filesBySubjectMap[file.subject].push({
              id: file._id,
              name: file.fileName,
              type: file.fileType,
              subject: file.subject,
              content: file.fileContent,
              hasContent: !!file.fileContent && file.fileContent.length > 50
            });
          });
        }
        
        setFilesBySubject(filesBySubjectMap);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setFilesBySubject({});
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(selectedSubject === subject ? null : subject);
  };

  const handleFileSelect = (file) => {
    if (file.hasContent) {
      setSelectedFile(file);
      setShowQuestionCountModal(true);
    } else {
      alert('This file does not have extractable content. Please ensure the file was uploaded correctly.');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedFile) return;
    
    setIsGeneratingQuestions(true);
    try {
      console.log('\n🟡 ===== Practice: Starting Question Generation =====');
      console.log('📁 Selected file:', selectedFile.name);
      console.log('📚 Subject:', selectedFile.subject);
      console.log('📊 Question count:', questionCount);
      console.log('📄 Initial content length:', selectedFile.content?.length || 0);
      
      // Get file content
      let fileContent = selectedFile.content;
      
      // If content is missing, fetch from backend
      if (!fileContent || fileContent.length < 50) {
        console.log('⚠️ Content missing or too short, fetching from backend...');
        const filesResponse = await getFiles(userId, selectedFile.subject);
        if (filesResponse.success && filesResponse.files) {
          const fileFromBackend = filesResponse.files.find(f => f._id === selectedFile.id);
          if (fileFromBackend && fileFromBackend.fileContent) {
            fileContent = fileFromBackend.fileContent;
            console.log('✅ Fetched content from backend, length:', fileContent.length);
          } else {
            console.error('❌ File not found in backend response');
          }
        } else {
          console.error('❌ Failed to fetch files from backend');
        }
      }
      
      if (!fileContent || fileContent.length < 50) {
        console.error('❌ File content is too short or missing');
        throw new Error('File content is too short or missing. Please ensure the file was uploaded correctly and text was extracted.');
      }
      
      console.log('✅ File content ready, length:', fileContent.length);
      
      // Generate questions
      const generatedQuestions = await generateQuestionsFromFile(
        fileContent,
        selectedFile.subject,
        questionCount,
        testType
      );
      
      if (generatedQuestions && generatedQuestions.length > 0) {
        setSelectedReviewer({
          id: selectedFile.id,
          name: selectedFile.name,
          subject: selectedFile.subject
        });
        setQuestions(generatedQuestions);
        setShowQuestionCountModal(false);
        setSelectedFile(null);
        // Reset quiz state
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setUserAnswers([]);
        setAnsweredQuestions(new Set());
        setTimeRemaining(20);
        setTimeStarted(false);
        setTotalTime(0);
        setQuizCompleted(false);
        setFinalScore(0);
      } else {
        throw new Error('Failed to generate questions. Please try again.');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      // Show more helpful error message
      const errorMessage = error.message || 'Failed to generate questions';
      let userMessage = errorMessage;
      
      if (errorMessage.includes('Gemini API key') || errorMessage.includes('not configured')) {
        userMessage = 'AI service is not configured. Please ensure GEMINI_API_KEY is set in the backend .env file and restart the server.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Request timed out. The file might be too large. Try generating fewer questions or use a smaller file.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Cannot connect')) {
        userMessage = 'Cannot connect to backend server. Please ensure the server is running on http://localhost:5000';
      }
      
      alert(`Error: ${userMessage}`);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Convert questions to the format we need
  const practiceQuestions = questions && questions.length > 0
    ? questions
        .filter(q => q && q.question && q.options && Array.isArray(q.options) && q.options.length > 0)
        .map((q, index) => ({
          id: index + 1,
          question: q.question || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0,
          explanation: q.explanation || 'No explanation available.'
        }))
    : [];

  // Initialize timer to 20 seconds
  useEffect(() => {
    setTimeRemaining(20);
  }, [currentQuestionIndex]);

  // Countdown timer for current question
  useEffect(() => {
    if (timeStarted && !quizCompleted && timeRemaining > 0 && !answeredQuestions.has(currentQuestionIndex)) {
      const questionIndex = currentQuestionIndex; // Capture current index
      const timer = setTimeout(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - handle directly here to avoid dependency issues
            const currentQuestion = practiceQuestions[questionIndex];
            if (!currentQuestion) return 0;
            
            const answerData = {
              questionIndex: questionIndex,
              selectedAnswer: null,
              correctAnswer: currentQuestion.correctAnswer,
              isCorrect: false,
              timeUp: true,
              question: currentQuestion.question,
              options: currentQuestion.options,
              explanation: currentQuestion.explanation
            };

            const isLastQuestionTimer = questionIndex >= practiceQuestions.length - 1;
            
            // Mark as answered
            setAnsweredQuestions(prev => new Set([...prev, questionIndex]));
            
            // Update answers
            setUserAnswers(prev => {
              const allAnswers = [...prev, answerData];
              
              // If this is the last question, complete the quiz immediately
              if (isLastQuestionTimer && allAnswers.length === practiceQuestions.length) {
                const correctCount = allAnswers.filter(a => a.isCorrect).length;
                setFinalScore(correctCount);
                setQuizCompleted(true);
              }
              
              return allAnswers;
            });
            
            // Auto-advance to next question (if not last) after 0.5 seconds
            if (!isLastQuestionTimer) {
              setTimeout(() => {
                setCurrentQuestionIndex(prevIndex => {
                  if (prevIndex < practiceQuestions.length - 1) {
                    setSelectedAnswer(null);
                    setTimeRemaining(20);
                    return prevIndex + 1;
                  }
                  return prevIndex;
                });
              }, 500);
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeStarted, timeRemaining, currentQuestionIndex, answeredQuestions, quizCompleted, practiceQuestions]);

  // Timer for the entire practice session (total time)
  useEffect(() => {
    if (timeStarted && practiceQuestions.length > 0) {
      const timer = setInterval(() => {
        setTotalTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeStarted, practiceQuestions.length]);

  // Start practice when questions are available
  useEffect(() => {
    if (practiceQuestions.length > 0 && selectedReviewer && !timeStarted) {
      setTimeStarted(true);
    }
  }, [practiceQuestions.length, selectedReviewer, timeStarted]);

  // Check if quiz should be completed (all questions answered) - fallback mechanism
  useEffect(() => {
    if (!quizCompleted && 
        userAnswers.length === practiceQuestions.length && 
        practiceQuestions.length > 0 &&
        currentQuestionIndex >= practiceQuestions.length - 1) {
      const correctCount = userAnswers.filter(a => a.isCorrect).length;
      setFinalScore(correctCount);
      setQuizCompleted(true);
    }
  }, [userAnswers.length, practiceQuestions.length, quizCompleted, currentQuestionIndex, userAnswers]);

  const handleAnswerSelect = useCallback((answerIndex, timeUp = false) => {
    const questionIdx = currentQuestionIndex; // Capture current index
    if (answeredQuestions.has(questionIdx) || quizCompleted) return;

    const currentQuestion = practiceQuestions[questionIdx];
    if (!currentQuestion) return;
    
    // Store the answer
    const answerData = {
      questionIndex: questionIdx,
      selectedAnswer: answerIndex,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: answerIndex === currentQuestion.correctAnswer,
      timeUp: timeUp,
      question: currentQuestion.question,
      options: currentQuestion.options,
      explanation: currentQuestion.explanation
    };

    // Check if this is the last question
    const isLastQuestion = questionIdx >= practiceQuestions.length - 1;
    
    // Mark question as answered immediately
    setSelectedAnswer(answerIndex);
    setAnsweredQuestions(prev => new Set([...prev, questionIdx]));
    setTimeRemaining(0); // Stop the countdown
    
    // Update answers
    setUserAnswers(prev => {
      const allAnswers = [...prev, answerData];
      
      // If this is the last question, complete the quiz immediately
      if (isLastQuestion && allAnswers.length === practiceQuestions.length) {
        const correctCount = allAnswers.filter(a => a.isCorrect).length;
        setFinalScore(correctCount);
        // Complete immediately - no delay needed
        setQuizCompleted(true);
      }
      
      return allAnswers;
    });
    
    // Auto-advance to next question (if not last) after 0.5 seconds
    if (!isLastQuestion) {
      setTimeout(() => {
        setCurrentQuestionIndex(prevIndex => {
          if (prevIndex < practiceQuestions.length - 1) {
            setSelectedAnswer(null);
            setTimeRemaining(20); // Reset to 20 seconds
            return prevIndex + 1;
          }
          return prevIndex;
        });
      }, 500);
    }
  }, [currentQuestionIndex, answeredQuestions, quizCompleted, practiceQuestions]);

  const handleBackToFiles = () => {
    navigate('/my-files');
  };

  const handleExit = () => {
    if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
      navigate('/my-files');
    }
  };

  // Show file selection page if no questions selected
  if (!selectedReviewer || !practiceQuestions || practiceQuestions.length === 0) {
    const allSubjects = [...new Set([...folders, ...Object.keys(filesBySubject)])];
    
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Practice</h1>
              <p className="page-subtitle">Test your knowledge with quiz questions</p>
            </div>
            <button
              onClick={fetchFoldersAndFiles}
              disabled={isLoadingFiles}
              className="btn-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
              Refresh
            </button>
          </div>

          {isLoadingFiles ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <svg className="spinner" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 1rem' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <p>Loading files...</p>
            </div>
          ) : allSubjects.length === 0 ? (
            <div className="empty-files-state" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              textAlign: 'center', 
              padding: '4rem',
              gap: '1rem',
              border: '2px dashed var(--border)',
              borderRadius: '12px',
              margin: '2rem'
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <h3 style={{ margin: 0 }}>No files available</h3>
              <p style={{ margin: 0 }}>Upload files in "My Files" to start practicing</p>
              <button 
                className="btn-primary"
                onClick={() => navigate('/my-files')}
                style={{ marginTop: '0.5rem' }}
              >
                Go to My Files
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
              {/* Folders Sidebar */}
              <div style={{ width: '250px', flexShrink: 0 }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Folders</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {allSubjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => handleSubjectClick(subject)}
                      style={{
                        padding: '0.75rem 1rem',
                        background: selectedSubject === subject ? 'var(--primary)' : 'var(--bg-input)',
                        color: selectedSubject === subject ? 'white' : 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.95rem'
                      }}
                    >
                      <span>{subject}</span>
                      <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                        ({filesBySubject[subject]?.length || 0})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Files List */}
              <div style={{ flex: 1 }}>
                {!selectedSubject ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p>Select a folder to view files</p>
                  </div>
                ) : !filesBySubject[selectedSubject] || filesBySubject[selectedSubject].length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.5 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    </svg>
                    <p>No files in {selectedSubject}</p>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                      {selectedSubject} ({filesBySubject[selectedSubject].length} files)
                    </h3>
                    <div className="files-grid-modal" style={{ maxHeight: 'none', paddingRight: '0' }}>
                      {filesBySubject[selectedSubject].map((file) => {
                        const iconConfigs = {
                          docx: { 
                            primary: '#4A90E2',
                            secondary: '#357ABD',
                            background: '#E8F4FF'
                          },
                          txt: { 
                            primary: '#6B7280',
                            secondary: '#4B5563',
                            background: '#F3F4F6'
                          },
                          md: { 
                            primary: '#8B5CF6',
                            secondary: '#7C3AED',
                            background: '#F5F3FF'
                          },
                          default: { 
                            primary: '#3B82F6',
                            secondary: '#2563EB',
                            background: '#EFF6FF'
                          }
                        };

                        const config = iconConfigs[file.type] || iconConfigs.default;
                        
                        return (
                          <button
                            key={file.id}
                            className="file-item-modal"
                            onClick={() => handleFileSelect(file)}
                            disabled={!file.hasContent}
                            style={{ 
                              background: 'transparent',
                              border: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0'
                            }}
                          >
                            <div style={{ 
                              width: '100px',
                              background: 'white',
                              borderRadius: '12px',
                              padding: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.5rem',
                              position: 'relative',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                            }}>
                              {/* Icon */}
                              <div style={{ 
                                width: '60px', 
                                height: '60px',
                                background: config.background,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                flexShrink: 0
                              }}>
                                <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                                  bottom: '4px',
                                  right: '4px',
                                  fontSize: '7px',
                                  fontWeight: '700',
                                  color: 'white',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  padding: '2px 4px',
                                  background: config.primary,
                                  borderRadius: '3px',
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                }}>
                                  {file.type}
                                </div>
                              </div>
                              
                              {/* File Name and Type - Inside white box */}
                              <div style={{ 
                                textAlign: 'center',
                                width: '100%'
                              }}>
                                <div style={{ 
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  color: '#1f2937',
                                  marginBottom: '0.25rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {file.name}
                                </div>
                                <div style={{ 
                                  fontSize: '0.65rem',
                                  color: '#6b7280',
                                  textTransform: 'uppercase',
                                  fontWeight: '500'
                                }}>
                                  {file.type} File
                                </div>
                                {!file.hasContent && (
                                  <div style={{ 
                                    color: '#ef4444', 
                                    fontSize: '0.6rem',
                                    marginTop: '0.25rem'
                                  }}>
                                    No content
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Question Count Modal */}
          {showQuestionCountModal && selectedFile && (
            <div className="modal-overlay" onClick={() => !isGeneratingQuestions && setShowQuestionCountModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
                maxWidth: '420px',
                width: '90%',
                padding: '2rem'
              }}>
                <h3 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>Generate Questions</h3>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Select test type and number of questions from <strong>{selectedFile.name}</strong>
                </p>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
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
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True/False</option>
                    <option value="fill_blank">Fill in the Blank</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                    Number of Questions:
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    disabled={isGeneratingQuestions}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={25}>25 Questions</option>
                    <option value={30}>30 Questions</option>
                  </select>
                </div>

                {isGeneratingQuestions && (
                  <div style={{ textAlign: 'center', padding: '1rem', marginBottom: '1.5rem' }}>
                    <svg className="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 0.5rem' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Generating {questionCount} questions...
                    </p>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '1.5rem', gap: '0.75rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowQuestionCountModal(false);
                      setSelectedFile(null);
                    }}
                    disabled={isGeneratingQuestions}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleGenerateQuestions}
                    disabled={isGeneratingQuestions}
                    style={{ flex: 1 }}
                  >
                    {isGeneratingQuestions ? 'Generating...' : 'Generate Questions'}
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
            if (!hasSeenTutorial('soloPractice')) {
              markTutorialAsSeen('soloPractice');
            }
          }}
          tutorial={tutorials.soloPractice}
        />
      </div>
    );
  }

  // Show results screen if quiz is completed and all questions are answered
  if (quizCompleted && userAnswers.length === practiceQuestions.length && practiceQuestions.length > 0) {
    const percentage = (finalScore / practiceQuestions.length) * 100;
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <div className="solo-practice-container">
            {/* Results Screen */}
            <div className="quiz-results">
              <div className="results-header">
                <h1 className="results-title">Quiz Complete! 🎉</h1>
                <div className="results-score">
                  <div className="score-circle">
                    <span className="score-number">{finalScore}</span>
                    <span className="score-total">/{practiceQuestions.length}</span>
                  </div>
                  <div className="score-percentage">{percentage.toFixed(0)}%</div>
                </div>
                <p className="results-time">
                  Time: {minutes}m {seconds}s
                </p>
                <p className="results-message">
                  {percentage >= 80 ? 'Excellent work! 🌟' : percentage >= 60 ? 'Good job! 👍' : 'Keep practicing! 💪'}
                </p>
              </div>

              {/* Answers Review */}
              <div className="answers-review">
                <h2 className="review-title">Your Answers</h2>
                <div className="answers-list">
                  {userAnswers.map((answer, index) => (
                    <div key={index} className={`answer-review-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                      <div className="answer-review-header">
                        <span className="answer-review-number">Question {index + 1}</span>
                        <span className={`answer-review-status ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                          {answer.isCorrect ? '✓ Correct' : answer.timeUp ? '⏱ Time Up' : '✗ Incorrect'}
                        </span>
                      </div>
                      <div className="answer-review-question">{answer.question}</div>
                      <div className="answer-review-options">
                        {answer.options.map((option, optIndex) => {
                          const isSelected = optIndex === answer.selectedAnswer;
                          const isCorrect = optIndex === answer.correctAnswer;
                          
                          return (
                            <div
                              key={optIndex}
                              className={`answer-review-option ${
                                isCorrect ? 'correct-answer' : isSelected && !isCorrect ? 'wrong-answer' : ''
                              }`}
                            >
                              <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                              <span className="option-text">{option}</span>
                              {isCorrect && <span className="option-label">Correct</span>}
                              {isSelected && !isCorrect && <span className="option-label">Your Answer</span>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="answer-review-explanation">
                        <strong>Explanation:</strong> {answer.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="results-actions">
                <button className="btn-back" onClick={handleBackToFiles}>
                  Back to My Files
                </button>
              </div>
            </div>
          </div>
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
            if (!hasSeenTutorial('soloPractice')) {
              markTutorialAsSeen('soloPractice');
            }
          }}
          tutorial={tutorials.soloPractice}
        />
      </div>
    );
  }

  // Safety check: ensure we have valid questions
  if (!practiceQuestions || practiceQuestions.length === 0) {
    return null;
  }

  // Ensure currentQuestionIndex is within bounds
  const safeQuestionIndex = Math.max(0, Math.min(currentQuestionIndex, practiceQuestions.length - 1));
  const currentQuestion = practiceQuestions[safeQuestionIndex];
  
  // Safety check: ensure currentQuestion exists and has required properties
  if (!currentQuestion || !currentQuestion.question || !currentQuestion.options) {
    // If we have all answers, we're transitioning to results screen
    if (userAnswers.length === practiceQuestions.length) {
      return null; // Will show results screen on next render
    }
    return null;
  }

  const progress = ((safeQuestionIndex + 1) / practiceQuestions.length) * 100;
  const isAnswered = answeredQuestions.has(safeQuestionIndex);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="solo-practice-container">
          {/* Header */}
          <div className="practice-header">
            <div className="practice-info">
              <h1 className="practice-title">
                {selectedReviewer ? `Practicing: ${selectedReviewer.name || selectedReviewer.fileName}` : 'Solo Practice'}
              </h1>
              <p className="practice-subtitle">
                Question {safeQuestionIndex + 1} of {practiceQuestions.length}
              </p>
            </div>
            <div className="practice-stats">
              <div className="stat-item">
                <span className="stat-label">Question</span>
                <span className="stat-value">{safeQuestionIndex + 1}/{practiceQuestions.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Time</span>
                <span className="stat-value">
                  {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button className="btn-exit" onClick={handleExit}>
                Exit
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-text">{Math.round(progress)}% Complete</div>
          </div>

          {/* Question Card */}
          <div className="question-card">
            {/* Timer Display */}
            <div className="question-timer-container">
              <div className={`question-timer ${timeRemaining !== null && timeRemaining <= 10 ? 'timer-warning' : ''} ${timeRemaining === 0 ? 'timer-expired' : ''}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{timeRemaining !== null && timeRemaining !== undefined ? `${timeRemaining}s` : '--'}</span>
              </div>
            </div>
            
            <div className="question-content">
              <h2 className="question-text">{currentQuestion.question || 'Loading question...'}</h2>
            </div>

            <div className="answers-grid">
              {currentQuestion.options && currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;

                return (
                  <button
                    key={index}
                    className={`answer-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isAnswered}
                  >
                    <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="answer-text">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
          if (!hasSeenTutorial('soloPractice')) {
            markTutorialAsSeen('soloPractice');
          }
        }}
        tutorial={tutorials.soloPractice}
      />
    </div>
  );
};

export default SoloPractice;

