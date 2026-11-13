/**
 * Project agent skill authoring: copying the general `spin` skill and
 * generating `<brand>-brand/SKILL.md` from the project's live brand files.
 */

import { PROJECT_DIR, SHORTCUTS_FILENAME } from "./facts.ts";
import { readConfig } from "./service.ts";

export const KNOWN_SKILL_DIRS = [
  ".agents/skills",
  ".claude/skills",
  ".cursor/skills",
] as const;

export function projectSkillText(brandDir: string): string {
  return `---
name: spin
description: Author Spin UI in this project: semantic HTML primitives, layout utilities, portable components, and lint verification.
---

# Spin UI authoring

Author UI in this project with Spin: checked primitives, small utilities, and portable components. The project's brand lives in \`${brandDir}/\`.

## Brand

- Read and edit the brand's token layers in \`${brandDir}/\`. Keep light and dark modes serving together, and keep the contract scales shared across themes.
- Shape the brand in Studio when it is running; otherwise edit the JSON documents directly.

## Markup

- Spend semantic HTML primitives: \`card\`, \`panel\`, \`dialog\`, \`field\`, \`button\`.
- Style with layout utilities only: spacing, sizing, and placement. Never hand-write token values; spend the theme's tokens.
- Copy portable components with \`spin component copy <name> <example>\` and drive them through their app-controller surface (\`@spinjs/components\`).

## Verify

- Run \`spin mcp\` (via \`.mcp.json\`) when an agent session needs the project's RPC surface: components, utilities, and icons (plus \`brand_draft\` when Studio is running).
- Run the linter before finishing: findings are the report, and a finding the check cannot explain is a finding to fix, not to suppress.
`;
}

async function resolveSkillDir(
  root: string,
  skillDir: string,
): Promise<{ path: string; relative: string } | { error: string }> {
  const { isAbsolute, normalize, relative, resolve } = await import("node:path");
  const trimmed = skillDir.trim();
  if (trimmed === "") {
    return { error: "skill directory must not be empty" };
  }
  if (isAbsolute(trimmed)) {
    return { error: `skill directory must be relative to the project root: ${trimmed}` };
  }
  const normalized = normalize(trimmed).replace(/\\/g, "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    return { error: `skill directory escapes the project root: ${trimmed}` };
  }
  const absRoot = resolve(root);
  const absTarget = resolve(absRoot, normalized);
  const rel = relative(absRoot, absTarget);
  if (rel === "" || rel.startsWith("..")) {
    return { error: `skill directory escapes the project root: ${trimmed}` };
  }
  return { path: absTarget, relative: rel.replace(/\\/g, "/") };
}

