const express = require('express')
const staffRouter = express.Router()
const upload = require("../middleware/multer"); // multer config
const {createStaff, getStaff, deleteStaff, updateStaff} = require('../controller/staffController')


// CREATE STAFF ROUTE
staffRouter.post('/create-staff', upload.single("image"), createStaff)

// GET STAFF
staffRouter.get('/get-staff', getStaff)

// UPDATE STAFF ROUTE
staffRouter.put('/update-staff/:id', upload.single("image", updateStaff))

// DELETE STAFF
staffRouter.delete('/delete-staff/:id', deleteStaff)

module.exports = staffRouter