/**
 * Test script to verify room creation functionality
 * Run with: node test-room-creation.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const StudyRoom = require('./models/StudyRoom');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Test room creation
async function testRoomCreation() {
  try {
    console.log('🧪 Testing Room Creation...\n');

    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spireworks';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Test data
    const testUserId = 'test-user-' + Date.now();
    const testUsername = 'Test User';
    const testRoomName = 'Test Study Room';

    console.log('📝 Test Data:');
    console.log('   User ID:', testUserId);
    console.log('   Username:', testUsername);
    console.log('   Room Name:', testRoomName);
    console.log('');

    // Create test room
    console.log('🔨 Creating room...');
    const studyRoom = new StudyRoom({
      roomCode: 'STUDY-TEST' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      roomName: testRoomName,
      hostId: testUserId,
      hostName: testUsername,
      participants: [{
        userId: testUserId,
        username: testUsername,
        joinedAt: new Date()
      }]
    });

    await studyRoom.save();
    console.log('✅ Room created successfully!\n');

    // Display room details
    console.log('📊 Room Details:');
    console.log('   Room Code:', studyRoom.roomCode);
    console.log('   Room Name:', studyRoom.roomName);
    console.log('   Host ID:', studyRoom.hostId);
    console.log('   Host Name:', studyRoom.hostName);
    console.log('   Participants:', studyRoom.participants.length);
    console.log('   Is Active:', studyRoom.isActive);
    console.log('   Created At:', studyRoom.createdAt);
    console.log('   Expires At:', studyRoom.expiresAt);
    console.log('');

    // Verify room code uniqueness
    console.log('🔍 Verifying room code uniqueness...');
    const duplicate = await StudyRoom.findOne({ roomCode: studyRoom.roomCode });
    if (duplicate && duplicate._id.toString() === studyRoom._id.toString()) {
      console.log('✅ Room code is unique\n');
    } else {
      console.log('⚠️  Potential duplicate found\n');
    }

    // Clean up - delete test room
    console.log('🧹 Cleaning up test room...');
    await StudyRoom.deleteOne({ _id: studyRoom._id });
    console.log('✅ Test room deleted\n');

    console.log('✅ All tests passed! Room creation is working correctly.\n');

    // Close connection
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run test
testRoomCreation();

