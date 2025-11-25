const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '.env') });

// Log environment status (for debugging)
console.log('\n🔍 Environment Configuration:');
console.log('   📁 .env file path:', path.join(__dirname, '.env'));
console.log('   🔑 GEMINI_API_KEY exists:', process.env.GEMINI_API_KEY ? 'YES ✅' : 'NO ❌');
if (process.env.GEMINI_API_KEY) {
  const keyPreview = process.env.GEMINI_API_KEY.substring(0, 10) + '...';
  const isPlaceholder = process.env.GEMINI_API_KEY === 'your-gemini-api-key-here';
  console.log('   🔑 GEMINI_API_KEY preview:', keyPreview);
  console.log('   ⚠️  Is placeholder:', isPlaceholder ? 'YES (needs real key)' : 'NO (looks valid)');
}
console.log('');

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://collaborative-study-timer.vercel.app', // Vercel frontend
    'https://collaborative-study-timer-git-master-devspires-projects.vercel.app' // Vercel preview
  ],
  credentials: true
}));
// Increase body size limit for file uploads (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
const connectDB = async () => {
  try {
    // Default MongoDB URI uses port 27017 (standard MongoDB port)
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spireworks';
    const mongoPort = mongoURI.match(/:(\d+)/)?.[1] || '27017';
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   📍 URI: ${mongoURI.replace(/\/\/.*@/, '//***@')}`);
    console.log(`   🔌 Port: ${mongoPort}`);
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    
    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   🖥️  Host: ${conn.connection.host}`);
    console.log(`   📊 Database: ${conn.connection.name}`);
    console.log(`   🔗 State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`   🔌 Port: ${mongoPort}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('   💡 Make sure MongoDB is running on port 27017');
    console.error('   💡 Check your MONGODB_URI in .env file');
    process.exit(1);
  }
};

connectDB();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'SpireWorks Backend API is running!' });
});

// API Routes
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/achievements', require('./routes/achievementRoutes'));
app.use('/api/productivity', require('./routes/productivityRoutes'));
app.use('/api/competitions', require('./routes/competitionRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/study-rooms', require('./routes/studyRoomRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('Error stack:', err.stack);
  console.error('Error message:', err.message);
  console.error('Error name:', err.name);
  
  // Preserve error message from routes
  const errorMessage = err.message || 'Something went wrong!';
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({ 
    success: false, 
    message: errorMessage,
    error: errorMessage
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running successfully!`);
  console.log(`   🌐 Server Port: ${PORT}`);
  console.log(`   🔌 MongoDB Port: 27017 (from MONGODB_URI)`);
  console.log(`   📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`   📡 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`\n✅ Ready to accept requests!\n`);
});

module.exports = app;

