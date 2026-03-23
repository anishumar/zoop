import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const { title, price, image } = req.body;
  if (!title || price === undefined) {
    throw new ApiError(400, "Title and price are required");
  }
  const product = await ProductService.create(req.user!.userId, { title, price, image });
  sendSuccess(res, product, "Product created", 201);
});

export const getMyProducts = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await ProductService.listByOwner(req.user!.userId, page, limit);
  sendSuccess(res, result);
});

export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.getById(String(req.params.id));
  sendSuccess(res, product);
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.update(String(req.params.id), req.user!.userId, req.body);
  sendSuccess(res, product, "Product updated");
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  await ProductService.delete(String(req.params.id), req.user!.userId);
  sendSuccess(res, null, "Product deleted");
});
