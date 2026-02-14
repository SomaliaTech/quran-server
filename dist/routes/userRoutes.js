// src/routes/userRoutes.js
import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getUserById, updateUser } from "../controllers/user.controlers";
const router = express.Router();
// Public routes
// router.get('/', authenticate, authorize('ADMIN'), getAllUsers);
router.get("/:id", authenticate, getUserById);
// Protected routes (require authentication)
router.put("/:id", authenticate, updateUser);
// router.delete('/:id', authenticate, authorize('ADMIN'), deleteUser);
// User's own data
router.get("/me/posts", authenticate, (req, res) => {
    // This would be implemented in postController
    res.json({ message: "Get user posts route" });
});
export default router;
