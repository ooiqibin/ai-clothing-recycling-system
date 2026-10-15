require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find().select('email role').lean();

  if (users.length === 0) {
    console.log('No users found.');
  }

  users.forEach((u) => {
    console.log(`${u.email}  ->  role: ${u.role || '(none)'}`);
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});