const transporter = require("../middleware/nodemailer");
const Joi = require("joi");

/* =======================
   Validation Schema
======================= */
const contactValidator = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  message: Joi.string().min(5).max(2000).required()
});

/* =======================
   Email Templates - Frontpage Electronics Branding
   Orange & Dark Theme - Professional E-commerce Style
======================= */
const companyEmailHTML = ({ name, email, message }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Message - Frontpage Electronics</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #0a0a0a;">
  <div style="max-width: 600px; margin: 40px auto; background: #1a1a1a; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #ff6b3520;">
    
    <!-- Header with Orange Accent -->
    <div style="background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%); padding: 30px 25px; text-align: center; border-bottom: 3px solid #ff6b35;">
      <div style="font-size: 48px; margin-bottom: 10px;">⚡</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">New Contact Message</h1>
      <p style="margin: 8px 0 0; color: #ff6b35; font-size: 14px; font-weight: 500;">Frontpage Electronics</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <div style="background: #0f0f0f; padding: 20px; border-radius: 16px; margin-bottom: 25px; border-left: 4px solid #ff6b35;">
        <p style="margin: 0 0 8px; color: #ff6b35; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Customer Details</p>
        <p style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #ffffff;">${name}</p>
        <p style="margin: 0; color: #ff6b35; font-size: 14px;">${email}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #ffffff;">📝 Message:</p>
        <div style="background: #0f0f0f; padding: 20px; border-radius: 12px; border: 1px solid #ff6b3530;">
          <p style="margin: 0; color: #cccccc; line-height: 1.6; font-style: italic;">
            ${message.replace(/\n/g, "<br/>")}
          </p>
        </div>
      </div>
      
      <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #ff6b3520;">
        <p style="margin: 0; font-size: 13px; color: #ff6b35;">
          💡 Reply directly to this email to respond to the customer.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #0f0f0f; padding: 20px; text-align: center; border-top: 1px solid #ff6b3520;">
      <p style="margin: 0; color: #ffffff80; font-size: 12px;">⚡ Frontpage Electronics - Premium Tech, Expert Service</p>
      <p style="margin: 8px 0 0; color: #ff6b3580; font-size: 11px;">© ${new Date().getFullYear()} Frontpage Electronics. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

const senderConfirmationHTML = ({ name }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Message Received - Frontpage Electronics</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #0a0a0a;">
  <div style="max-width: 550px; margin: 40px auto; background: #1a1a1a; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #ff6b3520;">
    
    <!-- Header with Orange Accent -->
    <div style="background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%); padding: 35px 25px; text-align: center; border-bottom: 3px solid #ff6b35;">
      <div style="font-size: 56px; margin-bottom: 10px;">✅</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.3px;">Message Received!</h1>
      <p style="margin: 10px 0 0; color: #ff6b35; font-size: 15px; font-weight: 500;">Thank you for contacting Frontpage Electronics</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #ffffff; margin-bottom: 20px;">Hello <strong style="color: #ff6b35;">${name}</strong>,</p>
      
      <p style="font-size: 14px; color: #cccccc; line-height: 1.6;">Thank you for contacting <strong style="color: #ff6b35;">Frontpage Electronics</strong>. We have received your message and our support team will get back to you as soon as possible.</p>
      
      <div style="background: #0f0f0f; padding: 16px; border-radius: 12px; margin: 25px 0; border-left: 3px solid #ff6b35;">
        <p style="margin: 0; color: #ff6b35; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Response Time</p>
        <p style="margin: 5px 0 0; color: #ffffff; font-weight: 500;">Typically within 24 hours</p>
      </div>
      
      <div style="background: #0f0f0f; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center; border: 1px solid #ff6b3530;">
        <p style="margin: 0 0 12px; font-size: 13px; color: #ff6b35;">🛒 While you wait, why not browse our latest deals?</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/shop" 
           style="background: #ff6b35; color: #0a0a0a; padding: 12px 28px; text-decoration: none; border-radius: 30px; display: inline-block; font-weight: 600; letter-spacing: -0.2px;">
          Shop Now →
        </a>
      </div>
      
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ff6b3520;">
        <p style="font-size: 13px; color: #ffffff80; margin: 0;">If your inquiry is urgent, please reply to this email or call our support hotline.</p>
      </div>
      
      <p style="margin-top: 25px; font-size: 14px; color: #ffffff;">
        Best regards,<br/>
        <strong style="color: #ff6b35;">Frontpage Electronics Team</strong>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #0f0f0f; padding: 20px; text-align: center; border-top: 1px solid #ff6b3520;">
      <p style="margin: 0 0 8px; color: #ffffff80; font-size: 12px;">⚡ Frontpage Electronics - Premium Tech, Expert Service</p>
      <p style="margin: 0; color: #ff6b3580; font-size: 11px;">© ${new Date().getFullYear()} Frontpage Electronics. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/* =======================
   Controller
======================= */
const sendContactMessage = async (req, res) => {
  const { name, email, message } = req.body;

  try {
    /* Validate input */
    const { error } = contactValidator.validate({ name, email, message });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    /* Email to company (admin) */
    await transporter.sendMail({
      from: `"Frontpage Electronics Contact" <${process.env.EMAIL}>`,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL,
      replyTo: email,
      subject: `📩 New Contact Message from ${name} - Frontpage Electronics`,
      html: companyEmailHTML({ name, email, message })
    });

    /* Confirmation email to sender (customer) */
    await transporter.sendMail({
      from: `"Frontpage Electronics Team" <${process.env.EMAIL}>`,
      to: email,
      subject: "✅ We've received your message - Frontpage Electronics",
      html: senderConfirmationHTML({ name })
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully"
    });

  } catch (err) {
    console.error("Contact form error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: err.message
    });
  }
};

module.exports = sendContactMessage;