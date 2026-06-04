<template>
  <div class="w-max bg-white text-md px-2 py-3 min-w-[200px]">
    <template v-if="tab === 'main'">
      <p class="text-center" v-if="currentSoftware">
        Currently detecting
        <span class="font-bold text-purple-500">{{ currentSoftware }}</span>
      </p>
      <p class="text-center" v-else>No known software detected</p>

      <div v-if="currentSoftware === 'carde'" class="flex justify-center mt-2">
        <button
          class="button"
          @click="extractPlayers"
          :disabled="isLoading"
        >
          Extract players
        </button>
      </div>
<div v-if="canExtractHeroes" class="flex justify-center mt-2">
        <button class="button" @click="extractHeroes" :disabled="isLoading">
          Extract heroes
        </button>
      </div>

      <div v-if="canExtractResults" class="flex justify-center mt-2">
        <button class="button" @click="extractResults" :disabled="isLoading">
          Extract results
        </button>
      </div>

      <div v-if="canExtractStandings" class="flex justify-center mt-2">
        <button class="button" @click="extractStanding" :disabled="isLoading">
          Extract standings
        </button>
      </div>

      <div v-if="canExtractStandings && currentSoftware === 'carde'" class="flex justify-center mt-2">
        <button class="button" @click="extractBestOfDecks" :disabled="isLoading">
          Extract best of decks
        </button>
      </div>

      <div v-if="currentSoftware === 'purplefox'" class="flex justify-center mt-2">
        <button class="button" @click="exportPenalties" :disabled="isLoading">
          Export penalties CSV
        </button>
      </div>

      <p v-else-if="!['carde', 'purplefox', 'kgcn'].includes(currentSoftware || '')">No action possible on this page</p>

      <div v-if="isLoading" class="loader"></div>
      <p v-if="message" class="mt-2">{{ message }}</p>
      <button
        class="block mt-3 ml-auto text-xs text-purple-500 underline hover:text-purple-700"
        @click="tab = 'settings'"
      >
        Settings
      </button>
    </template>
    <template v-if="tab === 'settings'">
      Currently {{ tournamentsCount }} tournaments are in memory.
      <button
        v-if="tournamentsCount !== 0"
        class="mt-2 button"
        @click="clearMemory"
      >
        Clear
      </button>

      <div class="mt-4 text-left">
        <label class="block text-sm font-bold mb-1 text-black">Watched Players (Player ID, Name, Surname, one for each raw):</label>
        <textarea
          v-model="starredPlayers"
          class="w-full border border-gray-300 rounded p-1 text-sm text-black"
          rows="4"
          placeholder="Es: 123456789&#10;Mario Rossi"
        ></textarea>
      </div>

      <div>
        <button
          class="block mt-3 ml-auto text-xs text-purple-500 underline hover:text-purple-700"
          @click="tab = 'main'"
        >
          Back
        </button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import "./style.css";
import { defineComponent, ref, watch } from "vue";
import { useTournaments } from "@/use/useTournaments";
import { usePath } from "@/use/usePath";

interface ScriptResult<T> {
  value: T;
  message: string;
  errorCount: number;
}

interface Player {
  name: string;
  gameId: number | string;
  deckName?: string | null;
}

interface MatchResult {
  tableNumber: number;
  playerName1: string | null;
  playerGameId1: string | null;
  playerName2: string | null;
  playerGameId2: string | null;
  result: string | null;
}

interface Standing {
  name: string;
  gameId: number;
  standing: number;
  isDropped: boolean;
  rank: number;
}

interface HeroInfo {
  name: string | null;
  gameId: string | null;
  hero: string | null;
}

interface BestOfDeck {
  deckName: string;
  name: string;
  gameId: string | number;
  finalPosition: string | number;
  rank: number;
  points: number;
  isPlayerPending?: boolean;
}

interface BestOfDecksPayload {
  bestDecks: BestOfDeck[];
  unknownDecks: BestOfDeck[];
}

