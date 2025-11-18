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
    if (!window.confirm(`Delete file "${file.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await deleteFile(file.id);
      if (response.success) {
        await fetchFiles();
        alert(`File "${file.name}" deleted successfully!`);
      } else {
        alert(response.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = error.response?.message || error.message || 'Failed to delete file';
      alert(`Failed to delete file: ${errorMessage}`);
    }
  };

  const getFileIcon = (type) => {
    // Document icon for all file types
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
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
                          className="btn-download"
                          onClick={() => alert(`Downloading ${file.name}...`)}
                          title="Download file"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                        <button
                          className="btn-delete-file"
                          onClick={() => handleDeleteFile(file)}
                          title="Delete file"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Create New Folder</h3>
              <p>Enter a name for your folder (e.g., Mathematics, Physics, Computer Science)</p>
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
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => {
                  setShowCreateFolderModal(false);
                  setNewFolderName('');
                }}>
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || isCreatingFolder}
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Upload File</h3>
              {selectedSubject ? (
                <p>Upload file to <strong>{selectedSubject}</strong></p>
              ) : (
                <p>Select a folder and choose a file to upload</p>
              )}
              
              {!selectedSubject && (
                <div className="upload-folder-selector">
                  <label>Select Folder:</label>
                  <select
                    className="folder-select"
                    value={uploadFolder || ''}
                    onChange={(e) => setUploadFolder(e.target.value)}
                  >
                    <option value="">-- Select a folder --</option>
                    {subjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="upload-file-input">
                <label>Choose File:</label>
                <input
                  type="file"
                  accept=".docx,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                />
                {uploadFile && (
                  <div className="file-preview">
                    <strong>{uploadFile.name}</strong>
                    <span>{(uploadFile.size / 1024).toFixed(2)} KB</span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => {
                  setShowUploadModal(false);
                  setUploadFolder(null);
                  setUploadFile(null);
                }}>
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleUploadFile}
                  disabled={!uploadFolder || !uploadFile || isUploading}
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

