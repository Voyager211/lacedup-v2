import type { Request, Response } from 'express';
import Review from './review.model';
import Product from '../catalog/product.model';
import multer from 'multer';
import { storeImages } from '../../common/utils/image-storage.util';
import type { ImageTransform } from '../../common/utils/image-storage.util';
import { isAuthenticated } from '../../common/middlewares/auth.middleware';

/**
 * Customer review photos.
 *
 * Fitted inside the box rather than cropped to it: these are snapshots of a
 * shoe as it arrived, and cropping one to a square is as likely to cut off the
 * thing being reviewed as to frame it.
 */
const REVIEW_IMAGE: ImageTransform = {
  width: 800,
  height: 600,
  fit: 'inside',
  withoutEnlargement: true,
  format: 'webp',
  quality: 85
};

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware for handling multiple image uploads
const uploadReviewImages = upload.array('images', 5);

// Submit a new review
const submitReview = async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to submit a review'
      });
    }

    const { productId, rating, title, content } = req.body;
    const userId = req.user!._id;
    const images: any = req.files || [];

    // Validate required fields
    if (!productId || !rating || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating must be between 1 and 5' 
      });
    }

    // Validate field lengths
    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Review title must be 100 characters or less'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review content must be 1000 characters or less'
      });
    }

    // Validate image count
    if (images.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed per review'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product || product.isDeleted || !product.isListed) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({ 
      user: userId, 
      product: productId 
    });

    if (existingReview) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already reviewed this product' 
      });
    }

    // Stored wherever image-storage is pointed - disk locally, Cloudinary in production
    let imageUrls: any[] = [];
    if (images.length > 0) {
      try {
        const stored = await storeImages(images, 'reviews', REVIEW_IMAGE);
        imageUrls = stored.map((image) => image.url);
      } catch (uploadError: any) {
        console.error('Image processing error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process images. Please try again.'
        });
      }
    }

    // Create new review
    const newReview = new Review({
      user: userId,
      product: productId,
      rating: parseInt(rating),
      title: title.trim(),
      comment: content.trim(),
      images: imageUrls,
      isVerifiedPurchase: false, // TODO: Check if user has purchased this product
      isHidden: false // Reviews are visible by default, can be moderated later
    });

    await newReview.save();

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        id: newReview._id,
        rating: newReview.rating,
        title: newReview.title,
        comment: newReview.comment,
        images: newReview.images,
        createdAt: newReview.createdAt
      }
    });

  } catch (error: any) {
    console.error('Review submission error:', error);
    
    // Handle duplicate review error (in case the unique index catches it)
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already reviewed this product' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit review. Please try again.' 
    });
  }
};

// Get reviews for a product (optional - for AJAX loading)
const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ 
      product: productId, 
      isHidden: false 
    })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalReviews = await Review.countDocuments({ 
      product: productId, 
      isHidden: false 
    });

    const totalPages = Math.ceil(totalReviews / limit);

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalReviews,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error: any) {
    console.error('Get reviews error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load reviews' 
    });
  }
};

export {
  uploadReviewImages,
  submitReview,
  getProductReviews
}