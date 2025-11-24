const mongoose = require('mongoose');
const File = require('./models/File');

async function migrateFiles() {
  try {
    await mongoose.connect('mongodb://localhost:27017/spireworks');
    console.log('\n=== Migrating Files to Correct UserId ===\n');
    
    // The user's actual userId
    const actualUserId = '6924575ae911e45a3dc26f7f';
    
    // Find all files with demo-user
    const demoFiles = await File.find({ userId: 'demo-user' });
    
    console.log(`Found ${demoFiles.length} files with userId 'demo-user'`);
    
    if (demoFiles.length === 0) {
      console.log('✅ No files to migrate');
      process.exit(0);
    }
    
    console.log('\nFiles to migrate:');
    demoFiles.forEach((f, i) => {
      console.log(`${i + 1}. ${f.fileName} (${f.subject})`);
    });
    
    // Update all files to use the actual userId
    const result = await File.updateMany(
      { userId: 'demo-user' },
      { $set: { userId: actualUserId } }
    );
    
    console.log(`\n✅ Migrated ${result.modifiedCount} files to userId: ${actualUserId}`);
    
    // Verify migration
    const migratedFiles = await File.find({ userId: actualUserId });
    console.log(`\n✅ Verification: ${migratedFiles.length} files now belong to user ${actualUserId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrateFiles();