export default defineComponent({
  name: "App",
  setup() {
    const { tournamentsCount, clearMemory } = useTournaments();
    const {
      currentSoftware,
      canExtractResults,
      canExtractHeroes,
      canExtractStandings,
    } = usePath();

    const token = ref("");
    chrome.storage.local.get("token", function ({ token: value }) {
      token.value = value;
    });

    const starredPlayers = ref("");
    if (chrome.storage?.session) {
      chrome.storage.session.get("starredPlayers", function (data) {
        if (data.starredPlayers) starredPlayers.value = data.starredPlayers;
      });
    } else if (chrome.storage?.local) {
      chrome.storage.local.get("starredPlayers", function (data) {
        if (data.starredPlayers) starredPlayers.value = data.starredPlayers;
      });
    }

    watch(starredPlayers, (newVal) => {
      if (chrome.storage?.session) {
        chrome.storage.session.set({ starredPlayers: newVal });
      } else if (chrome.storage?.local) {
        chrome.storage.local.set({ starredPlayers: newVal });
      }
    });

    return {
      currentSoftware,
      tournamentsCount,
      clearMemory,
      canExtractResults,
      canExtractHeroes,
      canExtractStandings,
      tab: ref("main"),
      message: ref(""),
      isLoading: ref(false),
      token,
      starredPlayers
    };
  },
  methods: {
    async extractResults() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: (
            this.currentSoftware === "gem" ? extractResultGem :
            this.currentSoftware === "kgcn" ? extractResultKgcn :
            extractResultCarde
          ) as any,
          args: [this.token || "", this.starredPlayers || ""],
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<MatchResult[]>;
          navigator.clipboard.writeText(JSON.stringify(result.value));
          this.message = result.message;
          if (result.errorCount === 0) {
            setTimeout(() => {
              this.message = "";
            }, 2000);
          }
          this.isLoading = false;
        }
      );
    },
    async extractHeroes() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: exportHeroes,
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<HeroInfo[]>;
          navigator.clipboard.writeText(JSON.stringify(result.value));
          this.isLoading = false;
        }
      );
    },
    async extractStanding() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: (
            this.currentSoftware === "kgcn" ? extractStandingKgcn :
            extractStandingCarde
          ) as any,
          args: [this.token || "", this.starredPlayers || ""],
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<Standing[]>;
          navigator.clipboard.writeText(JSON.stringify(result.value));
          this.message = result.message;
          if (result.errorCount === 0) {
            setTimeout(() => {
              this.message = "";
            }, 2000);
          }
          this.isLoading = false;
        }
      );
    },
    async extractPlayers() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: extractPlayersCarde as any,
          args: [this.token || ""],
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<Player[]>;
          navigator.clipboard.writeText(result.value.map((p: Player) => `${p.gameId}\t${p.name}\t${p.deckName || ""}`).join("\n"));
          this.message = result.message;
          if (result.errorCount === 0) {
            setTimeout(() => {
              this.message = "";
            }, 2000);
          }
          this.isLoading = false;
        }
      );
    },
    async extractBestOfDecks() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: extractBestOfDecksCarde as any,
          args: [this.token || ""],
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<BestOfDecksPayload>;
          if (result.errorCount > 0) {
            this.message = result.message;
            this.isLoading = false;
            return;
          }

          const mapRow = (b: BestOfDeck) => {
            const safeDeckName = b.deckName ? b.deckName.replace(/"/g, '""') : "";
            if (b.isPlayerPending) {
              return `"${safeDeckName}","PENDING"`;
            }
            const safeName = b.name ? b.name.replace(/"/g, '""') : "";
            return `"${safeDeckName}","${safeName}","${b.gameId}","${b.points}","${b.finalPosition}"`;
          };
          const bestRows = result.value.bestDecks.map(mapRow);
          let csvText = ["Deck,Player,ID,Points,Position", ...bestRows].join("\r\n");
          if (result.value.unknownDecks && result.value.unknownDecks.length > 0) {
            const unknownRows = result.value.unknownDecks.map(mapRow);
            csvText += "\r\n\r\nUnknown Decks\r\nDeck,Player,ID,Points,Position\r\n" + unknownRows.join("\r\n");
          }

          const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = "best_of_decks.csv";
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          this.message = result.message;
          setTimeout(() => {
            this.message = "";
          }, 2000);
          this.isLoading = false;
        }
      );
    },
    async exportPenalties() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          func: extractPurpleFoxPenalties,
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) {
            this.message = "Script Error";
            this.isLoading = false;
            return;
          }
          const result = results[0].result as ScriptResult<void>;
          this.message = result.message;
          
          if (result.errorCount === 0) {
            setTimeout(() => {
              this.message = "";
            }, 2000);
          }
          this.isLoading = false;
        }
      );
    },
  },
});

