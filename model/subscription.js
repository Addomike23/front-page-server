const mongoose = require('mongoose')

// model for subscribers

const subscribers = new mongoose.Schema({
    email: {
        type: String,
        require: true
    }
},{timestamps: true})


const subscription = mongoose.model("subcriber", subscribers)
module.exports = subscription