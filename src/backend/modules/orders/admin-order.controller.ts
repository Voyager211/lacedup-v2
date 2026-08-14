import type { Request, Response } from 'express';
import Order from './order.model';
import User from '../users/user.model';
import Product from '../catalog/product.model';
import * as orderService from './order.service';
import {
  ORDER_STATUS,
  PAYMENT_STATUS, 
  CANCELLATION_REASONS,
  RETURN_REASONS,
  getOrderStatusArray,
  getPaymentStatusArray,
  getCancellationReasonsArray,
  getReturnReasonsArray
} from '../../common/constants/order.constants';
import { getPagination } from '../../common/utils/pagination.util';


const validateTransitionAndGetOrder = async (orderId: string, newStatus: any, isItem = false, itemId = null) => {
  const order: any = await Order.findOne({ orderId });
  if (!order) {
    throw new Error('Order not found');
  }
  
  let currentStatus: any;
  if (isItem) {
    const item = order.items.id(itemId);
    if (!item) throw new Error('Item not found');
    currentStatus = item.status;
  } else {
    currentStatus = order.status;
  }
  
  const { isValidStatusTransition, getValidTransitions } = require('./order.service');
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    const validTransitions = getValidTransitions(currentStatus);
    throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${validTransitions.join(', ')}`);
  }
  
  return { order, currentStatus };
};

const getStatusColor = (status: any) => {
  const colorMap: Record<string, any> = {
    'Pending': 'warning',
    'Processing': 'info',
    'Shipped': 'primary',
    'Delivered': 'success',
    'Processing Return': 'warning',
    'Returned': 'secondary',
    'Cancelled': 'danger',
    'Partially Delivered': 'primary',
    'Partially Cancelled': 'danger',
    'Partially Returned': 'secondary'
  };
  return colorMap[status] || 'secondary';
};

const getPaymentStatusColor = (status: any) => {
  const colorMap: Record<string, any> = {
    'Pending': 'warning',
    'Completed': 'success',
    'Failed': 'danger',
    'Refunded': 'info',
    'Cancelled': 'secondary',
    'Partially Completed': 'primary',
    'Partially Refunded': 'secondary'
  };
  return colorMap[status] || 'secondary';
};

// Helper function to build aggregation pipeline
function buildOrderItemsPipeline(filters: any) {
  const pipeline: any[] = [];
  
  console.log('🔍 Building pipeline with filters:', filters);

  // Step 1: Initial match for order-level filters ONLY (NO SEARCH HERE!)
  const orderMatch: Record<string, any> = {};
  
  if (filters.paymentMethod) {
    orderMatch.paymentMethod = filters.paymentMethod;
  }
  
  if (filters.paymentStatus) {
    orderMatch.paymentStatus = filters.paymentStatus;
  }

  //  CRITICAL FIX: Removed search from initial match!
  // Search will ONLY be applied after lookups in the enhanced search stage

  if (Object.keys(orderMatch).length > 0) {
    pipeline.push({ $match: orderMatch });
    console.log('📍 Added initial order match (no search):', orderMatch);
  }

  // Step 2: User lookup
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      as: 'user'
    }
  });
  pipeline.push({ $unwind: '$user' });

  // Step 3: Address lookup  
  pipeline.push({
    $lookup: {
      from: 'addresses',
      localField: 'deliveryAddress.addressId',
      foreignField: '_id',
      as: 'deliveryAddressDoc'
    }
  });

  // Step 4: Unwind items (this creates the flattened structure)
  pipeline.push({ $unwind: '$items' });

  // Step 5: Product lookup
  pipeline.push({
    $lookup: {
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'items.productId'
    }
  });
  pipeline.push({
    $unwind: {
      path: '$items.productId',
      preserveNullAndEmptyArrays: true
    }
  });

  //  ENHANCED SEARCH: This is now the ONLY search stage (after all lookups)
  if (filters.search && filters.search.trim() !== '') {
    //  FIX: Handle '#' prefix in order ID search
    let searchTerm = filters.search.trim();
    let orderIdSearchTerm = searchTerm.startsWith('#') ? searchTerm.substring(1) : searchTerm;
    
    const searchMatch = {
      $or: [
        { orderId: { $regex: orderIdSearchTerm, $options: 'i' } }, //  Use cleaned term for orderId
        { 'user.name': { $regex: searchTerm, $options: 'i' } },
        { 'user.email': { $regex: searchTerm, $options: 'i' } },
        { '(items.productId as any).productName': { $regex: searchTerm, $options: 'i' } },
        { 'items.sku': { $regex: searchTerm, $options: 'i' } }
      ]
    };
    
    pipeline.push({ $match: searchMatch });
    console.log('🔍 Added enhanced search match for:', searchTerm);
    console.log('🔍 OrderId search term (# stripped):', orderIdSearchTerm);
  }

  // Step 6: Item-level status filtering
  if (filters.status) {
    const statusMatch = { 'items.status': filters.status };
    pipeline.push({ $match: statusMatch });
    console.log(' Added status match:', statusMatch);
  }

  // Step 7: Project the final structure
  pipeline.push({
    $project: {
      orderId: 1,
      orderDate: '$createdAt',
      paymentMethod: 1,
      paymentStatus: 1,
      orderStatus: '$status',
      totalAmount: 1,
      user: {
        name: '$user.name',
        email: '$user.email'
      },
      deliveryAddress: {
        $cond: {
          if: { $gt: [{ $size: '$deliveryAddressDoc' }, 0] },
          then: {
            $arrayElemAt: [
              { $arrayElemAt: ['$deliveryAddressDoc.address', '$deliveryAddress.addressIndex'] },
              0
            ]
          },
          else: {
            name: 'Address not found',
            city: 'N/A',
            state: 'N/A',
            phone: 'N/A'
          }
        }
      },
      itemId: '$items._id',
      productId: '$items.productId',
      productName: {
        $ifNull: ['$(items.productId as any).productName', 'Product']
      },
      productImage: '$(items.productId as any).mainImage',
      sku: '$items.sku',
      size: '$items.size',
      quantity: '$items.quantity',
      price: '$items.price',
      totalPrice: '$items.totalPrice',
      status: { $ifNull: ['$items.status', '$status'] },
      statusHistory: { $ifNull: ['$items.statusHistory', []] },
      cancellationReason: '$items.cancellationReason',
      returnReason: '$items.returnReason',
      cancellationDate: '$items.cancellationDate',
      returnRequestDate: '$items.returnRequestDate'
    }
  });

  // Step 8: Sorting
  const sortObj: Record<string, any> = {};
  sortObj[filters.sortBy === 'createdAt' ? 'orderDate' : filters.sortBy] = 
    filters.sortOrder === 'desc' ? -1 : 1;
  pipeline.push({ $sort: sortObj });

  console.log(' Final pipeline length:', pipeline.length);
  console.log('🎯 Search will now work for customer names, product names, order IDs, and SKUs!');
  return pipeline;
}


// Helper functions for statistics
async function getOrderItemStatistics() {
  const stats = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.status',
        count: { $sum: 1 }
      }
    }
  ]);
  return stats;
}

async function getTodayOrdersCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await Order.countDocuments({
    createdAt: { $gte: today }
  });
}


const getFilteredOrders = async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    const status = req.query.status as string | undefined;
    const paymentMethod = req.query.paymentMethod as string | undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = String(req.query.sortBy || 'createdAt');
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    //  BUILD AGGREGATION PIPELINE FOR PROPER SEARCH
    const pipeline: any[] = [];

    // Step 1: Initial match for order-level filters
    const orderMatch: Record<string, any> = {};
    if (paymentMethod) orderMatch.paymentMethod = paymentMethod;
    if (paymentStatus) orderMatch.paymentStatus = paymentStatus;
    if (status) orderMatch['items.status'] = status;

    if (Object.keys(orderMatch).length > 0) {
      pipeline.push({ $match: orderMatch });
    }

    // Step 2: Lookup user for search
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDoc'
      }
    });
    pipeline.push({ 
      $unwind: { 
        path: '$userDoc', 
        preserveNullAndEmptyArrays: true 
      } 
    });

    // Step 3: Lookup delivery address
    pipeline.push({
      $lookup: {
        from: 'addresses',
        localField: 'deliveryAddress.addressId',
        foreignField: '_id',
        as: 'deliveryAddressDoc'
      }
    });

    // Step 4: Enhanced search across multiple fields
    if (search && search.trim()) {
      const searchTerm = search.trim();
      // Handle '#' or 'ORD-' prefix for order ID search
      let orderIdSearchTerm = searchTerm;
      if (searchTerm.startsWith('#')) {
        orderIdSearchTerm = searchTerm.substring(1);
      } else if (searchTerm.startsWith('ORD-')) {
        orderIdSearchTerm = searchTerm.substring(4);
      }

      const searchMatch = {
        $or: [
          { orderId: { $regex: orderIdSearchTerm, $options: 'i' } },
          { 'userDoc.name': { $regex: searchTerm, $options: 'i' } },
          { 'userDoc.email': { $regex: searchTerm, $options: 'i' } },
          { 'userDoc.phone': { $regex: searchTerm, $options: 'i' } }
        ]
      };

      pipeline.push({ $match: searchMatch });
    }

    // Step 5: Project fields to match expected structure
    pipeline.push({
      $project: {
        _id: 1,
        orderId: 1,
        user: '$userDoc._id',
        userName: '$userDoc.name',
        userEmail: '$userDoc.email',
        userPhone: '$userDoc.phone',
        items: 1,
        totalAmount: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        status: 1,
        deliveryAddress: 1,
        deliveryAddressDoc: 1,
        createdAt: 1,
        updatedAt: 1,
        statusHistory: 1
      }
    });

    // Step 6: Sort
    const sortField = sortBy === 'createdAt' ? 'createdAt' : sortBy;
    pipeline.push({ $sort: { [sortField]: sortOrder } });

    //  Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    //  Add pagination to main pipeline
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    // Execute aggregation
    const orders: any = await Order.aggregate(pipeline);

    //  Populate product details for items
    await Order.populate(orders, {
      path: 'items.productId',
      select: 'productName mainImage'
    });

    // Process orders to extract delivery address
    const processedOrders = orders.map((order: any) => {
      // Reconstruct user object
      if (order.userName) {
        order.user = {
          _id: order.user,
          name: order.userName,
          email: order.userEmail,
          phone: order.userPhone
        };
        delete order.userName;
        delete order.userEmail;
        delete order.userPhone;
      }

      // Handle delivery address
      if (order.deliveryAddress && order.deliveryAddressDoc && order.deliveryAddressDoc.length > 0) {
        const addressIndex = order.deliveryAddress.addressIndex || 0;
        const specificAddress = order.deliveryAddressDoc[0].address?.[addressIndex];
        
        if (specificAddress) {
          order.deliveryAddress = {
            ...order.deliveryAddress,
            ...specificAddress
          };
        }
      }
      delete order.deliveryAddressDoc;

      return order;
    });

    //  CALCULATE FILTERED STATISTICS
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Build base filter for statistics (reuse aggregation match stages)
    const statsBasePipeline = pipeline.slice(0, pipeline.findIndex(stage => stage.$skip || stage.$limit || stage.$sort));
    
    // Today's orders
    const todayPipeline = [
      ...statsBasePipeline,
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $count: 'total' }
    ];
    const todayResult = await Order.aggregate(todayPipeline);
    const filteredTodayOrders = todayResult[0]?.total || 0;

    // Total items count
    const itemsPipeline = [
      ...statsBasePipeline,
      { $unwind: '$items' },
      ...(status ? [{ $match: { 'items.status': status } }] : []),
      { $count: 'total' }
    ];
    const itemsResult = await Order.aggregate(itemsPipeline);
    const filteredTotalItems = itemsResult[0]?.total || 0;

    // Pending items
    const pendingPipeline = [
      ...statsBasePipeline,
      { $unwind: '$items' },
      { $match: { 'items.status': ORDER_STATUS.PENDING } },
      { $count: 'total' }
    ];
    const pendingResult = await Order.aggregate(pendingPipeline);
    const filteredPendingItems = pendingResult[0]?.total || 0;

    // Status distribution
    const statsPipeline = [
      ...statsBasePipeline,
      { $unwind: '$items' },
      ...(status ? [{ $match: { 'items.status': status } }] : []),
      {
        $group: {
          _id: '$items.status',
          count: { $sum: 1 }
        }
      }
    ];
    const filteredOrderStats = await Order.aggregate(statsPipeline);

    //  RESPONSE with filtered statistics
    res.json({
      success: true,
      data: {
        orders: processedOrders,
        currentPage: page,
        totalPages: totalPages,
        itemsPerPage: limit,
        totalCount: totalCount,
        filteredOrdersCount: totalCount,
        statistics: {
          todayOrders: filteredTodayOrders,
          totalOrders: totalCount,
          totalItems: filteredTotalItems,
          pendingItems: filteredPendingItems,
          orderStats: filteredOrderStats
        }
      },
      filters: { 
        status, 
        paymentMethod, 
        paymentStatus, 
        search, 
        sortBy, 
        sortOrder: sortOrder === -1 ? 'desc' : 'asc' 
      }
    });

  } catch (error: any) {
    console.error('Error in getFilteredOrders:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading orders',
      debug: error.message
    });
  }
};



// Get allowed status transitions based on current status
const getAllowedStatusTransitions = (currentStatus: any) => {
  return orderService.getValidTransitions(currentStatus);
};





const getOrderDetailsJSON = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order: any = await Order.findOne({ orderId })
      .populate({
        path: 'user',
        select: 'name email phone profilePhoto'
      })
      .populate({
        path: 'items.productId',
        select: 'productName mainImage subImages regularPrice salePrice category brand'
      })
      .populate({
        path: 'deliveryAddress.addressId',
        select: 'address'
      })
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Extract the specific address from the address array using addressIndex
    if (order.deliveryAddress && order.deliveryAddress.addressId && (order.deliveryAddress.addressId as any).address) {
      const addressIndex = order.deliveryAddress.addressIndex;
      const specificAddress = (order.deliveryAddress.addressId as any).address[addressIndex];
      
      if (specificAddress) {
        order.deliveryAddress = {
          ...order.deliveryAddress,
          ...specificAddress
        };
      }
    }

    //  NEW: Get valid transitions for current order status
    const validTransitions = await orderService.getValidTransitions(order.status);


    //  Return JSON response (not HTML)
    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        user: order.user,
        deliveryAddress: order.deliveryAddress,
        items: order.items.map((item: any) => ({
          _id: item._id,
          productId: item.productId,
          productName: item.productId ? (item.productId as any).productName : 'Product',
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          status: item.status,
          paymentStatus: item.paymentStatus
        })),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      },
      validTransitions: validTransitions //  Include valid transitions
    });

  } catch (error: any) {
    console.error('Error fetching order details JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading order details'
    });
  }
};

// Get allowed status transitions for a specific order
const getAllowedTransitions = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order: any = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const allowedTransitions = getAllowedStatusTransitions(order.status);

    res.json({
      success: true,
      currentStatus: order.status,
      allowedTransitions
    });

  } catch (error: any) {
    console.error('Error fetching allowed transitions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching allowed transitions'
    });
  }
};

// updateOrderStatus function with transition validation
const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { status, notes, action } = req.body;

    // Handle different actions
    if (action === 'cancel') {
      return cancelOrder(req, res);
    } else if (action === 'return') {
      return returnOrderRequest(req, res);
    }

    // Get current order to validate transition
    const currentOrder = await Order.findOne({ orderId });
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate status transition using OrderService
    const { isValidStatusTransition } = require('./order.service');
    
    if (!isValidStatusTransition(currentOrder.status, status)) {
      const { getValidTransitions } = require('./order.service');
      const validTransitions = getValidTransitions(currentOrder.status);
      
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentOrder.status}' to '${status}'. Valid transitions: ${validTransitions.join(', ')}`
      });
    }

    // Regular status update with validation passed
    const result = await orderService.updateOrderStatus(
      orderId, 
      status, 
      notes || `Status updated to ${status} by admin`,
      'admin'
    );

    //  ENHANCED: Comprehensive response with all information needed for UI updates
    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus, //  Order-level payment status
        paymentMethod: result.order.paymentMethod, //  Helpful for frontend logic
        totalAmount: result.order.totalAmount,
        //  ENHANCED: Complete item information for real-time badge updates
        items: result.order.items.map((item: any) => ({
          _id: item._id,
          productName: item.productId ? (item.productId as any).productName : 'Product',
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          status: item.status,                    //  Updated item status
          paymentStatus: item.paymentStatus,      //  Updated item payment status
          //  Additional info for debugging/logging
          previousStatus: currentOrder.items.find(ci => ci._id!.toString() === item._id!.toString())?.status,
          statusChanged: currentOrder.items.find(ci => ci._id!.toString() === item._id!.toString())?.status !== item.status
        })),
        //  ENHANCED: Status change summary for frontend
        changes: {
          previousOrderStatus: currentOrder.status,
          newOrderStatus: result.order.status,
          previousOrderPaymentStatus: currentOrder.paymentStatus,
          newOrderPaymentStatus: result.order.paymentStatus,
          orderStatusChanged: currentOrder.status !== result.order.status,
          orderPaymentStatusChanged: currentOrder.paymentStatus !== result.order.paymentStatus,
          totalItemsUpdated: result.order.items.length,
          itemsWithPaymentChanges: result.order.items.filter((item: any) => {
            const originalItem = currentOrder.items.find(ci => ci._id!.toString() === item._id!.toString());
            return originalItem && originalItem.paymentStatus !== item.paymentStatus;
          }).length
        },
        //  ENHANCED: Metadata for frontend processing
        updatedAt: result.order.updatedAt,
        updatedBy: 'admin'
      }
    });

  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating order status',
      //  ENHANCED: Error context for debugging
      context: {
        orderId: req.params.orderId,
        requestedStatus: req.body.status,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// update item status
const updateItemStatus = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const itemId = String(req.params.itemId);
    const { status, notes } = req.body;

    console.log('🔍 ITEM STATUS UPDATE REQUEST:', {
      orderId,
      itemId,
      newStatus: status,
      notes
    });

    // Validate required parameters
    if (!status || status.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Status parameter is required'
      });
    }

    if (!itemId || itemId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
    }

    // Get current order to validate item and transition
    const currentOrder = await Order.findOne({ orderId });
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify item exists
    const currentItem = currentOrder.items.id(itemId);
    if (!currentItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in order'
      });
    }

    // Validate status transition using OrderService
    const { isValidStatusTransition, getValidTransitions } = require('./order.service');
    
    if (!isValidStatusTransition(currentItem.status, status)) {
      const validTransitions = getValidTransitions(currentItem.status);
      
      console.log(' Invalid item transition:', {
        currentStatus: currentItem.status,
        requestedStatus: status,
        validTransitions: validTransitions
      });
      
      return res.status(400).json({
        success: false,
        message: `Invalid item status transition from '${currentItem.status}' to '${status}'. Valid transitions: ${validTransitions.join(', ')}`
      });
    }

    // Call OrderService to update item status
    const result = await orderService.updateItemStatus(
      orderId,
      itemId,
      status,
      notes || `Item status updated to ${status} by admin`,
      'admin'
    );

    //  ENHANCED: Comprehensive response with all information needed for UI updates
    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        paymentMethod: result.order.paymentMethod,
        totalAmount: result.order.totalAmount,
        //  ENHANCED: Complete item information for real-time badge updates
        items: result.order.items.map((item: any) => ({
          _id: item._id,
          productName: item.productId ? (item.productId as any).productName : 'Product',
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          status: item.status,
          paymentStatus: item.paymentStatus,
          //  Mark which item was updated
          wasUpdated: item._id!.toString() === itemId
        })),
        //  ENHANCED: Update summary for frontend
        changes: {
          updatedItemId: itemId,
          previousItemStatus: result.itemUpdated.previousStatus,
          newItemStatus: result.itemUpdated.newStatus,
          previousItemPaymentStatus: result.itemUpdated.previousPaymentStatus,
          newItemPaymentStatus: result.itemUpdated.newPaymentStatus,
          orderStatus: result.order.status,
          orderPaymentStatus: result.order.paymentStatus
        },
        //  ENHANCED: Metadata for frontend processing
        updatedAt: result.order.updatedAt,
        updatedBy: 'admin'
      }
    });

  } catch (error: any) {
    console.error(' Error updating item status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update item status',
      //  ENHANCED: Error context for debugging
      context: {
        orderId: req.params.orderId,
        itemId: req.params.itemId,
        requestedStatus: req.body.status,
        timestamp: new Date().toISOString()
      }
    });
  }
};


