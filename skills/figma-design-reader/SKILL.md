---
name: figma-design-reader
description: Use the Figma desktop MCP tools exposed by the pi-figma-mcp package to inspect Figma selections, frames, layers, screenshots, metadata, and variables.
---

# Figma Design Reader

Use this skill when the user asks you to inspect, explain, or implement a Figma design inside Pi.

## What this package gives you

This package mirrors the Figma desktop MCP server into Pi tools.
Tool names are exposed with a `figma_` prefix, for example:

- `figma_get_design_context`
- `figma_get_metadata`
- `figma_get_screenshot`
- `figma_get_variable_defs`
- other Figma tools discovered from the MCP server

## How to work

1. If the user is talking about a Figma design, prefer the mirrored `figma_*` tools over guessing.
2. If the user has selected a frame/layer in the Figma desktop app, selection-based access should work.
3. If the user pasted a Figma frame or layer URL, pass it to the relevant Figma tool when supported.
4. For very large screens, call `figma_get_metadata` first, then use `figma_get_design_context` only on the parts you need.
5. If the user wants a visual reference, use `figma_get_screenshot`.
6. If the connection is down, ask the user to:
   - open the Figma desktop app
   - enable the desktop MCP server in the inspect panel
   - confirm the local server is available at `http://127.0.0.1:3845/mcp`
   - run `/figma-mcp-connect` in Pi

## Good prompt patterns

- "Read my current Figma selection and explain the layout hierarchy."
- "Use Figma metadata first, then inspect only the hero section."
- "Open this Figma frame URL and summarize spacing, typography, and component structure."
- "Get a screenshot of the selected frame before implementing it."

## Output expectations

When using Figma tools:

- state which Figma tool you used
- summarize the design accurately
- call out assumptions when the design context is incomplete
- avoid inventing values if the tool output does not contain them
