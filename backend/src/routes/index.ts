import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import sessionRoutes from "./session.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/sessions", sessionRoutes);

export default router;
