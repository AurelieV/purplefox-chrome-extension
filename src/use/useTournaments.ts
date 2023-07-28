import { ref, computed } from "vue";
const tournaments = ref({});

function handleStorageChange(changes, namespace) {
    if (changes["TOURNAMENT_NAMES"]) {
        tournaments.value = changes.TOURNAMENT_NAMES.newValue;
    }
}

chrome.storage.local.get("TOURNAMENT_NAMES", function (result) {
    tournaments.value = result || {};
});
chrome.storage.onChanged.addListener(handleStorageChange);

export function useTournaments() {
    return {
        tournaments,
        tournamentsCount: computed(() => {
            return Object.keys(tournaments.value || {}).length;
        }),
        clearMemory() {
            chrome.storage.local.set({ TOURNAMENT_NAMES: {} })
        }
    };
}

window.addEventListener("unload", () => {
    chrome.storage.onChanged.removeListener(handleStorageChange);
});
