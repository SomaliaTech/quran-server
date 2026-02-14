// src/routes/authRoutes.js
import express from "express";
import { getProfile, login, register } from "../controllers/auth.controllers";
const router = express.Router();
// Public routes
router.post("/register", register);
router.post("/login", login);
// Protected routes (require authentication)
router.get("/profile", getProfile);
export default router;
