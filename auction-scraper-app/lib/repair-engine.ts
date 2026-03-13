/**
 * repair-engine.ts
 * Zero-dependency, zero-API-key repair analysis engine.
 * Generates realistic diagnostics, parts sourcing, 3D print flags,
 * and pro tips from a listing's title, category, and damage keywords.
 */

import type { AuctionListing } from "@/lib/types";
import type { RepairIntel, RepairPart, DiagnosticStep } from "@/app/api/repair-intel/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ebaySearch(query: string) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15`;
}
function aliSearch(query: string) {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`;
}
function amazonSearch(query: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}
function thingiverseSearch(query: string) {
  return `https://www.thingiverse.com/search?q=${encodeURIComponent(query)}&type=things`;
}
function printablesSearch(query: string) {
  return `https://www.printables.com/search/models?q=${encodeURIComponent(query)}`;
}

function extractBrand(title: string): string {
  const brands = ["Samsung", "LG", "Sony", "Vizio", "TCL", "Hisense", "Panasonic", "Toshiba",
    "Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Microsoft", "Google",
    "DeWalt", "Milwaukee", "Makita", "Ryobi", "Bosch", "Black+Decker",
    "KitchenAid", "Cuisinart", "Breville", "Ninja", "Instant Pot", "Whirlpool",
    "GE", "Frigidaire", "Maytag", "Dyson", "iRobot", "Shark", "Bissell",
    "PlayStation", "Xbox", "Nintendo", "Canon", "Nikon", "Sonos", "Bose",
  ];
  for (const b of brands) {
    if (title.toLowerCase().includes(b.toLowerCase())) return b;
  }
  return "";
}

function extractSize(title: string): string {
  const m = title.match(/(\d{2,3})["\s-]*(inch|in\b)/i) ?? title.match(/(\d{2,3})["″]/);
  return m ? `${m[1]}"` : "";
}