// Update payment status
// exports.updatePaymentStatus = async (req: Request, res: Response) => {
//   try {
//     const orderId = String(req.params.orderId);
//     const { paymentStatus } = req.body;

//     const validPaymentStatuses = getPaymentStatusArray();
    
//     if (!validPaymentStatuses.includes(paymentStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid payment status'
//       });
//     }

//     const order: any = await Order.findOne({ orderId });
    
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: 'Order not found'
//       });
//     }

//     order.paymentStatus = paymentStatus;
//     await order.save();

//     res.json({
//       success: true,
//       message: `Payment status updated to ${paymentStatus}`,
//       order: {
//         orderId: order.orderId,
//         status: order.status,
//         paymentStatus: order.paymentStatus
//       }
//     });

//   } catch (error: any) {
//     console.error('Error updating payment status:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error updating payment status'
//     });
//   }
// };




// Cancel individual item
const cancelItem = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const itemId = String(req.params.itemId);
    const { reason } = req.body;

    // Verify order exists first
    const order: any = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get item details before cancellation for stock restoration
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Use admin function (no reason validation required)
    const result = await orderService.adminCancelItem(
      orderId,
      itemId,
      reason || 'Item cancelled by admin',
      'admin'
    );

    // Restore stock for cancelled item
    const product = await Product.findById(item.productId);
    if (product) {
      const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());
      if (variant) {
        variant.stock += item.quantity;
        await product.save();
      }
    }

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        items: result.order.items.map((item: any) => ({
          _id: item._id,
          status: item.status,
          paymentStatus: item.paymentStatus
        }))
      }
    });

  } catch (error: any) {
    console.error('Error cancelling item:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling item'
    });
  }
};

