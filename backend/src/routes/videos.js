const express = require('express');
const Video = require('../models/Video');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// uploads directory (served from backend/uploads, NOT inside the frontend folder)
const UPLOAD_DIR = path.join(__dirname, '../..', 'uploads', 'videos');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) { cb(null, uuidv4() + path.extname(file.originalname)); }
});

// NOTE: most PaaS hosts (Render/Railway/Heroku free & standard tiers) wipe local
// disk on every restart/redeploy. For real production use, point sourceType="url"
// at a video already hosted on YouTube/Vimeo/Cloudinary/S3 instead of uploading
// raw files here. Local upload is kept for convenience on a VPS or local testing.
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Admin only: upload a video file or register a hosted video URL
router.post('/', protect, authorize('admin'), upload.single('file'), asyncHandler(async (req, res) => {
  const { title, description, category, sourceType, url, provider, embedUrl, thumb } = req.body;
  const record = { title, description, category, sourceType: sourceType || (req.file ? 'upload' : 'url'), provider, embedUrl, thumb, createdBy: req.user._id };
  if (req.file) {
    record.filename = req.file.filename;
    record.url = `/uploads/videos/${req.file.filename}`;
  } else if (url) {
    record.url = url;
  }
  const video = new Video(record);
  await video.save();
  res.status(201).json({ success: true, video });
}));

// Public: list videos (for the blog/education section)
router.get('/', asyncHandler(async (req, res) => {
  const videos = await Video.find().sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, videos });
}));

module.exports = router;

