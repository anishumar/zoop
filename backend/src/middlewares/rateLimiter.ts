import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

// Simple in-memory rate limiter (swap with Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

type RateLimitKeyFn = (req: Request) => string;

export function rateLimiter(
  maxRequests = 100,
  windowMs = 60_000,
  keyFn?: RateLimitKeyFn
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = keyFn?.(req) || req.ip || "unknown";
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      throw new ApiError(429, "Too many requests, please try again later");
    }

    record.count++;
    next();
  };
}