const extractPurpleFoxPenalties = async (): Promise<ScriptResult<void>> => {

  const getSupabaseToken = () => {
    let latestToken = null;
    let maxExpiry = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const item = JSON.parse(localStorage.getItem(key) || "{}");
        let token = null;
        let expiry = 0;

        if (item && item.currentSession && item.currentSession.access_token) {
          token = item.currentSession.access_token;
          expiry = item.expiresAt || item.currentSession.expires_at || 0;
        }

        else if (item && item.access_token) {
          token = item.access_token;
          expiry = item.expires_at || item.expiresAt || 0;
        }

        if (token && expiry > maxExpiry) {
          latestToken = token;
          maxExpiry = expiry;
        }
      } catch (e) {
        console.error(`Failed to parse localStorage item with key: ${key}`, e);
      }
    }
    return latestToken;
  };


  const decodeJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const rawToken = getSupabaseToken();
  if (!rawToken) return { value: undefined, errorCount: 1, message: "Token not found. Please log in to PurpleFox." };

  const decodedToken = decodeJwt(rawToken);
  const currentUserId = decodedToken ? decodedToken.sub : null;
  if (!currentUserId) {
    return { value: undefined, errorCount: 1, message: "Could not identify user from token." };
  }

  const match = window.location.href.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (!match) return { value: undefined, errorCount: 1, message: "Tournament ID not found in the URL." };
  const tournamentId = match[1];

  const SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYzNDk5MTIyMiwiZXhwIjoxOTUwNTY3MjIyfQ.i26CuuxL44qZ4roGI3Akzdpx57bGANc4ZaK-nVEwC6I";

  try {
    const profileUrl = `https://nsytfortyuheqhyxxpzl.supabase.co/rest/v1/profiles?select=firstname,lastname&id=eq.${currentUserId}`;
    const profileResponse = await fetch(profileUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_API_KEY,
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!profileResponse.ok) throw new Error("Could not fetch user profile.");
    const profiles = await profileResponse.json();
    if (!profiles || profiles.length === 0) throw new Error("User profile not found.");
    const currentUserProfile = profiles[0];
    const currentUserFirstName = (currentUserProfile.firstname || '').trim().toLowerCase();
    const currentUserLastName = (currentUserProfile.lastname || '').trim().toLowerCase();

    const rolesUrl = `https://nsytfortyuheqhyxxpzl.supabase.co/rest/v1/roles?select=name,profiles(firstname,lastname)&tournamentId=eq.${tournamentId}&name=eq.admin`;
    const rolesResponse = await fetch(rolesUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_API_KEY,
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });
    if (!rolesResponse.ok) throw new Error("Could not fetch tournament roles.");
    const admins = await rolesResponse.json();

    const isAdmin = admins.some((admin: { profiles: { firstname: string, lastname: string } }) => 
      admin.profiles &&
      (admin.profiles.firstname || '').trim().toLowerCase() === currentUserFirstName &&
      (admin.profiles.lastname || '').trim().toLowerCase() === currentUserLastName
    );

    if (!isAdmin) {
      return { value: undefined, errorCount: 1, message: "You are not an admin for this tournament." };
    }

    const penaltiesUrl = `https://nsytfortyuheqhyxxpzl.supabase.co/rest/v1/tournament_penalities?select=*&tournamentId=eq.${tournamentId}`;
    const penaltiesResponse = await fetch(penaltiesUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_API_KEY,
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!penaltiesResponse.ok) throw new Error("API Error");
    const data = await penaltiesResponse.json();
    if (!data || data.length === 0) return { value: undefined, errorCount: 1, message: "No penalties found." };

    // --- FETCH TABLE STATUS (TIME EXTENSIONS) ---
    const tableStatusUrl = `https://nsytfortyuheqhyxxpzl.supabase.co/rest/v1/table_status?select=*&tournamentId=eq.${tournamentId}`;
    const tableStatusResponse = await fetch(tableStatusUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_API_KEY,
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });

    // Step 1: Save the time extension mapped by table number
    const timeExtensions: Record<number, string> = {};
    if (tableStatusResponse.ok) {
      const statusData = await tableStatusResponse.json();
      statusData.forEach((status: any) => {
        if (status.tableNumber != null && status.time != null) {
          timeExtensions[status.tableNumber] = `+${status.time}`;
        }
      });
    }

    // --- FETCH TABLES (TO MAP PLAYER TO TABLE) ---
    const tablesUrl = `https://nsytfortyuheqhyxxpzl.supabase.co/rest/v1/tables?select=*&tournamentId=eq.${tournamentId}`;
    const tablesResponse = await fetch(tablesUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_API_KEY,
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });

    const playerToTableMap: Record<string, number> = {};
    if (tablesResponse.ok) {
      const tablesData = await tablesResponse.json();
      tablesData.forEach((match: any) => {
        if (match.tableNumber != null) {
          if (match.playerGameId1) playerToTableMap[match.playerGameId1] = match.tableNumber;
          if (match.playerGameId2) playerToTableMap[match.playerGameId2] = match.tableNumber;
        }
      });
    }

    const maxRound = Math.max(...data.map((row: Record<string, any>) => row.round || 0));

    // Pre-process the data so we can use the table number for sorting
    const enrichedData = data.map((row: Record<string, any>) => {
      const gameId = row.playerGameId || "";
      
      let tableNum: string | number = "";
      let timeExt = "";
      if (row.round === maxRound) {
        tableNum = playerToTableMap[gameId] ?? "";
        timeExt = tableNum ? (timeExtensions[tableNum] || "") : "";
      }
      return { ...row, gameId, tableNum, timeExt };
    });

    // Sort highest round first, then highest table number first (with empty tables at the bottom)
    enrichedData.sort((a, b) => {
      const roundA = a.round || 0;
      const roundB = b.round || 0;
      if (roundA !== roundB) return roundB - roundA; // Highest round first

      const tableA = a.tableNum === "" ? -Infinity : Number(a.tableNum);
      const tableB = b.tableNum === "" ? -Infinity : Number(b.tableNum);
      return tableB - tableA; // Highest table number first
    });

    const headers = ["Player", "ID", "Table", "Round", "Infraction", "Category", "Penalty", "Time Extension", "Description", "Judge"];
    const csvRows = enrichedData.map((row) => {
      const category = row.type ? row.type.split(" - ")[0].trim() : "";
      const formattedRound = row.round ? `R${row.round}` : "";
      const mappedRow = [
        row.playerName || "", row.gameId, row.tableNum, formattedRound, row.type || "", category, row.sanction || "", row.timeExt, row.description || "", row.creator_name || ""
      ];
      return mappedRow.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });
    const csvString = [headers.join(","), ...csvRows].join("\r\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `penalties_${tournamentId.substring(0, 8)}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { value: undefined, errorCount: 0, message: "CSV downloaded successfully!" };
  } catch (err: unknown) {
    return { value: undefined, errorCount: 1, message: (err as Error).message || "An error occurred during verification." };
  }
};

