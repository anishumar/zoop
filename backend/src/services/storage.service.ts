import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { ApiError } from "../utils/ApiError";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface PresignInput {
  userId: string;
  mimeType: string;
  size: number;
}

interface PresignOutput {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers: Record<string, string>;
}

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || "us-east-1";
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;

function ensureStorageConfig() {
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new ApiError(
      500,
      "Storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY"
    );
  }
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

function buildPublicUrl(key: string) {
  const base = process.env.PUBLIC_ASSET_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;

  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export class StorageService {
  private static client: S3Client | null = null;

  private static getClient() {
    if (!this.client) {
      ensureStorageConfig();
      this.client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    }

    return this.client;
  }

  static async createProductImagePresign(input: PresignInput): Promise<PresignOutput> {
    ensureStorageConfig();

    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new ApiError(400, "Only JPEG, PNG, and WEBP images are allowed");
    }

    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(400, `Image size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
    }

    const ext = extensionForMime(input.mimeType);
    const key = `products/${input.userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket!,
      Key: key,
      ContentType: input.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: 60 * 5 });

    return {
      uploadUrl,
      key,
      publicUrl: buildPublicUrl(key),
      headers: { "Content-Type": input.mimeType },
    };
  }
}
