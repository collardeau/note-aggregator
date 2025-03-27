// logic/aggregate.js
const fs = require("fs-extra");
const matter = require("gray-matter");
const glob = require("glob");
const path = require("path");

// --- getAvailableOptions function remains the same ---
async function getAvailableOptions(notesDir) {
  // ... (no changes needed here) ...
  if (!fs.existsSync(notesDir)) {
    console.warn(`Directory not found for getAvailableOptions: ${notesDir}`);
    return { tags: [], privacyLevels: [] }; // Return empty if dir doesn't exist
  }
  const files = glob.sync(path.join(notesDir, "*.md"));
  const tags = new Set();
  const privacyLevels = new Set();

  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(file, "utf8");
      try {
        const { data } = matter(fileContent);
        if (data.tags && Array.isArray(data.tags)) {
          data.tags.forEach((tag) => {
            if (tag && typeof tag === "string") tags.add(tag.trim());
          }); // Ensure tags are strings and trim
        }
        if (data.privacy) {
          privacyLevels.add(data.privacy);
        }
      } catch (parseError) {
        console.warn(
          `Warning: Could not parse frontmatter for ${path.basename(file)}: ${
            parseError.message
          }`
        );
      }
    } catch (readError) {
      console.error(`Error reading file ${file}: ${readError}`);
    }
  }
  return {
    tags: Array.from(tags).sort(),
    privacyLevels: Array.from(privacyLevels).sort(),
  };
}

