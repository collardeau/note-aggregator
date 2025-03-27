# Note Aggregator

A Node.js web application designed to aggregate Markdown notes (e.g., from Obsidian daily or work journals) into a single summary file based on criteria defined in their frontmatter (tags, privacy) and filename (date).

## Features

- **Web-Based UI:** Provides a simple web interface (`http://localhost:3000` by default) for easy operation.
- **Multiple Sources:** Configure different source directories for your notes (e.g., 'daily' journal, 'work' journal).
- **Flexible Tag Filtering:**
  - Aggregate notes matching one specific tag.
  - Aggregate notes matching **any** of several selected tags.
  - Aggregate **all** notes within the date range/privacy level (ignore tags).
- **Privacy Filtering:** Filter notes based on a `privacy` field in the frontmatter (select multiple allowed levels, or select none to allow all).
- **Date Range Filtering:** Filter notes based on their filename (expects `YYYY-MM-DD.md` format).
- **Content Truncation:** Automatically excludes content below the first standalone `---` line within each source note.
- **Configurable Paths:** Define the path to your Obsidian vault (or note parent directory) via an environment file.
- **Dedicated Output:** Saves aggregated notes to a local `output/` directory within the project folder.
- **Generated Frontmatter:** Adds useful frontmatter to the aggregated note, including source tags, date range, aggregation date, etc.

## Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Core Logic:**
  - `gray-matter`: Parsing frontmatter from Markdown files.
  - `glob`: Finding files matching patterns.
  - `fs-extra`: Filesystem operations (reading, writing, ensuring directories).
  - `dotenv`: Loading environment variables from a `.env` file for configuration.
  - `cors`: Enabling cross-origin requests between frontend and backend.

## Prerequisites

- **Node.js:** Version 16 or later recommended. Download from [nodejs.org](https://nodejs.org/).
- **npm:** Comes bundled with Node.js.

## Installation & Setup

1.  **Clone or Download:**

    ```bash
    # Using Git (Recommended)
    git clone <repository_url> note-aggregator
    cd note-aggregator

    # Or download the ZIP and extract it, then navigate into the directory
    # cd path/to/note-aggregator
    ```

2.  **Install Dependencies:**
    Open your terminal in the `note-aggregator` directory and run:

    ```bash
    npm install
    ```

3.  **Configure Paths (.env file):**

    - Create a file named `.env` in the root of the `note-aggregator` project directory.
    - **IMPORTANT:** Add `.env` to your `.gitignore` file to avoid accidentally committing sensitive paths or credentials.
    - Add the following line to your `.env` file, replacing the example path with the **absolute path** to your Obsidian vault or the main folder containing your journal directories:

      ```.env
      # .env - Environment Variables for Note Aggregator

      # REQUIRED: Absolute path to the directory containing your source note folders (e.g., 'daily', 'work')
      OBSIDIAN_VAULT_PATH="/Users/your_username/Dropbox/Your Obsidian Vault"

      # OPTIONAL: Set a custom port (defaults to 3000 if not set)
      # PORT=3001

      # OPTIONAL: Define a different absolute path for output files (defaults to 'output/' inside this project)
      # AGGREGATES_PATH="/Users/your_username/Documents/NoteAggregates"
      ```

    - Verify the subdirectories mentioned in `server.js` (like `daily`, `my stuff/my journals/work-journal`) exist relative to your `OBSIDIAN_VAULT_PATH`. You can adjust the `SOURCES` object in `server.js` if your structure differs significantly.

4.  **Run the Server:**
    ```bash
    node server.js
    ```
    You should see output indicating the server is running, typically at `http://localhost:3000`, along with the configured source and output paths.

## Usage

1.  **Access the Web UI:** Open your web browser and navigate to `http://localhost:3000` (or the custom port if you set one).
2.  **Select Source:** Choose the source journal (e.g., "Daily Journal", "Work Journal") from the dropdown. The available tags and privacy levels for that source will load automatically.
3.  **Select Tags:**
    - To include notes regardless of tags, leave the **"Include All Notes"** checkbox checked.
    - To filter by specific tags, **uncheck "Include All Notes"** and then check the desired tag(s) from the list below it. At least one tag must be selected if "Include All" is unchecked.
4.  **Select Privacy Levels:** Check the boxes for any privacy levels you want to _include_. If no boxes are checked, notes with _any_ privacy level (or no privacy level defined) will be allowed (matching the behavior for tags when "Include All" is checked).
5.  **Select Date Range (Optional):** Use the date pickers to specify a start and/or end date. Notes are included if their filename (`YYYY-MM-DD.md`) falls within this range (inclusive).
6.  **Aggregate:** Click the "Aggregate Notes" button.
7.  **Check Status:** A status message will appear indicating success or failure.
8.  **Find Output:** If successful, the aggregated `.md` file will be saved in the `output/` directory within your `note-aggregator` project folder. The filename will typically reflect the tag(s) selected and the date of aggregation (e.g., `spain-2023-10-27.md`, `multi-tag-2023-10-27.md`, `all-notes-2023-10-27.md`).

## Project Structure

Use code with caution.
Markdown
note-aggregator/
├── logic/
│ └── aggregate.js # Core aggregation functions (filtering, file processing)
├── public/ # Frontend static files served to the browser
│ ├── index.html # Main UI page structure
│ ├── style.css # UI Styling
│ └── script.js # Frontend logic (API calls, UI updates)
├── output/ # Generated aggregate notes (Added to .gitignore)
├── .env # Configuration (Paths, Port - DO NOT COMMIT)
├── .gitignore # Specifies intentionally untracked files (node_modules, .env, output)
├── server.js # Express web server (API endpoints, static file serving)
├── package.json # Project metadata and dependencies
├── package-lock.json # Exact dependency versions
└── README.md # This file

## Troubleshooting

- **Server doesn't start / Path Errors:** Double-check the `OBSIDIAN_VAULT_PATH` in your `.env` file. Ensure it's the correct **absolute path** and that the source folders defined in `server.js` exist within it. Check the terminal output when running `node server.js` for specific error messages.
- **Tags/Privacy Levels not loading:** Verify the source directory selected actually contains `.md` files with frontmatter including `tags` (as an array) and/or `privacy` fields. Check the browser's developer console (F12) and the server's terminal output for errors.
- **No notes found:** Ensure notes within the selected source/date range actually contain the required tag(s) (if specified) and match the allowed privacy levels. Remember that content below `---` is ignored.
- **File already exists:** The script will not overwrite an existing aggregate file with the same name (based on tag/type and date). Delete the existing file in `output/` if you want to regenerate it.

## License

MIT License
