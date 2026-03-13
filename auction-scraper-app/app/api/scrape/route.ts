import { NextRequest, NextResponse } from "next/server";
import { DAMAGE_KEYWORDS } from "@/lib/nellis-constants";
import type { AuctionListing } from "@/lib/types";
export type { AuctionListing };

// ─── Deal score: blends savings-vs-retail with damage keyword bonus ───────────
function calcDealScore(
  currentBid: number,
  retailValue: number,
  keywordCount: number,
  buyersPremium: number
): number {
  if (retailValue <= 0) return 0;
  const totalCost = currentBid * (1 + buyersPremium / 100);
  const savingsPct = ((retailValue - totalCost) / retailValue) * 100;
  const keywordBonus = Math.min(keywordCount * 8, 30);
  const raw = Math.min(savingsPct * 0.7 + keywordBonus, 100);
  return Math.max(0, Math.round(raw));
}

// ─── Parse dollar string → number ("$1,234.56" → 1234.56) ───────────────────
function parseDollar(str: string): number {
  const cleaned = str.replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

// ─── Real Nellis scraper ──────────────────────────────────────────────────────
// Fetches Nellis' public search page (server-side, no CORS issues) and parses
// the HTML for listing cards. Nellis renders their catalog server-side in HTML
// so we can extract data without a headless browser.
async function scrapeNellis(
  location: string,
  query: string,
  category: string,
  sort: string
): Promise<AuctionListing[]> {
  // Map our sort values to Nellis URL params
  const sortMap: Record<string, string> = {
    score: "CurrentPrice&sortOrder=asc",
    profit: "EstRetail&sortOrder=desc",
    price_asc: "CurrentPrice&sortOrder=asc",
    price_desc: "CurrentPrice&sortOrder=desc",
    ending: "EndTime&sortOrder=asc",
  };
  const nellisSortStr = sortMap[sort] || "CurrentPrice&sortOrder=asc";
  const [sortBy, sortOrderStr] = nellisSortStr.split("&sortOrder=");

  // Build the URL. Nellis uses ?location= (plain city string, we let URLSearchParams encode it).
  const baseUrl = "https://www.nellisauction.com/search";
  const params = new URLSearchParams();
  if (location) params.set("location", location);
  if (query) params.set("q", query);
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrderStr);
  // Nellis quality ratings: 1=For Parts/Not Working/Missing, filter for damaged items
  // missingParts=true is not a real param — we post-filter on keywords instead
  const url = `${baseUrl}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.nellisauction.com/",
    },
    next: { revalidate: 0 }, // always fresh
  });

  if (!res.ok) {
    console.error(`[FlipScout] Nellis fetch failed: ${res.status} ${url}`);
    return [];
  }

  const html = await res.text();

  // ── HTML parsing ──────────────────────────────────────────────────────────
  // Nellis renders listing cards as <a> elements. We use regex to pull data
  // out of the rendered HTML since we don't have a DOM parser on the edge.
  const listings: AuctionListing[] = [];

  // Extract __NEXT_DATA__ JSON blob — Nellis injects all listing data here
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );

  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Navigate to the products array — path varies by Nellis build
      const pageProps =
        nextData?.props?.pageProps ||
        nextData?.props?.initialProps?.pageProps ||
        {};
      const products: any[] =
        pageProps?.products ||
        pageProps?.searchResults?.products ||
        pageProps?.initialData?.products ||
        pageProps?.data?.products ||
        [];

      for (const p of products.slice(0, 60)) {
        const title: string = p.title || p.name || p.productName || "";
        const currentBid: number =
          p.currentPrice ?? p.currentBid ?? p.price ?? 0;
        const retailValue: number =
          p.estimatedRetail ?? p.retailValue ?? p.estRetail ?? p.retail ?? 0;
        const buyersPremium: number = p.buyersPremium ?? p.buyerPremium ?? 15;
        const bids: number = p.bidCount ?? p.bids ?? p.numberOfBids ?? 0;
        const lotNumber: string = String(
          p.lotNumber ?? p.lot ?? p.id ?? p.productId ?? ""
        );
        const id: string = String(p.id ?? p.productId ?? p.lotNumber ?? Math.random());
        const imageUrl: string =
          p.imageUrl ?? p.image ?? p.thumbnail ?? p.photo ?? "";
        const productUrl: string = p.url ?? p.productUrl ?? "";
        const fullUrl = productUrl.startsWith("http")
          ? productUrl
          : `https://www.nellisauction.com${productUrl}`;

        // Condition / quality labels
        const qualityLabels: string[] = [
          ...(p.qualityRatings ?? p.qualityLabels ?? p.conditions ?? []),
          p.condition ?? "",
          p.qualityRating ?? "",
        ]
          .filter(Boolean)
          .map((s: string) => s.toLowerCase().trim());
        const condition = qualityLabels.join(", ") || "Unknown";

        // Time remaining
        const endsAt: string =
          p.endsAt ??
          p.endTime ??
          p.auctionEndTime ??
          p.endDate ??
          new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

        // Category mapping
        const rawCategory: string =
          p.category ?? p.categoryName ?? p.productCategory ?? "";

        // Damage keyword detection across title + condition
        const combined = `${title} ${condition}`.toLowerCase();
        const foundKeywords = DAMAGE_KEYWORDS.filter((kw) =>
          combined.includes(kw.toLowerCase())
        );

        // Only include listings with at least 1 damage keyword
        if (foundKeywords.length === 0 && !query) continue;

        // Category filter
        if (
          category &&
          category !== "All" &&
          !rawCategory.toLowerCase().includes(category.toLowerCase()) &&
          !title.toLowerCase().includes(category.toLowerCase())
        ) {
          continue;
        }

        const score = calcDealScore(
          currentBid,
          retailValue,
          foundKeywords.length,
          buyersPremium
        );
        const totalCost = currentBid * (1 + buyersPremium / 100);
        const estimatedRepairCost = retailValue * 0.12;
        const estimatedResaleValue = retailValue * 0.65;
        const estimatedProfit = Math.round(
          estimatedResaleValue - totalCost - estimatedRepairCost
        );

        listings.push({
          id,
          title,
          currentBid,
          retailValue,
          buyersPremium,
          endsAt,
          imageUrl,
          url: fullUrl,
          location: p.location ?? p.locationName ?? decodeURIComponent(location),
          condition,
          damageKeywords: foundKeywords,
          dealScore: score,
          estimatedProfit,
          lotNumber,
          category: rawCategory || "General",
          bids,
          isRealData: true,
        });
      }
    } catch (e) {
      console.error("[FlipScout] Failed to parse __NEXT_DATA__:", e);
    }
  }

  // Fallback: try regex-based HTML parsing if __NEXT_DATA__ didn't yield results
  if (listings.length === 0) {
    // Match listing title blocks from the rendered HTML
    const titleMatches = [
      ...html.matchAll(/<h6[^>]*>([\s\S]*?)<\/h6>/gi),
    ];
    const priceMatches = [
      ...html.matchAll(/CURRENT PRICE[\s\S]*?\$([\d,]+\.?\d*)/gi),
    ];
    const retailMatches = [
      ...html.matchAll(/EST\. RETAIL[\s\S]*?\$([\d,]+\.?\d*)/gi),
    ];
    const bidsMatches = [...html.matchAll(/BIDS[\s\S]*?(\d+)\s*BUYER/gi)];
    const conditionMatches = [
      ...html.matchAll(/(?:Missing Parts|Untested|Partial Set|For Parts|As Is|Damaged|Broken|Unknown if Missing Parts)/gi),
    ];

    const count = Math.min(titleMatches.length, priceMatches.length, 40);
    for (let i = 0; i < count; i++) {
      const title = titleMatches[i]?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      if (!title) continue;

      const currentBid = parseDollar(priceMatches[i]?.[1] ?? "0");
      const retailValue = parseDollar(retailMatches[i]?.[1] ?? "0");
      const bids = parseInt(bidsMatches[i]?.[1] ?? "0") || 0;
      const condition = conditionMatches[i]?.[0] ?? "Unknown";
      const combined = `${title} ${condition}`.toLowerCase();
      const foundKeywords = DAMAGE_KEYWORDS.filter((kw) =>
        combined.includes(kw.toLowerCase())
      );

      if (foundKeywords.length === 0 && !query) continue;
      if (
        category &&
        category !== "All" &&
        !title.toLowerCase().includes(category.toLowerCase())
      ) continue;

      const id = `nellis-${i}-${Date.now()}`;
      const buyersPremium = 15;
      const score = calcDealScore(currentBid, retailValue, foundKeywords.length, buyersPremium);
      const totalCost = currentBid * (1 + buyersPremium / 100);
      const estimatedRepairCost = retailValue * 0.12;
      const estimatedResaleValue = retailValue * 0.65;
      const estimatedProfit = Math.round(
        estimatedResaleValue - totalCost - estimatedRepairCost
      );

      listings.push({
        id,
        title,
        currentBid,
        retailValue,
        buyersPremium,
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        imageUrl: "",
        url: `https://www.nellisauction.com/search?location=${encodeURIComponent(location)}`,
        location: location,
        condition,
        damageKeywords: foundKeywords,
        dealScore: score,
        estimatedProfit,
        lotNumber: String(i + 1),
        category: "General",
        bids,
        isRealData: true,
      });
    }
  }

  return listings;
}

