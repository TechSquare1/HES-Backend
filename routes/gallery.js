const express = require('express');
const router = express.Router();
const {
  getGalleryImages,
  getGalleryImage,
  uploadGalleryImage,
  deleteGalleryImage,
  toggleGalleryImageStatus
} = require('../controllers/galleryController');
const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// Public routes (view gallery)
router.get('/', getGalleryImages);
router.get('/:id', getGalleryImage);

// Admin only routes (manage gallery)
router.post('/', protect, authorize('admin'), uploadImage, uploadGalleryImage);
router.delete('/:id', protect, authorize('admin'), deleteGalleryImage);
router.patch('/:id/toggle', protect, authorize('admin'), toggleGalleryImageStatus);

module.exports = router;