export async function renderBrandSkill(
  root: string,
  brandDir?: string,
): Promise<{ brand: string; text: string } | null> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { basename, join } = await import("node:path");
  const { config } = await readConfig(root);
  const resolvedBrandDir = brandDir ?? (config.brand ? `${PROJECT_DIR}/${config.brand}` : undefined);
  let brand = config.brand ?? (resolvedBrandDir ? basename(resolvedBrandDir) : undefined);

  if (brand === undefined) {
    const entries = await readdir(join(root, PROJECT_DIR), { withFileTypes: true }).catch(() => []);
    const firstDir = entries.find((entry) => entry.isDirectory());
    if (firstDir !== undefined) brand = firstDir.name;
  }
  if (brand === undefined) return null;

  const dir = resolvedBrandDir ? join(root, resolvedBrandDir) : join(root, PROJECT_DIR, brand);
  let language = "editorial";
  let modes: string[] = ["light", "dark"];
  let collection = config.icons?.collection ?? "lucide";
  let stroke: string | undefined;

  try {
    const brandDoc = JSON.parse(await readFile(join(dir, "brand.json"), "utf8")) as {
      icons?: { collection?: string; stroke?: string };
    };
    if (typeof brandDoc.icons?.collection === "string") collection = brandDoc.icons.collection;
    if (typeof brandDoc.icons?.stroke === "string") stroke = brandDoc.icons.stroke;
  } catch {
    // brand.json is optional when tokens.json sits alone.
  }

  try {
    const tokensDoc = JSON.parse(await readFile(join(dir, "tokens.json"), "utf8")) as {
      $extends?: unknown;
      modes?: unknown;
    };
    if (typeof tokensDoc.$extends === "string") language = tokensDoc.$extends;
    if (Array.isArray(tokensDoc.modes)) {
      const validModes = tokensDoc.modes.filter((m): m is string => typeof m === "string");
      if (validModes.length > 0) modes = validModes;
    }
  } catch {
    return null;
  }

  let shortcuts: string[] = [];
  try {
    const shortcutsDoc = JSON.parse(
      await readFile(join(root, PROJECT_DIR, SHORTCUTS_FILENAME), "utf8"),
    ) as { shortcuts?: Record<string, unknown> };
    if (shortcutsDoc.shortcuts && typeof shortcutsDoc.shortcuts === "object") {
      shortcuts = Object.keys(shortcutsDoc.shortcuts).sort();
    }
  } catch {
    // No shortcuts.json in project.
  }

  const componentsDir = config.componentsDir ?? "src/lib/components";
  const componentFiles = (await readdir(join(root, componentsDir)).catch(() => [] as string[]))
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.replace(/\.html$/, ""))
    .sort();

  const lines = [
    `---`,
    `name: ${brand}-brand`,
    `description: Project-specific Spin brand rules for ${brand} (language: ${language}, icons: ${collection}).`,
    `---`,
    ``,
    `# ${brand} Brand Contract`,
    ``,
    `- **Brand directory:** \`${PROJECT_DIR}/${brand}/\``,
    `- **Design language:** \`${language}\``,
    `- **Modes:** ${modes.join(", ")}`,
    `- **Icons:** \`${collection}\`${stroke ? ` (${stroke})` : ""}`,
  ];

  if (shortcuts.length > 0) {
    lines.push(``, `## Project Shortcuts (\`${PROJECT_DIR}/${SHORTCUTS_FILENAME}\`)`, ``);
    for (const name of shortcuts) {
      lines.push(`- \`${name}\``);
    }
  }

  if (componentFiles.length > 0) {
    lines.push(``, `## Project Components (\`${componentsDir}/\`)`, ``);
    for (const name of componentFiles) {
      lines.push(`- \`${name}\``);
    }
  }

  lines.push(``);
  return { brand, text: lines.join("\n") };
}

export async function installProjectSkills(options: {
  root: string;
  skillDir: string;
  general?: boolean;
  brandSkill?: boolean;
  brandDir?: string;
}): Promise<{ written: string[]; error: string | null }> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const resolved = await resolveSkillDir(options.root, options.skillDir);
  if ("error" in resolved) {
    return { written: [], error: resolved.error };
  }

  const { config } = await readConfig(options.root);
  const brandDir =
    options.brandDir ??
    (config.brand ? `${PROJECT_DIR}/${config.brand}` : `${PROJECT_DIR}/default`);
  const written: string[] = [];

  if (options.general !== false) {
    const dir = join(resolved.path, "spin");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "SKILL.md"), projectSkillText(brandDir), "utf8");
    written.push(`${resolved.relative}/spin/SKILL.md`);
  }

  if (options.brandSkill === true) {
    const rendered = await renderBrandSkill(options.root, options.brandDir);
    if (rendered !== null) {
      const dir = join(resolved.path, `${rendered.brand}-brand`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "SKILL.md"), rendered.text, "utf8");
      written.push(`${resolved.relative}/${rendered.brand}-brand/SKILL.md`);
    }
  }

  return { written, error: null };
}

export async function projectSkillStatus(
  root: string,
  customDir?: string,
): Promise<{
  dirs: Array<{ dir: string; general: boolean; brandSkill: string | null }>;
}> {
  const { access, readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const candidates = new Set<string>(KNOWN_SKILL_DIRS);
  if (customDir !== undefined && customDir.trim() !== "") {
    const resolved = await resolveSkillDir(root, customDir);
    if (!("error" in resolved)) candidates.add(resolved.relative);
  }

  const dirs: Array<{ dir: string; general: boolean; brandSkill: string | null }> = [];
  for (const dir of candidates) {
    const base = join(root, dir);
    let general = false;
    try {
      await access(join(base, "spin", "SKILL.md"));
      general = true;
    } catch {
      general = false;
    }
    let brandSkill: string | null = null;
    const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith("-brand")) continue;
      try {
        await access(join(base, entry.name, "SKILL.md"));
        brandSkill = entry.name;
        break;
      } catch {
        // Ignore directory without SKILL.md.
      }
    }
    dirs.push({ dir, general, brandSkill });
  }
  return { dirs };
}
