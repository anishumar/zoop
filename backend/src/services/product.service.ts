import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";

export class ProductService {
  static async create(
    ownerId: string,
    data: { title: string; description?: string; price: number; quantity: number; sizes: string[] }
  ) {
    return prisma.product.create({
      data: { ...data, ownerId },
    });
  }

  static async listByOwner(ownerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { ownerId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where: { ownerId } }),
    ]);
    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "Product not found");
    return product;
  }

  static async update(
    id: string,
    ownerId: string,
    data: Partial<{ title: string; description: string; price: number; quantity: number; sizes: string[] }>
  ) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "Product not found");
    if (product.ownerId !== ownerId) throw new ApiError(403, "Not authorized");

    return prisma.product.update({ where: { id }, data });
  }

  static async setImage(
    id: string,
    ownerId: string,
    data: {
      imageKey: string;
      imageUrl: string;
      imageMimeType?: string;
      imageSize?: number;
      imageWidth?: number;
      imageHeight?: number;
    }
  ) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "Product not found");
    if (product.ownerId !== ownerId) throw new ApiError(403, "Not authorized");

    return prisma.product.update({
      where: { id },
      data: {
        imageKey: data.imageKey,
        imageUrl: data.imageUrl,
        imageMimeType: data.imageMimeType,
        imageSize: data.imageSize,
        imageWidth: data.imageWidth,
        imageHeight: data.imageHeight,
      },
    });
  }

  static async removeImage(id: string, ownerId: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "Product not found");
    if (product.ownerId !== ownerId) throw new ApiError(403, "Not authorized");

    return prisma.product.update({
      where: { id },
      data: {
        imageKey: null,
        imageUrl: null,
        imageMimeType: null,
        imageSize: null,
        imageWidth: null,
        imageHeight: null,
      },
    });
  }

  static async delete(id: string, ownerId: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new ApiError(404, "Product not found");
    if (product.ownerId !== ownerId) throw new ApiError(403, "Not authorized");

    return prisma.product.delete({ where: { id } });
  }
}
