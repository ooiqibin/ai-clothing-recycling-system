require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await mongoose.connection.collection('donationcenters').drop().catch(() => {});
  console.log('donationcenters collection removed');
  process.exit();
});