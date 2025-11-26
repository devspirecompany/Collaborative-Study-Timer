# Quick Fix: Make Rooms Show Up

## The Problem
The rooms exist in the database, but the room browser can't see them because the backend server needs to be restarted to load the new API endpoint.

## Quick Solution (2 steps)

### Step 1: Restart Backend Server

**Option A: If server is running in a terminal**
1. Go to the terminal where `node server.js` is running
2. Press `Ctrl + C` to stop it
3. Type: `node server.js` and press Enter

**Option B: If you need to start it fresh**
1. Open a terminal/command prompt
2. Navigate to server folder:
   ```bash
   cd "C:\Users\PC\Desktop\Collaborative-Study-Timer-paul\server"
   ```
3. Start the server:
   ```bash
   node server.js
   ```

### Step 2: Verify It Works

After restarting, you should see:
```
✅ MongoDB Connected
🚀 Server running on port 5000
```

Then test the endpoint:
```bash
node test-api-endpoint.js
```

You should see rooms listed (not a 404 error).

### Step 3: Refresh Browser

1. Go to: `http://localhost:3000/group-study`
2. Click "Browse Study Rooms"
3. You should now see: **Test Study Room** with code **STUDY-HIYXPU**

## Current Rooms in Database

- **STUDY-HIYXPU** - Test Study Room (most recent)
- **STUDY-D1PZ78** - Test Study Room  
- **STUDY-MG0X0S** - Test Study Room

All are active and ready!

