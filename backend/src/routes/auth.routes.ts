import { Router } from "express";
import { signup, login, getProfile } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticate, getProfile);

export default router;
