import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import sessionRoutes from "./session.routes";
import uploadRoutes from "./upload.routes";
import livekitRoutes from "./livekit.routes";
import userRoutes from "./user.routes";
import wishlistRoutes from "./wishlist.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/sessions", sessionRoutes);
router.use("/uploads", uploadRoutes);
router.use("/livekit", livekitRoutes);
router.use("/users", userRoutes);
router.use("/wishlist", wishlistRoutes);

export default router;
