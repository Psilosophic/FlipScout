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

// ─── Fetch Nellis search page HTML ────────────────────────────────────────────
// Nellis sometimes returns an empty product list (load-balancer / bot detection).
// We retry once if the first attempt returns 0 products.
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchNellisProducts(url: string): Promise<any[]> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    console.error(`[FlipScout] Nellis fetch failed: ${res.status} ${url}`);
    return [];
  }
  const html = await res.text();
  const ctxIdx = html.indexOf("__remixContext");
  if (ctxIdx === -1) return [];

  const startBrace = html.indexOf("{", ctxIdx);
  let depth = 0;
  let endBrace = startBrace;
  for (let i = startBrace; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    if (depth === 0) { endBrace = i; break; }
  }
  const remixData = JSON.parse(html.substring(startBrace, endBrace + 1));
  return remixData?.state?.loaderData?.["routes/search"]?.products ?? [];
}

// ─── Real Nellis scraper ──────────────────────────────────────────────────────
// Nellis uses Remix. Product data is embedded in window.__remixContext in the
// server-rendered HTML, with prices, bids, photos, grade info, and close times.
async function scrapeNellis(
  location: string,
  query: string,
  category: string,
  sort: string
): Promise<AuctionListing[]> {
  const sortMap: Record<string, string> = {
    score: "CurrentPrice&sortOrder=asc",
    profit: "EstRetail&sortOrder=desc",
    price_asc: "CurrentPrice&sortOrder=asc",
    price_desc: "CurrentPrice&sortOrder=desc",
    ending: "EndTime&sortOrder=asc",
  };
  const nellisSortStr = sortMap[sort] || "CurrentPrice&sortOrder=asc";
  const [sortBy, sortOrderStr] = nellisSortStr.split("&sortOrder=");

  const baseUrl = "https://www.nellisauction.com/search";
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrderStr);
  const url = `${baseUrl}?${params.toString()}`;

  // Fetch with one retry — Nellis load balancers sometimes return empty pages
  let products = await fetchNellisProducts(url);
  if (products.length === 0) {
    console.log("[FlipScout] First fetch returned 0 products, retrying...");
    products = await fetchNellisProducts(url);
  }
  if (products.length === 0) {
    console.error("[FlipScout] No products after retry");
    return [];
  }

  const listings: AuctionListing[] = [];
  for (const p of products.slice(0, 80)) {
    const title: string = p.title ?? "";
    const currentBid: number = p.currentPrice ?? 0;
    const retailValue: number = p.retailPrice ?? 0;
    const buyersPremium = 15; // Nellis standard
    const bids: number = p.bidCount ?? 0;
    const id: string = String(p.id ?? Math.random());
    const lotNumber: string = p.inventoryNumber ?? String(p.id ?? "");

    // Photos — array of {url, name, fullPath}
    const imageUrl: string = p.photos?.[0]?.url ?? "";

    // Product URL
    const titleSlug = title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "");
    const fullUrl = `https://www.nellisauction.com/p/${titleSlug}/${p.id}`;

    // Location from the product's location object
    const locName: string =
      p.location?.name ?? p.location?.city ?? location;

    // Condition from grade object
    const grade = p.grade ?? {};
    const conditionParts: string[] = [];
    if (grade.conditionType?.description)
      conditionParts.push(grade.conditionType.description);
    if (grade.damageType?.description && grade.damageType.description !== "None")
      conditionParts.push(grade.damageType.description);
    if (grade.functionalType?.description === "No")
      conditionParts.push("Not Working");
    if (grade.missingPartsType?.description === "Yes")
      conditionParts.push("Missing Parts");
    if (grade.packageType?.description === "No")
      conditionParts.push("No Packaging");
    const condition = conditionParts.join(", ") || "Unknown";

    // End time — closeTime is {__type: "Date", value: "..."}
    const endsAt: string =
      p.closeTime?.value ??
      new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

    // Damage keyword detection across title + condition
    const combined = `${title} ${condition}`.toLowerCase();
    const foundKeywords = DAMAGE_KEYWORDS.filter((kw) =>
      combined.includes(kw.toLowerCase())
    );

    // Only include listings with at least 1 damage keyword (unless searching)
    if (foundKeywords.length === 0 && !query) continue;

    // Category filter (use title since Nellis doesn't include category in product data)
    if (
      category &&
      category !== "All" &&
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
      location: locName,
      condition,
      damageKeywords: foundKeywords,
      dealScore: score,
      estimatedProfit,
      lotNumber,
      category: "General",
      bids,
      isRealData: true,
    });
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