// Cancel entire order using admin function
const cancelOrder = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { reason } = req.body;

    // Use admin function (no reason validation required)
    const result = await orderService.adminCancelOrder(
      orderId,
      reason || 'Order cancelled by admin',
      'admin'
    );

    // Restore stock for all cancelled items
    for (const item of result.order.items) {
      if (item.status === ORDER_STATUS.CANCELLED) {
        const product = await Product.findById(item.productId);
        if (product) {
          const variant = product.variants.find(v => v._id!.toString() === item.variantId.toString());
          if (variant) {
            variant.stock += item.quantity;
            await product.save();
          }
        }
      }
    }

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        items: result.order.items.map((item: any) => ({
          _id: item._id,
          status: item.status,
          paymentStatus: item.paymentStatus
        }))
      }
    });

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling order'
    });
  }
};

// Create return request for entire order using admin function
const returnOrderRequest = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { reason } = req.body;

    //  UPDATED: Use admin return request function (no reason validation required)
    const result = await orderService.adminOrderReturnRequest(
      orderId,
      reason || 'Return requested by admin'
    );

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        itemsAffected: result.itemsAffected
      },
      returnRequests: result.returnRequests.map((req: any) => ({
        returnId: req.returnId,
        status: req.status,
        reason: req.reason
      }))
    });

  } catch (error: any) {
    console.error('Error creating order return request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating order return request'
    });
  }
};

