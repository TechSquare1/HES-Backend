const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 30000, // 30 seconds
  maxPoolSize: 10, // Maintain up to 10 socket connections
  retryWrites: true,
  w: 'majority'
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
  process.exit(1); // Exit on connection failure
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Maktab Khalid Bin Waleed API',
    status: 'Running',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));
app.use('/api/nazim', require('./routes/nazim'));

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

