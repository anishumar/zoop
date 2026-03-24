import { Router } from "express";
import { getToken, handleWebhook } from "../controllers/livekit.controller";
import { authenticate } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.post(
  "/token",
  authenticate,
  rateLimiter(240, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  getToken
);
router.post("/webhook", handleWebhook);

export default router;