// Create return request for individual item using admin function
const returnItemRequest = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const itemId = String(req.params.itemId);
    const { reason } = req.body;

    // Use admin return request function (no reason validation required)
    const result = await orderService.adminItemReturnRequest(
      orderId,
      itemId,
      reason || 'Return requested by admin'
    );

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus
      },
      returnRequest: {
        returnId: result.returnRequest.returnId,
        status: result.returnRequest.status,
        reason: result.returnRequest.reason
      }
    });

  } catch (error: any) {
    console.error('Error creating item return request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating item return request'
    });
  }
};




// Get order statistics for dashboard
const getOrderStatistics = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await Promise.all([
      // Today's orders
      Order.countDocuments({
        createdAt: { $gte: startOfDay }
      }),
      
      // This week's orders
      Order.countDocuments({
        createdAt: { $gte: startOfWeek }
      }),
      
      // This month's orders
      Order.countDocuments({
        createdAt: { $gte: startOfMonth }
      }),
      
      // Total orders
      Order.countDocuments(),
      
      // Revenue statistics
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            averageOrderValue: { $avg: '$totalAmount' }
          }
        }
      ]),
      
      // Status distribution
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      statistics: {
        todayOrders: stats[0],
        weekOrders: stats[1],
        monthOrders: stats[2],
        totalOrders: stats[3],
        revenue: stats[4][0] || { totalRevenue: 0, averageOrderValue: 0 },
        statusDistribution: stats[5]
      }
    });

  } catch (error: any) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics'
    });
  }
};



