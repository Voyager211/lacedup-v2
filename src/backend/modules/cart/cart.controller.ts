import type { Request, Response } from 'express';
import Cart from './cart.model';
import Product from '../catalog/product.model';
import User from '../users/user.model';
import Wishlist from '../wishlist/wishlist.model';
import * as walletService from '../wallet/wallet.service';
import { wantsJson } from '../../common/utils/wants-json.util';
import { currentUserId, isSignedIn } from '../../common/utils/current-user.util';

// Helper function to calculate final price with offers
const calculateFinalPrice = async (product: any) => {
  if (!product.brand || !product.category) {
    await product.populate(['brand', 'category']);
  }
  
  if (typeof product.getAverageFinalPrice === 'function') {
    return (product as any).getAverageFinalPrice();
  }
  
  return product.regularPrice || 0;
};

const calculateVariantFinalPrice = (product: any, variant: any) => {
  try {
    if (typeof product.calculateVariantFinalPrice === 'function') {
      return product.calculateVariantFinalPrice(variant);
    }

    return variant.basePrice || product.regularPrice || 0;
  } catch (error: any) {
    console.error('Error calculating variant price:', error);
    return variant.basePrice || product.regularPrice || 0;
  }
};

const calculateItemTotal = (price: number, quantity: number) => {
  return price * quantity;
};

// Add product to cart with comprehensive validation
const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: 'Variant ID is required. Please select a size.'
      });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity! Please select between 1 and 5 items per product.'
      });
    }

    let product;
    try {
      product = await Product.findById(productId).populate(['category', 'brand']);
    } catch (dbError: any) {
      console.error('Database error fetching product:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while fetching product'
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isListed || product.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'This product is no longer available for purchase',
        code: 'PRODUCT_UNAVAILABLE'
      });
    }

    if (product.category && ((product.category as any).isListed === false || (product.category as any).isDeleted === true)) {
      return res.status(403).json({
        success: false,
        message: 'This product category is no longer available',
        code: 'CATEGORY_UNAVAILABLE'
      });
    }

    if (product.brand && ((product.brand as any).isActive === false || (product.brand as any).isDeleted === true)) {
      return res.status(403).json({
        success: false,
        message: 'This product brand is no longer available',
        code: 'BRAND_UNAVAILABLE'
      });
    }

    const variant = product.variants.find(v => v._id!.toString() === variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found'
      });
    }

    if (variant.stock === 0) {
      return res.status(403).json({
        success: false,
        message: `Size ${variant.size} is currently out of stock`,
        code: 'OUT_OF_STOCK'
      });
    }

    if (variant.stock < parsedQuantity) {
      return res.status(403).json({
        success: false,
        message: `Only ${variant.stock} items available in stock for size ${variant.size}`,
        code: 'INSUFFICIENT_STOCK'
      });
    }

    let cart;
    try {
      cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = new Cart({
          userId,
          items: []
        });
      }
    } catch (dbError: any) {
      console.error('Database error with cart:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while accessing cart'
      });
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    const finalPrice = calculateVariantFinalPrice(product, variant);

    if (existingItemIndex > -1) {
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + parsedQuantity;

      if (newQuantity > variant.stock) {
        return res.status(403).json({
          success: false,
          message: `Cannot add more items. Only ${variant.stock} available in stock for size ${variant.size}. You already have ${existingItem.quantity} in your cart.`,
          code: 'CART_STOCK_LIMIT'
        });
      }

      if (newQuantity > 5) {
        return res.status(403).json({
          success: false,
          message: `Maximum limit reached! You can only add up to 5 items per variant. You currently have ${existingItem.quantity} in your cart.`,
          code: 'CART_QUANTITY_LIMIT'
        });
      }
      
      existingItem.quantity = newQuantity;
      existingItem.price = finalPrice;
      existingItem.totalPrice = calculateItemTotal(finalPrice, newQuantity);
    } else {
      cart.items.push({
        productId,
        variantId,
        sku: variant.sku ?? '',
        size: variant.size,
        quantity: parsedQuantity,
        price: finalPrice,
        totalPrice: calculateItemTotal(finalPrice, parsedQuantity)
      });
    }

    try {
      await cart.save();
    } catch (saveError: any) {
      console.error('Error saving cart:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save cart'
      });
    }

    try {
      const wishlist = await Wishlist.findOne({ userId });
      if (wishlist) {
        const originalLength = wishlist.products.length;
        wishlist.products = wishlist.products.filter(item => 
          item.productId.toString() !== productId
        );

        if (wishlist.products.length !== originalLength) {
          await wishlist.save();
        }
      }
    } catch (wishlistError: any) {
      console.error('Error removing from wishlist: ', wishlistError);
    }

    const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.json({
      success: true,
      message: `Product (Size: ${variant.size}) added to cart successfully`,
      cartCount,
      wishlistCount: 0
    });

  } catch (error: any) {
    console.error('Unexpected error in addToCart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to cart'
    });
  }
};

