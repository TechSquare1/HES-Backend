/**
 * One-time: set feeScope='male' on existing nazims missing the field.
 * Run from backend folder: node scripts/setNazimFeeScope.js
 * Optional — app already defaults missing feeScope to 'male'.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const mongoOpts = {
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 60000,
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readPreference: 'primary',
  directConnection: false,
};

async function runUpdate() {
  return User.updateMany(
    { role: 'nazim', $or: [{ feeScope: { $exists: false } }, { feeScope: null }] },
    { $set: { feeScope: 'male' } }
  );
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mkbw';
  await mongoose.connect(uri, mongoOpts);

  let result;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      result = await runUpdate();
      break;
    } catch (e) {
      if (e.code === 10107 && attempt < 3) {
        console.log(`Atlas not primary (attempt ${attempt}/3), retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }

  console.log('Updated nazims:', result.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
