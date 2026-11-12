<!-- Spin MCP server: what `spin mcp` gives a coding agent. -->

**`spin mcp` connects Claude Code, Cursor, VS Code Copilot, Windsurf, or any
MCP client directly to your project's brand tokens, HTML elements,
interactive components, and lint checks** — so agents write valid Spin markup
on the first pass instead of inventing classes.

## Quick setup

`npx spin init` writes `.mcp.json` for you. Or add Spin to an existing
config:

```json
{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp"]
    }
  }
}
```

Then scaffold the project's agent skill so agents know your workflow before
calling a tool:

```bash
npx spin init --skill
```

That writes `.agents/skills/spin/SKILL.md` with your project's brand,
component, and verification conventions.

## Common agent workflows

Ask your agent to do any of these once Spin is connected:

**Build screens from your brand.** The agent queries `component` for the
exact tags and variants and `utility` for the exact class names, writes the
markup, then runs `findings` to verify zero errors — no invented classes,
no guessed variants.

**Add an interactive widget.** The agent inspects a machine's contract with
`component`, copies the template into `src/lib/components/`, and wires the
framework controller (`createSpinComponent`, `useSpinComponent`, or
`spinComponentCtl`) following the copied example.

**Create or tune a brand.** The agent uses `brand_*` and `token` tools to
create brands, change design languages, seed palettes, set type pairings,
and edit tokens — with automatic WCAG contrast validation before anything
is written to `spin/<brand>/`.

