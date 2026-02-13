// src/routes/prayerRoutes.js
import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import {
  createOrUpdatePrayerTime,
  getCurrentPrayer,
  getPrayerTimes,
  // getTodayPrayerTime,
} from "../controllers/prayer.controllers";
import prisma from "../lib/prisma";
const router = express.Router();

// Public routes (prayer times might be public)
router.get("/", getPrayerTimes);
// router.get("/today", getTodayPrayerTime);
router.get("/current", getCurrentPrayer);

// Protected routes (for managing prayer times)
router.post("/create", authenticate, createOrUpdatePrayerTime);
// router.put("/:id", authenticate, authorize("ADMIN"), updatePrayerTime);

// Get prayer times by month

export default router;
