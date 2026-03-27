import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required");
  }
  const result = await AuthService.signup(name, email, password);
  sendSuccess(res, result, "Account created successfully", 201);
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  const result = await AuthService.login(email, password);
  sendSuccess(res, result, "Login successful");
});

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.getProfile(req.user!.userId);
  sendSuccess(res, user);
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");
  await AuthService.forgotPassword(email.trim().toLowerCase());
  sendSuccess(res, null, "If that email exists, a reset code has been sent");
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, code, and new password are required");
  }
  if (newPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }
  await AuthService.resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
  sendSuccess(res, null, "Password reset successfully");
});
