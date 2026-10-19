const mongoose = require('mongoose');
const EcoTip = require('../models/EcoTip');
// Make sure these models are registered so populate() can use them.
require('../models/User');
require('../models/DonationCenter');

const { CATEGORIES } = EcoTip;
const STATUSES = ['pending', 'published', 'rejected'];
const PAGE_SIZE = 12;
const MAX_PENDING_PER_NGO = 10;

const AUTHOR_POPULATE = {
  path: 'createdBy',
  select: 'name centerId',
  populate: { path: 'centerId', select: 'name' },
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function authorLabel(tip) {
  if (tip.createdByRole === 'admin') return 'EcoThread team';
  const user = tip.createdBy;
  return (user && user.centerId && user.centerId.name) || (user && user.name) || 'NGO partner';
}

function shape(tip) {
  return {
    id: String(tip._id),
    title: tip.title,
    content: tip.content,
    category: tip.category,
    status: tip.status,
    rejectionReason: tip.rejectionReason || '',
    author: authorLabel(tip),
    authorRole: tip.createdByRole,
    createdAt: tip.createdAt,
    updatedAt: tip.updatedAt,
    publishedAt: tip.publishedAt || null,
  };
}

function readTipInput(body) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const category = String(body.category || 'General').trim();

  if (title.length < 3 || title.length > 120) {
    return { error: 'Title must be 3 to 120 characters' };
  }
  if (content.length < 10 || content.length > 2000) {
    return { error: 'The tip text must be 10 to 2000 characters' };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: 'Please choose a valid category' };
  }
  return { value: { title, content, category } };
}

function checkId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid tip id' });
    return false;
  }
  return true;
}

// ---------- Any logged-in user ----------

// GET /api/eco-tips  (published tips only)
const listPublishedTips = async (req, res) => {
  try {
    const tips = await EcoTip.find({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(30)
      .populate(AUTHOR_POPULATE)
      .lean();

    res.json({ tips: tips.map(shape) });
  } catch (error) {
    console.error('listPublishedTips error:', error.message);
    res.status(500).json({ error: 'Could not load eco tips' });
  }
};

// ---------- NGO accounts ----------

// GET /api/ngo/eco-tips  (their own tips, with review status)
const listMyTips = async (req, res) => {
  try {
    const tips = await EcoTip.find({ createdBy: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate(AUTHOR_POPULATE)
      .lean();

    res.json({ tips: tips.map(shape) });
  } catch (error) {
    console.error('listMyTips error:', error.message);
    res.status(500).json({ error: 'Could not load your tips' });
  }
};

// POST /api/ngo/eco-tips  (waits for admin approval)
const createNgoTip = async (req, res) => {
  try {
    const input = readTipInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const waiting = await EcoTip.countDocuments({ createdBy: req.userId, status: 'pending' });
    if (waiting >= MAX_PENDING_PER_NGO) {
      return res.status(400).json({
        error: `You already have ${MAX_PENDING_PER_NGO} tips waiting for review. Please wait for an admin to review them.`,
      });
    }

    const tip = await EcoTip.create({
      ...input.value,
      status: 'pending',
      createdBy: req.userId,
      createdByRole: 'ngo',
    });

    const saved = await EcoTip.findById(tip._id).populate(AUTHOR_POPULATE).lean();
    res.status(201).json({ tip: shape(saved) });
  } catch (error) {
    console.error('createNgoTip error:', error.message);
    res.status(500).json({ error: 'Could not submit your tip' });
  }
};

// DELETE /api/ngo/eco-tips/:id  (only their own tips that are not published)
const deleteMyTip = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const tip = await EcoTip.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.userId,
      status: { $in: ['pending', 'rejected'] },
    });

    if (!tip) {
      return res.status(404).json({ error: 'Tip not found, or it is already published' });
    }

    res.json({ message: 'Tip deleted' });
  } catch (error) {
    console.error('deleteMyTip error:', error.message);
    res.status(500).json({ error: 'Could not delete the tip' });
  }
};