// Get cart count for navbar
const getCartCount = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    if (!userId) {
      return res.json({ count: 0 });
    }

    const cart: any = await Cart.findOne({ userId });
    const count = cart ? cart.items.length : 0;

    res.json({ count });

  } catch (error: any) {
    console.error('Error getting cart count:', error);
    res.json({ count: 0 });
  }
};

// Load cart page
/**
 * The cart, partitioned and re-priced.
 *
 * Extracted from loadCart so the EJS page and the SPA's JSON endpoint compute
 * it once. This is more than a read: it drops items whose product has been
 * deleted, re-prices anything whose offer has moved since it was added, and
 * splits what remains into available / out-of-stock / unavailable. Two copies
 * of that would drift, and the JSON consumer must see the same prices and the
 * same three buckets the page shows.
 *
 * Returns null when the user no longer exists - the callers answer that
 * differently.
 */
const buildCart = async (userId: unknown) => {
  const user: any = await User.findById(userId).select('fullname email profilePhoto');
  if (!user) return null;

  {
    const cart: any = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          {
            path: 'category',
            select: 'name isListed isDeleted categoryOffer'
          },
          {
            path: 'brand',
            select: 'name brandOffer isActive isDeleted'
          }
        ]
      });

    let availableCartItems: any[] = [];
    let outOfStockCartItems: any[] = [];
    let unavailableCartItems: any[] = [];
    let itemsToRemove: any[] = [];
    let priceUpdatesNeeded = false;
    
    if (cart && cart.items) {
      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i];
        
        if (!item.productId) {
          itemsToRemove.push(i);
          continue;
        }

        if (item.variantId) {
          const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
          if (!variant) {
            itemsToRemove.push(i);
            continue;
          }

          const itemObj = (item as any).toObject();
          
          const currentPrice = calculateVariantFinalPrice(item.productId, variant);
          
          if (Math.abs(item.price - currentPrice) > 0.01) {
            priceUpdatesNeeded = true;
            itemObj.price = currentPrice;
            itemObj.totalPrice = currentPrice * item.quantity;
          }
          
          try {
            itemObj.productId.salePrice = typeof (item.productId as any).getAverageFinalPrice === 'function' 
              ? (item.productId as any).getAverageFinalPrice() 
              : (item.productId as any).regularPrice;
          } catch (error: any) {
            itemObj.productId.salePrice = (item.productId as any).regularPrice;
          }

          const isProductUnavailable = !(item.productId as any).isListed || (item.productId as any).isDeleted;
          const isCategoryUnavailable = (item.productId as any).category && 
            (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true);
          const isBrandUnavailable = (item.productId as any).brand && 
            (((item.productId as any).brand).isActive === false || ((item.productId as any).brand).isDeleted === true);

          if (isProductUnavailable || isCategoryUnavailable || isBrandUnavailable) {
            itemObj.isUnavailable = true;
            if (isProductUnavailable) {
              itemObj.unavailableReason = 'Product unavailable';
            } else if (isCategoryUnavailable) {
              itemObj.unavailableReason = 'Category unavailable';
            } else if (isBrandUnavailable) {
              itemObj.unavailableReason = 'Brand unavailable';
            }
            unavailableCartItems.push(itemObj);
          } else if (variant.stock === 0) {
            outOfStockCartItems.push(itemObj);
          } else {
            availableCartItems.push(itemObj);
          }
        } else {
          const itemObj = (item as any).toObject();
          
          try {
            itemObj.productId.salePrice = typeof (item.productId as any).getAverageFinalPrice === 'function' 
              ? (item.productId as any).getAverageFinalPrice() 
              : (item.productId as any).regularPrice;
          } catch (error: any) {
            itemObj.productId.salePrice = (item.productId as any).regularPrice;
          }

          const isProductUnavailable = !(item.productId as any).isListed || (item.productId as any).isDeleted;
          const isCategoryUnavailable = (item.productId as any).category && 
            (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true);

          if (isProductUnavailable || isCategoryUnavailable) {
            itemObj.isUnavailable = true;
            itemObj.unavailableReason = isProductUnavailable ? 'Product unavailable' : 'Category unavailable';
            unavailableCartItems.push(itemObj);
          } else {
            availableCartItems.push(itemObj);
          }
        }
      }

      if (itemsToRemove.length > 0) {
        for (let i = itemsToRemove.length - 1; i >= 0; i--) {
          cart.items.splice(itemsToRemove[i], 1);
        }
        priceUpdatesNeeded = true;
      }

      if (priceUpdatesNeeded) {
        try {
          for (let i = 0; i < cart.items.length; i++) {
            const cartItem = cart.items[i];
            if (cartItem.variantId) {
              const product = await Product.findById(cartItem.productId).populate(['category', 'brand']);
              if (product) {
                const variant = product.variants.find(v => v._id!.toString() === cartItem.variantId.toString());
                if (variant) {
                  const currentPrice = calculateVariantFinalPrice(product, variant);
                  cartItem.price = currentPrice;
                  cartItem.totalPrice = currentPrice * cartItem.quantity;
                }
              }
            }
          }
          await cart.save();
        } catch (updateError: any) {
          console.error('Error updating cart prices:', updateError);
        }
      }
    }

    availableCartItems.forEach(item => {
      item.isUnavailable = false;
      item.isOutOfStock = false;
    });

    outOfStockCartItems.forEach(item => {
      item.isUnavailable = false;
      item.isOutOfStock = true;
    });

    unavailableCartItems.forEach(item => {
      item.isUnavailable = true;
      item.isOutOfStock = false;
    });

    const allCartItems = [...availableCartItems, ...outOfStockCartItems, ...unavailableCartItems];

    return {
      user,
      cartItems: allCartItems,
      availableCartItems,
      outOfStockCartItems,
      unavailableCartItems
    };
  }
};

