# SpireWorks Backend API

Backend server for SpireWorks Study Timer application with AI integration.

## Features

- ✅ Express.js REST API
- ✅ MongoDB database with Mongoose
- ✅ OpenAI AI integration for study recommendations and question generation
- ✅ Secure API key management
- ✅ CORS enabled for frontend communication

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- OpenAI API key (optional, for AI features)

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection
# Option 1: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/spireworks

# Option 2: MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spireworks?retryWrites=true&w=majority

# OpenAI API Key (Get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=your-openai-api-key-here

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 3. Set Up MongoDB

#### Option A: Local MongoDB

1. Install MongoDB:
   - Windows: Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Mac: `brew install mongodb-community`
   - Linux: `sudo apt-get install mongodb`

2. Start MongoDB:
   ```bash
   # Windows
   mongod

   # Mac/Linux
   sudo systemctl start mongod
   # or
   mongod
   ```

#### Option B: MongoDB Atlas (Cloud - Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free tier available)
4. Get your connection string
5. Update `MONGODB_URI` in `.env`

### 4. Get OpenAI API Key (Optional)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Add it to `.env` as `OPENAI_API_KEY`

**Note:** If you don't have an OpenAI API key, the app will use fallback algorithms.

### 5. Run the Server

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### AI Endpoints

#### POST `/api/ai/recommend-study-duration`
Get AI-recommended study duration.

**Request Body:**
```json
{
  "studyData": {
    "hoursStudiedToday": 2,
    "sessionCount": 3,
    "averageSessionLength": 25,
    "timeOfDay": 14,
    "fatigueLevel": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "recommendedMinutes": 25,
  "method": "ai"
}
```

#### POST `/api/ai/generate-questions`
Generate questions from file content.

**Request Body:**
```json
{
  "fileContent": "File content here...",
  "subject": "Mathematics",
  "numQuestions": 5
}
```

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "question": "What is...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Explanation..."
    }
  ],
  "method": "ai"
}
```

#### POST `/api/ai/create-reviewer`
Create a reviewer with questions from a file.

**Request Body:**
```json
{
  "fileName": "example.pdf",
  "fileContent": "File content...",
  "subject": "Mathematics",
  "userId": "user123",
  "fileId": "file123",
  "numQuestions": 10
}
```

**Response:**
```json
{
  "success": true,
  "reviewer": {
    "id": "reviewer_id",
    "fileName": "example.pdf",
    "subject": "Mathematics",
    "totalQuestions": 10,
    "questions": [...],
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

## Database Models

### User
- Email, password, name, username
- Study sessions, files, reviewers
- Total study time, streak

### StudySession
- User ID, duration, mode
- AI recommended duration
- Start/end time, study data

### File
- User ID, file name, content
- File type, subject, size
- Upload date

### Reviewer
- User ID, file ID
- Questions array
- Subject, total questions

## Project Structure

```
server/
├── models/          # MongoDB models
│   ├── User.js
│   ├── StudySession.js
│   ├── File.js
│   └── Reviewer.js
├── routes/          # API routes
│   ├── aiRoutes.js
│   ├── userRoutes.js
│   ├── fileRoutes.js
│   └── sessionRoutes.js
├── server.js        # Main server file
├── package.json
└── .env            # Environment variables (create this)
```

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running
- Check `MONGODB_URI` in `.env`
- For MongoDB Atlas, check your IP whitelist

### OpenAI API Error
- Verify your API key is correct
- Check your OpenAI account has credits
- The app will use fallback algorithms if API fails

### Port Already in Use
- Change `PORT` in `.env`
- Or kill the process using port 5000

## Security Notes

- ⚠️ **Never commit `.env` file to git**
- ⚠️ **Keep API keys secret**
- ⚠️ **Use environment variables for all secrets**
- ⚠️ **Enable authentication in production**

## Next Steps

- [ ] Add user authentication (JWT)
- [ ] Add file upload functionality
- [ ] Add study session tracking
- [ ] Add rate limiting
- [ ] Add request validation
- [ ] Add error logging

## Support

For issues or questions, please check the main project README.