// ---------- Admin ----------

// GET /api/admin/eco-tips?status=&q=&page=
const listAllTips = async (req, res) => {
  try {
    const filter = {};

    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: pattern }, { content: pattern }];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [total, tips, pendingCount] = await Promise.all([
      EcoTip.countDocuments(filter),
      EcoTip.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate(AUTHOR_POPULATE)
        .lean(),
      EcoTip.countDocuments({ status: 'pending' }),
    ]);

    res.json({ pendingCount, total, page, pageSize: PAGE_SIZE, tips: tips.map(shape) });
  } catch (error) {
    console.error('listAllTips error:', error.message);
    res.status(500).json({ error: 'Could not load eco tips' });
  }
};

// POST /api/admin/eco-tips  (published straight away)
const createAdminTip = async (req, res) => {
  try {
    const input = readTipInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const tip = await EcoTip.create({
      ...input.value,
      status: 'published',
      createdBy: req.userId,
      createdByRole: 'admin',
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      publishedAt: new Date(),
    });

    const saved = await EcoTip.findById(tip._id).populate(AUTHOR_POPULATE).lean();
    res.status(201).json({ tip: shape(saved) });
  } catch (error) {
    console.error('createAdminTip error:', error.message);
    res.status(500).json({ error: 'Could not create the tip' });
  }
};

// PUT /api/admin/eco-tips/:id  (edit title, text and category)
const updateTip = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const input = readTipInput(req.body);
    if (input.error) return res.status(400).json({ error: input.error });

    const tip = await EcoTip.findByIdAndUpdate(req.params.id, input.value, {
      new: true,
      runValidators: true,
    })
      .populate(AUTHOR_POPULATE)
      .lean();

    if (!tip) return res.status(404).json({ error: 'Tip not found' });

    res.json({ tip: shape(tip) });
  } catch (error) {
    console.error('updateTip error:', error.message);
    res.status(500).json({ error: 'Could not update the tip' });
  }
};

// POST /api/admin/eco-tips/:id/approve
const approveTip = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const now = new Date();
    const tip = await EcoTip.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'published' } },
      {
        status: 'published',
        reviewedBy: req.userId,
        reviewedAt: now,
        publishedAt: now,
        rejectionReason: '',
      },
      { new: true }
    )
      .populate(AUTHOR_POPULATE)
      .lean();

    if (!tip) return res.status(404).json({ error: 'Tip not found, or already published' });

    res.json({ tip: shape(tip) });
  } catch (error) {
    console.error('approveTip error:', error.message);
    res.status(500).json({ error: 'Could not approve the tip' });
  }
};

// POST /api/admin/eco-tips/:id/reject   body: { reason }
// Also works on a published tip, to take it down.
const rejectTip = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const tip = await EcoTip.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'rejected' } },
      {
        status: 'rejected',
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        rejectionReason: String(req.body.reason || '').trim(),
      },
      { new: true }
    )
      .populate(AUTHOR_POPULATE)
      .lean();

    if (!tip) return res.status(404).json({ error: 'Tip not found, or already rejected' });

    res.json({ tip: shape(tip) });
  } catch (error) {
    console.error('rejectTip error:', error.message);
    res.status(500).json({ error: 'Could not reject the tip' });
  }
};

// DELETE /api/admin/eco-tips/:id
const deleteTip = async (req, res) => {
  try {
    if (!checkId(req, res)) return;

    const tip = await EcoTip.findByIdAndDelete(req.params.id);
    if (!tip) return res.status(404).json({ error: 'Tip not found' });

    res.json({ message: 'Tip deleted' });
  } catch (error) {
    console.error('deleteTip error:', error.message);
    res.status(500).json({ error: 'Could not delete the tip' });
  }
};

module.exports = {
  listPublishedTips,
  listMyTips,
  createNgoTip,
  deleteMyTip,
  listAllTips,
  createAdminTip,
  updateTip,
  approveTip,
  rejectTip,
  deleteTip,
};