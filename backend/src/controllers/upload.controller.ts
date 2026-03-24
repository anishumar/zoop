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

  if (!entity || !['product', 'avatar'].includes(entity)) {
    throw new ApiError(400, "Unsupported upload entity. Use 'product' or 'avatar'");
  }

  if (!mimeType || size === undefined) {
    throw new ApiError(400, "mimeType and size are required");
  }

  const presignFn = entity === 'avatar'
    ? StorageService.createAvatarPresign
    : StorageService.createProductImagePresign;

  const upload = await presignFn.call(StorageService, {
    userId: req.user!.userId,
    mimeType,
    size: Number(size),
  });

  sendSuccess(res, upload, "Upload URL created");
});
