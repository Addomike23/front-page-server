const mongoose = require('mongoose')

// client reviews model

const reviewSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true
    },
    content: {type: String, require: true},

    rating: {type: Number, require: true},
    avatar: {
        type: String,
        require: true
    }
},{timestamps: true})


const reviewModel = mongoose.model("review", reviewSchema)
module.exports = reviewModel