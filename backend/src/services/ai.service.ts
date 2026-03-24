import { ApiError } from "../utils/ApiError";

export interface ProductAiSummary {
  headline: string;
  highlights: string[];
  bestFor: string;
  hostPitch: string;
}

export interface ReplySuggestion {
  suggestedReply: string;
  reasoning: string;
  followUpPrompt: string;
}

export interface EngagementSummary {
  summary: string;
  topSignals: string[];
  productMomentum: string;
  hostTip: string;
}

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "AI features are not configured yet. Add GEMINI_API_KEY to enable them.");
  }
  return apiKey;
}

function getModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function extractJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new ApiError(502, "AI response could not be parsed.");
    }

    return JSON.parse(content.slice(start, end + 1));
  }
}

function extractTextFromGemini(payload: any) {
  const blockedReason = payload?.promptFeedback?.blockReason;
  if (blockedReason) {
    throw new ApiError(400, `Gemini blocked this prompt: ${blockedReason}`);
  }

  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new ApiError(502, "Gemini response was empty.");
  }

  const text = parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new ApiError(502, "Gemini response was empty.");
  }

  return text;
}

async function callGemini<T>(systemInstruction: string, userPrompt: unknown) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent`,
    {
    method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getApiKey(),
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            parts: [{ text: typeof userPrompt === "string" ? userPrompt : JSON.stringify(userPrompt) }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const payload: any = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message || "Failed to generate Gemini response. Please try again in a moment.";
    throw new ApiError(response.status, message);
  }

  return extractJson(extractTextFromGemini(payload)) as T;
}

export class AiService {
  static async generateProductSummary(input: {
    title: string;
    price: number;
    quantity: number;
    sizes: string[];
    imageUrl?: string | null;
  }) {
    return callGemini<ProductAiSummary>(
      "You write concise, persuasive live-commerce product copy for Indian shoppers. Reply only as JSON with keys headline, highlights, bestFor, hostPitch. highlights must be an array of exactly 3 short bullet strings.",
      {
        task: "Generate a concise live-commerce product summary for the host and viewer.",
        product: input,
        requirements: {
          tone: "helpful, punchy, trustworthy",
          avoid: ["fake claims", "unsupported guarantees", "markdown"],
        },
      }
    );
  }

  static async generateReplySuggestion(input: {
    sessionTitle: string;
    question: string;
    hostName?: string | null;
    products: Array<{ title: string; price: number; quantity: number; sizes: string[] }>;
  }) {
    return callGemini<ReplySuggestion>(
      "You help a live-commerce host answer viewer questions clearly and honestly. Reply only as JSON with keys suggestedReply, reasoning, followUpPrompt. Keep suggestedReply under 45 words and never invent facts beyond the provided product context.",
      {
        task: "Draft a host reply suggestion for a live commerce session.",
        context: input,
      }
    );
  }

  static async generateEngagementSummary(input: {
    sessionTitle: string;
    viewerCount: number;
    peakViewers: number;
    reactionCount: number;
    questionCount: number;
    messages: string[];
    products: Array<{ title: string; price: number; quantity: number; sizes: string[] }>;
  }) {
    return callGemini<EngagementSummary>(
      "You summarize live-commerce engagement for the host. Reply only as JSON with keys summary, topSignals, productMomentum, hostTip. topSignals must be an array of exactly 3 short insights.",
      {
        task: "Summarize what happened in this live session and suggest the next best host move.",
        analytics: input,
      }
    );
  }
}
