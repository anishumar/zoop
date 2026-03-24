import { Router } from "express";
import { toggleWishlist, getMyWishlist, getWishlistStatus } from "../controllers/wishlist.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use(authenticate);

router.get("/", getMyWishlist);
router.get("/:productId/status", getWishlistStatus);
router.post("/:productId/toggle", toggleWishlist);

export default router;
