// Country flag emojis for teams, keyed by country name. Team names are
// "Country - Category" (e.g. "Austria - WEC"), so flagFor() extracts the country.
// Shared across the Teams page, the games list and the súmula.

export const FLAGS = {
  Austria: "🇦🇹", Brazil: "🇧🇷", Germany: "🇩🇪", Switzerland: "🇨🇭",
  Chile: "🇨🇱", India: "🇮🇳", Namibia: "🇳🇦", Kenya: "🇰🇪",
  "New Zealand": "🇳🇿", Italy: "🇮🇹", "Czech Republic": "🇨🇿", Denmark: "🇩🇰",
  Serbia: "🇷🇸", Argentina: "🇦🇷", Poland: "🇵🇱", "United States": "🇺🇸",
  France: "🇫🇷", Belgium: "🇧🇪", Spain: "🇪🇸", Netherlands: "🇳🇱",
};

export function countryOf(teamName) {
  return String(teamName || "").split(" - ")[0].trim();
}

export function flagFor(teamNameOrCountry) {
  return FLAGS[countryOf(teamNameOrCountry)] || "";
}
