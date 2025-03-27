// server.js

// --- Load Environment Variables ---
require("dotenv").config();

// --- Core Dependencies ---
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

// --- Local Modules ---
const { aggregateNotes, getAvailableOptions } = require("./logic/aggregate");

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3000;

// --- Configuration - Load Input Paths from Environment Variables ---
const vaultBasePath = process.env.OBSIDIAN_VAULT_PATH;

// --- CRITICAL Check: Ensure Vault Path is Set ---
if (!vaultBasePath) {
  console.error(
    "\nERROR: 'OBSIDIAN_VAULT_PATH' is not defined in your .env file."
  );
  console.error(
    "Please create a .env file in the project root and add the following line:"
  );
  console.error('OBSIDIAN_VAULT_PATH="/path/to/your/Obsidian Vault"\n');
  process.exit(1); // Exit if the essential path is missing
}

// --- Define Source Directories using the Vault Base Path ---
const SOURCES = {
  daily: {
    name: "Daily Journal",
    path: path.join(vaultBasePath, "daily"),
  },
  work: {
    name: "Work Journal",
    path: path.join(vaultBasePath, "my stuff", "my journals", "work-journal"),
  },
  // Add more sources here if needed
};

// --- Define Aggregates Output Directory (Relative to this project) ---
// Output will go into a folder named 'output' within the note-aggregator directory
const AGGREGATES_DIR = path.join(__dirname, "output"); // <-- CHANGED HERE

// --- Startup Validation ---
console.log("--- Verifying Configuration ---");
let configOk = true;
Object.entries(SOURCES).forEach(([key, config]) => {
  if (!config.path) {
    console.error(`ERROR: Path configuration missing for source '${key}'.`);
    configOk = false;
  } else if (!fs.existsSync(config.path)) {
    console.warn(
      `WARN: Source directory for '${config.name}' (${key}) not found at: ${config.path}`
    );
    // configOk = false; // Decide if this should be a fatal error
  } else {
    console.log(`[OK] Source '${config.name}' (${key}): ${config.path}`);
  }
});

// Log the chosen aggregates directory
console.log(`[INFO] Aggregates will be saved to: ${AGGREGATES_DIR}`);
// We don't need to check if AGGREGATES_DIR exists here,
// as ensureDirSync in aggregate.js will create it.

if (!configOk) {
  console.error(
    "\nConfiguration errors found. Please check your .env file and folder structure."
  );
  process.exit(1);
}
console.log("--- Configuration Verified ---");

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- API Endpoints ---

// /api/config-options endpoint remains the same...
app.get("/api/config-options", async (req, res) => {
  // ... (no changes needed in this endpoint) ...
  const sourceKey = req.query.source;

  try {
    if (sourceKey) {
      // Fetch options only for the requested source
      if (!SOURCES[sourceKey]) {
        return res
          .status(404)
          .json({ error: `Source key '${sourceKey}' not found.` });
      }
      if (!fs.existsSync(SOURCES[sourceKey].path)) {
        return res
          .status(404)
          .json({
            error: `Source directory for '${sourceKey}' not found at ${SOURCES[sourceKey].path}`,
          });
      }
      const options = await getAvailableOptions(SOURCES[sourceKey].path);
      res.json(options);
    } else {
      // Return list of all configured sources
      const sourceList = Object.entries(SOURCES).map(([key, config]) => ({
        key: key,
        name: config.name,
      }));

      // Optional: Pre-fetch options for the first source
      let firstSourceOptions = {};
      if (sourceList.length > 0) {
        const firstSourceKey = sourceList[0].key;
        const firstSourcePath = SOURCES[firstSourceKey].path;
        try {
          if (fs.existsSync(firstSourcePath)) {
            firstSourceOptions[firstSourceKey] = await getAvailableOptions(
              firstSourcePath
            );
          } else {
            console.warn(
              `Skipping options pre-fetch for ${firstSourceKey}: Directory not found.`
            );
          }
        } catch (optionsError) {
          console.warn(
            `Could not pre-fetch options for ${firstSourceKey}: ${optionsError.message}`
          );
        }
      }

      res.json({
        sources: sourceList,
        options: firstSourceOptions,
      });
    }
  } catch (error) {
    console.error("Error in /api/config-options:", error);
    res
      .status(500)
      .json({
        error: `Failed to get configuration or options: ${error.message}`,
      });
  }
});

// Endpoint to trigger the note aggregation
app.post("/api/aggregate", async (req, res) => {
  // --- Destructure expected payload ---
  const {
    sourceDirKey,
    requiredTags, // <-- Changed from requiredTag. Expect null or an array.
    allowedPrivacy,
    startDate,
    endDate,
  } = req.body;

  // --- Input Validation ---
  if (!sourceDirKey || !SOURCES[sourceDirKey]) {
    return res
      .status(400)
      .json({ error: "Invalid or missing source directory key provided." });
  }
  // Validate requiredTags: should be null or an array
  if (requiredTags !== null && !Array.isArray(requiredTags)) {
    return res
      .status(400)
      .json({
        error: "Invalid format for requiredTags. Expected null or an array.",
      });
  }
  // Add validation: if requiredTags is an array, it shouldn't be empty (handled by frontend, but good backend check)
  if (Array.isArray(requiredTags) && requiredTags.length === 0) {
    return res
      .status(400)
      .json({
        error: "If filtering by tags, at least one tag must be provided.",
      });
  }

  const notesDir = SOURCES[sourceDirKey].path;

  if (!fs.existsSync(notesDir)) {
    console.error(
      `Aggregation failed: Source directory for key '${sourceDirKey}' not found at ${notesDir}`
    );
    return res
      .status(400)
      .json({
        error: `Source directory '${SOURCES[sourceDirKey].name}' not found. Check configuration.`,
      });
  }

  const tagDescription =
    requiredTags === null ? "all tags" : `tag(s): ${requiredTags.join(", ")}`;
  console.log(
    `Received aggregation request for source '${sourceDirKey}' with ${tagDescription}`
  );

  try {
    // --- Call aggregation logic with updated parameters ---
    const result = await aggregateNotes({
      notesDir,
      aggregatesDir: AGGREGATES_DIR,
      requiredTags, // <-- Pass the array or null
      allowedPrivacy: allowedPrivacy || [],
      startDate: startDate || "",
      endDate: endDate || "",
      newNoteTags: [],
    });

    const relativeOutputPath = path.relative(__dirname, result.outputFile);
    console.log(`Aggregation successful: ${relativeOutputPath}`);
    res.status(200).json({ ...result, outputFile: relativeOutputPath });
  } catch (error) {
    console.error("Aggregation failed:", error);
    const errorMessage =
      error.message || "An unknown error occurred during aggregation.";
    // Use 400 for request/logic errors, 500 for unexpected server errors
    res
      .status(
        error instanceof Error && error.message.includes("No notes found")
          ? 404
          : 400
      )
      .json({ error: errorMessage });
  }
});

// --- Catch-all for serving the frontend ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`\nNote Aggregator server running at http://localhost:${port}`);
  console.log("Ready to aggregate notes.");
});
