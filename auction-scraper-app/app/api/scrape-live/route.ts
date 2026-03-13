import { NextRequest, NextResponse } from "next/server";
import { DAMAGE_KEYWORDS } from "@/lib/nellis-constants";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ScrapedListing {
  id: string;
  title: string;
  currentBid: number;
  retailValue: number;
  buyersPremium: number;
  endsAt: string;
  imageUrl: string;
  url: string;
  location: string;
  condition: string;
  damageKeywords: string[];
  dealScore: number;
  estimatedProfit: number;
  lotNumber: string;
  category: string;
  bids: number;
  isRealData: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseDollar(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

function calcDealScore(bid: number, retail: number, kwCount: number, premium: number): number {
  if (retail <= 0) return Math.min(kwCount * 10, 40);
  const totalCost = bid * (1 + premium / 100);
  const savingsPct = ((retail - totalCost) / retail) * 100;
  const kwBonus = Math.min(kwCount * 8, 30);
  return Math.max(0, Math.min(100, Math.round(savingsPct * 0.7 + kwBonus)));
}

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return DAMAGE_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

function buildListing(
  raw: Record<string, any>,
  location: string,
  index: number
): ScrapedListing | null {
  const title: string = (raw.title || raw.name || "").trim();
  if (!title) return null;

  const currentBid = parseDollar(String(raw.currentPrice ?? raw.currentBid ?? raw.price ?? 0));
  const retailValue = parseDollar(String(raw.estimatedRetail ?? raw.retailValue ?? raw.estRetail ?? raw.retail ?? 0));
  const buyersPremium: number = Number(raw.buyersPremium ?? raw.buyerPremium ?? 15);
  const bids: number = Number(raw.bidCount ?? raw.bids ?? raw.numberOfBids ?? 0);
  const lotNumber = String(raw.lotNumber ?? raw.lot ?? raw.id ?? raw.productId ?? index + 1);
  const id = String(raw.id ?? raw.productId ?? `live-${index}-${Date.now()}`);
  const imageUrl: string = raw.imageUrl ?? raw.image ?? raw.thumbnail ?? raw.primaryImage ?? "";
  const rawUrl: string = raw.url ?? raw.productUrl ?? raw.href ?? "";
  const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://www.nellisauction.com${rawUrl}`;
  const endsAt: string = raw.endsAt ?? raw.endTime ?? raw.auctionEndTime ?? raw.endDate
    ?? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const conditionParts: string[] = [
    ...(Array.isArray(raw.qualityRatings) ? raw.qualityRatings : []),
    ...(Array.isArray(raw.qualityLabels) ? raw.qualityLabels : []),
    raw.condition ?? "",
    raw.qualityRating ?? "",
  ].filter(Boolean).map((s: string) => String(s).trim());
  const condition = conditionParts.join(", ") || "Unknown";

  const combined = `${title} ${condition}`;
  const damageKeywords = detectKeywords(combined);
  const category: string = raw.category ?? raw.categoryName ?? raw.productCategory ?? "General";

  const totalCost = currentBid * (1 + buyersPremium / 100);
  const estimatedRepairCost = retailValue * 0.12;
  const estimatedResaleValue = retailValue * 0.65;
  const estimatedProfit = Math.round(estimatedResaleValue - totalCost - estimatedRepairCost);
  const dealScore = calcDealScore(currentBid, retailValue, damageKeywords.length, buyersPremium);

  return {
    id, title, currentBid, retailValue, buyersPremium,
    endsAt, imageUrl, url: fullUrl,
    location: raw.location ?? raw.locationName ?? location,
    condition, damageKeywords, dealScore, estimatedProfit,
    lotNumber, category, bids, isRealData: true,
  };
}

// ─── Playwright scraper ───────────────────────────────────────────────────────
// Uses playwright-core + @sparticuz/chromium for serverless-compatible headless
// browsing. This fully renders Nellis' JavaScript and waits for listing cards
// to appear in the DOM before extracting data.
async function scrapeWithPlaywright(
  location: string,
  query: string,
  authCookies?: string,
): Promise<ScrapedListing[]> {
  // Dynamically import to avoid build errors when packages aren't installed
  let chromium: any, playwright: any;
  try {
    // @ts-ignore — optional dependency, may not be installed
    chromium = (await import("@sparticuz/chromium")).default;
    // @ts-ignore — optional dependency, may not be installed
    playwright = await import("playwright-core");
  } catch {
    throw new Error("playwright-core or @sparticuz/chromium not installed");
  }

  const executablePath = await chromium.executablePath();
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });

  // Inject saved auth cookies if we have them
  if (authCookies) {
    try {
      const parsed: { name: string; value: string; domain?: string; path?: string }[] =
        JSON.parse(authCookies);
      await context.addCookies(
        parsed.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain ?? ".nellisauction.com",
          path: c.path ?? "/",
        }))
      );
    } catch {
      // ignore malformed cookies
    }
  }

  const page = await context.newPage();

  // Build Nellis search URL
  const params = new URLSearchParams({ location });
  if (query) params.set("q", query);
  const url = `https://www.nellisauction.com/search?${params.toString()}`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for at least one product card to render
    await page
      .waitForSelector('[data-testid="product-card"], .product-card, [class*="ProductCard"], article', {
        timeout: 15000,
      })
      .catch(() => {/* cards may not have these selectors — continue anyway */});

    // Give React a moment to hydrate
    await page.waitForTimeout(2000);

    // Extract __NEXT_DATA__ after full render
    const nextDataRaw: string | null = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      return el ? el.textContent : null;
    });

    const listings: ScrapedListing[] = [];

    if (nextDataRaw) {
      try {
        const nextData = JSON.parse(nextDataRaw);
        const pageProps =
          nextData?.props?.pageProps ||
          nextData?.props?.initialProps?.pageProps ||
          {};
        const products: any[] =
          pageProps?.products ||
          pageProps?.searchResults?.products ||
          pageProps?.initialData?.products ||
          pageProps?.data?.products ||
          pageProps?.items ||
          [];

        for (let i = 0; i < products.length; i++) {
          const l = buildListing(products[i], location, i);
          if (l) listings.push(l);
        }
      } catch {
        // fall through to DOM extraction
      }
    }

    // DOM fallback — scrape visible card elements if __NEXT_DATA__ was empty
    if (listings.length === 0) {
      const cards = await page.evaluate((damageKws: string[]) => {
        const results: any[] = [];

        // Nellis renders cards as <a> tags containing product info
        const anchors = Array.from(document.querySelectorAll("a[href*='/product/'], a[href*='/lot/']"));

        for (const anchor of anchors.slice(0, 60)) {
          const el = anchor as HTMLElement;
          const href = (anchor as HTMLAnchorElement).href;

          const titleEl =
            el.querySelector("h6, h5, h4, [class*='title'], [class*='Title']");
          const title = titleEl?.textContent?.trim() ?? "";
          if (!title) continue;

          const priceEl = el.querySelector("[class*='price'], [class*='Price'], [class*='bid'], [class*='Bid']");
          const priceText = priceEl?.textContent?.replace(/[^0-9.]/g, "") ?? "0";

          const retailEl = el.querySelector("[class*='retail'], [class*='Retail'], [class*='estRetail']");
          const retailText = retailEl?.textContent?.replace(/[^0-9.]/g, "") ?? "0";

          const imgEl = el.querySelector("img");
          const imageUrl = imgEl?.src ?? "";

          const condEl = el.querySelector("[class*='condition'], [class*='Condition'], [class*='quality'], [class*='Quality']");
          const condition = condEl?.textContent?.trim() ?? "";

          results.push({
            title,
            currentPrice: parseFloat(priceText) || 0,
            retail: parseFloat(retailText) || 0,
            imageUrl,
            url: href,
            condition,
          });
        }
        return results;
      }, DAMAGE_KEYWORDS);

      for (let i = 0; i < cards.length; i++) {
        const l = buildListing(cards[i], location, i);
        if (l) listings.push(l);
      }
    }

    return listings;
  } finally {
    await browser.close();
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location") || "Denver, CO";
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "All";
  const sort = searchParams.get("sort") || "score";

  // Read auth cookies from the FlipScout session cookie if present
  const authCookies = request.cookies.get("nellis_auth_cookies")?.value;

  let listings: ScrapedListing[] = [];
  let error: string | null = null;

  try {
    listings = await scrapeWithPlaywright(location, query, authCookies);
  } catch (e: any) {
    error = e?.message ?? "Playwright scrape failed";
    console.error("[FlipScout][Playwright]", error);
  }

  // Category filter
  if (category && category !== "All") {
    listings = listings.filter(
      (l) =>
        l.category.toLowerCase().includes(category.toLowerCase()) ||
        l.title.toLowerCase().includes(category.toLowerCase())
    );
  }

  // Sort
  if (sort === "score") listings.sort((a, b) => b.dealScore - a.dealScore);
  else if (sort === "price_asc") listings.sort((a, b) => a.currentBid - b.currentBid);
  else if (sort === "price_desc") listings.sort((a, b) => b.currentBid - a.currentBid);
  else if (sort === "profit") listings.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
  else if (sort === "ending")
    listings.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());

  return NextResponse.json({
    listings,
    total: listings.length,
    isRealData: listings.length > 0,
    playwrightAvailable: !error?.includes("not installed"),
    error,
  });
}
