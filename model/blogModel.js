const mongoose = require('mongoose')

// creating blog model for success axis food

const blogSchema = new mongoose.Schema({
    public_id: { type: String },
    imageHash: {
        type: String,
        unique: true,
        sparse: true
    },
    image: {
        type: String,
        require: true
    },
    category: {
        type: String,
        require: true
    },
    title: {
        type: String,
        require: true
    },
    description: {
        type: String,
        require: true
    },
    datePublished: {
        type: Date, default: Date.now,
        required: true
    }
}, { timestamps: true })


const blog = mongoose.model("blog-page", blogSchema)
module.exports = blog