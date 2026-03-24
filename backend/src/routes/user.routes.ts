import { Router } from "express";
import {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  checkFollowing,
  updateProfile,
  updateAvatar,
} from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Profile management
router.patch("/profile", updateProfile);
router.patch("/avatar", updateAvatar);

// Get users the current user is following
router.get("/following", getFollowing);

// Get followers of the current user
router.get("/followers", getFollowers);

// Check if current user follows a specific user
router.get("/:id/is-following", checkFollowing);

// Follow a user
router.post("/:id/follow", followUser);

// Unfollow a user
router.post("/:id/unfollow", unfollowUser);

export default router;
