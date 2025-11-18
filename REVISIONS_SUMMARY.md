# 📋 Revisions Summary & Implementation Plan

## Overview
This document outlines the revisions needed for the Collaborative Study Timer application based on user feedback.

---

## 1. ✅ Test Type Selection

### Current State:
- System only generates **Multiple Choice** questions
- No option for users to specify test type

### Required Changes:
- Add test type selection dropdown/options:
  - **Multiple Choice** (current default)
  - **True/False**
  - **Fill-in-the-Blank**
  - **Short Answer** (optional)
- User should select test type before generating questions
- AI should generate questions based on selected test type

### AI Involvement: ✅ YES
- AI (Gemini/OpenAI) will need to generate different question formats based on test type
- Prompts need to be modified to generate appropriate question types

---

## 2. ✅ Email Validation

### Current State:
- Only basic format validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- No actual email verification

### Required Changes:
- **Format Validation** (already exists) ✅
- **Domain Validation**: Check if email domain exists (e.g., gmail.com, yahoo.com)
- **Email Verification**: Send verification email before account activation
  - OR at minimum: Check if email domain has valid MX records

### Implementation Options:
1. **Simple**: Domain MX record check (no external service needed)
2. **Advanced**: Send verification email (requires email service like SendGrid, Nodemailer)

### AI Involvement: ❌ NO
- This is a standard validation feature, no AI needed

---

## 3. ✅ Achievements - Specific Rewards

### Current State:
Achievements exist but rewards are not clearly displayed to users.

### Specific Rewards Defined:
1. **🌅 Early Bird** - Study 5 days in a row before 8 AM
2. **🏃 Study Marathon** - Complete 100 hours of study time
3. **🔥 Streak Master** - Maintain a 30-day study streak
4. **⭐ Perfect Week** - Study every day for 7 days
5. **🦉 Night Owl** - Study 10 sessions after 10 PM
6. **🧠 Focused Mind** - Complete 50 study sessions
7. **👥 Social Learner** - Join 10 group study competitions
8. **🏆 Quiz Master** - Win 5 competitions
9. **📁 File Organizer** - Upload 20 files
10. **⏰ Time Warrior** - Study for 4 hours in a single day

### Required Changes:
- Display specific reward details in Achievements page
- Show progress clearly (e.g., "3/5 days" for Early Bird)
- Show what users get when they unlock achievements (badges, notifications)

### AI Involvement: ⚠️ PARTIAL
- AI generates celebratory notification messages when achievements are unlocked
- But the achievement system itself doesn't require AI

---

## 4. ⚠️ Productivity Tracker and Budgets

### Current State:
- Productivity tracker exists with:
  - Daily Goal: 2 hours (default)
  - Weekly Goal: 4 hours (default)
- These are like "time budgets" for study

### Required Clarification:
**What are "budgets"?**
- **Time Budgets**: Daily/weekly study time goals (already exists)
- **Subject Budgets**: Allocate time per subject?
- **Session Budgets**: Limit number of sessions per day?

### Recommended Implementation:
- Keep current "goals" system (daily/weekly study time)
- Add ability to set custom goals
- Show progress bars for goals
- Add "budget" terminology in UI if needed

### AI Involvement: ⚠️ PARTIAL
- AI can suggest optimized goals based on user patterns (already exists)
- But the budget/goal system itself doesn't require AI

---

## 5. ✅ Group Study - Question Generation Process

### Current State:
- Room code system exists
- Questions can come from:
  - Reviewer questions (if user brings them)
  - Default sample questions
  - AI-generated questions

### Required Clarification:
**How should questions work in Group Study?**

### Recommended Flow:
1. **Room Creator** selects:
   - Subject
   - Test type (Multiple Choice, True/False, etc.)
   - Number of questions
   - Source: From file OR AI-generated

2. **Question Generation Options**:
   - **Option A**: Room creator picks a file → AI generates questions
   - **Option B**: Room creator manually creates questions
   - **Option C**: Use existing reviewer questions

3. **Participants**:
   - Join via room code
   - See same questions
   - Answer simultaneously

### Required Changes:
- Add test type selection when creating room
- Add file selection for question generation
- Clarify who creates/picks questions (room creator)
- Show question source in room info

### AI Involvement: ✅ YES
- AI generates questions from selected files
- AI can generate questions based on test type

---

## 6. ✅ Study Battle - Specific Concept

### Current State:
- Competition system exists (2 players)
- Real-time quiz battles
- Score tracking
- Winner determination

### Current Concept:
**Study Battle** = Competitive quiz mode where:
- 2 players compete in real-time
- Same questions, same time limit (20 seconds per question)
- Score tracked per player
- Winner is player with highest score

### Required Documentation:
- Clearly explain Study Battle concept in UI
- Show how it works:
  1. Create/Join battle room
  2. Wait for opponent
  3. Answer questions simultaneously
  4. See real-time scores
  5. Winner announced at end

### AI Involvement: ⚠️ PARTIAL
- AI can generate questions for battles (if using file-based questions)
- But the battle mechanics don't require AI

---

## 📝 Implementation Priority

1. **High Priority**:
   - Test Type Selection (affects core functionality)
   - Email Validation (security/UX)
   - Group Study question flow clarification

2. **Medium Priority**:
   - Achievements rewards display
   - Study Battle documentation

3. **Low Priority**:
   - Productivity budgets clarification (already works, just needs better UI)

---

## 🤖 AI-Related Features Summary

**Features that REQUIRE AI:**
- ✅ Test Type Selection (AI generates different question formats)
- ✅ Group Study question generation (AI generates from files)

**Features that USE AI but don't REQUIRE it:**
- ⚠️ Achievements (AI generates notification messages)
- ⚠️ Productivity goals (AI suggests optimized goals)

**Features that DON'T use AI:**
- ❌ Email Validation
- ❌ Study Battle mechanics (unless using AI-generated questions)

---

## Next Steps

1. Implement test type selection in question generation
2. Add email domain validation
3. Enhance achievements UI to show specific rewards
4. Clarify group study question generation flow
5. Add Study Battle documentation/explanation
6. Improve productivity tracker UI for goals/budgets

