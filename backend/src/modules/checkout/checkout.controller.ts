import type { Request, Response } from 'express';
import Cart from '../cart/cart.model';
import Product from '../catalog/product.model';
import User from '../users/user.model';
import Address from '../addresses/address.model';
import Order from '../orders/order.model';
import Coupon from '../coupons/coupon.model';
import crypto from 'crypto';
import mongoose from 'mongoose';
import PendingOrder from './pending-order.model';
import { wantsJson } from '../../common/utils/wants-json.util';
import * as razorpayService from '../payments/razorpay.provider';
import * as walletService from '../wallet/wallet.service';
import { requireUserId } from '../../common/utils/current-user.util';
import { clearAppliedCoupon, getAppliedCoupon } from '../coupons/applied-coupon.service';
import { failureByRazorpayOrder, failureByTransaction } from './payment-failure.service';

import {
  ORDER_STATUS, 
  PAYMENT_STATUS,
  getOrderStatusArray,
  getPaymentStatusArray,
  PAYMENT_METHODS
} from '../../common/constants/order.constants';





// Helper functions
const calculateVariantFinalPrice = (product: any, variant: any) => {
  try {
    if (typeof product.calculateVariantFinalPrice === 'function') {
      return product.calculateVariantFinalPrice(variant);
    }
    return variant.basePrice || product.salePrice || product.regularPrice || 0;
  } catch (error: any) {
    console.error('Error calculating variant price:', error);
    return variant.basePrice || product.regularPrice || 0;
  }
}

const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${randomStr}`;
}


const validateProductAvailability = (product: any) => {  
  if (!product || !product.isListed || product.isDeleted) {
    return { isValid: false, reason: 'Product is no longer available' };
  }
  
  if (product.category && (!product.category.isActive || product.category.isDeleted)) {
    return { isValid: false, reason: 'Product category is unavailable' };
  }
  
  if (product.brand && (!product.brand.isActive || product.brand.isDeleted)) {
    return { isValid: false, reason: 'Product brand is unavailable' };
  }

  return { isValid: true };
};


const validateVariantStock = (product: any, variantId: any, requestedQuantity: any) => {
  const variant = product.variants.find((v: any) => v._id!.toString() === variantId.toString());

  if (!variant) {
    return {
      isValid: false,
      reason: 'Product variant not found',
      availableStock: 0
    };
  }

  if (variant.stock === 0) {
    return {
      isValid: false,
      reason: 'Out of stock',
      availableStock: 0
    };
  }

  if (variant.stock < requestedQuantity) {
    return {
      isValid: false,
      reason: `Only ${variant.stock} items available`,
      availableStock: variant.stock
    };
  }

  return {
    isValid: true,
    variant,
    availableStock: variant.stock
  };
}

const restoreStock = async (orderItems: any) => {
  try {
    for (const item of orderItems) {
      const product = await Product.findById(item.productId);
      if (product && item.variantId) {
        const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());
        if (variant) {
          variant.stock += item.quantity;
          await product.save();
          console.log(`Stock restored: ${item.quantity} units for product ${product.productName}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error restoring stock!: ', error);
  }
};

