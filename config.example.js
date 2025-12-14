// Copy this file to config.js and update with your actual values

module.exports = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB Configuration
  // Replace with your MongoDB Atlas connection string (use standard format: mongodb://)
  // Example: mongodb://username:password@host:27017/mkbw?ssl=true&authSource=admin&retryWrites=true&w=majority
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw',

  // JWT Secret Key (Change this to a random string in production)
  JWT_SECRET: process.env.JWT_SECRET || 'maktabkhalidbinwaleedjwtSecret',

  // JWT Expiration
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',

  // File Upload Configuration
  MAX_FILE_SIZE: 5242880, // 5MB
  UPLOAD_PATH: './uploads',
};

