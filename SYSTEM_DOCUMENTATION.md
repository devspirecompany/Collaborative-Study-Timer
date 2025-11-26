# 📚 Collaborative Study Timer - System Documentation

## 🎯 System Overview

Ang **Collaborative Study Timer** ay isang web application na ginagamit ng mga estudyante para sa:
- **Study Timer** - Pomodoro-style timer para sa focused study sessions
- **File Management** - Upload at organize ng study materials (PDF, DOCX, TXT)
- **AI-Powered Practice** - Auto-generate ng practice questions mula sa uploaded files
- **Group Study** - Real-time collaborative study rooms
- **Productivity Tracking** - Track study time, streaks, achievements
- **Competitions** - Friendly competitions sa pag-aaral

---

## 🖥️ Frontend (User Interface)

### **Technology Stack:**
- **React 19.2.0** - Main framework para sa UI
- **React Router DOM 6.30.1** - Para sa navigation (page routing)
- **React Scripts 5.0.1** - Build tool at development server
- **CSS3** - Styling at design

### **Frontend Structure:**
```
src/
├── components/          # UI Components
│   ├── StudentLogin.jsx
│   ├── StudentRegistration.jsx
│   ├── StudentDashboard.jsx
│   ├── StudentStudyTimer.jsx
│   ├── MyFiles.jsx
│   ├── SoloPractice.jsx
│   ├── GroupStudy.jsx
│   ├── Achievements.jsx
│   ├── ProductivityTracker.jsx
│   └── shared/
│       └── sidebar.jsx
├── services/           # API Communication
│   ├── apiService.js   # Backend API calls
│   └── aiService.js    # AI-related API calls
├── styles/             # CSS Files
│   └── [Component].css
└── App.jsx             # Main App Component
```

### **Key Frontend Features:**
1. **User Authentication** - Login at Registration
2. **Dashboard** - Overview ng study stats
3. **Study Timer** - Pomodoro timer with break modes
4. **File Upload** - Upload PDF, DOCX, TXT files
5. **Folder Organization** - Organize files by subject/folder
6. **Practice Mode** - Generate questions from files
7. **Group Study Rooms** - Real-time collaboration
8. **Achievements** - Badges at rewards system
9. **Productivity Stats** - Charts at analytics

### **Frontend Port:**
- **Development:** `http://localhost:3000`
- **Production:** Build folder (static files)

---

## ⚙️ Backend (Server & API)

### **Technology Stack:**
- **Node.js** - JavaScript runtime environment
- **Express.js 4.18.2** - Web framework para sa API
- **MongoDB** - Database (via Mongoose)
- **Mongoose 8.0.3** - Database ORM (Object-Relational Mapping)
- **JWT (JSON Web Tokens) 9.0.2** - User authentication
- **Bcryptjs 2.4.3** - Password encryption
- **CORS 2.8.5** - Cross-Origin Resource Sharing (para sa frontend-backend communication)
- **Dotenv 16.3.1** - Environment variables management

### **Backend Structure:**
```
server/
├── models/              # Database Models
│   ├── User.js
│   ├── StudySession.js
│   ├── File.js
│   ├── Folder.js
│   ├── Reviewer.js
│   ├── StudyRoom.js
│   ├── Achievement.js
│   ├── Competition.js
│   ├── Productivity.js
│   └── Notification.js
├── routes/              # API Endpoints
│   ├── userRoutes.js
│   ├── sessionRoutes.js
│   ├── fileRoutes.js
│   ├── aiRoutes.js
│   ├── achievementRoutes.js
│   ├── productivityRoutes.js
│   ├── competitionRoutes.js
│   ├── studyRoomRoutes.js
│   └── notificationRoutes.js
├── utils/               # Helper Functions
│   └── fileExtractor.js # Extract text from PDF/DOCX
├── server.js            # Main server file
└── package.json         # Dependencies
```

### **API Endpoints:**

#### **User Management:**
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile

#### **Study Sessions:**
- `POST /api/sessions` - Create study session
- `GET /api/sessions/user/:userId` - Get user sessions
- `GET /api/sessions/stats/:userId` - Get study statistics
- `PUT /api/sessions/:id` - Update session

