import type { Request, Response } from 'express';
import Category from './category.model';
import { getPagination } from '../../common/utils/pagination.util';
import { validateBase64Image } from '../../common/utils/image-validation.util';
import { removeImage, storeImage } from '../../common/utils/image-storage.util';
import type { ImageTransform } from '../../common/utils/image-storage.util';

/** Category artwork is square and webp, as it was when it was written to disk. */
const CATEGORY_IMAGE: ImageTransform = { width: 800, height: 800, format: 'webp', quality: 90 };


// Fetch-based category listing
const apiCategories = async (req: Request, res: Response) => {
  try {
    const searchQuery = String(req.query.q || '');
    const statusFilter = String(req.query.status || 'all');
    const page = parseInt(String(req.query.page)) || 1;
    const limit = 10;

    const query: Record<string, any> = {
      name: { $regex: searchQuery, $options: 'i' },
      isDeleted: false
    };

    if (statusFilter === 'active') {
      query.isActive = true;
    } else if (statusFilter === 'inactive') {
      query.isActive = false;
    }

    const totalRecords = await Category.countDocuments(query);

    const { data: categories, totalPages } = await getPagination(
      Category.find(query).sort({ createdAt: -1 }),
      Category,
      query,
      page,
      limit
    );

    res.json({ 
      categories,
      currentPage: page,
      totalPages,
      totalRecords
    });
  } catch (err: any) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get single category
const apiGetCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category || category.isDeleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, category });
  } catch (err: any) {
    console.error('Error fetching category:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}; 

// Add category via fetch with image upload
const apiCreateCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, categoryOffer, base64Image } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      isDeleted: false
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    // Process image if provided
    let imageUrl = '';
    if (base64Image) {
      // Validate image
      const validation = validateBase64Image(base64Image);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      // Save and process image
      const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
      const stored = await storeImage(buffer, 'categories', CATEGORY_IMAGE, 'category');
      imageUrl = stored.url;
    }

    await Category.create({
      name: trimmedName,
      description: description || '',
      categoryOffer: Math.max(0, Math.min(100, parseFloat(categoryOffer) || 0)),
      image: imageUrl
    });

    res.json({ success: true, message: 'Category created successfully' });
  } catch (err: any) {
    console.error('Create Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
};

// Update category via fetch with image upload
const apiUpdateCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, categoryOffer, base64Image } = req.body;
    const categoryId = req.params.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      isDeleted: false,
      _id: { $ne: categoryId }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    const category = await Category.findById(categoryId);
    if (!category || category.isDeleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Process new image if provided
    let imageUrl = category.image || '';
    if (base64Image) {
      // Validate image
      const validation = validateBase64Image(base64Image);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      // The image being replaced, wherever it was stored
      if (category.image) {
        await removeImage(category.image);
      }

      // Save new image
      const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
      const stored = await storeImage(buffer, 'categories', CATEGORY_IMAGE, 'category');
      imageUrl = stored.url;
    }

    await Category.findByIdAndUpdate(categoryId, {
      name: trimmedName,
      description: description || '',
      categoryOffer: Math.max(0, Math.min(100, parseFloat(categoryOffer) || 0)),
      image: imageUrl
    });

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (err: any) {
    console.error('Update Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
};

// Toggle category status
const apiToggleStatus = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category || category.isDeleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: category.isActive
    });
  } catch (err: any) {
    console.error('Toggle Status Error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
};

// Soft delete via fetch
const apiSoftDeleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category || category.isDeleted) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await Category.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err: any) {
    console.error('Delete Error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
};

export {
  apiCategories,
  apiGetCategory,
  apiCreateCategory,
  apiUpdateCategory,
  apiToggleStatus,
  apiSoftDeleteCategory
};