// Export orders data (CSV)
const exportOrders = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let filterQuery: Record<string, any> = {};
    
    if (startDate && endDate) {
      filterQuery.createdAt = {
        $gte$gte: new Date(String(startDate)),
        $lte$gte: new Date(String(endDate))
      };
    }
    
    if (status) {
      filterQuery.status = status;
    }

    const orders: any = await Order.find(filterQuery)
      .populate('user', 'name email')
      .populate('items.productId', 'productName')
      .sort({ createdAt: -1 })
      .lean();

    // Generate CSV content
    const csvHeaders = [
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Order Date',
      'Status',
      'Payment Method',
      'Payment Status',
      'Total Amount',
      'Items Count',
      'Delivery City'
    ];

    let csvContent = csvHeaders.join(',') + '\n';

    orders.forEach((order: any) => {
      const row = [
        order.orderId,
        (order.user as any)?.name || 'N/A',
        (order.user as any)?.email || 'N/A',
        new Date(order.createdAt).toLocaleDateString(),
        order.status,
        order.paymentMethod,
        order.paymentStatus,
        order.totalAmount,
        order.totalItemCount,
        order.deliveryAddress?.city || 'N/A'
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-export.csv');
    res.send(csvContent);

  } catch (error: any) {
    console.error('Error exporting orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting orders'
    });
  }
};

