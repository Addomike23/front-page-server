const connectDB = require("../utils/connectDB");
const transporter = require("../middleware/nodemailer");
const { subscriberMail } = require("../middleware/validator");
const Subscription = require("../model/subscription");

// Frontpage Electronics Configuration
const FRONTPAGE_URL = process.env.FRONTEND_URL || 'https://frontpageelectronics.vercel.app/';
const FRONTPAGE_NAME = 'Frontpage Electronics';
const FRONTPAGE_TAGLINE = 'Premium Tech, Expert Service';
const FRONTPAGE_EMAIL = process.env.EMAIL;

/* =========================
   EMAIL TEMPLATE - FRONTPAGE ELECTRONICS BRANDING
   Dashboard Theme: Orange & Dark (blended colors)
   Background: #0a0a0a, Cards: #1a1a1a / #1F2937, Accent: #F59E0B / #ff6b35
========================= */
const subscriptionTemplate = (name = "Tech Enthusiast") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${FRONTPAGE_NAME}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #eeeeee;">
  <div style="max-width: 550px; margin: 40px auto; background: #1F2937; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #374151;">
    
    <!-- Header - Gradient from Orange to Dark -->
    <div style="background: linear-gradient(135deg, #F59E0B 0%, #ff6b35 100%); padding: 35px 25px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 10px;">🏠⚡</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.3px;">Welcome to ${FRONTPAGE_NAME}!</h1>
      <p style="margin: 10px 0 0; color: #fff3e0; font-size: 15px; font-weight: 500;">${FRONTPAGE_TAGLINE}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #F9FAFB; margin-bottom: 20px;">Dear <strong style="color: #F59E0B;">${name}</strong>,</p>
      
      <p style="font-size: 14px; color: #D1D5DB; line-height: 1.6;">Thank you for subscribing to <strong style="color: #F59E0B;">${FRONTPAGE_NAME}</strong>! You're now part of our tech-savvy community.</p>
      
      <!-- Welcome Gift Card - Orange Accent -->
      <div style="background: #1F2937; padding: 20px; border-radius: 16px; margin: 25px 0; text-align: center; border-left: 4px solid #F59E0B; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <div style="font-size: 32px; margin-bottom: 10px;">🎁⚡</div>
        <h3 style="color: #F59E0B; margin: 0 0 8px;">Welcome Gift!</h3>
        <p style="color: #9CA3AF; margin: 0 0 15px;">Use code: <strong style="font-size: 20px; color: #F59E0B;">FRONTPAGE10</strong> for 10% off your first purchase</p>
        <a href="${FRONTPAGE_URL}/products" 
           style="background: linear-gradient(135deg, #F59E0B 0%, #ff6b35 100%); color: #0a0a0a; padding: 12px 30px; text-decoration: none; border-radius: 30px; display: inline-block; font-weight: 600; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
          Shop Now →
        </a>
      </div>
      
      <!-- Benefits List -->
      <h3 style="color: #F59E0B; font-size: 16px; margin: 20px 0 10px;">What You'll Get:</h3>
      <ul style="color: #D1D5DB; line-height: 1.8; padding-left: 20px;">
        <li>⚡ Exclusive deals on home appliances</li>
        <li>🏠 New product announcements</li>
        <li>🎂 Special birthday rewards</li>
        <li>🔧 Expert tech tips & buying guides</li>
      </ul>
      
      <!-- Rating Card -->
      <div style="background: #1F2937; padding: 15px; border-radius: 12px; margin: 25px 0; display: flex; align-items: center; gap: 12px; border-left: 4px solid #F59E0B;">
        <span style="font-size: 32px;">⭐</span>
        <div>
          <div style="font-weight: 600; color: #F59E0B;">Rated 4.8/5 by Customers</div>
          <div style="font-size: 13px; color: #9CA3AF;">"Best electronics store in Ghana!"</div>
        </div>
      </div>
      
      <!-- Support Section -->
      <div style="background: #1F2937; padding: 12px; border-radius: 12px; margin: 15px 0; text-align: center; border: 1px solid #374151;">
        <p style="margin: 0; color: #F59E0B; font-size: 12px;">🔧 <strong>Need installation or support?</strong></p>
        <p style="margin: 5px 0 0; color: #9CA3AF; font-size: 11px;">Our expert team is ready to help with setup and troubleshooting.</p>
      </div>
      
      <p style="font-size: 13px; color: #6B7280; text-align: center; margin-top: 20px;">
        We're excited to bring you the best in home appliances and electronics.<br/>
        Questions? Contact us at +233 XXX XXX XXXX or email <a href="mailto:${FRONTPAGE_EMAIL}" style="color: #F59E0B; text-decoration: none;">${FRONTPAGE_EMAIL}</a> 
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #1F2937; padding: 20px; text-align: center; border-top: 1px solid #374151;">
      <p style="margin: 0 0 10px; color: #9CA3AF; font-size: 12px;">
        🏠⚡ ${FRONTPAGE_NAME} - ${FRONTPAGE_TAGLINE}
      </p>
      <p style="margin: 0;">
        <a href="${FRONTPAGE_URL}/unsubscribe" style="color: #F59E0B; text-decoration: none; font-size: 12px;">
          Unsubscribe
        </a>
      </p>
      <p style="margin: 10px 0 0; color: #6B7280; font-size: 11px;">
        © ${new Date().getFullYear()} ${FRONTPAGE_NAME}. All rights reserved.
      </p>
      <p style="margin: 5px 0 0; color: #4B5563; font-size: 10px;">
        ${FRONTPAGE_URL}
      </p>
    </div>
  </div>
