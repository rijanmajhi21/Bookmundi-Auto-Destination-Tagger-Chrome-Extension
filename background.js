// Background service worker for Bookmundi Map Auto-Tagger

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default settings
    chrome.storage.sync.set({
      autoTagEnabled: false,
      tagSettings: {
        autoTagOnLoad: true,
        extractLocation: true,
        extractCoordinates: true,
      },
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "mapTagged") {
    // Handle map tagged event
    handleMapTagged(request.data, sender.tab);
    sendResponse({ success: true });
  } else if (request.action === "locationTagged") {
    // Handle location tagged event
    handleLocationTagged(request.data, sender.tab);
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response
});

async function handleMapTagged(data, tab) {
  // Store tagged map data
  const result = await chrome.storage.local.get(["taggedMaps"]);
  const taggedMaps = result.taggedMaps || [];

  taggedMaps.push({
    ...data,
    url: tab.url,
    tabId: tab.id,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 100 tagged maps
  if (taggedMaps.length > 100) {
    taggedMaps.shift();
  }

  await chrome.storage.local.set({ taggedMaps });

  // Optional: Show notification
  chrome.notifications
    ?.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Map Tagged",
      message: `Tagged map for: ${
        data.title || data.location || "Unknown location"
      }`,
      priority: 1,
    })
    .catch(() => {
      // Notifications permission not granted, ignore
    });
}

async function handleLocationTagged(data, tab) {
  // Store tagged location data
  const result = await chrome.storage.local.get(["taggedLocations"]);
  const taggedLocations = result.taggedLocations || [];

  taggedLocations.push({
    ...data,
    url: tab.url,
    tabId: tab.id,
  });

  // Keep only last 200 tagged locations
  if (taggedLocations.length > 200) {
    taggedLocations.shift();
  }

  await chrome.storage.local.set({ taggedLocations });

  // Optional: Show notification
  chrome.notifications
    ?.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Location Tagged",
      message: `Tagged Day ${data.day}: ${data.destination}`,
      priority: 1,
    })
    .catch(() => {
      // Notifications permission not granted, ignore
    });
}

// Context menu (optional - for right-click tagging)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tagMap",
    title: "Tag Map",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "tagMap") {
    chrome.tabs.sendMessage(tab.id, { action: "tagMap" });
  }
});
