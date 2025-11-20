// Content script for Bookmundi Map Auto-Tagger
// This script runs on Bookmundi pages and handles automatic location tagging

class MapTagger {
  constructor() {
    this.isEnabled = false;
    this.processedDays = new Set();
    this.init();
  }

  async init() {
    // Load settings from storage
    const result = await chrome.storage.sync.get([
      "autoTagEnabled",
      "tagSettings",
    ]);
    this.isEnabled = result.autoTagEnabled || false;
    this.tagSettings = result.tagSettings || {};

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleAutoTag") {
        this.isEnabled = request.enabled;
        if (this.isEnabled) {
          this.processDays().catch(() => {});
        }
        sendResponse({ success: true });
        return true;
      } else if (request.action === "tagMap") {
        this.processedDays.clear();
        // Force processing even if auto-tag is disabled
        this.processDays(true).catch(() => {});
        sendResponse({ success: true });
        return true;
      } else if (request.action === "getStatus") {
        sendResponse({
          enabled: this.isEnabled,
          daysFound: this.findDaySections().length,
        });
        return true;
      }
      return false;
    });

    // Auto-start if enabled
    if (this.isEnabled) {
      // Wait for page to fully load
      setTimeout(() => {
        this.processDays().catch(() => {});
      }, 2000);
    }

    // Observe DOM changes for dynamically loaded content
    this.observePageChanges();
  }

  observePageChanges() {
    const observer = new MutationObserver(() => {
      if (this.isEnabled) {
        // Debounce to avoid too many calls
        clearTimeout(this.processTimeout);
        this.processTimeout = setTimeout(() => {
          this.processDays().catch(() => {});
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  findDaySections() {
    // Find all day sections based on the HTML structure
    // Look for elements with class "itinerary-title" containing "Day X"
    const daySections = [];
    const seenDays = new Set();

    // Find all itinerary holders
    const itineraryHolders = document.querySelectorAll(".itinerary-holder");

    for (const holder of itineraryHolders) {
      // Find the day title (e.g., "Day 1", "Day 2")
      const dayTitle = holder.querySelector(".itinerary-title");
      if (!dayTitle) continue;

      const titleText = (dayTitle.textContent || "").trim();

      // Skip "Start Destination" and "End Destination" sections
      const holderText = (holder.textContent || "").toLowerCase();
      if (
        holderText.includes("start destination") ||
        holderText.includes("end destination")
      ) {
        const headings = holder.querySelectorAll(
          "h1, h2, h3, h4, h5, h6, strong, label"
        );
        let isStartOrEnd = false;
        for (const heading of headings) {
          const headingText = (heading.textContent || "").toLowerCase();
          if (
            headingText.includes("start destination") ||
            headingText.includes("end destination")
          ) {
            isStartOrEnd = true;
            break;
          }
        }
        if (isStartOrEnd) {
          continue;
        }
      }

      const dayMatch = titleText.match(/Day\s*(\d+)/i);
      if (!dayMatch) continue;

      const dayNumber = parseInt(dayMatch[1]);
      if (seenDays.has(dayNumber)) continue;
      seenDays.add(dayNumber);

      daySections.push({
        dayNumber,
        element: holder,
        text: holder.textContent?.trim() || titleText.trim(),
      });
    }

    // Sort by day number
    daySections.sort((a, b) => a.dayNumber - b.dayNumber);

    return daySections;
  }

  extractEndDestination(daySection) {
    const dayElement = daySection.element;
    const dayText = daySection.text;

    // Method 1: Extract from day title text (e.g., "Day 1Jeddah Changed" or "Day 3Jeddah, Medina")
    // Pattern 1: "Day XLocation Changed" or "Day XLocation, Location2" (handles no space between day and location)
    // This pattern matches: "Day 1Jeddah Changed", "Day 2Jeddah", "Day 3Jeddah, Medina", "Day 5Al-Ula, Tabuk", "Day 2Bilbao, Guernica, San Sebastián"
    const dayTitlePattern1 =
      /Day\s*\d+([A-Za-zÀ-ÿ][a-zA-ZÀ-ÿ\s\-,]+?)(?:\s+Changed|$)/i;
    const dayTitleMatch1 = dayText.match(dayTitlePattern1);
    if (dayTitleMatch1) {
      let locationText = dayTitleMatch1[1].trim();
      // Remove "Changed" if present
      locationText = locationText.replace(/\s+Changed$/i, "").trim();

      // If it contains multiple locations separated by commas, get the last one
      if (locationText.includes(",")) {
        const locations = locationText
          .split(",")
          .map((loc) => loc.trim())
          .filter((loc) => loc.length > 0 && loc.length < 100);

        if (locations.length > 0) {
          // Get the last location (end destination)
          const destination = locations[locations.length - 1];
          const finalDestination = destination
            .replace(/\s+Changed$/i, "")
            .trim();
          return finalDestination;
        }
      } else {
        // Single location
        if (locationText.length > 1) {
          // Remove "Day X:" if somehow present
          locationText = locationText.replace(/^Day\s*\d+\s*:\s*/i, "").trim();
          if (locationText.length > 1 && !locationText.match(/^Day\s*\d+/i)) {
            return locationText;
          }
        }
      }
    }

    // Pattern 2: "Day X: Location Changed" or "Day X: Location, Location2" (handles colon format)
    const dayTitlePattern2 =
      /Day\s*\d+\s*:\s*([A-Za-zÀ-ÿ][a-zA-ZÀ-ÿ\s\-,]+?)(?:\s+Changed|$)/i;
    const dayTitleMatch2 = dayText.match(dayTitlePattern2);
    if (dayTitleMatch2) {
      let locationText = dayTitleMatch2[1].trim();
      locationText = locationText.replace(/\s+Changed$/i, "").trim();

      if (locationText.includes(",")) {
        const locations = locationText
          .split(",")
          .map((loc) => loc.trim())
          .filter((loc) => loc.length > 0 && loc.length < 100);

        if (locations.length > 0) {
          const destination = locations[locations.length - 1];
          return destination.replace(/\s+Changed$/i, "").trim();
        }
      } else {
        if (locationText.length > 1) {
          locationText = locationText.replace(/^Day\s*\d+\s*:\s*/i, "").trim();
          if (locationText.length > 1 && !locationText.match(/^Day\s*\d+/i)) {
            return locationText;
          }
        }
      }
    }

    // Method 2: Look for location in <strong> tags within col-sm-12 div
    // This is the most reliable method based on the HTML structure
    const colDivs = dayElement.querySelectorAll(".col-sm-12");
    for (const colDiv of colDivs) {
      const strongTag = colDiv.querySelector("strong");
      if (strongTag) {
        const strongText = (strongTag.textContent || "").trim();

        // Skip if it's the day title (contains "Day")
        if (strongText.match(/^Day\s*\d+/i)) continue;

        // Skip if it's "Destination:" label
        if (strongText.toLowerCase().includes("destination:")) continue;

        // Skip if it's "Routes" or other labels
        if (strongText.match(/^(Routes|Start|End)/i)) continue;

        // Check if it's a valid location
        if (strongText && strongText.length > 1 && strongText.length < 100) {
          // Remove "Changed" if present
          let locationText = strongText.replace(/\s+Changed$/i, "").trim();

          // Remove "Day X:" if somehow present
          locationText = locationText.replace(/^Day\s*\d+\s*:\s*/i, "").trim();

          // If it contains multiple locations separated by commas, get the last one
          if (locationText.includes(",")) {
            const locations = locationText
              .split(",")
              .map((loc) => loc.trim())
              .filter((loc) => loc.length > 0 && loc.length < 100);

            if (locations.length > 0) {
              // Get the last location (end destination)
              const destination = locations[locations.length - 1];
              // Final cleanup
              return destination.replace(/\s+Changed$/i, "").trim();
            }
          } else {
            // Single location
            if (locationText.length > 1) {
              return locationText;
            }
          }
        }
      }
    }

    // Method 2: Look for "Destination:" field
    const destPattern =
      /Destination:\s*([^\n]+?)(?:\n|See Location|Chose Location|$)/i;
    const destMatch = daySection.text.match(destPattern);

    if (destMatch) {
      const fullLocation = destMatch[1].trim();
      if (
        fullLocation &&
        fullLocation !== "," &&
        fullLocation !== ", " &&
        !fullLocation.toLowerCase().includes("chose") &&
        !fullLocation.toLowerCase().includes("select") &&
        fullLocation.length > 2
      ) {
        // Extract city name (before comma if country is included)
        const cityMatch = fullLocation.match(/^([^,]+)/);
        if (cityMatch) {
          let destination = cityMatch[1].trim();
          destination = destination.replace(/^Day\s*\d+\s*:\s*/i, "").trim();
          if (destination && destination.length > 1) {
            return destination;
          }
        }
      }
    }

    return null;
  }

  findDestinationInputForDay(dayElement, dayNumber) {
    // Find the input field for this specific day
    // Look for input with class "itidestination" within the day's itinerary-holder

    // Method 1: Find input within the day element
    const inputs = dayElement.querySelectorAll(
      "input.itidestination, input[class*='itidestination']"
    );

    for (const input of inputs) {
      if (
        input.offsetParent !== null &&
        !input.disabled &&
        !input.readOnly &&
        !this.isDestinationAlreadyFilled(input)
      ) {
        return input;
      }
    }

    // Method 2: Find input near "Destination:" label in this day section
    const destinationLabels = Array.from(
      dayElement.querySelectorAll("*")
    ).filter((el) => {
      const text = (el.textContent || "").toLowerCase();
      return text.includes("destination:") && text.length < 50;
    });

    if (destinationLabels.length > 0) {
      const label = destinationLabels[0];
      let container = label;

      for (let i = 0; i < 5 && container; i++) {
        const destInputs = container.querySelectorAll(
          "input.itidestination, input[class*='itidestination']"
        );

        for (const input of destInputs) {
          if (
            input.offsetParent !== null &&
            !input.disabled &&
            !input.readOnly &&
            !this.isDestinationAlreadyFilled(input)
          ) {
            return input;
          }
        }
        container = container.parentElement;
      }
    }

    return null;
  }

  isDestinationAlreadyFilled(input) {
    if (!input) return false;

    const value = (input.value || "").trim();
    // Check if it's empty, just comma, space, or placeholder text
    // Inputs often have ", " or " " as default value
    if (
      !value ||
      value === "," ||
      value === ", " ||
      value === " " ||
      value === "" ||
      value === " ," ||
      value.toLowerCase().includes("chose") ||
      value.toLowerCase().includes("select") ||
      value.toLowerCase().includes("see location") ||
      value.length < 2
    ) {
      return false;
    }

    // If it has a meaningful value, it's already filled
    return true;
  }

  isDestinationTagged(value) {
    if (!value || typeof value !== "string") {
      return false;
    }

    const trimmed = value.trim();

    // Check if it's empty or just placeholder
    if (
      !trimmed ||
      trimmed === "," ||
      trimmed === ", " ||
      trimmed === " " ||
      trimmed === "" ||
      trimmed === " ," ||
      trimmed.length < 2
    ) {
      return false;
    }

    // Check if it contains placeholder text
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("chose") ||
      lower.includes("select") ||
      lower.includes("see location")
    ) {
      return false;
    }

    // If it has a meaningful value (at least 2 characters and not just punctuation), it's tagged
    return true;
  }

  async fillLocationInput(input, locationName) {
    return new Promise((resolve) => {
      try {
        // Focus the input first
        input.focus();

        // Clear any existing value (including spaces and commas)
        input.value = "";

        // Trigger input event to ensure the input is cleared
        const clearEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(clearEvent);

        // Simulate typing character by character to trigger autocomplete
        let currentText = "";
        const typeChar = (index) => {
          if (index < locationName.length) {
            currentText += locationName[index];
            input.value = currentText;

            // Trigger input event
            const inputEvent = new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              data: locationName[index],
            });
            input.dispatchEvent(inputEvent);

            // Trigger keydown/keyup
            const keydownEvent = new KeyboardEvent("keydown", {
              key: locationName[index],
              code: `Key${locationName[index].toUpperCase()}`,
              bubbles: true,
              cancelable: true,
            });
            const keyupEvent = new KeyboardEvent("keyup", {
              key: locationName[index],
              code: `Key${locationName[index].toUpperCase()}`,
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(keydownEvent);
            input.dispatchEvent(keyupEvent);

            // Continue typing after a short delay
            setTimeout(() => typeChar(index + 1), 50);
          } else {
            // Finished typing, wait for dropdown and try to select
            setTimeout(() => {
              const selected = this.selectFromDropdown(locationName, input);
              if (!selected) {
                // Wait a bit more and try again
                setTimeout(() => {
                  const selected2 = this.selectFromDropdown(
                    locationName,
                    input
                  );
                  if (!selected2) {
                    // If still no match, clear the input and leave it blank
                    input.value = "";
                    const changeEvent = new Event("change", { bubbles: true });
                    input.dispatchEvent(changeEvent);
                  }
                  // Wait a bit more to ensure selection is complete
                  setTimeout(() => resolve(), 500);
                }, 800);
              } else {
                // Wait a bit more to ensure selection is complete
                setTimeout(() => resolve(), 800);
              }
            }, 1000); // Wait for dropdown to appear
          }
        };

        // Start typing
        typeChar(0);
      } catch (error) {
        resolve();
      }
    });
  }

  selectFromDropdown(locationName, inputElement) {
    const locationLower = locationName.toLowerCase();
    const locationWords = locationName
      .toLowerCase()
      .split(/[\s-]+/)
      .filter((w) => w.length > 0);

    // Look for dropdown/autocomplete options
    const findDropdown = () => {
      // Try Bookmundi-specific selectors first
      const bookmundiSelectors = [".suggestionbox", ".suggestions-list"];

      for (const selector of bookmundiSelectors) {
        const dropdowns = document.querySelectorAll(selector);
        for (const dropdown of dropdowns) {
          if (
            dropdown.offsetParent !== null &&
            window.getComputedStyle(dropdown).display !== "none"
          ) {
            if (inputElement) {
              const inputRect = inputElement.getBoundingClientRect();
              const dropdownRect = dropdown.getBoundingClientRect();
              if (
                dropdownRect.top >= inputRect.top &&
                Math.abs(dropdownRect.left - inputRect.left) < 200
              ) {
                return dropdown;
              }
            } else {
              return dropdown;
            }
          }
        }
      }

      // Look for any visible list/ul that appeared
      const lists = Array.from(
        document.querySelectorAll("ul, ol, div[role='listbox']")
      );
      return lists.find(
        (list) =>
          list.offsetParent !== null &&
          window.getComputedStyle(list).display !== "none" &&
          list.children.length > 0
      );
    };

    const dropdown = findDropdown();
    if (!dropdown) {
      return false;
    }

    // Find option matching the location name
    let options = dropdown.querySelectorAll(".suggestionbox-item");
    if (options.length === 0) {
      options = dropdown.querySelectorAll(
        "li, div[role='option'], .option, .dropdown-item, a, .suggestion, .autocomplete-item"
      );
    }

    // Collect all potential matches with scores
    const matches = [];

    for (const option of options) {
      const optionText = (option.textContent || "").trim().toLowerCase();
      const optionValue = (
        option.getAttribute("data-value") || optionText
      ).toLowerCase();

      let score = 0;
      let matchType = "";

      // Highest priority: Exact match
      if (optionText === locationLower || optionValue === locationLower) {
        score = 1000;
        matchType = "exact match";
      }
      // Very high priority: Location name at start followed by comma (e.g., "Paris, France")
      else if (
        optionText.startsWith(locationLower + ",") ||
        optionValue.startsWith(locationLower + ",")
      ) {
        score = 900;
        matchType = "exact location match";
      }
      // High priority: Option starts with location name (complete word)
      else if (
        optionText.startsWith(locationLower + " ") ||
        optionValue.startsWith(locationLower + " ") ||
        optionText.startsWith(locationLower) ||
        optionValue.startsWith(locationLower)
      ) {
        score = 800;
        matchType = "prefix match";
      }
      // Medium-high priority: Location as complete word at start (word boundary)
      else {
        const escapedLocation = locationLower.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const wordBoundaryRegex = new RegExp(`^${escapedLocation}[,\\s]`, "i");
        if (
          wordBoundaryRegex.test(optionText) ||
          wordBoundaryRegex.test(optionValue)
        ) {
          score = 700;
          matchType = "word boundary match";
        }
      }

      // Continue checking other match types if no match found yet
      if (score === 0) {
        // Medium priority: Normalized exact match (ignore hyphens/spaces)
        const normalizeForMatch = (str) =>
          str.replace(/[-\s]/g, "").toLowerCase();
        const normalizedLocation = normalizeForMatch(locationLower);
        const normalizedOptionText = normalizeForMatch(optionText);
        const normalizedOptionValue = normalizeForMatch(optionValue);

        if (
          normalizedOptionText === normalizedLocation ||
          normalizedOptionValue === normalizedLocation
        ) {
          score = 600;
          matchType = "normalized match";
        }
        // Lower priority: All words match (but avoid partial word matches)
        else if (locationWords.length > 0) {
          const allWordsMatch = locationWords.every((word) => {
            // Use word boundary to avoid partial matches (e.g., "paris" in "parish")
            const wordRegex = new RegExp(
              `(^|[^a-z])${word.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}([^a-z]|$)`,
              "i"
            );
            return wordRegex.test(optionText) || wordRegex.test(optionValue);
          });
          if (allWordsMatch) {
            score = 500;
            matchType = "all words match";
          }
          // Lower priority: Phrase match with word boundaries
          else if (locationWords.length > 1) {
            const locationPhrase = locationWords.join(" ");
            const phraseRegex = new RegExp(
              `(^|,\\s*)${locationPhrase.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}[,\\s]`,
              "i"
            );
            if (phraseRegex.test(optionText) || phraseRegex.test(optionValue)) {
              score = 400;
              matchType = "phrase match";
            }
          }
        }
      }

      if (score > 0) {
        matches.push({ option, score, matchType });
      }
    }

    // Sort by score (highest first) and select the best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];
      return this.clickOption(
        bestMatch.option,
        locationName,
        bestMatch.matchType
      );
    }

    return false;
  }

  clickOption(option, locationName, matchType) {
    try {
      // Scroll option into view to ensure it's clickable
      if (option.scrollIntoView) {
        option.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      // Also trigger any data-clickable handlers FIRST (this is important for Bookmundi)
      if (option.getAttribute("data-clickable") === "true") {
        const targetId = option.getAttribute("data-target");
        const dataValue =
          option.getAttribute("data-value") || option.textContent.trim();

        if (targetId) {
          const target = document.querySelector(targetId);
          if (target) {
            target.value = dataValue;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));

            // Also trigger focus and blur to ensure the value is set
            target.focus();
            setTimeout(() => {
              target.blur();
            }, 100);
          }
        }
      }

      // Try clicking the option
      if (option.click) {
        option.click();
      } else if (option.dispatchEvent) {
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        option.dispatchEvent(clickEvent);
      }

      // Also try mousedown/mouseup for better compatibility
      if (option.dispatchEvent) {
        const mouseDownEvent = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        const mouseUpEvent = new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        option.dispatchEvent(mouseDownEvent);
        option.dispatchEvent(mouseUpEvent);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async processDays(force = false) {
    // Allow manual tagging even if auto-tag is disabled
    if (!this.isEnabled && !force) {
      return;
    }

    const daySections = this.findDaySections();

    if (daySections.length === 0) {
      return;
    }

    // Extract all destinations first - try multiple times if needed
    const dayDestinations = new Map();

    for (const daySection of daySections) {
      try {
        let destination = this.extractEndDestination(daySection);

        // If extraction failed, try again with the full text
        if (!destination) {
          const freshText = daySection.element.textContent?.trim() || "";
          const tempSection = { ...daySection, text: freshText };
          destination = this.extractEndDestination(tempSection);
        }

        if (destination) {
          // Final validation - ensure destination doesn't start with "Day"
          destination = destination.replace(/^Day\s*\d+\s*:?\s*/i, "").trim();
          if (
            destination &&
            !destination.match(/^Day\s*\d+/i) &&
            destination.length > 1
          ) {
            dayDestinations.set(daySection.dayNumber, destination);
          }
        }
      } catch (error) {
        // Continue to next day if extraction fails
        continue;
      }
    }

    // Process days sequentially, one at a time
    for (let i = 0; i < daySections.length; i++) {
      try {
        const daySection = daySections[i];
        const dayKey = `day-${daySection.dayNumber}`;

        // Skip only if successfully processed (not just attempted)
        if (this.processedDays.has(dayKey)) {
          continue;
        }

        const destination = dayDestinations.get(daySection.dayNumber);

        if (destination) {
          // Find the destination input field for this specific day section
          let destinationInput = this.findDestinationInputForDay(
            daySection.element,
            daySection.dayNumber
          );

          // If input not found, try searching more broadly
          if (destinationInput === null) {
            // Try finding input in parent containers first
            let parentContainer = daySection.element.parentElement;
            for (
              let j = 0;
              j < 3 && parentContainer && !destinationInput;
              j++
            ) {
              const parentInputs = parent.querySelectorAll(
                "input.itidestination, input[class*='itidestination'], input[type='text']"
              );
              for (const input of parentInputs) {
                if (
                  input.offsetParent !== null &&
                  !input.disabled &&
                  !input.readOnly &&
                  !this.isDestinationAlreadyFilled(input)
                ) {
                  const inputId = (input.id || "").toLowerCase();
                  const inputName = (input.name || "").toLowerCase();
                  if (
                    !inputId.includes("start") &&
                    !inputName.includes("start") &&
                    !inputId.includes("end") &&
                    !inputName.includes("end")
                  ) {
                    destinationInput = input;
                    break;
                  }
                }
              }
              parentContainer = parentContainer.parentElement;
            }

            // Only check if already filled AFTER trying to find input in parents
            if (destinationInput === null) {
              const allInputs = daySection.element.querySelectorAll(
                "input.itidestination, input[class*='itidestination'], input[type='text']"
              );
              let alreadyFilled = false;
              for (const input of allInputs) {
                if (this.isDestinationAlreadyFilled(input)) {
                  alreadyFilled = true;
                  this.processedDays.add(dayKey);
                  break;
                }
              }

              if (alreadyFilled) {
                continue;
              }
            }
          }

          if (destinationInput) {
            try {
              // Fill the input and wait for it to complete
              await this.fillLocationInput(destinationInput, destination);

              // Wait for the dropdown selection to fully complete
              await new Promise((resolve) => setTimeout(resolve, 3000));

              // Verify that the destination was actually tagged - check multiple times
              let finalValue = (destinationInput.value || "").trim();
              let isTagged = this.isDestinationTagged(finalValue);

              // If not tagged yet, wait more and check again (dropdown might be slow)
              if (!isTagged) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                finalValue = (destinationInput.value || "").trim();
                isTagged = this.isDestinationTagged(finalValue);
              }

              // Final check after another wait
              if (!isTagged) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                finalValue = (destinationInput.value || "").trim();
                isTagged = this.isDestinationTagged(finalValue);
              }

              if (isTagged) {
                // Mark as processed ONLY after successful tagging
                this.processedDays.add(dayKey);

                // Send notification
                chrome.runtime
                  .sendMessage({
                    action: "locationTagged",
                    data: {
                      day: daySection.dayNumber,
                      destination: finalValue,
                      timestamp: new Date().toISOString(),
                    },
                  })
                  .catch(() => {
                    // Ignore errors
                  });
              }
              // If not tagged, don't mark as processed - allow retry
            } catch (fillError) {
              // If filling failed, don't mark as processed - allow retry
            }
          } else {
            // Input not found - don't mark as processed, allow retry
            // But wait a bit to avoid infinite loops
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else {
          // No destination extracted - only mark as processed if we're sure there's no destination
          // Check if there's a "Destination:" field that's already filled
          const allInputs = daySection.element.querySelectorAll(
            "input.itidestination, input[class*='itidestination'], input[type='text']"
          );
          let hasFilledInput = false;
          for (const input of allInputs) {
            if (this.isDestinationAlreadyFilled(input)) {
              hasFilledInput = true;
              break;
            }
          }

          // Only mark as processed if there's a filled input (meaning destination exists but we couldn't extract it)
          if (hasFilledInput) {
            this.processedDays.add(dayKey);
          }
          // Otherwise, don't mark - allow retry in case extraction improves
        }

        // Wait before processing next day to ensure previous one is complete
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (dayError) {
        // If processing a day fails, continue to next day
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new MapTagger();
  });
} else {
  new MapTagger();
}
