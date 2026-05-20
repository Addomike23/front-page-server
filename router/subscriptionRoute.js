const express = require('express')
const subscribeRoute = express.Router()
const subscribeMails = require('../controller/subscriptionController')


// route for subscribing mails

subscribeRoute.post('/subscribe', subscribeMails)

module.exports = subscribeRoute