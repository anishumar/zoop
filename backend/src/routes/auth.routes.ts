import { Router } from "express";
import { signup, login, getProfile, forgotPassword, resetPassword } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.post("/signup", rateLimiter(20, 60_000), signup);
router.post("/login", rateLimiter(20, 60_000), login);
router.get("/me", authenticate, getProfile);
router.post("/forgot-password", rateLimiter(5, 60_000), forgotPassword);
router.post("/reset-password", rateLimiter(10, 60_000), resetPassword);

export default router;
