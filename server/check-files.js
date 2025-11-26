const mongoose = require('mongoose');
const File = require('./models/File');

async function checkFiles() {
  try {
    await mongoose.connect('mongodb://localhost:27017/spireworks');
    console.log('\n=== All Files in Database ===\n');
    
    const files = await File.find({}).sort({ uploadedAt: -1 });
    
    console.log(`Total files: ${files.length}\n`);
    
    if (files.length === 0) {
      console.log('❌ No files found in database');
    } else {
      files.forEach((f, i) => {
        console.log(`${i + 1}. ${f.fileName}`);
        console.log(`   UserId: ${f.userId}`);
        console.log(`   Subject: ${f.subject}`);
        console.log(`   Type: ${f.fileType}`);
        console.log(`   Size: ${f.size} bytes`);
        console.log(`   Uploaded: ${f.uploadedAt}`);
        console.log('');
      });
    }
    
    // Check for specific user
    const userId = '6924575ae911e45a3dc26f7f'; // perosly's userId
    const userFiles = await File.find({ userId });
    console.log(`\n=== Files for user ${userId} (perosly) ===\n`);
    console.log(`Total: ${userFiles.length} files\n`);
    
    userFiles.forEach((f, i) => {
      console.log(`${i + 1}. ${f.fileName} (${f.subject})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFiles();

