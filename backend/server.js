require('dotenv').config();
// Only needed on networks that block MongoDB Atlas lookups (your home Wi-Fi). Not needed on Render.
if (process.env.USE_PUBLIC_DNS === 'true') {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const classifyRoutes = require('./routes/classifyRoutes');
const authRoutes = require('./routes/authRoutes');
const historyRoutes = require('./routes/historyRoutes');
const actionRoutes = require('./routes/actionRoutes');
const donationRoutes = require('./routes/donationRoutes');
const placesRoutes = require('./routes/placesRoutes');
const donationCenterRoutes = require('./routes/donationCenterRoutes');
const ngoAccountRoutes = require('./routes/ngoAccountRoutes');
const statsRoutes = require('./routes/statsRoutes');
const ngoApplicationRoutes = require('./routes/ngoApplicationRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const adminDonationRoutes = require('./routes/adminDonationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const ecoTipRoutes = require('./routes/ecoTipRoutes');
const rewardRoutes = require('./routes/rewardRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve uploaded images statically so the Android app can load them by URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

app.get('/', (req, res) => {
  res.json({ message: 'AI Clothing Recycling backend is running' });
});

// Places search needs no login or database, so it goes first.
app.use('/api', placesRoutes);

app.use('/api', classifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', historyRoutes);
app.use('/api', actionRoutes);
app.use('/api', donationRoutes);
app.use('/api', donationCenterRoutes);
app.use('/api', ngoAccountRoutes);
app.use('/api', statsRoutes);
app.use('/api', ngoApplicationRoutes);
app.use('/api', ngoRoutes);
app.use('/api', adminDonationRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', userManagementRoutes);
app.use('/api', ecoTipRoutes);
app.use('/api', rewardRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});