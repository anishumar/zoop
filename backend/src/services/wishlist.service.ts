import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";

export class WishlistService {
  static async toggle(userId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: { userId, productId }
      }
    });

    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      return { wishlisted: false };
    } else {
      await prisma.wishlist.create({ data: { userId, productId } });
      return { wishlisted: true };
    }
  }

  static async getMyWishlist(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.wishlist.count({ where: { userId } }),
    ]);

    return {
      products: items.map(item => item.product),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getStatus(userId: string, productId: string) {
    const existing = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return { wishlisted: !!existing };
  }
}
