<template>
    <div class="w-max bg-white text-md px-2 py-3 min-w-[200px]">
        <template v-if="tab === 'main'">
            <p class="text-center" v-if="currentSoftware">
                Currently detecting <span class="font-bold text-purple-500">{{ currentSoftware }}</span>
            </p>
            <p class="text-center" v-else>No known software detected</p>
            <div v-if="canExtractHeroes" class="flex justify-center mt-2">
                <button class="button" @click="extractHeroes">Extract heroes</button>
            </div>
            <div v-else-if="canExtractResults" class="flex justify-center mt-2">
                <button class="button" @click="extractResults">Extract results</button>
            </div>
            <p v-else>No action possible on this page</p>
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
            <button v-if="tournamentsCount !== 0" class="mt-2 button" @click="clearMemory">Clear</button>
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
        const { currentSoftware, canExtractResults, canExtractHeroes } = usePath();
        return {
            currentSoftware,
            tournamentsCount,
            clearMemory,
            canExtractResults,
            canExtractHeroes,
            tab: ref("main"),
            message: ref(""),
        };
    },
    methods: {
        async extractResults() {
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id as number },
                    function: extractResult,
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
                }
            );
        },
        async extractHeroes() {
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id as number },
                    function: exportHeroes,
                },
                (results: any) => {
                    const { result } = results[0];
                    navigator.clipboard.writeText(JSON.stringify(result));
                }
            );
        },
    },
});

function extractResult() {
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
        const [, playerName1, playerGameId1] = rawPlayer1?.match(/^Player 1 (.*) \((.*)\)/) || [];
        const [, playerName2, playerGameId2] = rawPlayer2?.match(/^Player 2 (.*) \((.*)\)/) || [];

        const reportedBy1 = rawPlayer1?.match(/reported (.*)$/)?.[1];
        const reportedBy2 = rawPlayer2?.match(/reported (.*)$/)?.[1];

        if (reportedBy1 !== reportedBy2 && reportedBy1 !== "None" && reportedBy2 !== "None") {
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

function exportHeroes() {
    const list = document.querySelectorAll("ol li");
    const players = [...list].map((line) => {
        const [playerText, heroText] = [...line.querySelectorAll(":scope > span")].map((span) => span.innerText);
        const [, name, gameId] = playerText.match(/(.*)\((.*)\)/);
        return {
            name: name.trim(),
            gameId,
            hero: heroText.trim().replaceAll("﻿", ""),
        };
    });
    return players;
}
</script>

<style scoped>
.button {
    @apply block bg-purple-500 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 active:bg-transparent active:border-purple-500 active:text-purple-500 border border-transparent;
}
</style>
