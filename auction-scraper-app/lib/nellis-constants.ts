// Shared constants used by both server routes and client components.
// IMPORTANT: Keep this file free of server-only imports so client components can import it.

export const NELLIS_LOCATIONS: { label: string; value: string }[] = [
  { label: "Denver, CO", value: "Denver, CO" },
  { label: "Las Vegas, NV", value: "Las Vegas, NV" },
  { label: "North Las Vegas, NV", value: "North Las Vegas, NV" },
  { label: "Henderson, NV", value: "Henderson, NV" },
  { label: "Phoenix, AZ", value: "Phoenix, AZ" },
  { label: "Tempe, AZ", value: "Tempe, AZ" },
  { label: "Dallas, TX", value: "Dallas, TX" },
  { label: "Houston, TX", value: "Houston, TX" },
  { label: "San Antonio, TX", value: "San Antonio, TX" },
  { label: "Salt Lake City, UT", value: "Salt Lake City, UT" },
  { label: "Sacramento, CA", value: "Sacramento, CA" },
  { label: "Albuquerque, NM", value: "Albuquerque, NM" },
  { label: "Colorado Springs, CO", value: "Colorado Springs, CO" },
  { label: "Tucson, AZ", value: "Tucson, AZ" },
];

export const DEFAULT_LOCATION = "Denver, CO";

// Keywords that flag broken / parts-missing deals
export const DAMAGE_KEYWORDS = [
  "broken",
  "parts only",
  "for parts",
  "not working",
  "as is",
  "as-is",
  "damaged",
  "cracked",
  "missing parts",
  "unknown if missing parts",
  "partial set",
  "untested",
  "powers on",
  "no power",
  "dead",
  "faulty",
  "repair",
  "spares",
  "cosmetic damage",
  "dented",
  "scratched",
  "needs repair",
  "sold as is",
];
