# 🤖 Gemini AI Setup - Quick Start Guide

## ✅ Step 1: Get Your FREE Gemini API Key

1. **Go to:** https://aistudio.google.com/app/apikey
2. **Sign in** with your Google account
3. **Click** "Create API Key"
4. **Copy** the API key (starts with `AIzaSy...`)

> **Note:** This is completely FREE! No credit card required. FREE tier includes:
> - 15 requests per minute
> - 1,500 requests per day
> - Perfect for development and personal use

---

## ✅ Step 2: Add API Key to Project

### Option A: Use the Setup Script (Recommended)
```powershell
# Run this in PowerShell from the project root
.\setup-gemini-key.ps1
```

### Option B: Manual Setup
1. Open `server/.env` file
2. Find the line: `GEMINI_API_KEY=your-gemini-api-key-here`
3. Replace `your-gemini-api-key-here` with your actual API key
4. Save the file

**Example:**
```
GEMINI_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

---

## ✅ Step 3: Restart Backend Server

```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

**Important:** The server must be restarted after adding/changing the API key!

---

## ✅ Step 4: Test Gemini

### Method 1: Use the Test Endpoint
Open your browser or use curl:
```
GET http://localhost:5000/api/ai/test-gemini
```

Or in PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/ai/test-gemini" -Method Get
```

### Method 2: Check Server Console
When the server starts, you should see:
```
✅ Gemini AI initialized and ready
✅ Gemini API key validated successfully on startup
```

### Method 3: Try Generating Questions
1. Upload a file in the app
2. Try generating questions
3. If Gemini is working, questions will be generated successfully

---

## 🔍 Troubleshooting

### ❌ "GEMINI_API_KEY not configured"
**Problem:** API key not found in `.env` file

**Solution:**
- Make sure `.env` file is in `server/` folder (not root)
- Make sure file is named exactly `.env` (not `.env.txt`)
- Make sure line is: `GEMINI_API_KEY=your-key-here` (no spaces around `=`)

### ❌ "API_KEY_INVALID" or "invalid API key"
**Problem:** API key is wrong or expired

**Solution:**
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Update `server/.env` file
4. Restart backend server

### ❌ "Quota exceeded" or "Rate limit"
**Problem:** FREE tier has rate limits

**Solution:**
- Wait a few minutes and try again
- FREE tier allows ~15 requests per minute
- For higher limits, you can upgrade (but FREE tier is usually enough)

### ❌ "Model not found"
**Problem:** Model name might be wrong

**Solution:**
- The code automatically tries different FREE tier models
- Make sure you're using a FREE tier API key
- Models used: `gemini-1.5-flash`, `gemini-1.5-flash-latest`

### ❌ Server shows "Gemini not initialized"
**Problem:** API key not loaded properly

**Solution:**
1. Check `server/.env` file exists
2. Verify API key is on its own line: `GEMINI_API_KEY=AIzaSy...`
3. Make sure no extra spaces or quotes
4. Restart backend server completely

---

## 🎯 What AI Features Are Available?

Once Gemini is configured, you can use:

1. **Question Generation** - Generate practice questions from uploaded files
   - Multiple choice questions
   - True/False questions
   - Fill-in-the-blank questions

2. **File Extraction Enhancement** - Better text extraction from DOCX files
   - Cleans formatting artifacts
   - Fixes extraction errors
   - Maintains document structure

3. **Study Notes Creation** - AI-generated review material from files

4. **Study Duration Recommendations** - Based on your study patterns

---

## 📊 Test Endpoints

### Test Gemini Status
```
GET /api/ai/test-gemini
```
Returns comprehensive status including:
- API key configuration
- Model availability
- Working models
- Recommendations

### Test Available Models
```
GET /api/ai/test-models
```
Tests all available Gemini models and shows which ones work.

---

## 🔐 Security Notes

- API keys are stored in `server/.env` (never commit to git)
- API keys are only used on the backend (never exposed to frontend)
- All AI calls go through the backend API
- `.env` file is in `.gitignore` (not tracked by git)

---

## 📚 Resources

- **Google AI Studio**: https://aistudio.google.com/
- **Gemini API Docs**: https://ai.google.dev/docs
- **Get API Key**: https://aistudio.google.com/app/apikey
- **API Key Management**: https://aistudio.google.com/app/apikey

---

## ✅ Verification Checklist

- [ ] API key obtained from https://aistudio.google.com/app/apikey
- [ ] API key added to `server/.env` file
- [ ] Backend server restarted
- [ ] Test endpoint shows Gemini is working
- [ ] Can generate questions from files
- [ ] Server console shows "Gemini AI initialized and ready"

---

**Need Help?** Check the backend console for detailed error messages. The test endpoint (`/api/ai/test-gemini`) provides specific recommendations for fixing issues.

