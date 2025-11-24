import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Validate environment variables on startup
const validateEnvironment = () => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
  // Validate API URL format
  try {
    new URL(apiUrl);
  } catch (error) {
    console.error('❌ Invalid REACT_APP_API_URL environment variable:', apiUrl);
    console.error('   Expected format: http://localhost:5000/api');
    console.error('   Please check your .env file in the root directory');
  }
  
  // Log configuration in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 SpireWorks Frontend Starting...');
    console.log('📍 API URL:', apiUrl);
    // Using default API URL - no warning needed
  }
};

// Run validation
validateEnvironment();
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
