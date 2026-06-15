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
    return "--H --M";
  }

  const diff = Math.max(targetUnixSeconds - Math.floor(Date.now() / 1000), 0);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${hours}H ${minutes}M`;
}
