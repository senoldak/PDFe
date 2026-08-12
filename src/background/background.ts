const VIEWER_URL = chrome.runtime.getURL("viewer.html");

export function getViewerUrl(pdfUrl: string, baseUrl = VIEWER_URL): string {
  const hashIndex = pdfUrl.indexOf("#");
  let hash = "";
  if (hashIndex > 0) {
    hash = pdfUrl.slice(hashIndex);
    pdfUrl = pdfUrl.slice(0, hashIndex);
  }
  return `${baseUrl}?file=${encodeURIComponent(pdfUrl)}${hash}`;
}

export async function registerRedirectRule(): Promise<void> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  if (rules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map((r) => r.id),
    });
  }

  const redirectToViewer = {
    type: "redirect",
    redirect: { regexSubstitution: `${VIEWER_URL}?file=\\0` },
  } as const;

  const addRules = [
    {
      id: 1,
      priority: 2,
      condition: { urlFilter: "pdfe.action=download", resourceTypes: ["main_frame", "sub_frame"] },
      action: { type: "allow" as const },
    },
    {
      id: 2,
      priority: 1,
      condition: {
        regexFilter: "^.*$",
        excludedRequestMethods: ["post"],
        resourceTypes: ["main_frame", "sub_frame"],
        responseHeaders: [{ header: "content-type", values: ["application/pdf", "application/pdf;*"] }],
      },
      action: redirectToViewer,
    },
    {
      id: 3,
      priority: 1,
      condition: {
        regexFilter: "^.*\\.pdf\\b.*$",
        excludedRequestMethods: ["post"],
        resourceTypes: ["main_frame", "sub_frame"],
        responseHeaders: [
          { header: "content-type", values: ["application/octet-stream", "application/octet-stream;*"] },
        ],
      },
      action: redirectToViewer,
    },
  ];

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: addRules as any });
  } catch (e) {
    console.error("DNR rule registration failed; falling back to content script.", e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void registerRedirectRule();
});
chrome.runtime.onStartup.addListener(() => {
  void registerRedirectRule();
});

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
      if (isAllowed) return;
      chrome.tabs.update(details.tabId, { url: getViewerUrl(details.url) });
    });
  },
  { url: [{ urlPrefix: "file://", pathSuffix: ".pdf" }, { urlPrefix: "file://", pathSuffix: ".PDF" }] }
);

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message?.type === "viewer:get-url") {
    sendResponse({ type: "viewer:url", url: getViewerUrl(message.file ?? "") });
    return true;
  }
  return undefined;
});

export {};