// Popup script for Bookmundi Map Auto-Tagger

document.addEventListener("DOMContentLoaded", async () => {
  const autoTagToggle = document.getElementById("autoTagToggle");
  const tagNowBtn = document.getElementById("tagNowBtn");
  const viewHistoryBtn = document.getElementById("viewHistoryBtn");
  const statusText = document.getElementById("statusText");
  const daysStatus = document.getElementById("daysStatus");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");

  // Load current state
  await loadState();
  await updateStatus();

  // Toggle auto-tag
  autoTagToggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ autoTagEnabled: enabled });

    // Send message to content script
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.url?.includes("bookmundi.com")) {
      chrome.tabs.sendMessage(tab.id, {
        action: "toggleAutoTag",
        enabled: enabled,
      });
    }

    updateStatus();
  });

  // Tag map now
  tagNowBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab.url?.includes("bookmundi.com")) {
      chrome.tabs.sendMessage(tab.id, { action: "tagMap" });
      setTimeout(updateStatus, 500);
    } else {
      alert("Please navigate to a Bookmundi page first");
    }
  });

  // View history
  viewHistoryBtn.addEventListener("click", () => {
    historyPanel.classList.toggle("hidden");
    if (!historyPanel.classList.contains("hidden")) {
      loadHistory();
    }
  });

  async function loadState() {
    const result = await chrome.storage.sync.get(["autoTagEnabled"]);
    autoTagToggle.checked = result.autoTagEnabled || false;
  }

  async function updateStatus() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url?.includes("bookmundi.com")) {
      statusText.textContent = "Not on Bookmundi";
      statusText.className = "status-value inactive";
      daysStatus.textContent = "-";
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getStatus",
      });
      if (response) {
        statusText.textContent = response.enabled ? "Active" : "Inactive";
        statusText.className = response.enabled
          ? "status-value active"
          : "status-value inactive";
        daysStatus.textContent = response.daysFound || 0;
      }
    } catch (error) {
      statusText.textContent = "Error";
      statusText.className = "status-value inactive";
      daysStatus.textContent = "-";
    }
  }

  async function loadHistory() {
    const result = await chrome.storage.local.get(["taggedMaps"]);
    const taggedMaps = result.taggedMaps || [];

    if (taggedMaps.length === 0) {
      historyList.innerHTML =
        '<div class="empty-history">No tagged maps yet</div>';
      return;
    }

    historyList.innerHTML = taggedMaps
      .slice()
      .reverse()
      .slice(0, 10) // Show last 10
      .map(
        (map) => `
        <div class="history-item">
          <div class="history-item-title">${
            map.title || map.location || "Unknown"
          }</div>
          ${
            map.location
              ? `<div class="history-item-location">📍 ${map.location}</div>`
              : ""
          }
          ${
            map.coordinates
              ? `<div class="history-item-location">📍 ${map.coordinates.lat}, ${map.coordinates.lng}</div>`
              : ""
          }
          <div class="history-item-time">${formatTime(map.timestamp)}</div>
        </div>
      `
      )
      .join("");
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  // Update status every 2 seconds
  setInterval(updateStatus, 2000);
});
