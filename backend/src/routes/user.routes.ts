import { Router } from "express";
import {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  checkFollowing,
  updateProfile,
  updateAvatar,
  searchUsers,
  getUserPublicProfile,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Search users by name
router.get("/search", searchUsers);

// Profile management
router.patch("/profile", updateProfile);
router.patch("/avatar", updateAvatar);

// Get users the current user is following
router.get("/following", getFollowing);

// Get followers of the current user
router.get("/followers", getFollowers);

// Get a user's public profile
router.get("/:id/profile", getUserPublicProfile);

// Check if current user follows a specific user
router.get("/:id/is-following", checkFollowing);

// Follow a user
router.post("/:id/follow", followUser);

// Unfollow a user
router.post("/:id/unfollow", unfollowUser);

export default router;
