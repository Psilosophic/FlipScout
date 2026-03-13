"use client";

import { useState, useEffect } from "react";
import {
  X,
  Wrench,
  AlertTriangle,
  Lightbulb,
  Package,
  ExternalLink,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  TrendingUp,
  Zap,
  Search,
} from "lucide-react";
import type { AuctionListing } from "@/lib/types";
import type { RepairIntel, RepairPart, DiagnosticStep } from "@/app/api/repair-intel/route";

interface RepairIntelModalProps {
  listing: AuctionListing;
  onClose: () => void;
}

const FLIP_COLORS: Record<string, string> = {
  Excellent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Good: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Marginal: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Skip: "text-red-400 bg-red-500/10 border-red-500/30",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "text-emerald-400 bg-emerald-500/10",
  Moderate: "text-amber-400 bg-amber-500/10",
  Advanced: "text-orange-400 bg-orange-500/10",
  Expert: "text-red-400 bg-red-500/10",
};

export function RepairIntelModal({ listing, onClose }: RepairIntelModalProps) {
  const [intel, setIntel] = useState<RepairIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([0]));
  const [expandedDiag, setExpandedDiag] = useState<Set<number>>(new Set([0]));
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSource(null);

    fetch("/api/repair-intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setIntel(data.intel);
          setSource(data.source ?? "local");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Network error — please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [listing, retryCount]);

  const togglePart = (i: number) =>
    setExpandedParts((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const toggleDiag = (i: number) =>
    setExpandedDiag((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 flex-shrink-0 mt-0.5">
              <Wrench className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-foreground text-sm">Repair Intel</h2>
                {source === "ai" && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
                    <Zap className="w-2.5 h-2.5" />
                    AI Analysis
                  </span>
                )}
                {source === "local" && (
                  <span className="text-xs text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
                    Expert Rules
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{listing.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="bg-red-500/10 border border-red-500/20 rounded-full p-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Repair analysis failed</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error}</p>
              </div>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="flex items-center gap-2 text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg px-4 py-2 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          )}

          {intel && !loading && (
            <div className="space-y-5">
              {/* Summary + Flip Potential */}
              <div className="bg-muted rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm text-foreground leading-relaxed">{intel.summary}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${FLIP_COLORS[intel.flipPotential] ?? FLIP_COLORS.Marginal}`}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    {intel.flipPotential} Flip Potential
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" />
                    Repair est. <span className="text-foreground font-mono font-semibold">{intel.repairEstimateTotal}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-foreground font-mono font-semibold">{intel.estimatedRepairTime}</span>
                  </div>
                </div>
                {intel.flipRationale && (
                  <p className="text-xs text-muted-foreground italic">{intel.flipRationale}</p>
                )}
              </div>

              {/* Diagnostics */}
              {intel.diagnostics?.length > 0 && (
                <Section icon={<Search className="w-4 h-4 text-primary" />} title="Diagnostic Breakdown">
                  <div className="space-y-2">
                    {intel.diagnostics.map((diag, i) => (
                      <DiagnosticCard
                        key={i}
                        diag={diag}
                        expanded={expandedDiag.has(i)}
                        onToggle={() => toggleDiag(i)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Parts */}
              {intel.parts?.length > 0 && (
                <Section icon={<Package className="w-4 h-4 text-primary" />} title="Parts & Sourcing">
                  <div className="space-y-2">
                    {intel.parts.map((part, i) => (
                      <PartCard
                        key={i}
                        part={part}
                        expanded={expandedParts.has(i)}
                        onToggle={() => togglePart(i)}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Warnings */}
              {intel.warnings?.length > 0 && (
                <Section icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} title="Watch Out For">
                  <ul className="space-y-2">
                    {intel.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Pro Tips */}
              {intel.proTips?.length > 0 && (
                <Section icon={<Lightbulb className="w-4 h-4 text-emerald-400" />} title="Pro Tips">
                  <ul className="space-y-2">
                    {intel.proTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Footer action */}
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3 text-sm font-semibold transition-colors mt-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Listing on Nellis Auctions
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DiagnosticCard({ diag, expanded, onToggle }: { diag: DiagnosticStep; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-muted border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/80 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${DIFFICULTY_COLORS[diag.difficultyRating] ?? "text-muted-foreground bg-muted"}`}>
            {diag.difficultyRating}
          </span>
          <span className="text-sm font-medium text-foreground truncate">{diag.issue}</span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          <div className="pt-3">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Likely causes:</p>
            <ul className="space-y-1">
              {diag.likelyCauses.map((cause, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  {cause}
                </li>
              ))}
            </ul>
          </div>
          {diag.toolsRequired?.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tools needed:</p>
              <div className="flex flex-wrap gap-1">
                {diag.toolsRequired.map((tool, i) => (
                  <span key={i} className="text-xs bg-secondary border border-border rounded-md px-1.5 py-0.5 text-foreground">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartCard({ part, expanded, onToggle }: { part: RepairPart; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-muted border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{part.name}</span>
            {part.canBe3dPrinted && (
              <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-1.5 py-0.5 flex-shrink-0">
                <Printer className="w-3 h-3" />
                3D Printable
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs font-mono text-emerald-400 font-semibold">{part.estimatedCost}</span>
            <span className="text-xs text-muted-foreground">{part.shippingEstimate}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Sources */}
          {part.sources?.length > 0 && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Where to buy:</p>
              <div className="space-y-1.5">
                {part.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 bg-secondary border border-border rounded-lg px-2.5 py-2 hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{src.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{src.note}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 3D Print info */}
          {part.canBe3dPrinted && part.printNotes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-primary" />
                3D Print Notes:
              </p>
              <p className="text-xs text-muted-foreground">{part.printNotes}</p>
            </div>
          )}

          {/* STL files */}
          {(part.stlFiles?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-primary" />
                STL Files Found:
              </p>
              <div className="space-y-1.5">
                {part.stlFiles!.map((stl, i) => (
                  <a
                    key={i}
                    href={stl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-2 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-primary group-hover:underline">{stl.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{stl.community}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-primary flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-muted rounded-xl p-4 space-y-2">
        <div className="h-3 bg-secondary rounded w-full" />
        <div className="h-3 bg-secondary rounded w-5/6" />
        <div className="h-3 bg-secondary rounded w-4/6" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 bg-secondary rounded-lg w-32" />
          <div className="h-6 bg-secondary rounded-lg w-24" />
        </div>
      </div>
      <div>
        <div className="h-4 bg-secondary rounded w-40 mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-muted border border-border rounded-xl" />
          <div className="h-12 bg-muted border border-border rounded-xl" />
        </div>
      </div>
      <div>
        <div className="h-4 bg-secondary rounded w-36 mb-3" />
        <div className="space-y-2">
          <div className="h-14 bg-muted border border-border rounded-xl" />
          <div className="h-14 bg-muted border border-border rounded-xl" />
          <div className="h-14 bg-muted border border-border rounded-xl" />
        </div>
      </div>
      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground animate-pulse">Analyzing repair potential...</p>
      </div>
    </div>
  );
}
