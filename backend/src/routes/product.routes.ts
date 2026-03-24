import { Router } from "express";
import {
  createProduct,
  getMyProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  setProductImage,
  removeProductImage,
} from "../controllers/product.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use(authenticate);

router.post("/", createProduct);
router.get("/", getMyProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.patch("/:id/image", setProductImage);
router.delete("/:id/image", removeProductImage);
router.delete("/:id", deleteProduct);

export default router;
