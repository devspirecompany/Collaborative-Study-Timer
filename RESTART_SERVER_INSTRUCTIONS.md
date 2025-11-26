# How to Fix: Rooms Not Showing Up

## Problem
The rooms exist in the database, but they're not showing in the room browser because the backend server needs to be restarted to load the new API endpoint.

## Solution

### Step 1: Restart Backend Server

1. **Find the terminal where your backend server is running**
   - Look for a terminal window running `node server.js`
   - Or check if there's a process running on port 5000

2. **Stop the server**
   - Press `Ctrl + C` in that terminal
   - Wait for it to stop completely

3. **Restart the server**
   ```bash
   cd server
   node server.js
   ```

4. **Verify it's working**
   - You should see: `🚀 Server running on port 5000`
   - You should see: `✅ MongoDB Connected`

### Step 2: Test the API Endpoint

After restarting, test if the endpoint works:
```bash
cd server
node test-api-endpoint.js
```

You should see the rooms listed instead of a 404 error.

### Step 3: Refresh Frontend

1. Go to: `http://localhost:3000/group-study`
2. Click "Browse Study Rooms"
3. You should now see the rooms!

## Alternative: Join Directly by Room Code

If you can't restart the server right now, you can still join rooms directly:

1. Go to: `http://localhost:3000/group-study`
2. Click "Join Room" button
3. Enter room code: `STUDY-HIYXPU`
4. Click "Join"
5. You'll be taken to: `http://localhost:3000/study-room/STUDY-HIYXPU`

This works even if the room browser doesn't show the rooms!

## Current Active Rooms

- **STUDY-HIYXPU** - Test Study Room (created just now)
- **STUDY-D1PZ78** - Test Study Room
- **STUDY-MG0X0S** - Test Study Room

All rooms are active and ready to join!

