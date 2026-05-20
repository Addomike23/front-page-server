const orderModel = require("../model/orderModel");
const productModel = require("../model/productModel");
const { orderValidator } = require("../middleware/validator");
const transporter = require("../middleware/nodemailer");
const crypto = require("crypto");
const connectDB = require('../utils/connectDB');
const recommendationEngine = require('../services/recommendationEngine');


// Frontpage Electronics Website URL
const FRONTPAGE_URL = 'https://frontpage-electronics.vercel.app/';

const createOrder = async (req, res) => {
  
  try {
    await connectDB();

    // ===============================
    // 1. VALIDATION
    // ===============================
    const { error, value } = orderValidator.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map(d => d.message),
      });
    }

    // ===============================
    // 2. ORDER NUMBER
    // ===============================
    const orderNumber = `FP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // ===============================
    // 3. NORMALIZE ITEMS
    // ===============================
    const normalizedItems = value.items.map(item => ({
      ...item,
      totalPrice: item.price * item.quantity,
      images: item.images && item.images.length
        ? item.images
        : ["https://res.cloudinary.com/demo/image/upload/w_400,q_auto/placeholder.png"]
    }));

    // ===============================
    // 4. PREPARE ORDER DATA WITH PAYMENT SUPPORT
    // ===============================
    const orderData = {
      orderNumber,
      ...value,
      items: normalizedItems
    };

    // Add payment fields if payment was made
    if (value.paymentStatus === 'paid' && value.paymentReference) {
      orderData.paymentStatus = value.paymentStatus;
      orderData.paymentReference = value.paymentReference;
      orderData.paidAt = value.paidAt || new Date();
      orderData.paymentGateway = 'paystack';
      
      if (value.paymentDetails) {
        orderData.paymentDetails = value.paymentDetails;
      }
    }

    // ===============================
    // 5. SAVE ORDER
    // ===============================
    const order = await orderModel.create(orderData);

    // ===============================
    // 6. UPDATE PRODUCT POPULARITY
    // ===============================
    for (const item of normalizedItems) {
      if (item.productId) {
        await recommendationEngine.updateProductPopularity(item.productId);
      } else {
        const product = await productModel.findOne({ name: item.name });
        if (product) {
          await recommendationEngine.updateProductPopularity(product._id);
        }
      }
    }
    console.log(`📊 Updated popularity for ${normalizedItems.length} products`);

    // ===============================
    // 7. CALCULATE TOTALS (GHS CURRENCY)
    // ===============================
    const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = order.customerInfo.deliveryType === 'delivery' ? 15 : 0;
    const tax = subtotal * 0.025;
    const totalAmount = subtotal + deliveryFee + tax;

    // ===============================
    // 8. BUILD ADMIN ITEMS TABLE HTML
    // ===============================
    const adminItemsHtml = order.items.map(item => `
      <tr style="border-bottom:1px solid #ff6b3520">
        <td style="padding:12px;vertical-align:middle">
          ${item.images.map(img => `<img src="${img}" width="50" height="50" style="object-fit:cover;margin-right:6px;vertical-align:middle;border-radius:8px"/>`).join('')}
          <strong style="color:#ffffff">${item.name}</strong><br/>
          <span style="color:#ff6b35;font-size:12px">${item.category || 'Home Appliance / Electronics'}</span>
        </td>
        <td style="padding:12px;text-align:center;color:#cccccc">${item.quantity}</td>
        <td style="padding:12px;text-align:right;color:#cccccc">GH₵${(item.price).toFixed(2)}</td>
        <td style="padding:12px;text-align:right"><strong style="color:#ff6b35">GH₵${(item.totalPrice).toFixed(2)}</strong></td>
      </tr>
    `).join("");

    // ===============================
    // 9. ADMIN EMAIL HTML - Orange & Dark Theme
    // ===============================
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order - ${order.orderNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#0a0a0a;">
        <div style="max-width:700px;margin:40px auto;background:#1a1a1a;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid #ff6b3520">
          <div style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 100%);padding:35px 30px;text-align:center;border-bottom:3px solid #ff6b35">
            <div style="font-size:48px;margin-bottom:10px;">🏠⚡</div>
            <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.3px">New Order Received!</h1>
            <p style="margin:10px 0 0;color:#ff6b35;font-size:16px;font-weight:500">Order #${order.orderNumber}</p>
          </div>
          <div style="padding:30px">
            <div style="background:#0f0f0f;padding:20px;border-radius:16px;margin-bottom:25px;border-left:4px solid #ff6b35">
              <h2 style="margin:0 0 15px 0;color:#ff6b35;font-size:18px">👤 Customer Information</h2>
              <table style="width:100%">
                <tr><td style="padding:6px 0;color:#ffffff80"><strong>Name:</strong></td><td style="color:#ffffff">${order.customerInfo.name}</td></tr>
                <tr><td style="padding:6px 0;color:#ffffff80"><strong>Phone:</strong></td><td style="color:#ffffff">${order.customerInfo.phone}</td></tr>
                ${order.customerInfo.email ? `<tr><td style="padding:6px 0;color:#ffffff80"><strong>Email:</strong></td><td style="color:#ffffff">${order.customerInfo.email}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#ffffff80"><strong>Delivery:</strong></td><td style="color:#ffffff">${order.customerInfo.deliveryType === 'delivery' ? '🚚 Home Delivery' : '🏪 Store Pickup'}</td></tr>
                ${order.customerInfo.address ? `<tr><td style="padding:6px 0;color:#ffffff80"><strong>Address:</strong></td><td style="color:#ffffff">${order.customerInfo.address}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#ffffff80"><strong>Payment:</strong></td>
                  <td style="color:#ffffff">
                    ${order.customerInfo.paymentMethod === 'cash' ? '💰 Cash on Delivery' : 
                      order.paymentStatus === 'paid' ? '💳 Card Payment (Paid)' : '💳 Card Payment'}
                  </td>
                </tr>
                ${order.paymentReference ? `
                <tr>
                  <td style="padding:6px 0;color:#ffffff80"><strong>Payment Ref:</strong></td>
                  <td style="font-size:12px;color:#ff6b35">${order.paymentReference}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            <h2 style="margin:0 0 15px 0;color:#ff6b35;font-size:18px">📦 Order Items</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <thead><tr style="background:#0f0f0f;border-bottom:2px solid #ff6b35"><th style="padding:12px;text-align:left;color:#ff6b35">Product</th><th style="padding:12px;text-align:center;color:#ff6b35">Qty</th><th style="padding:12px;text-align:right;color:#ff6b35">Price</th><th style="padding:12px;text-align:right;color:#ff6b35">Total</th></tr></thead>
              <tbody>${adminItemsHtml}</tbody>
              <tfoot>
                <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Subtotal:</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${subtotal.toFixed(2)}</td></tr>
                <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Delivery Fee:</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${deliveryFee.toFixed(2)}</td></tr>
                <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Tax (2.5%):</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${tax.toFixed(2)}</td></tr>
                <tr style="background:#ff6b3520;border-radius:12px"><td colspan="3" style="padding:15px;text-align:right"><strong style="color:#ff6b35">TOTAL:</strong></td><td style="padding:15px;text-align:right"><strong style="color:#ff6b35;font-size:20px">GH₵${totalAmount.toFixed(2)}</strong></td></tr>
              </tfoot>
            </table>
            <div style="text-align:center;margin-top:25px">
              <a href="${FRONTPAGE_URL}/admin/orders" style="background:#ff6b35;color:#0a0a0a;padding:12px 30px;text-decoration:none;border-radius:30px;display:inline-block;font-weight:600">📊 View Dashboard →</a>
            </div>
          </div>
          <div style="background:#0f0f0f;padding:20px;text-align:center;border-top:1px solid #ff6b3520">
            <p style="margin:0;color:#ffffff80;font-size:12px">🏠⚡ Frontpage Electronics - Home Appliances & Electronics</p>
            <p style="margin:10px 0 0;color:#ff6b3580;font-size:11px">© ${new Date().getFullYear()} Frontpage Electronics. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // ===============================
    // 10. SEND ADMIN EMAIL (Skip if payment failed)
    // ===============================
    if (order.paymentStatus !== 'failed') {
      await transporter.sendMail({
        from: `"Frontpage Electronics Orders" <${process.env.EMAIL}>`,
        to: process.env.EMAIL,
        subject: `🏠⚡ NEW ORDER - ${order.orderNumber} - Frontpage Electronics`,
        html: adminHtml
      });
    }

    // ===============================
    // 11. CUSTOMER EMAIL HTML - Orange & Dark Theme
    // ===============================
    if (order.customerInfo.email && order.paymentStatus !== 'failed') {
      const customerItemsHtml = order.items.map(item => `
        <tr style="border-bottom:1px solid #ff6b3520">
          <td style="padding:12px;vertical-align:middle">
            ${item.images.map(img => `<img src="${img}" width="50" height="50" style="object-fit:cover;margin-right:6px;vertical-align:middle;border-radius:8px"/>`).join('')}
            <strong style="color:#ffffff">${item.name}</strong>
           </td>
          <td style="padding:12px;text-align:center;color:#cccccc">${item.quantity}</td>
          <td style="padding:12px;text-align:right;color:#cccccc">GH₵${(item.price).toFixed(2)}</td>
          <td style="padding:12px;text-align:right"><strong style="color:#ff6b35">GH₵${(item.totalPrice).toFixed(2)}</strong></td>
        </tr>
      `).join("");

      const customerHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - ${order.orderNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
          </style>
        </head>
        <body style="margin:0;padding:0;background:#0a0a0a;">
          <div style="max-width:700px;margin:40px auto;background:#1a1a1a;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid #ff6b3520">
            <div style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 100%);padding:35px 30px;text-align:center;border-bottom:3px solid #ff6b35">
              <div style="font-size:56px;margin-bottom:10px;">✅🏠</div>
              <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.3px">Order Confirmed!</h1>
              <p style="margin:10px 0 0;color:#ff6b35;font-size:16px;font-weight:500">Order #${order.orderNumber}</p>
            </div>
            <div style="padding:30px">
              <p style="color:#ffffff">Dear <strong style="color:#ff6b35;">${order.customerInfo.name}</strong>,</p>
              <p style="color:#cccccc">Thank you for shopping at <strong style="color:#ff6b35;">Frontpage Electronics</strong>! Your order has been received and is being processed for delivery.</p>
              
              <div style="background:#0f0f0f;padding:20px;border-radius:16px;margin:20px 0;border-left:4px solid #ff6b35">
                <h3 style="margin:0 0 15px 0;color:#ff6b35">📋 Order Summary</h3>
                <table style="width:100%">
                  <tr><td style="padding:6px 0;color:#ffffff80"><strong>Order Number:</strong></td><td style="color:#ffffff">${order.orderNumber}</td></tr>
                  <tr><td style="padding:6px 0;color:#ffffff80"><strong>Order Date:</strong></td><td style="color:#ffffff">${new Date(order.createdAt).toLocaleString()}</td></tr>
                  <tr><td style="padding:6px 0;color:#ffffff80"><strong>Delivery:</strong></td><td style="color:#ffffff">${order.customerInfo.deliveryType === 'delivery' ? '🚚 Home Delivery' : '🏪 Store Pickup'}</td></tr>
                  ${order.paymentStatus === 'paid' ? `<tr><td style="padding:6px 0;color:#ffffff80"><strong>Payment:</strong></td><td style="color:#00ff9d">✅ Paid via Card</td></tr>` : ''}
                </table>
              </div>
              
              <h3 style="margin:0 0 15px 0;color:#ff6b35">🛒 Your Items</h3>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <thead><tr style="background:#0f0f0f;border-bottom:2px solid #ff6b35"><th style="padding:12px;text-align:left;color:#ff6b35">Product</th><th style="padding:12px;text-align:center;color:#ff6b35">Qty</th><th style="padding:12px;text-align:right;color:#ff6b35">Price</th><th style="padding:12px;text-align:right;color:#ff6b35">Total</th></tr></thead>
                <tbody>${customerItemsHtml}</tbody>
                <tfoot>
                  <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Subtotal:</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${subtotal.toFixed(2)}</td></tr>
                  <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Delivery:</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${deliveryFee.toFixed(2)}</td></tr>
                  <tr><td colspan="3" style="padding:12px;text-align:right;color:#ffffff80"><strong>Tax (2.5%):</strong></td><td style="padding:12px;text-align:right;color:#ffffff">GH₵${tax.toFixed(2)}</td></tr>
                  <tr style="background:#ff6b3520;border-radius:12px"><td colspan="3" style="padding:15px;text-align:right"><strong style="color:#ff6b35">TOTAL:</strong></td><td style="padding:15px;text-align:right"><strong style="color:#ff6b35;font-size:20px">GH₵${totalAmount.toFixed(2)}</strong></td></tr>
                </tfoot>
              </table>
              
              <div style="text-align:center;margin:30px 0">
                <a href="${FRONTPAGE_URL}/track-order/${order.orderNumber}" style="background:#ff6b35;color:#0a0a0a;padding:14px 35px;text-decoration:none;border-radius:30px;display:inline-block;font-weight:600">🚀 Track Your Order Live</a>
              </div>
              
              <div style="background:#0f0f0f;padding:15px;border-radius:12px;margin:20px 0;text-align:center;border:1px solid #ff6b3530">
                <p style="margin:0;color:#ff6b35;font-size:14px">💡 <strong>Frontpage Rewards</strong></p>
                <p style="margin:5px 0 0;color:#cccccc;font-size:13px">Shop more, save more! Earn points on every purchase of home appliances and electronics.</p>
              </div>
              
              <div style="background:#0f0f0f;padding:15px;border-radius:12px;text-align:center;border:1px solid #ff6b3530">
                <p style="margin:0;color:#cccccc;font-size:13px">📞 Need help? Contact our support team at ${process.env.SUPPORT_PHONE || '+233 XXX XXX XXXX'}</p>
                <p style="margin:5px 0 0;color:#cccccc;font-size:13px">🌐 Visit us: <a href="${FRONTPAGE_URL}" style="color:#ff6b35;">${FRONTPAGE_URL}</a></p>
              </div>
              
              <div style="margin-top:20px;padding:15px;background:#0f0f0f;border-radius:12px;text-align:center;border:1px solid #ff6b3530">
                <p style="margin:0;color:#ff6b35;font-size:13px">🔧 <strong>Installation & Setup Available</strong></p>
                <p style="margin:5px 0 0;color:#cccccc;font-size:12px">Professional installation services available for all major appliances.</p>
              </div>
            </div>
            <div style="background:#0f0f0f;padding:20px;text-align:center;border-top:1px solid #ff6b3520">
              <p style="margin:0;color:#ffffff80;font-size:12px">🏠⚡ Frontpage Electronics - Your Trusted Source for Home Appliances & Electronics</p>
              <p style="margin:10px 0 0;color:#ff6b3580;font-size:11px">© ${new Date().getFullYear()} Frontpage Electronics. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"Frontpage Electronics" <${process.env.EMAIL}>`,
        to: order.customerInfo.email,
        subject: `✅ Order Confirmed - ${order.orderNumber} - Frontpage Electronics`,
        html: customerHtml
      });
    }

    // ===============================
    // 12. SOCKET.IO REAL-TIME NOTIFICATION
    // ===============================
    const socketService = req.app.get('socketService');
    if (socketService && order.paymentStatus !== 'failed') {
      socketService.emitNewOrder(order);
      if (order.customerInfo.phone) {
        socketService.notifyUser(order.customerInfo.phone, 'order-confirmation', {
          orderNumber: order.orderNumber,
          status: order.status,
          message: `Your Frontpage Electronics order ${order.orderNumber} has been placed successfully!`,
          items: order.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
            images: item.images
          })),
          subtotal, deliveryFee, tax, totalAmount
        });
      }
      console.log(`🔔 Socket notification sent for order: ${order.orderNumber}`);
    }

    // ===============================
    // 13. GET RECOMMENDATIONS
    // ===============================
    let recommendations = [];
    try {
      recommendations = await recommendationEngine.getPersonalizedRecommendations(
        { phone: order.customerInfo.phone }, 5
      );
    } catch (recError) {
      console.error("Failed to fetch recommendations:", recError);
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        paidAt: order.paidAt,
        customerInfo: order.customerInfo,
        items: order.items,
        subtotal, deliveryFee, tax, totalAmount,
        createdAt: order.createdAt
      },
      recommendations
    });

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// GET ALL ORDERS
const getOrders = async (req, res) => {
  try {
    await connectDB();
    const orders = await orderModel.find({}).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders", error: error.message });
  }
};

// GET ORDER BY ORDER NUMBER
const getOrderByNumber = async (req, res) => {
  try {
    await connectDB();
    const { orderNumber } = req.params;
    const order = await orderModel.findOne({ orderNumber }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get order by number error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch order", error: error.message });
  }
};

// DELETE ALL ORDERS
const deleteAllOrders = async (req, res) => {
  try {
    await connectDB();
    const result = await orderModel.deleteMany({});
    res.status(200).json({ success: true, message: "All orders deleted successfully", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Delete all orders error:", error);
    res.status(500).json({ success: false, message: "Failed to delete all orders", error: error.message });
  }
};

module.exports = { createOrder, getOrders, getOrderByNumber, deleteAllOrders };