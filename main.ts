// src/app.js
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";

import helmet from "helmet";
import dontenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
dontenv.config();

// Import routes

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import dashbordRouter from "./routes/dashboard.routes.js";
// import reviewRoutes from './routes/reviewRoutes';
// import ticketRoutes from './routes/ticketRoutes';
// import notificationRoutes from './routes/notificationRoutes';
import prayerRoutes from "./routes/prayerRoutes.js";

// Import middleware
import { authenticate } from "./middleware/auth.middleware.js";
import app from "./api/index.js";

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Logging middleware
app.use(morgan("dev"));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_SECRERT_NAME,
  api_key: process.env.CLOUDINARY_API,
  api_secret: process.env.CLOUDINARY_SECRERT_API, // Click 'View Credentials' below to copy your API secret
});
export { cloudinary };
// API Documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "Hingad API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      posts: "/api/posts",
      reviews: "/api/reviews",
      tickets: "/api/tickets",
      notifications: "/api/notifications",
      prayers: "/api/prayers",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticate, userRoutes);
app.use("/api/posts", authenticate, postRoutes);
app.use("/api/dashboard", authenticate, dashbordRouter);
// app.use("/api/reviews", authenticate, reviewRoutes);
// app.use("/api/tickets", authenticate, ticketRoutes);
// app.use("/api/notifications", authenticate, notificationRoutes);
app.use("/api/prayers", authenticate, prayerRoutes);

// 404 handler

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
