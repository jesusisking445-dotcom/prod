const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const frontendRoot = path.join(__dirname, '..', '..', '..', 'frontend');

const htmlPage = (page) => path.join(frontendRoot, `${page}.html`);

const safeSendPage = (res, page) => {
  // Prevent path traversal (e.g. "../backend/.env") — only allow plain page names.
  if (!/^[a-zA-Z0-9-]+$/.test(page)) {
    return res.status(404).json({ success: false, error: 'Page not found' });
  }
  const filePath = htmlPage(page);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  return res.sendFile(htmlPage('index'));
};

router.get('/', (req, res) => safeSendPage(res, 'index'));
router.get('/about', (req, res) => safeSendPage(res, 'about'));
router.get('/services', (req, res) => safeSendPage(res, 'services'));
router.get('/clinics', (req, res) => safeSendPage(res, 'clinics'));
router.get('/blog', (req, res) => safeSendPage(res, 'blog'));
router.get('/contact', (req, res) => safeSendPage(res, 'contact'));
router.get('/assessment', (req, res) => safeSendPage(res, 'assessment'));
router.get('/results', (req, res) => safeSendPage(res, 'results'));
router.get('/auth', (req, res) => safeSendPage(res, 'auth'));
router.get('/appointment', (req, res) => safeSendPage(res, 'appointment'));
router.get('/dashboard', (req, res) => safeSendPage(res, 'dashboard'));
router.get('/dentist', (req, res) => safeSendPage(res, 'dentist'));
router.get('/clinic-admin', (req, res) => safeSendPage(res, 'clinic-admin'));
router.get('/privacy', (req, res) => safeSendPage(res, 'privacy'));
router.get('/terms', (req, res) => safeSendPage(res, 'terms'));
router.get('/reset-password', (req, res) => safeSendPage(res, 'reset-password'));
router.get('/videos', (req, res) => safeSendPage(res, 'videos'));
router.get('/admin', (req, res) => safeSendPage(res, 'admin'));
router.get('/content-admin', (req, res) => safeSendPage(res, 'content-admin'));
router.get('/livechat-admin', (req, res) => safeSendPage(res, 'livechat-admin'));

router.get('/:page', (req, res) => safeSendPage(res, req.params.page));

module.exports = router;
