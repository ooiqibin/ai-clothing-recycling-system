require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // bypass local DNS that blocks Atlas SRV lookups

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});