import { NextRequest, NextResponse } from "next/server";
import { generateRepairIntel } from "@/lib/repair-engine";

export interface RepairPart {
  name: string;
  estimatedCost: string;
  sources: { name: string; url: string; note: string }[];
  shippingEstimate: string;
  canBe3dPrinted: boolean;
  printNotes?: string;
  stlFiles?: { title: string; url: string; community: string }[];
}

export interface DiagnosticStep {
  issue: string;
  likelyCauses: string[];
  difficultyRating: "Easy" | "Moderate" | "Advanced" | "Expert";
  toolsRequired: string[];
}

export interface RepairIntel {
  summary: string;
  diagnostics: DiagnosticStep[];
  parts: RepairPart[];
  repairEstimateTotal: string;
  estimatedRepairTime: string;
  flipPotential: "Excellent" | "Good" | "Marginal" | "Skip";
  flipRationale: string;
  warnings: string[];
  proTips: string[];
}



const SYSTEM_PROMPT = `You are an expert repair technician and resale flipper with 20+ years of experience across electronics, appliances, and power tools. Analyze broken/damaged auction listings and return a JSON repair assessment.

Return ONLY a valid JSON object matching this exact structure — no markdown, no code fences, no explanation:

{
  "summary": "2-3 sentence plain-English overview of condition and repair outlook",
  "diagnostics": [
    {
      "issue": "Short issue name",
      "likelyCauses": ["cause 1", "cause 2", "cause 3"],
      "difficultyRating": "Easy|Moderate|Advanced|Expert",
      "toolsRequired": ["tool 1", "tool 2"]
    }
  ],
  "parts": [
    {
      "name": "Specific part name with model compatibility",
      "estimatedCost": "$XX–$XX",
      "sources": [
        { "name": "eBay", "url": "https://www.ebay.com/sch/i.html?_nkw=PART+NAME", "note": "Best price, check seller rating" },
        { "name": "Amazon", "url": "https://www.amazon.com/s?k=PART+NAME", "note": "Prime shipping available" },
        { "name": "iFixit", "url": "https://www.ifixit.com/Search?query=PART+NAME", "note": "OEM quality with guides" }
      ],
      "shippingEstimate": "X–X business days",
      "canBe3dPrinted": true,
      "printNotes": "Explain what to print and in what material",
      "stlFiles": [
        { "title": "Descriptive STL name", "url": "https://www.thingiverse.com/search?q=PART", "community": "Thingiverse" }
      ]
    }
  ],
  "repairEstimateTotal": "$XX–$XX",
  "estimatedRepairTime": "X–X hours",
  "flipPotential": "Excellent|Good|Marginal|Skip",
  "flipRationale": "1-2 sentence explanation",
  "warnings": ["warning 1", "warning 2", "warning 3"],
  "proTips": ["tip 1", "tip 2", "tip 3"]
}

Rules:
- Use REAL eBay/Amazon/AliExpress/iFixit search URLs with the actual part name in the query string
- Be specific to the brand and model if inferrable from the title
- For 3D printing: hinges, brackets, feet, knobs, covers, trays are almost always printable — flag them
- Cost estimates must be realistic current market prices
- Return 1–4 diagnostics and 1–4 parts maximum`;

export async function POST(req: NextRequest) {
  try {
    const { listing } = await req.json();

    if (!listing?.title) {
      return NextResponse.json({ error: "Missing listing data" }, { status: 400 });
    }

    const intel: RepairIntel = generateRepairIntel(listing);
    return NextResponse.json({ intel, source: "local" });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