const getSystemStatistics = async (req: Request, res: Response) => {
  try {
    const [orderStats, todayOrders] = await Promise.all([
      getOrderItemStatistics(),
      getTodayOrdersCount()
    ]);

    const totalOrders = await Order.countDocuments();
    
    // Get total items count (all items in system)
    const totalItemsResult = await Order.aggregate([
      { $unwind: '$items' },
      { $count: 'totalItems' }
    ]);
    const totalItems = totalItemsResult[0]?.totalItems || 0;

    res.json({
      success: true,
      statistics: {
        todayOrders,
        totalOrders, 
        totalItems,
        orderStats
      }
    });

  } catch (error: any) {
    console.error('Error fetching system statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
};

// Fix payment status for cancelled order
const fixCancelledOrderPaymentStatus = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    
    const order: any = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.status !== ORDER_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Order is not cancelled'
      });
    }

    // Fix payment statuses
    const oldOrderPaymentStatus = order.paymentStatus;
    
    if (order.paymentMethod === 'cod') {
      order.paymentStatus = PAYMENT_STATUS.CANCELLED;
    } else {
      order.paymentStatus = order.paymentStatus === PAYMENT_STATUS.COMPLETED 
        ? PAYMENT_STATUS.REFUNDED 
        : PAYMENT_STATUS.CANCELLED;
    }

    order.items.forEach((item: any) => {
      if (item.status === ORDER_STATUS.CANCELLED) {
        const oldItemPaymentStatus = item.paymentStatus;
        
        if (order.paymentMethod === 'cod') {
          item.paymentStatus = PAYMENT_STATUS.CANCELLED;
        } else {
          item.paymentStatus = item.paymentStatus === PAYMENT_STATUS.COMPLETED 
            ? PAYMENT_STATUS.REFUNDED 
            : PAYMENT_STATUS.CANCELLED;
        }
      }
    });

    await order.save();

    res.json({
      success: true,
      message: 'Payment statuses fixed successfully',
      changes: {
        orderPaymentStatus: `${oldOrderPaymentStatus} → ${order.paymentStatus}`,
        itemsFixed: order.items.length
      },
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          _id: item._id,
          status: item.status,
          paymentStatus: item.paymentStatus
        }))
      }
    });

  } catch (error: any) {
    console.error('Error fixing cancelled order payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing payment status'
    });
  }
};

export {
  getOrderDetailsJSON,
  getAllowedTransitions,
  updateOrderStatus,
  updateItemStatus,
  cancelItem,
  cancelOrder,
  returnOrderRequest,
  returnItemRequest,
  getOrderStatistics,
  getFilteredOrders,
  exportOrders,
  getSystemStatistics,
  fixCancelledOrderPaymentStatus
}