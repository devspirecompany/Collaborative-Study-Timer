# SpireWorks Architecture & ERD Guide

This document captures how the Collaborative Study Timer (SpireWorks) is structured today so you can draw an accurate architecture diagram and accompanying entity-relationship diagram (ERD). All information is sourced from the current repository as of the latest sync.

---

## 1. High-Level System Overview

| Layer | Responsibilities | Key Artifacts |
| --- | --- | --- |
| **Client (React 19 SPA)** | Authentication flows, dashboards, study timer UI, file management, competitions, collaborative rooms | `src/App.jsx`, feature components under `src/components`, feature styles under `src/styles`, REST helpers in `src/services/apiService.js` & `aiService.js` |
| **API Layer (Node.js + Express)** | REST endpoints, AI proxying, study analytics, collaborative room state, validation, business logic | `server/server.js`, route handlers under `server/routes`, middleware for CORS + body parsing |
| **Persistence (MongoDB via Mongoose)** | Stores users, files, reviewer content, sessions, study rooms, competitions, notifications, productivity stats, achievements | Schemas in `server/models/*.js` |
| **External Services** | AI-powered recommendations & question generation, optional DNS validation | OpenAI (`OPENAI_API_KEY`), Google Gemini (`GEMINI_API_KEY`), HuggingFace inference, DNS MX lookup |

**Data Flow Summary for Diagramming**
1. Browser UI sends REST calls through `apiService` (CRUD + polling) and `aiService` (AI features) → `https://<backend>/api/*`.
2. Express routes validate payloads, orchestrate business rules, call AI SDKs/HTTP clients when needed, then read/write MongoDB through corresponding models.
3. Responses return JSON payloads, which drive state changes and UI updates (e.g., timers, charts, room synchronization).
4. Long-lived collaboration features (study rooms, competitions) rely on repeated polling endpoints rather than WebSockets.

---

## 2. Frontend Architecture Notes

- **Routing:** `src/App.jsx` wires React Router paths for login, registration, dashboards (`StudentDashboard`, `StudentStudyTimer`, `GroupStudy`, `StudyRoom`, `ReviewerStudy`, etc.).
- **State & Data Access:** Each component keeps local state and calls centralized helpers in `src/services/apiService.js` (REST) and `src/services/aiService.js` (AI requests with timeouts + fallbacks). There is no global state library; props and local hooks are used.
- **Feature Modules:**
  - **Authentication:** `StudentLogin.jsx`, `StudentRegistration.jsx` use `/api/users/login` and `/api/users/register`.
  - **Timer & Sessions:** `StudentStudyTimer.jsx` orchestrates study/break timers, calls `/api/ai/recommend-study-duration` via `aiService`, and persists sessions with `/api/sessions`.
  - **File Management & Reviewers:** `MyFiles.jsx`, `ReviewerStudy.jsx` interact with `/api/files` + `/api/ai/create-reviewer`. Reviewers returned from the backend already contain AI-generated notes, key points, and optional MCQs.
  - **Productivity & Achievements:** `ProductivityTracker.jsx`, `Achievements.jsx` call `/api/productivity` and `/api/achievements`.
  - **Group Study:** `GroupStudy.jsx`, `StudyRoom.jsx`, `SoloPractice.jsx`, `Achievements.jsx` rely on `/api/competitions` and `/api/study-rooms` endpoints for collaborative experiences (joining rooms, sharing files, chat, quizzes, shared timers).
- **Asset Layers:** CSS lives under `src/styles/`, and legacy static prototypes are preserved under `Collaborative Study Timer/` for reference but are not part of the React build.

**Diagram Tips:** Depict the React SPA as a single node with sub-boxes for “Authentication”, “Study Timer”, “File & Reviewer Management”, “Productivity & Achievements”, and “Collaboration”. Show `apiService`/`aiService` as the abstraction boundary funneling requests to the backend.

---

## 3. Backend Architecture Notes