function extractResultGem() {
  const PLAYER_REGEXP = /^(.+) \((.+)\)$/;
  const TRANSLATE: any = {
    "Player 1 Win": "1WIN",
    "Player 2 Win": "2WIN",
    Draw: "DRAW",
  };
  const result: any = {};

  document.querySelectorAll(".match-row").forEach((row) => {
    const cells = row.querySelectorAll(".match-element");
    const [, playerName1 = null, playerGameId1 = null] =
      ((cells[1] as HTMLElement)?.innerText || "").trim().match(PLAYER_REGEXP) || [];
    const [, playerName2 = null, playerGameId2 = null] =
      ((cells[2] as HTMLElement)?.innerText || "").trim().match(PLAYER_REGEXP) || [];

    const tableNumber = parseInt((cells[0] as HTMLElement)?.innerText);
    result[tableNumber] = {
      tableNumber,
      playerName1,
      playerGameId1,
      playerName2,
      playerGameId2,
      result: cells[3]?.querySelector("select")?.value || null,
    };
  });

  let errorCount = 0;
  document.querySelectorAll("#refresh ul li").forEach((line) => {
    if (line.getAttribute("id") === "report-drops") return;
    if (line.getAttribute("id") === "report-undrop") return;
    const text = (line.querySelector("span") as HTMLElement)?.innerText?.trim();
    const [rawTable, rawPlayer1, rawPlayer2] = text?.split("\n") || [];
    const [, rawTableNumber] = rawTable?.match(/Table (\d+)/) || [];
    const tableNumber = parseInt(rawTableNumber);
    if (isNaN(tableNumber)) return;
    const [, playerName1, playerGameId1] =
      rawPlayer1?.match(/^Player 1 (.*) \((.*)\)/) || [];
    const [, playerName2, playerGameId2] =
      rawPlayer2?.match(/^Player 2 (.*) \((.*)\)/) || [];

    const reportedBy1 = rawPlayer1?.match(/reported (.*)$/)?.[1];
    const reportedBy2 = rawPlayer2?.match(/reported (.*)$/)?.[1];

    if (
      reportedBy1 !== reportedBy2 &&
      reportedBy1 !== "None" &&
      reportedBy2 !== "None"
    ) {
      errorCount = errorCount + 1;
      result[tableNumber] = {
        tableNumber,
        playerName1,
        playerName2,
        playerGameId1,
        playerGameId2,
        result: null,
      };
      return;
    }
    const finalResult = reportedBy1 === "None" ? reportedBy2 : reportedBy1;
    result[tableNumber] = {
      tableNumber,
        playerName1,
      playerName2,
      playerGameId1,
      playerGameId2,
      result: finalResult ? TRANSLATE[finalResult] || finalResult : null,
    };
  });

  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }

  return { value: Object.values(result), message, errorCount };
}

