import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { StorageService } from "../services/storage.service";

const ALLOWED_ENTITIES = ["product", "avatar", "stream", "reel", "thumbnail"] as const;
type EntityType = (typeof ALLOWED_ENTITIES)[number];

export const createPresignedUpload = catchAsync(async (req: Request, res: Response) => {
  const { entity, mimeType, size } = req.body as {
    entity?: string;
    mimeType?: string;
    size?: number;
  };

  if (!entity || !ALLOWED_ENTITIES.includes(entity as EntityType)) {
    throw new ApiError(
      400,
      `Unsupported entity. Use one of: ${ALLOWED_ENTITIES.join(", ")}`,
    );
  }

  if (!mimeType || size === undefined) {
    throw new ApiError(400, "mimeType and size are required");
  }

  const upload = await StorageService.createPresign({
    userId: req.user!.userId,
    mimeType,
    size: Number(size),
    entity: entity as EntityType,
  });

  sendSuccess(res, upload, "Upload URL created");
});
