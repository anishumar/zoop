import { Request, Response } from "express";
import { WishlistService } from "../services/wishlist.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";

export const toggleWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.toggle(req.user!.userId, String(req.params.productId));
  sendSuccess(res, result, result.wishlisted ? "Added to wishlist" : "Removed from wishlist");
});

export const getMyWishlist = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await WishlistService.getMyWishlist(req.user!.userId, page, limit);
  sendSuccess(res, result);
});

export const getWishlistStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getStatus(req.user!.userId, String(req.params.productId));
  sendSuccess(res, result);
});
