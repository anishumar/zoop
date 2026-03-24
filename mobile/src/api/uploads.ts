import { apiClient } from "./client";
import { ApiResponse } from "../types";

interface PresignResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  headers: Record<string, string>;
}

interface UploadAsset {
  uri: string;
  mimeType: string;
  fileSize: number;
}

export async function uploadProductImage(asset: UploadAsset) {
  const presign = await apiClient<ApiResponse<PresignResponse>>("/uploads/presign", {
    method: "POST",
    body: {
      entity: "product",
      mimeType: asset.mimeType,
      size: asset.fileSize,
    },
  });

  const blob = await (await fetch(asset.uri)).blob();
  const putRes = await fetch(presign.data.uploadUrl, {
    method: "PUT",
    headers: {
      ...(presign.data.headers || {}),
      "Content-Type": asset.mimeType,
    },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error("Image upload failed");
  }

  return {
    imageKey: presign.data.key,
    imageUrl: presign.data.publicUrl,
  };
}

export async function uploadAvatarImage(asset: UploadAsset) {
  const presign = await apiClient<ApiResponse<PresignResponse>>("/uploads/presign", {
    method: "POST",
    body: {
      entity: "avatar",
      mimeType: asset.mimeType,
      size: asset.fileSize,
    },
  });

  const blob = await (await fetch(asset.uri)).blob();
  const putRes = await fetch(presign.data.uploadUrl, {
    method: "PUT",
    headers: {
      ...(presign.data.headers || {}),
      "Content-Type": asset.mimeType,
    },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error("Avatar upload failed");
  }

  return {
    avatarKey: presign.data.key,
    avatarUrl: presign.data.publicUrl,
  };
}