// ─── Mock fallback data (used when Nellis is unreachable / returns no data) ──
function getMockListings(
  query: string,
  category: string,
  location: string
): AuctionListing[] {
  const now = Date.now();
  const locationLabel = location;

  const pool: Omit<
    AuctionListing,
    "dealScore" | "estimatedProfit" | "damageKeywords" | "isRealData"
  >[] = [
    {
      id: "MOCK-1",
      lotNumber: "88231",
      title: 'Samsung 65" QLED TV - Powers On, No Picture - Cracked Screen',
      currentBid: 42,
      retailValue: 1100,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 3).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Samsung+65+QLED+TV+cracked+screen+parts+only+dark+background",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "For Parts / Not Working",
      category: "Electronics",
      bids: 7,
    },
    {
      id: "MOCK-2",
      lotNumber: "88412",
      title: "DeWalt 20V MAX Cordless Drill Set - Missing Battery Pack",
      currentBid: 28,
      retailValue: 189,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 90).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=DeWalt+cordless+drill+missing+battery+yellow+tool+dark",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "Missing Parts",
      category: "Power Tools",
      bids: 4,
    },
    {
      id: "MOCK-3",
      lotNumber: "88566",
      title: "Apple MacBook Pro 13 2021 - Broken Keyboard, Untested",
      currentBid: 180,
      retailValue: 1299,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 6).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=MacBook+Pro+13+damaged+keyboard+silver+laptop",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "For Parts / Not Working",
      category: "Electronics",
      bids: 14,
    },
    {
      id: "MOCK-4",
      lotNumber: "88701",
      title: "Dyson V11 Vacuum - No Suction, As Is, Sold for Parts",
      currentBid: 25,
      retailValue: 550,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 10).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Dyson+V11+cordless+vacuum+for+parts+white",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "As Is",
      category: "Appliances",
      bids: 3,
    },
    {
      id: "MOCK-5",
      lotNumber: "88840",
      title: "Sony PlayStation 5 Console - No HDMI Output, Disc Drive Faulty",
      currentBid: 95,
      retailValue: 499,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 90).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Sony+PS5+white+console+faulty+HDMI+no+output",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "For Parts / Not Working",
      category: "Electronics",
      bids: 18,
    },
    {
      id: "MOCK-6",
      lotNumber: "88955",
      title: "KitchenAid Artisan Stand Mixer - Motor Dead, Cosmetic Damage",
      currentBid: 30,
      retailValue: 449,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 14).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=KitchenAid+stand+mixer+red+damaged+motor+dead",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "Damaged",
      category: "Appliances",
      bids: 5,
    },
    {
      id: "MOCK-7",
      lotNumber: "89012",
      title: "Makita 10-Piece Power Tool Combo Kit - Missing 3 Pieces, Partial Set",
      currentBid: 65,
      retailValue: 599,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 2).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Makita+power+tool+combo+kit+incomplete+partial+set+teal",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "Missing Parts",
      category: "Power Tools",
      bids: 9,
    },
    {
      id: "MOCK-8",
      lotNumber: "89134",
      title: "iPad Pro 12.9 2022 - Cracked Screen, Touch Unresponsive",
      currentBid: 120,
      retailValue: 1099,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 8).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=iPad+Pro+12.9+cracked+screen+touch+unresponsive+silver",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "For Parts / Not Working",
      category: "Electronics",
      bids: 11,
    },
    {
      id: "MOCK-9",
      lotNumber: "89278",
      title: "Vitamix 5200 Blender - Burns Smell, Sold As Is for Repair",
      currentBid: 18,
      retailValue: 549,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 20).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Vitamix+5200+blender+damaged+motor+red+kitchen",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "As Is",
      category: "Appliances",
      bids: 2,
    },
    {
      id: "MOCK-10",
      lotNumber: "89390",
      title: "Milwaukee M18 FUEL Circular Saw - No Blade, Needs Repair",
      currentBid: 45,
      retailValue: 249,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 4).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Milwaukee+M18+circular+saw+red+missing+blade+repair",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "Needs Repair",
      category: "Power Tools",
      bids: 6,
    },
    {
      id: "MOCK-11",
      lotNumber: "89451",
      title: "Xbox Series X - No Video Output, Dead HDMI Port",
      currentBid: 60,
      retailValue: 499,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 5).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=Xbox+Series+X+black+console+dead+HDMI+no+video",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "For Parts / Not Working",
      category: "Electronics",
      bids: 12,
    },
    {
      id: "MOCK-12",
      lotNumber: "89588",
      title: "FOR PARTS ONLY - NordicTrack Commercial 1750 Treadmill with iFIT",
      currentBid: 15,
      retailValue: 1899,
      buyersPremium: 15,
      endsAt: new Date(now + 1000 * 60 * 60 * 7).toISOString(),
      imageUrl: "https://placehold.co/400x280?text=NordicTrack+treadmill+for+parts+only+black+partial+set",
      url: "https://www.nellisauction.com/",
      location: locationLabel,
      condition: "Partial Set",
      category: "Appliances",
      bids: 8,
    },
  ];

  let filtered = pool.filter((item) => {
    const matchQuery =
      !query ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase());
    const matchCategory =
      !category || category === "All" || item.category === category;
    return matchQuery && matchCategory;
  });

  return filtered.map((item) => {
    const combined = `${item.title} ${item.condition}`.toLowerCase();
    const found = DAMAGE_KEYWORDS.filter((kw) => combined.includes(kw));
    const score = calcDealScore(item.currentBid, item.retailValue, found.length, item.buyersPremium);
    const totalCost = item.currentBid * (1 + item.buyersPremium / 100);
    const estimatedRepairCost = item.retailValue * 0.12;
    const estimatedResaleValue = item.retailValue * 0.65;
    const estimatedProfit = Math.round(
      estimatedResaleValue - totalCost - estimatedRepairCost
    );
    return { ...item, damageKeywords: found, dealScore: score, estimatedProfit, isRealData: false };
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "All";
  const sort = searchParams.get("sort") || "score";
  const location = searchParams.get("location") || "Denver, CO";

  let listings: AuctionListing[] = [];
  let isRealData = false;

  // Attempt live scrape first
  try {
    listings = await scrapeNellis(location, query, category, sort);
    isRealData = listings.length > 0;
  } catch (e) {
    console.error("[FlipScout] Scrape error:", e);
  }

  // Fall back to mock data if scrape fails or returns nothing
  if (listings.length === 0) {
    listings = getMockListings(query, category, location);
    isRealData = false;
  }

  // Sort
  if (sort === "score") {
    listings.sort((a, b) => b.dealScore - a.dealScore);
  } else if (sort === "price_asc") {
    listings.sort((a, b) => a.currentBid - b.currentBid);
  } else if (sort === "price_desc") {
    listings.sort((a, b) => b.currentBid - a.currentBid);
  } else if (sort === "profit") {
    listings.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  } else if (sort === "ending") {
    listings.sort(
      (a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
    );
  }

  return NextResponse.json({ listings, total: listings.length, isRealData });
}
