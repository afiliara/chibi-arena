import { formatUnits } from "viem";

export function formatToken(value?: bigint, decimals = 18, fractionDigits = 2) {
  if (value === undefined) {
    return "0";
  }

  const numeric = Number(formatUnits(value, decimals));
  if (Number.isNaN(numeric)) {
    return "0";
  }

  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCompactNumber(value?: bigint, decimals = 18, fractionDigits = 2) {
  if (value === undefined) {
    return "0";
  }

  const numeric = Number(formatUnits(value, decimals));
  if (Number.isNaN(numeric)) {
    return "0";
  }

  return numeric.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCountdown(targetUnixSeconds?: number) {
  if (!targetUnixSeconds) {
    return "--:--";
  }

  const diff = Math.max(targetUnixSeconds - Math.floor(Date.now() / 1000), 0);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
