const orderModel = require("../model/orderModel");
const productModel = require("../model/productModel");
const connectDB = require('../utils/connectDB');
const recommendationEngine = require('../services/recommendationEngine');

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/stats
 * @access  Admin/Restaurant
 */
const getDashboardStats = async (req, res) => {
  try {
    await connectDB();

    // Get date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    // ===============================
    // ORDER STATISTICS
    // ===============================
    const totalOrders = await orderModel.countDocuments();
    const todayOrders = await orderModel.countDocuments({
      createdAt: { $gte: today }
    });
    const weekOrders = await orderModel.countDocuments({
      createdAt: { $gte: weekAgo }
    });
    
    // Orders by status
    const ordersByStatus = await orderModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // ===============================
    // REVENUE STATISTICS
    // ===============================
    const revenueData = await orderModel.aggregate([
      {
        $match: { status: { $in: ['completed', 'delivered', 'confirmed'] } }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$items.totalPrice" },
          avgOrderValue: { $avg: { $sum: "$items.totalPrice" } }
        }
      }
    ]);

    // Today's revenue
    const todayRevenue = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: { $in: ['completed', 'delivered', 'confirmed'] }
        }
      },
      {
        $unwind: "$items"
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.totalPrice" }
        }
      }
    ]);

    // Weekly revenue
    const weekRevenue = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo },
          status: { $in: ['completed', 'delivered', 'confirmed'] }
        }
      },
      {
        $unwind: "$items"
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.totalPrice" }
        }
      }
    ]);

    // Monthly revenue
    const monthRevenue = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: monthAgo },
          status: { $in: ['completed', 'delivered', 'confirmed'] }
        }
      },
      {
        $unwind: "$items"
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.totalPrice" }
        }
      }
    ]);

    // ===============================
    // PRODUCT STATISTICS
    // ===============================
    const totalProducts = await productModel.countDocuments();
    const activeProducts = await productModel.countDocuments({ status: 'available' });
    const outOfStockProducts = await productModel.countDocuments({ status: 'out_of_stock' });
    
    // Top selling products
    const topProducts = await orderModel.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
          image: { $first: "$items.images" }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // Low stock products (from product model)
    const lowStockProducts = await productModel.find({ status: 'available' })
      .sort({ timesOrdered: 1 })
      .limit(5);

    // ===============================
    // CUSTOMER STATISTICS
    // ===============================
    const uniqueCustomers = await orderModel.distinct("customerInfo.phone");
    const totalCustomers = uniqueCustomers.length;
    
    // New customers this week
    const newCustomersThisWeek = await orderModel.aggregate([
      {
        $match: { createdAt: { $gte: weekAgo } }
      },
      {
        $group: {
          _id: "$customerInfo.phone",
          firstOrder: { $min: "$createdAt" }
        }
      },
      {
        $count: "newCustomers"
      }
    ]);

    // Repeat customers
    const repeatCustomers = await orderModel.aggregate([
      {
        $group: {
          _id: "$customerInfo.phone",
          orderCount: { $sum: 1 }
        }
      },
      {
        $match: { orderCount: { $gt: 1 } }
      },
      {
        $count: "repeatCustomers"
      }
    ]);

    // ===============================
    // DELIVERY STATISTICS
    // ===============================
    const deliveryStats = await orderModel.aggregate([
      {
        $group: {
          _id: "$customerInfo.deliveryType",
          count: { $sum: 1 }
        }
      }
    ]);

    // Average delivery time (in minutes)
    const avgDeliveryTime = await orderModel.aggregate([
      {
        $match: {
          status: "delivered",
          estimatedDeliveryTime: { $exists: true }
        }
      },
      {
        $project: {
          deliveryTime: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              60000 // Convert milliseconds to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$deliveryTime" }
        }
      }
    ]);

    // ===============================
    // CHART DATA (Daily sales for last 7 days)
    // ===============================
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const sales = await orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: date, $lt: nextDate },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            total: { $sum: "$items.totalPrice" }
          }
        }
      ]);
      
      dailySales.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: sales[0]?.total || 0,
        orders: await orderModel.countDocuments({
          createdAt: { $gte: date, $lt: nextDate }
        })
      });
    }

    // ===============================
    // RECENT ORDERS
    // ===============================
    const recentOrders = await orderModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // ===============================
    // TRENDING RECOMMENDATIONS
    // ===============================
    const trendingItems = await recommendationEngine.getTrendingItems(10);

    // ===============================
    // RESPONSE
    // ===============================
    res.status(200).json({
      success: true,
      stats: {
        orders: {
          total: totalOrders,
          today: todayOrders,
          thisWeek: weekOrders,
          byStatus: ordersByStatus
        },
        revenue: {
          total: revenueData[0]?.totalRevenue || 0,
          today: todayRevenue[0]?.revenue || 0,
          thisWeek: weekRevenue[0]?.revenue || 0,
          thisMonth: monthRevenue[0]?.revenue || 0,
          averageOrderValue: revenueData[0]?.avgOrderValue || 0
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          outOfStock: outOfStockProducts,
          topSelling: topProducts,
          lowStock: lowStockProducts
        },
        customers: {
          total: totalCustomers,
          newThisWeek: newCustomersThisWeek[0]?.newCustomers || 0,
          repeatCustomers: repeatCustomers[0]?.repeatCustomers || 0
        },
        delivery: {
          byType: deliveryStats,
          averageTimeMinutes: Math.round(avgDeliveryTime[0]?.avgTime || 0)
        },
        charts: {
          dailySales: dailySales
        },
        recentOrders: recentOrders,
        trendingItems: trendingItems
      }
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
};

/**
 * @desc    Get all orders (with filters)
 * @route   GET /api/admin/orders
 * @access  Admin/Restaurant
 */
const getAllOrders = async (req, res) => {
  try {
    await connectDB();
    
    const { status, page = 1, limit = 20, startDate, endDate, search } = req.query;
    
    let filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { "customerInfo.name": { $regex: search, $options: 'i' } },
        { "customerInfo.phone": { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await orderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await orderModel.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message
    });
  }
};

/**
 * @desc    Get single order by ID or order number
 * @route   GET /api/admin/orders/:id
 * @access  Admin/Restaurant
 */
const getOrderDetails = async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    
    const order = await orderModel.findOne({
      $or: [
        { _id: id },
        { orderNumber: id }
      ]
    }).lean();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    
    res.status(200).json({
      success: true,
      order
    });
    
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message
    });
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/admin/orders/:id/status
 * @access  Admin/Restaurant
 */
