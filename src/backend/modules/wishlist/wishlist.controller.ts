import type { Request, Response } from 'express';
import Wishlist from './wishlist.model';
import Product from '../catalog/product.model';
import Category from '../catalog/category.model';
import Brand from '../catalog/brand.model';
import Cart from '../cart/cart.model';
import { wantsJson } from '../../common/utils/wants-json.util';

// Get wishlist page
const getWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const search = String(req.query.q || '');

    // Find user's wishlist and populate products with all necessary data
    let wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.productId',
        populate: [
          { path: 'category', select: 'name categoryOffer' },
          { path: 'brand', select: 'name brandOffer' }
        ]
      });

    let products: any[] = [];
    
    if (wishlist && wishlist.products.length > 0) {
      // Filter out any null products (in case product was deleted)
      products = wishlist.products
        .filter(item => item.productId)
        .map(item => {
          const product: any = item.productId; // populated document
          
          // Calculate average final price for variants
          if (product.variants && product.variants.length > 0) {
            const finalPrices = product.variants.map((variant: any) => {
              const basePrice = variant.basePrice || product.regularPrice;
              const categoryOffer = (product.category && product.category.categoryOffer) || 0;
              const brandOffer = (product.brand && product.brand.brandOffer) || 0;
              const productOffer = product.productOffer || 0;
              const variantOffer = variant.variantSpecificOffer || 0;
              const maxOffer = Math.max(categoryOffer, brandOffer, productOffer, variantOffer);
              return basePrice * (1 - maxOffer / 100);
            });
            product.averageFinalPrice = finalPrices.reduce((sum: number, price: number) => sum + price, 0) / finalPrices.length;
          }

          // Calculate total stock
          product.totalStock = product.variants ? 
            product.variants.reduce((total: number, variant: any) => total + variant.stock, 0) : 0;

          return product;
        });

      // Apply search filter if provided
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        products = products.filter(product => 
          searchRegex.test(product.productName) ||
          searchRegex.test(product.brand?.name || '') ||
          searchRegex.test(product.category?.name || '')
        );
      }
    }

    // Get wishlist product IDs for the template
    const userWishlistProductIds = products.map(p => p._id.toString());

    // The SPA asks for the same data as JSON. `GET /wishlist` and
    // `GET /api/wishlist` are the same route - this router is dual-mounted -
    // so the response is chosen by what the caller asked for rather than by
    // adding a second endpoint that would duplicate all of the above.
    res.json({ success: true, products, search, userWishlistProductIds });


  } catch (error: any) {
    console.error('Error fetching wishlist:', error);

    res.status(500).json({ success: false, message: 'Unable to load wishlist' });
  }
};

// Add product to wishlist
const addToWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { productId } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is already in cart
    const cart = await Cart.findOne({ userId });
    if (cart && cart.items.some(item => item.productId.toString() === productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in your cart'
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    // Check if product already in wishlist
    const existingProduct = wishlist.products.find(
      item => item.productId.toString() === productId
    );

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    // Add product to wishlist
    wishlist.products.push({ productId, addedAt: new Date() });
    await wishlist.save();

    res.json({
      success: true,
      message: 'Product added to wishlist',
      wishlistCount: wishlist.products.length
    });

  } catch (error: any) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to add product to wishlist'
    });
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Remove product from wishlist
    wishlist.products = wishlist.products.filter(
      item => item.productId.toString() !== productId
    );

    await wishlist.save();

    res.json({
      success: true,
      message: 'Product removed from wishlist',
      wishlistCount: wishlist.products.length
    });

  } catch (error: any) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to remove product from wishlist'
    });
  }
};

// Search wishlist products (AJAX endpoint)
const searchWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const search = String(req.query.q || '');

    // Find user's wishlist and populate products
    let wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.productId',
        populate: [
          { path: 'category', select: 'name categoryOffer' },
          { path: 'brand', select: 'name brandOffer' }
        ]
      });

    let products: any[] = [];
    
    if (wishlist && wishlist.products.length > 0) {
      products = wishlist.products
        .filter(item => item.productId)
        .map(item => {
          const product: any = item.productId; // populated document
          
          // Calculate average final price for variants
          if (product.variants && product.variants.length > 0) {
            const finalPrices = product.variants.map((variant: any) => {
              const basePrice = variant.basePrice || product.regularPrice;
              const categoryOffer = (product.category && product.category.categoryOffer) || 0;
              const brandOffer = (product.brand && product.brand.brandOffer) || 0;
              const productOffer = product.productOffer || 0;
              const variantOffer = variant.variantSpecificOffer || 0;
              const maxOffer = Math.max(categoryOffer, brandOffer, productOffer, variantOffer);
              return basePrice * (1 - maxOffer / 100);
            });
            product.averageFinalPrice = finalPrices.reduce((sum: number, price: number) => sum + price, 0) / finalPrices.length;
          }

          // Calculate total stock
          product.totalStock = product.variants ? 
            product.variants.reduce((total: number, variant: any) => total + variant.stock, 0) : 0;

          return product;
        });

      // Apply search filter
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        products = products.filter(product => 
          searchRegex.test(product.productName) ||
          searchRegex.test(product.brand?.name || '') ||
          searchRegex.test(product.category?.name || '')
        );
      }
    }

    res.json({
      success: true,
      products,
      totalCount: products.length
    });

  } catch (error: any) {
    console.error('Error searching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to search wishlist'
    });
  }
};

export {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  searchWishlist
};