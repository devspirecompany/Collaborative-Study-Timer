# 🔍 Gemini AI File Extraction & Quiz Generation - Problem Diagnosis

## 📋 Overview

This document identifies common problems with Gemini AI integration for extracting files and generating quizzes, along with solutions.

---

## 🔴 **COMMON PROBLEMS & SOLUTIONS**

### **Problem #1: Gemini API Key Not Configured**

**Symptoms:**
- Error: "Gemini API key not configured"
- Error: "Gemini is not initialized!"
- Questions fail to generate
- Backend console shows: `⚠️ Gemini AI not configured`

**Diagnosis:**
Check `server/.env` file:
```bash
# Should have this line:
GEMINI_API_KEY=your-actual-api-key-here
```

**Solutions:**
1. **Get API Key:**
   - Go to: https://aistudio.google.com/app/apikey
   - Sign in with Google account
   - Click "Create API Key"
   - Copy the key (starts with `AIzaSy...`)

2. **Add to `.env` file:**
   - Location: `server/.env` (NOT root folder)
   - Format: `GEMINI_API_KEY=AIzaSy...` (no spaces, no quotes)
   - Make sure file is named exactly `.env` (not `.env.txt`)

3. **Restart Backend:**
   ```bash
   cd server
   npm start
   # or
   npm run dev
   ```

4. **Verify:**
   - Backend console should show: `✅ Gemini AI initialized and ready`
   - Check: `🔑 Gemini API Key: AIzaSy... (XX chars)`

---

### **Problem #2: Invalid API Key**

**Symptoms:**
- Error: "API_KEY_INVALID"
- Error: "invalid API key"
- Error: "API key not valid"
- Backend shows: `⚠️ GEMINI_API_KEY exists in env but Gemini not initialized`

**Diagnosis:**
- API key might be placeholder: `your-gemini-api-key-here`
- API key might have extra spaces or quotes
- API key might be expired or revoked

**Solutions:**
1. **Check for Placeholder:**
   ```bash
   # In server/.env, make sure it's NOT:
   GEMINI_API_KEY=your-gemini-api-key-here
   
   # Should be your actual key:
   GEMINI_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
   ```

2. **Remove Spaces/Quotes:**
   ```bash
   # ❌ WRONG:
   GEMINI_API_KEY = "AIzaSy..."
   GEMINI_API_KEY= "AIzaSy..."
   GEMINI_API_KEY="AIzaSy..."
   
   # ✅ CORRECT:
   GEMINI_API_KEY=AIzaSy...
   ```

3. **Get New Key:**
   - Go to: https://aistudio.google.com/app/apikey
   - Delete old key if needed
   - Create new API key
   - Update `server/.env`
   - Restart backend

---

### **Problem #3: File Extraction Failing (DOCX Files)**

**Symptoms:**
- Error: "Failed to extract text from docx file"
- Error: "DOCX file appears to be empty"
- Error: "Invalid DOCX file"
- File uploads but content is empty or shows placeholder

**Diagnosis:**
The file extraction happens BEFORE Gemini AI. If extraction fails, Gemini never gets the content.

**Check Backend Console:**
```
📄 Extracting text from DOCX file (XXXX bytes)...
❌ Mammoth extraction error: ...
```

**Solutions:**
1. **Verify File Format:**
   - File must be `.docx` (not `.doc`)
   - File must contain actual text (not just images)
   - File should not be corrupted

2. **Check File Size:**
   - Very large files (>10MB) might fail
   - Try with a smaller file first

3. **Verify File Content:**
   - Open file in Word/Google Docs
   - Make sure it has readable text
   - Save as `.docx` format

4. **Test with TXT File:**
   - Try uploading a `.txt` file first
   - If TXT works but DOCX doesn't, it's an extraction issue

---

### **Problem #4: Gemini Model Not Available**

**Symptoms:**
- Error: "All Gemini models failed"
- Error: "Model not found"
- Error: "Model name may be incorrect"
- Backend tries multiple models but all fail

**Diagnosis:**
The code tries these models in order:
1. `gemini-1.5-flash` (FREE tier)
2. `gemini-1.5-flash-latest` (FREE tier)
3. `gemini-pro` (older model)

**Solutions:**
1. **Verify API Key Type:**
   - Must be FREE tier key from Google AI Studio
   - Paid keys might use different models
   - Get key from: https://aistudio.google.com/app/apikey

2. **Test Models:**
   ```bash
   # Test endpoint (if available):
   GET http://localhost:5000/api/ai/test-models
   ```
   This will show which models work with your key.

3. **Check API Key Permissions:**
   - Make sure key is created from Google AI Studio
   - Not from Google Cloud Console (different service)

---

### **Problem #5: JSON Parsing Errors**

**Symptoms:**
- Error: "Could not parse JSON from Gemini response"
- Error: "Could not parse JSON from AI response"
- Questions array is empty
- Backend shows: `❌ Could not parse JSON from Gemini response`

**Diagnosis:**
Gemini returns text, and the code tries to extract JSON from it. Sometimes Gemini wraps JSON in markdown or adds extra text.

**Check Backend Console:**
```
📥 Received response from Gemini API
📄 Response preview (first 200 chars): ...
❌ Could not parse JSON from Gemini response
```

