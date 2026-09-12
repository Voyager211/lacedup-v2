import type { Request, Response } from 'express';
import Product from './product.model';
import Category from './category.model';
import Brand from './brand.model';
import { processImages } from '../../common/utils/image-processor.util';
import { getPagination } from '../../common/utils/pagination.util';
import { validateBase64Image, validateMultipleImageFiles } from '../../common/utils/image-validation.util';
import { getImagesToDelete } from '../../common/utils/file-cleanup.util';
import { removeImages, storeImage } from '../../common/utils/image-storage.util';
import type { ImageTransform } from '../../common/utils/image-storage.util';
import { wantsJson } from '../../common/utils/wants-json.util';
import mongoose from 'mongoose';

/** Product photography is square and webp, both on disk and in Cloudinary. */
const PRODUCT_IMAGE: ImageTransform = { width: 800, height: 800, format: 'webp' };


// Render product detail page
const renderDetailPage = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category')
      .populate('brand');
    
    if (!product || product.isDeleted) {
      if (wantsJson(req)) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      // `views/error.ejs` does not exist, so this render throws inside the
      // catch below. Documented in docs/defects.md; the JSON branch above is
      // the path the React admin takes.
      return res.status(404).render('error', {
        message: 'Product not found',
        title: 'Error'
      });
    }

    // ============================================
    // ✅ CALCULATE FINAL PRICES WITH ALL OFFERS
    // ============================================
    
    // Helper function to calculate variant final price
    const calculateVariantFinalPrice = (variant: any, product: any) => {
      const basePrice = variant.basePrice || 0;
      
      // Get all applicable offers
      const productOffer = product.productOffer || 0;
      const brandOffer = (product.brand as any)?.brandOffer || 0;
      const categoryOffer = (product.category as any)?.categoryOffer || 0;
      const variantOffer = variant.variantSpecificOffer || 0;
      
      // Find the maximum offer
      const maxOffer = Math.max(productOffer, brandOffer, categoryOffer, variantOffer);
      
      // Calculate final price
      const finalPrice = basePrice * (1 - maxOffer / 100);
      
      return {
        finalPrice: finalPrice,
        appliedOffer: maxOffer,
        offerSource: maxOffer === brandOffer ? 'Brand' 
                   : maxOffer === categoryOffer ? 'Category' 
                   : maxOffer === variantOffer ? 'Variant' 
                   : maxOffer === productOffer ? 'Product' 
                   : 'None'
      };
    };

    // Calculate final prices for all variants
    const variantsWithCalculatedPrices = product.variants.map(variant => {
      const priceInfo = calculateVariantFinalPrice(variant, product);
      return {
        ...variant.toObject(),
        calculatedFinalPrice: priceInfo.finalPrice,
        appliedOffer: priceInfo.appliedOffer,
        offerSource: priceInfo.offerSource
      };
    });

    // ============================================
    // ✅ COLLECT ACTIVE OFFERS FOR DISPLAY
    // ============================================
    const activeOffers: any[] = [];
    
    if ((product.brand as any)?.brandOffer && (product.brand as any).brandOffer > 0) {
      activeOffers.push({
        type: 'Brand',
        name: (product.brand as any).name,
        value: (product.brand as any).brandOffer,
        label: `${(product.brand as any).brandOffer}% off on all ${(product.brand as any).name} products`
      });
    }
    
    if ((product.category as any)?.categoryOffer && (product.category as any).categoryOffer > 0) {
      activeOffers.push({
        type: 'Category',
        name: (product.category as any).name,
        value: (product.category as any).categoryOffer,
        label: `${(product.category as any).categoryOffer}% off on all ${(product.category as any).name}`
      });
    }
    
    if (product.productOffer && product.productOffer > 0) {
      activeOffers.push({
        type: 'Product',
        name: 'This Product',
        value: product.productOffer,
        label: `${product.productOffer}% off on this product`
      });
    }
    
    // Sort offers by value (highest first)
    activeOffers.sort((a, b) => b.value - a.value);

    // Combine all images for carousel
    const allImages = [product.mainImage, ...product.subImages];

    const payload = {
      product: {
        ...product.toObject(),
        variants: variantsWithCalculatedPrices
      },
      allImages,
      activeOffers
    };

    res.json({ success: true, ...payload });

  } catch (err: any) {
    console.error('Render Detail Error:', err);
    res.status(500).send("Error rendering product detail page");
  }
};





