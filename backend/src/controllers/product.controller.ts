import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { AiService } from "../services/ai.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

const ALLOWED_PRODUCT_SIZES = ["S", "M", "L", "XL", "Free Size"] as const;

function sanitizeSizes(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "Please select at least one valid size");
  }

  const normalized = Array.from(
    new Set(
      value
        .map((size) => (typeof size === "string" ? size.trim() : ""))
        .filter((size): size is string => ALLOWED_PRODUCT_SIZES.includes(size as (typeof ALLOWED_PRODUCT_SIZES)[number]))
    )
  );

  if (normalized.length === 0) {
    throw new ApiError(400, "Please select at least one valid size");
  }

  return normalized;
}

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const { title, description, price, quantity, sizes } = req.body;
  if (!title || price === undefined || quantity === undefined || sizes === undefined) {
    throw new ApiError(400, "Title, price, quantity and sizes are required");
  }

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new ApiError(400, "Price must be a valid number greater than 0");
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
    throw new ApiError(400, "Quantity must be a valid whole number");
  }

  const parsedSizes = sanitizeSizes(sizes);

  const product = await ProductService.create(req.user!.userId, {
    title,
    description,
    price: parsedPrice,
    quantity: parsedQuantity,
    sizes: parsedSizes,
  });
  sendSuccess(res, product, "Product created", 201);
});

export const getMyProducts = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await ProductService.listByOwner(req.user!.userId, page, limit);
  sendSuccess(res, result);
});

export const getUserProducts = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await ProductService.listByOwner(String(req.params.userId), page, limit);
  sendSuccess(res, result);
});

export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.getById(String(req.params.id));
  sendSuccess(res, product);
});

export const generateProductAiSummary = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.getById(String(req.params.id));

  if (product.ownerId !== req.user!.userId) {
    throw new ApiError(403, "Not authorized");
  }

  const summary = await AiService.generateProductSummary({
    title: product.title,
    price: product.price,
    quantity: product.quantity,
    sizes: product.sizes,
    imageUrl: product.imageUrl,
  });

  sendSuccess(res, summary, "AI product summary generated");
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const { title, description, price, quantity, sizes } = req.body as {
    title?: string;
    description?: string;
    price?: number | string;
    quantity?: number | string;
    sizes?: string[];
  };

  const updateData: { title?: string; description?: string; price?: number; quantity?: number; sizes?: string[] } = {};

  if (title !== undefined) {
    updateData.title = title;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  if (price !== undefined) {
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      throw new ApiError(400, "Price must be a valid number greater than 0");
    }
    updateData.price = parsedPrice;
  }

  if (quantity !== undefined) {
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      throw new ApiError(400, "Quantity must be a valid whole number");
    }
    updateData.quantity = parsedQuantity;
  }

  if (sizes !== undefined) {
    updateData.sizes = sanitizeSizes(sizes);
  }

  const product = await ProductService.update(String(req.params.id), req.user!.userId, updateData);
  sendSuccess(res, product, "Product updated");
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  await ProductService.delete(String(req.params.id), req.user!.userId);
  sendSuccess(res, null, "Product deleted");
});

export const setProductImage = catchAsync(async (req: Request, res: Response) => {
  const { imageKey, imageUrl, imageMimeType, imageSize, imageWidth, imageHeight } = req.body;
  if (!imageKey || !imageUrl) {
    throw new ApiError(400, "imageKey and imageUrl are required");
  }

  const product = await ProductService.setImage(String(req.params.id), req.user!.userId, {
    imageKey,
    imageUrl,
    imageMimeType,
    imageSize,
    imageWidth,
    imageHeight,
  });

  sendSuccess(res, product, "Product image updated");
});

export const removeProductImage = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.removeImage(String(req.params.id), req.user!.userId);
  sendSuccess(res, product, "Product image removed");
});
