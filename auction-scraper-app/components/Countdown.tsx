"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  endsAt: string;
}

function getTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
  const h = Math.floor(diff / 1000 / 3600);
  const m = Math.floor((diff / 1000 / 60) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { h, m, s, expired: false };
}

export function Countdown({ endsAt }: CountdownProps) {
  const [time, setTime] = useState(getTimeLeft(endsAt));

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (time.expired) {
    return <span className="text-xs text-destructive-foreground font-mono">Ended</span>;
  }

  const urgent = time.h === 0 && time.m < 30;

  return (
    <span
      className={`font-mono text-xs tabular-nums ${
        urgent ? "text-amber-400" : "text-muted-foreground"
      }`}
    >
      {String(time.h).padStart(2, "0")}:{String(time.m).padStart(2, "0")}:
      {String(time.s).padStart(2, "0")}
    </span>
  );
}
