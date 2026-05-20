// routes/blogRoutes.js
const express = require("express");
const router = express.Router();
const blogController = require("../controller/blogController");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.post("/create-blog", upload.single("image"), blogController.createBlog);
router.get("/get-blog", blogController.getBlogs);
router.get("/get-single:id", blogController.getSingleBlog);
router.put("/:id", upload.single("image"), blogController.updateBlog);
router.delete("/delete/:id", blogController.deleteBlog);

module.exports = router;