- **Entry Point:** `server/server.js` configures dotenv, CORS (whitelist of localhost ports), JSON body parsing (10 MB for file content), MongoDB connection logging, and centralized error/404 handlers.
- **Routing Modules (under `server/routes`):**
  - `userRoutes.js`: registration with validation (length, email regex, optional DNS MX checks outside development) and login with bcrypt password verification.
  - `sessionRoutes.js`: CRUD + stats for study sessions (duration, mode, AI recommendations, metadata).
  - `fileRoutes.js`: file/folder CRUD, reviewer retrieval, ties into `File`, `Folder`, and `Reviewer` models.
  - `aiRoutes.js`: proxies AI-powered study duration recommendations and question/reviewer generation using OpenAI (chat completions) and Google Gemini (primary) with Hugging Face fallback logic; includes detailed error messaging for invalid keys or quotas.
  - `achievementRoutes.js` & `productivityRoutes.js`: compute and return progress, achievements, and productivity stats.
  - `competitionRoutes.js`: manages real-time quiz competitions (room lifecycle, players, scoring, AI opponents).
  - `studyRoomRoutes.js`: extensive collaborative endpoints (room creation/join, shared documents, reviewer display, shared notes, chat messages, scroll sync, synchronized timers, quiz coordination, room cleanup).
  - `notificationRoutes.js`: CRUD and AI-generated notifications (e.g., study insights, reminders).
  - `activityRoutes.js`: aggregates recent sessions, achievements, competitions into a timeline.
- **Middleware & Cross-Cutting Concerns:** Centralized error handler logs stack traces, preserves route error messages, and responds with JSON structures. Input validation is handled per-route; there is no global schema validation layer yet.
- **External Integrations:**
  - **OpenAI** (`OPENAI_API_KEY`) for study duration insights and fallback question/reviewer generation.
  - **Google Gemini** (`GEMINI_API_KEY`) prioritized for question/reviewer generation; includes runtime tests to ensure model availability.
  - **Hugging Face** public inference endpoint as a no-key fallback for conversational snippets.
  - **DNS MX lookup** to ensure email domains exist (skipped in development).

**Diagram Tips:** Draw Express as the central node with grouped submodules: `AI Controller`, `User & Auth`, `Study Sessions`, `Content Management (Files/Reviewers)`, `Engagement (Achievements/Productivity/Notifications)`, `Collaboration (Study Rooms/Competitions)`. Show arrows to MongoDB collections and to external AI providers.

---

## 4. Representative Data Flows (for Sequence/Architecture Views)

1. **Authentication**
   - `StudentRegistration` → `POST /api/users/register` → Validates payload → Creates `User` (bcrypt pre-save hook) → Returns sanitized user info.
   - `StudentLogin` → `POST /api/users/login` → Bcrypt comparison → Returns profile for client-side storage (no JWT yet).

2. **AI-Guided Study Session**
   - Timer UI collects `studyData` → `POST /api/ai/recommend-study-duration` (3s timeout on frontend).
   - Backend selects OpenAI if key present, otherwise deterministic fallback, attaches motivational insights, and responds with minutes + method metadata.
   - When session completes, frontend calls `POST /api/sessions` storing `duration`, `mode`, `aiRecommendedDuration`, and aggregated `studyData`.

3. **File Upload → Reviewer Generation → Collaborative Sharing**
   - `MyFiles` uses `/api/files` to store metadata (`File` collection) and, optionally, folder associations.
   - `ReviewerStudy` calls `POST /api/ai/create-reviewer`. Backend uses Gemini/OpenAI to produce structured `reviewContent`, `keyPoints`, and MCQs, then stores them in `Reviewer`.
   - Study room host shares the reviewer or raw document via `/api/study-rooms/:roomCode/set-document` followed by `/set-reviewer`, enabling synchronized viewing, key point callouts, and chat annotations.

4. **Group Competition / Study Room Quiz**
   - `GroupStudy` uses `/api/competitions/create|join|answer|complete` to orchestrate 1v1 battles or group quizzes, persisting results in `Competition`.
   - Within `StudyRoom`, quiz routes (`/quiz/start`, `/quiz/answer`, `/quiz/next`, `/quiz/end`) update embedded quiz state directly inside the `StudyRoom` document so all participants retrieve the same snapshot through polling.

---

## 5. Entity-Relationship Reference (MongoDB Collections)

