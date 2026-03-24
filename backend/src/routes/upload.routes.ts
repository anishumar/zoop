import { Router } from "express";
import { createPresignedUpload } from "../controllers/upload.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use(authenticate);
router.post("/presign", createPresignedUpload);

export default router;
