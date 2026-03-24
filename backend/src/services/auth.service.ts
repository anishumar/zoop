import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";

const SALT_ROUNDS = 10;

const USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  bio: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
};

export class AuthService {
  static async signup(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: USER_FIELDS,
    });

    const token = AuthService.generateToken(user.id);
    return { user, token };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = AuthService.generateToken(user.id);
    const { password: _, ...safeUser } = user;
    return {
      user: safeUser,
      token,
    };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_FIELDS,
    });
    if (!user) throw new ApiError(404, "User not found");
    return user;
  }

  private static generateToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  }
}
