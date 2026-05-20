const User = require("../model/User");
const BlacklistedToken = require("../model/BlacklistedToken");
const orderModel = require("../model/orderModel");
const connectDB = require('../utils/connectDB');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ===============================
// HELPER FUNCTIONS
// ===============================

/**
 * Generate JWT Token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * Send token response
 */
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    address: user.address,
    createdAt: user.createdAt
  };
  
  res.status(statusCode).json({
    success: true,
    token,
    user: userResponse
  });
};

/**
 * Hash password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12); // Higher salt rounds for production
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

// ===============================
// REGISTER USER
// ===============================

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    await connectDB();
    
    const { name, email, phone, password, address, role } = req.body;
    
    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, phone and password"
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? "Email already registered" : "Phone number already registered"
      });
    }
    
    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }
    
    // Validate phone number
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number (10-15 digits)"
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }
    
    // Hash password in controller
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      address: address || {},
      role: role || 'customer'
    });
    
    sendTokenResponse(user, 201, res);
    
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// LOGIN USER
// ===============================

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    await connectDB();
    
    const { email, phone, password } = req.body;
    
    // Rate limiting check (implement with express-rate-limit)
    
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password"
      });
    }
    
    // Find user by email or phone
    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    
    // Check if account is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated. Please contact support."
      });
    }
    
    // Compare password in controller
    const isPasswordMatch = await comparePassword(password, user.password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    sendTokenResponse(user, 200, res);
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// LOGOUT USER
// ===============================

/**
 * @desc    Logout user (blacklist token)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Decode token to get expiry
      const decoded = jwt.decode(token);
      
      if (decoded && decoded.exp) {
        const expiresAt = new Date(decoded.exp * 1000);
        
        // Use the addToBlacklist method which handles duplicates
        await BlacklistedToken.addToBlacklist(token, expiresAt, req.user?.id);
        
        console.log(`✅ Token blacklisted for user: ${req.user?.id}`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
    
  } catch (error) {
    console.error("Logout error:", error);
    
    // Don't fail if token already blacklisted
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "Already logged out"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check if token is blacklisted (for middleware)
 */
const isTokenBlacklisted = async (token) => {
  try {
    return await BlacklistedToken.isBlacklisted(token);
  } catch (error) {
    console.error("Check blacklist error:", error);
    return false;
  }
};

// ===============================
// GET CURRENT USER PROFILE
// ===============================

/**
 * @desc    Get current logged in user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    await connectDB();
    
    const user = await User.findById(req.user.id)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Get user's order history
    const orders = await orderModel.find({ "customerInfo.phone": user.phone })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Get order stats
    const orderStats = {
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
      totalSpent: orders.reduce((sum, order) => {
        const orderTotal = order.items.reduce((s, item) => s + (item.totalPrice || item.price * item.quantity), 0);
        return sum + orderTotal;
      }, 0),
      recentOrders: orders.slice(0, 5)
    };
    
    res.status(200).json({
      success: true,
      user,
      orderStats
    });
    
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// UPDATE USER PROFILE
// ===============================

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    await connectDB();
    
    const { name, phone, address } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Update basic info
    if (name) user.name = name;
    if (phone) {
      // Check if phone is already taken by another user
      const existingPhone = await User.findOne({ phone, _id: { $ne: user._id } });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use"
        });
      }
      user.phone = phone;
    }
    if (address) user.address = { ...user.address, ...address };
    
    await user.save();
    
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      address: user.address,
      createdAt: user.createdAt
    };
    
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse
    });
    
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// CHANGE PASSWORD
// ===============================

/**
 * @desc    Change password (logged in user)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    await connectDB();
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password"
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters"
      });
    }
    
    const user = await User.findById(req.user.id).select('+password');
    
    const isPasswordMatch = await comparePassword(currentPassword, user.password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    // Hash new password in controller
    user.password = await hashPassword(newPassword);
    await user.save();
    
    // Optional: Blacklist all previous tokens for this user
    // This forces re-login after password change
    
    res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again."
    });
    
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// FORGOT PASSWORD
// ===============================

/**
 * @desc    Forgot password - send reset token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    await connectDB();
    
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Return success even if user not found for security (prevents email enumeration)
      return res.status(200).json({
        success: true,
        message: "If an account exists with that email, you will receive a password reset link"
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    
    await user.save();
    
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    // TODO: Send email with resetUrl
    // await sendResetPasswordEmail(user.email, resetUrl);
    
    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });
    
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// RESET PASSWORD
// ===============================

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    await connectDB();
    
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }
    
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }
    
    // Hash new password in controller
    user.password = await hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: "Password reset successful. Please login with your new password."
    });
    
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// DELETE USER ACCOUNT
// ===============================

/**
 * @desc    Delete user account
 * @route   DELETE /api/auth/profile
 * @access  Private
 */
const deleteAccount = async (req, res) => {
  try {
    await connectDB();
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Soft delete - mark as inactive instead of deleting
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();
    
    // Blacklist current token
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        await BlacklistedToken.create({
          token,
          expiresAt: new Date(decoded.exp * 1000),
          userId: user._id
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: "Account deactivated successfully"
    });
    
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// REFRESH TOKEN
// ===============================

/**
 * @desc    Refresh JWT token
 * @route   POST /api/auth/refresh-token
 * @access  Private
 */
const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Generate new token
    const newToken = generateToken(user._id, user.role);
    
    res.status(200).json({
      success: true,
      token: newToken
    });
    
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh token",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// ADMIN ONLY: GET ALL USERS
// ===============================

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/auth/users
 * @access  Private/Admin
 */
const getAllUsers = async (req, res) => {
  try {
    await connectDB();
    
    const { page = 1, limit = 20, role, search } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// ADMIN ONLY: UPDATE USER ROLE
// ===============================

/**
 * @desc    Update user role (admin only)
 * @route   PUT /api/auth/users/:id/role
 * @access  Private/Admin
 */
const updateUserRole = async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['customer', 'restaurant', 'admin'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Prevent admin from changing own role
    if (user._id.toString() === req.user.id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role"
      });
    }
    
    user.role = role;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===============================
// ADMIN ONLY: DELETE USER
// ===============================

/**
 * @desc    Delete user (admin only)
 * @route   DELETE /api/auth/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account"
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Soft delete
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: `User ${user.name} deactivated successfully`
    });
    
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  isTokenBlacklisted,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  refreshToken,
  getAllUsers,
  updateUserRole,
  deleteUser
};