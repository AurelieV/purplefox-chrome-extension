import { ref } from "vue";

export function usePath() {
  const currentSoftware = ref<string | null>(null);
  const canExtractResults = ref(false);
  const canExtractHeroes = ref(false);
  const canExtractStandings = ref(false);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url) {
      const url = tab.url.toLowerCase();

      if (url.includes("gem.fabtcg.com")) {
        currentSoftware.value = "gem";
        canExtractResults.value = true;
      } else if (url.includes("carde.io")) {
        currentSoftware.value = "carde";
        canExtractResults.value = url.includes("/pairings");
        canExtractStandings.value = url.includes("/standings");
      } else if (url.includes("https://eor.purple-fox.fr")) {
        currentSoftware.value = "purplefox";
      } else if (url.includes("cardgame-network.konami.net")) {
        currentSoftware.value = "kgcn";
        canExtractResults.value = true;
        canExtractStandings.value = true;
      }
    }
  });

  return {
    currentSoftware,
    canExtractResults,
    canExtractHeroes,
    canExtractStandings,
  };
}