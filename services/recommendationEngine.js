const orderModel = require("../model/orderModel");
const productModel = require("../model/productModel");
const connectDB = require('../utils/connectDB');

class RecommendationEngine {
  constructor() {
    this.menuItems = [];
  }

  /**
   * Load products from database for content-based filtering
   */
  async loadProductsFromDB() {
    try {
      await connectDB();
      const products = await productModel.find({ status: 'available' }).lean();
      this.menuItems = products;
      console.log(`✅ Loaded ${products.length} products for recommendations`);
      return products;
    } catch (error) {
      console.error("Error loading products:", error);
      return [];
    }
  }

  /**
   * Set menu items manually (for admin)
   */
  setMenuItems(menuItems) {
    this.menuItems = menuItems;
    console.log(`✅ Manually set ${menuItems.length} menu items for recommendations`);
  }

  /**
   * Get personalized recommendations for a customer
   */
  async getPersonalizedRecommendations(customerInfo, limit = 10) {
    try {
      await connectDB();
      
      if (this.menuItems.length === 0) {
        await this.loadProductsFromDB();
      }
      
      const customerOrders = await orderModel.find({
        "customerInfo.phone": customerInfo.phone,
        status: { $in: ['completed', 'delivered', 'confirmed'] }
      }).sort({ createdAt: -1 });

      if (customerOrders.length === 0) {
        console.log(`New customer ${customerInfo.phone}, showing trending products`);
        return await this.getTrendingItems(limit);
      }

      const preferences = this.extractPreferences(customerOrders);
      const collaborativeRecs = await this.getCollaborativeRecommendations(customerInfo.phone, limit);
      const contentBasedRecs = this.getContentBasedRecommendations(preferences, limit);
      
      let recommendations = [...collaborativeRecs, ...contentBasedRecs];
      recommendations = this.deduplicateRecommendations(recommendations);
      
      if (recommendations.length < limit) {
        const trending = await this.getTrendingItems(limit - recommendations.length);
        recommendations = [...recommendations, ...trending];
      }
      
      return recommendations.slice(0, limit);
      
    } catch (error) {
      console.error("Personalized recommendations error:", error);
      return await this.getTrendingItems(limit);
    }
  }

  /**
   * Extract customer preferences from order history
   */
  extractPreferences(orders) {
    const preferences = {
      favoriteCategories: {},
      favoriteItems: {},
      priceRange: { min: Infinity, max: 0, avg: 0 },
      totalSpent: 0,
      orderCount: orders.length,
      preferredSizes: {},
      preferredCuisines: {},  // ✅ ADDED
      allItems: []
    };

    let totalPriceSum = 0;
    let itemCount = 0;

    orders.forEach(order => {
      const orderTotal = order.items.reduce((sum, item) => sum + (item.totalPrice || item.price * item.quantity), 0);
      preferences.totalSpent += orderTotal;

      order.items.forEach(item => {
        preferences.allItems.push(item);
        itemCount++;
        totalPriceSum += item.price;
        
        const category = item.category || 'Uncategorized';
        preferences.favoriteCategories[category] = (preferences.favoriteCategories[category] || 0) + item.quantity;
        
        // Track cuisine based on category
        preferences.preferredCuisines[category] = (preferences.preferredCuisines[category] || 0) + item.quantity;
        
        preferences.favoriteItems[item.productId || item.name] = {
          name: item.name,
          count: (preferences.favoriteItems[item.productId || item.name]?.count || 0) + item.quantity,
          price: item.price,
          category: category
        };
        
        if (item.size) {
          preferences.preferredSizes[item.size] = (preferences.preferredSizes[item.size] || 0) + item.quantity;
        }
        
        if (item.price < preferences.priceRange.min) preferences.priceRange.min = item.price;
        if (item.price > preferences.priceRange.max) preferences.priceRange.max = item.price;
      });
    });

    preferences.priceRange.avg = totalPriceSum / (itemCount || 1);
    preferences.favoriteCategories = this.sortByValue(preferences.favoriteCategories);
    preferences.preferredCuisines = this.sortByValue(preferences.preferredCuisines);
    
    return preferences;
  }

  /**
   * Sort object by value descending
   */
  sortByValue(obj) {
    return Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
  }

