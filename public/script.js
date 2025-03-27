document.addEventListener("DOMContentLoaded", () => {
  const sourceDirSelect = document.getElementById("sourceDir");
  // Tag related elements
  const includeAllTagsCheckbox = document.getElementById("includeAllTags");
  const tagsListDiv = document.getElementById("tagsList"); // Div for tag checkboxes
  // Other elements
  const privacyDiv = document.getElementById("privacyLevels");
  const form = document.getElementById("aggregate-form");
  const statusDiv = document.getElementById("status");
  const aggregateButton = document.getElementById("aggregate-button");

  let availableOptionsCache = {}; // Cache fetched options

  // --- Fetch initial configuration ---
  fetch("/api/config-options")
    .then((response) => response.json())
    .then((data) => {
      sourceDirSelect.innerHTML =
        '<option value="" disabled selected>Select source...</option>';
      data.sources.forEach((source) => {
        const option = document.createElement("option");
        option.value = source.key;
        option.textContent = source.name;
        sourceDirSelect.appendChild(option);
      });
      availableOptionsCache = data.options || {};
      if (
        data.sources.length > 0 &&
        availableOptionsCache[data.sources[0].key]
      ) {
        updateDynamicOptionsUI(data.sources[0].key);
      } else {
        // Initial state if no pre-fetch
        updateTagsUI([]); // Show empty state
        updatePrivacyUI([]);
      }
      // Initial state for tag list based on checkbox
      toggleTagListState();
    })
    .catch((error) => {
      console.error("Error fetching config:", error);
      setStatus("Error loading configuration options.", "error");
      sourceDirSelect.innerHTML =
        '<option value="" disabled selected>Error loading sources</option>';
      tagsListDiv.innerHTML = "<p>Error loading sources</p>";
      privacyDiv.innerHTML = "<p>Error loading sources</p>";
    });

  // --- Update Options when Source Changes ---
  sourceDirSelect.addEventListener("change", async (event) => {
    const selectedSourceKey = event.target.value;
    tagsListDiv.innerHTML = "<p>Loading tags...</p>"; // Clear old tags
    privacyDiv.innerHTML = "<p>Loading privacy levels...</p>";

    if (!selectedSourceKey) {
      updateTagsUI([]); // Reset UI if no source selected
      updatePrivacyUI([]);
      toggleTagListState(); // Ensure tag list disabled state is correct
      return;
    }

    if (availableOptionsCache[selectedSourceKey]) {
      updateDynamicOptionsUI(selectedSourceKey);
    } else {
      try {
        const response = await fetch(
          `/api/config-options?source=${selectedSourceKey}`
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const options = await response.json();
        availableOptionsCache[selectedSourceKey] = options;
        updateDynamicOptionsUI(selectedSourceKey);
      } catch (error) {
        console.error(
          `Error fetching options for ${selectedSourceKey}:`,
          error
        );
        setStatus(`Error loading options for ${selectedSourceKey}.`, "error");
        updateTagsUI([]); // Show error/empty state
        updatePrivacyUI([]);
        toggleTagListState();
      }
    }
  });

  // --- Toggle Tag Checkbox List ---
  includeAllTagsCheckbox.addEventListener("change", toggleTagListState);

  function toggleTagListState() {
    const isDisabled = includeAllTagsCheckbox.checked;
    tagsListDiv.classList.toggle("disabled", isDisabled);

    // Also disable/enable individual checkboxes inside
    const tagCheckboxes = tagsListDiv.querySelectorAll(
      'input[type="checkbox"]'
    );
    tagCheckboxes.forEach((checkbox) => {
      checkbox.disabled = isDisabled;
      // Optional: uncheck them when disabling
      // if (isDisabled) checkbox.checked = false;
    });

    // Update placeholder text based on state
    if (isDisabled && tagsListDiv.querySelector("p")) {
      tagsListDiv.querySelector("p").textContent =
        'Uncheck "Include All" to select specific tags';
    } else if (
      !isDisabled &&
      tagsListDiv.querySelectorAll('input[type="checkbox"]').length === 0 &&
      tagsListDiv.querySelector("p")
    ) {
      // If enabled but no tags available
      tagsListDiv.querySelector("p").textContent =
        "No tags found for this source";
    }
  }

  // --- Helper to Update Both Tags and Privacy UI ---
  function updateDynamicOptionsUI(sourceKey) {
    const options = availableOptionsCache[sourceKey];
    if (!options) return;
    updateTagsUI(options.tags || []);
    updatePrivacyUI(options.privacyLevels || []);
    toggleTagListState(); // Update disabled state after populating
  }

  // --- Populate Tags Checkbox List ---
  function updateTagsUI(tags) {
    tagsListDiv.innerHTML = ""; // Clear previous content
    if (tags && tags.length > 0) {
      tags.forEach((tag) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "requiredTags"; // Use plural name
        checkbox.value = tag;
        checkbox.disabled = includeAllTagsCheckbox.checked; // Initial disabled state

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${tag}`));
        tagsListDiv.appendChild(label);
        // No <br> needed if using display: block on label
      });
    } else {
      tagsListDiv.innerHTML = "<p>No tags found for this source</p>";
    }
    // Ensure disabled state is correct after population
    toggleTagListState();
  }

  // --- Populate Privacy Levels Checkbox List ---
  function updatePrivacyUI(privacyLevels) {
    privacyDiv.innerHTML = ""; // Clear previous
    if (privacyLevels && privacyLevels.length > 0) {
      privacyLevels.forEach((level) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "privacy";
        checkbox.value = level;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${level}`));
        privacyDiv.appendChild(label);
      });
    } else {
      privacyDiv.innerHTML = "<p>No privacy levels found in notes.</p>";
    }
  }

  // --- Handle Form Submission ---
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("Processing...", "loading");
    aggregateButton.disabled = true;

    const formData = new FormData(form);
    const selectedPrivacy = formData.getAll("privacy");

    let selectedTags = null; // Default to null for "include all"
    if (!includeAllTagsCheckbox.checked) {
      // Get checked tags ONLY if "include all" is OFF
      selectedTags = Array.from(formData.getAll("requiredTags"));
      // Validation: If not including all, at least one tag must be selected
      if (selectedTags.length === 0) {
        setStatus(
          'Please select at least one tag, or check "Include All Notes".',
          "error"
        );
        aggregateButton.disabled = false;
        return; // Stop submission
      }
    }

    const data = {
      sourceDirKey: formData.get("sourceDir"),
      requiredTags: selectedTags, // Send null or array of tags
      allowedPrivacy: selectedPrivacy,
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
    };

    // Basic validation
    if (!data.sourceDirKey) {
      setStatus("Please select a source directory.", "error");
      aggregateButton.disabled = false;
      return;
    }
    // No longer need requiredTag check, handled above

    fetch("/api/aggregate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((response) =>
        response.json().then((body) => ({ status: response.status, body }))
      )
      .then(({ status, body }) => {
        if (status >= 200 && status < 300) {
          setStatus(
            `Success! ${body.notesIncluded} note(s) aggregated into: ${body.outputFile}`,
            "success"
          );
        } else {
          const errorMessage =
            body.error || `Aggregation failed (Status: ${status})`;
          setStatus(errorMessage, "error");
          console.error("Aggregation error:", body);
        }
      })
      .catch((error) => {
        console.error("Fetch Error:", error);
        setStatus(
          `An network or fetch error occurred: ${error.message}`,
          "error"
        );
      })
      .finally(() => {
        aggregateButton.disabled = false;
      });
  });

  function setStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
});
