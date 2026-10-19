require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const points = Number(process.argv[3]);

  if (!email || !Number.isInteger(points)) {
    console.error('Usage: node scripts/givePoints.js user@email.com 500');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOneAndUpdate(
    { email },
    { $inc: { rewardPoints: points } },
    { new: true }
  );

  console.log(
    user
      ? `${user.email} now has ${user.rewardPoints} points.`
      : `No account found with email ${email}.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});