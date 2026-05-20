const express = require('express');
const adminRouter = express.Router();
const {
  getDashboardStats,
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getAllProducts,
  getAllCustomers,
  getCustomerDetails,
  deleteOrder,
  getSalesReport
} = require('../controller/adminController');

// Dashboard & Analytics
adminRouter.get('/stats', getDashboardStats);
adminRouter.get('/reports/sales', getSalesReport);

// Order Management
adminRouter.get('/orders', getAllOrders);
adminRouter.get('/orders/:id', getOrderDetails);
adminRouter.put('/orders/:id/status', updateOrderStatus);
adminRouter.delete('/orders/:id', deleteOrder);

// Product Management
adminRouter.get('/products', getAllProducts);

// Customer Management
adminRouter.get('/customers', getAllCustomers);
adminRouter.get('/customers/:phone', getCustomerDetails);

module.exports = adminRouter;