const deductStock = async (orderItems: any) => {
  const deductedItems: any[] = [];

  try {
    for (const item of orderItems) {
      const product = await Product.findById(item.productId);

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());

      if (!variant) {
        throw new Error(`Variant not found for product: ${product.productName}`);
      }

      if (variant.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.productName} (Size: ${item.size})`);
      }

      variant.stock -= item.quantity;
      await product.save();

      deductedItems.push(item);
      console.log(`Stock deducted: ${item.quantity} units from ${product.productName}`);
    }

    return true;
  } catch (error: any) {
    console.error('Error deducting stock, rolling back:', error);

    // restore stock for items that were already deducted
    if (deductedItems.length > 0) {
      await restoreStock(deductedItems);
    }

    throw error;
  }
};

const increaseCouponUsage = async (couponId: string, userId: string, orderId: string) => {
  try {
    const coupon = await Coupon.findById(couponId);
    if (coupon) {
      coupon.usedCount += 1;
      coupon.usedBy.push({
        user: userId as any,
        usedAt: new Date(),
        orderId: orderId as any
      });
      await coupon.save();
      console.log(` Coupon usage increased: ${coupon.code}`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Error increasing coupon usage:', error);
    throw error;
  }
};

const decreaseCouponUsage = async (couponId: string, userId: string, orderId: string) => {
  try {
    const coupon = await Coupon.findById(couponId);
    if (coupon && coupon.usedCount > 0) {
      coupon.usedCount = Math.max(0, coupon.usedCount - 1);
      coupon.usedBy = coupon.usedBy.filter(
        usage => !(usage.user.toString() === userId!.toString() && usage.orderId!.toString() === orderId.toString())
      );
      await coupon.save();
      console.log(` Coupon usage decreased: ${coupon.code}`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Error decreasing coupon usage:', error);
    throw error;
  }
};


const calculateOrderTotals = (cartItems: any) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalItemCount = 0;

  cartItems.forEach((item: any) => {
    const product = item.productId;
    const regularPrice = product.regularPrice;
    const quantity = item.quantity;

    subtotal += regularPrice * quantity;
    totalItemCount += quantity;

    const itemDiscount = (regularPrice - item.price) * quantity;
    totalDiscount += Math.max(0, itemDiscount);
  });

  const amountAfterDiscount = subtotal - totalDiscount;
  const shipping = amountAfterDiscount >= 500 ? 0 : 50;
  const total = amountAfterDiscount + shipping;

  return {
    subtotal: Math.round(subtotal),
    totalDiscount: Math.round(totalDiscount),
    amountAfterDiscount: Math.round(amountAfterDiscount),
    shipping,
    totalItemCount,
    total: Math.round(total)
  };
};  


const loadCheckout = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const heldCoupon = await getAppliedCoupon(userId);
    
    // user
    const user = await User.findById(userId).select('fullname email profilePhoto');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // addresses
    const userAddresses = await Address.findOne({ userId }).lean();
    const addresses = userAddresses ? userAddresses.address : [];


    // cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          {
            path: 'category',
            select: 'name isActive isDeleted categoryOffer'
          },
          {
            path: 'brand',
            select: 'name brandOffer isActive isDeleted'
          }
        ]
      });

    let cartItems: any[] = [];

    if (cart && cart!.items) {
      cartItems = cart!.items.filter(item => {
        if (!item.productId || !(item.productId as any).isListed || (item.productId as any).isDeleted) {
          return false;
        }

        if ((item.productId as any).category && ((item.productId as any).category.isActive === false || (item.productId as any).category.isDeleted === true)) {
          return false;
        }

        if ((item.productId as any).brand && ((item.productId as any).brand.isActive === false || (item.productId as any).brand.isDeleted === true)) {
          return false;
        }

        if (item.variantId) {
          const variant = (item.productId as any).variants.find((v: any) => v._id!.toString() === item.variantId.toString());
          if (!variant || variant.stock === 0 || variant.stock < item.quantity) {
            return false;
          }
        }

        return true;
      });
    }

    if (cartItems.length === 0) {
      // 409 rather than a redirect: the SPA decides to send them to the cart.
      // As a 302 this reached the SPA fallback and the client received
      // index.html with a 200, so checkout rendered blank on an empty cart.
      return res.status(409).json({
        success: false,
        message: 'Your cart is empty.',
        code: 'CART_EMPTY'
      });
    }

    // calculate totals
    const totals = calculateOrderTotals(cartItems);

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (heldCoupon) {
      appliedCoupon = heldCoupon;
      couponDiscount = appliedCoupon.discountAmount || 0;
    }

    const finalTotal = Math.max(0, totals.total - couponDiscount);

    let walletBalance = 0;
    try {
      const wallet = await walletService.getOrCreateWallet(userId!);
      walletBalance = wallet.balance || 0;
    } catch (error: any) {
      console.error('Error fetching wallet balance:', error);
    }

    const checkout = {
      cartItems,
      addresses,
      addressDocumentId: userAddresses?._id || null,
      totalItemCount: totals.totalItemCount,
      totalDiscount: totals.totalDiscount,
      subtotal: totals.subtotal,
      amountAfterDiscount: totals.amountAfterDiscount,
      couponDiscount: Math.round(couponDiscount),
      appliedCoupon,
      shipping: totals.shipping,
      total: Math.round(finalTotal),
      walletBalance
    };

    // The SPA asks for the same data under /api. paypalClientId is not sent:
    // it was always the empty string, so the PayPal button could never work.
    res.json({ success: true, ...checkout });

  } catch (error: any) {
    console.error('Error loading checkout:', error);

    res.status(500).json({ success: false, message: 'Error loading checkout page' });
  }
};


// 1. validate checkout stock 
const validateCheckoutStock = async (req: Request, res: Response) => {
  try {    
    const userId = requireUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category', select: 'name isActive isDeleted categoryOffer' },
          { path: 'brand', select: 'name isActive isDeleted brandOffer' }
        ]
      });

    if (!cart || !cart!.items || cart!.items.length === 0) {
      console.log('Cart is empty');
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
        code: 'EMPTY_CART'
      });
    }

    const validationResults: Record<string, any> = {
      validItems: [],
      invalidItems: [],
    };

    // Validate each cart item
    for (const item of cart!.items) {
      const itemData = {
        productId: (item.productId as any)._id,
        variantId: item.variantId,
        productName: (item.productId as any).productName,
        size: item.size,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice
      }

      const availabilityCheck = validateProductAvailability(item.productId);
      if (!availabilityCheck.isValid) {
        validationResults.invalidItems.push({
          ...itemData,
          reason: availabilityCheck.reason
        });
        continue;
      }

      const stockCheck = validateVariantStock(item.productId, item.variantId, item.quantity);
      if (!stockCheck.isValid) {
        validationResults.invalidItems.push({
          ...itemData,
          reason: stockCheck.reason,
          availableStock: stockCheck.availableStock
        });
        continue;
      }

      validationResults.validItems.push(itemData);
    }

    if (validationResults.validItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in your cart are available for checkout',
        code: 'NO_CHECKOUT_ITEMS',
        validationResults
      });
    }

    const responseMessage = validationResults.validItems.length === cart!.items.length
      ? 'All cart items are available for checkout'
      : 'Some items are unavailable but checkout can be processed';

    return res.json({
      success: true,
      message: responseMessage,
      validationResults,
      totalValidItems: validationResults.validItems.length,
      totalItems: cart!.items.length
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to validate cart for checkout',
      code: 'VALIDATION_ERROR'
    });
  }
};




// 3. place order with validation
const placeOrderWithValidation = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const heldCoupon = await getAppliedCoupon(userId);
    const { deliveryAddressId, addressIndex, paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!deliveryAddressId || addressIndex === undefined || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address and payment method are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    //  UPDATED: Support wallet payment method as well
    if (![PAYMENT_METHODS.COD, PAYMENT_METHODS.UPI, 'wallet'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. COD, UPI, and Wallet are supported',
        code: 'INVALID_PAYMENT_METHOD'
      });
    }

    console.log(`💳 Processing order with payment method: ${paymentMethod}`);

    // Fetch and validate cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category', select: 'name isActive isDeleted categoryOffer' },
          { path: 'brand', select: 'name isActive isDeleted brandOffer' }
        ]
      });

    if (!cart || !cart!.items || cart!.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
        code: 'EMPTY_CART'
      });
    }

    console.log(`📦 Cart items found: ${cart!.items.length}`);

    //  NEW: Validate coupon before processing order
    if (heldCoupon) {
      try {
        const coupon = await Coupon.findById(heldCoupon.couponId);

        if (!coupon || !coupon.isActive) {
          console.warn(' Applied coupon is no longer valid');
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Applied coupon is no longer valid',
            code: 'INVALID_COUPON'
          });
        }

        const now = new Date();
        if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
          console.warn(' Applied coupon has expired');
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired',
            code: 'COUPON_EXPIRED'
          });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          console.warn(' Coupon usage limit reached');
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
            code: 'COUPON_LIMIT_REACHED'
          });
        }

        const userUsageCount = coupon.usedBy.filter(
          usage => usage.user.toString() === userId!.toString()
        ).length;

        if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
          console.warn(' User has reached coupon usage limit');
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'You have reached the coupon usage limit',
            code: 'USER_COUPON_LIMIT_REACHED'
          });
        }

        console.log(` Coupon validated: ${coupon.code}`);

      } catch (couponError: any) {
        console.error('Error validating coupon:', couponError);
        await clearAppliedCoupon(userId);
        return res.status(400).json({
          success: false,
          message: 'Error validating coupon',
          code: 'COUPON_VALIDATION_ERROR'
        });
      }
    }

    // Check for stock issues
    const stockIssues: any[] = [];

    for (const item of cart!.items) {
      const productName = (item.productId as any)?.productName || 'Unknown Product';

      // Check product availability
      const availabilityCheck = validateProductAvailability(item.productId);
      if (!availabilityCheck.isValid) {
        stockIssues.push({
          productName,
          size: item.size,
          quantity: item.quantity,
          error: availabilityCheck.reason
        });
        continue;
      }

      // Check variant stock
      if (item.variantId) {
        const stockCheck = validateVariantStock(item.productId, item.variantId, item.quantity);
        if (!stockCheck.isValid) {
          stockIssues.push({
            productName,
            size: item.size,
            quantity: item.quantity,
            availableStock: stockCheck.availableStock,
            error: stockCheck.reason
          });
        }
      }
    }

    if (stockIssues.length > 0) {
      const errorMessages = stockIssues.map((issue, index) => 
        `${index + 1}. ${issue.productName} (Size: ${issue.size}) \n ${issue.error}`
      );

      console.warn(' Stock validation failed:', errorMessages);

      return res.status(400).json({
        success: false,
        message: 'Some items in your cart have stock issues:\n\n' + errorMessages.join('\n\n') + '\n\nPlease update your cart before proceeding.',
        code: 'STOCK_VALIDATION_FAILED',
        invalidItems: stockIssues
      });
    }

    console.log(' All stock validations passed');

    //  UPDATED: Route to appropriate payment handler
    if (paymentMethod === PAYMENT_METHODS.COD) {
      console.log('💵 Routing to COD handler');
      return await handleCODOrder(req, res, cart);
    } else if (paymentMethod === PAYMENT_METHODS.UPI) {
      console.log('🏦 Routing to Razorpay/UPI handler');
      return await createRazorpayPayment(req, res);
    } else if (paymentMethod === 'wallet') {
      console.log('💳 Routing to Wallet payment handler');
      return await handleWalletPayment(req, res);
    }

  } catch (error: any) {
    console.error(' Error in placeOrderWithValidation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate and place order',
      code: 'VALIDATION_ERROR',
      error: error.message
    });
  }
};





// handle cod order
const handleCODOrder = async (req: any, res: any, cart: any) => {
  try {
    const userId = requireUserId(req);
    const heldCoupon = await getAppliedCoupon(userId);
    const { deliveryAddressId, addressIndex } = req.body;

    console.log('Processing COD order for user:', userId);

    if (!deliveryAddressId) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required',
        code: 'MISSING_DELIVERY_ADDRESS'
      });
    }

    const addressDoc = await Address.findById(deliveryAddressId).lean();

    if (!addressDoc) {
      return res.status(400).json({
        success: false,
        message: 'Selected delivery address not found. Please select a valid address.',
        code: 'INVALID_DELIVERY_ADDRESS'
      });
    }


    const parsedAddressIndex = parseInt(addressIndex);
    if (!addressDoc.address || !Array.isArray(addressDoc.address) || !addressDoc.address[parsedAddressIndex]) {
      return res.status(400).json({
        success: false,
        message: 'Selected address is invalid or has been removed',
        code: 'ADDRESS_NOT_FOUND'
      });
    }

    console.log(`Delivery address validated: ${addressDoc.address[parsedAddressIndex].name || 'N/A'}`);

    const totals = calculateOrderTotals(cart!.items);

    let couponDiscount = 0;
    let appliedCouponId = null;

    if (heldCoupon) {
      try {
        const coupon = await Coupon.findById(heldCoupon.couponId);

        // validate coupon
        if (!coupon || !coupon.isActive) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Applied coupon is no longer valid. Please try again without the coupon.',
            code: 'INVALID_COUPON'
          });
        }
 
        const now = new Date();
        if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired or is not yet active',
            code: 'COUPON_EXPIRED'
          });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit has been reached',
            code: 'COUPON_LIMIT_REACHED'
          });
        }

        const userUsageCount = coupon.usedBy.filter(usage => usage.user.toString() === userId!.toString()).length;

        if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'You have already used this coupon the maximum number of times',
            code: 'USER_COUPON_LIMIT_REACHED'
          });
        }

        if (coupon.minimumOrderValue && totals.total < coupon.minimumOrderValue) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: `Minimum order value of ₹${coupon.minimumOrderValue} required for the coupon`,
            code: 'MIN_ORDER_VALUE_NOT_MET'
          });
        }

        couponDiscount = heldCoupon.discountAmount || 0;
        appliedCouponId = heldCoupon.couponId;
        console.log(`Coupon validated and applied: ${coupon.code} (₹${couponDiscount} off)`);

      } catch (couponError: any) {
        console.error('Error validating coupon:', couponError);
        await clearAppliedCoupon(userId);
        return res.status(400).json({
          success: false,
          message: 'Error validating coupon. Please try again without the coupon.',
          code: 'COUPON_VALIDATION_ERROR'
        });
      }
    }

    const finalTotal = Math.max(0, totals.total - couponDiscount);

    if (finalTotal >= 10000) {
      return res.status(400).json({
        success: false,
        message: 'Cash on Delivery is not available for orders of ₹10,000 or more. Please choose an online payment method.',
        code: 'COD_NOT_AVAILABLE',
        data: {
          orderTotal: finalTotal,
          codLimit: 10000
        }
      });
    }

    console.log(`COD validation passed. Order total: ₹${finalTotal}`);
    
    // prepare order items
    const orderItems = cart!.items.map((item: any) => ({
      productId: (item.productId as any)._id,
      variantId: item.variantId,
      sku: item.sku,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      statusHistory: [{
        status: ORDER_STATUS.PENDING,
        updatedAt: new Date(),
        notes: 'Order placed with COD'
      }]
    }));


    try {
      await deductStock(orderItems);
      console.log('Stock deducted successfully!');
    } catch (error: any) {
      console.error('Stock deduction failed:', error);
      return res.status(400).json({
          success: false,
          message: 'Failed to process order due to stock issues',
          error: error.message,
          code: 'STOCK_DEDUCTION_FAILED'
      });
    }



    const addressObjectId = new mongoose.Types.ObjectId(deliveryAddressId);

    const order = new Order({
      orderId: generateOrderId(),
      user: userId as any,
      items: orderItems,
      deliveryAddress: {
        addressId: addressObjectId as any,
        addressIndex: parsedAddressIndex
      },
      couponApplied: appliedCouponId as any,
      couponDiscount: Math.round(couponDiscount),
      couponCode: heldCoupon?.code || null,
      paymentMethod: PAYMENT_METHODS.COD,
      paymentStatus: PAYMENT_STATUS.PENDING,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      amountAfterDiscount: totals.amountAfterDiscount,
      shipping: totals.shipping,
      totalAmount: Math.round(finalTotal),
      totalItemCount: totals.totalItemCount,
      status: ORDER_STATUS.PENDING,
      statusHistory: [{
        status: ORDER_STATUS.PENDING,
        updatedAt: new Date(),
        notes: 'Order placed successfully with COD'
      }]
    });

    try {
      await order!.save();
      order.orderDocumentId = order!._id;
      await order!.save();
      console.log(`Order created successfully: ${order!.orderId}`);
    } catch (saveError: any) {
      console.error('Error saving order:', saveError);
      await restoreStock(orderItems);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
        code: 'ORDER_CREATION_FAILED'
      });
    }

    if (appliedCouponId) {
      try {
        const coupon = await Coupon.findById(appliedCouponId);
        if (coupon) {
          coupon.usedCount += 1;
          coupon.usedBy.push({
            user: userId as any,
            usedAt: new Date(),
            orderId: order!._id
          });
          await coupon.save();
          console.log(`Coupon usage updated: ${coupon.code}`);
        }
      } catch (couponError: any) {
        console.error('Error updating coupon usage:', couponError);
      }
    }

    cart!.items = [];
    await cart.save();
    console.log('Cart cleared');

    if (heldCoupon) {
      await clearAppliedCoupon(userId);
      console.log('Coupon removed from session');
    }

    return res.json({
      success: true,
      message: 'COD Order placed successfully',
      orderId: order!.orderId,
      orderDocumentId: order!._id,
      redirectUrl: `/checkout/order-success/${order!.orderId}`
    });

  } catch (error: any) {
    console.error('Error in handleCODOrder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process COD order',
      code: 'COD_ORDER_FAILED',
      error: error.message
    });
  }
};



// Create Razorpay Order
const createRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const heldCoupon = await getAppliedCoupon(userId);
    const { deliveryAddressId, addressIndex } = req.body;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category', select: 'name isActive isDeleted' },
          { path: 'brand', select: 'name isActive isDeleted' }
        ]
      });

    if (!cart || !cart!.items || cart!.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
        code: 'EMPTY_CART'
      });
    }

    // Calculate totals
    const totals = calculateOrderTotals(cart!.items);
    let couponDiscount = 0;
    let appliedCouponId = null;

    if (heldCoupon) {
      try {
        const coupon = await Coupon.findById(heldCoupon.couponId);

        if (!coupon || !coupon.isActive) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Applied coupon is no longer valid',
            code: 'INVALID_COUPON'
          });
        }

        const now = new Date();
        if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired',
            code: 'COUPON_EXPIRED'
          });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
            code: 'COUPON_LIMIT_REACHED'
          });
        }

        const userUsageCount = coupon.usedBy.filter(usage => usage.user.toString() === userId!.toString()).length;
        if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'You have reached the coupon usage limit',
            code: 'USER_COUPON_LIMIT_REACHED'
          });
        }

        if (coupon.minimumOrderValue && totals.total < coupon.minimumOrderValue) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: `Minimum order value of ₹${coupon.minimumOrderValue} required`,
            code: 'MIN_ORDER_VALUE_NOT_MET'
          });
        }

        couponDiscount = heldCoupon.discountAmount || 0;
        appliedCouponId = heldCoupon.couponId;
        console.log(`Coupon validated: ${coupon.code} (₹${couponDiscount} off)`);

      } catch (couponError: any) {
        console.error('Coupon validation error:', couponError);
        await clearAppliedCoupon(userId);
        return res.status(400).json({
          success: false,
          message: 'Error validating coupon',
          code: 'COUPON_VALIDATION_ERROR'
        });
      }
    }

    const finalTotal = Math.max(0, totals.total - couponDiscount);

    // Create temporary order ID for Razorpay
    const tempOrderId = `TEMP-${generateOrderId()}`;

    const razorpayOrder = await razorpayService.createRazorpayOrder(tempOrderId, finalTotal);

    console.log(`Razorpay order created: ${razorpayOrder.id}`);

    /*
     * The snapshot is stored server-side, keyed by the Razorpay order id.
     *
     * It used to live in req.session, which meant a session lost between here
     * and verification left the customer charged with no order. Razorpay hands
     * this id back in the callback, so verification can find the snapshot
     * without any session or client state.
     */
    await PendingOrder.create({
      razorpayOrderId: razorpayOrder.id,
      tempOrderId,
      userId,
      deliveryAddressId,
      addressIndex,
      cart: cart!.items,
      totals,
      couponDiscount,
      appliedCouponId,
      amount: finalTotal
    });

    return res.json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(finalTotal * 100),
        currency: 'INR',
        userName: req.user?.name || 'User',
        userEmail: req.user?.email || '',
        userPhone: req.user?.phone || '',
        keyId: process.env.RAZORPAY_KEY_ID,
        description: `Order for ${req.user?.name || 'Customer'}`
      }
    });

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      code: 'RAZORPAY_ORDER_FAILED',
      error: error.message
    });
  }
};


// Verify Razorpay Payment
const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    console.log(' Verifying Razorpay payment for new order...');

    // Step 1: Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error(' Signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed',
        code: 'SIGNATURE_VERIFICATION_FAILED'
      });
    }

    console.log(' Signature verified');

    /*
     * Found by the Razorpay order id, not the session. The signature has
     * already been verified above, so this id is proven to have come from
     * Razorpay rather than the caller.
     */
    const pendingOrder = await PendingOrder.findOne({ razorpayOrderId }).lean();

    if (!pendingOrder) {
      return res.status(400).json({
        success: false,
        message: 'No pending order found',
        code: 'NO_PENDING_ORDER'
      });
    }

    // The snapshot belongs to whoever created it. Verifying that here stops a
    // signed-in shopper completing someone else's payment.
    if (String(pendingOrder.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'This payment belongs to a different account',
        code: 'PENDING_ORDER_MISMATCH'
      });
    }

    //  ADDED: Validate delivery address from pending order
    if (!pendingOrder.deliveryAddressId!) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address information is missing',
        code: 'MISSING_DELIVERY_ADDRESS'
      });
    }

    const addressDoc = await Address.findById(pendingOrder.deliveryAddressId!).lean();

    if (!addressDoc) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address not found. Please try placing the order again.',
        code: 'INVALID_DELIVERY_ADDRESS'
      });
    }

    const parsedAddressIndex = parseInt(String(pendingOrder.addressIndex));
    if (!addressDoc.address || !Array.isArray(addressDoc.address) || !addressDoc.address[parsedAddressIndex]) {
      return res.status(400).json({
        success: false,
        message: 'Selected address is no longer available. Please try again.',
        code: 'ADDRESS_NOT_FOUND'
      });
    }

    console.log(` Delivery address validated: ${addressDoc.address[parsedAddressIndex].name || 'N/A'}`);
    console.log('✨ Processing new order payment');

    try {
      const addressObjectId = new mongoose.Types.ObjectId(String(pendingOrder.deliveryAddressId));

      const orderItems = pendingOrder.cart!.map(item => ({
        productId: (item.productId as any)._id,
        variantId: item.variantId,
        sku: item.sku,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        status: ORDER_STATUS.PROCESSING,
        paymentStatus: PAYMENT_STATUS.COMPLETED,
        statusHistory: [{
          status: ORDER_STATUS.PROCESSING,
          updatedAt: new Date(),
          notes: 'Order confirmed - Payment successful'
        }]
      }));

      // Step 2: Deduct stock for new order
      try {
        await deductStock(pendingOrder.cart!);
        console.log(' Stock deducted for new order');
      } catch (stockError: any) {
        console.error(' Error deducting stock:', stockError);
        throw new Error(`Stock deduction failed: ${stockError.message}`);
      }

      // Step 3: Create new order with successful payment
      const order = new Order({
        orderId: generateOrderId(),
        user: userId as any,
        items: orderItems,
        deliveryAddress: {
          addressId: addressObjectId as any,
          addressIndex: parsedAddressIndex
        },
        couponApplied: pendingOrder.appliedCouponId!,
        couponDiscount: Math.round(pendingOrder.couponDiscount!),
        paymentMethod: PAYMENT_METHODS.UPI,
        paymentStatus: PAYMENT_STATUS.COMPLETED,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
        subtotal: pendingOrder.totals!.subtotal,
        totalDiscount: pendingOrder.totals!.totalDiscount,
        amountAfterDiscount: pendingOrder.totals!.amountAfterDiscount,
        shipping: pendingOrder.totals!.shipping,
        totalAmount: Math.round(pendingOrder.amount!),
        totalItemCount: pendingOrder.totals!.totalItemCount,
        status: ORDER_STATUS.PROCESSING,
        statusHistory: [{
          status: ORDER_STATUS.PROCESSING,
          updatedAt: new Date(),
          notes: 'Order confirmed - Payment successful'
        }]
      });

      try {
        await order!.save();
        console.log(` New order created: ${order!.orderId}`);
      } catch (orderCreateError: any) {
        console.error(' Error creating order:', orderCreateError);
        throw new Error(`Order creation failed: ${orderCreateError.message}`);
      }

      // Step 4: Update coupon usage
      if (pendingOrder.appliedCouponId!) {
        try {
          await increaseCouponUsage(String(pendingOrder.appliedCouponId), String(userId), String(order!._id));
          console.log(' Coupon usage updated');
        } catch (couponError: any) {
          console.error(' Error updating coupon usage:', couponError);
          throw new Error(`Coupon update failed: ${couponError.message}`);
        }
      }

      // Step 5: Clear cart after successful payment
      try {
        let userCart = await Cart.findOne({ user: userId });
        if (!userCart) {
          userCart = await Cart.findOne({ userId: userId });
        }

        if (userCart) {
          userCart.items = [];
          (userCart as any).totalItems = 0; // no-op: not a schema path
          (userCart as any).totalPrice = 0; // no-op: not a schema path
          await userCart.save();
          console.log(' Cart cleared after successful payment');
        }
      } catch (cartError: any) {
        console.error(' Error clearing cart:', cartError);
      }

      // Step 6: the snapshot has served its purpose, and the coupon is now
      // recorded on the order itself.
      await PendingOrder.deleteOne({ razorpayOrderId });
      await clearAppliedCoupon(userId);

      return res.json({
        success: true,
        message: 'Payment successful',
        data: {
          redirectUrl: `/checkout/order-success/${order!.orderId}`,
          orderId: String(order!._id),
          orderNumber: order!.orderId
        }
      });

    } catch (processingError: any) {
      console.error(' Error processing payment:', processingError);

      // Restore stock and coupon on error
      console.log(' Restoring stock and coupon on payment error...');

      try {
        await restoreStock(pendingOrder.cart!);
        console.log(' Stock restored after payment error');
      } catch (restoreError: any) {
        console.error(' Error restoring stock:', restoreError);
      }

      if (pendingOrder.appliedCouponId!) {
        try {
          await decreaseCouponUsage(String(pendingOrder.appliedCouponId), String(userId), null as any);
          console.log(' Coupon usage restored after payment error');
        } catch (couponRestoreError: any) {
          console.error(' Error restoring coupon usage:', couponRestoreError);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error processing payment',
        code: 'PAYMENT_PROCESSING_ERROR',
        error: processingError.message
      });
    }

  } catch (error: any) {
    console.error(' Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      code: 'VERIFICATION_ERROR',
      error: error.message
    });
  }
};






// Handle Payment Failure
const handlePaymentFailure = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { razorpayOrderId, error } = req.body;

    console.log(' Payment failed for Razorpay Order:', razorpayOrderId);
    console.log('Error details:', error);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Same server-side lookup as verification - a failed payment must still be
    // recordable when the session is gone, which is precisely when a customer
    // most needs the failure page to explain itself.
    const pendingOrder = await PendingOrder.findOne({ razorpayOrderId }).lean();

    if (!pendingOrder) {
      return res.status(400).json({
        success: false,
        message: 'No pending order found',
        code: 'NO_PENDING_ORDER'
      });
    }

    const addressObjectId = new mongoose.Types.ObjectId(String(pendingOrder.deliveryAddressId));

    const orderItems = pendingOrder.cart!.map(item => ({
      productId: (item.productId as any)._id,
      variantId: item.variantId,
      sku: item.sku,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.FAILED,
      statusHistory: [{
        status: ORDER_STATUS.PENDING,
        updatedAt: new Date(),
        notes: 'Order created but payment failed - awaiting retry'
      }]
    }));

    //  DO NOT DEDUCT STOCK - Payment hasn't succeeded yet
    console.log(' Stock NOT deducted - Payment failed, awaiting retry');

    //  DO NOT UPDATE COUPON - Payment hasn't succeeded yet  
    console.log(' Coupon usage NOT updated - Payment failed, awaiting retry');

    const order = new Order({
      orderId: generateOrderId(),
      user: userId as any,
      items: orderItems,
      deliveryAddress: {
        addressId: addressObjectId as any,
        addressIndex: parseInt(String(pendingOrder.addressIndex))
      },
      couponApplied: pendingOrder.appliedCouponId!,
      couponDiscount: Math.round(pendingOrder.couponDiscount!),
      paymentMethod: PAYMENT_METHODS.UPI,
      paymentStatus: PAYMENT_STATUS.FAILED,
      razorpayOrderId: razorpayOrderId,
      subtotal: pendingOrder.totals!.subtotal,
      totalDiscount: pendingOrder.totals!.totalDiscount,
      amountAfterDiscount: pendingOrder.totals!.amountAfterDiscount,
      shipping: pendingOrder.totals!.shipping,
      totalAmount: Math.round(pendingOrder.amount!),
      totalItemCount: pendingOrder.totals!.totalItemCount,
      status: ORDER_STATUS.PENDING,
      statusHistory: [{
        status: ORDER_STATUS.PENDING,
        updatedAt: new Date(),
        notes: `Payment failed: ${error?.description || 'Payment processing failed'} - User can retry`
      }]
    });

    try {
      await order!.save();
      console.log(` Order created with FAILED payment status: ${order!.orderId}`);

      // Clear cart after payment failure
      try {
        let userCart = await Cart.findOne({ userId: userId });
        if (userCart) {
          userCart.items = [];
          (userCart as any).totalItems = 0; // no-op: not a schema path
          (userCart as any).totalPrice = 0; // no-op: not a schema path
          await userCart.save();
          console.log(' Cart cleared after payment failure');
        }
      } catch (cartError: any) {
        console.error(' Error clearing cart:', cartError);
      }

      // Store failed order info in session for retry page

      await PendingOrder.deleteOne({ razorpayOrderId });
      await clearAppliedCoupon(userId);

      return res.json({
        success: true,
        message: 'Order created with failed payment status. You can retry payment.',
        data: {
          redirectUrl: `/checkout/order-failure/${razorpayOrderId || 'unknown'}`,
          orderId: String(order!._id),
          orderNumber: order!.orderId
        }
      });

    } catch (saveError: any) {
      console.error(' Error saving failed order:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
        code: 'ORDER_CREATION_FAILED',
        error: saveError.message
      });
    }

  } catch (error: any) {
    console.error(' Error handling payment failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing payment failure',
      code: 'PAYMENT_FAILURE_ERROR',
      error: error.message
    });
  }
};







const loadOrderSuccess = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const userId = requireUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // order 
    const order = await Order.findOne({ orderId: orderId, user: userId })
      .populate({
        path: 'items.productId',
        select: 'productName mainImage subImages regularPrice salePrice'
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    let actualDeliveryAddress = null;
    
    if (order.deliveryAddress && order.deliveryAddress.addressId) {
      const addressDoc = await Address.findById(order.deliveryAddress.addressId);
      const addressIndex = order.deliveryAddress.addressIndex;

      if (addressDoc) {
        if (addressDoc.address && Array.isArray(addressDoc.address) && addressDoc.address[addressIndex]) {
          actualDeliveryAddress = addressDoc.address[addressIndex];
          console.log('Found address:', actualDeliveryAddress);
        } else {
          console.error('Address not found at index:', addressIndex);
          console.error('Available addresses:', addressDoc.address ? addressDoc.address.length : 0);
          console.error('addressDoc.address:', addressDoc.address);
        }
      } else {
        console.error('Address document not found in database for ID:', order.deliveryAddress.addressId);
      }
    } else {
      console.error('No deliveryAddress or addressId in order');
    }

    const orderData = {
      orderId: order!.orderId,
      items: order!.items.map(item => {
        const itemObj: any = item.toObject();
        
        if (item.productId && typeof item.productId === 'object') {
          itemObj.productId = {
            _id: (item.productId as any)._id,
            productName: (item.productId as any).productName || 'Product Name',
            mainImage: (item.productId as any).mainImage || null,
            subImages: (item.productId as any).subImages || []
          };
        } else {
          itemObj.productId = {
            _id: itemObj.productId,
            productName: 'Product Name',
            mainImage: null,
            subImages: []
          };
        }
        
        return itemObj;
      }),
      deliveryAddress: actualDeliveryAddress || {
        name: 'Address not found',
        addressType: 'N/A',
        landMark: 'N/A',
        city: 'N/A',
        state: 'N/A',
        pincode: 'N/A',
        phone: 'N/A'
      },
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      totalDiscount: order.totalDiscount,
      couponDiscount: order.couponDiscount || 0,
      couponCode: order.couponCode || null,
      amountAfterDiscount: order.amountAfterDiscount,
      shipping: order.shipping,
      total: order!.totalAmount,
      totalItemCount: order.totalItemCount,
      status: order!.status,
      paymentStatus: order!.paymentStatus,
      createdAt: order.createdAt
    };

    res.json({ success: true, orderData });


  } catch (error: any) {
    console.error('Error loading order success page:', error);
    res.status(500).send('Error loading order success page: ' + error.message);
  }
};

// Load Order Failure Page
const loadOrderFailure = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { transactionId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const paymentFailure = await failureByTransaction(userId, transactionId);

    if (!paymentFailure) {
      return res.status(404).json({ success: false, message: 'No failed payment found' });
    }

    // Fetch the failed order from database
    let failedOrder = null;
    try {
      failedOrder = await Order.findById(paymentFailure.orderId)
        .populate({
          path: 'items.productId',
          select: 'productName mainImage subImages'
        })
        .lean();
    } catch (err: any) {
      console.error('Error fetching failed order:', err);
    }

    if (!failedOrder) {
      return res.status(404).json({
        success: false,
        message: 'No failed order found.',
        code: 'NO_FAILED_ORDER'
      });
    }

    const canRetry = failedOrder.status !== ORDER_STATUS.FAILED;
    
    if (!canRetry) {
      console.log(' Order status is FAILED - No more retries allowed');
    }

    // Fetch full address
    let deliveryAddress = null;
    try {
      const userAddresses = await Address.findOne({ userId }).lean();
      
      if (userAddresses && userAddresses.address) {
        const addressIndex = parseInt(paymentFailure.orderData!.addressIndex) || 0;
        deliveryAddress = userAddresses.address[addressIndex];
      }
    } catch (addressError: any) {
      console.error('Error fetching address:', addressError);
    }

    // Populate product details
    let populatedItems: any[] = [];
    if (paymentFailure.orderData?.items) {
      for (const item of paymentFailure.orderData!.items) {
        try {
          const product = await Product.findById((item.productId as any)._id)
            .select('productName mainImage subImages')
            .lean();
          
          populatedItems.push({
            ...item,
            productId: product || item.productId
          });
        } catch (err: any) {
          populatedItems.push(item);
        }
      }
    }

    const orderData = {
      items: populatedItems,
      subtotal: paymentFailure.orderData!.subtotal,
      totalDiscount: paymentFailure.orderData!.totalDiscount,
      shipping: paymentFailure.orderData!.shipping,
      total: paymentFailure.orderData!.total,
      totalItemCount: paymentFailure.orderData!.totalItemCount,
      couponDiscount: paymentFailure.orderData!.couponDiscount,
      deliveryAddress: deliveryAddress || null,
      deliveryAddressId: paymentFailure.orderData!.deliveryAddressId,
      addressIndex: paymentFailure.orderData!.addressIndex,
      paymentMethod: failedOrder.paymentMethod || 'upi'
    };

    const failure = {
      transactionId,
      orderId: paymentFailure.orderId,
      orderNumber: paymentFailure.orderNumber,
      failureReason: paymentFailure.reason,
      orderData,
      canRetry
    };

    res.json({ success: true, ...failure });

  } catch (error: any) {
    console.error('Error loading order failure page:', error);
    return res.status(500).json({ success: false, message: 'Could not load the order.' });
  }
};





// Load Retry Payment Page
const loadRetryPaymentPage = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { transactionId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const paymentFailure = await failureByTransaction(userId, transactionId);

    if (!paymentFailure) {
      return res.status(404).json({ success: false, message: 'No failed payment found' });
    }

    // Fetch the failed order from database
    let failedOrder = null;
    try {
      failedOrder = await Order.findById(paymentFailure.orderId)
        .populate({
          path: 'items.productId',
          select: 'productName mainImage subImages'
        })
        .lean();
    } catch (err: any) {
      console.error('Error fetching failed order:', err);
    }

    // Validate all items are still available for retry
    if (failedOrder) {
      for (const item of failedOrder.items) {
        try {
          const product = await Product.findById((item.productId as any)._id).lean();
          
          if (!product || !product.isListed || product.isDeleted) {
            return res.status(409).json({
              success: false,
              message: 'An item in this order is no longer available.',
              code: 'PRODUCT_UNAVAILABLE'
            });
          }

          // Check variant stock
          if (item.variantId && product.variants) {
            const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());
            if (!variant || variant.stock === 0 || variant.stock < item.quantity) {
              return res.status(409).json({
                success: false,
                message: 'An item in this order is out of stock.',
                code: 'OUT_OF_STOCK'
              });
            }
          }
        } catch (itemError: any) {
          console.error('Error validating item:', itemError);
        }
      }
    }

    // Fetch full address
    let deliveryAddress = null;
    try {
      const userAddresses = await Address.findOne({ userId }).lean();
      
      if (userAddresses && userAddresses.address) {
        const addressIndex = parseInt(paymentFailure.orderData!.addressIndex) || 0;
        deliveryAddress = userAddresses.address[addressIndex];
      }
    } catch (addressError: any) {
      console.error('Error fetching address:', addressError);
    }

    // Populate product details
    let populatedItems: any[] = [];
    if (paymentFailure.orderData?.items) {
      for (const item of paymentFailure.orderData!.items) {
        try {
          const product = await Product.findById((item.productId as any)._id)
            .select('productName mainImage subImages')
            .lean();
          
          populatedItems.push({
            ...item,
            productId: product || item.productId
          });
        } catch (err: any) {
          populatedItems.push(item);
        }
      }
    }

    const orderData = {
      items: populatedItems,
      subtotal: paymentFailure.orderData!.subtotal,
      totalDiscount: paymentFailure.orderData!.totalDiscount,
      shipping: paymentFailure.orderData!.shipping,
      total: paymentFailure.orderData!.total,
      totalItemCount: paymentFailure.orderData!.totalItemCount,
      couponDiscount: paymentFailure.orderData!.couponDiscount,
      deliveryAddress: deliveryAddress || null,
      deliveryAddressId: paymentFailure.orderData!.deliveryAddressId,
      addressIndex: paymentFailure.orderData!.addressIndex
    };

    const retry = {
      transactionId,
      orderId: paymentFailure.orderId,
      orderNumber: paymentFailure.orderNumber,
      failureReason: paymentFailure.reason,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      orderData
    };

    res.json({ success: true, ...retry });

  } catch (error: any) {
    console.error('Error loading retry payment page:', error);
    return res.status(500).json({ success: false, message: 'Could not load the retry page.' });
  }
};

// Retry razorpay Payment
const createRazorpayOrderForRetry = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { razorpayOrderId, error } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // The client sends the transaction id it was given; the failed order is
    // the source of truth rather than a session cache.
    const paymentFailure = await failureByTransaction(userId, req.body.transactionId);

    if (!paymentFailure) {
      return res.status(400).json({
        success: false,
        message: 'No failed order found for retry',
        code: 'NO_FAILED_ORDER'
      });
    }

    console.log(' Creating Razorpay order for retry payment...');

    // Use the order data from the previous failed payment
    const orderData = paymentFailure.orderData;

    // Validate all items are still available
    for (const item of orderData.items) {
      try {
        const product = await Product.findById((item.productId as any)._id);
        
        if (!product || !product.isListed || product.isDeleted) {
          return res.status(400).json({
            success: false,
            message: `${(item.productId as any).productName} is no longer available`,
            code: 'PRODUCT_UNAVAILABLE'
          });
        }

        // Check variant stock
        if (item.variantId && product.variants) {
          const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());
          if (!variant || variant.stock === 0 || variant.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `${(item.productId as any).productName} (Size: ${item.size}) is out of stock`,
              code: 'OUT_OF_STOCK'
            });
          }
        }
      } catch (itemError: any) {
        console.error('Error validating item:', itemError);
        return res.status(400).json({
          success: false,
          message: 'Error validating order items',
          code: 'VALIDATION_ERROR'
        });
      }
    }

    console.log(' All items validated for retry');

    // Recalculate final total (in case coupon validity has changed)
    const finalTotal = orderData.total;

    // Create new Razorpay order for retry
    const razorpayOrder = await razorpayService.createRazorpayOrder(
      `RETRY-${paymentFailure.orderNumber}`,
      finalTotal
    );

    console.log(` Razorpay order created for retry: ${razorpayOrder.id}`);

    // Same server-side snapshot as the first attempt, with retryOrderId set so
    // verification knows it is paying for an order row that already exists
    // rather than creating a new one.
    await PendingOrder.create({
      razorpayOrderId: razorpayOrder.id,
      tempOrderId: `RETRY-${paymentFailure.orderNumber}`,
      retryOrderId: paymentFailure.orderId,
      userId,
      deliveryAddressId: orderData.deliveryAddressId,
      addressIndex: orderData.addressIndex,
      cart: orderData.items,
      totals: {
        subtotal: orderData.subtotal,
        totalDiscount: orderData.totalDiscount,
        amountAfterDiscount: orderData.subtotal - orderData.totalDiscount,
        shipping: orderData.shipping,
        totalItemCount: orderData.totalItemCount
      },
      couponDiscount: orderData.couponDiscount,
      appliedCouponId: orderData.appliedCouponId,
      amount: finalTotal
    });

    return res.json({
      success: true,
      message: 'Razorpay order created for retry payment',
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(finalTotal * 100),
        currency: 'INR',
        userName: req.user?.name || 'User',
        userEmail: req.user?.email || '',
        userPhone: req.user?.phone || '',
        keyId: process.env.RAZORPAY_KEY_ID,
        description: `Retry payment for ${paymentFailure.orderNumber}`
      }
    });

  } catch (error: any) {
    console.error('Error creating Razorpay order for retry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order for retry',
      code: 'RAZORPAY_ORDER_FAILED',
      error: error.message
    });
  }
};

const verifyRetryRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    console.log(' Verifying Razorpay retry payment...');

    // Step 1: Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error(' Signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed',
        code: 'SIGNATURE_VERIFICATION_FAILED'
      });
    }

    console.log(' Signature verified');

    const paymentFailure = await failureByRazorpayOrder(userId, razorpayOrderId);

    if (!paymentFailure || !paymentFailure.orderId) {
      return res.status(400).json({
        success: false,
        message: 'No failed order found for retry',
        code: 'NO_FAILED_ORDER'
      });
    }

    console.log(' Processing retry payment for order:', paymentFailure.orderId);

    try {
      // Step 2: Deduct stock for retry payment (NOT deducted during initial failure)
      try {
        await deductStock(paymentFailure.orderData!.items);
        console.log(' Stock deducted for retry payment');
      } catch (stockError: any) {
        console.error(' Error deducting stock on retry:', stockError);
        throw new Error(`Stock deduction failed on retry: ${stockError.message}`);
      }

      if (paymentFailure.orderData!.appliedCouponId) {
        try {
          await increaseCouponUsage(String(paymentFailure.orderData!.appliedCouponId), String(userId), String(paymentFailure.orderId));
          console.log('Coupon usage updated for retry payment');
        } catch (couponError: any) {
          console.error('Error updating coupon usage on retry:', couponError);
          throw new Error(`Coupon update failed on retry: ${couponError.message}`);
        }
      }

      const updateResult = await Order.updateOne(
        { _id: paymentFailure.orderId },
        {
          $set: {
            paymentStatus: PAYMENT_STATUS.COMPLETED,
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: razorpayPaymentId,
            razorpaySignature: razorpaySignature,
            status: ORDER_STATUS.PROCESSING,
            updatedAt: new Date()
          },
          $push: {
            statusHistory: {
              status: ORDER_STATUS.PROCESSING,
              updatedAt: new Date(),
              notes: 'Payment successful - Order confirmed (Retry Payment)'
            }
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        throw new Error('Order not found for retry');
      }

      await Order.updateOne(
        { _id: paymentFailure.orderId },
        {
          $set: {
            'items.$[].status': ORDER_STATUS.PROCESSING,
            'items.$[].paymentStatus': PAYMENT_STATUS.COMPLETED
          },
          $push: {
            'items.$[].statusHistory': {
              status: ORDER_STATUS.PROCESSING,
              updatedAt: new Date(),
              notes: 'Payment successful - Order confirmed (Retry Payment)'
            }
          }
        }
      );

      const order = await Order.findById(paymentFailure.orderId);
      console.log(`Retry payment successful. Order updated: ${order!.orderId}`);

      try {
        let userCart = await Cart.findOne({ user: userId });
        if (!userCart) {
          userCart = await Cart.findOne({ userId: userId });
        }

        if (userCart) {
          userCart.items = [];
          (userCart as any).totalItems = 0; // no-op: not a schema path
          (userCart as any).totalPrice = 0; // no-op: not a schema path
          await userCart.save();
          console.log('Cart cleared after successful retry payment');
        }
      } catch (cartError: any) {
        console.error('Error clearing cart:', cartError);
      }

      await clearAppliedCoupon(userId);

      return res.json({
        success: true,
        message: 'Retry payment successful',
        data: {
          redirectUrl: `/checkout/order-success/${order!.orderId}`,
          orderId: String(order!._id),
          orderNumber: order!.orderId
        }
      });

    } catch (processingError: any) {
      console.error('Error processing retry payment:', processingError);

      console.log('Restoring stock and coupon on retry payment error...');

      try {
        await restoreStock(paymentFailure.orderData!.items);
        console.log('Stock restored after retry payment error');
      } catch (restoreError: any) {
        console.error('Error restoring stock:', restoreError);
      }

      if (paymentFailure.orderData!.appliedCouponId) {
        try {
          await decreaseCouponUsage(String(paymentFailure.orderData!.appliedCouponId), String(userId), String(paymentFailure.orderId));
          console.log('Coupon usage restored after retry payment error');
        } catch (couponRestoreError: any) {
          console.error('Error restoring coupon usage:', couponRestoreError);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error processing retry payment',
        code: 'RETRY_PROCESSING_ERROR',
        error: processingError.message
      });
    }

  } catch (error: any) {
    console.error('Error verifying retry payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying retry payment',
      code: 'RETRY_VERIFICATION_ERROR',
      error: error.message
    });
  }
};

const handleRetryPaymentFailure = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const { razorpayOrderId, error } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const paymentFailure = await failureByRazorpayOrder(userId, razorpayOrderId);

    if (!paymentFailure) {
      return res.status(400).json({
        success: false,
        message: 'No failed order found',
        code: 'NO_FAILED_ORDER'
      });
    }

    console.log('Retry payment also failed for order:', paymentFailure.orderId);

    try {
      const updateResult = await Order.findByIdAndUpdate(
        paymentFailure.orderId,
        {
          $set: {
            paymentStatus: PAYMENT_STATUS.FAILED,
            status: ORDER_STATUS.FAILED,
            updatedAt: new Date()
          },
          $push: {
            statusHistory: {
              status: ORDER_STATUS.FAILED,
              updatedAt: new Date(),
              notes: `Retry payment failed: ${error?.description || 'Payment processing failed'} - Order marked as failed`
            },
            'items.$[].statusHistory': {
              status: ORDER_STATUS.FAILED,
              updatedAt: new Date(),
              notes: `Retry payment failed: ${error?.description || 'Payment processing failed'}`
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        });
      }

      await Order.updateOne(
        { _id: paymentFailure.orderId },
        {
          $set: {
            'items.$[].status': ORDER_STATUS.FAILED,
            'items.$[].paymentStatus': PAYMENT_STATUS.FAILED
          }
        }
      );

      console.log('Order marked as FAILED - No more retry attempts allowed');
      console.log('Stock NOT deducted - Order failed');
      console.log('Coupon usage NOT updated - Order failed');


      return res.json({
        success: true,
        message: 'Order marked as failed. Please place a new order.',
        data: {
          redirectUrl: `/checkout/order-failure/${paymentFailure.orderNumber}`,
          orderId: paymentFailure.orderId,
          orderNumber: paymentFailure.orderNumber,
          canRetry: false
        }
      });

    } catch (updateError: any) {
      console.error('Error updating order on retry failure:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Error processing retry payment failure',
        code: 'UPDATE_ERROR',
        error: updateError.message
      });
    }

  } catch (error: any) {
    console.error('Error handling retry payment failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Error handling retry payment failure',
      code: 'RETRY_FAILURE_ERROR',
      error: error.message
    });
  }
};

const handleWalletPayment = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const heldCoupon = await getAppliedCoupon(userId);
    const { deliveryAddressId, addressIndex } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!deliveryAddressId || addressIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const addressDoc = await Address.findById(deliveryAddressId).lean();

    if (!addressDoc) {
      return res.status(400).json({
        success: false,
        message: 'Selected delivery address not found. Please select a valid address.',
        code: 'INVALID_DELIVERY_ADDRESS'
      });
    }

    const parsedAddressIndex = parseInt(addressIndex);
    if (!addressDoc.address || !Array.isArray(addressDoc.address) || !addressDoc.address[parsedAddressIndex]) {
      return res.status(400).json({
        success: false,
        message: 'Selected address is invalid or has been removed',
        code: 'ADDRESS_NOT_FOUND'
      });
    }

    console.log(`Delivery address validated: ${addressDoc.address[parsedAddressIndex].name || 'N/A'}`);
    console.log('Processing wallet payment...');

    // Step 1: Fetch and validate cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category', select: 'name isActive isDeleted' },
          { path: 'brand', select: 'name isActive isDeleted' }
        ]
      });

    if (!cart || !cart!.items || cart!.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
        code: 'EMPTY_CART'
      });
    }

    const totals = calculateOrderTotals(cart!.items);
    let couponDiscount = 0;
    let appliedCouponId = null;

    if (heldCoupon) {
      try {
        const coupon = await Coupon.findById(heldCoupon.couponId);

        if (!coupon || !coupon.isActive) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Applied coupon is no longer valid',
            code: 'INVALID_COUPON'
          });
        }

        const now = new Date();
        if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon has expired',
            code: 'COUPON_EXPIRED'
          });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
            code: 'COUPON_LIMIT_REACHED'
          });
        }

        const userUsageCount = coupon.usedBy.filter(
          usage => usage.user.toString() === userId!.toString()
        ).length;

        if (coupon.userLimit && userUsageCount >= coupon.userLimit) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: 'You have reached the coupon usage limit',
            code: 'USER_COUPON_LIMIT_REACHED'
          });
        }

        if (coupon.minimumOrderValue && totals.total < coupon.minimumOrderValue) {
          await clearAppliedCoupon(userId);
          return res.status(400).json({
            success: false,
            message: `Minimum order value of ₹${coupon.minimumOrderValue} required`,
            code: 'MIN_ORDER_VALUE_NOT_MET'
          });
        }

        couponDiscount = heldCoupon.discountAmount || 0;
        appliedCouponId = heldCoupon.couponId;
        console.log(`Coupon validated: ${coupon.code} (₹${couponDiscount} off)`);

      } catch (couponError: any) {
        console.error('Error validating coupon:', couponError);
        await clearAppliedCoupon(userId);
        return res.status(400).json({
          success: false,
          message: 'Error validating coupon',
          code: 'COUPON_VALIDATION_ERROR'
        });
      }
    }

    const finalTotal = Math.max(0, totals.total - couponDiscount);

    let wallet;
    try {
      wallet = await walletService.getOrCreateWallet(userId!);
    } catch (walletError: any) {
      console.error('Error fetching wallet:', walletError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch wallet balance',
        code: 'WALLET_FETCH_ERROR'
      });
    }

    if (!wallet || wallet.balance < finalTotal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Required: ₹${finalTotal}, Available: ₹${wallet?.balance || 0}`,
        code: 'INSUFFICIENT_BALANCE',
        data: {
          required: finalTotal,
          available: wallet?.balance || 0
        }
      });
    }

    console.log(`Wallet balance verified: ₹${wallet.balance} (Required: ₹${finalTotal})`);

    const stockIssues: any[] = [];
    for (const item of cart!.items) {
      const productName = (item.productId as any)?.productName || 'Unknown Product';

      const availabilityCheck = validateProductAvailability(item.productId);
      if (!availabilityCheck.isValid) {
        stockIssues.push({
          productName,
          size: item.size,
          quantity: item.quantity,
          error: availabilityCheck.reason
        });
        continue;
      }

      if (item.variantId) {
        const stockCheck = validateVariantStock(item.productId, item.variantId, item.quantity);
        if (!stockCheck.isValid) {
          stockIssues.push({
            productName,
            size: item.size,
            quantity: item.quantity,
            availableStock: stockCheck.availableStock,
            error: stockCheck.reason
          });
        }
      }
    }

    if (stockIssues.length > 0) {
      const errorMessages = stockIssues.map((issue, index) =>
        `${index + 1}. ${issue.productName} (Size: ${issue.size}) \n ${issue.error}`
      );

      return res.status(400).json({
        success: false,
        message: 'Some items have stock issues:\n\n' + errorMessages.join('\n\n'),
        code: 'STOCK_VALIDATION_FAILED',
        invalidItems: stockIssues
      });
    }

    console.log('All items validated for wallet payment');

    const orderItems = cart!.items.map(item => ({
      productId: (item.productId as any)._id,
      variantId: item.variantId,
      sku: item.sku,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      status: ORDER_STATUS.PROCESSING,
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      statusHistory: [{
        status: ORDER_STATUS.PROCESSING,
        updatedAt: new Date(),
        notes: 'Order placed successfully with wallet payment'
      }]
    }));

    try {
      await deductStock(orderItems);
      console.log('Stock deducted for wallet order');
    } catch (stockError: any) {
      console.error('Stock deduction failed:', stockError);
      return res.status(400).json({
        success: false,
        message: 'Failed to process order due to stock issues',
        error: stockError.message,
        code: 'STOCK_DEDUCTION_FAILED'
      });
    }

    const addressObjectId = new mongoose.Types.ObjectId(deliveryAddressId);

    const order = new Order({
      orderId: generateOrderId(),
      user: userId as any,
      items: orderItems,
      deliveryAddress: {
        addressId: addressObjectId as any,
        addressIndex: parsedAddressIndex
      },
      couponApplied: appliedCouponId as any,
      couponDiscount: Math.round(couponDiscount),
      couponCode: heldCoupon?.code || null,
      paymentMethod: 'wallet',
      paymentStatus: PAYMENT_STATUS.COMPLETED,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      amountAfterDiscount: totals.amountAfterDiscount,
      shipping: totals.shipping,
      totalAmount: Math.round(finalTotal),
      totalItemCount: totals.totalItemCount,
      status: ORDER_STATUS.PROCESSING,
      statusHistory: [{
        status: ORDER_STATUS.PROCESSING,
        updatedAt: new Date(),
        notes: 'Order placed successfully with wallet payment'
      }]
    });

    try {
      await order!.save();
      order.orderDocumentId = order!._id;
      await order!.save();
      console.log(`Order created: ${order!.orderId}`);
    } catch (saveError: any) {
      console.error('Error saving order:', saveError);
      await restoreStock(orderItems);
      return res.status(500).json({
        success: false,
        message: 'Failed to create order',
        code: 'ORDER_CREATION_FAILED'
      });
    }

    try {
      await walletService.addTransaction(userId, {
        type: 'debit',
        amount: finalTotal,
        description: `Payment for order ${order!.orderId}`,
        paymentMethod: 'payment_for_order',
        orderId: String(order!._id),
        status: 'completed'
      });
      console.log(`Wallet debited: ₹${finalTotal}`);
    } catch (walletError: any) {
      console.error('Error debiting wallet:', walletError);
    }

    if (appliedCouponId) {
      try {
        await increaseCouponUsage(String(appliedCouponId), String(userId), String(order!._id));
        console.log(`Coupon usage updated`);
      } catch (couponError: any) {
        console.error('Error updating coupon usage:', couponError);

      }
    }

    try {
      cart!.items = [];
      await cart.save();
      console.log('Cart cleared after wallet payment');
    } catch (cartError: any) {
      console.error('Error clearing cart:', cartError);
    }

    await clearAppliedCoupon(userId);

    return res.json({
      success: true,
      message: 'Wallet payment processed successfully',
      data: {
        redirectUrl: `/checkout/order-success/${order!.orderId}`,
        orderId: String(order!._id),
        orderNumber: order!.orderId,
        amountDebited: finalTotal
      }
    });

  } catch (error: any) {
    console.error('Error processing wallet payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process wallet payment',
      code: 'WALLET_PAYMENT_ERROR',
      error: error.message
    });
  }
};






export {
  loadCheckout,
  validateCheckoutStock,
  placeOrderWithValidation,
  createRazorpayPayment,
  verifyRazorpayPayment,
  handlePaymentFailure,
  loadOrderSuccess,
  loadOrderFailure,
  loadRetryPaymentPage,
  createRazorpayOrderForRetry,
  verifyRetryRazorpayPayment,
  handleRetryPaymentFailure,
  handleWalletPayment
};