/**
 * The cart page, and the same cart as JSON.
 *
 * This router is dual-mounted, so `GET /cart` and `GET /api/cart` arrive here
 * together - the first wanting a page, the second wanting data. Answering both
 * from one handler avoids duplicating the assembly above into a second
 * endpoint.
 *
 * The JSON keeps the three buckets separate as well as combined, because the
 * page treats them differently: out-of-stock items block checkout and can be
 * cleared in bulk, unavailable ones can only be removed.
 */
const loadCart = async (req: Request, res: Response) => {
  try {
    const result = await buildCart(currentUserId(req));

    if (!result) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // `user` is dropped: the client already knows who it is from /auth/me.
    const { user: _user, ...cart } = result;
    res.json({ success: true, ...cart });
  } catch (error: any) {
    console.error('Error loading cart:', error);
    res.status(500).json({ success: false, message: 'Error loading cart' });
  }
};

// Remove item from cart
const removeFromCart = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { productId, variantId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const cart: any = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const initialLength = cart.items.length;
    
    if (variantId) {
      cart.items = cart.items.filter(
        (item: any) => !(item.productId.toString() === productId && item.variantId.toString() === variantId)
      );
    } else {
      cart.items = cart.items.filter(
        (item: any) => item.productId.toString() !== productId
      );
    }

    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart'
      });
    }

    await cart.save();

    const cartCount = cart.items.reduce((total: number, item: any) => total + item.quantity, 0);

    res.json({
      success: true,
      message: 'Product removed from cart successfully',
      cartCount
    });

  } catch (error: any) {
    console.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove product from cart'
    });
  }
};

