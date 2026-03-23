import { Request, Response } from "express";
import { SessionService } from "../services/session.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";

export const createSession = catchAsync(async (req: Request, res: Response) => {
  const session = await SessionService.create(req.user!.userId, req.body);
  sendSuccess(res, session, "Live session started", 201);
});

export const endSession = catchAsync(async (req: Request, res: Response) => {
  const session = await SessionService.endSession(String(req.params.id), req.user!.userId);
  sendSuccess(res, session, "Live session ended");
});

export const listLiveSessions = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await SessionService.listLive(page, limit);
  sendSuccess(res, result);
});

export const getSession = catchAsync(async (req: Request, res: Response) => {
  const session = await SessionService.getById(String(req.params.id));
  sendSuccess(res, session);
});

export const addProductToSession = catchAsync(async (req: Request, res: Response) => {
  const result = await SessionService.addProduct(String(req.params.id), req.body.productId, req.user!.userId);
  sendSuccess(res, result, "Product added to session", 201);
});

export const removeProductFromSession = catchAsync(async (req: Request, res: Response) => {
  await SessionService.removeProduct(String(req.params.id), req.body.productId, req.user!.userId);
  sendSuccess(res, null, "Product removed from session");
});

export const getSessionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const analytics = await SessionService.getAnalytics(String(req.params.id));
  sendSuccess(res, analytics);
});
