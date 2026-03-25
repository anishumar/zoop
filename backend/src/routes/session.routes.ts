import { Router } from "express";
import {
  createSession,
  endSession,
  deleteSession,
  listLiveSessions,
  listLiveFollowingSessions,
  getSession,
  addProductToSession,
  removeProductFromSession,
  getSessionAnalytics,
  generateAiReplySuggestion,
  generateAiEngagementSummary,
  getUserArchivedSessions,
  uploadReel,
} from "../controllers/session.controller";
import { authenticate } from "../middlewares/auth";
import { rateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.get("/live", listLiveSessions);
router.get("/:id", getSession);
router.get("/:id/analytics", getSessionAnalytics);

router.use(authenticate);

router.get("/live/following", listLiveFollowingSessions);
router.get("/user/:hostId/archived", getUserArchivedSessions);

router.post(
  "/",
  rateLimiter(10, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  createSession
);
router.patch(
  "/:id/end",
  rateLimiter(30, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  endSession
);
router.post(
  "/:id/products",
  rateLimiter(120, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  addProductToSession
);
router.post(
  "/:id/ai-reply",
  rateLimiter(20, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  generateAiReplySuggestion
);
router.post(
  "/:id/ai-engagement-summary",
  rateLimiter(10, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  generateAiEngagementSummary
);
router.delete(
  "/:id/products",
  rateLimiter(120, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  removeProductFromSession
);
router.post(
  "/reel",
  rateLimiter(10, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  uploadReel
);

router.delete(
  "/:id",
  rateLimiter(30, 60_000, (req) => req.user?.userId || req.ip || "unknown"),
  deleteSession
);

export default router;