async function extractResultCarde(token: string) {
  const [, eventId, roundId] =
    window.location.pathname.match(/\/events\/(\d+)\/pairings\/round\/(\d+)/) ||
    [];
  const url = `https://api.admin.carde.io/api/v2/organize/tournament-rounds/${roundId}/matches-list/?round_id=${roundId}&avoid_cache=true&page=1&page_size=3000`;
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
      message: `Error fetching data: ${response.statusText}`,
      errorCount: 1,
    };
  }
  const { results: matches } = await response.json();

  const result = matches
    .map((match: Record<string, any>) => {
      if (match.table_number < 0) return;
      const player1 = match?.player_match_relationships?.[0];
      const player2 = match?.player_match_relationships?.[1];
      let matchResult;
      if (match.status === "COMPLETE") {
        matchResult =
          match.winning_player_id === player1?.player?.id
            ? "1WIN"
            : match.winning_player_id === player2?.player?.id
            ? "2WIN"
            : "DRAW";
      }
      return {
        tableNumber: match.table_number,
        playerName1: player1?.player
          ? `${player1.player.last_name}, ${player1.player.first_name}`
          : null,
        playerGameId1: player1?.player?.id || null,
        playerName2: player2?.player
          ? `${player2.player.last_name}, ${player2.player.first_name}`
          : null,
        playerGameId2: player2?.player?.id || null,
        result: matchResult,
      };
    })
    .filter((m: MatchResult | undefined) => m !== undefined);

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return { value: result, message, errorCount: 0 };
}

async function extractStandingCarde(token: string) {
  const [, eventId, roundId] =
    window.location.pathname.match(
      /\/events\/(\d+)\/standings\/round\/(\d+)/
    ) || [];
  const url = `https://api.admin.carde.io/api/v2/organize/tournament-rounds/${roundId}/standings?avoid_cache=true&page=1&page_size=3000`;
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
      message: `Error fetching data: ${response.statusText}`,
      errorCount: 1,
    };
  }
  const { results: players } = await response.json();

  const result = players.map((line: Record<string, any>) => {
    return {
      name: line.user_event_status?.user?.last_first,
      gameId: line.player?.id,
      standing: line.points,
      isDropped: line.user_event_status?.registration_status === "DROPPED",
      rank: line?.rank,
    };
  });

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return { value: result, message, errorCount: 0 };
}

async function extractPlayersCarde(token: string) {
  const [, eventId] = window.location.pathname.match(/\/events\/(\d+)/) || [];
  const url = `https://api.admin.carde.io/api/v2/organize/events/${eventId}/registrations-slim?avoid_cache=true&page=1&include_deaths=true&page_size=5000`;
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
      message: `Error fetching data: ${response.statusText}`,
      errorCount: 1,
    };
  }
  const { results: players } = await response.json();

  const result = players.filter((line: Record<string, any>) => line.registration_status === 'COMPLETE' || line.registration_status === 'ELIMINATED').map((line: Record<string, any>) => {
    return {
      name: line?.user?.last_first,
      gameId: line.user?.id,
      deckName: line.deck_submission?.deck_defining_card?.name || line.deck_submission?.deck_name || null,
    };
  });

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return { value: result, message, errorCount: 0 };
}

