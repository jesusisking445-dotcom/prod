/**
 * WhatsApp Webhook Route
 *
 * GET  /api/webhooks/whatsapp  — Meta verification handshake (called once at setup)
 * POST /api/webhooks/whatsapp  — Receives agent WhatsApp replies and saves them to DB
 */
const express          = require('express');
const ChatMessage      = require('../models/ChatMessage');
const ChatConversation = require('../models/ChatConversation');
const User             = require('../models/User');
const router           = express.Router();

// ── GET: Meta webhook verification ────────────────────────────────────────
// Meta calls this once when you set up the webhook in the developer dashboard.
// It sends hub.verify_token — we check it matches our env var and echo the challenge.
router.get('/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp] Webhook verification failed — token mismatch');
  return res.status(403).send('Forbidden');
});

// ── POST: Receive incoming WhatsApp messages from agents ───────────────────
// This fires whenever a live chat agent replies to a patient message
// on their personal WhatsApp number.
router.post('/whatsapp', async (req, res) => {
  // Always respond 200 immediately — Meta will retry repeatedly if you don't
  res.sendStatus(200);

  try {
    const body = req.body;

    // Ignore anything that isn't a WhatsApp Business Account event
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value    = change.value || {};
        const messages = value.messages || [];

        for (const msg of messages) {
          // Only handle text message replies (not status updates, images, etc.)
          if (msg.type !== 'text') continue;

          const agentWhatsappNumber = msg.from; // number that replied
          const replyText           = msg.text?.body;

          if (!replyText) continue;

          // Find the agent in our DB by their registered WhatsApp number
          const agent = await User.findOne({
            whatsappNumber: agentWhatsappNumber,
            role:           { $in: ['admin', 'live_chat_agent'] }
          });

          if (!agent) {
            console.warn(`[WhatsApp] No agent found with number ${agentWhatsappNumber}`);
            continue;
          }

          // Find the conversation this reply belongs to
          let conversation = null;

          // First try: match via the WhatsApp message ID the agent replied to
          if (msg.context?.id) {
            conversation = await ChatConversation.findOne({
              lastWhatsappMsgId: msg.context.id
            });
          }

          // Second try: most recent open conversation assigned to this agent
          if (!conversation) {
            conversation = await ChatConversation.findOne({
              assignedAgent: agent._id,
              status:        { $in: ['open', 'waiting', 'assigned'] }
            }).sort({ updatedAt: -1 });
          }

          if (!conversation) {
            console.warn(`[WhatsApp] No open conversation found for agent ${agent.email}`);
            continue;
          }

          // Save the agent's WhatsApp reply as a message in the database
          await ChatMessage.create({
            conversationId: conversation._id,
            sender:         agent._id,
            senderName:     `${agent.firstName} ${agent.lastName}`,
            senderRole:     'admin',
            content:        replyText,
            messageType:    'text'
          });

          // Update conversation last message preview
          await ChatConversation.findByIdAndUpdate(conversation._id, {
            lastMessage: {
              content:   replyText,
              timestamp: new Date(),
              sender:    'admin'
            },
            status: 'open'
          });

          console.log(`[WhatsApp] Saved agent reply from ${agent.email} → conversation ${conversation._id}`);
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Webhook processing error:', err.message);
  }
});

module.exports = router;
