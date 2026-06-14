import { keccak256, stringToHex } from "viem";

const AGENT_SPRITES = {
  AGGRESSIVE: "/blitz.png",
  MOMENTUM: "/nova.png",
  ANALYST: "/byte.png",
  CONSERVATIVE: "/zenith.png",
} as const;

export type AgentProfileInput = {
  name: string;
  personality: keyof typeof AGENT_SPRITES;
  tradingStyle: string;
};

export type AgentMetadata = {
  name: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
};

export function buildAgentMetadataUri(input: AgentProfileInput) {
  const payload: AgentMetadata = {
    name: input.name,
    description: `M2 Arena agent using ${input.personality.toLowerCase()} persona and ${input.tradingStyle} strategy.`,
    image: AGENT_SPRITES[input.personality],
    attributes: [
      { trait_type: "Personality", value: input.personality },
      { trait_type: "Trading Style", value: input.tradingStyle },
    ],
  };

  return `data:application/json;utf8,${encodeURIComponent(JSON.stringify(payload))}`;
}

export function buildAgentConfigHash(input: AgentProfileInput) {
  return keccak256(
    stringToHex(
      JSON.stringify({
        name: input.name,
        personality: input.personality,
        tradingStyle: input.tradingStyle,
      }),
    ),
  );
}

export function decodeAgentMetadataUri(uri?: string | null): AgentMetadata | null {
  if (!uri) {
    return null;
  }

  if (uri.startsWith("data:application/json;utf8,")) {
    try {
      const raw = uri.replace("data:application/json;utf8,", "");
      return JSON.parse(decodeURIComponent(raw)) as AgentMetadata;
    } catch {
      return null;
    }
  }

  return null;
}
