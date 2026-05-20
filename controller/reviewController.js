const connectDB = require("../utils/connectDB");
const reviewModel = require("../model/reviewModel");
const cloudinary = require("../config/cloudinary");
const { reviewValidator } = require("../middleware/validator");
const transporter = require("../middleware/nodemailer");

/* =========================
   Helper: Render Star Rating with Emojis
========================= */
function renderStarRating(rating) {
  const fullStar = "⭐";
  const emptyStar = "☆";
  return fullStar.repeat(rating) + emptyStar.repeat(5 - rating);
}

function renderStarRatingText(rating) {
  const stars = {
    5: "⭐⭐⭐⭐⭐ (Excellent!)",
    4: "⭐⭐⭐⭐ (Very Good)",
    3: "⭐⭐⭐ (Good)",
    2: "⭐⭐ (Fair)",
    1: "⭐ (Poor)"
  };
  return stars[rating] || "⭐⭐⭐ (Good)";
}

/* =========================
   Cloudinary Upload Helper
========================= */
function uploadBufferToCloudinary(buffer, folder = "frontpage-reviews") {
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

// Frontpage Electronics Configuration
const FRONTPAGE_URL = process.env.FRONTEND_URL || 'https://frontpage-electronics.vercel.app';
const FRONTPAGE_NAME = 'Frontpage Electronics';
const FRONTPAGE_TAGLINE = 'Premium Tech, Expert Service';
const FRONTPAGE_EMAIL = process.env.EMAIL;

/* =========================
   CREATE REVIEW
========================= */
const createReview = async (req, res) => {
  try {
    await connectDB();

    const { name, email, content, rating } = req.body;

    const { error } = reviewValidator.validate({
      name,
      email,
      content,
      rating
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Reviewer image is required"
      });
    }

    const upload = await uploadBufferToCloudinary(
      req.file.buffer,
      "frontpage-reviews"
    );

    // ✅ Save to DB
    const newReview = await reviewModel.create({
      name,
      email,
      content,
      rating,
      avatar: upload.secure_url
    });

    // ✅ Send ADMIN EMAIL - Light Theme with Nice Box Shadow
    await transporter.sendMail({
      from: `"${FRONTPAGE_NAME} Reviews" <${FRONTPAGE_EMAIL}>`,
      to: process.env.ADMIN_EMAIL || FRONTPAGE_EMAIL,
      subject: `⭐ New ${rating}-Star Review from ${name} - ${FRONTPAGE_NAME}`,
      attachments: [
        {
          filename: "customer-avatar.jpg",
          path: upload.secure_url,
          cid: "customerAvatar"
        }
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New ${FRONTPAGE_NAME} Review</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f5f7fa;">
          <div style="max-width: 550px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05);">
            
            <div style="background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); padding: 25px 20px; text-align: center;">
              <div style="font-size: 40px;">🏠⚡</div>
              <h1 style="margin: 8px 0 0; color: #fff; font-size: 22px;">New Customer Review!</h1>
            </div>
            
            <div style="padding: 25px;">
              <div style="display: flex; align-items: center; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 16px; margin-bottom: 20px;">
                <img src="cid:customerAvatar" style="width: 55px; height: 55px; border-radius: 50%; object-fit: cover; border: 2px solid #F59E0B;" />
                <div>
                  <h3 style="margin: 0; color: #1e293b; font-size: 16px;">${name}</h3>
                  <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">${email}</p>
                </div>
              </div>
              
              <div style="text-align: center; background: #fffbeb; padding: 20px; border-radius: 16px; margin-bottom: 20px;">
                <div style="font-size: 40px; letter-spacing: 3px;">${renderStarRating(rating)}</div>
                <div style="font-size: 22px; font-weight: 700; color: #EA580C;">${rating}.0 / 5.0</div>
                <div style="font-size: 13px; color: #64748b;">${renderStarRatingText(rating)}</div>
              </div>
              
              <div style="background: #f1f5f9; padding: 16px; border-radius: 14px; margin-bottom: 20px;">
                <p style="margin: 0; color: #334155; font-style: italic; line-height: 1.5;">"${content}"</p>
              </div>
              
              <div style="display: flex; gap: 12px;">
                <a href="${FRONTPAGE_URL}/reviews" style="flex: 1; background: #F59E0B; color: #fff; padding: 10px; text-decoration: none; border-radius: 40px; text-align: center; font-weight: 600;">View Reviews</a>
                <a href="${FRONTPAGE_URL}" style="flex: 1; background: #1e293b; color: #fff; padding: 10px; text-decoration: none; border-radius: 40px; text-align: center; font-weight: 600;">Visit Store</a>
              </div>
            </div>
            
            <div style="background: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">${FRONTPAGE_NAME} - ${FRONTPAGE_TAGLINE}</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    // ✅ Send CUSTOMER CONFIRMATION EMAIL - Light Theme
    if (email && email !== process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from: `"${FRONTPAGE_NAME} Team" <${FRONTPAGE_EMAIL}>`,
        to: email,
        subject: `Thank You for Your Review, ${name}! 🏠⚡`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thank You for Your Review</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
            </style>
          </head>
          <body style="margin: 0; padding: 0; background: #f5f7fa;">
            <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05);">
              
              <div style="background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); padding: 30px 20px; text-align: center;">
                <div style="font-size: 48px;">🙏⚡</div>
                <h1 style="margin: 8px 0 0; color: #fff; font-size: 24px;">Thank You, ${name}!</h1>
              </div>
              
              <div style="padding: 25px;">
                <p style="font-size: 15px; color: #1e293b;">Dear <strong style="color: #EA580C;">${name}</strong>,</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.5;">Thanks for sharing your feedback about ${FRONTPAGE_NAME}. We truly appreciate it!</p>
                
                <div style="background: #fffbeb; padding: 20px; border-radius: 16px; margin: 20px 0; text-align: center;">
                  <div style="font-size: 40px;">${renderStarRating(rating)}</div>
                  <div style="font-size: 18px; font-weight: 600; color: #EA580C;">${rating}.0 / 5.0</div>
                </div>
                
                <div style="background: linear-gradient(135deg, #F59E0B 0%, #EA580C 100%); padding: 20px; border-radius: 16px; text-align: center;">
                  <div style="font-size: 28px;">🎁</div>
                  <h3 style="color: #fff; margin: 8px 0;">Thank You Gift!</h3>
                  <p style="color: rgba(255,255,255,0.9); margin: 0 0 12px;">Use code: <strong style="font-size: 18px;">FRONTPAGE10</strong> for 10% off</p>
                  <a href="${FRONTPAGE_URL}/products" style="background: #fff; color: #EA580C; padding: 10px 25px; text-decoration: none; border-radius: 40px; display: inline-block; font-weight: 600;">Shop Now →</a>
                </div>
              </div>
              
              <div style="background: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} ${FRONTPAGE_NAME}</p>
              </div>
            </div>
          </body>
        </html>
        `
      });
    }

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      review: newReview
    });

  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating review",
      error: error.message
    });
  }
};

/* =========================
   GET ALL REVIEWS
========================= */
const allReview = async (req, res) => {
  try {
    await connectDB();

    const { limit = 50, minRating } = req.query;

    let filter = {};
    if (minRating) filter.rating = { $gte: parseInt(minRating) };

    const reviews = await reviewModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const avgRatingResult = await reviewModel.aggregate([
      { $group: { _id: null, average: { $avg: "$rating" }, total: { $sum: 1 } } }
    ]);

    const averageRating = avgRatingResult[0]?.average || 0;
    const totalReviews = avgRatingResult[0]?.total || 0;

    const distribution = await reviewModel.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach(d => { ratingDistribution[d._id] = d.count; });

    res.status(200).json({
      success: true,
      stats: {
        averageRating: parseFloat(averageRating.toFixed(1)),
        totalReviews,
        ratingDistribution
      },
      count: reviews.length,
      reviews
    });

  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =========================
   GET SINGLE REVIEW
========================= */
const getSingleReview = async (req, res) => {
  try {
    await connectDB();

    const review = await reviewModel.findById(req.params.id).lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    res.status(200).json({
      success: true,
      review
    });

  } catch (error) {
    console.error("Get single review error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =========================
   DELETE REVIEW
========================= */
const deleteReview = async (req, res) => {
  try {
    await connectDB();

    const review = await reviewModel.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    if (review.avatar) {
      const publicId = review.avatar.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId).catch(() => { });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createReview,
  allReview,
  getSingleReview,
  deleteReview
};