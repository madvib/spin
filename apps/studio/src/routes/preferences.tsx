import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Badge, ConcernPage, Frame, Section } from "../components/Concern.tsx";
import { DrawerEdge } from "../components/Settings.tsx";
import { spinClient } from "../lib/client.ts";
import { inDrawer } from "../lib/host.ts";
import { dockSide, project, registry } from "../lib/store.ts";
import { paletteChips } from "../lib/overview.ts";
import studioTheme from "../../theme.json" with { type: "json" };

/**
 * Studio preferences. How the tool behaves — never what the project
 * contains.
 *
 * The theme under edit and the mode it is shown in are NOT here: they are
 * facts about the whole studio rather than about this page, so they live in
 * the bar along the bottom where they are on every route.
 *
 * The page holds the two things that are the STUDIO's own rather than the
 * project's: the edge the host's drawer takes, and the theme the chrome
 * wears. The second one is worth showing rather than merely stating,
 * because it is the reason the tool around you never changes colour while
 * you are changing someone else's.
 */
const KNOWN_SKILL_DIRS = [".agents/skills", ".claude/skills", ".cursor/skills"] as const;

export default function PreferencesPage() {
  /** The edge the drawer takes, as the studio remembers it. */
  const side = () => dockSide();
  const [skillDirChoice, setSkillDirChoice] = createSignal<string>(".agents/skills");
  const [customSkillDir, setCustomSkillDir] = createSignal<string>("");
  const [includeBrandSkill, setIncludeBrandSkill] = createSignal<boolean>(true);
  const [skillMessage, setSkillMessage] = createSignal<string | null>(null);
  const [installingSkills, setInstallingSkills] = createSignal<boolean>(false);

  const effectiveSkillDir = () =>
    skillDirChoice() === "__custom__" ? customSkillDir().trim() : skillDirChoice();

  const [skillStatus, { refetch: refetchSkillStatus }] = createResource(
    () => project()?.root,
    async (root) => {
      if (!root) return null;
      const client = await spinClient();
      return await client.project.skills.status({ root });
    },
  );

  async function handleInstallSkills() {
    const root = project()?.root;
    const dir = effectiveSkillDir();
    if (!root || !dir) return;
    setInstallingSkills(true);
    setSkillMessage(null);
    try {
      const client = await spinClient();
      const res = await client.project.skills.install({
        root,
        skillDir: dir,
        general: true,
        brandSkill: includeBrandSkill(),
      });
      if (res.error !== null) {
        setSkillMessage(res.error);
      } else {
        setSkillMessage(`Installed: ${res.written.join(", ")}`);
        await refetchSkillStatus();
      }
    } finally {
      setInstallingSkills(false);
    }
  }
  /**
   * The studio's own palette.
   *
   * The chrome wears the studio's static theme and not the project's, so
   * the swatches are painted with their resolved values rather than with a
   * utility: a utility can only paint the ACTIVE theme's tokens, and these
   * are the colours the tool around the page is wearing.
   */
  const studioChips = createMemo(() =>
    paletteChips(JSON.stringify(studioTheme), "light")
  );

  return (
    <ConcernPage
      title="Preferences"
      note="Project configuration and studio behavior settings."
    >
      <Section
        title="Project"
        fact={project()?.wired ? "wired" : "unwired"}
        note="The project directory and build configuration the studio is connected to."
      >
        <Frame>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="stack-xs">
              <span class="type-caption text-muted">Root</span>
              <code class="truncate">{project()?.root ?? "—"}</code>
            </div>
            <div class="stack-xs">
              <span class="type-caption text-muted">Preset status</span>
              <code class="truncate">
                {project()?.wired ? "spinPreset wired" : "not wired"}
              </code>
            </div>
            <div class="stack-xs">
              <span class="type-caption text-muted">Themes</span>
              <span class="type-body">
                {registry()?.filter((t) => t.file !== null).length ?? 0} project
                {" · "}
                {registry()?.filter((t) => t.file === null).length ?? 0}{" "}
                built-ins
              </span>
            </div>
            <div class="stack-xs">
              <span class="type-caption text-muted">Themes directory</span>
              <code class="truncate">
                {project()?.spin ? "spin/" : "not initialized"}
              </code>
            </div>
          </div>
        </Frame>
      </Section>
      <Section
        title="Drawer edge"
        fact={side()}
        note="The host's drawer takes one edge or the other. The studio asks the host rather than guessing, and the choice is remembered."
        aside={
          <Show when={!inDrawer()}>
            <Badge tone="info">no effect in a window</Badge>
          </Show>
        }
      >
        <Frame>
          <div class="flex flex-wrap items-start gap-6">
            <div class="flex gap-4">
              <EdgeFigure edge="left" chosen={side() === "left"} />
              <EdgeFigure edge="right" chosen={side() === "right"} />
            </div>
            <div class="stack-sm min-w-[12rem] flex-1">
              <DrawerEdge />
              <p class="text-muted">
                The studio asks the host which edge it is on rather than
                guessing from its own width, so a drawer on the right is a
                drawer on the right.
              </p>
            </div>
          </div>
        </Frame>
      </Section>

      <Section
        title="The studio's own theme"
        fact={`${studioChips().length} roles`}
        note="The top bar and studio chrome wear this theme and never the project's, so editing a theme cannot restyle the tool you are editing it with."
      >
        <Frame>
          <div class="flex flex-wrap gap-3">
            <For each={studioChips()}>
              {(chip) => (
                <figure class="stack-sm w-20">
                  <span
                    class="block h-10 w-full rounded-md border"
                    // The studio's OWN colour, painted by its resolved value:
                    // a utility can only paint the active theme's tokens, and
                    // these are the colours the tool around the page wears.
                    style={{ background: chip.value }}
                    aria-hidden="true"
                  />
                  <figcaption class="truncate">
                    {chip.label}
                  </figcaption>
                  <code class="truncate">
                    {chip.value}
                  </code>
                </figure>
              )}
            </For>
          </div>
        </Frame>
      </Section>

      <Section
        title="Agent Skills"
        fact={skillStatus()?.dirs.some((d) => d.general) ? "installed" : "not installed"}
        note="Copy the Spin authoring skill and optionally generate a project-specific <brand>-brand skill into your chosen agent folder."
      >
        <Frame>
          <div class="stack-sm">
            <div class="flex flex-wrap items-end gap-4">
              <label class="stack-xs min-w-[14rem]">
                <span class="type-caption text-muted">Target directory</span>
                <select
                  value={skillDirChoice()}
                  onChange={(e) => setSkillDirChoice(e.currentTarget.value)}
                >
                  <For each={KNOWN_SKILL_DIRS}>
                    {(dir) => <option value={dir}>{dir}</option>}
                  </For>
                  <option value="__custom__">Custom path…</option>
                </select>
              </label>

              <Show when={skillDirChoice() === "__custom__"}>
                <label class="stack-xs min-w-[14rem]">
                  <span class="type-caption text-muted">Custom relative path</span>
                  <input
                    type="text"
                    placeholder=".windsurf/skills"
                    value={customSkillDir()}
                    onInput={(e) => setCustomSkillDir(e.currentTarget.value)}
                  />
                </label>
              </Show>

              <button
                type="button"
                class="primary"
                disabled={installingSkills() || !effectiveSkillDir()}
                onClick={() => void handleInstallSkills()}
              >
                {installingSkills() ? "Installing…" : "Install / Regenerate"}
              </button>
            </div>

            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeBrandSkill()}
                onChange={(e) => setIncludeBrandSkill(e.currentTarget.checked)}
              />
              <span>Generate project &lt;brand&gt;-brand skill from brand.json, shortcuts, and components</span>
            </label>

            <Show when={skillMessage() !== null}>
              <p class="text-muted">{skillMessage()}</p>
            </Show>

            <Show when={skillStatus()}>
              {(status) => (
                <div class="flex flex-wrap gap-2">
                  <For each={status().dirs}>
                    {(entry) => (
                      <Badge tone={entry.general ? "primary" : "info"}>
                        {entry.dir}
                        {entry.general ? " · spin" : ""}
                        {entry.brandSkill ? ` · ${entry.brandSkill}` : ""}
                      </Badge>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </div>
        </Frame>
      </Section>
    </ConcernPage>
  );
}

/**
 * One edge, drawn: the host's frame with the studio in it.
 *
 * The strip is the studio and the ground is the host, and the edge the
 * studio has chosen is the one drawn in the acting colour — so the setting
 * is a picture of what it does rather than a word about it.
 */
function EdgeFigure(props: { edge: "left" | "right"; chosen: boolean }) {
  const strip = () =>
    `w-8 shrink-0 rounded-sm ${
      props.chosen ? "bg-primary" : "bg-surface-sunken"
    }`;
  return (
    <figure class="stack-sm w-24">
      <div class="flex h-24 gap-1 rounded-md border bg-surface p-1">
        {props.edge === "left" && <div class={strip()} />}
        <div class="flex-1 rounded-sm bg-surface-sunken" />
        {props.edge === "right" && <div class={strip()} />}
      </div>
      <figcaption class="text-center">
        {props.edge}
      </figcaption>
    </figure>
  );
}
