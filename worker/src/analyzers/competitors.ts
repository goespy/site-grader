/**
 * Competitor Analysis — calls Google Places Text Search (New) API
 * to find top competitors near the scanned business's location.
 *
 * Returns null on any error so the report still generates without
 * the competitor section.
 */

import type { ParsedPage } from './fetch-page';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Competitor {
  name: string;
  rating: number;
  reviewCount: number;
  mapsUrl: string;
}

export interface CompetitorData {
  competitors: Competitor[];
  searchQuery: string;
}

interface Env {
  GOOGLE_PLACES_API_KEY?: string;
}

// ---------------------------------------------------------------------------
// Location extraction
// ---------------------------------------------------------------------------

/**
 * US city + state patterns. Matches forms like:
 * - "Bradenton, FL"
 * - "Tampa Bay, Florida"
 * - "Cape Coral FL"
 * - "Sarasota & Gulf Coast FL"
 */
const CITY_STATE_RE =
  /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s&\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)?),?\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\sHampshire|New\sJersey|New\sMexico|New\sYork|North\sCarolina|North\sDakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\sIsland|South\sCarolina|South\sDakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\sVirginia|Wisconsin|Wyoming)\b/;

/** Extract the best location string from page metadata. */
function extractLocation(page: ParsedPage): string | null {
  const sources = [
    page.title,
    page.metaDescription,
    page.h1,
    page.ogTitle,
    page.ogDescription,
  ];

  // Only match City + State pairs to avoid ambiguous city names
  for (const source of sources) {
    if (!source) continue;
    const match = CITY_STATE_RE.exec(source);
    if (match) {
      return `${match[1]}, ${match[2]}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Places API
// ---------------------------------------------------------------------------

interface PlacesResponse {
  places?: {
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
  }[];
}

export async function findCompetitors(
  page: ParsedPage,
  businessType: string,
  env: Env,
): Promise<CompetitorData | null> {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return null;
  }

  try {
    const location = extractLocation(page);
    if (!location) {
      console.log('Competitors: no City + State found on page, skipping');
      return null;
    }
    const searchQuery = `${businessType} in ${location}`;

    console.log(`Competitors: searching for "${searchQuery}"`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri',
        },
        signal: controller.signal,
        body: JSON.stringify({ textQuery: searchQuery }),
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`Competitors API error: ${response.status} ${response.statusText}`, errorBody);
      return null;
    }

    const data: PlacesResponse = await response.json();

    if (!data.places || data.places.length === 0) {
      console.error('Competitors: no results returned');
      return null;
    }

    // Extract the scanned business name from the page title (first segment before |, -, or —)
    const scannedName = (page.title || '')
      .split(/\s*[|–—-]\s*/)[0]
      .trim()
      .toLowerCase();

    const competitors: Competitor[] = data.places
      .filter((place) => {
        const name = (place.displayName?.text || '').toLowerCase();
        // Filter out the scanned business itself
        if (scannedName && name && scannedName.includes(name)) return false;
        if (scannedName && name && name.includes(scannedName)) return false;
        // Must have a rating
        return typeof place.rating === 'number' && place.rating > 0;
      })
      .slice(0, 5)
      .map((place) => ({
        name: place.displayName?.text || 'Unknown',
        rating: place.rating || 0,
        reviewCount: place.userRatingCount || 0,
        mapsUrl: place.googleMapsUri || '',
      }));

    if (competitors.length === 0) {
      return null;
    }

    console.log(`Competitors: found ${competitors.length} results`);
    return { competitors, searchQuery };
  } catch (err) {
    console.error('Competitors search failed:', err);
    return null;
  }
}
