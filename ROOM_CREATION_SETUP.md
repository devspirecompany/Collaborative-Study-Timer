# Room Creation Setup Guide

## ✅ Current Setup Status

### 1. Database Model
- **Location:** `server/models/StudyRoom.js`
- **Status:** ✅ Complete
- **Features:**
  - Room code generation (unique)
  - Participants management
  - Document sharing
  - Chat messages
  - Shared notes
  - Study timer
  - Quiz functionality
  - Auto-expiration (24 hours)

### 2. Backend API Routes
- **Location:** `server/routes/studyRoomRoutes.js`
- **Status:** ✅ Complete
- **Main Endpoint:** `POST /api/study-rooms`
- **Registered in:** `server/server.js` (line 69)

### 3. Frontend Integration
- **Location:** `src/components/GroupStudy.jsx`
- **API Service:** `src/services/apiService.js`
- **Status:** ✅ Complete

## 🔧 Setup Requirements

### Prerequisites:
1. **MongoDB** must be running
   - Local: `mongodb://localhost:27017/spireworks`
   - Or cloud (MongoDB Atlas)

2. **Backend Server** must be running
   ```bash
   cd server
   npm install
   node server.js
   ```

3. **Environment Variables** (`.env` file in `server/` directory)
   ```
   MONGODB_URI=mongodb://localhost:27017/spireworks
   PORT=5000
   NODE_ENV=development
   ```

## 🚀 How Room Creation Works

### Step-by-Step Flow:

1. **User clicks "Create Room"** in frontend
2. **Frontend calls:** `createStudyRoom(userId, playerName, roomName)`
3. **API Request:** `POST http://localhost:5000/api/study-rooms`
4. **Backend Process:**
   - Validates userId and username
   - Generates unique room code (format: "STUDY-XXXXXX")
   - Creates StudyRoom document in MongoDB
   - Adds creator as first participant
   - Sets expiration (24 hours from creation)
5. **Response:** Returns room data with room code
6. **Frontend:** Shows room code modal for sharing

### Room Code Format:
- Format: `STUDY-XXXXXX` (6 random alphanumeric characters)
- Example: `STUDY-A3B7K9`
- Uniqueness: Automatically checked against database

## 📊 Database Schema

```javascript
{
  roomCode: "STUDY-ABC123",        // Unique identifier
  roomName: "Study Room 10:30 AM",  // Display name
  hostId: "user123",                // Creator's user ID
  hostName: "John Doe",            // Creator's username
  participants: [...],              // Array of users
  currentDocument: {...},           // Active document
  sharedFiles: [...],                // Shared files
  sharedNotes: [...],                // Collaborative notes
  chatMessages: [...],               // Chat history
  studyTimer: {...},                // Timer state
  quiz: {...},                      // Quiz data
  isActive: true,                   // Room status
  createdAt: Date,                  // Creation timestamp
  expiresAt: Date                   // Auto-expiration (24h)
}
```

## 🧪 Testing Room Creation

### Manual Test:
1. Start MongoDB: `mongod` (or ensure it's running)
2. Start backend: `cd server && node server.js`
3. Start frontend: `npm start`
4. Navigate to Group Study page
5. Click "Create Room"
6. Verify room code is generated and displayed

### API Test (using curl):
```bash
curl -X POST http://localhost:5000/api/study-rooms \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "username": "Test User",
    "roomName": "Test Room"
  }'
```

Expected Response:
```json
{
  "success": true,
  "room": {
    "roomCode": "STUDY-XXXXXX",
    "roomName": "Test Room",
    "hostId": "test-user-123",
    "hostName": "Test User",
    "participants": [...],
    "createdAt": "2025-11-24T..."
  }
}
```

## ✅ Verification Checklist

- [x] StudyRoom model exists (`server/models/StudyRoom.js`)
- [x] Routes file exists (`server/routes/studyRoomRoutes.js`)
- [x] Routes registered in server.js
- [x] Frontend API service configured
- [x] Frontend component handles room creation
- [ ] MongoDB running and connected
- [ ] Backend server running
- [ ] Environment variables configured

## 🔍 Troubleshooting

### Issue: "Failed to create room"
- **Check:** MongoDB is running
- **Check:** Backend server is running on port 5000
- **Check:** Database connection in `.env` file

### Issue: "Room code already exists"
- **Solution:** This shouldn't happen - code generation includes uniqueness check
- **If it does:** Check MongoDB connection and database state

### Issue: "Route not found"
- **Check:** Backend server is running
- **Check:** Route is registered in `server.js`
- **Check:** API endpoint is `/api/study-rooms` (not `/study-rooms`)

## 📝 Notes

- Rooms auto-expire after 24 hours
- Room codes are case-insensitive (stored uppercase)
- Only host can control certain features (document, quiz, timer)
- Participants can share files, add notes, and chat
- Room persists until host leaves or expires