// Update cart item quantity
const updateCartQuantity = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { productId, variantId, quantity } = req.body;

    if (!productId || !variantId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, variant ID, and quantity are required'
      });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity! Please select between 1 and 5 items per variant.'
      });
    }

    const product = await Product.findById(productId).populate(['category', 'brand']);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isListed || product.isDeleted ||
        (product.category && ((product.category as any).isListed === false || (product.category as any).isDeleted === true)) ||
        (product.brand && ((product.brand as any).isActive === false || (product.brand as any).isDeleted === true))) {
      return res.status(403).json({
        success: false,
        message: 'Product is no longer available'
      });
    }

    const variant = product.variants.find(v => v._id!.toString() === variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found'
      });
    }

    // Find user's cart
    const cart: any = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found in cart'
      });
    }

    const currentQuantity = cart.items[itemIndex].quantity;

    if (variant.stock === 0) {
      return res.status(403).json({
        success: false,
        message: `Size ${variant.size} is currently out of stock`,
        code: 'OUT_OF_STOCK',
        availableStock: 0
      });
    }

    if (parsedQuantity > currentQuantity && variant.stock < parsedQuantity) {
      return res.status(403).json({
        success: false,
        message: `Only ${variant.stock} items available in stock for size ${variant.size}. Cannot increase to ${parsedQuantity} items.`,
        code: 'INSUFFICIENT_STOCK',
        availableStock: variant.stock,
        requestedQuantity: parsedQuantity,
        currentQuantity: currentQuantity
      });
    }

    const finalPrice = calculateVariantFinalPrice(product, variant);
    
    cart.items[itemIndex].quantity = parsedQuantity;
    cart.items[itemIndex].price = finalPrice;
    cart.items[itemIndex].totalPrice = calculateItemTotal(finalPrice, parsedQuantity);

    await cart.save();

    const cartCount = cart.items.reduce((total: number, item: any) => total + item.quantity, 0);

    let totalItemCount = 0;
    let subtotal = 0;
    let totalDiscount = 0;
    let availableItemsCount = 0;
    let availableQuantity = 0;

    for (const cartItem of cart.items) {
      totalItemCount += cartItem.quantity;
      
      const itemProduct = await Product.findById(cartItem.productId).populate(['category', 'brand']);
      if (itemProduct) {
        const regularPrice = itemProduct.regularPrice || cartItem.price;
        subtotal += regularPrice * cartItem.quantity;
        
        const itemDiscount = (regularPrice - cartItem.price) * cartItem.quantity;
        totalDiscount += Math.max(0, itemDiscount);
        
        if (cartItem.variantId) {
          const itemVariant = itemProduct.variants.find(v => v._id!.toString() === cartItem.variantId.toString());
          if (itemVariant && itemVariant.stock > 0) {
            availableItemsCount++;
            availableQuantity += cartItem.quantity;
          }
        } else {
          availableItemsCount++;
          availableQuantity += cartItem.quantity;
        }
      }
    }

    const shipping = subtotal > 500 ? 0 : 50;
    const total = subtotal - totalDiscount + shipping;

    const updatedCartSummary = {
      totalItemCount,
      subtotal: Math.round(subtotal),
      totalDiscount: Math.round(totalDiscount),
      shipping,
      total: Math.round(total),
      availableItemsCount,
      availableQuantity
    };

    res.json({
      success: true,
      message: 'Cart updated successfully',
      cartCount,
      itemTotal: cart.items[itemIndex].totalPrice,
      cartSummary: updatedCartSummary 
    });

  } catch (error: any) {
    console.error('Error updating cart quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart'
    });
  }
};


// Clear entire cart
const clearCart = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    const cart: any = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      cartCount: 0
    });

  } catch (error: any) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