// --- Main Aggregation Function ---
async function aggregateNotes(options) {
  const {
    notesDir,
    aggregatesDir,
    requiredTags, // <-- Changed from requiredTag (expects null or array)
    allowedPrivacy = [],
    startDate = "",
    endDate = "",
    newNoteTags = [], // Existing custom tags for the *new* note
  } = options;

  // --- Input Validation ---
  // Basic checks - null/array check done in server.js
  if (!notesDir || !aggregatesDir) {
    throw new Error("Missing required options: notesDir or aggregatesDir.");
  }
  // Check requiredTags validity (null or non-empty array) - redundant if server checks, but safe
  if (
    requiredTags !== null &&
    (!Array.isArray(requiredTags) || requiredTags.length === 0)
  ) {
    throw new Error(
      "Invalid 'requiredTags' parameter. Must be null (for all tags) or a non-empty array of tags."
    );
  }

  // --- Determine Aggregation Type and Base Tag for Filename/Frontmatter ---
  let aggregationType = "all-notes"; // Default if requiredTags is null
  let primaryTag = "all";
  if (requiredTags) {
    // If it's an array (already validated non-empty)
    if (requiredTags.length === 1) {
      aggregationType = "single-tag";
      primaryTag = requiredTags[0];
    } else {
      aggregationType = "multi-tag";
      primaryTag = requiredTags[0]; // Use the first tag for filename, or maybe 'multi'?
      // Let's use 'multi-tag' for filename consistency when multiple are selected
      primaryTag = "multi-tag";
    }
  }

  // Sanitize the primary tag for use in filename
  const safeTagForFilename = primaryTag
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  // --- New Frontmatter Configuration ---
  const currentDate = new Date().toISOString().slice(0, 10);
  const newFrontmatter = {
    tags: ["aggregated", safeTagForFilename, ...newNoteTags].filter(
      (t, i, self) => t && self.indexOf(t) === i
    ), // Add base, type, custom; ensure unique
    date: currentDate,
    aggregation_type: aggregationType,
    source_tags: requiredTags, // Store the actual filter tags (null or array)
    source_directory: path.basename(notesDir),
    filter_privacy: allowedPrivacy,
    filter_start_date: startDate || null,
    filter_end_date: endDate || null,
  };

  // --- Output Filename ---
  const aggregatedFilename = path.join(
    aggregatesDir,
    `${safeTagForFilename}-${currentDate}.md` // Use sanitized primary/type tag
  );

  if (fs.existsSync(aggregatedFilename)) {
    const relativePath = path.relative(process.cwd(), aggregatedFilename);
    throw new Error(
      `File already exists: ${relativePath}. Aborting aggregation.`
    );
  }

  // --- Find Files ---
  let files = [];
  try {
    files = glob.sync(path.join(notesDir, "*.md"));
  } catch (globError) {
    throw new Error(`Error finding files in ${notesDir}: ${globError.message}`);
  }
  console.log(`Found ${files.length} files initially in ${notesDir}`);

  // --- Filter by Date Range ---
  // ... (date filtering logic remains the same) ...
  if (startDate || endDate) {
    files = files.filter((file) => {
      const filenameDate = path.basename(file, ".md");
      const afterStart = !startDate || filenameDate >= startDate;
      const beforeEnd = !endDate || filenameDate <= endDate;
      return afterStart && beforeEnd;
    });
    console.log(
      `Filtered down to ${files.length} files based on date range [${
        startDate || "any"
      } - ${endDate || "any"}]`
    );
  }

  if (files.length === 0) {
    const dateRange =
      startDate || endDate
        ? `within the date range [${startDate || "any"} - ${endDate || "any"}]`
        : "matching the criteria";
    throw new Error(
      `No files found in ${path.basename(notesDir)} ${dateRange}`
    );
  }

  // --- Process and Filter Files ---
  const aggregatedContent = [];
  let processedCount = 0;
  let includedCount = 0;

  for (const file of files.sort()) {
    // Process chronologically
    processedCount++;
    try {
      const fileContent = fs.readFileSync(file, "utf8");
      const { data, content: originalContent } = matter(fileContent);

      // --- UPDATED Filtering Criteria ---
      const noteTags =
        data.tags && Array.isArray(data.tags)
          ? data.tags.map((t) => String(t).trim()).filter(Boolean)
          : []; // Ensure tags are cleaned strings

      // Check Tag Requirement:
      // - If requiredTags is null, always true (include all)
      // - Otherwise, check if noteTags contains AT LEAST ONE of the requiredTags
      const hasRequiredTag =
        requiredTags === null ||
        (noteTags.length > 0 &&
          requiredTags.some((reqTag) => noteTags.includes(reqTag)));

      // Check Privacy Requirement
      const hasAllowedPrivacy =
        allowedPrivacy.length === 0 ||
        (data.privacy && allowedPrivacy.includes(data.privacy));
      // --- End UPDATED Criteria ---

      if (hasRequiredTag && hasAllowedPrivacy) {
        includedCount++;

        // Truncate content at the first '---' line
        const contentParts = originalContent.split(/^\s*---\s*$/m);
        let relevantContent = contentParts[0].trim();

        // Remove potential H2 date heading
        relevantContent = relevantContent
          .replace(/^##\s+\d{4}-\d{2}-\d{2}\s*?\n/m, "")
          .trim();

        if (relevantContent) {
          aggregatedContent.push(relevantContent);
        } else {
          console.warn(
            `Note ${path.basename(
              file
            )} included by criteria, but had no processable content.`
          );
        }
      }
    } catch (error) {
      console.error(
        `Error processing file ${path.basename(file)}: ${error.message}`
      );
      // Decide whether to continue or stop on error
    }
  }

  const filterDescription =
    requiredTags === null ? "all tags" : `tag(s) [${requiredTags.join(", ")}]`;
  if (aggregatedContent.length === 0) {
    throw new Error(
      `No notes found matching ${filterDescription} and privacy levels [${
        allowedPrivacy.join(", ") || "any"
      }] within the selected files.`
    );
  }

  // --- Create Aggregated File ---
  const aggregatedFileContent = matter.stringify(
    aggregatedContent.join("\n\n---\n\n"), // Separator
    newFrontmatter
  );

  fs.ensureDirSync(aggregatesDir);
  fs.writeFileSync(aggregatedFilename, aggregatedFileContent);

  console.log(
    `Aggregation successful. ${includedCount} out of ${processedCount} notes included.`
  );
  return {
    outputFile: aggregatedFilename,
    filesProcessed: processedCount,
    notesIncluded: includedCount,
  };
}

module.exports = {
  aggregateNotes,
  getAvailableOptions,
};
