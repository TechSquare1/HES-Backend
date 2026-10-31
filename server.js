const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

// Load environment variables
dotenv.config();

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 24) {
    console.error('FATAL: Set JWT_SECRET (24+ characters) when NODE_ENV=production.');
    process.exit(1);
  }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms) IP:${req.ip}`);
  });
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw';

mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 60000, // 60 seconds - give more time to find primary
  socketTimeoutMS: 60000,
  connectTimeoutMS: 60000,
  maxPoolSize: 10,
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readPreference: 'primary', // FORCE primary node for all operations
  directConnection: false, // Ensure replica set discovery
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🔗 Host: ${mongoose.connection.host}`);
})
.catch((err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
  console.error('\n💡 Troubleshooting Tips:');
  console.error('1. Check if database name is in connection string: /mkbw');
  console.error('2. Verify IP address is whitelisted in MongoDB Atlas (0.0.0.0/0)');
  console.error('3. Check if MongoDB cluster is running (not paused)');
  console.error('4. Try different network (mobile hotspot)');
  console.error('5. Disable VPN/Proxy if enabled');
  console.error('6. Check your password and username\n');
  // Don't exit - let the server retry
});

// MongoDB connection event handlers
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Maktab Khalid Bin Waleed API',
    status: 'Running',
    version: '1.0.0'
  });
});

// Health check for Railway (must respond quickly, no DB dependency)
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));
app.use('/api/nazim', require('./routes/nazim'));
app.use('/api/complaints', require('./routes/complaint'));
app.use('/api/qr', require('./routes/qr'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Accessible from network at: http://localhost:${PORT} or http://YOUR_IP:${PORT}`);
  console.log(`📱 Update frontend api.js with your computer's IP address`);
});