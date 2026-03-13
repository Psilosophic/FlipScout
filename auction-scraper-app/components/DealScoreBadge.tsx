"use client";

interface DealScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function DealScoreBadge({ score, size = "md" }: DealScoreBadgeProps) {
  const label =
    score >= 75 ? "Hot Deal" : score >= 50 ? "Good Deal" : score >= 25 ? "Fair" : "Low";

  const colorClass =
    score >= 75
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : score >= 50
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : score >= 25
      ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

  const dotClass =
    score >= 75
      ? "bg-emerald-400"
      : score >= 50
      ? "bg-amber-400"
      : score >= 25
      ? "bg-blue-400"
      : "bg-zinc-500";

  const sizeClass =
    size === "sm"
      ? "text-xs px-1.5 py-0.5 gap-1"
      : size === "lg"
      ? "text-sm px-3 py-1.5 gap-2"
      : "text-xs px-2 py-1 gap-1.5";

  const dotSize = size === "lg" ? "w-2 h-2" : "w-1.5 h-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium font-mono ${colorClass} ${sizeClass}`}
    >
      <span className={`rounded-full ${dotClass} ${dotSize}`} />
      {score}
      {size !== "sm" && <span className="opacity-60">/ 100</span>}
      {size === "lg" && <span className="ml-1 font-sans font-semibold">{label}</span>}
    </span>
  );
}
