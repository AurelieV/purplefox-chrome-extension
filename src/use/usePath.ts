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
        })
    };
}
