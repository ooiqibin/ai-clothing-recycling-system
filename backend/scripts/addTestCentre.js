require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const DonationCenter = require('../models/DonationCenter');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const center = await DonationCenter.create({
    name: 'Test Donation Centre',
    address: 'Penang',
    latitude: 5.3416,
    longitude: 100.2819,
  });

  console.log('Added:', center.name, '| id:', center._id.toString());

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});