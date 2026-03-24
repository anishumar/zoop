import { Router } from "express";
import { createPresignedUpload } from "../controllers/upload.controller";
import { authenticate } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.use(authenticate);
router.post(
  "/presign",
  rateLimiter(60, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  createPresignedUpload
);

export default router;
