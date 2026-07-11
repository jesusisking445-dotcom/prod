const express = require('express');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');
const BlogPost = require('../models/BlogPost');
const ChatConversation = require('../models/ChatConversation');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  const [totalUsers, totalAppointments, totalClinic, totalAssessments] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Appointment.countDocuments({ status: { $in: ['completed', 'confirmed'] } }),
    Clinic.countDocuments({ status: 'active' }),
    Assessment.countDocuments({ status: 'completed' })
  ]);

  const appointmentsThisMonth = await Appointment.countDocuments({
    createdAt: {
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    }
  });

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalAppointments,
      totalClinics: totalClinic,
      totalAssessments,
      appointmentsThisMonth
    }
  });
}));

// Appointments created per day for the last 7 days — feeds the dashboard bar chart
router.get('/dashboard/weekly', asyncHandler(async (req, res) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const raw = await Appointment.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
  ]);

  const countsByDay = {};
  raw.forEach(r => { countsByDay[r._id] = r.count; });

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: countsByDay[key] || 0
    });
  }

  res.json({ success: true, days });
}));

router.get('/assessments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, level } = req.query;
  const query = {};
  if (level) query['result.level'] = level;

  const assessments = await Assessment.find(query)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Assessment.countDocuments(query);
  const emergencyCount = await Assessment.countDocuments({ 'result.level': 'emergency', createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } });

  res.json({ success: true, assessments, total, emergencyCount });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;

  const query = { isActive: true };
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    users,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['user', 'dentist', 'admin', 'clinic_manager', 'content_admin', 'live_chat_agent'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    user: user.toJSON()
  });
}));

router.patch('/users/:id/toggle-status', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    success: true,
    user: user.toJSON()
  });
}));

router.get('/clinics', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'active' } = req.query;

  const clinics = await Clinic.find({ status })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('manager', 'firstName lastName email')
    .sort({ createdAt: -1 });

  const total = await Clinic.countDocuments({ status });

  res.json({
    success: true,
    clinics,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.post('/clinics', asyncHandler(async (req, res) => {
  const { name, location, contact, services, specialties, manager } = req.body;

  const clinic = new Clinic({
    name,
    location,
    contact,
    services,
    specialties,
    manager,
    status: 'active'
  });

  await clinic.save();

  res.status(201).json({
    success: true,
    clinic
  });
}));

router.patch('/clinics/:id', asyncHandler(async (req, res) => {
  const clinic = await Clinic.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!clinic) {
    throw new AppError('Clinic not found', 404);
  }

  res.json({
    success: true,
    clinic
  });
}));

router.patch('/clinics/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['active', 'inactive', 'suspended'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const clinic = await Clinic.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!clinic) {
    throw new AppError('Clinic not found', 404);
  }

  res.json({
    success: true,
    clinic
  });
}));

router.get('/appointments', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const query = {};
  if (status) query.status = status;

  const appointments = await Appointment.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'firstName lastName email')
    .populate('clinic', 'name')
    .sort({ appointmentDate: -1 });

  const total = await Appointment.countDocuments(query);

  res.json({
    success: true,
    appointments,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.patch('/appointments/:id/status', asyncHandler(async (req, res) => {
  const { status, consultationNotes } = req.body;

  if (!['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    {
      status,
      ...(consultationNotes && { consultationNotes })
    },
    { new: true }
  );

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  res.json({
    success: true,
    appointment
  });
}));

router.post('/blog', asyncHandler(async (req, res) => {
  const { title, content, category, excerpt } = req.body;

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const post = new BlogPost({
    title,
    slug,
    content,
    excerpt,
    category,
    author: req.user._id,
    status: 'draft'
  });

  await post.save();

  res.status(201).json({
    success: true,
    post
  });
}));

router.get('/blog', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = status ? { status } : {};

  const posts = await BlogPost.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('author', 'firstName lastName')
    .sort({ createdAt: -1 });

  const total = await BlogPost.countDocuments(query);

  res.json({
    success: true,
    posts,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.patch('/blog/:id', asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!post) {
    throw new AppError('Post not found', 404);
  }

  res.json({
    success: true,
    post
  });
}));

router.patch('/blog/:id/publish', asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndUpdate(
    req.params.id,
    { status: 'published', publishedAt: new Date() },
    { new: true }
  );

  if (!post) {
    throw new AppError('Post not found', 404);
  }

  res.json({
    success: true,
    post
  });
}));

router.get('/chat/conversations', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, assignedAgent } = req.query;

  const query = {};
  if (status) query.status = status;
  if (assignedAgent) query.assignedAgent = assignedAgent;

  const conversations = await ChatConversation.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'firstName lastName email')
    .populate('assignedAgent', 'firstName lastName')
    .sort({ createdAt: -1 });

  const total = await ChatConversation.countDocuments(query);

  res.json({
    success: true,
    conversations,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.get('/chat/conversations/:id/messages', asyncHandler(async (req, res) => {
  const ChatMessage = require('../models/ChatMessage');
  const messages = await ChatMessage.find({ conversationId: req.params.id })
    .populate('sender', 'firstName lastName role')
    .sort({ createdAt: 1 });

  res.json({ success: true, messages });
}));

router.post('/chat/conversations/:id/reply', asyncHandler(async (req, res) => {
  const ChatMessage = require('../models/ChatMessage');
  const { content } = req.body;
  if (!content) {
    throw new AppError('content is required', 400);
  }

  const conversation = await ChatConversation.findById(req.params.id);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  const message = new ChatMessage({
    conversationId: conversation._id,
    sender: req.user._id,
    senderRole: 'admin',
    content
  });
  await message.save();

  conversation.messageCount += 1;
  conversation.lastMessage = { content, sender: req.user._id, timestamp: new Date() };
  conversation.status = 'assigned';
  if (!conversation.assignedAgent) conversation.assignedAgent = req.user._id;
  await conversation.save();

  res.status(201).json({ success: true, message });
}));

router.patch('/chat/conversations/:id/assign', asyncHandler(async (req, res) => {
  const { agentId } = req.body;

  const conversation = await ChatConversation.findByIdAndUpdate(
    req.params.id,
    { assignedAgent: agentId, status: 'assigned' },
    { new: true }
  );

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  res.json({
    success: true,
    conversation
  });
}));

module.exports = router;


// ── Feature 18: agents list (alias for users?role=dentist|agent) ──
// livechat-admin.html calls /api/admin/agents to populate the assign dropdown.
router.get('/agents', asyncHandler(async (req, res) => {
  const agents = await User.find({
    role: { $in: ['admin', 'live_chat_agent', 'dentist', 'clinic_manager'] },
    isActive: true
  })
    .select('firstName lastName email role')
    .sort({ firstName: 1 });

  res.json({ success: true, agents });
}));
