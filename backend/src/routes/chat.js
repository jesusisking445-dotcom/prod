const express = require('express');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { optional } = require('../middleware/auth');
const { sendWhatsAppMessage } = require('../utils/whatsappService');

const router = express.Router();

function canAccess(conversation, req) {
  if (req.user && req.user.role === 'admin') return true;
  if (req.user && conversation.user && conversation.user.toString() === req.user._id.toString()) return true;
  // Guest-owned conversations have no `user` — anyone holding the (unguessable)
  // conversation id can continue it, same trust model as an email thread link.
  if (!conversation.user) return true;
  return false;
}

// Start a conversation — works for logged-in patients AND anonymous website visitors
router.post('/conversations', optional, asyncHandler(async (req, res) => {
  const { subject, category, guestName, guestEmail } = req.body;

  if (!req.user && !guestName) {
    throw new AppError('guestName is required to start a chat without an account', 400);
  }

  const conversation = new ChatConversation({
    user: req.user ? req.user._id : undefined,
    guestName: req.user ? undefined : guestName,
    guestEmail: req.user ? undefined : guestEmail,
    channel: 'website',
    subject,
    category: category || 'general'
  });

  await conversation.save();

  res.status(201).json({ success: true, conversation });
}));

// List MY conversations (logged-in patients only — admins use /api/admin/chat/conversations)
router.get('/conversations', optional, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const conversations = await ChatConversation.find({ user: req.user._id })
    .populate('assignedAgent', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({ success: true, conversations });
}));

router.post('/conversations/:conversationId/messages', optional, asyncHandler(async (req, res) => {
  const { content, messageType = 'text', guestName } = req.body;

  if (!content) {
    throw new AppError('Message content required', 400);
  }

  const conversation = await ChatConversation.findById(req.params.conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }
  if (!canAccess(conversation, req)) {
    throw new AppError('Unauthorized', 403);
  }

  const message = new ChatMessage({
    conversationId: req.params.conversationId,
    sender: req.user ? req.user._id : undefined,
    senderName: req.user ? undefined : (guestName || conversation.guestName || 'Visitor'),
    senderRole: req.user ? (req.user.role === 'admin' ? 'admin' : 'user') : 'guest',
    messageType,
    content
  });

  await message.save();

  conversation.messageCount += 1;
  conversation.lastMessage = { content, sender: req.user ? req.user._id : undefined, timestamp: new Date() };
  conversation.status = req.user && req.user.role === 'admin' ? 'assigned' : 'open';
  await conversation.save();

  // ── Emit real-time socket event to anyone in this conversation room ──────
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${req.params.conversationId}`).emit('new-message', {
        _id:            message._id,
        conversationId: req.params.conversationId,
        content:        message.content,
        senderRole:     message.senderRole,
        senderName:     message.senderName,
        createdAt:      message.createdAt
      });
    }
  } catch (socketErr) {
    // Never let socket errors block the HTTP response
  }

  // ── Notify live chat agent via WhatsApp ─────────────────────────────────
  // Only fires when a patient or guest sends a message (not agent-to-patient).
  // Degrades silently if WhatsApp env vars are not set.
  try {
    const senderIsAgent = req.user && ['admin', 'live_chat_agent'].includes(req.user.role);

    if (!senderIsAgent) {
      const populatedConv = await ChatConversation.findById(req.params.conversationId)
        .populate('assignedAgent', 'firstName lastName whatsappNumber email');

      const patientName = req.user
        ? `${req.user.firstName} ${req.user.lastName}`
        : (conversation.guestName || 'A patient');

      if (populatedConv?.assignedAgent?.whatsappNumber) {
        // Conversation has an assigned agent — notify just them
        const agent     = populatedConv.assignedAgent;
        const waMessage = `🦷 *HomoDentHealth Live Chat*\n\n*Patient:* ${patientName}\n*Message:*\n${content}\n\n_Reply to this WhatsApp message to respond to the patient._`;

        const waMessageId = await sendWhatsAppMessage(agent.whatsappNumber, waMessage);

        // Store the WA message ID so we can match the agent's reply to this conversation
        if (waMessageId) {
          await ChatConversation.findByIdAndUpdate(req.params.conversationId, {
            lastWhatsappMsgId: waMessageId
          });
        }
      } else {
        // No agent assigned yet — broadcast to ALL available live_chat_agents
        const User   = require('../models/User');
        const agents = await User.find({
          role:           { $in: ['live_chat_agent', 'admin'] },
          whatsappNumber: { $exists: true, $ne: '' },
          isActive:       true
        });

        if (agents.length > 0) {
          const siteUrl   = process.env.CORS_ORIGIN || 'https://homodenthealth.com';
          const waMessage = `🦷 *HomoDentHealth — New Unassigned Chat*\n\n*Patient:* ${patientName}\n*Message:*\n${content}\n\n_Log in to respond: ${siteUrl}/livechat-admin.html_`;

          for (const agent of agents) {
            await sendWhatsAppMessage(agent.whatsappNumber, waMessage);
          }
        }
      }
    }
  } catch (waErr) {
    // Never let WhatsApp errors block the patient's chat experience
    console.error('[WhatsApp] Notification failed (non-fatal):', waErr.message);
  }

  res.status(201).json({ success: true, message });
}));

router.get('/conversations/:conversationId/messages', optional, asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;

  const conversation = await ChatConversation.findById(req.params.conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }
  if (!canAccess(conversation, req)) {
    throw new AppError('Unauthorized', 403);
  }

  const messages = await ChatMessage.find({ conversationId: req.params.conversationId })
    .populate('sender', 'firstName lastName avatar role')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: 1 });

  res.json({ success: true, messages });
}));

router.patch('/conversations/:conversationId/close', optional, asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const conversation = await ChatConversation.findById(req.params.conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError('Unauthorized', 403);
  }

  conversation.status = 'closed';
  conversation.closedAt = new Date();
  conversation.resolution = { resolved: true, resolvedAt: new Date(), notes };
  await conversation.save();

  res.json({ success: true, conversation });
}));

module.exports = router;
