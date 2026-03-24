import { Router } from "express";
import { signup, login, getProfile } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.post("/signup", rateLimiter(20, 60_000), signup);
router.post("/login", rateLimiter(20, 60_000), login);
router.get("/me", authenticate, getProfile);

export default router;
