# Backend Directory Structure & Documentation

This document maps out the entire backend architecture of the Social Issue Detector. It follows a clean Model-View-Controller (MVC) pattern, combined with a dedicated customized AI Engine.

```text
backend/
│
├── ai-engine/                 # Core Artificial Intelligence Logic
│   ├── engines/               # The "Brains" (Analyzers)
│   │   ├── emotionScorer.js   # Uses ML to score 7 emotions + calculates Despair
│   │   └── topicClassifier.js # Uses Zero-Shot ML to categorize text (e.g., Crime, Civic)
│   │
│   └── filters/               # The "Common Sense" & Final Judgement
│       ├── filterLayer.js     # Uses ML to detect Hyperbole, Specific Targets, & Emergencies
│       └── riskEngine.js      # Applies 10 strict human-coded rules to output Final Severity
│
├── controllers/               # Express Route Handlers (The "Managers")
│   ├── authController.js      # Handles Admin Registration, Login, and secure Cookie creation
│   ├── dashboardController.js # Aggregates DB data (pie chart info) for the frontend
│   ├── postController.js      # Handles single-post analysis and "resolving" threats
│   └── uploadController.js    # The smart Batch-Uploader to safely bypass AI rate limits
│
├── middleware/                # Security & Error Interceptors
│   ├── authMiddleware.js      # Protects routes by checking for valid JWT cookies/headers
│   └── errorHandler.js        # Formats crashes so it doesn't break the server
│
├── models/                    # MongoDB Database Schemas
│   ├── Post.js                # Expansive schema saving the text, AI logic, and threat level
│   └── User.js                # Admin user schema (encrypts passwords with bcrypt)
│
├── routes/                    # API Endpoints (The "Doors" to the server)
│   ├── analysisRoutes.js      # Basic fallback/test routes
│   ├── authRoutes.js          # /api/auth (Login, Logout, Register)
│   ├── dashboardRoutes.js     # /api/dashboard (Stats aggregation)
│   ├── postRoutes.js          # /api/posts (Single analyze, get all, patch resolve)
│   └── uploadRoutes.js        # /api/upload (Protected dataset uploader)
│
├── services/                  # The Master Orchestrators
│   └── analysisService.js     # Ties the entire 4-Phase AI Engine together into one async flow
│
├── utils/                     # Helper Functions
│   └── preprocessor.js        # Cleans incoming text (removes emojis, weird symbols)
│
├── .env                       # (Hidden) Secret keys, Mongo URI, and Hugging Face tokens
├── api.http                   # VS Code REST Client file filled with test datasets
├── package.json               # List of external libraries (express, mongoose, bcrypt, etc.)
└── server.js                  # The Entry Point. Starts the server and connects to the database
```

---

## Architectural Flow
If you trace a single piece of text entering the system, it follows this exact path through the directories:
1. **`server.js`** receives the request and passes it to **`routes`**.
2. A route forwards the request to a **`controller`**.
3. The controller hands the text to the **`services/analysisService.js`**.
4. The service passes the text down deep into the **`ai-engine`** (Topic, Emotion, Filter, Risk).
5. The final output is passed to **`models/Post.js`** to save into the database.
6. The controller finally replies to the user/frontend with "Success".
