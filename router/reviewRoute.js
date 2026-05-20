const express = require('express')
const reviewRouter = express.Router()
const upload = require("../middleware/multer"); // multer config
const {createReview, allReview, deleteReview } = require('../controller/reviewController')

// CREATE route
reviewRouter.post("/create-review", upload.single("image"), createReview);

// GET REVIEWS
reviewRouter.get('/get-review', allReview)

// DELETE REVIEW
reviewRouter.delete('/delete-review/:id', deleteReview)

module.exports = reviewRouter
