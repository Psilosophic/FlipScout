"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import type { AuctionListing } from "@/app/api/scrape/route";

interface ProfitCalculatorProps {
  listing: AuctionListing;
  onClose: () => void;
}

export function ProfitCalculator({ listing, onClose }: ProfitCalculatorProps) {
  const [buyPrice, setBuyPrice] = useState(listing.currentBid);
  const [repairCost, setRepairCost] = useState(
    Math.round(listing.retailValue * 0.12)
  );
  const [resalePrice, setResalePrice] = useState(
    Math.round(listing.retailValue * 0.65)
  );
  const [platformFee, setPlatformFee] = useState(13); // % eBay default

  const feeAmount = Math.round((resalePrice * platformFee) / 100);
  const profit = resalePrice - buyPrice - repairCost - feeAmount;
  const roi =
    buyPrice + repairCost > 0
      ? Math.round((profit / (buyPrice + repairCost)) * 100)
      : 0;

  const profitColor =
    profit > 100
      ? "text-emerald-400"
      : profit > 0
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">
              Profit Calculator
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {listing.title}
          </p>
        </div>

        {/* Inputs */}
        <div className="px-5 pb-5 space-y-3">
          <CalcRow
            label="Your Max Bid"
            prefix="$"
            value={buyPrice}
            onChange={setBuyPrice}
          />
          <CalcRow
            label="Estimated Repair Cost"
            prefix="$"
            value={repairCost}
            onChange={setRepairCost}
          />
          <CalcRow
            label="Expected Resale Price"
            prefix="$"
            value={resalePrice}
            onChange={setResalePrice}
          />
          <CalcRow
            label="Platform Fee"
            suffix="%"
            value={platformFee}
            onChange={setPlatformFee}
            max={50}
          />

          {/* Divider */}
          <div className="border-t border-border pt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Platform fee amount</span>
              <span className="text-xs font-mono text-foreground">-${feeAmount}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Total invested</span>
              <span className="text-xs font-mono text-foreground">
                ${buyPrice + repairCost + feeAmount}
              </span>
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="font-semibold text-sm text-foreground">Net Profit</span>
              <span className={`font-mono font-bold text-lg ${profitColor}`}>
                {profit >= 0 ? "+" : ""}${profit}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">ROI</span>
              <span className={`text-xs font-mono font-semibold ${profitColor}`}>
                {roi >= 0 ? "+" : ""}{roi}%
              </span>
            </div>
          </div>

          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors mt-2"
          >
            View on Nellis Auctions
          </a>
        </div>
      </div>
    </div>
  );
}

interface CalcRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
}

function CalcRow({ label, value, onChange, prefix, suffix, max = 99999 }: CalcRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-xs text-muted-foreground flex-1">{label}</label>
      <div className="flex items-center gap-1 bg-muted border border-border rounded-lg px-2.5 py-1.5">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value}
          min={0}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 bg-transparent text-xs font-mono text-foreground focus:outline-none text-right"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
