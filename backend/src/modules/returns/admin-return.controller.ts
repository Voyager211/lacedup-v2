import type { Request, Response } from 'express';
import Return from './return.model';
import Order from '../orders/order.model';
import User from '../users/user.model';
import Product from '../catalog/product.model';
import Wallet from '../wallet/wallet.model';
import * as orderService from '../orders/order.service';
import {
  ORDER_STATUS,
  RETURN_STATUS,
  PAYMENT_STATUS,
  getCancellationReasonsArray,
  getReturnReasonsArray,
  getOrderStatusArray,
  getPaymentStatusArray
} from '../../common/constants/order.constants';

const REFUND_STATUS = {
  PENDING: 'Pending',
  PROCESSED: 'Processed', 
  FAILED: 'Failed'
}; 


const getReturnsAPI = async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 10;
    
    // Get filter parameters (keep your existing filter logic)
    const status = String(req.query.status || '');
    const refundStatus = String(req.query.refundStatus || '');
    const search = String(req.query.search || '');
    const dateRange = String(req.query.dateRange || '');
    const sortBy = String(req.query.sortBy || 'requestDate');
    const sortOrder = String(req.query.sortOrder || 'desc');

    // Build filter query (keep your existing logic)
    let filterQuery: Record<string, any> = {};
    
    if (status) {
      filterQuery.status = status;
    }
    
    if (refundStatus) {
      filterQuery.refundStatus = refundStatus;
    }

    // Search functionality
    if (search) {
      filterQuery.$or = [
        { returnId: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter (keep your existing logic)
    if (dateRange) {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }
      
      if (startDate) {
        filterQuery.requestDate = { $gte: startDate };
      }
    }

    // Build sort object
    const sortObj: Record<string, any> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get returns with pagination
    const skip = (page - 1) * limit;
    
    const returns = await Return.find(filterQuery)
      .populate({
        path: 'userId',
        select: 'name email'
      })
      .populate({
        path: 'productId',
        select: 'productName mainImage'
      })
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalReturns = await Return.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalReturns / limit);


    // Get statistics
    const [pendingReturns, approvedReturns, totalRefundAmount] = await Promise.all([
      Return.countDocuments({ status: RETURN_STATUS.PENDING }),
      Return.countDocuments({ status: RETURN_STATUS.APPROVED }),
      Return.aggregate([
        { $match: { status: { $in: [RETURN_STATUS.APPROVED, RETURN_STATUS.COMPLETED] } } },
        { $group: { _id: null, total: { $sum: '$refundAmount' } } }
      ])
    ]);

    //  FIXED: Match the orders API response structure
    res.json({
      success: true,
      data: {
        returns,
        currentPage: page,
        totalPages,
        totalReturns,
        pendingReturns,
        approvedReturns,
        totalRefundAmount: totalRefundAmount[0]?.total || 0,
        filters: {
          status,
          refundStatus,
          search,
          dateRange,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching returns API:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching returns'
    });
  }
};


// Approve return request
const approveReturn = async (req: Request, res: Response) => {
  try {
    const returnId = String(req.params.returnId);
    const { refundAmount, notes } = req.body;

    // Use OrderService to approve return - handles everything automatically
    const result = await orderService.approveItemReturn(
      returnId,
      String(req.user?._id || 'admin'),
      refundAmount // Optional custom refund amount
    );

    res.json({
      success: true,
      message: result.message,
      return: {
        returnId: result.returnRequest.returnId,
        status: result.returnRequest.status,
        refundAmount: result.refundAmount
      }
    });

  } catch (error: any) {
    console.error('Error approving return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving return request'
    });
  }
};


// Approving bulk order returns
const approveOrderReturn = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    // Use OrderService to approve all returns for the order
    const result = await orderService.approveOrderReturn(
      orderId,
      String(req.user?._id || 'admin')
    );

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        itemsAffected: result.itemsAffected,
        totalRefundAmount: result.totalRefundAmount
      }
    });

  } catch (error: any) {
    console.error('Error approving order return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving order return'
    });
  }
};

