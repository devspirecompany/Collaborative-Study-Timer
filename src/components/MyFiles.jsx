import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './shared/sidebar.jsx';
import TutorialModal from './shared/TutorialModal.jsx';
import { getFiles, createFile, getFolders, createFolder, deleteFolder, deleteFile } from '../services/apiService';
import '../styles/MyFiles.css';
import { tutorials, hasSeenTutorial, markTutorialAsSeen } from '../utils/tutorials';

const MyFiles = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [filesBySubject, setFilesBySubject] = useState({});
  const [loading, setLoading] = useState(true);
  const [userId] = useState('demo-user');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFolder, setUploadFolder] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);

  useEffect(() => {
    fetchFolders();
    fetchFiles();
  }, []);

  // Show tutorial immediately when feature is accessed
  useEffect(() => {
    if (!hasSeenTutorial('myFiles')) {
      // Show tutorial immediately when component mounts (when feature is clicked)
      setShowTutorial(true);
      // Mark as seen only after user closes it (handled in onClose)
    }
  }, []);

  const fetchFolders = async () => {
    try {
      const response = await getFolders(userId);
      if (response && response.success) {
        const folderNames = response.folders.map(f => f.folderName);
        setFolders(folderNames);
        
        // Also update filesBySubject to include empty folders so they show in sidebar
        setFilesBySubject(prev => {
          const updated = { ...prev };
          folderNames.forEach(folderName => {
            if (!updated[folderName]) {
              updated[folderName] = [];
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      // Don't block UI if folders can't be fetched
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await getFiles(userId);
      if (response.success) {
        // Convert backend files to frontend format
        const filesBySubjectMap = {};
        
        // Include folders (even if empty)
        if (response.folders && response.folders.length > 0) {
          response.folders.forEach(folder => {
            filesBySubjectMap[folder.folderName] = [];
          });
        }
        
        // Add files to their respective folders
        if (response.files && response.files.length > 0) {
          response.files.forEach(file => {
            if (!filesBySubjectMap[file.subject]) {
              filesBySubjectMap[file.subject] = [];
            }
            filesBySubjectMap[file.subject].push({
              id: file._id,
              name: file.fileName,
              type: file.fileType,
              size: formatFileSize(file.size),
              uploaded: new Date(file.uploadedAt).toISOString().split('T')[0],
              content: file.fileContent,
              subject: file.subject
            });
          });
        }
        
        setFilesBySubject(filesBySubjectMap);
        
        // Update folders list
        if (response.folders) {
          setFolders(response.folders.map(f => f.folderName));
        }
      } else {
        setFilesBySubject({});
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setFilesBySubject({});
    } finally {
      setLoading(false);
    }
  };


  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };


  // Use folders state for sidebar, but also include any subjects from filesBySubject that aren't in folders
  const allSubjects = [...new Set([...folders, ...Object.keys(filesBySubject)])];
  const subjects = allSubjects;

  const handleSubjectClick = (subject) => {
    setSelectedSubject(selectedSubject === subject ? null : subject);
  };


  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    // Check if folder name already exists in the current folders list (case-insensitive)
    const folderNameLower = newFolderName.trim().toLowerCase();
    const existingFolder = folders.find(f => f.toLowerCase() === folderNameLower);
    if (existingFolder) {
      alert(`Folder "${existingFolder}" already exists. Please choose a different name.`);
      return;
    }

    setIsCreatingFolder(true);
    try {
      const response = await createFolder({
        userId,
        folderName: newFolderName.trim()
      });

      if (response.success) {
        const createdFolderName = newFolderName.trim();
        // Immediately add to folders state for instant UI update
        setFolders(prev => [...prev, createdFolderName]);
        // Add to filesBySubject so it shows in sidebar
        setFilesBySubject(prev => ({
          ...prev,
          [createdFolderName]: []
        }));
        // Auto-select the newly created folder
        setSelectedSubject(createdFolderName);
        
        // Then fetch from backend to ensure sync
        await fetchFolders();
        await fetchFiles();
        
        setShowCreateFolderModal(false);
        setNewFolderName('');
        // Remove alert, UI update is instant
      } else {
        // Show the actual error message from backend
        alert(response.message || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      // Show the error message from the backend
      const errorMessage = error.response?.message || error.message || 'Failed to create folder. It might already exist.';
      alert(errorMessage);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUploadFile = async () => {
    // Use selectedSubject if available, otherwise use uploadFolder from dropdown
    const targetFolder = selectedSubject || uploadFolder;
    
    if (!targetFolder || !uploadFile) {
      alert('Please select a folder and choose a file');
      return;
    }

    const fileType = uploadFile.name.split('.').pop().toLowerCase();
    
    // Check if file type is supported (DOCX, TXT, MD only)
    const supportedTypes = ['txt', 'md', 'docx'];
    if (!supportedTypes.includes(fileType)) {
      alert(`File type .${fileType} is not supported.\n\nSupported formats:\n• Word Document (.docx)\n• Text File (.txt)\n• Markdown (.md)\n\nNote: PDF files are not supported. Please convert to DOCX or TXT format.`);
      return;
    }

    // Validate file size (max 10MB for DOCX to avoid memory issues)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (uploadFile.size > maxSize) {
      alert(`File is too large (${(uploadFile.size / 1024 / 1024).toFixed(2)}MB). Maximum file size is 10MB.`);
      return;
    }

    // Warn for very large files
    if (uploadFile.size > 5 * 1024 * 1024) {
      const proceed = window.confirm(`This file is large (${(uploadFile.size / 1024 / 1024).toFixed(2)}MB). Processing may take longer. Continue?`);
      if (!proceed) {
        setIsUploading(false);
        return;
      }
    }

    setIsUploading(true);
    try {
      // Read file content
      const reader = new FileReader();
      
      // For text files, read as text; for DOCX, read as data URL (base64)
      if (fileType === 'txt' || fileType === 'md') {
        reader.readAsText(uploadFile);
      } else if (fileType === 'docx') {
        // For DOCX, read as data URL (base64)
        // Backend will extract text using mammoth
        reader.readAsDataURL(uploadFile);
      }
      
          reader.onload = async (e) => {
        try {
          let fileContent = e.target.result;
          
          // For DOCX, send base64 data to backend
          // Backend will extract text using mammoth library
          // No need to process here - backend handles extraction
          
          const response = await createFile({
            userId,
            fileName: uploadFile.name,
            fileContent: fileContent,
            fileType: fileType,
            subject: targetFolder,
            size: uploadFile.size
          });

          if (response.success) {
            await fetchFiles();
            setShowUploadModal(false);
            setUploadFolder(null);
            setUploadFile(null);
            
            // Show success message with file type info
            const fileTypeName = fileType === 'docx' ? 'Word Document' : fileType.toUpperCase();
            alert(`✅ ${fileTypeName} file "${uploadFile.name}" uploaded successfully to "${targetFolder}"!\n\nThe file content has been extracted and is ready for AI question generation.`);
            
            // Auto-select the folder if not already selected
            if (!selectedSubject) {
              setSelectedSubject(targetFolder);
            }
          } else {
            alert(response.message || 'Failed to upload file');
          }
        } catch (error) {
          console.error('❌ Error uploading file:', error);
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          console.error('Error details:', {
            message: error.message,
            response: error.response,
            status: error.status,
            name: error.name
          });
          
          // Extract detailed error message - try multiple sources
          let errorMessage = 'Unknown error occurred';
          
          // Priority 1: response.message (from backend)
          if (error.response && error.response.message) {
            errorMessage = error.response.message;
          }
          // Priority 2: error.message (from Error object)
          else if (error.message) {
            errorMessage = error.message;
          }
          // Priority 3: response.error (alternative backend error field)
          else if (error.response && error.response.error) {
            if (typeof error.response.error === 'string') {
              errorMessage = error.response.error;
            } else if (error.response.error.message) {
              errorMessage = error.response.error.message;
            }
          }
          // Priority 4: status text
          else if (error.status) {
            errorMessage = `Server error: ${error.status}`;
          }
          
          // Clean up error message
          errorMessage = errorMessage.replace(/Error creating file: /g, '');
          errorMessage = errorMessage.replace(/Failed to upload file: /g, '');
          
          console.error('Final error message to display:', errorMessage);
          
          alert(`Failed to upload file: ${errorMessage}\n\nPlease check:\n• File is not corrupted\n• File contains readable text\n• Backend server is running on port 5000\n• File size is under 10MB\n• File is a valid DOCX, TXT, or MD file`);
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
        setIsUploading(false);
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
      setIsUploading(false);
    }
  };

  const handleDeleteFolder = async (folderName) => {
    if (!window.confirm(`Delete folder "${folderName}"? This will only work if the folder is empty.`)) {
      return;
    }

    try {
      // Find folder ID
      const foldersResponse = await getFolders(userId);
      if (foldersResponse.success) {
        const folder = foldersResponse.folders.find(f => f.folderName === folderName);
        if (folder) {
          const response = await deleteFolder(folder._id);
          if (response.success) {
            await fetchFolders();
            await fetchFiles();
            if (selectedSubject === folderName) {
              setSelectedSubject(null);
            }
            alert(`Folder "${folderName}" deleted successfully!`);
          } else {
            alert(response.message || 'Failed to delete folder');
          }
        }
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  const handleDeleteFile = async (file) => {
    // Validation
    if (!file) {
      console.error('No file provided to delete');
      alert('Error: No file selected for deletion.');
      return;
    }

    if (!file.id) {
      console.error('File missing ID:', file);
      alert('Error: File is missing an ID. Cannot delete.');
      return;
    }

    // Prevent double-clicks
    if (deletingFileId === file.id) {
      console.log('Delete already in progress for file:', file.id);
      return;
    }

    // Confirmation dialog
    const confirmDelete = window.confirm(`Delete file "${file.name}"?\n\nThis action cannot be undone.`);
    if (!confirmDelete) {
      return;
    }

    // Set loading state
    setDeletingFileId(file.id);

    try {
      console.log('🗑️ Attempting to delete file:', {
        id: file.id,
        name: file.name,
        subject: file.subject
      });

      // Call API to delete file
      const response = await deleteFile(file.id);
      
      console.log('✅ Delete API response:', response);

      // Check if deletion was successful
      if (response && response.success !== false) {
        // Optimistically update UI - remove file from local state
        setFilesBySubject(prev => {
          const updated = { ...prev };
          if (updated[file.subject]) {
            updated[file.subject] = updated[file.subject].filter(f => f.id !== file.id);
            console.log('✅ File removed from UI:', file.name);
          }
          return updated;
        });
        
        // Refresh file list from backend to ensure sync
        await fetchFiles();
        console.log('✅ Files refreshed from backend');
        
        alert(`File "${file.name}" deleted successfully!`);
      } else {
        // Handle error response
        const errorMsg = response?.message || response?.error || 'Failed to delete file';
        console.error('❌ Delete failed:', errorMsg);
        alert(`Failed to delete file: ${errorMsg}`);
      }
    } catch (error) {
      // Handle network/API errors
      console.error('❌ Error deleting file:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to delete file';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.message) {
        errorMessage = error.response.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Remove "Error: " prefix if present
      errorMessage = errorMessage.replace(/^Error:\s*/i, '');
      
      alert(`Failed to delete file: ${errorMessage}\n\nPlease check:\n• Backend server is running\n• File exists in the database\n• You have permission to delete this file`);
    } finally {
      // Always clear loading state
      setDeletingFileId(null);
    }
  };

  const getFileIcon = (type) => {
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

    const config = iconConfigs[type] || iconConfigs.default;

    return (
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
        {/* Simple, Clean Document Icon */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Back Document (shadow/duplicate effect) */}
          <path 
            d="M16 6H28L36 14V38C36 39.1046 35.1046 40 34 40H16C14.8954 40 14 39.1046 14 38V8C14 6.89543 14.8954 6 16 6Z" 
            fill={config.secondary}
            opacity="0.2"
          />
          
          {/* Main Document Body - No white fill, no stroke */}
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
          
          {/* Document Lines - Now white */}
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
          {type}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Files</h1>
            <p className="page-subtitle">Organize your study materials</p>
          </div>
          <button 
            className="btn-primary" 
            onClick={() => {
              // If folder is selected, auto-set it for upload
              if (selectedSubject) {
                setUploadFolder(selectedSubject);
              } else {
                setUploadFolder(null);
              }
              setShowUploadModal(true);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload File
          </button>
        </div>

        <div className="files-container">
          {/* Subjects List (Left Sidebar) - Always show */}
          <div className="subjects-sidebar">
            <div className="subjects-header">
              <h3 className="subjects-title">Folders</h3>
              <button 
                className="btn-add-folder"
                onClick={() => setShowCreateFolderModal(true)}
                title="Create new folder"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            {subjects.length > 0 ? (
              <div className="subjects-list">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    className={`subject-item ${selectedSubject === subject ? 'active' : ''}`}
                    onClick={() => handleSubjectClick(subject)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>{subject}</span>
                    <span className="file-count">({filesBySubject[subject]?.length || 0})</span>
                    {selectedSubject === subject && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                    <button
                      className="delete-folder-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(subject);
                      }}
                      title="Delete folder (only if empty)"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-sidebar-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <p>No folders yet</p>
                <p className="empty-hint">Click the + button above to create a folder</p>
              </div>
            )}
          </div>

          {/* Files List (Main Content) */}
          <div className="files-main">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading files...</p>
              </div>
            ) : !selectedSubject ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <h3>Select a subject to view files</h3>
                <p>Choose a subject from the left sidebar to see your files</p>
              </div>
            ) : !filesBySubject[selectedSubject] || filesBySubject[selectedSubject].length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                </svg>
                <h3>No files in {selectedSubject}</h3>
                <p>Upload files to get started</p>
              </div>
            ) : (
              <>
                <div className="files-header">
                  <h2>{selectedSubject}</h2>
                  <span className="files-count">{filesBySubject[selectedSubject]?.length || 0} files</span>
                </div>
                <div className="files-grid">
                  {filesBySubject[selectedSubject].map((file) => (
                    <div key={file.id} className="file-card">
                      <div className="file-icon">{getFileIcon(file.type)}</div>
                      <div className="file-info">
                        <h3 className="file-name" title={file.name}>{file.name}</h3>
                        <div className="file-meta">
                          <span className="file-size">{file.size}</span>
                          <span className="file-date">{file.uploaded}</span>
                        </div>
                      </div>
                      <div className="file-actions">
                        <button
                          className="btn-delete-file"
                          onClick={() => handleDeleteFile(file)}
                          disabled={deletingFileId === file.id}
                          title="Delete file"
                        >
                          {deletingFileId === file.id ? (
                            <>
                              <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>



        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div className="modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
              maxWidth: '420px',
              width: '90%',
              padding: '0'
            }}>
              <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Create New Folder</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Enter a name for your folder (e.g., Mathematics, Physics, Computer Science)
                </p>
              </div>
              <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                <input
                  type="text"
                  className="folder-name-input"
                  placeholder="Folder name (e.g., Mathematics)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFolder();
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    marginBottom: '0'
                  }}
                />
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
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setNewFolderName('');
                  }}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  style={{ minWidth: '100px' }}
                >
                  {isCreatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload File Modal */}
        {showUploadModal && (
          <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
              maxWidth: '420px',
              width: '90%',
              padding: '0'
            }}>
              <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Upload File</h3>
                {selectedSubject ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Upload file to <strong>{selectedSubject}</strong>
                  </p>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Select a folder and choose a file to upload
                  </p>
                )}
              </div>
              
              <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
                {!selectedSubject && (
                  <div className="upload-folder-selector" style={{ marginBottom: '1.25rem' }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontSize: '0.9rem', 
                      fontWeight: '500',
                      color: 'var(--text-primary)'
                    }}>
                      Select Folder:
                    </label>
                    <select
                      className="folder-select"
                      value={uploadFolder || ''}
                      onChange={(e) => setUploadFolder(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="">-- Select a folder --</option>
                      {subjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="upload-file-input">
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.9rem', 
                    fontWeight: '500',
                    color: 'var(--text-primary)'
                  }}>
                    Choose File:
                  </label>
                  <input
                    type="file"
                    accept=".docx,.txt,.md"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.9rem'
                    }}
                  />
                  {uploadFile && (
                    <div className="file-preview" style={{ marginTop: '0.75rem' }}>
                      <strong>{uploadFile.name}</strong>
                      <span>{(uploadFile.size / 1024).toFixed(2)} KB</span>
                    </div>
                  )}
                </div>
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
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFolder(null);
                    setUploadFile(null);
                  }}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleUploadFile}
                  disabled={!uploadFolder || !uploadFile || isUploading}
                  style={{ minWidth: '100px' }}
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
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
          if (!hasSeenTutorial('myFiles')) {
            markTutorialAsSeen('myFiles');
          }
        }}
        tutorial={tutorials.myFiles}
      />
    </div>
  );
};

export default MyFiles;

