require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // same DNS fix as server.js

const mongoose = require('mongoose');
const ClassificationResult = require('../models/ClassificationResult');
const { POINTS_PER_DONATED_ITEM } = require('../config/points');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const reusable = await ClassificationResult.updateMany(
    { category: 'reusable', status: { $in: ['pending', 'awaiting_verification'] } },
    { $set: { potentialPoints: POINTS_PER_DONATED_ITEM } }
  );

  const others = await ClassificationResult.updateMany(
    { category: { $ne: 'reusable' }, status: 'pending' },
    { $set: { potentialPoints: 0 } }
  );

  console.log(`Reusable items set to ${POINTS_PER_DONATED_ITEM} points: ${reusable.modifiedCount}`);
  console.log(`Recyclable and damaged items set to 0 points: ${others.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});