  /**
   * Get collaborative filtering recommendations from orders
   */
  async getCollaborativeRecommendations(customerPhone, limit = 10) {
    try {
      await connectDB();
      
      const allOrders = await orderModel.find({
        status: { $in: ['completed', 'delivered', 'confirmed'] }
      }).lean();
      
      const customerOrders = allOrders.filter(order => order.customerInfo.phone === customerPhone);
      const customerItemIds = new Set();
      
      customerOrders.forEach(order => {
        order.items.forEach(item => {
          customerItemIds.add(item.productId || item.name);
        });
      });
      
      const similarCustomers = [];
      
      allOrders.forEach(order => {
        if (order.customerInfo.phone === customerPhone) return;
        
        let commonItems = 0;
        order.items.forEach(item => {
          const itemId = item.productId || item.name;
          if (customerItemIds.has(itemId)) {
            commonItems++;
          }
        });
        
        if (commonItems > 0) {
          similarCustomers.push({
            phone: order.customerInfo.phone,
            commonItems,
            orders: order.items
          });
        }
      });
      
      similarCustomers.sort((a, b) => b.commonItems - a.commonItems);
      
      const recommendedItems = new Map();
      const topSimilarCustomers = similarCustomers.slice(0, 10);
      
      topSimilarCustomers.forEach(customer => {
        customer.orders.forEach(item => {
          const itemId = item.productId || item.name;
          if (!customerItemIds.has(itemId)) {
            if (!recommendedItems.has(itemId)) {
              recommendedItems.set(itemId, {
                name: item.name,
                price: item.price,
                category: item.category,
                size: item.size,
                image: item.images?.[0] || null,
                score: 0
              });
            }
            const rec = recommendedItems.get(itemId);
            rec.score += customer.commonItems;
          }
        });
      });
      
      return Array.from(recommendedItems.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
    } catch (error) {
      console.error("Collaborative filtering error:", error);
      return [];
    }
  }

  /**
   * Get content-based recommendations
   */
  getContentBasedRecommendations(preferences, limit = 10) {
    if (this.menuItems.length === 0) {
      return [];
    }
    
    const topCategories = Object.keys(preferences.favoriteCategories).slice(0, 3);
    const topSizes = Object.keys(preferences.preferredSizes).slice(0, 2);
    
    const scoredItems = this.menuItems.map(product => {
      let score = 0;
      
      if (topCategories.includes(product.category)) {
        score += 15;
      }
      
      if (topSizes.includes(product.size)) {
        score += 8;
      }
      
      const priceRatio = product.price / preferences.priceRange.avg;
      if (priceRatio >= 0.7 && priceRatio <= 1.3) {
        score += 10;
      } else if (priceRatio >= 0.5 && priceRatio <= 1.5) {
        score += 5;
      }
      
      if (product.popularityScore) {
        score += product.popularityScore / 10;
      }
      if (product.timesOrdered) {
        score += Math.min(product.timesOrdered / 100, 5);
      }
      
      return { ...product, score };
    });
    
    return scoredItems
      .filter(product => product.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get trending items
   */
  async getTrendingItems(limit = 10) {
    try {
      await connectDB();
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const trendingFromOrders = await orderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo },
            status: { $in: ['completed', 'delivered', 'confirmed'] }
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            name: { $first: "$items.name" },
            price: { $first: "$items.price" },
            category: { $first: "$items.category" },
            size: { $first: "$items.size" },
            images: { $first: "$items.images" },
            totalQuantity: { $sum: "$items.quantity" },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: limit }
      ]);
      
      if (trendingFromOrders.length > 0) {
        return trendingFromOrders;
      }
      
      const popularProducts = await productModel
        .find({ status: 'available' })
        .sort({ timesOrdered: -1, popularityScore: -1 })
        .limit(limit)
        .lean();
      
      if (popularProducts.length > 0) {
        return popularProducts;
      }
      
      return await productModel.find({ status: 'available' }).limit(limit).lean();
      
    } catch (error) {
      console.error("Trending items error:", error);
      return [];
    }
  }

  /**
   * Get similar items (you may also like)
   */
  getSimilarItems(item, limit = 5) {
    if (this.menuItems.length === 0) {
      return [];
    }
    
    const similar = this.menuItems
      .filter(menuItem => menuItem.name !== item.name)
      .map(menuItem => {
        let similarityScore = 0;
        
        if (menuItem.category === item.category) {
          similarityScore += 30;
        }
        
        const priceDiff = Math.abs(menuItem.price - item.price) / item.price;
        if (priceDiff <= 0.2) {
          similarityScore += 20;
        } else if (priceDiff <= 0.5) {
          similarityScore += 10;
        }
        
        return { ...menuItem, similarityScore };
      })
      .filter(item => item.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
    
    return similar;
  }

  /**
   * Get frequently bought together
   */
  async getFrequentlyBoughtTogether(itemName, limit = 5) {
    try {
      await connectDB();
      
      const ordersWithItem = await orderModel.find({
        "items.name": itemName,
        status: { $in: ['completed', 'delivered'] }
      }).lean();
      
      const together = {};
      
      ordersWithItem.forEach(order => {
        order.items.forEach(item => {
          if (item.name !== itemName) {
            together[item.name] = (together[item.name] || 0) + 1;
          }
        });
      });
      
      return Object.entries(together)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name, frequency]) => ({
          name,
          frequency,
          confidence: ((frequency / ordersWithItem.length) * 100).toFixed(1)
        }));
      
    } catch (error) {
      console.error("Frequently bought together error:", error);
      return [];
    }
  }

  /**
   * Get personalized offers
   */
  getPersonalizedOffers(preferences) {
    const offers = [];
    
    const topCategory = Object.keys(preferences.favoriteCategories)[0];
    if (topCategory) {
      offers.push({
        type: 'category',
        title: `${topCategory} Special`,
        description: `Get 15% off on all ${topCategory} items`,
        discount: 15,
        category: topCategory
      });
    }
    
    if (preferences.orderCount >= 5) {
      offers.push({
        type: 'loyalty',
        title: 'Loyal Customer Reward',
        description: 'Free delivery on your next order',
        discount: 'free_delivery'
      });
    }
    
    if (preferences.totalSpent > 500) {
      offers.push({
        type: 'spending',
        title: 'Premium Spender',
        description: 'Get 20% off on orders above GHS 100',
        discount: 20,
        minOrder: 100
      });
    }
    
    return offers;
  }

  /**
   * Get new user recommendations
   */
  async getNewUserRecommendations(limit = 10) {
    return await this.getTrendingItems(limit);
  }

  /**
   * Update product popularity when ordered
   */
  async updateProductPopularity(productId) {
    try {
      await productModel.findByIdAndUpdate(productId, {
        $inc: { timesOrdered: 1, popularityScore: 1 }
      });
    } catch (error) {
      console.error("Update popularity error:", error);
    }
  }

  /**
   * Deduplicate recommendations
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(rec => {
      const id = rec._id || rec.name;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
}

module.exports = new RecommendationEngine();