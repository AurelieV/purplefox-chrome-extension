<template>
    <div>
        <p v-if="currentSoftware">Currently detecting {{ currentSoftware }}</p>
        <p v-else>No known software detected</p>
        <div v-if="canExtractResults">
            <button @click="extractResults">Extract results</button>
        </div>
        <p v-else>No action possible on this page</p>
    </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useTournaments } from "@/use/useTournaments";
import { usePath } from "@/use/usePath";

export default defineComponent({
    name: "App",
    setup() {
        const tournaments = useTournaments();
        const { currentSoftware, canExtractResults } = usePath();
        return { currentSoftware, tournaments, canExtractResults };
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
</script>
