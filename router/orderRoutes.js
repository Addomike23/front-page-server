const express = require("express");
const orderRouter = express.Router();
const { createOrder, getOrders, deleteAllOrders, getOrderByNumber } = require("../controller/orderItemController");
orderRouter.use(express.json());

orderRouter.post('/create', createOrder);
orderRouter.get('/all', getOrders);
orderRouter.get('/number/:orderNumber', getOrderByNumber);  
orderRouter.delete('/delete-all', deleteAllOrders);


module.exports = orderRouter;
