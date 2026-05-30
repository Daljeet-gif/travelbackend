import express from "express";
import {
  registerUser, loginUser, getProfile,
  updateProfile, deleteAccount,
  refreshAccessToken, logoutUser,
} from "../controllers/userController.js";
import { authenticate, authorize, authorizeOwnerOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);

// Protected
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.delete("/:id", authenticate, authorizeOwnerOrAdmin, deleteAccount);

// Admin only example
// router.get("/admin/users", authenticate, authorize("admin"), getAllUsers);

export default router;