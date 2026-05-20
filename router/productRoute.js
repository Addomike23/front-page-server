const express = require("express");
const productRouter = express.Router();
const productController = require("../controller/productController");
const upload = require("../middleware/multer"); // multer config
const { protect, admin } = require("../middleware/auth");

// Public routes (anyone can view products)
productRouter.get("/products", productController.getProducts);
productRouter.get("/products/:id", productController.getSingleProduct);

// Admin only routes (require authentication and admin role)
productRouter.post("/products", protect, admin, upload.single("image"), productController.createProduct);
productRouter.put("/products/:id", protect, admin, upload.single("image"), productController.updateProduct);
productRouter.delete("/products/:id", protect, admin, productController.deleteProduct);

// Legacy routes (keep for backward compatibility)
productRouter.get("/get-product", productController.getProducts);
productRouter.post("/create-product", protect, admin, upload.single("image"), productController.createProduct);
productRouter.put("/update-product/:id", protect, admin, upload.single("image"), productController.updateProduct);
productRouter.delete("/products/:id", protect, admin, productController.deleteProduct);

module.exports = productRouter;