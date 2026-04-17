# pi-figma-mcp

Connect [Pi](https://github.com/mariozechner/pi-coding-agent) to the **Figma desktop MCP server** so Pi can read the designs you provide.

This package installs a Pi extension that:

- connects to the local Figma desktop MCP endpoint at `http://127.0.0.1:3845/mcp`
- discovers the Figma MCP tools automatically
- mirrors those tools into Pi as `figma_*` tools
- gives Pi a Figma-focused skill for working with selections, frames, layers, screenshots, and metadata

> This package is intentionally focused on the **desktop Figma MCP server** only.
> No cloud/remote Figma MCP setup is required.

---

## What you get

Once connected, Pi can use Figma tools such as:

- `figma_get_design_context`
- `figma_get_metadata`
- `figma_get_screenshot`
- `figma_get_variable_defs`
- plus any other tools exposed by your local Figma desktop MCP server

That means you can ask Pi things like:

- "Read my selected Figma frame and explain the layout."
- "Inspect this Figma link and summarize spacing, colors, and typography."
- "Use metadata first, then get design context only for the hero section."
- "Get a screenshot of the selected design before implementing it."

---

## Requirements

Before installing this package, make sure you have:

- [Pi](https://github.com/mariozechner/pi-coding-agent) installed
- the **Figma desktop app** installed
- a Figma seat that supports the desktop MCP server
- a Pi setup that can install packages or load local extensions

From Figma's docs:

- the desktop MCP server runs locally at `http://127.0.0.1:3845/mcp`
- selection-based prompting works with the **desktop** server
- you must enable the desktop MCP server in the Figma desktop app

---

## Installation

This package can be installed into Pi in two main ways:

1. **from your local repository** while developing/testing
2. **from npm** after the package is published

### Install into Pi from a local repository

Use this during local development, testing, or before publishing.

#### Method A: install from the current folder

From the root of this repository:

```bash
pi install .
```

#### Method B: install from an absolute path

From anywhere on your machine:

```bash
pi install /absolute/path/to/pi-figma-mcp
```

#### Method C: try it without permanently installing it

This is useful for a quick test run:

```bash
pi -e /absolute/path/to/pi-figma-mcp
```

### Install into Pi from npm

After this package is published to npm, install it into Pi with:

```bash
pi install npm:pi-figma-mcp
```

If you want Pi to use a specific published version:

```bash
pi install npm:pi-figma-mcp@0.1.0
```

### Verify the package is installed in Pi

After either local or npm installation, you can verify it inside Pi by running:

```text
/figma-mcp-status
```

You can also inspect installed Pi packages with:

```bash
pi list
```

### Custom Figma MCP URL

By default, the package connects to:

```text
http://127.0.0.1:3845/mcp
```

If your Figma MCP server uses a different URL, you can override it in three ways.

#### Option 1: set a project-local URL inside Pi

This stores the URL in:

```text
<your-project>/.pi/figma-mcp.json
```

Command:

```text
/figma-mcp-set-url http://127.0.0.1:9999/mcp
```

You can also be explicit:

```text
/figma-mcp-set-url --project http://127.0.0.1:9999/mcp
```

#### Option 2: set a global URL inside Pi

This stores the URL in:

```text
~/.pi/agent/figma-mcp.json
```

Command:

```text
/figma-mcp-set-url --global http://127.0.0.1:9999/mcp
```

#### Option 3: override with an environment variable

Environment variable has the highest priority:

```bash
export FIGMA_MCP_URL=http://127.0.0.1:9999/mcp
```

#### Resetting a custom URL

Remove the project override:

```text
/figma-mcp-reset-url
```

Remove the global override:

```text
/figma-mcp-reset-url --global
```

#### URL priority order

The extension resolves the server URL in this order:

1. `FIGMA_MCP_URL` environment variable
2. project config: `.pi/figma-mcp.json`
3. global config: `~/.pi/agent/figma-mcp.json`
4. default: `http://127.0.0.1:3845/mcp`

---

## Step-by-step setup

### Local development setup

1. Clone this repository.
2. From the repository root, install it into Pi:

```bash
pi install .
```

3. Open Pi in any project and run:

```text
/figma-mcp-status
```

If Pi was already running before installation, run:

```text
/reload
```

### Published npm setup

After the package is published, install it into Pi with:

```bash
pi install npm:pi-figma-mcp
```

Then open Pi and run:

```text
/figma-mcp-status
```

If Pi was already running before installation, run:

```text
/reload
```

### 1. Confirm the desktop MCP server is enabled in Figma

In the **Figma desktop app**:

1. Update Figma to the latest desktop version.
2. Open a file.
3. Open the **Inspect** panel.
4. Find the **MCP server** section.
5. Click **Enable desktop MCP server**.

The local endpoint should be:

```text
http://127.0.0.1:3845/mcp
```

### 3. Start or reload Pi

Open Pi in your project.

If Pi was already running while you installed the package, reload Pi resources with:

```text
/reload
```

### 4. Confirm Pi can see Figma MCP

Inside Pi, run:

```text
/figma-mcp-status
```

This command now also shows:

- the active server URL
- where that URL came from (`env`, `project`, `global`, or `default`)

If everything is working, you should see that Pi is connected and that Figma tools were discovered.

If Pi started before Figma MCP was enabled, run:

```text
/figma-mcp-connect
```

You can also inspect the mirrored Pi tools with:

```text
/figma-mcp-list-tools
```

---

## First usage flow

### Using the current selection in the Figma desktop app

1. Open a frame or layer in Figma desktop.
2. Select the frame/layer you want Pi to inspect.
3. In Pi, ask:

```text
Read my current Figma selection and explain the layout hierarchy.
```

### Using a Figma link

If you prefer, paste a Figma frame or layer URL into Pi:

```text
Use Figma to inspect this design and summarize spacing, typography, and components: <your-figma-url>
```

### For large screens

Ask Pi to start with metadata first:

```text
Use Figma metadata first, then inspect only the hero and pricing sections.
```

---

## Commands added by this package

### `/figma-mcp-status`

Shows:

- server URL
- whether Pi is connected
- how many Figma tools were discovered
- the Pi tool name → MCP tool name mapping

### `/figma-mcp-connect`

Reconnects Pi to the local Figma desktop MCP server.

Use this if:

- Figma was not open when Pi started
- you enabled the MCP server after Pi already launched
- the connection dropped

### `/figma-mcp-list-tools`

Lists the Pi tools mirrored from the Figma MCP server.

### `/figma-mcp-set-url [--project|--global] <url>`

Sets a custom Figma MCP URL.

Examples:

```text
/figma-mcp-set-url http://127.0.0.1:9999/mcp
/figma-mcp-set-url --project http://127.0.0.1:9999/mcp
/figma-mcp-set-url --global http://127.0.0.1:9999/mcp
```

### `/figma-mcp-reset-url [--global]`

Removes a custom URL override.

Examples:

```text
/figma-mcp-reset-url
/figma-mcp-reset-url --global
```

---

## How Pi sees the Figma tools

The extension mirrors Figma MCP tools into Pi with a `figma_` prefix.

Examples:

- MCP `get_design_context` → Pi `figma_get_design_context`
- MCP `get_metadata` → Pi `figma_get_metadata`
- MCP `get_screenshot` → Pi `figma_get_screenshot`

This makes the tools visible to Pi's model like any other Pi tool.

---

## Recommended prompts

Good prompts for Pi:

```text
Read my selected Figma frame and summarize the structure.
```

```text
Inspect this Figma frame and list typography, spacing, and colors.
```

```text
Use Figma metadata first, then get design context only for the CTA area.
```

```text
Get a screenshot of the selected frame before implementing it.
```

```text
Inspect the selected Figma component and tell me what reusable parts should become React components.
```

---

## Configuration

By default, this package connects to:

```text
http://127.0.0.1:3845/mcp
```

You can override the URL with:

- `FIGMA_MCP_URL` environment variable
- project config file: `.pi/figma-mcp.json`
- global config file: `~/.pi/agent/figma-mcp.json`
- Pi commands:
  - `/figma-mcp-set-url`
  - `/figma-mcp-reset-url`

Example project config file:

```json
{
  "serverUrl": "http://127.0.0.1:9999/mcp"
}
```

Example global config file:

```json
{
  "serverUrl": "http://127.0.0.1:9999/mcp"
}
```

---

## Troubleshooting

### Pi says Figma MCP is offline

Check these in order:

1. Figma desktop app is open
2. desktop MCP server is enabled in Figma
3. the endpoint is `http://127.0.0.1:3845/mcp`
4. run `/figma-mcp-connect` in Pi
5. if needed, restart Pi and Figma

### Pi does not see any `figma_*` tools

Run:

```text
/figma-mcp-connect
/figma-mcp-list-tools
```

If the list is still empty, the local Figma MCP server is probably not available yet.

### Selection-based prompts do not work

Selection-based access depends on the **desktop Figma app** and an active selection there.

Try:

1. select the frame again in Figma desktop
2. keep the file open
3. rerun the Pi prompt

### The design is too large

Ask Pi to use metadata first:

```text
Use Figma metadata first, then inspect only the sections needed for implementation.
```

---

## Project structure

```text
extensions/figma-mcp/index.ts   # Pi extension that connects to Figma MCP
skills/figma-design-reader/     # Optional Pi skill for better Figma workflows
README.md                       # Setup and usage guide
```

---

## Development

Install dependencies:

```bash
npm install
```

Run typecheck:

```bash
npm run typecheck
```

---

## Notes

- this package targets the **desktop Figma MCP server** only
- it does not implement the remote/cloud Figma MCP flow
- it mirrors whatever tools your local Figma desktop MCP server exposes

---

## References

- Figma help: Guide to the Figma MCP server
- Figma developer docs: Set up the desktop server
- Pi docs: extensions and packages
