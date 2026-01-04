const Gallery = require('../models/Gallery');
const { getFileUrl } = require('../middleware/upload');

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
exports.getGalleryImages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const images = await Gallery.find({ isActive: true })
      .populate('uploadedBy', 'name')
      .sort({ order: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Gallery.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: images,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalImages: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single gallery image
// @route   GET /api/gallery/:id
// @access  Public
exports.getGalleryImage = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id)
      .populate('uploadedBy', 'name');

    if (!image || !image.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Upload gallery image
// @route   POST /api/gallery
// @access  Private/Admin
exports.uploadGalleryImage = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Title and image are required'
      });
    }

    const imageUrl = await getFileUrl(req, req.file);
    const imagePublicId = req.file.filename || req.file.key;

    const galleryImage = new Gallery({
      title: title.trim(),
      imageUrl,
      imagePublicId,
      uploadedBy: req.user.id,
    });

    await galleryImage.save();
    await galleryImage.populate('uploadedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Gallery image uploaded successfully',
      data: galleryImage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload gallery image',
      error: error.message
    });
  }
};

// @desc    Delete gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGalleryImage = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Soft delete by setting isActive to false
    image.isActive = false;
    await image.save();

    res.json({
      success: true,
      message: 'Gallery image deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle gallery image status
// @route   PATCH /api/gallery/:id/toggle
// @access  Private/Admin
exports.toggleGalleryImageStatus = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    image.isActive = !image.isActive;
    await image.save();

    res.json({
      success: true,
      message: `Image ${image.isActive ? 'activated' : 'deactivated'} successfully`,
      data: image
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

