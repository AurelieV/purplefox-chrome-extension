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
          @click="extractCardePlayers"
          :disabled="isLoading"
        >
          Extract players
        </button>
      </div>
      <div v-if="canExtractMeta" class="flex justify-center mt-2">
        <button
          class="button"
          @click="extractLorcanaMeta"
          :disabled="isLoading"
        >
          Extract meta
        </button>
      </div>
      <div v-if="canExtractHeroes" class="flex justify-center mt-2">
        <button class="button" @click="extractHeroes" :disabled="isLoading">
          Extract heroes
        </button>
      </div>
      <div v-else-if="canExtractResults" class="flex justify-center mt-2">
        <button class="button" @click="extractResults" :disabled="isLoading">
          Extract results
        </button>
      </div>
      <div v-else-if="canExtractStandings" class="flex justify-center mt-2">
        <button class="button" @click="extractStanding" :disabled="isLoading">
          Extract standings
        </button>
      </div>
      <p
        v-if="
          currentSoftware &&
          currentSoftware !== 'carde' &&
          !canExtractHeroes &&
          !canExtractResults &&
          !canExtractStandings &&
          !canExtractMeta
        "
      >
        No action possible on this page
      </p>
      <div v-if="isLoading" class="loader"></div>
      <div
        v-if="metaState === 'loading'"
        class="flex flex-col items-center mt-2"
      >
        <div class="loader"></div>
        <p class="mt-2 text-sm text-center text-gray-600">
          Fetching all decks from carde… this can take up to a minute. You can
          close this popup, the result will be kept.
        </p>
      </div>
      <div v-else-if="metaState === 'done' && metaTsv" class="mt-2">
        <button class="button" @click="copyMeta">
          Copy meta ({{ metaCount }})
        </button>
        <p v-if="metaTimeLabel" class="mt-1 text-xs text-center text-gray-500">
          Extracted at {{ metaTimeLabel }}
        </p>
        <textarea
          readonly
          :value="metaTsv"
          rows="3"
          class="w-full p-1 mt-1 text-xs border rounded"
        ></textarea>
      </div>
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
import { defineComponent, ref } from "vue";
import { useTournaments } from "@/use/useTournaments";
import { usePath } from "@/use/usePath";

export default defineComponent({
  name: "App",
  setup() {
    const { tournamentsCount, clearMemory } = useTournaments();
    const {
      currentSoftware,
      canExtractResults,
      canExtractHeroes,
      canExtractStandings,
      canExtractMeta,
    } = usePath();

    const token = ref("");
    chrome.storage.local.get("token", function ({ token: value }) {
      token.value = value;
      console.log("Loaded token from storage", value);
    });

    return {
      currentSoftware,
      tournamentsCount,
      clearMemory,
      canExtractResults,
      canExtractHeroes,
      canExtractStandings,
      canExtractMeta,
      tab: ref("main"),
      message: ref(""),
      isLoading: ref(false),
      metaState: ref(""),
      metaTsv: ref(""),
      metaCount: ref(0),
      metaAt: ref(0),
      token,
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
          function:
            this.currentSoftware === "gem"
              ? extractResultGem
              : extractResultCarde,
          args: this.currentSoftware === "gem" ? [] : [this.token ?? ""],
        },
        (results: any) => {
          const { result } = results[0];
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
          function: exportHeroes,
        },
        (results: any) => {
          const { result } = results[0];
          this.isLoading = false;
          navigator.clipboard.writeText(JSON.stringify(result));
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
          function: extractStandingCarde,
          args: [this.token ?? ""],
        },
        (results: any) => {
          const { result } = results[0];
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
    async extractCardePlayers() {
      this.isLoading = true;
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id as number },
          function: extractPlayersCarde,
          args: [this.token ?? ""],
        },
        (results: any) => {
          const { result } = results[0];
          navigator.clipboard.writeText(result.value.map((p) => `${p.gameId}\t${p.name}`).join("\n"));
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
    async extractLorcanaMeta() {
      let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;
      const [, eventId] = (tab.url || "").match(/\/events\/(\d+)/) || [];
      // Triggered in the service worker: it survives the popup being closed.
      this.metaState = "loading";
      this.metaTsv = "";
      this.message = "";
      chrome.runtime.sendMessage({
        action: "extractMeta",
        tabId: tab.id,
        eventId,
      });
    },
    async copyMeta() {
      try {
        await navigator.clipboard.writeText(this.metaTsv);
        this.message = `Copied ${this.metaCount} decks to clipboard`;
        setTimeout(() => {
          this.message = "";
        }, 2000);
      } catch {
        this.message = "Copy failed — click inside the popup, then retry";
      }
    },
    loadMetaFromStorage() {
      chrome.storage.local.get(
        ["metaStatus", "metaResult"],
        ({ metaStatus, metaResult }) => {
          const state = metaStatus?.state || "";
          // Safeguard: a too-old "loading" state (SW killed) must not block the UI.
          const isStale =
            state === "loading" && Date.now() - (metaStatus?.at || 0) > 180000;
          this.metaState = isStale ? "" : state;
          if (state === "error") {
            this.message = metaStatus.message || "Extraction failed";
          }
          if (metaResult) {
            this.metaTsv = metaResult.tsv || "";
            this.metaCount = metaResult.count || 0;
            this.metaAt = metaResult.at || 0;
          }
        }
      );
    },
  },
  computed: {
    metaTimeLabel() {
      return this.metaAt ? new Date(this.metaAt).toLocaleTimeString() : "";
    },
  },
  mounted() {
    this.loadMetaFromStorage();
    // The popup is recreated on each open: this listener dies with it (no leak).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.metaStatus || changes.metaResult)) {
        this.loadMetaFromStorage();
      }
    });
  },
});

