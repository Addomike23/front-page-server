const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    console.log("✅ Using cached database connection");
    return cached.conn;
  }

  if (!process.env.MONGODB_URL) {
    console.error("❌ MONGODB_URL is not defined");
    throw new Error("MONGODB_URL environment variable is not defined");
  }

  if (!cached.promise) {
    console.log("📡 Connecting to MongoDB...");
    console.log("📍 Using connection string:", process.env.MONGODB_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 30000, // Increased timeout
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      family: 4, // Force IPv4
    };

    cached.promise = mongoose
      .connect(process.env.MONGODB_URL, options)
      .then((mongoose) => {
        console.log("✅ MongoDB connected successfully!");
        console.log("📊 Database:", mongoose.connection.name);
        console.log("📍 Host:", mongoose.connection.host);
        return mongoose;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection error:", err.message);
        console.error("📝 Error code:", err.code);
        console.error("💡 Tip: Check if you're connected to the internet and MongoDB Atlas IP whitelist");
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

module.exports = connectDB;