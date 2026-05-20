const connectDB = require("../utils/connectDB");
const blog = require("../model/blogModel");
const cloudinary = require("../config/cloudinary");
const { blogValidator, allowedUpdateSchema } = require("../middleware/validator");

/**
 * Upload buffer to Cloudinary
 */
function uploadBufferToCloudinary(buffer, folder = "blogs") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        quality: "auto",
        fetch_format: "auto",
        transformation: [{ width: 1200, crop: "limit" }]
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
   CREATE BLOG
========================= */
exports.createBlog = async (req, res) => {
  try {
    await connectDB();

    const { title, category, description } = req.body;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const { error } = blogValidator.validate({ title, category, description });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const upload = await uploadBufferToCloudinary(
      req.file.buffer,
      "success-axis-food/blogs"
    );

    const newBlog = await blog.create({
      title,
      category,
      description,
      image: upload.secure_url,
      public_id: upload.public_id
    });

    res.status(201).json({
      success: true,
      message: "Blog created",
      blog: newBlog
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error creating blog",
      error: err.message
    });
  }
};

/* =========================
   GET ALL BLOGS
========================= */
exports.getBlogs = async (req, res) => {
  try {
    await connectDB();

    const blogs = await blog
      .find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      blogData: blogs
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* =========================
   GET SINGLE BLOG
========================= */
exports.getSingleBlog = async (req, res) => {
  try {
    await connectDB();

    const singleBlog = await blog.findById(req.params.id).lean();

    if (!singleBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json({
      success: true,
      blog: singleBlog
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* =========================
   UPDATE BLOG
========================= */
exports.updateBlog = async (req, res) => {
  try {
    await connectDB();

    const { error, value } = allowedUpdateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        details: error.details.map(d => d.message)
      });
    }

    const blogDoc = await blog.findById(req.params.id);
    if (!blogDoc) {
      return res.status(404).json({ message: "Blog not found" });
    }

    let image = blogDoc.image;
    let public_id = blogDoc.public_id;

    if (req.file && req.file.buffer) {
      if (public_id) {
        await cloudinary.uploader.destroy(public_id).catch(() => {});
      }

      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        "success-axis-food/blogs"
      );

      image = upload.secure_url;
      public_id = upload.public_id;
    }

    const updatedBlog = await blog.findByIdAndUpdate(
      req.params.id,
      { ...value, image, public_id },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Blog updated",
      blog: updatedBlog
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating blog",
      error: err.message
    });
  }
};

/* =========================
   DELETE BLOG
========================= */
exports.deleteBlog = async (req, res) => {
  try {
    await connectDB();

    const blogDoc = await blog.findById(req.params.id);
    if (!blogDoc) {
      return res.status(404).json({ message: "Blog not found" });
    }

    if (blogDoc.public_id) {
      await cloudinary.uploader.destroy(blogDoc.public_id).catch(() => {});
    }

    await blogDoc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting blog",
      error: err.message
    });
  }
};
