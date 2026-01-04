const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

// Load environment variables
dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw';

const seedAdmin = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('ℹ️  Admin already exists:');
      console.log(`   Admin ID: ${existingAdmin.adminId}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log('   Password: (use the one you set or default: MKbW.123)');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@hes.edu',
      password: 'MKbW.123',
      role: 'admin',
      adminId: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Login credentials:');
    console.log('   ==================');
    console.log('   Admin ID: admin');
    console.log('   Password: MKbW.123');
    console.log('');
    console.log('   You can now login to the app with these credentials.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();

