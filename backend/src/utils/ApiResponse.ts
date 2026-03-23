import { Response } from "express";

export function sendSuccess(res: Response, data: unknown, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(res: Response, message = "Something went wrong", statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
}