const removeOutOfStockItems = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    const cart: any = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
          select: 'name isListed isDeleted categoryOffer'
        }
      });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const initialItemCount = cart.items.length;
    const availableItems = cart.items.filter((item: any) => {
      if (!item.productId ||
          !(item.productId as any).isListed ||
          (item.productId as any).isDeleted) {
        return false; 
      }

      if ((item.productId as any).category && 
          (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true)) {
        return false; 
      }

      if ((item.productId as any).brand && 
          (((item.productId as any).brand).isActive === false || ((item.productId as any).brand).isDeleted === true)) {
        return false; 
      }

      if (item.variantId) {
        const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
        if (!variant || variant.stock === 0) {
          return false; 
        }
      }

      return true;
    });

    const removedItemCount = initialItemCount - availableItems.length;

    if (removedItemCount === 0) {
      return res.json({
        success: true,
        message: 'No out-of-stock items found to remove',
        removedCount: 0,
        cartCount: cart.items.reduce((total: number, item: any) => total + item.quantity, 0)
      });
    }

    cart.items = availableItems;
    await cart.save();

    const cartCount = cart.items.reduce((total: number, item: any) => total + item.quantity, 0);

    res.json({
      success: true,
      message: `Successfully removed ${removedItemCount} out-of-stock item${removedItemCount > 1 ? 's' : ''} from cart`,
      removedCount: removedItemCount,
      cartCount
    });

  } catch (error: any) {
    console.error('Error removing out-of-stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove out-of-stock items'
    });
  }
};

const validateCartItems = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    const cart: any = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
          select: 'name isListed isDeleted categoryOffer'
        }
      });

    if (!cart) {
      return res.json({
        success: true,
        availableItems: [],
        outOfStockItems: [],
        totalItems: 0
      });
    }

    const availableItems: any[] = [];
    const outOfStockItems: any[] = [];

    cart.items.forEach((item: any) => {
      const itemData: Record<string, any> = {
        productId: (item.productId as any)._id,
        variantId: item.variantId,
        productName: (item.productId as any).productName,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice
      };

      // Check availability (variant-specific)
      let isAvailable = true;
      let reason = '';

      if (!item.productId ||
          !(item.productId as any).isListed ||
          (item.productId as any).isDeleted) {
        isAvailable = false;
        reason = 'Product unavailable';
      } else if ((item.productId as any).category && 
                 (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true)) {
        isAvailable = false;
        reason = 'Category unavailable';
      } else if ((item.productId as any).brand && 
                 (((item.productId as any).brand).isActive === false || ((item.productId as any).brand).isDeleted === true)) {
        isAvailable = false;
        reason = 'Brand unavailable';
      } else if (item.variantId) {
        const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
        if (!variant) {
          isAvailable = false;
          reason = 'Variant not found';
        } else if (variant.stock === 0) {
          isAvailable = false;
          reason = `Size ${item.size} - Out of stock`;
        } else {
          itemData.stock = variant.stock;
        }
      }

      if (isAvailable) {
        availableItems.push(itemData);
      } else {
        outOfStockItems.push({
          ...itemData,
          reason
        });
      }
    });

    res.json({
      success: true,
      availableItems,
      outOfStockItems,
      totalItems: cart.items.length,
      availableCount: availableItems.length,
      outOfStockCount: outOfStockItems.length
    });

  } catch (error: any) {
    console.error('Error validating cart items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate cart items'
    });
  }
};

// Check authentication status
const checkAuth = async (req: Request, res: Response) => {
  try {
    res.json({
      authenticated: isSignedIn(req),
      user: req.user ?? null
    });
  } catch (error: any) {
    console.error('Error checking authentication:', error);
    res.json({ authenticated: false, user: null });
  }
};

// Load checkout page
const loadCheckout = async (req: Request, res: Response) => {
  return res.json({ success: true, redirectUrl: '/checkout' });
};

