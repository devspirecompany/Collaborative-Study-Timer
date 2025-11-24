const mongoose = require('mongoose');
const StudyRoom = require('./models/StudyRoom');

async function checkRooms() {
  try {
    await mongoose.connect('mongodb://localhost:27017/spireworks');
    console.log('\n=== Active Study Rooms ===\n');
    
    const rooms = await StudyRoom.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5);
    
    if (rooms.length === 0) {
      console.log('❌ No active rooms found.');
    } else {
      rooms.forEach((room, i) => {
        console.log(`${i + 1}. Room Code: ${room.roomCode}`);
        console.log(`   Name: ${room.roomName || 'Study Room'}`);
        console.log(`   Host: ${room.hostName}`);
        console.log(`   Participants: ${room.participants?.length || 0}`);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRooms();

