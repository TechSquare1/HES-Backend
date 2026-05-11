# MKBW Backend API

Backend API server for Maktab Khalid Bin Waleed Management App.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Multer for file uploads

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the backend directory:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
# ALLOW_PUBLIC_REGISTRATION=true   # optional; enables student-only POST /api/auth/register
```

With `NODE_ENV=production`, **`JWT_SECRET` must be at least 24 characters** or the server exits on startup. `POST /api/auth/register` returns **403** unless `ALLOW_PUBLIC_REGISTRATION=true` (student-only; no staff self-signup).

### 3. Start Development Server
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Student self-registration **only if** `ALLOW_PUBLIC_REGISTRATION=true`; otherwise **403**
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

## Project Structure

```
backend/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/       # Custom middleware (auth, etc.)
├── models/          # MongoDB models
├── routes/          # API routes
├── uploads/         # Uploaded files
├── utils/           # Utility functions
├── server.js        # Main server file
└── package.json     # Dependencies
```

## Models

- User (Admin/Teacher/Student)
- Class
- Exam
- Attendance
- Fees
- Announcement

