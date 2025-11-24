const mongoose = require('mongoose');
const StudyRoom = require('./models/StudyRoom');

async function removeDuplicateParticipant() {
  try {
    await mongoose.connect('mongodb://localhost:27017/spireworks');
    console.log('\n=== Removing Duplicate Participant ===\n');
    
    const roomCode = 'STUDY-HIYXPU';
    const studyRoom = await StudyRoom.findOne({ roomCode, isActive: true });
    
    if (!studyRoom) {
      console.log('❌ Room not found');
      process.exit(1);
    }
    
    console.log('Current participants:');
    studyRoom.participants.forEach((p, i) => {
      console.log(`${i + 1}. ${p.username} (userId: ${p.userId})`);
    });
    
    // Find and remove "Player1" participant
    const player1Index = studyRoom.participants.findIndex(p => p.username === 'Player1');
    
    if (player1Index === -1) {
      console.log('\n⚠️ No "Player1" participant found');
    } else {
      studyRoom.participants.splice(player1Index, 1);
      await studyRoom.save();
      console.log('\n✅ Removed "Player1" participant');
    }
    
    console.log('\nUpdated participants:');
    studyRoom.participants.forEach((p, i) => {
      console.log(`${i + 1}. ${p.username} (userId: ${p.userId})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeDuplicateParticipant();

