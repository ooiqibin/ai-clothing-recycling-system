require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    console.error('Usage: node scripts/makeAdmin.js your@email.com');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOneAndUpdate(
    { email },
    { role: 'admin' },
    { new: true }
  );

  if (!user) {
    console.error(`No account found with email ${email}. Register it in the app first.`);
  } else {
    console.log(`Done: ${user.email} is now an admin.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});