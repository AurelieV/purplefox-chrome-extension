import { fetchLorcanaDecksCarde, buildMetaTsv, getCardInk } from "@/lorcanaMeta";

let TOURNAMENT_NAMES = {};

// Warm up the Lorcana card cache (lorcana-api.com) on SW startup and on install,
// so it is ready before the first extraction.
getCardInk().catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  getCardInk().catch(() => {});
});

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

// Lorcana meta extraction: orchestrated by the service worker (lifetime
// independent of the popup), the fetch runs in the page via executeScript, the
// result is cached in chrome.storage.local and copied by the popup on click.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action !== "extractMeta" || typeof msg.tabId !== "number") {
    return;
  }

  chrome.storage.local.set({
    metaStatus: { state: "loading", at: Date.now() },
  });

  chrome.storage.local.get("token", ({ token }) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: msg.tabId },
        func: fetchLorcanaDecksCarde,
        args: [token ?? ""],
      },
      async (results) => {
        if (chrome.runtime.lastError || !results?.[0]) {
          chrome.storage.local.set({
            metaStatus: {
              state: "error",
              message:
                chrome.runtime.lastError?.message || "Extraction failed",
              at: Date.now(),
            },
          });
          return;
        }
        const result = results[0].result as Awaited<
          ReturnType<typeof fetchLorcanaDecksCarde>
        >;
        if (result.errorCount !== 0) {
          chrome.storage.local.set({
            metaStatus: {
              state: "error",
              message: result.message,
              at: Date.now(),
            },
          });
          return;
        }
        try {
          const inkMap = await getCardInk();
          const tsv = buildMetaTsv(result.value, inkMap);
          chrome.storage.local.set({
            metaResult: {
              tsv,
              count: result.value.length,
              eventId: msg.eventId ?? null,
              at: Date.now(),
            },
            metaStatus: { state: "done", at: Date.now() },
          });
        } catch {
          chrome.storage.local.set({
            metaStatus: {
              state: "error",
              message: "Could not load card data (lorcana-api.com unreachable)",
              at: Date.now(),
            },
          });
        }
      }
    );
  });

  // Immediate ack: the actual result is delivered through chrome.storage.
  sendResponse({ started: true });
  return true;
});
