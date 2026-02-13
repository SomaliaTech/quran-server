// src/routes/postRoutes.js
import express from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { createPost, getAllPosts } from "../controllers/post.controllers";
import prisma from "../lib/prisma";

const router = express.Router();
// Public routes (some endpoints might be public)
router.get("/", getAllPosts);
// router.get('/:id', getPostById);

// Protected routes
router.post("/create", authenticate, createPost);
// router.put('/:id', authenticate, updatePost);
// router.delete('/:id', authenticate, deletePost);

// Admin only routes
router.patch(
  "/:id/visibility",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    // Toggle post visibility
    const post = await prisma.post.update({
      where: { id: req.params.id as string },
      data: { visibility: req.body.visibility },
    });
    res.json({ success: true, data: post });
  },
);

// Search posts
// router.get('/search/:query', getAllPosts);

// Get posts by category
// router.get('/category/:category', getAllPost);

export default router;
