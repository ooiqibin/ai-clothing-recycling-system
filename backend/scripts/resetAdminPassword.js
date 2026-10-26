require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3] || '';
  const name = (process.argv[4] || 'Admin').trim();

  if (!email || password.length < 6) {
    console.error("Usage: node scripts/resetAdminPassword.js admin@email.com 'new-password' [name]");
    console.error('The password needs at least 9 characters.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email });

  if (user) {
    console.log(`Found ${email} (current role: ${user.role}).`);

    user.password = password; // the model hashes it when saving
    user.role = 'admin';
    user.suspended = false;
    user.suspendedReason = '';
    user.suspendedAt = null;
    await user.save();

    console.log('Password reset. This account is an admin.');
  } else {
    await User.create({ name, email, password, role: 'admin' });
    console.log(`Created a new admin account: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});