// Reject return request
const rejectReturn = async (req: Request, res: Response) => {
  try {
    const returnId = String(req.params.returnId);
    const { rejectionReason } = req.body;

    //Simple validation for rejection reason (admin-provided text)
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rejection reason'
      });
    }

    
    // Rejection reasons are admin-provided free text, not from RETURN_REASONS enum
    // const validReasons = getReturnReasonsArray();
    // if (!validReasons.includes(rejectionReason)) { ... }

    // Use OrderService to reject return
    const result = await orderService.rejectItemReturn(
      returnId,
      String(req.user?._id || 'admin'),
      rejectionReason
    );

    res.json({
      success: true,
      message: result.message,
      return: {
        returnId: result.returnRequest.returnId,
        status: result.returnRequest.status,        
        rejectionReason: result.returnRequest.rejectionReason
      }
    });

  } catch (error: any) {
    console.error('Error rejecting return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting return request'
    });
  }
};



//Reject all return requests for an order
const rejectOrderReturn = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { rejectionReason } = req.body;

    // Simple validation for rejection reason (admin-provided text)
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rejection reason'
      });
    }


    // Use OrderService to reject all returns for the order
    const result = await orderService.rejectOrderReturn(
      orderId,
      String(req.user?._id || 'admin'),
      rejectionReason
    );

    res.json({
      success: true,
      message: result.message,
      order: {
        orderId: result.order.orderId,
        status: result.order.status,
        itemsAffected: result.itemsAffected
      }
    });

  } catch (error: any) {
    console.error('Error rejecting order return:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting order return'
    });
  }
};


// Get return statistics for dashboard
const getReturnStatistics = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await Promise.all([
      // Today's returns
      Return.countDocuments({
        requestDate: { $gte: startOfDay }
      }),
      
      // This week's returns
      Return.countDocuments({
        requestDate: { $gte: startOfWeek }
      }),
      
      // This month's returns
      Return.countDocuments({
        requestDate: { $gte: startOfMonth }
      }),
      
      // Total returns
      Return.countDocuments(),
      
      // Status distribution
      Return.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      //Refund statistics using enum constants
      Return.aggregate([
        {
          $match: { status: { $in: [RETURN_STATUS.APPROVED, RETURN_STATUS.COMPLETED] } }
        },
        {
          $group: {
            _id: null,
            totalRefundAmount: { $sum: '$refundAmount' },
            averageRefundAmount: { $avg: '$refundAmount' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      statistics: {
        todayReturns: stats[0],
        weekReturns: stats[1],
        monthReturns: stats[2],
        totalReturns: stats[3],
        statusDistribution: stats[4],
        refundStats: stats[5][0] || { totalRefundAmount: 0, averageRefundAmount: 0 }
      }
    });

  } catch (error: any) {
    console.error('Error fetching return statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching return statistics'
    });
  }
};


// Export returns data (CSV)
const exportReturns = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let filterQuery: Record<string, any> = {};
    
    if (startDate && endDate) {
      filterQuery.requestDate = {
        $gte: new Date(String(startDate)),
        $lte: new Date(String(endDate))
      };
    }
    
    if (status) {
      filterQuery.status = status;
    }

    const returns = await Return.find(filterQuery)
      .populate('userId', 'name email')
      .populate('productId', 'productName')
      .sort({ requestDate: -1 })
      .lean();

    // Generate CSV content
    const csvHeaders = [
      'Return ID',
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Product Name',
      'Size',
      'Quantity',
      'Return Amount',
      'Refund Amount',
      'Request Date',
      'Status',
      'Refund Status',
      'Reason'
    ];

    let csvContent = csvHeaders.join(',') + '\n';

    returns.forEach(returnItem => {
      const row = [
        returnItem.returnId,
        returnItem.orderId,
        (returnItem.userId as any)?.name || 'N/A',
        (returnItem.userId as any)?.email || 'N/A',
        returnItem.productName,
        returnItem.size,
        returnItem.quantity,
        returnItem.totalPrice,
        returnItem.refundAmount || 0,
        new Date(returnItem.requestDate).toLocaleDateString(),
        returnItem.status,
        returnItem.refundStatus,
        `"${returnItem.reason.replace(/"/g, '""')}"` // Escape quotes in reason
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=returns-export.csv');
    res.send(csvContent);

  } catch (error: any) {
    console.error('Error exporting returns:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting returns'
    });
  }
};


export {
  getReturnsAPI,
  approveReturn,
  approveOrderReturn,
  rejectReturn,
  rejectOrderReturn,
  getReturnStatistics,
  exportReturns,
  
}