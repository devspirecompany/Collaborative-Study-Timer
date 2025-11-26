/**
 * Test the GET /api/study-rooms endpoint
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/study-rooms',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🧪 Testing GET /api/study-rooms endpoint...\n');
console.log(`📍 URL: http://${options.hostname}:${options.port}${options.path}\n`);

const req = http.request(options, (res) => {
  console.log(`📡 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ Response received:');
      console.log(JSON.stringify(json, null, 2));
      
      if (json.success && json.rooms) {
        console.log(`\n✅ Found ${json.rooms.length} room(s)`);
        json.rooms.forEach((room, index) => {
          console.log(`   ${index + 1}. ${room.roomCode} - ${room.name} (Host: ${room.host})`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('\n💡 Make sure:');
  console.error('   1. Backend server is running (node server.js)');
  console.error('   2. Server is listening on port 5000');
  console.error('   3. MongoDB is connected');
});

req.end();

