let TOURNAMENT_NAMES = {};

chrome.storage.local.get('TOURNAMENT_NAMES', function (result) {
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
                        chrome.storage.local.set({ TOURNAMENT_NAMES })
                        chrome.scripting.executeScript(
                            {
                                target: { tabId },
                                function: setTitle,
                            },
                            (results) => {
                                chrome.scripting.executeScript({
                                    target: { tabId },
                                    function: setTitle,
                                    args: [result],
                                });
                            }
                        );
                    }
                }
            );
            
        } else if (isResult) {
            if (TOURNAMENT_NAMES[id]) {
                chrome.scripting.executeScript({
                    target: { tabId },
                    function: setTitle,
                    args: [TOURNAMENT_NAMES[id]],
                });
            }
        }
    },
    { url: [{ hostContains: "gem.fabtcg.com" }] }
);

function getTournamentName() {
    return document.querySelector("h1").innerText;
}

function setTitle(title) {
    document.title = title;
}
