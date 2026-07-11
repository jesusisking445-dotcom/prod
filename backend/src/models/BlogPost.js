const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  excerpt: {
    type: String,
    maxlength: 500
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['dental-health', 'oral-hygiene', 'treatment-guide', 'lifestyle', 'emergency', 'kids-dental'],
    required: true,
    index: true
  },
  tags: [String],
  featuredImage: {
    url: String,
    publicId: String,
    altText: String
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  publishedAt: Date,
  readingTime: Number,
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    approved: { type: Boolean, default: false },
    createdAt: Date,
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: Date
    }]
  }],
  relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost' }],
  seo: {
    metaDescription: String,
    keywords: [String],
    ogImage: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ category: 1, status: 1 });
blogPostSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);