| Collection | Key Fields | Relationships |
| --- | --- | --- |
| `User` | `email`, `password` (hashed), `firstName`, `lastName`, `username`, `studySessions[]`, `files[]`, `reviewers[]`, `totalStudyTime`, `currentStreak`, `createdAt` | Referenced by most other collections via `userId`. Arrays store ObjectId references to `StudySession`, `File`, `Reviewer`. |
| `StudySession` | `userId`, `duration`, `mode` (`study|break|longbreak`), `aiRecommended`, `aiRecommendedDuration`, `completed`, `startTime`, `endTime`, `studyData{hoursStudiedToday, sessionCount, timeOfDay, fatigueLevel}` | `userId` references `User`. Aggregated in productivity stats and activities. |
| `File` | `userId` (string), `fileName`, `fileContent`, `fileType`, `subject`, `size`, `uploadedAt` | `userId` matches `User`._id string. Linked to `Reviewer.fileId` and study room shared files. |
| `Folder` | `userId`, `folderName`, `createdAt` | Logical grouping for `File` entries; uniqueness enforced per `userId`. |
| `Reviewer` | `userId`, `fileId`, `fileName`, `subject`, `reviewContent`, `keyPoints[]`, `questions[]`, `totalQuestions`, `createdAt` | Connects AI-generated study material to source `File` and `User`. Used in reviewer study mode and shared in study rooms. |
| `Achievement` | `userId`, `achievementType`, `title`, `description`, `icon`, `progress`, `target`, `current`, `unlocked`, `unlockedAt`, `createdAt` | Tied to `User`; served to dashboards, notifications, and activities timelines. |
| `Productivity` | `userId`, `date`, `totalStudyTime`, `sessionsCompleted`, `averageFocusScore`, `subjectsStudied[]`, activity counters, `weeklyGoal`, `dailyGoal`, `streak` | Tracks longitudinal metrics per user for charts and targets. |
| `Competition` | `roomId`, `subject`, `questions[]`, `players[]` (embedded: `userId`, `playerName`, `score`, `answers[]`, `isAI`), `maxPlayers`, `isGroupQuiz`, `opponentType`, `status`, `startedAt`, `completedAt`, `winner` | Linked to users through `players.userId` (ObjectId or string). Activities module inspects these documents. |
| `StudyRoom` | `roomCode`, `roomName`, `hostId`, `hostName`, `participants[]`, `sharedFiles[]`, `currentDocument`, `sharedNotes[]`, `chatMessages[]`, `studyTimer`, `quiz`, `scrollPosition`, `isActive`, `createdAt`, `expiresAt` | Core collaboration document. Embeds everything needed to reconstruct shared state. `expiresAt` TTL index auto-cleans rooms. |
| `Notification` | `userId`, `type`, `title`, `message`, `icon`, `color`, `read`, `actionUrl`, `metadata`, `createdAt`, `expiresAt` | Triggered by achievements, study reminders, AI insights, competitions. |
| `Productivity` | (see above) | (see above) |
| `Achievement` | (see above) | (see above) |
| `StudySession` | (see above) | (see above) |

> **Diagramming Note:** Even though MongoDB is schema-less, representing collections as ERD boxes with their relationships (one-to-many between `User` and `StudySession`/`File`/`Reviewer`/`Achievement`/`Productivity`/`Notification`, plus many-to-many via embedded arrays such as `StudyRoom.participants`) makes it easier to reason about data ownership. Highlight embedded subdocuments (e.g., `StudyRoom.chatMessages`, `Competition.players`) as composition relationships.

---

## 6. Additional Considerations for Accurate Diagrams

- **Environment & Deployment:** Local dev uses two processes (React at `localhost:3000`, Express at `localhost:5000`). `.env` separation between root (frontend) and `server/.env`.
- **Security Status:** Authentication currently returns plain user objects without JWT/session tokens; production hardening would add JWT middleware, validation, and rate limiting (mentioned in `server/README.md` “Next Steps”).
- **Polling vs. Realtime:** Collaborative features rely on REST polling intervals; there is no WebSocket layer yet, so architecture diagrams should reflect repeated HTTP calls instead of persistent sockets.
- **AI Key Management:** All secret keys stay server-side. Frontend never calls OpenAI/Gemini directly; `aiService` only talks to `/api/ai/*`.
- **Legacy Assets:** The `Collaborative Study Timer/` directory contains static HTML/CSS/JS prototypes; they are not part of the production build but can inform UI flows if needed. Note this in any historical context section of your guide.

---

## 7. Next Steps for Diagram Authors

1. **Architecture Diagram:** Depict SPA → Express API → MongoDB, with arrows to OpenAI/Gemini/HuggingFace from the AI route handler. Include submodules described above for clarity.
2. **ERD Diagram:** Use the table in Section 5 as the authoritative source. Make sure to represent:
   - `User` as the central node.
   - One-to-many edges to `StudySession`, `File`, `Reviewer`, `Achievement`, `Productivity`, `Notification`.
   - Embedded relationships in `StudyRoom` and `Competition` (can be shown as nested entities or linked boxes for participants/chat messages/questions).
3. **Flowcharts/Swimlanes:** If you need additional visuals, leverage Section 4’s narratives to map request/response timelines for authentication, AI study planning, reviewer generation, and collaborative quizzes.

This guide should stay in sync with repository changes; update it when schemas or major flows evolve to keep your diagrams accurate.


