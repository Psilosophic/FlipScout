"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  SlidersHorizontal,
  TrendingUp,
  Gavel,
  Zap,
  ChevronDown,
  MapPin,
  WifiOff,
  Radio,
  ExternalLink,
  Info,
} from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import type { AuctionListing } from "@/lib/types";
import { NELLIS_LOCATIONS, DEFAULT_LOCATION } from "@/lib/nellis-constants";

const CATEGORIES = ["All", "Electronics", "Power Tools", "Appliances", "Home Improvement", "Automotive"];
const SORT_OPTIONS = [
  { value: "score", label: "Best Deal Score" },
  { value: "profit", label: "Highest Est. Profit" },
  { value: "price_asc", label: "Lowest Bid First" },
  { value: "price_desc", label: "Highest Bid First" },
  { value: "ending", label: "Ending Soonest" },
];

export default function FlipScoutPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("score");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRealData, setIsRealData] = useState(false);

  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("flipscout_watchlist");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, category, sort, location });
      const res = await fetch(`/api/scrape?${params}`);
      const data = await res.json();
      setListings(data.listings ?? []);
      setIsRealData(data.isRealData ?? false);
      setLastFetched(new Date());
    } catch (e) {
      console.error("Failed to fetch listings", e);
    } finally {
      setLoading(false);
    }
  }, [query, category, sort, location]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const toggleWatch = useCallback((id: string) => {
    setWatchedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("flipscout_watchlist", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const watchedListings = listings.filter((l) => watchedIds.has(l.id));
  const hotDeals = listings.filter((l) => l.dealScore >= 75).length;
  const avgScore =
    listings.length > 0
      ? Math.round(listings.reduce((s, l) => s + l.dealScore, 0) / listings.length)
      : 0;
  const totalEstProfit = listings
    .filter((l) => l.estimatedProfit > 0)
    .reduce((s, l) => s + l.estimatedProfit, 0);

  const activeLocationLabel =
    NELLIS_LOCATIONS.find((l) => l.value === location)?.label ?? location;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Gavel className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm tracking-tight">FlipScout</span>
            <span className="hidden sm:inline text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Nellis Auctions
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live data indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                isRealData
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : "text-amber-400 border-amber-500/30 bg-amber-500/10"
              }`}
            >
              {isRealData ? <Radio className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isRealData ? "Live Data" : "Demo Mode"}
            </div>

            {lastFetched && (
              <span className="hidden lg:inline text-xs text-muted-foreground">
                {lastFetched.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={fetchListings}
              disabled={loading}
              className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Open Nellis */}
            <a
              href="https://www.nellisauction.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Nellis</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Demo mode banner — explains WHY and what to do */}
        {!isRealData && !loading && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Demo Mode — showing sample listings</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The scraper couldn&apos;t reach Nellis or returned no results.
                  This can happen if Nellis is temporarily blocking requests.{" "}
                  <span className="text-foreground font-medium">Try refreshing or changing the search query.</span>
                </p>
              </div>
            </div>
            <button
              onClick={fetchListings}
              className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-lg px-3 py-2 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}


        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Zap className="w-4 h-4 text-primary" />} label="Listings Found" value={String(listings.length)} />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Hot Deals" value={String(hotDeals)} valueClass="text-emerald-400" />
          <StatCard icon={<SlidersHorizontal className="w-4 h-4 text-amber-400" />} label="Avg Deal Score" value={String(avgScore)} valueClass="text-amber-400" />
          <StatCard icon={<Gavel className="w-4 h-4 text-primary" />} label="Total Est. Profit" value={`$${totalEstProfit.toLocaleString()}`} valueClass="text-emerald-400" />
        </div>

        {/* Search & Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col gap-3">
          {/* Row 1: Location + Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Location dropdown */}
            <div className="relative flex-shrink-0 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg pl-3 pr-8 py-2">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="appearance-none bg-transparent text-sm font-medium text-primary focus:outline-none cursor-pointer w-full min-w-[160px]"
                  aria-label="Select Nellis Auction location"
                >
                  {NELLIS_LOCATIONS.map((loc) => (
                    <option key={loc.value} value={loc.value} className="bg-card text-foreground">
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
            </div>

            {/* Search input */}
            <div className="flex items-center gap-2 flex-1 bg-muted border border-border rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Search listings (e.g. TV, drill, laptop...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchListings()}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Category pills + Sort */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex gap-1.5 flex-wrap flex-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                    category === cat
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none bg-muted border border-border rounded-lg pl-3 pr-8 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40 cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Listings grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-video bg-muted" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-12 bg-muted rounded-lg" />
                        <div className="h-12 bg-muted rounded-lg" />
                        <div className="h-12 bg-muted rounded-lg" />
                        <div className="h-12 bg-muted rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Search className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  No listings found in {activeLocationLabel}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Try a different keyword, category, or location
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-semibold text-foreground">
                      {listings.length} listings in{" "}
                      <span className="text-primary">{activeLocationLabel}</span>
                    </h1>
                    {!isRealData && (
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md px-1.5 py-0.5">
                        demo data
                      </span>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      75+ Hot Deal
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      50+ Good Deal
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isWatched={watchedIds.has(listing.id)}
                      onToggleWatch={toggleWatch}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Watchlist sidebar */}
          <div className="lg:w-72 flex-shrink-0">
            <WatchlistPanel items={watchedListings} onRemove={toggleWatch} />
          </div>
        </div>
      </main>

    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}

function StatCard({ icon, label, value, valueClass = "text-foreground" }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="bg-muted rounded-lg p-2 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-mono font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
