const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    public_id: { type: String },
    imageHash: {
        type: String,
        unique: true,
        sparse: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        unique: true // Prevent duplicate product names
    },
    status: {
        type: String,
        required: true,
        enum: ['available', 'out_of_stock', 'coming_soon'],
        default: 'available'
    },
    size: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,  // ✅ FIXED: Changed from String to Number
        required: true,
        min: 0
    },
    // For recommendation engine
    popularityScore: {
        type: Number,
        default: 0
    },
    timesOrdered: {
        type: Number,
        default: 0
    },
    datePublished: {
        type: Date, 
        default: Date.now,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('product', productSchema);