</body>
</html>
`;

/* =========================
   ADMIN NOTIFICATION TEMPLATE - FRONTPAGE ELECTRONICS
   Dashboard Theme: Orange & Dark (blended colors)
========================= */
const adminNotificationTemplate = (email) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Subscriber - ${FRONTPAGE_NAME}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #eeeeee;">
  <div style="max-width: 500px; margin: 40px auto; background: #1F2937; border-radius: 20px; overflow: hidden; box-shadow: 1px 25px 50px -12px rgba(230, 207, 90, 0.5); border: 2px solid #938a29;">
    <div style="background: linear-gradient(135deg, #F59E0B 0%, #ff6b35 100%); padding: 30px 25px; text-align: center;">
      <div style="font-size: 48px;">📧⚡</div>
      <h2 style="margin: 10px 0 0; color: #ffffff; font-size: 24px; letter-spacing: -0.3px;">New Subscriber!</h2>
      <p style="margin: 5px 0 0; color: #fff3e0; font-size: 14px; font-weight: 500;">${FRONTPAGE_NAME}</p>
    </div>
    <div style="padding: 25px;">
      <p style="font-size: 16px; color: #F9FAFB;">Someone just subscribed to ${FRONTPAGE_NAME}!</p>
      <div style="background: #1F2937; padding: 15px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #F59E0B;">
        <p style="margin: 0; color: #D1D5DB;"><strong style="color: #F59E0B;">📧 Email:</strong> ${email}</p>
        <p style="margin: 10px 0 0; color: #D1D5DB;"><strong style="color: #F59E0B;">📅 Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <a href="${FRONTPAGE_URL}/admin/subscribers" 
         style="background: linear-gradient(135deg, #F59E0B 0%, #ff6b35 100%); color: #0a0a0a; padding: 12px 25px; text-decoration: none; border-radius: 30px; display: inline-block; font-weight: 600; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
        View All Subscribers →
      </a>
    </div>
    <div style="background: #1F2937; padding: 15px; text-align: center; border-top: 1px solid #374151;">
      <p style="margin: 0; color: #9CA3AF; font-size: 11px;">🏠⚡ ${FRONTPAGE_NAME} - ${FRONTPAGE_TAGLINE}</p>
    </div>
  </div>
</body>
</html>
`;

/* =========================
   SUBSCRIBE CONTROLLER
========================= */
const subscribeMails = async (req, res) => {
  try {
    await connectDB();

    const { email, name } = req.body;

    /* Validate input */
    const { error } = subscriberMail.validate({ email });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    /* Prevent duplicates */
    const exists = await Subscription.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Email already subscribed"
      });
    }

    /* Persist first (source of truth) */
    await Subscription.create({ email, name: name || "Tech Enthusiast" });

    /* ✅ Send WELCOME EMAIL TO CUSTOMER (SUBSCRIBER) */
    await transporter.sendMail({
      from: `"${FRONTPAGE_NAME} Team" <${FRONTPAGE_EMAIL}>`,
      to: email,
      subject: `Welcome to ${FRONTPAGE_NAME}! 🏠⚡ Get 10% Off Your First Purchase`,
      html: subscriptionTemplate(name || email.split('@')[0])
    });

    /* ✅ Send NOTIFICATION TO ADMIN */
    await transporter.sendMail({
      from: `"${FRONTPAGE_NAME} Subscriptions" <${FRONTPAGE_EMAIL}>`,
      to: process.env.ADMIN_EMAIL || FRONTPAGE_EMAIL,
      subject: `📧⚡ New Subscriber Joined ${FRONTPAGE_NAME}`,
      html: adminNotificationTemplate(email)
    });

    return res.status(201).json({
      success: true,
      message: "Thanks for subscribing! Check your email for your welcome gift 🎁⚡"
    });

  } catch (err) {
    console.error("Subscription error:", err);

    return res.status(500).json({
      success: false,
      message: "Subscription failed. Please try again."
    });
  }
};

module.exports = subscribeMails;