// API: Create new product via base64 images (fetch-based)
const apiSubmitNewProduct = async (req: Request, res: Response) => {
  try {
    let base64Images = req.body.base64Images || [];
    if (!Array.isArray(base64Images)) base64Images = [base64Images];

    if (base64Images.length < 3) {
      return res.status(400).json({ success: false, message: 'Minimum 3 images required.' });
    }

    // Validate each base64 image
    for (let i = 0; i < base64Images.length; i++) {
      const validation = validateBase64Image(base64Images[i]);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `Image ${i + 1}: ${validation.message}`
        });
      }
    }

    // Parse and validate variants
    let variants: any[] = [];
    try {
      variants = JSON.parse(req.body.variants || '[]');
    } catch (parseError: any) {
      return res.status(400).json({ success: false, message: 'Invalid variants data format.' });
    }

    // Validate that at least one variant exists
    if (!variants || variants.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product variant is required.' });
    }

    // Validate regular price first
    const regularPrice = parseFloat(req.body.regularPrice);
    if (isNaN(regularPrice) || regularPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Regular price must be a valid positive number.' });
    }

    // Validate and calculate finalPrice for each variant
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!variant.size || typeof variant.size !== 'string') {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Size is required and must be a string.` });
      }
      if (typeof variant.stock !== 'number' || variant.stock < 0) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Stock must be a non-negative number.` });
      }
      // Validate basePrice (required for new pricing structure)
      if (typeof variant.basePrice !== 'number' || variant.basePrice <= 0) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Base price is required and must be a positive number.` });
      }
      // Validate that base price is less than regular price
      if (variant.basePrice >= regularPrice) {
        return res.status(400).json({
          success: false,
          message: `Variant ${i + 1} (${variant.size}): Base price (₹${Math.round(variant.basePrice)}) must be less than regular price (₹${Math.round(regularPrice)})`
        });
      }
      // Validate variantSpecificOffer (optional, defaults to 0)
      if (variant.variantSpecificOffer !== undefined && (typeof variant.variantSpecificOffer !== 'number' || variant.variantSpecificOffer < 0 || variant.variantSpecificOffer > 100)) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Variant specific offer must be a number between 0 and 100.` });
      }
      // Keep productOffer validation for backward compatibility
      if (variant.productOffer !== undefined && (typeof variant.productOffer !== 'number' || variant.productOffer < 0 || variant.productOffer > 100)) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Product offer must be a number between 0 and 100.` });
      }

      // Calculate and set finalPrice
      const offer = variant.variantSpecificOffer || 0;
      variant.finalPrice = variant.basePrice * (1 - offer / 100);
    }

    const mainImageIndex = parseInt(req.body.mainImageIndex || '0', 10);

    const saveBase64Image = async (base64: any, index: number) => {
      const buffer = Buffer.from(base64.split(',')[1], 'base64');
      const { url } = await storeImage(buffer, 'products', PRODUCT_IMAGE, String(index));
      return url;
    };

    const savedUrls = await Promise.all(base64Images.map(saveBase64Image));
    const mainImage = savedUrls[mainImageIndex] || savedUrls[0];
    const subImages = savedUrls.filter((_, i) => i !== mainImageIndex);

    await Product.create({
      productName: req.body.productName,
      description: req.body.description,
      brand: req.body.brand,
      category: req.body.category,
      regularPrice: req.body.regularPrice,
      productOffer: req.body.productOffer || 0, // Keep for backward compatibility
      features: req.body.features,
      variants: variants,
      mainImage,
      subImages,
    });

    res.status(200).json({ success: true, message: 'Product added successfully!' });

  } catch (err: any) {
    console.error('❌ API Submit Error:', err);
    res.status(500).json({ success: false, message: 'Server error while adding product.' });
  }
};

// Soft delete a product (form submit)
const softDeleteProduct = async (req: Request, res: Response) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).send("Error deleting Product");
  }
};

// API: List products (fetch)
const apiProducts = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    const page = parseInt(String(req.query.page)) || 1;
    const limit = 10;

    // Build query object with advanced filters
    const query: Record<string, any> = { isDeleted: false };

    // Search filter
    if (q) {
      query.productName = { $regex: q, $options: 'i' };
    }

    // Category filter
    if (req.query.category) {
      try {
        query.category = new mongoose.Types.ObjectId(String(req.query.category));
      } catch (error: any) {
        console.error(`Invalid category ID: ${req.query.category}`);
      }
    }

    // Brand filter
    if (req.query.brand) {
      if (String(req.query.brand).includes(',')) {
        const brandIds = String(req.query.brand).split(',').filter((id: any) => id.trim());
        const objectIds = brandIds.map((id: any) => {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch (error: any) {
            console.error(`Invalid brand ID: ${id}`);
            return null;
          }
        }).filter((id: any) => id !== null);
        
        if (objectIds.length > 0) {
          query.brand = { $in: objectIds };
        }
      } else {
        try {
          query.brand = new mongoose.Types.ObjectId(String(req.query.brand));
        } catch (error: any) {
          console.error(`Invalid brand ID: ${req.query.brand}`);
        }
      }
    }

    // Price range filters
    if (req.query.minPrice || req.query.maxPrice) {
      const priceFilter: Record<string, any> = {};
      if (req.query.minPrice) {
        priceFilter.$gte = parseFloat(String(req.query.minPrice));
      }
      if (req.query.maxPrice) {
        priceFilter.$lte = parseFloat(String(req.query.maxPrice));
      }
      query.regularPrice = priceFilter;
    }

    // Status filter
    if (req.query.status !== undefined && req.query.status !== '') {
      query.isListed = req.query.status === 'true';
    }

    // Stock filter
    if (req.query.stock) {
      switch (req.query.stock) {
        case 'in-stock':
          query.totalStock = { $gt: 0 };
          break;
        case 'low-stock':
          query.totalStock = { $gt: 0, $lt: 10 };
          break;
        case 'out-of-stock':
          query.totalStock = 0;
          break;
      }
    }

    // Build sort object
    let sortQuery: any = { createdAt: -1 }; // default sort
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'name-asc':
          sortQuery = { productName: 1 };
          break;
        case 'name-desc':
          sortQuery = { productName: -1 };
          break;
        case 'price-asc':
          sortQuery = { regularPrice: 1 };
          break;
        case 'price-desc':
          sortQuery = { regularPrice: -1 };
          break;
        case 'date-newest':
          sortQuery = { createdAt: -1 };
          break;
        case 'date-oldest':
          sortQuery = { createdAt: 1 };
          break;
        case 'status':
          sortQuery = { isListed: -1, createdAt: -1 };
          break;
      }
    }

    // Get total count of all non-deleted products
    const totalRecords = await Product.countDocuments({ isDeleted: false });

    const { data: products, totalPages } = await getPagination(
      Product.find(query).populate('category').populate('brand').sort(sortQuery),
      Product,
      query,
      page,
      limit
    );
    
    res.json({  
      products, 
      totalPages, 
      currentPage: page, 
      totalRecords 
    });
  } catch (err: any) {
    console.error('Fetch Products Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

// API: Soft delete (fetch)
const apiSoftDeleteProduct = async (req: Request, res: Response) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Soft Delete Product Error:', err);
    res.status(500).json({ success: false });
  }
};

// API: Toggle product status (fetch)
const apiToggleProductStatus = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      product.isListed = !product.isListed;
      product.status = product.isListed ? 'Available' : 'Not Available';
      await product.save();
      return res.json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
  } catch (err: any) {
    console.error('Toggle Product Status Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// API: Update product
const apiUpdateProduct = async (req: Request, res: Response) => {
  try {
    const base64Images = req.body.base64Images || [];
    const productId = req.params.id;

    if (!Array.isArray(base64Images) || base64Images.length < 3) {
      return res.status(400).json({ success: false, message: 'Minimum 3 images required.' });
    }

    if (base64Images.length > 6) {
      return res.status(400).json({ success: false, message: 'Maximum 6 images allowed per product.' });
    }

    // Validate each base64 image
    for (let i = 0; i < base64Images.length; i++) {
      const validation = validateBase64Image(base64Images[i]);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: `Image ${i + 1}: ${validation.message}`
        });
      }
    }

    // Parse and validate variants
    let variants: any[] = [];
    try {
      variants = JSON.parse(req.body.variants || '[]');
    } catch (parseError: any) {
      return res.status(400).json({ success: false, message: 'Invalid variants data format.' });
    }

    // Validate that at least one variant exists
    if (!variants || variants.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product variant is required.' });
    }

    // Validate regular price first
    const regularPrice = parseFloat(req.body.regularPrice);
    if (isNaN(regularPrice) || regularPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Regular price must be a valid positive number.' });
    }

    // Validate and calculate finalPrice for each variant
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (!variant.size || typeof variant.size !== 'string') {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Size is required and must be a string.` });
      }
      if (typeof variant.stock !== 'number' || variant.stock < 0) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Stock must be a non-negative number.` });
      }
      // Validate basePrice (required for new pricing structure)
      if (typeof variant.basePrice !== 'number' || variant.basePrice <= 0) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Base price is required and must be a positive number.` });
      }
      // Validate that base price is less than regular price
      if (variant.basePrice >= regularPrice) {
        return res.status(400).json({
          success: false,
          message: `Variant ${i + 1} (${variant.size}): Base price (₹${Math.round(variant.basePrice)}) must be less than regular price (₹${Math.round(regularPrice)})`
        });
      }
      // Validate variantSpecificOffer (optional, defaults to 0)
      if (variant.variantSpecificOffer !== undefined && (typeof variant.variantSpecificOffer !== 'number' || variant.variantSpecificOffer < 0 || variant.variantSpecificOffer > 100)) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Variant specific offer must be a number between 0 and 100.` });
      }
      // Keep productOffer validation for backward compatibility
      if (variant.productOffer !== undefined && (typeof variant.productOffer !== 'number' || variant.productOffer < 0 || variant.productOffer > 100)) {
        return res.status(400).json({ success: false, message: `Variant ${i + 1}: Product offer must be a number between 0 and 100.` });
      }

      // Calculate and set finalPrice
      const offer = variant.variantSpecificOffer || 0;
      variant.finalPrice = variant.basePrice * (1 - offer / 100);
    }

    const mainImageIndex = parseInt(req.body.mainImageIndex || '0', 10);

    const saveBase64Image = async (base64: any, index: number) => {
      const buffer = Buffer.from(base64.split(',')[1], 'base64');
      const { url } = await storeImage(buffer, 'products', PRODUCT_IMAGE, String(index));
      return url;
    };

    const savedUrls = await Promise.all(base64Images.map(saveBase64Image));
    const mainImage = savedUrls[mainImageIndex] || savedUrls[0];
    const subImages = savedUrls.filter((_, i) => i !== mainImageIndex);

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Get old images for cleanup
    const oldImages = [product.mainImage, ...product.subImages];

    // Update product fields
    product.productName = req.body.productName;
    product.description = req.body.description;
    product.brand = req.body.brand;
    product.category = req.body.category;
    product.regularPrice = req.body.regularPrice;
    product.productOffer = req.body.productOffer || 0; // Keep for backward compatibility
    product.features = req.body.features;
    
    // IMPORTANT: Preserve existing variant IDs to avoid breaking cart references
    // Instead of replacing the entire variants array, update existing variants and add new ones
    const updatedVariants: any[] = [];
    
    for (const newVariant of variants) {
      // Try to find existing variant by size (since size should be unique per product)
      const existingVariant = product.variants.find(v => v.size === newVariant.size);
      
      if (existingVariant) {
        // Update existing variant while preserving its _id
        existingVariant.stock = newVariant.stock;
        existingVariant.basePrice = newVariant.basePrice;
        existingVariant.variantSpecificOffer = newVariant.variantSpecificOffer || 0;
        // Keep existing SKU and _id
        updatedVariants.push(existingVariant);
      } else {
        // Add new variant (will get new _id)
        updatedVariants.push(newVariant);
      }
    }
    
    // Remove variants that are no longer in the update (sizes that were removed)
    product.variants = updatedVariants as any;
    
    product.mainImage = mainImage;
    product.subImages = subImages;

    // Save to trigger pre-save hook for totalStock calculation
    await product.save();

    // Clean up orphaned image files
    const newImages = [mainImage, ...subImages];
    const imagesToDelete = getImagesToDelete(oldImages, newImages);

    if (imagesToDelete.length > 0) {
      await removeImages(imagesToDelete);
    }

    res.status(200).json({ success: true, message: 'Product Edited Successfully!' });

  } catch (err: any) {
    console.error(' API Edit Error:', err);
    res.status(500).json({ success: false, message: 'Server error while editing product.' });
  }
};


export {
  renderDetailPage,
  apiSubmitNewProduct,
  softDeleteProduct,
  apiProducts,
  apiSoftDeleteProduct,
  apiToggleProductStatus,
  apiUpdateProduct
};