const updateOrderStatus = async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    const { status, estimatedTime, note } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }
    
    const order = await orderModel.findOne({
      $or: [
        { _id: id },
        { orderNumber: id }
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    
    order.status = status;
    
    if (estimatedTime && status === 'confirmed') {
      const deliveryTime = new Date();
      deliveryTime.setMinutes(deliveryTime.getMinutes() + estimatedTime);
      order.estimatedDeliveryTime = deliveryTime;
    }
    
    if (note) {
      order.restaurantNote = note;
    }
    
    await order.save();
    
    // Send socket notification
    const socketService = req.app.get('socketService');
    if (socketService) {
      socketService.emitOrderStatusUpdate(order.orderNumber, status);
    }
    
    res.status(200).json({
      success: true,
      message: "Order status updated",
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
    
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
};

/**
 * @desc    Get all products (for admin)
 * @route   GET /api/admin/products
 * @access  Admin/Restaurant
 */
const getAllProducts = async (req, res) => {
  try {
    await connectDB();
    
    const { category, status, page = 1, limit = 20 } = req.query;
    
    let filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await productModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await productModel.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }
};

/**
 * @desc    Get all customers
 * @route   GET /api/admin/customers
 * @access  Admin
 */
const getAllCustomers = async (req, res) => {
  try {
    await connectDB();
    
    const { search, page = 1, limit = 20 } = req.query;
    
    const pipeline = [
      {
        $group: {
          _id: "$customerInfo.phone",
          name: { $first: "$customerInfo.name" },
          email: { $first: "$customerInfo.email" },
          phone: { $first: "$customerInfo.phone" },
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.totalPrice"] }
              }
            }
          },
          firstOrder: { $min: "$createdAt" },
          lastOrder: { $max: "$createdAt" }
        }
      }
    ];
    
    if (search) {
      pipeline.unshift({
        $match: {
          $or: [
            { "customerInfo.name": { $regex: search, $options: 'i' } },
            { "customerInfo.phone": { $regex: search, $options: 'i' } },
            { "customerInfo.email": { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const customers = await orderModel.aggregate(pipeline)
      .sort({ lastOrder: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await orderModel.aggregate([
      { $group: { _id: "$customerInfo.phone" } },
      { $count: "total" }
    ]);
    
    res.status(200).json({
      success: true,
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Get all customers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message
    });
  }
};

/**
 * @desc    Get customer details with order history
 * @route   GET /api/admin/customers/:phone
 * @access  Admin
 */
const getCustomerDetails = async (req, res) => {
  try {
    await connectDB();
    
    const { phone } = req.params;
    
    const orders = await orderModel.find({ "customerInfo.phone": phone })
      .sort({ createdAt: -1 })
      .lean();
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    const customerInfo = orders[0].customerInfo;
    
    const totalSpent = orders.reduce((sum, order) => {
      const orderTotal = order.items.reduce((s, item) => s + (item.totalPrice || item.price * item.quantity), 0);
      return sum + orderTotal;
    }, 0);
    
    // Get customer preferences
    const preferences = await recommendationEngine.getCustomerPreferences({ phone });
    
    res.status(200).json({
      success: true,
      customer: {
        info: customerInfo,
        totalOrders: orders.length,
        totalSpent,
        firstOrder: orders[orders.length - 1]?.createdAt,
        lastOrder: orders[0]?.createdAt,
        orderHistory: orders,
        preferences: preferences.preferences || null
      }
    });
    
  } catch (error) {
    console.error("Get customer details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message
    });
  }
};

/**
 * @desc    Delete order (admin only)
 * @route   DELETE /api/admin/orders/:id
 * @access  Admin
 */
const deleteOrder = async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    
    const order = await orderModel.findOneAndDelete({
      $or: [
        { _id: id },
        { orderNumber: id }
      ]
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      order: {
        orderNumber: order.orderNumber,
        deletedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message
    });
  }
};

/**
 * @desc    Get sales report (export ready)
 * @route   GET /api/admin/reports/sales
 * @access  Admin
 */
const getSalesReport = async (req, res) => {
  try {
    await connectDB();
    
    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const now = new Date();
      let start = new Date();
      
      switch (period) {
        case 'week':
          start.setDate(now.getDate() - 7);
          break;
        case 'month':
          start.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          start.setFullYear(now.getFullYear() - 1);
          break;
        default:
          start.setMonth(now.getMonth() - 1);
      }
      
      dateFilter = {
        createdAt: { $gte: start, $lte: now }
      };
    }
    
    const orders = await orderModel.find({
      ...dateFilter,
      status: { $in: ['completed', 'delivered'] }
    }).lean();
    
    const totalRevenue = orders.reduce((sum, order) => {
      const orderTotal = order.items.reduce((s, item) => s + (item.totalPrice || item.price * item.quantity), 0);
      return sum + orderTotal;
    }, 0);
    
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Sales by category
    const salesByCategory = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const category = item.category || 'Uncategorized';
        salesByCategory[category] = (salesByCategory[category] || 0) + (item.totalPrice || item.price * item.quantity);
      });
    });
    
    res.status(200).json({
      success: true,
      report: {
        period,
        dateRange: {
          from: dateFilter.createdAt.$gte,
          to: dateFilter.createdAt.$lte
        },
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          uniqueCustomers: new Set(orders.map(o => o.customerInfo.phone)).size
        },
        salesByCategory,
        orders
      }
    });
    
  } catch (error) {
    console.error("Sales report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getAllProducts,
  getAllCustomers,
  getCustomerDetails,
  deleteOrder,
  getSalesReport
};