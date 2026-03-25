import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { ApiError } from "../utils/ApiError";

/* ── MIME & size rules per entity ───────────────────────────── */

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALL_MEDIA_MIMES = new Set([...IMAGE_MIMES, ...VIDEO_MIMES]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;        // 5 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;       // 100 MB

/* ── Env ────────────────────────────────────────────────────── */

const bucket = process.env.R2_BUCKET;
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY;
const secretAccessKey = process.env.R2_SECRET_KEY;
const publicUrl = process.env.R2_PUBLIC_URL;

function ensureStorageConfig() {
  if (!bucket || !accountId || !accessKeyId || !secretAccessKey) {
    throw new ApiError(
      500,
      "Storage is not configured. Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY, and R2_SECRET_KEY",
    );
  }
}

/* ── Helpers ────────────────────────────────────────────────── */

function extensionForMime(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mimeType] || "bin";
}

/* ── Entity definitions ─────────────────────────────────────── */

type EntityType = "product" | "avatar" | "stream" | "reel" | "thumbnail";

interface EntityConfig {
  allowedMimes: Set<string>;
  maxBytes: number;
  keyPrefix: string;
}

const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  product: {
    allowedMimes: IMAGE_MIMES,
    maxBytes: MAX_IMAGE_BYTES,
    keyPrefix: "products",
  },
  avatar: {
    allowedMimes: IMAGE_MIMES,
    maxBytes: MAX_IMAGE_BYTES,
    keyPrefix: "avatars",
  },
  thumbnail: {
    allowedMimes: IMAGE_MIMES,
    maxBytes: MAX_IMAGE_BYTES,
    keyPrefix: "thumbnails",
  },
  stream: {
    allowedMimes: VIDEO_MIMES,
    maxBytes: MAX_VIDEO_BYTES,
    keyPrefix: "streams",
  },
  reel: {
    allowedMimes: ALL_MEDIA_MIMES,
    maxBytes: MAX_VIDEO_BYTES,
    keyPrefix: "reels",
  },
};

/* ── Service ────────────────────────────────────────────────── */

interface PresignInput {
  userId: string;
  mimeType: string;
  size: number;
  entity: EntityType;
}

interface PresignOutput {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers: Record<string, string>;
}

export class StorageService {
  private static client: S3Client | null = null;

  private static getClient() {
    if (!this.client) {
      ensureStorageConfig();
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    }
    return this.client;
  }

  static buildPublicUrl(key: string) {
    if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
    return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  }

  /**
   * Generic presign method for any supported entity type.
   */
  static async createPresign(input: PresignInput): Promise<PresignOutput> {
    ensureStorageConfig();

    const config = ENTITY_CONFIG[input.entity];
    if (!config) {
      throw new ApiError(400, `Unsupported entity type: ${input.entity}`);
    }

    if (!config.allowedMimes.has(input.mimeType)) {
      const allowed = [...config.allowedMimes].join(", ");
      throw new ApiError(400, `Unsupported MIME type for ${input.entity}. Allowed: ${allowed}`);
    }

    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > config.maxBytes) {
      const maxMB = (config.maxBytes / (1024 * 1024)).toFixed(0);
      throw new ApiError(400, `File size must be between 1 byte and ${maxMB} MB`);
    }

    const ext = extensionForMime(input.mimeType);
    const key = `${config.keyPrefix}/${input.userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket!,
      Key: key,
      ContentType: input.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, {
      expiresIn: 60 * 10, // 10 minutes
    });

    return {
      uploadUrl,
      key,
      publicUrl: StorageService.buildPublicUrl(key),
      headers: { "Content-Type": input.mimeType },
    };
  }

  /* ── Convenience wrappers (backward-compatible) ─────────── */

  static async createProductImagePresign(input: Omit<PresignInput, "entity">): Promise<PresignOutput> {
    return this.createPresign({ ...input, entity: "product" });
  }

  static async createAvatarPresign(input: Omit<PresignInput, "entity">): Promise<PresignOutput> {
    return this.createPresign({ ...input, entity: "avatar" });
  }
}