**Solutions:**
1. **Check Response Format:**
   - Gemini might return JSON wrapped in ```json code blocks
   - Code tries to remove these, but might miss edge cases

2. **Improve Prompt:**
   - The prompt already says "Return ONLY valid JSON array"
   - But Gemini sometimes adds explanations

3. **Manual Fix (if needed):**
   - Check backend console for raw response
   - See if JSON is there but parsing fails
   - Might need to improve regex in `aiRoutes.js` line 335-337

---

### **Problem #6: Rate Limiting / Quota Exceeded**

**Symptoms:**
- Error: "quota exceeded"
- Error: "QUOTA"
- Error: "rate limit"
- Works sometimes but fails after multiple requests

**Diagnosis:**
FREE tier has limits:
- 15 requests per minute
- 1,500 requests per day

**Solutions:**
1. **Wait and Retry:**
   - Wait 1-2 minutes between requests
   - Don't generate questions too quickly

2. **Reduce Requests:**
   - Generate fewer questions at once
   - Don't test repeatedly

3. **Check Usage:**
   - Go to: https://aistudio.google.com/app/apikey
   - Check your API key usage/limits

---

### **Problem #7: File Content Too Short or Invalid**

**Symptoms:**
- Error: "File content is too short"
- Error: "File content extraction failed"
- Questions generated but are generic/not relevant

**Diagnosis:**
- File must have at least 50-100 characters
- DOCX files with only images won't work
- Empty or corrupted files fail

**Solutions:**
1. **Verify File Content:**
   - Check backend console: `📄 File content length: XXX characters`
   - Should be > 100 characters for good questions

2. **Check Extraction:**
   - Backend should show: `✅ Extracted XXX characters from DOCX`
   - If shows 0 or very low, extraction failed

3. **Test with Sample File:**
   - Create a simple `.txt` file with 200+ words
   - Upload and test
   - If this works, the issue is with your DOCX file

---

## 🔧 **DIAGNOSTIC STEPS**

### Step 1: Check Backend Console
When you try to generate questions, watch the backend console for:
```
🔵 ===== Question Generation Request =====
📋 Subject: ...
📊 Requested questions: ...
📄 File content length: ... characters
🔑 Gemini configured: YES ✅ or NO ❌
🔑 Gemini API Key exists: YES ✅ or NO ❌
```

### Step 2: Check API Key Status
```bash
# In server/.env, verify:
GEMINI_API_KEY=AIzaSy...  # Should be your actual key

# Restart backend and check console:
✅ Gemini AI initialized and ready
🔑 Gemini API Key: AIzaSy... (XX chars)
```

### Step 3: Test File Extraction
```bash
# Upload a file and check backend console:
📄 Extracting text from DOCX file (XXXX bytes)...
✅ Extracted XXX characters from DOCX
📝 First 200 chars: ...
```

### Step 4: Test Gemini API
```bash
# Check if Gemini responds:
🤖 ===== Using Gemini AI =====
📤 Sending request to Gemini API...
📥 Received response from Gemini API
✅ Successfully generated X questions using Gemini AI
```

---

## 🐛 **DEBUGGING CHECKLIST**

- [ ] `GEMINI_API_KEY` is set in `server/.env`
- [ ] API key is NOT a placeholder value
- [ ] API key has no spaces or quotes
- [ ] Backend server was restarted after adding key
- [ ] Backend console shows: `✅ Gemini AI initialized and ready`
- [ ] File uploads successfully (check file content length)
- [ ] File extraction works (for DOCX files)
- [ ] File content is > 100 characters
- [ ] Not hitting rate limits (wait between requests)
- [ ] Using FREE tier API key from Google AI Studio
- [ ] API key is active (check at https://aistudio.google.com/app/apikey)

---

## 📞 **GETTING HELP**

If none of the above solutions work:

1. **Check Backend Console:**
   - Copy the full error message
   - Look for lines starting with `❌` or `⚠️`

2. **Check File Content:**
   - Verify file has actual text
   - Try with a simple `.txt` file first

3. **Test API Key:**
   - Go to: https://aistudio.google.com/app/apikey
   - Verify key is "Active"
   - Try creating a new key

4. **Check Network:**
   - Make sure backend can reach Google's API
   - Check firewall/proxy settings

---

## 📝 **CODE LOCATIONS**

- **Gemini Initialization:** `server/routes/aiRoutes.js` (lines 13-36)
- **Question Generation:** `server/routes/aiRoutes.js` (lines 219-475)
- **File Extraction:** `server/utils/fileExtractor.js`
- **File Upload:** `server/routes/fileRoutes.js` (lines 195-300)

---

## ✅ **EXPECTED WORKFLOW**

1. **User uploads file** → `POST /api/files`
2. **File content extracted** → `extractTextFromFile()` (for DOCX)
3. **Content stored in DB** → File model with `fileContent`
4. **User requests questions** → `POST /api/ai/generate-questions`
5. **Gemini generates questions** → `model.generateContent(prompt)`
6. **JSON parsed from response** → Extract array from text
7. **Questions returned** → Frontend displays questions

If any step fails, check the error message and refer to solutions above.

