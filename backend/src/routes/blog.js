const express = require('express');
const BlogPost = require('../models/BlogPost');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { category, page = 1, limit = 10, search } = req.query;

  const query = { status: 'published' };
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } }
    ];
  }

  const posts = await BlogPost.find(query)
    .select('title slug excerpt category featuredImage publishedAt author views likes readingTime')
    .populate('author', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ publishedAt: -1 });

  const total = await BlogPost.countDocuments(query);

  res.json({
    success: true,
    posts,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    }
  });
}));

router.get('/:slug', asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
    .populate('author', 'firstName lastName')
    .populate('relatedPosts', 'title slug excerpt');

  if (!post) {
    throw new AppError('Post not found', 404);
  }

  post.views += 1;
  await post.save();

  res.json({
    success: true,
    post
  });
}));

router.post('/:id/comment', protect, asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    throw new AppError('Comment text required', 400);
  }

  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  post.comments.push({
    user: req.user._id,
    text,
    createdAt: new Date(),
    approved: false
  });

  await post.save();

  res.status(201).json({
    success: true,
    message: 'Comment added. Awaiting moderation.'
  });
}));

router.post('/:id/like', protect, asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndUpdate(
    req.params.id,
    { $inc: { likes: 1 } },
    { new: true }
  );

  if (!post) {
    throw new AppError('Post not found', 404);
  }

  res.json({
    success: true,
    likes: post.likes
  });
}));

module.exports = router;
