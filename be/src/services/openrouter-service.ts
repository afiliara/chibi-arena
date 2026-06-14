import { config } from "../config.js";
import type { AgentDecision, AgentProfile, MarketSnapshot } from "../types.js";

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

const FALLBACK_DECISION: AgentDecision = {
  action: "HOLD",
  asset: "BTC",
  confidence: 0,
  rationale: "Invalid model output fallback",
};

export class OpenRouterService {
  async generateDecision(agent: AgentProfile, roundId: bigint, snapshot: MarketSnapshot): Promise<AgentDecision> {
    const body = {
      model: config.OPENROUTER_MODEL,
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You are an internal trading arena agent. Return valid JSON only with keys action, asset, confidence, rationale. Action must be LONG, SHORT, or HOLD. Asset must be BTC, ETH, or SOL. Confidence must be an integer 0-100. Rationale must be one short sentence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            round_id: roundId.toString(),
            virtual_bankroll: "1000 USDC",
            agent_name: agent.name,
            personality: agent.personality,
            trading_style: agent.tradingStyle,
            market_snapshot: {
              BTC: snapshot.prices.BTC,
              ETH: snapshot.prices.ETH,
              SOL: snapshot.prices.SOL,
            },
          }),
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.OPENROUTER_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": config.OPENROUTER_HTTP_REFERER,
          "X-Title": config.OPENROUTER_APP_NAME,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter request failed with status ${response.status}`);
      }

      const payload = await response.json() as OpenRouterResponse;
      return parseDecision(extractContent(payload));
    } catch {
      return FALLBACK_DECISION;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractContent(payload: OpenRouterResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("");
  }

  return "";
}

function parseDecision(content: string): AgentDecision {
  try {
    const normalized = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(normalized) as Partial<AgentDecision>;

    if (!isValidAction(parsed.action) || !isValidAsset(parsed.asset)) {
      return FALLBACK_DECISION;
    }

    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
      : 0;

    return {
      action: parsed.action,
      asset: parsed.asset,
      confidence,
      rationale: typeof parsed.rationale === "string" && parsed.rationale.trim().length > 0
        ? parsed.rationale.trim()
        : FALLBACK_DECISION.rationale,
    };
  } catch {
    return FALLBACK_DECISION;
  }
}

function isValidAction(value: unknown): value is AgentDecision["action"] {
  return value === "LONG" || value === "SHORT" || value === "HOLD";
}

function isValidAsset(value: unknown): value is AgentDecision["asset"] {
  return value === "BTC" || value === "ETH" || value === "SOL";
}
