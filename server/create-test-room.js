/**
 * Create a test room and display the room code
 * Run with: node create-test-room.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const StudyRoom = require('./models/StudyRoom');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'STUDY-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create test room
async function createTestRoom() {
  try {
    console.log('🔌 Connecting to MongoDB...\n');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spireworks';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Generate unique room code
    let roomCode;
    let isUnique = false;
    while (!isUnique) {
      roomCode = generateRoomCode();
      const existing = await StudyRoom.findOne({ roomCode });
      if (!existing) {
        isUnique = true;
      }
    }

    // Create test room
    const testRoom = new StudyRoom({
      roomCode: roomCode,
      roomName: 'Test Study Room',
      hostId: 'test-host-123',
      hostName: 'Test Host',
      participants: [{
        userId: 'test-host-123',
        username: 'Test Host',
        joinedAt: new Date()
      }]
    });

    await testRoom.save();

    console.log('✅ Room created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ROOM DETAILS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   🏷️  Room Code: ' + roomCode);
    console.log('   📝 Room Name: Test Study Room');
    console.log('   👤 Host: Test Host');
    console.log('   📅 Created: ' + testRoom.createdAt.toLocaleString());
    console.log('   ⏰ Expires: ' + testRoom.expiresAt.toLocaleString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🌐 WHERE TO USE THIS CODE:');
    console.log('   1. Go to: http://localhost:3000/group-study');
    console.log('   2. Click "Join Room" or "Browse Study Rooms"');
    console.log('   3. Enter the room code: ' + roomCode);
    console.log('   4. You will be taken to: http://localhost:3000/study-room/' + roomCode);
    console.log('\n');

    // Keep connection open for a moment
    setTimeout(async () => {
      await mongoose.connection.close();
      console.log('👋 Disconnected from MongoDB');
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error('❌ Error creating room:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure MongoDB is running!');
      console.error('   Try: mongod (if installed locally)');
    }
    process.exit(1);
  }
}

// Run
createTestRoom();

