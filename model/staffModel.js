const mongoose = require('mongoose')

// product model for DB

const staffSchema = new mongoose.Schema({
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
    position: {
        type: String,
        require: true
    },
    title: {
        type: String,
        require: true
    },
    bio: {
        type: String,
        require: true
    },
    datePublished: {
        type: Date, default: Date.now,
        required: true
    }

}, { timestamps: true })

const staffModel = mongoose.model('staff', staffSchema)
module.exports = staffModel