import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StudentLogin from './components/StudentLogin';
import StudentRegistration from './components/StudentRegistration';
import StudentDashboard from './components/StudentDashboard';
import StudentStudyTimer from './components/StudentStudyTimer';
import MyFiles from './components/MyFiles';
import GroupStudy from './components/GroupStudy';
import Achievements from './components/Achievements';
import ProductivityTracker from './components/ProductivityTracker';
import SoloPractice from './components/SoloPractice';
import StudyRoom from './components/StudyRoom';
import ReviewerStudy from './components/ReviewerStudy';
import Profile from './components/Profile';
import './styles/StudentDashboard.css';
import './styles/StudentLogin.css';
import './styles/StudentRegistration.css';
import './styles/StudentStudyTimer.css';
import './styles/MyFiles.css';
import './styles/GroupStudy.css';
import './styles/Achievements.css';
import './styles/ProductivityTracker.css';
import './styles/SoloPractice.css';
import './styles/StudyRoom.css';
import './styles/ReviewerStudy.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<StudentLogin />} />
      <Route path="/register" element={<StudentRegistration />} />
      <Route path="/student-dashboard" element={<StudentDashboard />} />
      <Route path="/study-timer" element={<StudentStudyTimer />} />
      <Route path="/my-files" element={<MyFiles />} />
      <Route path="/group-study" element={<GroupStudy />} />
      <Route path="/study-room/:roomCode" element={<StudyRoom />} />
      <Route path="/solo-practice" element={<SoloPractice />} />
      <Route path="/reviewer-study" element={<ReviewerStudy />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/productivity-tracker" element={<ProductivityTracker />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;