import type { Request, Response } from 'express';
import Brand from './brand.model';
import { getPagination } from '../../common/utils/pagination.util';
import { validateBase64Image } from '../../common/utils/image-validation.util';
import { removeImage, storeImage } from '../../common/utils/image-storage.util';
import type { ImageTransform } from '../../common/utils/image-storage.util';

/** Brand artwork is square and webp, as it was when it was written to disk. */
const BRAND_IMAGE: ImageTransform = { width: 800, height: 800, format: 'webp', quality: 90 };


// Fetch-based brand listing
const apiBrands = async (req: Request, res: Response) => {
  try {
    const searchQuery = String(req.query.q || '');
    const statusFilter = String(req.query.status || 'all');
    const page = parseInt(String(req.query.page)) || 1;
    const limit = 10;

    // Build filter query
    const query: Record<string, any> = {
      name: { $regex: searchQuery, $options: 'i' },
      isDeleted: false
    };

    // Apply status filter
    if (statusFilter === 'active') {
      query.isActive = true;
    } else if (statusFilter === 'inactive') {
      query.isActive = false;
    }

    const totalRecords = await Brand.countDocuments(query);

    const { data: brands, totalPages } = await getPagination(
      Brand.find(query).sort({ createdAt: -1 }),
      Brand,
      query,
      page,
      limit
    );

    res.json({
      brands,
      currentPage: page,
      totalPages,
      totalRecords
    });
  } catch (err: any) {
    console.error('Error fetching brands:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get single brand
const apiGetBrand = async (req: Request, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand || brand.isDeleted) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }
    res.json({ success: true, brand });
  } catch (err: any) {
    console.error('Error fetching brand:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// Add brand via fetch with image upload
const apiCreateBrand = async (req: Request, res: Response) => {
  try {
    const { name, description, brandOffer, base64Image } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Brand name cannot be empty' });
    }

    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      isDeleted: false
    });

    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: 'A brand with this name already exists'
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
      const stored = await storeImage(buffer, 'brands', BRAND_IMAGE, 'brand');
      imageUrl = stored.url;
    }

    await Brand.create({
      name: trimmedName,
      description: description || '',
      brandOffer: Math.max(0, Math.min(100, parseFloat(brandOffer) || 0)),
      image: imageUrl
    });

    res.json({ success: true, message: 'Brand created successfully' });
  } catch (err: any) {
    console.error('Create Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A brand with this name already exists'
      });
    }

    res.status(500).json({ success: false, message: 'Failed to create brand' });
  }
};

// Update brand via fetch with image upload
const apiUpdateBrand = async (req: Request, res: Response) => {
  try {
    const { name, description, brandOffer, base64Image } = req.body;
    const brandId = req.params.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Brand name cannot be empty' });
    }

    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      isDeleted: false,
      _id: { $ne: brandId }
    });

    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: 'A brand with this name already exists'
      });
    }

    const brand = await Brand.findById(brandId);
    if (!brand || brand.isDeleted) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    // Process new image if provided
    let imageUrl = brand.image || '';
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
      if (brand.image) {
        await removeImage(brand.image);
      }

      // Save new image
      const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
      const stored = await storeImage(buffer, 'brands', BRAND_IMAGE, 'brand');
      imageUrl = stored.url;
    }

    await Brand.findByIdAndUpdate(brandId, {
      name: trimmedName,
      description: description || '',
      brandOffer: Math.max(0, Math.min(100, parseFloat(brandOffer) || 0)),
      image: imageUrl
    });

    res.json({ success: true, message: 'Brand updated successfully' });
  } catch (err: any) {
    console.error('Update Error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A brand with this name already exists'
      });
    }

    res.status(500).json({ success: false, message: 'Failed to update brand' });
  }
};

// Toggle brand status
const apiToggleStatus = async (req: Request, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand || brand.isDeleted) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    brand.isActive = !brand.isActive;
    await brand.save();

    res.json({
      success: true,
      message: `Brand ${brand.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: brand.isActive
    });
  } catch (err: any) {
    console.error('Toggle Status Error:', err);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
};

// Soft delete via fetch
const apiSoftDeleteBrand = async (req: Request, res: Response) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand || brand.isDeleted) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    await Brand.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (err: any) {
    console.error('Delete Error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete brand' });
  }
};

export {
  apiBrands,
  apiGetBrand,
  apiCreateBrand,
  apiUpdateBrand,
  apiToggleStatus,
  apiSoftDeleteBrand
};
