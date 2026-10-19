const mongoose = require('mongoose');
const User = require('../models/User');
const DonationCenter = require('../models/DonationCenter');
const NgoApplication = require('../models/NgoApplication');

const STATUSES = ['pending', 'approved', 'rejected'];

function shape(app) {
  return {
    id: app._id,
    status: app.status,
    organisationName: app.organisationName,
    registrationNumber: app.registrationNumber,
    contactPhone: app.contactPhone,
    address: app.address,
    about: app.about,
    rejectionReason: app.rejectionReason,
    createdAt: app.createdAt,
    reviewedAt: app.reviewedAt || null,
    applicant:
      app.userId && app.userId.name
        ? { id: app.userId._id, name: app.userId.name, email: app.userId.email }
        : null,
    centre:
      app.centerId && app.centerId.name
        ? { id: app.centerId._id, name: app.centerId.name }
        : null,
  };
}

function loadApplication(id) {
  return NgoApplication.findById(id)
    .populate('userId', 'name email')
    .populate('centerId', 'name');
}

// GET /api/admin/ngo-applications?status=pending
const listApplications = async (req, res) => {
  try {
    const filter = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};

    const applications = await NgoApplication.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .populate('centerId', 'name');

    res.json({ applications: applications.map(shape) });
  } catch (error) {
    console.error('listApplications error:', error.message);
    res.status(500).json({ error: 'Could not load applications' });
  }
};

// POST /api/admin/ngo-applications/:id/approve
// body: { centerId }  to link an existing centre
//   or  { centre: { name, address, latitude, longitude, phone, openingHours } } to create one
const approveApplication = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid application id' });
    }

    const application = await NgoApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'This application was already reviewed' });
    }

    let centerId = req.body.centerId;

    if (centerId) {
      const exists = mongoose.isValidObjectId(centerId) && (await DonationCenter.exists({ _id: centerId }));
      if (!exists) {
        return res.status(400).json({ error: 'The chosen donation centre does not exist' });
      }
    } else {
      const c = req.body.centre || {};
      const latitude = Number(c.latitude);
      const longitude = Number(c.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      ) {
        return res.status(400).json({ error: 'Please enter valid coordinates for the new centre' });
      }

      const centre = await DonationCenter.create({
        name: String(c.name || '').trim() || application.organisationName,
        address: String(c.address || '').trim() || application.address,
        latitude,
        longitude,
        phone: String(c.phone || '').trim() || application.contactPhone,
        openingHours: String(c.openingHours || '').trim(),
        createdBy: req.userId,
      });
      centerId = centre._id;
    }

    const user = await User.findByIdAndUpdate(
      application.userId,
      { role: 'ngo', centerId },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'The applicant account no longer exists' });
    }

    application.status = 'approved';
    application.reviewedBy = req.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = '';
    application.centerId = centerId;
    await application.save();

    res.json({ application: shape(await loadApplication(application._id)) });
  } catch (error) {
    console.error('approveApplication error:', error.message);
    res.status(500).json({ error: 'Could not approve the application' });
  }
};

// POST /api/admin/ngo-applications/:id/reject   body: { reason }
const rejectApplication = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid application id' });
    }

    const application = await NgoApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'This application was already reviewed' });
    }

    application.status = 'rejected';
    application.reviewedBy = req.userId;
    application.reviewedAt = new Date();
    application.rejectionReason = String(req.body.reason || '').trim();
    await application.save();

    // They carry on as a normal donor account.
    await User.updateOne({ _id: application.userId, role: 'ngo_pending' }, { role: 'user' });

    res.json({ application: shape(await loadApplication(application._id)) });
  } catch (error) {
    console.error('rejectApplication error:', error.message);
    res.status(500).json({ error: 'Could not reject the application' });
  }
};

// GET /api/ngo/application  (any logged-in user: their own application, if any)
const getMyApplication = async (req, res) => {
  try {
    const application = await NgoApplication.findOne({ userId: req.userId })
      .select('status rejectionReason organisationName')
      .lean();

    res.json({
      application: application
        ? {
            status: application.status,
            rejectionReason: application.rejectionReason,
            organisationName: application.organisationName,
          }
        : null,
    });
  } catch (error) {
    console.error('getMyApplication error:', error.message);
    res.status(500).json({ error: 'Could not load your application' });
  }
};

module.exports = { listApplications, approveApplication, rejectApplication, getMyApplication };