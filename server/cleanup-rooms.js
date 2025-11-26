/**
 * Remove all test rooms except one
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const StudyRoom = require('./models/StudyRoom');

dotenv.config({ path: path.join(__dirname, '.env') });

async function cleanupRooms() {
  try {
    console.log('🔌 Connecting to MongoDB...\n');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spireworks';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find all rooms
    const allRooms = await StudyRoom.find({ isActive: true });
    console.log(`📊 Found ${allRooms.length} active room(s)\n`);

    if (allRooms.length === 0) {
      console.log('ℹ️  No rooms to clean up');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Keep the most recent test room (STUDY-HIYXPU if it exists, otherwise the most recent)
    const roomToKeep = allRooms.find(r => r.roomCode === 'STUDY-HIYXPU') || allRooms.sort((a, b) => b.createdAt - a.createdAt)[0];
    
    console.log(`✅ Keeping room: ${roomToKeep.roomCode} - ${roomToKeep.roomName}\n`);

    // Delete all other rooms
    const roomsToDelete = allRooms.filter(r => r._id.toString() !== roomToKeep._id.toString());
    
    if (roomsToDelete.length === 0) {
      console.log('ℹ️  Only one room exists, nothing to delete');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`🗑️  Deleting ${roomsToDelete.length} room(s)...\n`);
    
    for (const room of roomsToDelete) {
      await StudyRoom.deleteOne({ _id: room._id });
      console.log(`   ✅ Deleted: ${room.roomCode} - ${room.roomName}`);
    }

    console.log(`\n✅ Cleanup complete! Only one room remains:\n`);
    console.log(`   🏷️  Room Code: ${roomToKeep.roomCode}`);
    console.log(`   📝 Room Name: ${roomToKeep.roomName}`);
    console.log(`   👤 Host: ${roomToKeep.hostName}`);
    console.log(`   📅 Created: ${roomToKeep.createdAt.toLocaleString()}`);
    console.log(`\n💡 You can now use room code: ${roomToKeep.roomCode}\n`);

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupRooms();

