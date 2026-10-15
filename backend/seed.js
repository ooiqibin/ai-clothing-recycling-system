require('dotenv').config();
const mongoose = require('mongoose');
const DonationCenter = require('./models/DonationCenter');

const sampleCenters = [
  // George Town
  {
    name: 'Kawan Shop (YWAM Penang)',
    address: '41, Lebuh Chulia, Georgetown, 10200 George Town, Penang',
    latitude: 5.4175,
    longitude: 100.3390,
  },
  {
    name: 'Salvation Army Family Thrift Store (Kedai Jimat)',
    address: '56D/56E Perak Plaza, Jalan Perak, 10150 Penang',
    latitude: 5.4164,
    longitude: 100.3327,
  },
  {
    name: 'Lighthouse Thrift Shop',
    address: '52L Penang Road, 10000 George Town, Penang',
    latitude: 5.4178,
    longitude: 100.3309,
  },
  {
    name: '2ToneBundle (KOMTAR)',
    address: '2B-4-2, Level 4, KOMTAR, Taman Lembah Sungai, 10000 George Town, Penang',
    latitude: 5.4142,
    longitude: 100.3289,
  },
  // Tanjung Tokong
  {
    name: 'WCC Value Shop @ Tanjung Tokong',
    address: 'M-02 & M-03, M Floor, Island 88, Jalan Tanjong Tokong, 10470 Penang',
    latitude: 5.4497,
    longitude: 100.3089,
  },
  // Bayan Lepas
  {
    name: 'D O U B T ? Thrift Store (Bayan Lepas)',
    address: '1st Floor, No. 12-L, Jalan Rumbia, 11900 Bayan Lepas, Penang',
    latitude: 5.3294,
    longitude: 100.2670,
  },
  {
    name: 'MF Mart (Bayan Lepas)',
    address: '186A, Jalan Sultan Azlan Shah, Kampung Sungai Tiram, 11900 Bayan Lepas, Penang',
    latitude: 5.3180,
    longitude: 100.2680,
  },
  // Seberang Perai (mainland Penang)
  {
    name: 'MF Mart (Bukit Mertajam)',
    address: '1778, Jalan Ciku, 14000 Bukit Mertajam, Penang',
    latitude: 5.3650,
    longitude: 100.4600,
  },
  {
    name: 'MF Mart (Permatang Pauh)',
    address: 'NSL 1903, Jalan Arowana, Kawasan Perniagaan Arowana, 13500 Permatang Pauh, Penang',
    latitude: 5.3980,
    longitude: 100.3980,
  },
  {
    name: 'Home2Home Community Store (Perai)',
    address: '11, Tingkat Kikik 7, Taman Inderawasih, 13600 Perai, Penang',
    latitude: 5.3920,
    longitude: 100.3850,
  },
  {
    name: 'D O U B T ? Thrift Store (Bandar Perai Jaya)',
    address: '102, Jalan Perai Jaya 2, Bandar Perai Jaya, 13600 Perai, Penang',
    latitude: 5.3850,
    longitude: 100.3870,
  },
  // Drop-off only
  {
    name: 'Salvation Army Drop-off - Penang Children\'s Home',
    address: '8A, Jalan Logan, 10400 Penang',
    latitude: 5.4210,
    longitude: 100.3290,
  },
];

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await DonationCenter.deleteMany({});
  await DonationCenter.insertMany(sampleCenters);
  console.log(`Seeded ${sampleCenters.length} donation centers across Penang`);
  process.exit();
});