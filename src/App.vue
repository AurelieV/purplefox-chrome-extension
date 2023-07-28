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
            <button
                class="block ml-auto mt-3 text-xs underline text-purple-500 hover:text-purple-700"
                @click="tab = 'settings'"
            >
                Settings
            </button>
        </template>
        <template v-if="tab === 'settings'">
            Currently {{ tournamentsCount }} tournaments are in memory.
            <button v-if="tournamentsCount !== 0" class="button mt-2" @click="clearMemory">Clear</button>
            <div>
                <button
                    class="block ml-auto mt-3 text-xs underline text-purple-500 hover:text-purple-700"
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
                    navigator.clipboard.writeText(JSON.stringify(result));
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
    const result: any = [];
    document.querySelectorAll(".match-row").forEach((row) => {
        const cells = row.querySelectorAll(".match-element");
        const [, playerName1 = null, playerGameId1 = null] = (cells[1]?.innerHTML || "").match(PLAYER_REGEXP) || [];
        const [, playerName2 = null, playerGameId2 = null] = (cells[2]?.innerHTML || "").match(PLAYER_REGEXP) || [];
        result.push({
            tableNumber: parseInt(cells[0]?.innerHTML),
            playerName1,
            playerGameId1,
            playerName2,
            playerGameId2,
            result: cells[3]?.querySelector("select")?.value || null,
        });
    });
    return result;
}

function exportHeroes() {
    const list = document.querySelectorAll("ol li");
    debugger;
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