const validateCheckoutStock = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    const cart: any = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          {
            path: 'category',
            select: 'name isListed isDeleted categoryOffer'
          },
          {
            path: 'brand',
            select: 'name brandOffer isActive isDeleted'
          }
        ]
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
        code: 'EMPTY_CART'
      });
    }

    const validationResults: Record<string, any> = {
      validItems: [],
      invalidItems: [],
      outOfStockItems: [],
      unavailableItems: []
    };

    let checkoutEligibleItems: any[] = [];

    for (const item of cart.items) {
      const itemData: Record<string, any> = {
        productId: (item.productId as any)._id,
        variantId: item.variantId,
        productName: (item.productId as any).productName,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice
      };

      // Check if product exists and is available
      if (!item.productId || !(item.productId as any).isListed || (item.productId as any).isDeleted) {
        validationResults.unavailableItems.push({
          ...itemData,
          reason: 'Product is no longer available'
        });
        continue; 
      }

      // Check category availability
      if ((item.productId as any).category && 
          (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true)) {
        validationResults.unavailableItems.push({
          ...itemData,
          reason: 'Product category is no longer available'
        });
        continue; 
      }

      // Check brand availability
      if ((item.productId as any).brand && 
          (((item.productId as any).brand).isActive === false || ((item.productId as any).brand).isDeleted === true)) {
        validationResults.unavailableItems.push({
          ...itemData,
          reason: 'Product brand is no longer available'
        });
        continue; 
      }

      // Check variant-specific stock
      if (item.variantId) {
        const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
        
        if (!variant) {
          validationResults.invalidItems.push({
            ...itemData,
            reason: 'Product variant not found'
          });
          continue; 
        }

        if (variant.stock === 0) {
          validationResults.outOfStockItems.push({
            ...itemData,
            reason: `Size ${item.size} is out of stock`,
            availableStock: 0
          });
          continue; 
        }

        if (variant.stock < item.quantity) {
          validationResults.outOfStockItems.push({
            ...itemData,
            reason: `Only ${variant.stock} items available for size ${item.size}`,
            availableStock: variant.stock,
            requestedQuantity: item.quantity
          });
          continue;
        }

        validationResults.validItems.push({
          ...itemData,
          availableStock: variant.stock
        });
        checkoutEligibleItems.push(item);
      } else {
        validationResults.validItems.push(itemData);
        checkoutEligibleItems.push(item);
      }
    }

    if (checkoutEligibleItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in your cart are available for checkout. Please add available items to your cart.',
        code: 'NO_CHECKOUT_ITEMS',
        validationResults
      });
    }

    res.json({
      success: true,
      message: 'All cart items are available for checkout',
      validationResults,
      totalValidItems: validationResults.validItems.length,
      checkoutEligibleItems: checkoutEligibleItems.length
    });

  } catch (error: any) {
    console.error('Error validating checkout stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate cart for checkout'
    });
  }
};

const validateCartStock = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);

    const cart: any = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: {
          path: 'category',
          select: 'name isListed isDeleted categoryOffer'
        }
      });

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        allValid: true,
        availableItems: [],
        outOfStockItems: [],
        invalidItems: [],
        totalItems: 0,
        availableCount: 0,
        outOfStockCount: 0
      });
    }

    const availableItems: any[] = [];
    const outOfStockItems: any[] = [];
    const invalidItems: any[] = [];
    let errorMessages: any[] = [];

    cart.items.forEach((item: any) => {
      const itemData: Record<string, any> = {
        productId: (item.productId as any)._id,
        variantId: item.variantId,
        productName: (item.productId as any).productName,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice
      };

      let isAvailable = true;
      let reason = '';

      if (!item.productId ||
          !(item.productId as any).isListed ||
          (item.productId as any).isDeleted) {
        isAvailable = false;
        reason = 'Product unavailable';
        errorMessages.push(`${(item.productId as any).productName} is no longer available`);
      } else if ((item.productId as any).category && 
                 (((item.productId as any).category).isListed === false || ((item.productId as any).category).isDeleted === true)) {
        isAvailable = false;
        reason = 'Category unavailable';
        errorMessages.push(`${(item.productId as any).productName} category is no longer available`);
      } else if ((item.productId as any).brand && 
                 (((item.productId as any).brand).isActive === false || ((item.productId as any).brand).isDeleted === true)) {
        isAvailable = false;
        reason = 'Brand unavailable';
        errorMessages.push(`${(item.productId as any).productName} brand is no longer available`);
      } else if (item.variantId) {
        const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
        if (!variant) {
          isAvailable = false;
          reason = 'Variant not found';
          errorMessages.push(`${(item.productId as any).productName} (Size: ${item.size}) variant not found`);
        } else if (variant.stock === 0) {
          isAvailable = false;
          reason = `Size ${item.size} - Out of stock`;
          errorMessages.push(`${(item.productId as any).productName} (Size: ${item.size}) is out of stock`);
        } else if (variant.stock < item.quantity) {
          isAvailable = false;
          reason = `Size ${item.size} - Only ${variant.stock} available`;
          itemData.availableStock = variant.stock;
          errorMessages.push(`${(item.productId as any).productName} (Size: ${item.size}) - Only ${variant.stock} available, but you have ${item.quantity} in cart`);
        } else {
          itemData.stock = variant.stock;
          itemData.availableStock = variant.stock;
        }
      }

      if (isAvailable) {
        availableItems.push(itemData);
      } else {
        const invalidItem = {
          ...itemData,
          reason
        };
        
        if (reason.includes('Out of stock')) {
          outOfStockItems.push(invalidItem);
        } else {
          invalidItems.push(invalidItem);
        }
      }
    });

    const allValid = invalidItems.length === 0 && outOfStockItems.length === 0;
    const errorMessage = errorMessages.length > 0 ? errorMessages.join('\n') : '';

    res.json({
      success: true,
      allValid,
      errorMessage,
      availableItems,
      outOfStockItems,
      invalidItems,
      totalItems: cart.items.length,
      availableCount: availableItems.length,
      outOfStockCount: outOfStockItems.length,
      invalidCount: invalidItems.length
    });

  } catch (error: any) {
    console.error('Error validating cart stock:', error);
    res.status(500).json({
      success: false,
      allValid: false,
      errorMessage: 'Failed to validate cart stock',
      message: 'Failed to validate cart stock'
    });
  }
};

