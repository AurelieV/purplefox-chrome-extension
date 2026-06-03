export type RawDeck = { gameId: string | number | null; cards: string[] };
export type FetchDecksResult = {
  value: RawDeck[];
  message: string;
  errorCount: number;
};

const CARD_API_URL = "https://api.lorcana-api.com/cards/all";
const CARD_INK_TTL = 24 * 60 * 60 * 1000; // 24h

// Card -> colors map, fetched from lorcana-api.com and cached in
// chrome.storage.local (24h TTL). Must be called from the service worker only.
// If the API is unavailable but a cache exists (even stale), it is reused.
export async function getCardInk(): Promise<Record<string, string>> {
  const { cardInk, cardInkAt } = await chrome.storage.local.get([
    "cardInk",
    "cardInkAt",
  ]);
  const isFresh = cardInk && cardInkAt && Date.now() - cardInkAt < CARD_INK_TTL;
  if (isFresh) return cardInk;

  try {
    const map = await fetchCardInk();
    await chrome.storage.local.set({ cardInk: map, cardInkAt: Date.now() });
    return map;
  } catch (e) {
    if (cardInk) return cardInk; // fall back to the stale cache
    throw e;
  }
}

async function fetchCardInk(): Promise<Record<string, string>> {
  const response = await fetch(CARD_API_URL);
  if (!response.ok) {
    throw new Error(`lorcana-api error: ${response.status}`);
  }
  const cards = await response.json();
  const map: Record<string, string> = {};
  for (const card of cards) {
    if (card.Name && card.Color) map[card.Name] = card.Color;
  }
  return map;
}

// Lorcana archetype = unique inks (colors) across all cards, sorted, joined with "/".
// Ported from eor-fab/script/extract_meta.js (getArchetype).
export function getLorcanaArchetype(
  cardNames: string[],
  map: Record<string, string>
): string {
  return [...new Set(cardNames.map((name) => map[name]?.split(", ")).flat())]
    .filter(Boolean)
    .sort()
    .join("/");
}

// Raw decks -> TSV `gameId\tarchetype` (one player per line).
export function buildMetaTsv(
  decks: RawDeck[],
  map: Record<string, string>
): string {
  return decks
    .filter((d) => d.gameId)
    .map((d) => `${d.gameId}\t${getLorcanaArchetype(d.cards || [], map)}`)
    .join("\n");
}

// Injected into the carde.io page (via chrome.scripting.executeScript): for the
// current event, fetches the deck list (deck_ids via registrations-slim) then their
// cards (decks/printing, paginated by 50). Returns raw [{ gameId, cards }].
// IMPORTANT: self-contained — must not reference any module variable (it is
// serialized and executed in the page context).
export async function fetchLorcanaDecksCarde(
  token: string
): Promise<FetchDecksResult> {
  const [, eventId] = window.location.pathname.match(/\/events\/(\d+)/) || [];

  // 1. Registrations -> deck_ids
  const regUrl = `https://api.admin.carde.io/api/v2/organize/events/${eventId}/registrations-slim?avoid_cache=true&page=1&include_deaths=true&page_size=5000`;
  const regResponse = await fetch(regUrl, {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
    },
    credentials: "include",
  });
  if (!regResponse.ok) {
    return {
      value: [],
      message: `Error fetching registrations: ${regResponse.statusText}`,
      errorCount: 1,
    };
  }
  const { results: registrations } = await regResponse.json();
  const active = registrations.filter(
    (r: any) =>
      r.registration_status === "COMPLETE" ||
      r.registration_status === "ELIMINATED"
  );
  const deckIds = active
    .map((r: any) => r.deck_submission?.deck_id ?? r.deck_id ?? r.deck?.id ?? null)
    .filter(Boolean);

  if (deckIds.length === 0) {
    // Diagnostic: no deck_id found -> surface the actual object shape
    const sampleKeys = active[0] ? Object.keys(active[0]).join(", ") : "none";
    return {
      value: [],
      message: `No deck_id found. Registration keys: ${sampleKeys}`,
      errorCount: 1,
    };
  }

  // 2. decks/printing paginated by 50 -> cards per player
  const DECK_PER_PAGE = 50;
  let result: RawDeck[] = [];
  for (let page = 0; page * DECK_PER_PAGE < deckIds.length; page++) {
    const ids = deckIds
      .slice(page * DECK_PER_PAGE, (page + 1) * DECK_PER_PAGE)
      .join(",");
    const url = encodeURI(
      `https://api.admin.carde.io/api/v2/organize/decks/printing/?deck_ids=${ids}`
    );
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${token}`,
      },
      credentials: "include",
    });
    if (!response.ok) {
      return {
        value: [],
        message: `Error fetching decks: ${response.statusText}`,
        errorCount: 1,
      };
    }
    const data = await response.json();
    result = result.concat(
      (data.decks || []).map((d: any) => ({
        gameId: d.user?.id,
        cards: (d.sections?.[0]?.cards || []).map(
          (c: any) => c.card?.display_name
        ),
      }))
    );
  }

  return { value: result, message: "", errorCount: 0 };
}