async function extractBestOfDecksCarde(token: string) {
  const match = window.location.pathname.match(
    /\/events\/(\d+)\/standings\/round\/(\d+)/
  );
  if (!match) {
    return {
      value: [],
      message: "Must be on a standings page to extract best of decks.",
      errorCount: 1,
    };
  }
  const [, eventId, roundId] = match;

  try {
    const standingsUrl = `https://api.admin.carde.io/api/v2/organize/tournament-rounds/${roundId}/standings?avoid_cache=true&page=1&page_size=3000`;
    const standingsRes = await fetch(standingsUrl, {
      method: "GET",
      headers: { Authorization: `Token ${token}` },
      credentials: "include",
    });

    const playersUrl = `https://api.admin.carde.io/api/v2/organize/events/${eventId}/registrations-slim?avoid_cache=true&page=1&include_deaths=true&page_size=5000`;
    const playersRes = await fetch(playersUrl, {
      method: "GET",
      headers: { Authorization: `Token ${token}` },
      credentials: "include",
    });

    if (!standingsRes.ok || !playersRes.ok) {
      return { value: [], message: `Error fetching data`, errorCount: 1 };
    }

    const { results: standingsData } = await standingsRes.json();
    const { results: playersData } = await playersRes.json();

    const playersMap = new Map();
    for (const p of playersData) {
      if (p.registration_status === "COMPLETE" || p.registration_status === "ELIMINATED") {
        const deckName = p.deck_submission?.deck_defining_card?.name || p.deck_submission?.deck_name || "Unknown";
        playersMap.set(p.user?.id, deckName);
      }
    }

    const deckBests = new Map();
    const allUnknowns: any[] = [];
    const top8DeckCounts = new Map();

    for (const line of standingsData) {
      const gameId = line.player?.id;
      const rank = line.rank;
      const name = line.user_event_status?.user?.last_first;
      const deckName = playersMap.get(gameId) || "Unknown";
      const points = line.points;

      if (rank <= 8 && deckName !== "Unknown") {
        top8DeckCounts.set(deckName, (top8DeckCounts.get(deckName) || 0) + 1);
      }

      if (deckName === "Unknown") {
        allUnknowns.push({ name, gameId, rank, deckName, points });
      } else {
        if (!deckBests.has(deckName) || rank < deckBests.get(deckName).rank) {
          deckBests.set(deckName, { name, gameId, rank, deckName, points });
        }
      }
    }

    const bestDecks = Array.from(deckBests.values()).map((best) => {
      const inTop8 = best.rank <= 8;
      const countInTop8 = top8DeckCounts.get(best.deckName) || 0;
      return {
        ...best,
        isPlayerPending: inTop8 && countInTop8 > 1,
        finalPosition: inTop8 ? "PENDING" : best.rank,
      };
    });

    bestDecks.sort((a, b) => {
      if (a.finalPosition === "PENDING" && b.finalPosition !== "PENDING") return -1;
      if (a.finalPosition !== "PENDING" && b.finalPosition === "PENDING") return 1;
      return a.rank - b.rank;
    });

    const maxRank = bestDecks.length > 0 ? Math.max(...bestDecks.map(d => d.rank)) : Infinity;

    const unknownDecks = allUnknowns
      .filter(u => u.rank <= maxRank)
      .map(u => ({
        ...u,
        finalPosition: u.rank <= 8 ? "PENDING" : u.rank,
      }));

    return { value: { bestDecks, unknownDecks }, message: "Best of decks downloaded!", errorCount: 0 };
  } catch (err: any) {
    return { value: [], message: err.message || "Error extracting data", errorCount: 1 };
  }
}

function exportHeroes() {
  const PLAYER_REGEXP = /^\s+(.+?) \((\d+)\)/;
  const HERO_REGEXP = /^\s+(.+)\n/;
  const result: HeroInfo[] = [];
  document.querySelectorAll("ol li div.row").forEach((player) => {
    const cells = player.querySelectorAll("div");
    const [, playerName = null, playerGameId = null] =
      cells[0].children[0].innerHTML.match(PLAYER_REGEXP) || [];
    const [, hero = null] = cells[1].innerHTML.match(HERO_REGEXP) || [];
    result.push({
      name: playerName,
      gameId: playerGameId,
      hero: hero,
    });
  });
  return { value: result, message: "Heroes Copied", errorCount: 0 };
}

