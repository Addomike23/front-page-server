require("dotenv").config();
const connectDB = require("../utils/connectDB");
const productModel = require("../model/productModel");
const cloudinary = require("../config/cloudinary");
const { productValidator } = require("../middleware/validator");
const crypto = require("crypto");

/* =========================
   Helpers
========================= */
function generateImageHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function uploadBufferToCloudinary(buffer, folder = "frontpage-products") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        quality: "auto",
        fetch_format: "auto",
        transformation: [{ width: 600, crop: "limit" }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

/* =========================
   CREATE PRODUCT
========================= */
exports.createProduct = async (req, res) => {
  try {
    await connectDB();

    const { name, status, size, category, description, price } = req.body;

    // Convert price to number
    const numericPrice = parseFloat(price);

    const { error } = productValidator.validate({
      name,
      status,
      size,
      category,
      description,
      price: numericPrice
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Check if product name already exists
    const existingProductByName = await productModel.findOne({ name }).lean();
    if (existingProductByName) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists"
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Product image is required"
      });
    }

    const imageHash = generateImageHash(req.file.buffer);

    const existingProduct = await productModel.findOne({ imageHash }).lean();
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this image already exists"
      });
    }

    const upload = await uploadBufferToCloudinary(
      req.file.buffer,
      "frontpage-products"
    );

    const newProduct = await productModel.create({
      name,
      status,
      size,
      category,
      description,
      price: numericPrice,
      image: upload.secure_url,
      public_id: upload.public_id,
      imageHash,
      popularityScore: 0,
      timesOrdered: 0
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct
    });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: err.message
    });
  }
};

/* =========================
   GET ALL PRODUCTS
========================= */
exports.getProducts = async (req, res) => {
  try {
    await connectDB();

    const { category, status, search, limit = 100 } = req.query;
    
    let filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const products = await productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* =========================
   GET SINGLE PRODUCT
========================= */
exports.getSingleProduct = async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;

    const product = await productModel.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    console.error("Get single product error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* =========================
   UPDATE PRODUCT
========================= */
exports.updateProduct = async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;
    const { name, status, size, category, description, price } = req.body;

    // Convert price to number if provided
    const numericPrice = price ? parseFloat(price) : undefined;

    const { error } = productValidator.validate({
      name,
      status,
      size,
      category,
      description,
      price: numericPrice
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    // Check for duplicate name (excluding current product)
    if (name && name !== product.name) {
      const existingProduct = await productModel.findOne({ name }).lean();
      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: "A product with this name already exists"
        });
      }
    }

    let image = product.image;
    let public_id = product.public_id;

    if (req.file && req.file.buffer) {
      if (public_id) {
        await cloudinary.uploader.destroy(public_id).catch(() => {});
      }

      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        "frontpage-products"
      );

      image = upload.secure_url;
      public_id = upload.public_id;
    }

    const updateData = {
      ...(name && { name }),
      ...(status && { status }),
      ...(size && { size }),
      ...(category && { category }),
      ...(description && { description }),
      ...(numericPrice && { price: numericPrice }),
      image,
      public_id
    };

    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct
    });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: err.message
    });
  }
};

/* =========================
   DELETE PRODUCT
========================= */
exports.deleteProduct = async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;

    const productDoc = await productModel.findById(id);
    if (!productDoc) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      });
    }

    if (productDoc.public_id) {
      await cloudinary.uploader.destroy(productDoc.public_id).catch(() => {});
    }

    await productDoc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: err.message
    });
  }
};

/* =========================
   UPDATE PRODUCT POPULARITY (for recommendation engine)
========================= */
exports.updateProductPopularity = async (productId, increment = 1) => {
  try {
    await connectDB();
    await productModel.findByIdAndUpdate(productId, {
      $inc: { timesOrdered: increment, popularityScore: increment }
    });
  } catch (error) {
    console.error("Update popularity error:", error);
  }
};