#### **File Management:**
- `POST /api/files` - Upload file
- `GET /api/files/user/:userId` - Get user files
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/folders` - Create folder

#### **AI Features:**
- `POST /api/ai/generate-questions` - Generate questions from file
- `POST /api/ai/recommend-study-duration` - AI study duration recommendation
- `GET /api/ai/test-models` - Test AI models

#### **Study Rooms:**
- `POST /api/study-rooms` - Create study room
- `POST /api/study-rooms/join` - Join room
- `GET /api/study-rooms/:roomCode` - Get room data

### **Backend Port:**
- **Default:** `http://localhost:5000`
- **API Base URL:** `http://localhost:5000/api`

---

## 🗄️ Database

### **Database System:**
- **MongoDB** - NoSQL database
- **Mongoose** - ODM (Object Document Mapper) para sa MongoDB

### **Database Models:**

#### **1. User Model**
- Email, password (encrypted), firstName, lastName, username
- Study sessions, files, reviewers
- Total study time, current streak
- Created date

#### **2. StudySession Model**
- User ID, duration (seconds), mode (study/break/longbreak)
- AI recommended duration
- Start/end time, completion status
- Study data (hours studied, session count, time of day)

#### **3. File Model**
- User ID, file name, file type (PDF/DOCX/TXT)
- File content (extracted text)
- Subject, folder, file size
- Upload date

#### **4. Folder Model**
- User ID, folder name, subject
- Files array
- Created date

#### **5. Reviewer Model**
- User ID, file ID
- Questions array
- Subject, total questions
- Created date

#### **6. StudyRoom Model**
- Room code, host ID, participants
- Current document, scroll position
- Shared notes, chat messages
- Study timer state
- Created date, expiration date

#### **7. Achievement Model**
- User ID, achievement type
- Title, description, icon
- Unlocked date

#### **8. Competition Model**
- Competition name, description
- Participants, start/end date
- Leaderboard, winner

#### **9. Productivity Model**
- User ID, date
- Total study time, sessions completed
- Average focus score
- Subjects studied, files uploaded
- Daily/weekly goals

#### **10. Notification Model**
- User ID, type, message
- Read status, created date

### **Database Connection:**
- **Local MongoDB:** `mongodb://localhost:27017/spireworks`
- **MongoDB Atlas (Cloud):** `mongodb+srv://username:password@cluster.mongodb.net/spireworks`

---

## 🤖 AI Services

### **AI Providers:**

#### **1. Google Gemini AI**
- **SDK:** `@google/generative-ai 0.24.1`
- **Models Used:**
  - `gemini-pro` (default)
  - `gemini-1.5-flash` (fallback)
  - `gemini-1.5-pro` (fallback)
- **Features:**
  - Question generation from file content
  - Study duration recommendations
  - Productivity insights
  - Achievement notifications
- **API Key:** Required in `server/.env` as `GEMINI_API_KEY`
- **Free Tier:** Available (Google AI Studio)

#### **2. OpenAI (Optional)**
- **SDK:** `openai 4.20.1`
- **Model:** `gpt-3.5-turbo`
- **Features:**
  - Alternative AI for question generation
  - Study duration recommendations
- **API Key:** Optional in `server/.env` as `OPENAI_API_KEY`
- **Paid Service:** Requires credits

### **AI Features:**
1. **Question Generation** - Generate practice questions from uploaded files
2. **Study Duration Recommendation** - AI-recommended study session length
3. **Productivity Insights** - AI-generated insights about study habits
4. **Smart Notifications** - AI-generated achievement messages

### **File Processing:**
- **PDF Parsing:** `pdf-parse 2.4.5` - Extract text from PDF files
- **DOCX Parsing:** `mammoth 1.11.0` - Extract text from Word documents
- **TXT Files:** Direct text reading

---

## 📦 Dependencies Summary

### **Frontend Dependencies:**
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^6.30.1",
  "react-scripts": "5.0.1"
}
```

### **Backend Dependencies:**
```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "@google/generative-ai": "^0.24.1",
  "openai": "^4.20.1",
  "mammoth": "^1.11.0",
  "pdf-parse": "^2.4.5",
  "axios": "^1.13.2"
}
```

---

## 🔧 Environment Variables

### **Backend (.env file sa `server/` folder):**
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/spireworks
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spireworks

# AI Services
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here (optional)

# JWT Secret (for authentication)
JWT_SECRET=your-secret-key-here
```

