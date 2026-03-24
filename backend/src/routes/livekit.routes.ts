import { Router } from "express";
import { getToken, handleWebhook } from "../controllers/livekit.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post("/token", authenticate, getToken);
router.post("/webhook", handleWebhook);

export default router;