const resetCartItemQuantity = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { productId, variantId } = req.body;

    if (!productId || !variantId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and variant ID are required'
      });
    }

    const product = await Product.findById(productId).populate(['category', 'brand']);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variant = product.variants.find(v => v._id!.toString() === variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found'
      });
    }

    const cart: any = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found in cart'
      });
    }

    if (variant.stock === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reset quantity - item is out of stock',
        code: 'OUT_OF_STOCK'
      });
    }

    const newQuantity = Math.min(variant.stock, 5);
    const finalPrice = calculateVariantFinalPrice(product, variant);
    
    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].price = finalPrice;
    cart.items[itemIndex].totalPrice = calculateItemTotal(finalPrice, newQuantity);

    await cart.save();

    const cartCount = cart.items.reduce((total: number, item: any) => total + item.quantity, 0);

    res.json({
      success: true,
      message: `Quantity reset to ${newQuantity} (available stock)`,
      newQuantity,
      cartCount,
      itemTotal: cart.items[itemIndex].totalPrice
    });

  } catch (error: any) {
    console.error('Error resetting cart item quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset item quantity'
    });
  }
};

const saveForLater = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    const { productId, variantId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!variantId) {
      return res.status(400).json({
        success: false,
        message: 'Variant ID is required'
      });
    }

    const cart: any = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product variant not found in cart'
      });
    }

    const cartItem = cart.items[itemIndex];

    const product = await Product.findById(productId);
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Product is no longer available'
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const existingWishlistItem = wishlist.products.find(
      item => item.productId.toString() === productId
    );

    if (!existingWishlistItem) {
      wishlist.products.push({ productId, addedAt: new Date() });
      await wishlist.save();
    }

    const cartCount = cart.items.reduce((total: number, item: any) => total + item.quantity, 0);

    const wishlistCount = wishlist.products.length;

    res.json({
      success: true,
      message: 'Item saved to wishlist successfully',
      cartCount,
      wishlistCount
    });

  } catch (error: any) {
    console.error('Error saving item for later:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to save item for later'
    });
  }
};

const getWalletBalanceForCheckout = async (req: Request, res: Response) => {
  try {
    const userId = currentUserId(req);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        balance: 0
      });
    }

    // walletService has never exported getWalletBalance, so the previous call
    // threw a TypeError straight into the catch below - this endpoint always
    // returned 500. getWalletStats provides the balance, and already reports 0
    // when the user has no wallet yet.
    const walletStats = await walletService.getWalletStats(userId);
    const balance = walletStats.balance || 0;

    res.json({
      success: true,
      balance,
      formatted: `₹${balance.toLocaleString('en-IN')}`
    });

  } catch (error: any) {
    console.error('Error getting wallet balance for checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting wallet balance',
      balance: 0
    });
  }
};

export {
  addToCart,
  getCartCount,
  loadCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  removeOutOfStockItems,
  validateCartItems,
  checkAuth,
  loadCheckout,
  validateCheckoutStock,
  validateCartStock,
  resetCartItemQuantity,
  saveForLater,
  getWalletBalanceForCheckout
}