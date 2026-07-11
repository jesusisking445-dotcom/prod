const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  guestName: String,
  guestEmail: String,
  channel: {
    type: String,
    enum: ['website', 'whatsapp'],
    default: 'website'
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'closed', 'waiting'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['appointment', 'billing', 'general', 'emergency', 'feedback'],
    default: 'general'
  },
  subject: String,
  messageCount: {
    type: Number,
    default: 0
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: Date
  },
  tags: [String],
  resolution: {
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    notes: String,
    resolution_time: Number
  },
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  activeSession: {
    isActive: Boolean,
    startedAt: Date,
    endedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: Date
}, { timestamps: true });

chatConversationSchema.index({ user: 1, createdAt: -1 });
chatConversationSchema.index({ status: 1, createdAt: -1 });
chatConversationSchema.index({ assignedAgent: 1, status: 1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
