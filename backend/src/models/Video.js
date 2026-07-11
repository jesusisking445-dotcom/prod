const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  sourceType: { type: String, enum: ['upload', 'url'], default: 'upload' },
  provider: { type: String },
  embedUrl: { type: String },
  thumb: { type: String },
  filename: { type: String },
  url: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Video', VideoSchema);
