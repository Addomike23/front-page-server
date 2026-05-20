const recommendationEngine = require('../services/recommendationEngine');
const orderModel = require("../model/orderModel");
const connectDB = require('../utils/connectDB');

/**
 * @desc    Get personalized recommendations for a customer
 * @route   POST /api/recommendations/personalized
 * @access  Public (requires phone number)
 */
const getPersonalizedRecommendations = async (req, res) => {
  try {
    const { phone, limit = 10 } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required for personalized recommendations"
      });
    }

    const recommendations = await recommendationEngine.getPersonalizedRecommendations(
      { phone },
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    console.error("Personalized recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get personalized recommendations",
      error: error.message
    });
  }
};

/**
 * @desc    Get trending items (most popular)
 * @route   GET /api/recommendations/trending
 * @access  Public
 */
const getTrendingItems = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const trending = await recommendationEngine.getTrendingItems(limit);

    res.status(200).json({
      success: true,
      count: trending.length,
      trending
    });

  } catch (error) {
    console.error("Trending items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get trending items",
      error: error.message
    });
  }
};

/**
 * @desc    Get frequently bought together items
 * @route   POST /api/recommendations/frequently-bought-together
 * @access  Public
 */
const getFrequentlyBoughtTogether = async (req, res) => {
  try {
    const { itemName, limit = 5 } = req.body;

    if (!itemName) {
      return res.status(400).json({
        success: false,
        message: "Item name is required"
      });
    }

    const recommendations = await recommendationEngine.getFrequentlyBoughtTogether(itemName, parseInt(limit));

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    console.error("Frequently bought together error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get frequently bought together items",
      error: error.message
    });
  }
};

/**
 * @desc    Get similar items (you may also like)
 * @route   POST /api/recommendations/similar
 * @access  Public
 */
const getSimilarItems = async (req, res) => {
  try {
    const { item, limit = 5 } = req.body;

    if (!item || !item.name) {
      return res.status(400).json({
        success: false,
        message: "Item details (name, category, price) are required"
      });
    }

    const similar = recommendationEngine.getSimilarItems(item, parseInt(limit));

    res.status(200).json({
      success: true,
      count: similar.length,
      similar
    });

  } catch (error) {
    console.error("Similar items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get similar items",
      error: error.message
    });
  }
};

/**
 * @desc    Get recommendations for new users (no history)
 * @route   GET /api/recommendations/new-user
 * @access  Public
 */
const getNewUserRecommendations = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const recommendations = await recommendationEngine.getNewUserRecommendations(limit);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    console.error("New user recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get new user recommendations",
      error: error.message
    });
  }
};

/**
 * @desc    Set menu items for content-based filtering
 * @route   POST /api/recommendations/set-menu
 * @access  Admin/Restaurant
 */
const setMenuItems = async (req, res) => {
  try {
    const { menuItems } = req.body;

    if (!menuItems || !Array.isArray(menuItems)) {
      return res.status(400).json({
        success: false,
        message: "Valid menu items array is required"
      });
    }

    recommendationEngine.setMenuItems(menuItems);

    res.status(200).json({
      success: true,
      message: `Successfully loaded ${menuItems.length} menu items for recommendations`
    });

  } catch (error) {
    console.error("Set menu items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set menu items",
      error: error.message
    });
  }
};

/**
 * @desc    Get personalized offers/discounts for customer
 * @route   POST /api/recommendations/offers
 * @access  Public
 */
const getPersonalizedOffers = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    await connectDB();
    const customerOrders = await orderModel.find({
      "customerInfo.phone": phone,
      status: { $in: ['completed', 'delivered', 'confirmed'] }
    });

    if (customerOrders.length === 0) {
      return res.status(200).json({
        success: true,
        offers: [],
        message: "No offers available for new customers. Start ordering to unlock rewards!"
      });
    }

    const preferences = recommendationEngine.extractPreferences(customerOrders);
    const offers = recommendationEngine.getPersonalizedOffers(preferences);

    res.status(200).json({
      success: true,
      offers,
      customerStats: {
        totalOrders: preferences.orderCount,
        totalSpent: preferences.totalSpent,
        favoriteCategory: Object.keys(preferences.favoriteCategories)[0] || null
      }
    });

  } catch (error) {
    console.error("Personalized offers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get personalized offers",
      error: error.message
    });
  }
};

/**
 * @desc    Get customer preferences (insights)
 * @route   POST /api/recommendations/preferences
 * @access  Public
 */
const getCustomerPreferences = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    await connectDB();
    const customerOrders = await orderModel.find({
      "customerInfo.phone": phone,
      status: { $in: ['completed', 'delivered', 'confirmed'] }
    });

    if (customerOrders.length === 0) {
      return res.status(200).json({
        success: true,
        hasHistory: false,
        message: "No order history found for this customer"
      });
    }

    const preferences = recommendationEngine.extractPreferences(customerOrders);

    res.status(200).json({
      success: true,
      hasHistory: true,
      preferences: {
        favoriteCategories: preferences.favoriteCategories,
        favoriteItems: Object.values(preferences.favoriteItems).slice(0, 5),
        preferredCuisines: preferences.preferredCuisines || {},
        priceRange: preferences.priceRange,
        orderCount: preferences.orderCount,
        totalSpent: preferences.totalSpent
      }
    });

  } catch (error) {
    console.error("Customer preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get customer preferences",
      error: error.message
    });
  }
};

/**
 * @desc    Hybrid recommendation (combines all methods)
 * @route   POST /api/recommendations/hybrid
 * @access  Public
 */
const getHybridRecommendations = async (req, res) => {
  try {
    const { phone, limit = 10 } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    const personalized = await recommendationEngine.getPersonalizedRecommendations(
      { phone },
      parseInt(limit)
    );

    const trending = await recommendationEngine.getTrendingItems(5);

    const allRecommendations = [...personalized];
    
    for (const item of trending) {
      if (!allRecommendations.some(r => (r.name || r._id) === (item.name || item._id))) {
        allRecommendations.push(item);
      }
    }

    res.status(200).json({
      success: true,
      count: allRecommendations.length,
      recommendations: allRecommendations.slice(0, parseInt(limit)),
      recommendationSources: {
        personalized: personalized.length,
        trending: trending.length
      }
    });

  } catch (error) {
    console.error("Hybrid recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hybrid recommendations",
      error: error.message
    });
  }
};

module.exports = {
  getPersonalizedRecommendations,
  getTrendingItems,
  getFrequentlyBoughtTogether,
  getSimilarItems,
  getNewUserRecommendations,
  setMenuItems,
  getPersonalizedOffers,
  getCustomerPreferences,
  getHybridRecommendations
};