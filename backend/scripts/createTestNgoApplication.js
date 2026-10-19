require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const User = require('../models/User');
const NgoApplication = require('../models/NgoApplication');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = 'ngo.applicant@gmail.com';

  if (await User.findOne({ email })) {
    console.log(`${email} already exists. Delete it first or use a different email.`);
  } else {
    const user = await User.create({
      name: 'Test Applicant',
      email,
      password: 'test1234',
      role: 'ngo_pending',
    });

    await NgoApplication.create({
      userId: user._id,
      organisationName: 'Test Helping Hands Society',
      registrationNumber: 'PPM-001-07-01012020',
      contactPhone: '04-123 4567',
      address: '12 Jalan Contoh, George Town, Penang',
      about: 'We collect and redistribute used clothing to families in need.',
    });

    console.log(`Created a pending NGO application. Login: ${email} / test1234`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});