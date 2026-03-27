import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma/client";
import { ApiError } from "../utils/ApiError";
import { sendPasswordResetEmail } from "../utils/email";

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

  static async forgotPassword(email: string): Promise<void> {
    // Always return success to avoid user enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashed = await bcrypt.hash(otp, 10);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashed, passwordResetExpiry: expiry },
    });

    await sendPasswordResetEmail(email, otp);
  }

  static async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      throw new ApiError(400, "Invalid or expired reset code");
    }

    if (new Date() > user.passwordResetExpiry) {
      throw new ApiError(400, "Reset code has expired");
    }

    const valid = await bcrypt.compare(otp, user.passwordResetToken);
    if (!valid) {
      throw new ApiError(400, "Invalid reset code");
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });
  }

  private static generateToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  }
}
