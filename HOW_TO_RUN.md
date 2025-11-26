# 🚀 How to Run the Application

## Prerequisites

1. **Node.js** - Installed (check with `node --version`)
2. **MongoDB** - Should be running (check with `mongod --version`)
3. **npm** - Comes with Node.js

## Step-by-Step Instructions

### 1️⃣ Start MongoDB (if not running)

**Option A: Check if MongoDB is running**
```powershell
# Check if MongoDB is running
Get-Service -Name MongoDB -ErrorAction SilentlyContinue
```

**Option B: Start MongoDB manually**
```powershell
# If MongoDB is installed as a service
Start-Service MongoDB

# OR if you need to start it manually
mongod
```

**Note:** If MongoDB is not installed, you can skip this for now - the app will still work but won't save data to database.

---

### 2️⃣ Start the Backend Server

Open **Terminal 1** (PowerShell or Command Prompt):

```powershell
# Navigate to server folder
cd "C:\Users\Asus\Desktop\APP DEV\Collaborative-Study-Timer\server"

# Install dependencies (first time only)
npm install

# Start the backend server
npm run dev
```

**Expected Output:**
```
✅ MongoDB Connected: localhost
✅ Gemini AI initialized and ready
🚀 Server running on port 5000
```

**Backend URL:** `http://localhost:5000`

---

### 3️⃣ Start the Frontend

Open **Terminal 2** (NEW PowerShell or Command Prompt window):

```powershell
# Navigate to project root
cd "C:\Users\Asus\Desktop\APP DEV\Collaborative-Study-Timer"

# Install dependencies (first time only)
npm install

# Start the frontend
npm start
```

**Expected Output:**
```
Compiled successfully!
You can now view spireworks-react in the browser.
  Local:            http://localhost:3000
```

**Frontend URL:** `http://localhost:3000`

---

## ✅ Quick Start (All in One)

If you want to run everything quickly:

**Terminal 1 - Backend:**
```powershell
cd "C:\Users\Asus\Desktop\APP DEV\Collaborative-Study-Timer\server"
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd "C:\Users\Asus\Desktop\APP DEV\Collaborative-Study-Timer"
npm start
```

---

## 🔍 Verify Everything is Running

1. **Backend:** Open browser to `http://localhost:5000`
   - Should show: `{"message":"SpireWorks Backend API is running!"}`

2. **Frontend:** Open browser to `http://localhost:3000`
   - Should show the application interface

---

## ⚠️ Common Issues

### Port 5000 already in use
```powershell
# Find and kill the process
netstat -ano | findstr :5000
taskkill /F /PID <PID_NUMBER>
```

### Port 3000 already in use
```powershell
# Find and kill the process
netstat -ano | findstr :3000
taskkill /F /PID <PID_NUMBER>
```

### MongoDB not running
- The app will still work but won't save data
- To install MongoDB: https://www.mongodb.com/try/download/community

---

## 📝 Notes

- **Backend** runs on port **5000**
- **Frontend** runs on port **3000**
- Keep **both terminals open** while using the app
- Press `Ctrl+C` in terminal to stop the server

---

## 🎯 What's Working

✅ Backend API - Running on port 5000
✅ Question Generation - Works with or without AI
✅ Fallback System - Always generates questions
✅ Frontend - React app ready

---

**Ready to use!** 🎉