async function extractResultKgcn(token: string, starredPlayers: string) {
  const formatName = (fullName: string) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts.pop();
      return `${parts.join(" ")} ${lastName?.charAt(0).toUpperCase()}.`;
    }
    return fullName;
  };

  const obfuscateId = (id: string): string => {
    if (!id) return "";
    try {
      return (BigInt(id) ^ BigInt(8392745016)).toString();
    } catch {
      return id;
    }
  };

  const watchedPlayerLines = (starredPlayers || '').toLowerCase().split('\n').map(p => p.trim()).filter(Boolean);
  const isPlayerWatched = (name: string, id: string) => {
      if (watchedPlayerLines.length === 0) return false;
      const lowerCaseName = name.toLowerCase();
      return watchedPlayerLines.some(line => lowerCaseName.includes(line) || (id && line === id));
  };

  const match = window.location.hash.match(/\/(?:tournament|tournament-duel)\/([^\/]+)/);
  if (!match) {
    return { value: [], message: "Tournament ID not found in URL", errorCount: 1 };
  }
  
  const eventId = match[1];
  let roundId = '0';
  let extractionMethod = 'unknown';

  try {
    const roundResponse = await fetch(`https://shp.cardgame-network.konami.net/mt/tournament/${eventId}/nowRound`, {
      method: "GET",
      credentials: "include",
    });
    if (roundResponse.ok) {
      const roundText = await roundResponse.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(roundText, "text/xml");
      roundId = xmlDoc.querySelector("Integer")?.textContent || '0';
      if (roundId !== '0') {
        extractionMethod = 'API (/nowRound)';
      }
    }
  } catch (e) {
    console.error("Error fetching nowRound API:", e);
  }

  if (roundId === '0') {
    const roundMatch = window.location.hash.match(/\/round\/(\d+)/);
    roundId = roundMatch ? roundMatch[1] : '0';
    extractionMethod = 'URL Hash';
  }

  const url = `https://shp.cardgame-network.konami.net/mt/tournament-underway/round/${eventId}/${roundId}?upd=off`;

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include", 
    });

    if (!response.ok) {
      return { value: [], message: `Error fetching data: ${response.statusText}`, errorCount: 1 };
    }

    const responseText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      return { value: [], message: "Failed to parse API response. It might not be valid XML.", errorCount: 1 };
    }

    const compeListNodes = xmlDoc.querySelectorAll("data > compeList > compeList");

    const results = Array.from(compeListNodes).map((matchNode) => {
      let matchResult = "PENDING";
      const resultText = matchNode.querySelector("result")?.textContent;
      
      if (resultText === "WIN") {
        matchResult = "1WIN";
      } else if (resultText === "LOSE") {
        matchResult = "2WIN";
      } else if (resultText === "BOTH_DEFEAT") {
        matchResult = "DRAW";
      }

      const user1Node = matchNode.querySelector("user1");
      const user2Node = matchNode.querySelector("user2");

      const id1 = user1Node?.querySelector("cossyId")?.textContent || "";
      const name1 = user1Node?.querySelector("name")?.textContent || "";
      const id2 = user2Node?.querySelector("cossyId")?.textContent || "";
      const name2 = user2Node?.querySelector("name")?.textContent || "";

      const formattedName1 = formatName(name1);
      const formattedName2 = formatName(name2);

      return {
        playerGameId1: obfuscateId(id1) || null,
        playerName1: isPlayerWatched(name1, id1) ? `⭐ ${formattedName1}` : formattedName1,
        playerGameId2: obfuscateId(id2) || null,
        playerName2: isPlayerWatched(name2, id2) ? `⭐ ${formattedName2}` : formattedName2,
        result: matchResult,
        tableNumber: parseInt(matchNode.querySelector("displayTableName")?.textContent || "0", 10) || 0
      };
    });

    return { 
      value: results, 
      message: "KGCN Extraction complete. Copied.", 
      errorCount: 0 
    };

  } catch (error: unknown) {
    return { value: [], message: `Error: ${(error as Error).message}`, errorCount: 1 };
  }
}

