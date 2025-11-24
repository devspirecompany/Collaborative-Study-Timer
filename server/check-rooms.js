/**
 * Check if rooms exist in database
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const StudyRoom = require('./models/StudyRoom');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkRooms() {
  try {
    console.log('🔌 Connecting to MongoDB...\n');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spireworks';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find all active rooms
    const rooms = await StudyRoom.find({ 
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    console.log(`📊 Found ${rooms.length} active room(s):\n`);

    if (rooms.length === 0) {
      console.log('❌ No active rooms found in database');
      console.log('\n💡 This could mean:');
      console.log('   - Rooms have expired (24 hour limit)');
      console.log('   - Rooms were deleted');
      console.log('   - No rooms have been created yet');
    } else {
      rooms.forEach((room, index) => {
        console.log(`${index + 1}. Room Code: ${room.roomCode}`);
        console.log(`   Name: ${room.roomName}`);
        console.log(`   Host: ${room.hostName}`);
        console.log(`   Participants: ${room.participants.length}`);
        console.log(`   Created: ${room.createdAt.toLocaleString()}`);
        console.log(`   Expires: ${room.expiresAt.toLocaleString()}`);
        console.log(`   Active: ${room.isActive}`);
        console.log('');
      });
    }

    // Also check the API endpoint format
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 API Response Format (what frontend expects):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const formattedRooms = rooms.map(room => ({
      id: room._id.toString(),
      roomCode: room.roomCode,
      name: room.roomName || 'Study Room',
      roomName: room.roomName || 'Study Room',
      host: room.hostName,
      hostName: room.hostName,
      hostId: room.hostId,
      participants: room.participants ? room.participants.length : 0,
      createdAt: room.createdAt
    }));
    console.log(JSON.stringify({ success: true, rooms: formattedRooms }, null, 2));

    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRooms();

