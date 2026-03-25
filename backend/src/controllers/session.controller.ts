import { Request, Response } from "express";
import { SessionService } from "../services/session.service";
import { AiService } from "../services/ai.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

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

export const listLiveFollowingSessions = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await SessionService.listLiveFollowing(req.user!.userId, page, limit);
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

export const generateAiReplySuggestion = catchAsync(async (req: Request, res: Response) => {
  const session = await SessionService.getById(String(req.params.id));

  if (session.hostId !== req.user!.userId) {
    throw new ApiError(403, "Only the host can generate AI replies");
  }

  const question = String(req.body.question || "").trim();
  if (!question) {
    throw new ApiError(400, "Question is required");
  }

  const suggestion = await AiService.generateReplySuggestion({
    sessionTitle: session.title,
    question,
    hostName: session.host?.name,
    products: (session.sessionProducts || []).map((entry) => ({
      title: entry.product.title,
      price: entry.product.price,
      quantity: entry.product.quantity,
      sizes: entry.product.sizes,
    })),
  });

  sendSuccess(res, suggestion, "AI reply suggestion generated");
});

export const generateAiEngagementSummary = catchAsync(async (req: Request, res: Response) => {
  const session = await SessionService.getById(String(req.params.id));

  if (session.hostId !== req.user!.userId) {
    throw new ApiError(403, "Only the host can generate AI insights");
  }

  const analytics = await SessionService.getAnalytics(String(req.params.id));

  const summary = await AiService.generateEngagementSummary({
    sessionTitle: session.title,
    viewerCount: session.viewerCount,
    peakViewers: session.peakViewers,
    reactionCount: analytics.reactionCount,
    questionCount: analytics.questionCount,
    messages: (session.messages || []).slice(0, 20).map((message) => `${message.user.name}: ${message.content}`),
    products: (session.sessionProducts || []).map((entry) => ({
      title: entry.product.title,
      price: entry.product.price,
      quantity: entry.product.quantity,
      sizes: entry.product.sizes,
    })),
  });

  sendSuccess(res, summary, "AI engagement summary generated");
});

export const getUserArchivedSessions = catchAsync(async (req: Request, res: Response) => {
  const hostId = String(req.params.hostId);
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 20;
  const result = await SessionService.listUserArchived(hostId, page, limit);
  sendSuccess(res, result);
});