### **Frontend (.env file sa root folder):**
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🏗️ System Architecture

### **How It Works:**

1. **User Registration/Login:**
   - Frontend sends credentials → Backend validates → MongoDB stores user → JWT token returned → Frontend stores token

2. **File Upload:**
   - User uploads file → Frontend sends to backend → Backend extracts text (PDF/DOCX) → Stores in MongoDB → Returns file ID

3. **Question Generation:**
   - User selects file → Frontend requests questions → Backend sends file content to AI (Gemini) → AI generates questions → Backend returns questions → Frontend displays

4. **Study Timer:**
   - User starts timer → Frontend tracks time → On completion, sends session to backend → Backend saves to MongoDB → Updates user stats

5. **Group Study:**
   - User creates/joins room → Backend creates room in MongoDB → Real-time updates via polling → All participants see same state

---

## 🚀 Deployment

### **Development:**
- **Frontend:** `npm start` (runs on port 3000)
- **Backend:** `npm start` sa `server/` folder (runs on port 5000)

### **Production:**
- **Frontend:** `npm run build` → Static files sa `build/` folder
- **Backend:** Deploy to cloud (Heroku, AWS, etc.)
- **Database:** MongoDB Atlas (cloud) or local MongoDB

---

## 📊 Key Features Breakdown

### **1. Study Timer**
- Pomodoro technique (25 min study, 5 min break)
- AI-recommended duration
- Multiple modes: Study, Short Break, Long Break
- Progress tracking
- Session history

### **2. File Management**
- Upload PDF, DOCX, TXT files
- Organize by folders/subjects
- Extract text content automatically
- Delete files

### **3. Practice Mode**
- Select file from folders
- Generate questions (5-30 questions)
- AI-powered question generation
- Practice interface

### **4. Group Study**
- Create study rooms
- Join via room code
- Shared document viewing
- Real-time chat
- Shared notes
- Synchronized timer

### **5. Productivity Tracking**
- Daily/weekly study time
- Session count
- Streak tracking
- Focus score
- Subject breakdown
- Goal setting

### **6. Achievements**
- Badge system
- Unlock achievements
- Progress tracking
- Motivational rewards

### **7. Competitions**
- Create competitions
- Join competitions
- Leaderboard
- Winner tracking

---

## 🔐 Security Features

1. **Password Encryption** - Bcryptjs hashing
2. **JWT Authentication** - Secure token-based auth
3. **CORS Protection** - Frontend-backend communication security
4. **Input Validation** - Server-side validation
5. **Environment Variables** - Secrets stored in .env (not in code)

---

## 📝 Notes

- **Frontend at Backend** ay separate applications pero nagco-communicate via API
- **MongoDB** ay NoSQL database (document-based, hindi table-based)
- **React** ay JavaScript library para sa building user interfaces
- **Express** ay web framework para sa Node.js
- **AI Services** ay optional pero recommended para sa best experience
- **File Upload** limit: 10MB per file
- **API Timeout:** 30 seconds (60 seconds for file uploads)

---

## 🆘 Support & Troubleshooting

### **Common Issues:**

1. **MongoDB Connection Error**
   - Check if MongoDB is running
   - Verify `MONGODB_URI` in `.env`

2. **AI Not Working**
   - Check `GEMINI_API_KEY` in `server/.env`
   - Restart backend server after adding API key

3. **Frontend Can't Connect to Backend**
   - Check if backend is running on port 5000
   - Verify `REACT_APP_API_URL` in frontend `.env`

4. **Port Already in Use**
   - Change `PORT` in backend `.env`
   - Or kill process using the port

---

## 📅 Version Information

- **Frontend:** React 19.2.0
- **Backend:** Node.js with Express 4.18.2
- **Database:** MongoDB with Mongoose 8.0.3
- **AI:** Google Gemini AI 0.24.1
- **Last Updated:** 2024



