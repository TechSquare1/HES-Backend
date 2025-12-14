/**
 * Script to create an Admin user
 * Run this script from the backend folder:
 * node scripts/createAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB connection string - update this if needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw';

// Admin user details - CHANGE THESE AS NEEDED
const ADMIN_DATA = {
  name: 'Admin',
  adminId: 'ADMIN001',
  email: 'admin@mkbw.com',
  password: 'Admin@123',  // This will be hashed
  role: 'admin',
  isActive: true,
};

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, salt);

    // Check if admin already exists
    const existingAdmin = await mongoose.connection.db.collection('users').findOne({
      $or: [
        { adminId: ADMIN_DATA.adminId },
        { email: ADMIN_DATA.email },
      ],
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Existing Admin ID:', existingAdmin.adminId);
      console.log('   Existing Email:', existingAdmin.email);
    } else {
      // Insert admin user
      const result = await mongoose.connection.db.collection('users').insertOne({
        ...ADMIN_DATA,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('✅ Admin user created successfully!');
      console.log('');
      console.log('📋 Admin Login Credentials:');
      console.log('   ─────────────────────────');
      console.log('   Admin ID: ' + ADMIN_DATA.adminId);
      console.log('   Password: ' + ADMIN_DATA.password);
      console.log('   ─────────────────────────');
      console.log('');
      console.log('💡 Use the Admin ID to login from the Staff option on the login page.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdmin();

