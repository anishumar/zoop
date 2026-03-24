import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const followUser = catchAsync(async (req: Request, res: Response) => {
  const followingId = req.params.id;
  if (!followingId) {
    throw new ApiError(400, "User ID is required");
  }
  const result = await UserService.follow(req.user!.userId, followingId);
  sendSuccess(res, result, "Followed successfully", 201);
});

export const unfollowUser = catchAsync(async (req: Request, res: Response) => {
  const followingId = req.params.id;
  if (!followingId) {
    throw new ApiError(400, "User ID is required");
  }
  const result = await UserService.unfollow(req.user!.userId, followingId);
  sendSuccess(res, result, "Unfollowed successfully");
});

export const getFollowing = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getFollowing(req.user!.userId);
  sendSuccess(res, result);
});

export const getFollowers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getFollowers(req.user!.userId);
  sendSuccess(res, result);
});

export const checkFollowing = catchAsync(async (req: Request, res: Response) => {
  const followingId = req.params.id;
  if (!followingId) {
    throw new ApiError(400, "User ID is required");
  }
  const result = await UserService.isFollowing(req.user!.userId, followingId);
  sendSuccess(res, result);
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { name, bio, phone } = req.body;
  const result = await UserService.updateProfile(req.user!.userId, { name, bio, phone });
  sendSuccess(res, result, "Profile updated successfully");
});

export const updateAvatar = catchAsync(async (req: Request, res: Response) => {
  const { avatarKey, avatarUrl } = req.body;
  if (!avatarKey || !avatarUrl) {
    throw new ApiError(400, "avatarKey and avatarUrl are required");
  }
  const result = await UserService.updateAvatar(req.user!.userId, { avatarKey, avatarUrl });
  sendSuccess(res, result, "Avatar updated successfully");
});