async function extractStandingKgcn(token: string, starredPlayers: string) {
  const formatName = (fullName: string) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts.pop();
      return `${parts.join(" ")} ${lastName?.charAt(0).toUpperCase()}.`;
    }
    return fullName;
  };

  const obfuscateId = (id: string): string => {
    if (!id) return "";
    try {
      return (BigInt(id) ^ BigInt(8392745016)).toString();
    } catch {
      return id;
    }
  };

  const watchedPlayerLines = (starredPlayers || '').toLowerCase().split('\n').map(p => p.trim()).filter(Boolean);
  const isPlayerWatched = (name: string, id: string) => {
      if (watchedPlayerLines.length === 0) return false;
      const lowerCaseName = name.toLowerCase();
      return watchedPlayerLines.some(line => lowerCaseName.includes(line) || (id && line === id));
  };

  const match = window.location.hash.match(/\/(?:tournament|tournament-duel)\/([^\/]+)/);
  if (!match) {
    return { value: [], message: "Tournament ID not found in URL", errorCount: 1 };
  }
  
  const eventId = match[1];
  const url = `https://shp.cardgame-network.konami.net/mt/tournament/${eventId}/ranking`;

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include", 
    });

    if (!response.ok) {
      return { value: [], message: `Error fetching data: ${response.statusText}`, errorCount: 1 };
    }

    const responseText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      return { value: [], message: "Failed to parse API response. It might not be valid XML.", errorCount: 1 };
    }

    const rankingNodes = xmlDoc.querySelectorAll("List > item");

    const results = Array.from(rankingNodes).map((playerNode) => {
      const wins = parseInt(playerNode.querySelector("wins")?.textContent || "0", 10);
      const draws = parseInt(playerNode.querySelector("draws")?.textContent || "0", 10);
      const points = (wins * 3) + (draws * 0);
      
      const gameId = playerNode.querySelector("cossyId")?.textContent || "";
      const rawName = playerNode.querySelector("cossyName")?.textContent || "";

      return {
        gameId: obfuscateId(gameId),
        isDropped: playerNode.querySelector("leavingAwayStatus")?.textContent === '9',
        name: isPlayerWatched(rawName, gameId) ? `⭐ ${formatName(rawName)}` : formatName(rawName),
        rank: parseInt(playerNode.querySelector("rankNo")?.textContent || "0", 10),
        standing: points
      };
    });

    return { 
      value: results, 
      message: "KGCN Standings Extraction complete. Copied.", 
      errorCount: 0 
    };

  } catch (error: unknown) {
    return { value: [], message: `Error: ${(error as Error).message}`, errorCount: 1 };
  }
}

</script>

<style scoped>
.button {
  @apply block bg-purple-500 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 active:bg-transparent active:border-purple-500 active:text-purple-500 border border-transparent;
}
.loader {
  animation: rotate 2s infinite;
  height: 50px;
  width: 50px;
}

.loader:before,
.loader:after {
  border-radius: 50%;
  content: "";
  display: block;
  height: 20px;
  width: 20px;
}
.loader:before {
  animation: ball1 2s infinite;
  @apply bg-purple-500;
  box-shadow: 30px 0 0 #ffa317;
  margin-bottom: 10px;
}
.loader:after {
  animation: ball2 2s infinite;
  background-color: "#FFA317";
  box-shadow: 30px 0 0 #814bb8;
}

@keyframes rotate {
  0% { transform: rotate(0deg) scale(0.8); }
  50% { transform: rotate(360deg) scale(1.2); }
  100% { transform: rotate(720deg) scale(0.8); }
}

@keyframes ball1 {
  0% { box-shadow: 30px 0 0 #ffa317; }
  50% { box-shadow: 0 0 0 #ffa317; margin-bottom: 0; transform: translate(15px, 15px); }
  100% { box-shadow: 30px 0 0 #ffa317; margin-bottom: 10px; }
}

@keyframes ball2 {
  0% { box-shadow: 30px 0 0 #814bb8; }
  50% { box-shadow: 0 0 0 #814bb8; margin-top: -20px; transform: translate(15px, 15px); }
  100% { box-shadow: 30px 0 0 #814bb8; margin-top: 0; }
}
</style>