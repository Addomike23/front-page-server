const orderModel = require("../model/orderModel");
const transporter = require("../middleware/nodemailer");

class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.orderRooms = new Map(); // orderId -> Set of socketIds
    this.restaurantRooms = new Map(); // restaurantId -> Set of socketIds
  }

  /**
   * Initialize socket connection handlers
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Track specific order by orderNumber
      socket.on('track-order', (orderNumber) => {
        this.handleTrackOrder(socket, orderNumber);
      });

      // Restaurant/Admin join to receive orders
      socket.on('restaurant-join', (restaurantId) => {
        this.handleRestaurantJoin(socket, restaurantId);
      });

      // Update order status (restaurant/admin)
      socket.on('update-order-status', (data) => {
        this.handleUpdateOrderStatus(socket, data);
      });

      // Customer requests order status
      socket.on('request-order-status', (orderNumber) => {
        this.handleRequestOrderStatus(socket, orderNumber);
      });

      // Authenticate user with phone/email
      socket.on('authenticate', (userInfo) => {
        this.handleAuthentication(socket, userInfo);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Track specific order for customer
   */
  async handleTrackOrder(socket, orderNumber) {
    try {
      const order = await orderModel.findOne({ orderNumber });
      
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      const roomName = `order_${orderNumber}`;
      socket.join(roomName);
      
      // Store tracking info
      if (!this.orderRooms.has(orderNumber)) {
        this.orderRooms.set(orderNumber, new Set());
      }
      this.orderRooms.get(orderNumber).add(socket.id);

      // Send current order status immediately
      socket.emit('order-status', {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items,
        customerInfo: {
          name: order.customerInfo.name,
          phone: order.customerInfo.phone,
          address: order.customerInfo.address,
          deliveryType: order.customerInfo.deliveryType
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      });

      console.log(`📍 Tracking order ${orderNumber} for socket ${socket.id}`);
      
      // If order is completed or cancelled, send special message
      if (order.status === 'completed') {
        socket.emit('order-completed', { 
          orderNumber, 
          message: 'Your order has been completed! Thank you for ordering with us! 🎉' 
        });
      } else if (order.status === 'cancelled') {
        socket.emit('order-cancelled', { 
          orderNumber, 
          message: 'Your order has been cancelled' 
        });
      }
    } catch (error) {
      console.error('Track order error:', error);
      socket.emit('error', { message: 'Failed to track order' });
    }
  }

  /**
   * Restaurant joins to receive real-time order notifications
   */
  handleRestaurantJoin(socket, restaurantId) {
    socket.restaurantId = restaurantId;
    const roomName = `restaurant_${restaurantId}`;
    socket.join(roomName);
    
    if (!this.restaurantRooms.has(restaurantId)) {
      this.restaurantRooms.set(restaurantId, new Set());
    }
    this.restaurantRooms.get(restaurantId).add(socket.id);
    
    console.log(`🏪 Restaurant ${restaurantId} joined, total connections: ${this.restaurantRooms.get(restaurantId).size}`);
    
    socket.emit('restaurant-joined', { 
      success: true, 
      message: 'Connected to restaurant dashboard' 
    });
  }

  /**
   * Update order status from restaurant/admin
   */
  async handleUpdateOrderStatus(socket, data) {
    const { orderNumber, status, estimatedTime, note } = data;
    
    try {
      // Find the order
      const order = await orderModel.findOne({ orderNumber });
      
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      // Update order status
      order.status = status;
      await order.save();

      // Prepare status message based on status
      const statusMessages = {
        pending: '📋 Your order has been received and is pending confirmation',
        confirmed: '✅ Great news! Your order has been confirmed',
        preparing: '👨‍🍳 The chef is now preparing your delicious food',
        ready: '🍽️ Your order is ready!',
        out_for_delivery: '🛵 Your order is out for delivery! Your driver is on the way',
        completed: '🎉 Your order has been completed! Enjoy your meal!',
        cancelled: '❌ Your order has been cancelled'
      };

      // Send email notification to customer
      await this.sendStatusUpdateEmail(order, status, statusMessages[status]);

      // Emit to order room (customer tracking)
      this.io.to(`order_${orderNumber}`).emit('order-status-update', {
        orderNumber: order.orderNumber,
        status: order.status,
        statusMessage: statusMessages[status] || `Order status updated to ${status}`,
        estimatedTime: estimatedTime,
        note: note,
        timestamp: new Date()
      });

      // Log the update
      console.log(`📦 Order ${orderNumber} status updated to: ${status}`);

      // Confirm to restaurant
      socket.emit('status-updated', {
        success: true,
        orderNumber: order.orderNumber,
        status: order.status
      });

    } catch (error) {
      console.error('Update order status error:', error);
      socket.emit('error', { message: 'Failed to update order status' });
    }
  }

  /**
   * Customer requests current order status
   */
  async handleRequestOrderStatus(socket, orderNumber) {
    try {
      const order = await orderModel.findOne({ orderNumber });
      
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      socket.emit('order-status-response', {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        lastUpdate: order.updatedAt
      });
    } catch (error) {
      console.error('Request order status error:', error);
      socket.emit('error', { message: 'Failed to get order status' });
    }
  }

  /**
   * Authenticate user for personalized updates
   */
  handleAuthentication(socket, userInfo) {
    const identifier = userInfo.phone || userInfo.email;
    if (!identifier) return;
    
    this.connectedUsers.set(identifier, socket.id);
    socket.userIdentifier = identifier;
    console.log(`✅ User ${identifier} authenticated`);
    
    socket.emit('authenticated', { 
      success: true, 
      message: 'Connected to real-time updates' 
    });
  }

  /**
   * Send status update email to customer
   */
  async sendStatusUpdateEmail(order, status, statusMessage) {
    if (!order.customerInfo.email) return;

    const statusColors = {
      pending: '#ff9800',
      confirmed: '#2196f3',
      preparing: '#ff5722',
      ready: '#4caf50',
      out_for_delivery: '#9c27b0',
      completed: '#4caf50',
      cancelled: '#f44336'
    };

    const statusColor = statusColors[status] || '#333';

    const emailHtml = `
      <div style="max-width:640px;margin:auto;background:#fff;font-family:Arial,sans-serif;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1)">
        <div style="padding:20px;background:${statusColor};color:#fff;text-align:center">
          <h2 style="margin:0;font-size:24px">Order Status Update</h2>
        </div>
        <div style="padding:20px;color:#333;font-size:14px;line-height:1.5">
          <p>Dear <strong>${order.customerInfo.name}</strong>,</p>
          <p>${statusMessage}</p>
          
          <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0">
            <p style="margin:0 0 5px 0"><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p style="margin:0"><strong>Current Status:</strong> 
              <span style="background:${statusColor};color:#fff;padding:3px 10px;border-radius:15px;font-size:12px;display:inline-block">
                ${status.toUpperCase()}
              </span>
            </p>
          </div>

          <div style="margin:15px 0">
            <h3 style="margin:0 0 10px 0;font-size:16px">Order Summary:</h3>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f2f2f2">
                  <th style="padding:8px;text-align:left">Item</th>
                  <th style="padding:8px;text-align:center">Qty</th>
                  <th style="padding:8px;text-align:right">Price</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr style="border-bottom:1px solid #ddd">
                    <td style="padding:8px;vertical-align:middle">${item.name}</td>
                    <td style="padding:8px;text-align:center">${item.quantity}</td>
                    <td style="padding:8px;text-align:right">₦${(item.totalPrice || item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f9f9f9">
                  <td colspan="2" style="padding:10px;text-align:right"><strong>Total:</strong></td>
                  <td style="padding:10px;text-align:right"><strong>₦${order.items.reduce((sum, item) => sum + (item.totalPrice || item.price * item.quantity), 0).toLocaleString()}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="margin-top:20px;text-align:center">
            <a href="${process.env.FRONTEND_URL}/track-order/${order.orderNumber}" 
               style="background:${statusColor};color:#fff;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block">
              Track Your Order Live
            </a>
          </div>

          <p style="margin-top:20px;font-size:12px;color:#999;text-align:center">
            Thank you for choosing us!<br>
            For any questions, please contact us.
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Food Ordering System" <${process.env.EMAIL}>`,
        to: order.customerInfo.email,
        subject: `Order ${order.orderNumber} - ${status.toUpperCase()}`,
        html: emailHtml
      });
      console.log(`📧 Status update email sent to ${order.customerInfo.email}`);
    } catch (error) {
      console.error('Email send error:', error);
    }
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(socket) {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    // Remove from user tracking
    if (socket.userIdentifier) {
      this.connectedUsers.delete(socket.userIdentifier);
    }
    
    // Remove from order rooms
    for (const [orderNumber, sockets] of this.orderRooms.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.orderRooms.delete(orderNumber);
        }
      }
    }
    
    // Remove from restaurant rooms
    if (socket.restaurantId) {
      const restaurantSockets = this.restaurantRooms.get(socket.restaurantId);
      if (restaurantSockets) {
        restaurantSockets.delete(socket.id);
        if (restaurantSockets.size === 0) {
          this.restaurantRooms.delete(socket.restaurantId);
        }
      }
    }
  }

  // ========== PUBLIC METHODS FOR CONTROLLERS ==========

  /**
   * Emit new order notification to restaurant
   */
  emitNewOrder(order) {
    // Notify all connected restaurant dashboards
    for (const [restaurantId, sockets] of this.restaurantRooms.entries()) {
      this.io.to(`restaurant_${restaurantId}`).emit('new-order', {
        orderNumber: order.orderNumber,
        customerName: order.customerInfo.name,
        customerPhone: order.customerInfo.phone,
        deliveryType: order.customerInfo.deliveryType,
        totalAmount: order.items.reduce((sum, item) => sum + (item.totalPrice || item.price * item.quantity), 0),
        itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items,
        timestamp: new Date()
      });
    }
    console.log(`🔔 New order ${order.orderNumber} notification sent to restaurant`);
  }

  /**
   * Emit order status update (for controllers to use)
   */
  emitOrderStatusUpdate(orderNumber, status) {
    const statusMessages = {
      pending: 'Order received',
      confirmed: 'Order confirmed!',
      preparing: 'Preparing your order',
      ready: 'Order ready!',
      out_for_delivery: 'Out for delivery!',
      completed: 'Completed! Enjoy!',
      cancelled: 'Order cancelled'
    };

    this.io.to(`order_${orderNumber}`).emit('order-status-update', {
      orderNumber,
      status,
      statusMessage: statusMessages[status],
      timestamp: new Date()
    });
  }

  /**
   * Send real-time notification to specific user by phone/email
   */
  notifyUser(identifier, event, data) {
    const socketId = this.connectedUsers.get(identifier);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Check if user is online
   */
  isUserOnline(identifier) {
    return this.connectedUsers.has(identifier);
  }
}

module.exports = SocketService;