import { ref, computed } from "vue";

const currentUrl = ref("");

function updateCurrentUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
            currentUrl.value = tabs[0].url;
        }
    });
}

updateCurrentUrl();

chrome.tabs.onActivated.addListener(updateCurrentUrl);
chrome.tabs.onUpdated.addListener(updateCurrentUrl);

window.addEventListener("unload", () => {
    chrome.tabs.onActivated.removeListener(updateCurrentUrl);
    chrome.tabs.onUpdated.removeListener(updateCurrentUrl);
});

const currentSoftware = computed(() => {
    if (currentUrl.value.startsWith("https://gem.fabtcg.com/gem/")) {
        return "gem";
    } else if (currentUrl.value.startsWith("https://admin.carde.io/")) {
        return "carde"
    } else {
        return null;
    }
});

export function usePath() {
    return {
        currentSoftware,
        canExtractResults: computed(() => {
            if (currentSoftware.value === "gem") {
                return currentUrl.value.includes("/report");
            } else if (currentSoftware.value === "carde") {
                return currentUrl.value.includes("/pairings");
            } else {
                return false;
            }
        }),
        canExtractHeroes: computed(() => {
            if (currentSoftware.value === "gem") {
                return currentUrl.value.match(/\/run\/{0,1}$/);
            } else {
                return false;
            }
        }),
        canExtractStandings: computed(() => {
            if (currentSoftware.value === "carde") {
                return currentUrl.value.includes("/standings");
            }
            return false;
        }),
    };
}
