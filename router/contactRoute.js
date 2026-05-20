const express = require("express");
const contactRouter = express.Router();
const sendContactMessage = require("../controller/contactController");

contactRouter.post("/contact", sendContactMessage);

module.exports = contactRouter;