function matchesAny(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

// ─── Category detectors ───────────────────────────────────────────────────────

function detectCategory(listing: AuctionListing): string {
  const t = (listing.title + " " + listing.category).toLowerCase();
  if (matchesAny(t, ["tv", "television", "qled", "oled", "lcd", "plasma", "display", "monitor"])) return "tv";
  if (matchesAny(t, ["laptop", "notebook", "macbook", "chromebook", "thinkpad"])) return "laptop";
  if (matchesAny(t, ["iphone", "samsung galaxy", "pixel", "android phone", "smartphone"])) return "phone";
  if (matchesAny(t, ["tablet", "ipad", "surface", "kindle"])) return "tablet";
  if (matchesAny(t, ["drill", "saw", "grinder", "sander", "router", "jigsaw", "impact driver", "circular"])) return "power_tool";
  if (matchesAny(t, ["washer", "dryer", "refrigerator", "fridge", "dishwasher", "oven", "range", "microwave"])) return "appliance";
  if (matchesAny(t, ["vacuum", "roomba", "dyson", "bissell", "shark"])) return "vacuum";
  if (matchesAny(t, ["playstation", "xbox", "nintendo", "ps4", "ps5", "switch", "console", "gaming"])) return "game_console";
  if (matchesAny(t, ["printer", "scanner", "copier", "inkjet", "laser"])) return "printer";
  if (matchesAny(t, ["camera", "dslr", "mirrorless", "gopro", "camcorder"])) return "camera";
  if (matchesAny(t, ["speaker", "soundbar", "receiver", "amplifier", "subwoofer", "headphone", "earbud"])) return "audio";
  if (matchesAny(t, ["coffee", "espresso", "keurig", "nespresso", "breville", "blender", "mixer", "air fryer"])) return "small_appliance";
  return "electronics";
}

// ─── Damage keyword analysis ──────────────────────────────────────────────────

interface DamageProfile {
  hasCrackedScreen: boolean;
  hasNoPower: boolean;
  hasNoPicture: boolean;
  hasMissingParts: boolean;
  hasWaterDamage: boolean;
  hasHingeDamage: boolean;
  hasBatteryIssue: boolean;
  hasMotorIssue: boolean;
  hasControllerIssue: boolean;
  hasBurnMark: boolean;
}

function analyzeDamage(listing: AuctionListing): DamageProfile {
  const text = [listing.title, ...(listing.damageKeywords ?? [])].join(" ").toLowerCase();
  return {
    hasCrackedScreen:    matchesAny(text, ["cracked screen", "cracked display", "cracked panel", "broken screen", "shattered"]),
    hasNoPower:          matchesAny(text, ["no power", "won't turn on", "does not power", "dead", "powers on", "no power"]),
    hasNoPicture:        matchesAny(text, ["no picture", "no image", "no display", "black screen", "blank screen"]),
    hasMissingParts:     matchesAny(text, ["missing parts", "missing", "no remote", "no battery", "no charger", "partial set", "incomplete"]),
    hasWaterDamage:      matchesAny(text, ["water damage", "liquid damage", "flood", "wet", "spill"]),
    hasHingeDamage:      matchesAny(text, ["hinge", "lid", "latch", "broken hinge", "loose hinge"]),
    hasBatteryIssue:     matchesAny(text, ["battery", "won't hold charge", "bad battery", "swollen"]),
    hasMotorIssue:       matchesAny(text, ["motor", "not spinning", "won't agitate", "drum", "belt"]),
    hasControllerIssue:  matchesAny(text, ["controller", "remote", "no remote", "buttons", "keypad"]),
    hasBurnMark:         matchesAny(text, ["burn", "burnt", "smoke", "char", "fire"]),
  };
}

// ─── Per-category repair libraries ───────────────────────────────────────────

function buildTVIntel(listing: AuctionListing, dmg: DamageProfile): RepairIntel {
  const brand = extractBrand(listing.title);
  const size = extractSize(listing.title);
  const label = [brand, size, "TV"].filter(Boolean).join(" ");

  const diagnostics: DiagnosticStep[] = [];
  const parts: RepairPart[] = [];
  const warnings: string[] = [];
  const proTips: string[] = [];

  if (dmg.hasCrackedScreen) {
    diagnostics.push({
      issue: "Cracked / broken panel",
      likelyCauses: [
        "Physical impact damage to LCD/OLED panel",
        "Shipping or storage pressure on screen",
        "Panel delamination from structural failure",
      ],
      difficultyRating: "Advanced",
      toolsRequired: ["Suction cup panel removal tool", "T8/T10 Torx screwdrivers", "Spudger set", "Anti-static mat"],
    });
    const panelQuery = `${brand} ${size} TV replacement panel`;
    parts.push({
      name: `${size} Replacement LCD/OLED Panel${brand ? ` (${brand} compatible)` : ""}`,
      estimatedCost: size && parseInt(size) >= 65 ? "$200–$500" : "$80–$250",
      sources: [
        { name: "eBay", url: ebaySearch(panelQuery), note: "Best prices, verify exact model number — many sellers list OEM pulls" },
        { name: "AliExpress", url: aliSearch(panelQuery), note: "Cheapest option, allow 3–6 weeks shipping from CN" },
        { name: "Amazon", url: amazonSearch(panelQuery + " OEM"), note: "Faster shipping, typically 2–5 days" },
      ],
      shippingEstimate: "5–14 days domestic; 3–6 weeks from Asia",
      canBe3dPrinted: false,
    });
    warnings.push("Panel replacement is ONLY worth it if the bid price is well below retail — panel costs can exceed the TV's value on larger screens.");
    warnings.push("Verify the EXACT model number (T-CON board revision) before ordering a panel — similar models often use incompatible panels.");
    proTips.push("Search the model number + 'board diagram' on iFixit or YouTube before disassembly to understand the panel connector type.");
  }

  if (dmg.hasNoPicture || dmg.hasNoPower) {
    diagnostics.push({
      issue: dmg.hasNoPower ? "No power at all" : "Powers on but no picture",
      likelyCauses: dmg.hasNoPower
        ? ["Failed power supply board", "Blown fuse on power board", "Bad MOSFET or capacitor on PSU", "Damaged power cord/IEC socket"]
        : ["Failed T-CON board", "Bad main board (no HDMI signal output)", "Inverter board failure (on older LCDs)", "Bad LVDS/eDP ribbon cable between main board and panel"],
      difficultyRating: "Moderate",
      toolsRequired: ["Multimeter", "Phillips #2 screwdriver", "Torx T10 screwdriver", "Capacitor ESR tester (optional)"],
    });
    const boardQuery = `${brand} ${listing.title.match(/\w{6,}\d{2,}/)?.[0] ?? ""} power supply board`.trim();
    parts.push({
      name: dmg.hasNoPower ? `Power Supply Board${brand ? ` (${brand})` : ""}` : `T-CON Board${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$25–$80",
      sources: [
        { name: "eBay", url: ebaySearch(boardQuery), note: "Huge selection of OEM pulls — match the board part number exactly" },
        { name: "Amazon", url: amazonSearch(boardQuery), note: "Prime shipping available on many boards" },
        { name: "AliExpress", url: aliSearch(boardQuery), note: "Lowest cost, longer wait" },
      ],
      shippingEstimate: "2–5 days domestic",
      canBe3dPrinted: false,
    });
    proTips.push("On 'no power' TVs, visually inspect capacitors on the PSU board — bulging tops = confirmed bad caps, a $5 repair kit fixes them.");
    proTips.push("For 'no picture', shine a flashlight at the screen in a dark room. If you can faintly see an image, it's the backlight/inverter — not the panel.");
  }

  if (dmg.hasMissingParts) {
    const remoteQuery = `${brand} TV remote control replacement`;
    parts.push({
      name: `Replacement Remote Control${brand ? ` for ${brand}` : ""}`,
      estimatedCost: "$8–$25",
      sources: [
        { name: "Amazon", url: amazonSearch(remoteQuery), note: "Universal remotes work great, branded remotes ~$20" },
        { name: "eBay", url: ebaySearch(remoteQuery), note: "OEM originals available used for $5–$15" },
      ],
      shippingEstimate: "2–4 days",
      canBe3dPrinted: true,
      printNotes: "TV remote battery covers and button overlays are commonly printed in PLA. Full remote housings also exist on Thingiverse.",
      stlFiles: [
        { title: `${brand || "TV"} Remote Battery Cover`, url: thingiverseSearch(`${brand} TV remote battery cover`), community: "Thingiverse" },
        { title: "Universal TV Remote Stand / Holder", url: printablesSearch("TV remote holder stand"), community: "Printables" },
      ],
    });
  }

  warnings.push("Always check the full model number against parts before bidding — identical-looking TVs can have incompatible internal boards.");
  warnings.push(`OLED panels cost 3–5x more than LCD — confirm panel type before bidding on ${brand || "any"} TV.`);
  proTips.push("Use the SmartTVs subreddit and iFixit TV section for model-specific repair guides before you start.");
  proTips.push("Resell on Facebook Marketplace locally to avoid shipping a large TV — adds $50–$150 to your net profit.");

  const repairCost = dmg.hasCrackedScreen ? (size && parseInt(size) >= 65 ? 400 : 200) : 60;
  const flipScore = listing.retailValue > 0 ? listing.retailValue - listing.currentBid - repairCost : 0;

  return {
    summary: `This ${label} has been flagged with: ${listing.damageKeywords?.slice(0, 3).join(", ") || "damage issues"}. ${dmg.hasCrackedScreen ? "Panel replacement is the most expensive repair on a TV — verify cost before bidding." : "Board-level repairs are typically low-cost and high-success-rate on TVs."}  Current bid of $${listing.currentBid} ${flipScore > 150 ? "leaves healthy room for profit after repairs" : "is tight given likely repair costs"}.`,
    diagnostics,
    parts,
    repairEstimateTotal: dmg.hasCrackedScreen ? (size && parseInt(size) >= 65 ? "$200–$500" : "$80–$250") : "$25–$120",
    estimatedRepairTime: dmg.hasCrackedScreen ? "3–5 hours" : "1–3 hours",
    flipPotential: flipScore > 200 ? "Excellent" : flipScore > 100 ? "Good" : flipScore > 0 ? "Marginal" : "Skip",
    flipRationale: `Retail value $${listing.retailValue} minus bid $${listing.currentBid} minus repair leaves an estimated ${flipScore > 0 ? `$${Math.round(flipScore * 0.8)} net after fees` : "negative margin — skip unless bid drops significantly"}.`,
    warnings,
    proTips,
  };
}

function buildLaptopIntel(listing: AuctionListing, dmg: DamageProfile): RepairIntel {
  const brand = extractBrand(listing.title);
  const diagnostics: DiagnosticStep[] = [];
  const parts: RepairPart[] = [];
  const warnings: string[] = [];
  const proTips: string[] = [];

  if (dmg.hasCrackedScreen) {
    diagnostics.push({
      issue: "Cracked/broken LCD screen",
      likelyCauses: ["Physical impact to display lid", "Hinge tension crack over time", "Pressure applied to closed lid"],
      difficultyRating: "Moderate",
      toolsRequired: ["Plastic spudger set", "T5 Torx screwdriver", "Phillips #0 screwdriver", "Screen adhesive strips"],
    });
    const screenQuery = `${brand} laptop LCD screen replacement ${listing.title.match(/\d{2,3}"/)?.[0] ?? "15.6 inch"}`;
    parts.push({
      name: `Replacement LCD Screen${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$40–$120",
      sources: [
        { name: "eBay", url: ebaySearch(screenQuery), note: "OEM pulls available, match resolution and connector type" },
        { name: "AliExpress", url: aliSearch(screenQuery), note: "New screens from $35, 2–4 week shipping" },
        { name: "iFixit", url: `https://www.ifixit.com/Search#Parts=${encodeURIComponent(brand + " screen")}`, note: "Quality guaranteed, ships in 2–3 days" },
      ],
      shippingEstimate: "2–5 days domestic",
      canBe3dPrinted: false,
    });
  }

  if (dmg.hasHingeDamage) {
    diagnostics.push({
      issue: "Broken or stiff hinge",
      likelyCauses: ["Hinge barrel cracked from overtorquing", "Plastic hinge cover snapped", "Stripped hinge screw inserts"],
      difficultyRating: "Moderate",
      toolsRequired: ["T5/T8 Torx screwdriver", "Phillips #0", "Spudger", "Epoxy or JB Weld (for plastic repairs)"],
    });
    const hingeQuery = `${brand} laptop hinge replacement`;
    parts.push({
      name: `Laptop Hinge Assembly${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$8–$35",
      sources: [
        { name: "eBay", url: ebaySearch(hingeQuery), note: "OEM hinges are abundant and cheap" },
        { name: "Amazon", url: amazonSearch(hingeQuery), note: "Many OEM hinge kits under $20" },
        { name: "AliExpress", url: aliSearch(hingeQuery), note: "Bulk hinge kits from $5" },
      ],
      shippingEstimate: "2–7 days",
      canBe3dPrinted: true,
      printNotes: "Hinge covers and decorative trim pieces print well in PETG or ABS. The metal hinge barrel itself cannot be printed, but covers and brackets can.",
      stlFiles: [
        { title: `${brand || "Laptop"} Hinge Cover / Trim`, url: thingiverseSearch(`${brand} laptop hinge cover`), community: "Thingiverse" },
        { title: "Laptop Hinge Repair Bracket", url: printablesSearch("laptop hinge repair bracket"), community: "Printables" },
      ],
    });
  }

  if (dmg.hasBatteryIssue || dmg.hasNoPower) {
    diagnostics.push({
      issue: dmg.hasBatteryIssue ? "Battery failure / won't hold charge" : "No power / won't boot",
      likelyCauses: dmg.hasBatteryIssue
        ? ["Battery cells degraded past usable capacity", "Battery controller BMS failure", "Swollen lithium cells (safety hazard)"]
        : ["Dead CMOS battery (won't POST)", "Failed DC jack / charging port", "Corrupted BIOS/UEFI", "Failed RAM stick"],
      difficultyRating: "Easy",
      toolsRequired: ["Phillips #0 screwdriver", "Spudger", "Multimeter"],
    });
    const battQuery = `${brand} laptop battery replacement`;
    parts.push({
      name: `Replacement Battery${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$20–$60",
      sources: [
        { name: "Amazon", url: amazonSearch(battQuery), note: "Prime shipping, check cell brand (LG/Samsung cells preferred)" },
        { name: "eBay", url: ebaySearch(battQuery), note: "OEM pulls and aftermarket both available" },
        { name: "iFixit", url: `https://www.ifixit.com/Search#Parts=${encodeURIComponent(brand + " battery")}`, note: "Quality tested batteries with warranty" },
      ],
      shippingEstimate: "2–4 days",
      canBe3dPrinted: false,
    });
  }

  if (dmg.hasWaterDamage) {
    diagnostics.push({
      issue: "Liquid / water damage",
      likelyCauses: ["Corrosion on logic board traces", "Short circuit from mineral deposits", "Failed capacitors from liquid exposure"],
      difficultyRating: "Expert",
      toolsRequired: ["90% isopropyl alcohol", "Soft-bristle toothbrush", "Hot air rework station", "Flux pen", "Multimeter"],
    });
    warnings.push("Water damage laptops are high risk — logic board corrosion spreads over time. Only bid if the price is extremely low.");
    proTips.push("Soak the logic board in 90% isopropyl alcohol for 30 min and scrub with a toothbrush BEFORE powering on — mineral deposits cause shorts.");
  }

  warnings.push(`Always check ${brand || "the brand's"} service manual for disassembly order — many laptops have hidden screws under rubber feet or keyboard bezels.`);
  warnings.push("Test RAM slots individually — a single bad RAM stick mimics motherboard failure.");
  proTips.push("Run the laptop with RAM removed — if you get a beep code, the motherboard is alive. Isolates memory issues instantly.");
  proTips.push("Laptops sell fastest on eBay with a clear 'tested, works' video in the listing — adds 20–30% to resale price.");

  const repairCost = dmg.hasCrackedScreen ? 80 : dmg.hasWaterDamage ? 50 : 40;
  const flipScore = listing.retailValue > 0 ? listing.retailValue - listing.currentBid - repairCost : 0;

  return {
    summary: `This ${brand || ""} laptop has ${listing.damageKeywords?.slice(0, 3).join(", ") || "reported issues"}. ${dmg.hasWaterDamage ? "Water damage is a wildcard — the repair could be a $5 cleaning job or a full board replacement." : "Board-level laptop repairs are among the most profitable flips when the screen/battery is the only issue."} At $${listing.currentBid} current bid, ${flipScore > 100 ? "there is solid flip potential here" : "margins are tight"}.`,
    diagnostics,
    parts,
    repairEstimateTotal: dmg.hasWaterDamage ? "$20–$150" : dmg.hasCrackedScreen ? "$40–$120" : "$20–$80",
    estimatedRepairTime: dmg.hasWaterDamage ? "4–8 hours" : "1–3 hours",
    flipPotential: flipScore > 150 ? "Excellent" : flipScore > 75 ? "Good" : flipScore > 0 ? "Marginal" : "Skip",
    flipRationale: `Estimated net after repair and fees: ${flipScore > 0 ? `$${Math.round(flipScore * 0.85)}` : "negative — skip unless bid drops"}.`,
    warnings,
    proTips,
  };
}

function buildPowerToolIntel(listing: AuctionListing, dmg: DamageProfile): RepairIntel {
  const brand = extractBrand(listing.title);
  const diagnostics: DiagnosticStep[] = [];
  const parts: RepairPart[] = [];
  const warnings: string[] = [];
  const proTips: string[] = [];

  diagnostics.push({
    issue: dmg.hasMotorIssue ? "Motor failure / not spinning" : dmg.hasNoPower ? "No power / won't start" : "Intermittent operation or reduced power",
    likelyCauses: dmg.hasMotorIssue
      ? ["Brushes worn down to metal (most common)", "Armature winding short", "Bearing seizure from debris", "Field coil failure"]
      : dmg.hasNoPower
      ? ["Dead battery pack (most common)", "Failed trigger switch", "Broken wire at strain relief", "Burned motor brushes"]
      : ["Worn carbon brushes", "Dirty commutator", "Loose connection at trigger", "Partially failed battery cell"],
    difficultyRating: "Easy",
    toolsRequired: ["Phillips and Torx screwdrivers", "Multimeter", "Needle-nose pliers", "Replacement brush set"],
  });

  const brushQuery = `${brand} replacement carbon brushes motor`;
  parts.push({
    name: `Carbon Motor Brush Set${brand ? ` (${brand})` : ""}`,
    estimatedCost: "$5–$20",
    sources: [
      { name: "Amazon", url: amazonSearch(brushQuery), note: "Universal brush sets from $6 — measure old brushes to match size" },
      { name: "eBay", url: ebaySearch(brushQuery), note: "Brand-specific sets available, exact fit" },
      { name: "AliExpress", url: aliSearch(brushQuery), note: "Bulk packs for $3–$8" },
    ],
    shippingEstimate: "2–5 days",
    canBe3dPrinted: false,
  });

  if (dmg.hasMissingParts || dmg.hasBatteryIssue) {
    const battQuery = `${brand} 20V battery pack replacement`;
    parts.push({
      name: `Replacement Battery Pack${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$25–$80",
      sources: [
        { name: "Amazon", url: amazonSearch(battQuery), note: "Aftermarket packs work great, fraction of OEM cost" },
        { name: "eBay", url: ebaySearch(battQuery), note: "OEM refurb packs from $20" },
        { name: "AliExpress", url: aliSearch(battQuery), note: "Cheapest option, verify cell quality" },
      ],
      shippingEstimate: "2–5 days",
      canBe3dPrinted: true,
      printNotes: "Battery housing shells, belt clips, and depth stops are excellent 3D print candidates in PETG for durability.",
      stlFiles: [
        { title: `${brand || "Power Tool"} Battery Holder / Mount`, url: thingiverseSearch(`${brand} battery holder`), community: "Thingiverse" },
        { title: "Power Tool Belt Clip Replacement", url: printablesSearch(`${brand} belt clip`), community: "Printables" },
      ],
    });
  }

  // Accessory housing parts
  const housingQuery = `${brand} tool housing replacement`;
  parts.push({
    name: `Tool Housing / Body Panel${brand ? ` (${brand})` : ""}`,
    estimatedCost: "$15–$45",
    sources: [
      { name: "eBay", url: ebaySearch(housingQuery), note: "OEM housing halves common on eBay" },
      { name: `${brand || "Manufacturer"} Parts Direct`, url: `https://www.ereplacementparts.com/search/?term=${encodeURIComponent(brand + " " + listing.title.split(" ").slice(0, 3).join(" "))}`, note: "OEM parts with diagrams" },
    ],
    shippingEstimate: "3–7 days",
    canBe3dPrinted: true,
    printNotes: "Non-structural housing panels, guards, and auxiliary handles are ideal PETG or ASA prints. Avoid printing load-bearing structural parts.",
    stlFiles: [
      { title: `${brand || "Power Tool"} Housing Panel`, url: thingiverseSearch(`${brand} drill housing`), community: "Thingiverse" },
      { title: "Power Tool Accessory Bracket", url: printablesSearch(`${brand} tool bracket`), community: "Printables" },
    ],
  });

  warnings.push("Cordless tools without batteries are often listed as broken — always buy the tool first and source a compatible aftermarket battery separately for huge savings.");
  warnings.push("Test the motor with a direct 9V battery tap to the motor terminals before full reassembly — confirms if the motor or the switch/battery is the issue.");
  proTips.push("Carbon brush replacement on brushed motors restores 90% of 'dead' power tools in under 20 minutes — the most profitable repair in the flipping game.");
  proTips.push("Power tools resell extremely well on Facebook Marketplace to contractors — local sale = no eBay fees = higher margin.");
  proTips.push(`Search '${brand || "brand"} tool repair' on YouTube — most common repairs have detailed video guides.`);

  const flipScore = listing.retailValue > 0 ? listing.retailValue - listing.currentBid - 30 : 0;

  return {
    summary: `This ${brand || ""} power tool shows signs of: ${listing.damageKeywords?.slice(0, 3).join(", ") || "wear/damage"}. Power tool repairs are among the best flips — brushes and batteries account for 80% of 'broken' tool failures and cost under $25 to fix. At $${listing.currentBid}, ${flipScore > 50 ? "this looks like a solid flip opportunity" : "margins are slim but worth a diagnostic"}.`,
    diagnostics,
    parts,
    repairEstimateTotal: "$10–$60",
    estimatedRepairTime: "30 min – 2 hours",
    flipPotential: flipScore > 80 ? "Excellent" : flipScore > 40 ? "Good" : "Marginal",
    flipRationale: `Power tools are fast movers on Facebook Marketplace. Estimated net: $${Math.max(0, Math.round(flipScore * 0.9))}.`,
    warnings,
    proTips,
  };
}

function buildApplianceIntel(listing: AuctionListing, dmg: DamageProfile): RepairIntel {
  const brand = extractBrand(listing.title);
  const t = listing.title.toLowerCase();
  const isWasher = t.includes("washer");
  const isDryer = t.includes("dryer");
  const isFridge = t.includes("fridge") || t.includes("refrigerator");
  const diagnostics: DiagnosticStep[] = [];
  const parts: RepairPart[] = [];
  const warnings: string[] = [];
  const proTips: string[] = [];

  if (isWasher || dmg.hasMotorIssue) {
    diagnostics.push({
      issue: isWasher ? "Washer not spinning / agitating" : "Motor / drive issue",
      likelyCauses: ["Worn or broken drive belt (most common)", "Lid switch failure preventing spin cycle", "Door latch sensor failure (front loaders)", "Worn motor coupling", "Clogged drain pump"],
      difficultyRating: "Moderate",
      toolsRequired: ["Nut driver set", "Flathead and Phillips screwdrivers", "Multimeter", "Channel-lock pliers"],
    });
    const beltQuery = `${brand} washer drive belt replacement`;
    parts.push({
      name: `Drive Belt / Motor Coupling${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$8–$30",
      sources: [
        { name: "Amazon", url: amazonSearch(beltQuery), note: "Fast shipping, check model compatibility" },
        { name: "eBay", url: ebaySearch(beltQuery), note: "OEM and aftermarket both available" },
        { name: "Repair Clinic", url: `https://www.repairclinic.com/Shop-For-Parts/a6/${encodeURIComponent(brand + " washer")}`, note: "Appliance specialist, model lookup available" },
      ],
      shippingEstimate: "2–4 days",
      canBe3dPrinted: false,
    });
  }

  if (isFridge) {
    diagnostics.push({
      issue: "Refrigerator not cooling",
      likelyCauses: ["Dirty/blocked condenser coils (free fix)", "Failed start relay on compressor", "Low refrigerant (requires certified tech)", "Faulty evaporator fan motor"],
      difficultyRating: "Easy",
      toolsRequired: ["Vacuum with brush attachment", "Multimeter", "Nut driver", "Coil cleaning brush"],
    });
    const relayQuery = `${brand} refrigerator start relay replacement`;
    parts.push({
      name: `Compressor Start Relay${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$10–$40",
      sources: [
        { name: "Amazon", url: amazonSearch(relayQuery), note: "Most common fridge fix — shake the relay, if it rattles it's bad" },
        { name: "Repair Clinic", url: `https://www.repairclinic.com/Shop-For-Parts/a1/${encodeURIComponent(brand + " refrigerator")}`, note: "Model-specific lookup" },
      ],
      shippingEstimate: "2–3 days",
      canBe3dPrinted: false,
    });
    proTips.push("Shake the start relay — a rattling sound confirms it's failed. A $15 part and 10-minute fix restores 40% of 'broken' refrigerators.");
  }

  warnings.push("Large appliances require a truck or van for transport — factor $50–$150 into your flip cost for hauling.");
  warnings.push("If the compressor itself is bad on a fridge/AC unit, repair cost usually exceeds value — walk away unless the bid is extremely low.");
  proTips.push("Appliances sell best locally on Facebook Marketplace — avoid shipping entirely and maximize margin.");
  proTips.push(`Use RepairClinic.com's model number lookup to get an exact parts diagram — fastest way to identify what's broken.`);
  proTips.push("Clean the appliance thoroughly before listing — presentation adds $50–$100 to perceived value on Facebook Marketplace.");

  const flipScore = listing.retailValue > 0 ? listing.retailValue - listing.currentBid - 60 : 0;

  return {
    summary: `This ${brand || ""} appliance has reported: ${listing.damageKeywords?.slice(0, 3).join(", ") || "issues"}. ${isWasher ? "Most washer failures are belt or lid switch — cheap and easy." : isFridge ? "Most fridge failures are the start relay — a $15 fix." : "Appliance repairs are typically low-cost and high-margin."} At $${listing.currentBid} current bid, ${flipScore > 50 ? "this is a strong flip candidate" : "margin is thin"}.`,
    diagnostics,
    parts,
    repairEstimateTotal: "$15–$80",
    estimatedRepairTime: "1–3 hours",
    flipPotential: flipScore > 100 ? "Excellent" : flipScore > 50 ? "Good" : "Marginal",
    flipRationale: `Local appliance resale on Facebook Marketplace — no shipping, no fees. Estimated net: $${Math.max(0, Math.round(flipScore))}+.`,
    warnings,
    proTips,
  };
}

function buildGenericIntel(listing: AuctionListing, dmg: DamageProfile): RepairIntel {
  const brand = extractBrand(listing.title);
  const diagnostics: DiagnosticStep[] = [];
  const parts: RepairPart[] = [];
  const warnings: string[] = [];
  const proTips: string[] = [];

  diagnostics.push({
    issue: "General malfunction / damage",
    likelyCauses: [
      "Power supply failure (capacitors, fuses)",
      "Physical damage to housing or connectors",
      "Missing components preventing operation",
      "Firmware / software corruption",
    ],
    difficultyRating: "Moderate",
    toolsRequired: ["Multimeter", "Phillips screwdriver set", "Torx screwdriver set", "Spudger / pry tools"],
  });

  if (dmg.hasMissingParts) {
    const partsQuery = `${brand} ${listing.title.split(" ").slice(0, 4).join(" ")} replacement parts`;
    parts.push({
      name: `Replacement Parts / Accessories${brand ? ` (${brand})` : ""}`,
      estimatedCost: "$10–$60",
      sources: [
        { name: "eBay", url: ebaySearch(partsQuery), note: "Widest selection of OEM and aftermarket parts" },
        { name: "Amazon", url: amazonSearch(partsQuery), note: "Prime shipping on popular accessories" },
        { name: "AliExpress", url: aliSearch(partsQuery), note: "Lowest prices for generic parts" },
      ],
      shippingEstimate: "3–10 days",
      canBe3dPrinted: true,
      printNotes: "Covers, feet, knobs, trays, and cosmetic panels are excellent 3D print candidates in PLA or PETG.",
      stlFiles: [
        { title: `${brand || "Electronics"} Replacement Foot / Leg`, url: thingiverseSearch(`${brand} stand foot replacement`), community: "Thingiverse" },
        { title: "Replacement Knob / Dial", url: printablesSearch("replacement knob dial"), community: "Printables" },
      ],
    });
  }

  warnings.push("Verify the exact issue before bidding — 'untested' and 'as-is' listings often work fine and are underpriced out of seller laziness.");
  warnings.push("Search the model number on iFixit and YouTube BEFORE bidding to confirm repair parts are available and affordable.");
  proTips.push("'As-is' and 'untested' listings are the best opportunities — sellers don't know what they have. Many are a simple factory reset away from full functionality.");
  proTips.push("Always search the model number on eBay SOLD listings to see the realistic resale value before deciding on a max bid.");

  const flipScore = listing.retailValue > 0 ? listing.retailValue - listing.currentBid - 40 : 0;

  return {
    summary: `This listing — ${listing.title} — has been flagged as: ${listing.damageKeywords?.slice(0, 3).join(", ") || "damaged/as-is"}. Without a more specific failure mode, start with a full visual inspection and power test. At $${listing.currentBid}, ${flipScore > 50 ? "the numbers look workable" : "due diligence is critical before bidding"}.`,
    diagnostics,
    parts,
    repairEstimateTotal: "$20–$100",
    estimatedRepairTime: "1–4 hours",
    flipPotential: flipScore > 100 ? "Good" : flipScore > 30 ? "Marginal" : "Skip",
    flipRationale: `Estimated net after repair and fees: ${flipScore > 0 ? `$${Math.round(flipScore * 0.85)}` : "uncertain — research the model before bidding"}.`,
    warnings,
    proTips,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function generateRepairIntel(listing: AuctionListing): RepairIntel {
  const dmg = analyzeDamage(listing);
  const cat = detectCategory(listing);

  switch (cat) {
    case "tv":          return buildTVIntel(listing, dmg);
    case "laptop":      return buildLaptopIntel(listing, dmg);
    case "power_tool":  return buildPowerToolIntel(listing, dmg);
    case "appliance":   return buildApplianceIntel(listing, dmg);
    default:            return buildGenericIntel(listing, dmg);
  }
}
