import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  bio: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
};

export class UserService {
  /**
   * Follow a user. Creates a Follow record.
   */
  static async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ApiError(400, "You cannot follow yourself");
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existing) {
      throw new ApiError(409, "Already following this user");
    }

    await prisma.follow.create({
      data: { followerId, followingId },
    });

    return { followed: true, userId: followingId };
  }

  /**
   * Unfollow a user. Deletes the Follow record.
   */
  static async unfollow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ApiError(400, "You cannot unfollow yourself");
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (!existing) {
      throw new ApiError(404, "You are not following this user");
    }

    await prisma.follow.delete({
      where: { id: existing.id },
    });

    return { followed: false, userId: followingId };
  }

  /**
   * Get list of users the authenticated user is following.
   */
  static async getFollowing(userId: string) {
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      users: follows.map((f) => f.following),
      total: follows.length,
    };
  }

  /**
   * Get list of users who follow the authenticated user (followers).
   */
  static async getFollowers(userId: string) {
    const follows = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      users: follows.map((f) => f.follower),
      total: follows.length,
    };
  }

  /**
   * Check if the authenticated user is following a specific user.
   */
  static async isFollowing(followerId: string, followingId: string) {
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    return { isFollowing: Boolean(existing) };
  }

  /**
   * Search users by name (case-insensitive prefix/contains match).
   */
  static async searchByName(query: string, limit = 20) {
    const q = query.trim();
    if (!q) return { users: [] };

    const users = await prisma.user.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, avatarUrl: true, bio: true },
      take: limit,
      orderBy: { name: "asc" },
    });

    return { users };
  }

  /**
   * Get a user's public profile by ID, including follow counts and stream count.
   */
  static async getPublicProfile(targetId: string, requesterId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, bio: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new ApiError(404, "User not found");

    const [followerCount, followingCount, streamCount, isFollowing, productCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: targetId } }),
      prisma.follow.count({ where: { followerId: targetId } }),
      prisma.liveSession.count({ where: { hostId: targetId, recordingUrl: { not: null } } }),
      requesterId
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: requesterId, followingId: targetId } },
          }).then(Boolean)
        : Promise.resolve(false),
      prisma.product.count({ where: { ownerId: targetId } }),
    ]);

    return { ...user, followerCount, followingCount, streamCount, isFollowing, productCount };
  }

  /**
   * Update user profile fields (name, bio, phone).
   */
  static async updateProfile(
    userId: string,
    data: { name?: string; bio?: string; phone?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    const updateData: Record<string, string> = {};
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new ApiError(400, "Name cannot be empty");
      updateData.name = trimmed;
    }
    if (data.bio !== undefined) updateData.bio = data.bio.trim();
    if (data.phone !== undefined) updateData.phone = data.phone.trim();

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: USER_SELECT,
    });

    return updated;
  }

  /**
   * Update user avatar image.
   */
  static async updateAvatar(
    userId: string,
    data: { avatarKey: string; avatarUrl: string }
  ) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarKey: data.avatarKey,
        avatarUrl: data.avatarUrl,
      },
      select: USER_SELECT,
    });

    return updated;
  }
}
