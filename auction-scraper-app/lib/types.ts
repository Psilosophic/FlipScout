// Shared types used by both server routes and client components.
// Keep this file free of server-only imports.

export interface AuctionListing {
  id: string;
  title: string;
  currentBid: number;
  retailValue: number;
  estimatedProfit: number;
  buyersPremium: number;
  dealScore: number;
  damageKeywords: string[];
  imageUrl: string;
  url: string;
  location: string;
  lotNumber: string;
  endsAt: string;
  bids: number;
  category: string;
  condition: string;
  isRealData: boolean;
}
