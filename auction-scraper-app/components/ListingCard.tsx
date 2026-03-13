"use client";

import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Calculator,
  ExternalLink,
  MapPin,
  Tag,
  Wrench,
} from "lucide-react";
import { DealScoreBadge } from "@/components/DealScoreBadge";
import { Countdown } from "@/components/Countdown";
import { ProfitCalculator } from "@/components/ProfitCalculator";
import { RepairIntelModal } from "@/components/RepairIntelModal";
import type { AuctionListing } from "@/lib/types";

interface ListingCardProps {
  listing: AuctionListing;
  isWatched: boolean;
  onToggleWatch: (id: string) => void;
}

export function ListingCard({
  listing,
  isWatched,
  onToggleWatch,
}: ListingCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [showRepairIntel, setShowRepairIntel] = useState(false);

  const savingsPct =
    listing.retailValue > 0
      ? Math.round(
          ((listing.retailValue - listing.currentBid) / listing.retailValue) *
            100
        )
      : 0;

  return (
    <>
      <article className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition-colors group">
        {/* Image */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://placehold.co/400x280?text=No+Image+Available";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
          {/* Score overlay */}
          <div className="absolute top-2 left-2">
            <DealScoreBadge score={listing.dealScore} size="sm" />
          </div>
          {/* Watch button */}
          <button
            onClick={() => onToggleWatch(listing.id)}
            className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
              isWatched
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-black/40 text-white/70 border border-white/10 hover:text-white"
            }`}
            aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          >
            {isWatched ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Savings badge */}
          {savingsPct > 0 && (
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                -{savingsPct}% off retail
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* Title */}
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {listing.title}
          </h3>

          {/* Keywords */}
          {listing.damageKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {listing.damageKeywords.slice(0, 3).map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md px-1.5 py-0.5"
                >
                  {kw}
                </span>
              ))}
              {listing.damageKeywords.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{listing.damageKeywords.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Current Bid" value={`$${listing.currentBid}`} highlight />
            <Stat label="Retail Value" value={`$${listing.retailValue > 0 ? listing.retailValue.toLocaleString() : "?"}`} />
            <Stat
              label="Est. Profit"
              value={`${listing.estimatedProfit >= 0 ? "+" : ""}$${listing.estimatedProfit}`}
              color={listing.estimatedProfit > 0 ? "emerald" : "red"}
            />
            <Stat label={`Buyer's Prem.`} value={`${listing.buyersPremium ?? 15}%`} color="amber" />
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {listing.location}
            </div>
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>#{listing.lotNumber}</span>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Ends in</span>
            <Countdown endsAt={listing.endsAt} />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            {/* Repair Intel — primary CTA */}
            <button
              onClick={() => setShowRepairIntel(true)}
              className="flex items-center gap-1.5 w-full justify-center text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 rounded-lg py-2 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              Repair Intel
            </button>
            {/* Secondary row */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCalc(true)}
                className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-lg py-2 transition-colors"
              >
                <Calculator className="w-3.5 h-3.5" />
                Profit Calc
              </button>
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 flex-1 justify-center text-xs font-semibold rounded-lg py-2 transition-colors bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on Nellis
              </a>
            </div>
          </div>
        </div>
      </article>

      {showCalc && (
        <ProfitCalculator listing={listing} onClose={() => setShowCalc(false)} />
      )}
      {showRepairIntel && (
        <RepairIntelModal listing={listing} onClose={() => setShowRepairIntel(false)} />
      )}
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  highlight?: boolean;
  color?: "emerald" | "red" | "amber";
}

function Stat({ label, value, highlight, color }: StatProps) {
  const valueClass = color
    ? color === "emerald"
      ? "text-emerald-400"
      : color === "red"
      ? "text-red-400"
      : "text-amber-400"
    : highlight
    ? "text-foreground"
    : "text-muted-foreground";
  return (
    <div className="bg-muted rounded-lg px-2.5 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-mono font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
