import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { StorageService } from "../services/storage.service";

export const createPresignedUpload = catchAsync(async (req: Request, res: Response) => {
  const { entity, mimeType, size } = req.body as {
    entity?: string;
    mimeType?: string;
    size?: number;
  };

  if (entity !== "product") {
    throw new ApiError(400, "Unsupported upload entity");
  }

  if (!mimeType || size === undefined) {
    throw new ApiError(400, "mimeType and size are required");
  }

  const upload = await StorageService.createProductImagePresign({
    userId: req.user!.userId,
    mimeType,
    size: Number(size),
  });

  sendSuccess(res, upload, "Upload URL created");
});
