const express = require('express');
const recommendationRouter = express.Router();
const {
  getPersonalizedRecommendations,
  getTrendingItems,
  getFrequentlyBoughtTogether,
  getSimilarItems,
  getNewUserRecommendations,
  setMenuItems,
  getPersonalizedOffers,
  getCustomerPreferences,
  getHybridRecommendations
} = require('../controller/recommendationController');

// ============= RECOMMENDATION ROUTES =============

// Personalized recommendations (requires phone number)
recommendationRouter.post('/personalized', getPersonalizedRecommendations);

// Hybrid recommendations (combines all methods)
recommendationRouter.post('/hybrid', getHybridRecommendations);

// Trending items (most popular)
recommendationRouter.get('/trending', getTrendingItems);

// New user recommendations (no history)
recommendationRouter.get('/new-user', getNewUserRecommendations);

// Frequently bought together
recommendationRouter.post('/frequently-bought-together', getFrequentlyBoughtTogether);

// Similar items (you may also like)
recommendationRouter.post('/similar', getSimilarItems);

// Customer preferences/insights
recommendationRouter.post('/preferences', getCustomerPreferences);

// Personalized offers/discounts
recommendationRouter.post('/offers', getPersonalizedOffers);

// Admin: Set menu items for content-based filtering
recommendationRouter.post('/set-menu', setMenuItems);

module.exports = recommendationRouter;