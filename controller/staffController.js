const connectDB = require("../utils/connectDB");
const staffModel = require("../model/staffModel");
const cloudinary = require("../config/cloudinary");
const { staffValidator } = require("../middleware/validator");
const crypto = require("crypto");

/* =========================
   Helpers
========================= */
function generateImageHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function uploadBufferToCloudinary(buffer, folder = "frontpage-staff") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `frontpage-staff/${folder}`,
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
   CREATE STAFF
========================= */
const createStaff = async (req, res) => {
  try {
    await connectDB();

    const { title, position, bio } = req.body;

    const { error } = staffValidator.validate({ title, position, bio });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Staff image is required"
      });
    }

    const imageHash = generateImageHash(req.file.buffer);

    const existingStaff = await staffModel
      .findOne({ imageHash })
      .lean();

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: "A staff member with this image already exists"
      });
    }

    const upload = await uploadBufferToCloudinary(
      req.file.buffer,
      "frontpage-staff"
    );

    const newStaff = await staffModel.create({
      title,
      position,
      bio,
      image: upload.secure_url,
      public_id: upload.public_id,
      imageHash
    });

    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      staff: newStaff
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating staff",
      error: error.message
    });
  }
};

/* =========================
   GET ALL STAFF
========================= */
const getStaff = async (req, res) => {
  try {
    await connectDB();

    const staffs = await staffModel
      .find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      staff: staffs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// === Update Staff
const updateStaff = async (req, res) => {
  try {
    await connectDB();

    const { id } = req.params;
    const { title, position, bio } = req.body;

    // Validate text fields (allow partial update)
    const { error } = staffValidator.validate(
      { title, position, bio },
      { allowUnknown: true }
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Find existing staff
    const staff = await staffModel.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found"
      });
    }

    let updatedData = {
      title: title ?? staff.title,
      position: position ?? staff.position,
      boi: bio ?? staff.bio
    };

    // If a new image is uploaded
    if (req.file && req.file.buffer) {
      const imageHash = generateImageHash(req.file.buffer);

      // Prevent duplicate image usage
      const existingStaff = await staffModel.findOne({
        imageHash,
        _id: { $ne: id }
      });

      if (existingStaff) {
        return res.status(409).json({
          success: false,
          message: "Another staff member already uses this image"
        });
      }

      // Delete old image from Cloudinary
      if (staff.public_id) {
        await deleteFromCloudinary(staff.public_id);
      }

      // Upload new image
      const upload = await uploadBufferToCloudinary(
        req.file.buffer,
        "frontpage-staff"
      );

      updatedData.image = upload.secure_url;
      updatedData.public_id = upload.public_id;
      updatedData.imageHash = imageHash;
    }

    const updatedStaff = await staffModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      staff: updatedStaff
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating staff",
      error: error.message
    });
  }
};


/* =========================
   DELETE STAFF
========================= */
const deleteStaff = async (req, res) => {
  try {
    await connectDB();

    const staff = await staffModel.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    if (staff.public_id) {
      await cloudinary.uploader.destroy(staff.public_id).catch(() => {});
    }

    await staff.deleteOne();

    res.status(200).json({
      success: true,
      message: "Staff deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createStaff,
  updateStaff,
  getStaff,
  deleteStaff
};
