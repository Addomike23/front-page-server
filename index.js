require("dotenv").config(); // Load local .env variables
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");

// Import Routes
const subscribeRoute = require("./router/subscriptionRoute");
const blogRoute = require("./router/blogRoute");
const productRouter = require("./router/productRoute");
const staffRouter = require("./router/staffRoute");
const reviewRouter = require("./router/reviewRoute");
const contactRoute = require("./router/contactRoute");
const orderRouter = require('./router/orderRoutes');
const authRouter = require('./router/authRoute');
const recommendationRouter = require('./router/recommendationsRoute');
const adminRouter = require('./router/adminRoute');

// Import Services
const SocketService = require('./services/socketService');

// Import JSON data
const heroMessage = require("./json/heroMessage.json");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

/* =======================
   Socket.IO Configuration
======================= */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://foodorderio.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Initialize Socket Service
const socketService = new SocketService(io);
socketService.initialize();

// Make socketService available to routes
app.set('socketService', socketService);

/* =======================
   Middleware
======================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet()); // Security headers

/* =======================
   CORS Configuration
======================= */
const allowedOrigins = [
  "https://www.nayasuccessaxis.com",
  "https://foodorderio.vercel.app",
  "http://localhost:5173"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Allow Postman / curl
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* =======================
   Routes
======================= */

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Frontpage Electronics Backend is running",
    endpoints: {
      hero: "/hero",
      health: "/health",
    }
  });
});

// Hero route
app.get("/hero", (req, res) => {
  res.json({
    success: true,
    message: heroMessage
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
    services: {
      database: "connected",
      socket: socketService ? "active" : "inactive"
    }
  });
});

/* =======================
   API Routers
======================= */

// Existing routes
app.use("/", subscribeRoute);
app.use("/", blogRoute);
app.use("/", productRouter);
app.use("/", staffRouter);
app.use("/", reviewRouter);
app.use("/", contactRoute);
app.use('/', orderRouter);

// New integrated routes
app.use("/auth", authRouter);
app.use("/recommendations", recommendationRouter);
app.use("/admin", adminRouter);

/* =======================
   Socket.IO Connection Logging
======================= */
io.on('connection', (socket) => {
  console.log(`🔌 New socket connection: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

/* =======================
   Error Handling Middleware
======================= */
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/* =======================
   Export App for Vercel
======================= */
module.exports = app;

/* =======================
   Local server (development only)
======================= */
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║     🍕 NAYA AXIS FOODS - BACKEND SERVER 🍔          ║
╠══════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                      ║
║  Socket.IO: Active on port ${PORT}                    ║
║  Environment: ${process.env.NODE_ENV || 'development'}                    ║
╠══════════════════════════════════════════════════════╣
║  📍 API Endpoints:                                   ║
║  • Auth:      /api/auth                             ║
║  • Orders:    /api/orders                           ║
║  • Products:  /api/products                         ║
║  • Recs:      /api/recommendations                  ║
║  • Admin:     /api/admin                            ║
╠══════════════════════════════════════════════════════╣
║  🔌 Socket Events:                                   ║
║  • track-order    - Track order status              ║
║  • update-order-status - Update order (admin)       ║
║  • order-status-update - Receive status updates     ║
╚══════════════════════════════════════════════════════╝
    `);
  });
}