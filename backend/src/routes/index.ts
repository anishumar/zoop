import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import sessionRoutes from "./session.routes";
import uploadRoutes from "./upload.routes";
import livekitRoutes from "./livekit.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/sessions", sessionRoutes);
router.use("/uploads", uploadRoutes);
router.use("/livekit", livekitRoutes);

export default router;
