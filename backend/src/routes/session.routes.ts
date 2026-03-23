import { Router } from "express";
import {
  createSession,
  endSession,
  listLiveSessions,
  getSession,
  addProductToSession,
  removeProductFromSession,
  getSessionAnalytics,
} from "../controllers/session.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/live", listLiveSessions);
router.get("/:id", getSession);
router.get("/:id/analytics", getSessionAnalytics);

router.use(authenticate);

router.post("/", createSession);
router.patch("/:id/end", endSession);
router.post("/:id/products", addProductToSession);
router.delete("/:id/products", removeProductFromSession);

export default router;
