/**
 * Script to restart the backend server
 * This will find and kill the existing server process, then start a new one
 */

const { spawn, exec } = require('child_process');
const http = require('http');

console.log('🔄 Restarting backend server...\n');

// First, try to find and kill existing node processes on port 5000
function killServerOnPort(port) {
  return new Promise((resolve) => {
    // Windows command to find process on port 5000
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error || !stdout) {
        console.log('ℹ️  No process found on port 5000 (server may not be running)');
        resolve();
        return;
      }

      // Extract PID from netstat output
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        }
      });

      if (pids.size === 0) {
        console.log('ℹ️  No process found to kill');
        resolve();
        return;
      }

      console.log(`🛑 Found ${pids.size} process(es) on port ${port}, killing...`);
      
      // Kill each process
      let killed = 0;
      pids.forEach(pid => {
        exec(`taskkill /PID ${pid} /F`, (error) => {
          if (!error) {
            killed++;
            console.log(`   ✅ Killed process ${pid}`);
          }
          if (killed === pids.size) {
            console.log('   ✅ All processes killed\n');
            setTimeout(resolve, 1000); // Wait a second for cleanup
          }
        });
      });
    });
  });
}

// Start the server
function startServer() {
  console.log('🚀 Starting server...\n');
  
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  });

  // Wait a bit, then test if server is up
  setTimeout(() => {
    testServer();
  }, 3000);

  return serverProcess;
}

// Test if server is responding
function testServer() {
  console.log('\n🧪 Testing server...');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/study-rooms',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Server is running and API endpoint is working!');
      console.log('   Status:', res.statusCode);
    } else if (res.statusCode === 404) {
      console.log('⚠️  Server is running but endpoint returns 404');
      console.log('   This might mean the route needs to be checked');
    } else {
      console.log('⚠️  Server responded with status:', res.statusCode);
    }
    process.exit(0);
  });

  req.on('error', (error) => {
    console.log('⚠️  Server might still be starting up...');
    console.log('   Try accessing http://localhost:5000/api/study-rooms in a few seconds');
    process.exit(0);
  });

  req.on('timeout', () => {
    req.destroy();
    console.log('⚠️  Server test timed out');
    process.exit(0);
  });

  req.end();
}

// Main execution
async function main() {
  await killServerOnPort(5000);
  startServer();
}

main();

