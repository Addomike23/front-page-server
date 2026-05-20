const mongoose = require('mongoose')

// Order model with Paystack payment support
const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'out_for_delivery',
            'completed',
            'cancelled'
        ],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    customerInfo: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },
        address: { type: String },
        deliveryType: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
        paymentMethod: { type: String, default: 'cash' },
    },
    items: [{
        productId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        images: [{ type: String }],
        category: { type: String }
    }],
    
    // ===============================
    // PAYSTACK PAYMENT FIELDS
    // ===============================
    paymentReference: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    paymentDetails: {
        reference: { type: String },
        amount: { type: Number },
        currency: { type: String, default: 'GHS' },
        paidAt: { type: Date },
        channel: { type: String }, // card, bank, ussd, mobile_money, etc.
        ipAddress: { type: String },
        authorization: {
            authorization_code: { type: String },
            card_type: { type: String },
            last4: { type: String },
            exp_month: { type: String },
            exp_year: { type: String },
            bank: { type: String },
            country_code: { type: String },
            brand: { type: String }
        },
        customer: {
            id: { type: Number },
            customer_code: { type: String }
        },
        transaction_date: { type: Date },
        gateway_response: { type: String },
        message: { type: String }
    },
    paidAt: { type: Date },
    paymentGateway: {
        type: String,
        enum: ['paystack', 'razorpay', 'stripe', 'cash'],
        default: 'cash'
    }

}, { timestamps: true })

// Index for faster payment reference lookups
orderSchema.index({ paymentReference: 1 })
orderSchema.index({ paymentGateway: 1, paymentStatus: 1 })

const orderModel = mongoose.model("client-order", orderSchema)
module.exports = orderModel