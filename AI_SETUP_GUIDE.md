# 🤖 AI Setup Guide - Collaborative Study Timer

## Overview
This app uses **Google Gemini AI (FREE tier)** for question generation and study recommendations. No credit card required!

## ✅ Quick Setup (5 minutes)

### Step 1: Get FREE Gemini API Key
1. Go to: **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key (looks like: `AIzaSy...`)

### Step 2: Add API Key to Backend
1. Go to `server/` folder
2. Create a file named `.env` (if it doesn't exist)
3. Add this line:
   ```
   GEMINI_API_KEY=your-api-key-here
   ```
   Replace `your-api-key-here` with the API key you copied

### Step 3: Restart Backend Server
```bash
cd server
npm start
# or if using nodemon:
npm run dev
```

### Step 4: Verify It Works
1. Check the backend console - you should see:
   ```
   ✅ Gemini AI initialized and ready
   ✅ Gemini API key appears to be valid
   ```

2. Try generating questions from a file in the app

## 🔍 Troubleshooting

### ❌ "Gemini API key not configured"
**Problem:** API key not found in `.env` file

**Solution:**
- Make sure `.env` file is in `server/` folder (not root folder)
- Make sure the file is named exactly `.env` (not `.env.txt`)
- Make sure the line is: `GEMINI_API_KEY=your-key-here` (no spaces around `=`)
- Restart the backend server after adding the key

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
- Make sure you're using a FREE tier API key (not a paid one)
- Models used: `gemini-1.5-flash`, `gemini-1.5-flash-latest`

## 📋 What Models Are Used?

### Primary (FREE Tier):
- **gemini-1.5-flash** - Fast, FREE, perfect for question generation
- **gemini-1.5-flash-latest** - Latest version of flash model

### Fallback (if needed):
- **gemini-pro** - Older model, may still work

### Optional (Paid):
- **OpenAI GPT-3.5-turbo** - Only if you set `OPENAI_API_KEY` (requires paid credits)

## 🎯 What AI Features Are Used?

1. **Question Generation** - From uploaded files (PDF, DOCX, TXT)
   - Multiple choice questions
   - True/False questions
   - Fill-in-the-blank questions

2. **Study Notes Creation** - AI-generated review material from files

3. **Study Duration Recommendations** - Based on your study patterns

4. **Achievement Notifications** - Personalized messages when you unlock achievements

## 💰 Cost

**FREE!** Google Gemini FREE tier includes:
- 15 requests per minute
- 1,500 requests per day
- No credit card required
- Perfect for development and small projects

## 🔐 Security

- API keys are stored in `server/.env` (never commit this file to git)
- API keys are only used on the backend (never exposed to frontend)
- All AI calls go through the backend API

## 📚 Resources

- **Google AI Studio**: https://aistudio.google.com/
- **Gemini API Docs**: https://ai.google.dev/docs
- **Get API Key**: https://aistudio.google.com/app/apikey

## ❓ Still Having Issues?

1. Check backend console for error messages
2. Verify `.env` file is in `server/` folder
3. Make sure API key has no extra spaces or quotes
4. Restart backend server after changing `.env`
5. Test API key at: https://aistudio.google.com/app/apikey (should show as "Active")

---

**Note:** The AI is completely optional. If you don't set up the API key, the app will still work but question generation will fail. All other features work without AI.