function extractResultGem() {
  const PLAYER_REGEXP = /^(.+) \((.+)\)$/;
  const TRANSLATE = {
    "Player 1 Win": "1WIN",
    "Player 2 Win": "2WIN",
    Draw: "DRAW",
  };
  const result = {};

  // ACCEPTED RESULTS
  document.querySelectorAll(".match-row").forEach((row) => {
    const cells = row.querySelectorAll(".match-element");
    const [, playerName1 = null, playerGameId1 = null] =
      (cells[1]?.innerText || "").trim().match(PLAYER_REGEXP) || [];
    const [, playerName2 = null, playerGameId2 = null] =
      (cells[2]?.innerText || "").trim().match(PLAYER_REGEXP) || [];

    const tableNumber = parseInt(cells[0]?.innerText);
    result[tableNumber] = {
      tableNumber,
      playerName1,
      playerGameId1,
      playerName2,
      playerGameId2,
      result: cells[3]?.querySelector("select")?.value || null,
    };
  });

  // REPORTED RESULT (NOT ACCEPTED)
  const LINE_REGEXP = "";
  let errorCount = 0;
  document.querySelectorAll("#refresh ul li").forEach((line) => {
    if (line.getAttribute("id") === "report-drops") return;
    if (line.getAttribute("id") === "report-undrop") return;
    const text = line.querySelector("span")?.innerText?.trim();
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
      result: TRANSLATE[finalResult] || finalResult,
    };
  });

  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }

  return { value: Object.values(result), message, errorCount };
}

async function extractResultCarde(token) {
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
    .map((match: any) => {
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
    .filter((m: any) => m !== undefined);

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return { value: result, message, errorCount: 0 };
}

async function extractStandingCarde(token) {
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

  const result = players.map((line) => {
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

async function extractPlayersCarde(token) {
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

  const result = players.filter(line => line.registration_status === 'COMPLETE' || line.registration_status === 'ELIMINATED').map((line) => {
    return {
      name: line?.user?.last_first,
      gameId: line.user?.id,
    };
  });

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return { value: result, message, errorCount: 0 };
}

function exportHeroes() {
  const PLAYER_REGEXP = /^\s+(.+?) \((\d+)\)/;
  const HERO_REGEXP = /^\s+(.+)\n/;
  const result = [];
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
  return result;
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
  0% {
    transform: rotate(0deg) scale(0.8);
  }
  50% {
    transform: rotate(360deg) scale(1.2);
  }
  100% {
    transform: rotate(720deg) scale(0.8);
  }
}

@keyframes ball1 {
  0% {
    box-shadow: 30px 0 0 #ffa317;
  }
  50% {
    box-shadow: 0 0 0 #ffa317;
    margin-bottom: 0;
    transform: translate(15px, 15px);
  }
  100% {
    box-shadow: 30px 0 0 #ffa317;
    margin-bottom: 10px;
  }
}

@keyframes ball2 {
  0% {
    box-shadow: 30px 0 0 #814bb8;
  }
  50% {
    box-shadow: 0 0 0 #814bb8;
    margin-top: -20px;
    transform: translate(15px, 15px);
  }
  100% {
    box-shadow: 30px 0 0 #814bb8;
    margin-top: 0;
  }
}
</style>
