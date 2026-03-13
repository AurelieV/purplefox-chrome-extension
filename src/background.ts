chrome.webNavigation.onCompleted.addListener(
  ({ url, tabId }) => {
    const isResult = url.includes("/report");
    const isMain = url.includes("/run") && !isResult;
    const [, id] = url.match(/.*\/gem\/(\d+).*/) || [];

    if (isMain && id) {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: getTournamentName,
        },
        (results: chrome.scripting.InjectionResult[]) => {
          if ((chrome.runtime as any).lastError || !results || !results[0]) return;
          const tournamentName = results[0].result as string;
          
          if (tournamentName) {
            chrome.storage.local.get("TOURNAMENT_NAMES", (storage) => {
              const TOURNAMENT_NAMES = storage.TOURNAMENT_NAMES || {};
              TOURNAMENT_NAMES[id] = tournamentName;
              chrome.storage.local.set({ TOURNAMENT_NAMES });
            });
          }
        }
      );
    }
  },
  { url: [{ hostContains: "gem.fabtcg.com" }] }
);

chrome.webNavigation.onCompleted.addListener(
  ({ url, tabId }) => {
    chrome.cookies.get(
      {
        url,
        name: "web_sessionToken",
      },
      (cookie) => {
        console.log("Checking for cookie on", url);
        if (!cookie) {
          return;
        }

        console.log("Retrieved token from cookie", cookie.value);

        const token = cookie.value;
        chrome.storage.local.set({ token });
      }
    );
  },
  { url: [{ hostContains: "carde.io" }] }
);

function getTournamentName() {
  return document.querySelector("h1")?.innerText || "";
}