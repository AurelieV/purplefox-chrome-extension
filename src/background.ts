let TOURNAMENT_NAMES = {};

chrome.storage.local.get("TOURNAMENT_NAMES", function (result) {
  TOURNAMENT_NAMES = result || {};
});

chrome.webNavigation.onCompleted.addListener(
  ({ url, tabId }) => {
    const isResult = url.includes("/report");
    const isMain = url.includes("/run") && !isResult;
    const [, id] = url.match(/.*\/gem\/(\d+).*/) || [];

    if (isMain) {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          function: getTournamentName,
        },
        (results) => {
          const { result } = results[0];
          if (result) {
            TOURNAMENT_NAMES[id] = result;
            chrome.storage.local.set({ TOURNAMENT_NAMES });
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
  return document.querySelector("h1").innerText;
}
