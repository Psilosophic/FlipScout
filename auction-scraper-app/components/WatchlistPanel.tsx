"use client";

import { Bookmark, ExternalLink, TrendingUp, X } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { DealScoreBadge } from "@/components/DealScoreBadge";
import type { AuctionListing } from "@/lib/types";

interface WatchlistPanelProps {
  items: AuctionListing[];
  onRemove: (id: string) => void;
}

export function WatchlistPanel({ items, onRemove }: WatchlistPanelProps) {
  return (
    <aside className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Bookmark className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
        {items.length > 0 && (
          <span className="ml-auto bg-primary/20 text-primary text-xs font-mono rounded-full px-2 py-0.5">
            {items.length}
          </span>
        )}
      </div>

      {/* Empty */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
          <Bookmark className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            Bookmark listings to track them here
          </p>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col divide-y divide-border overflow-y-auto max-h-[600px]">
        {items.map((item) => (
          <div key={item.id} className="p-3 hover:bg-muted/40 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs text-foreground line-clamp-2 flex-1 leading-snug">
                {item.title}
              </p>
              <button
                onClick={() => onRemove(item.id)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Remove from watchlist"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <DealScoreBadge score={item.dealScore} size="sm" />
              <span className="text-xs font-mono font-semibold text-foreground">
                ${item.currentBid}
              </span>
              <Countdown endsAt={item.endsAt} />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 transition-colors"
                aria-label="Open listing"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span>Portfolio Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-lg px-2.5 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Total Bids</p>
              <p className="text-sm font-mono font-semibold text-foreground">
                $
                {items.reduce((s, i) => s + i.currentBid, 0)}
              </p>
            </div>
            <div className="bg-muted rounded-lg px-2.5 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Est. Profit</p>
              <p
                className={`text-sm font-mono font-semibold ${
                  items.reduce((s, i) => s + i.estimatedProfit, 0) > 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                +$
                {items
                  .reduce((s, i) => s + Math.max(0, i.estimatedProfit), 0)
                  .toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
