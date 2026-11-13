import { createResource, createSignal, For, Show } from "solid-js";
import { Badge, Frame, Section } from "./Concern.tsx";
import StudioSelect, { type StudioSelectItem } from "./StudioSelect.tsx";
import { spinClient } from "../lib/client.ts";
import { project } from "../lib/store.ts";

const SKILL_DIR_ITEMS: readonly StudioSelectItem[] = [
  { value: ".agents/skills", label: ".agents/skills" },
  { value: ".claude/skills", label: ".claude/skills" },
  { value: ".cursor/skills", label: ".cursor/skills" },
  { value: "__custom__", label: "Custom path…" },
];

export default function AgentSkillsSection() {
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

  return (
    <Section
      title="Agent Skills"
      fact={skillStatus()?.dirs.some((d) => d.general) ? "installed" : "not installed"}
      note="Copy the Spin authoring skill and optionally generate a project-specific <brand>-brand skill into your chosen agent folder."
    >
      <Frame>
        <div class="stack-sm">
          <div class="flex flex-wrap items-end gap-4">
            <div class="stack-xs min-w-[14rem]">
              <span class="type-caption text-muted">Target directory</span>
              <StudioSelect
                items={SKILL_DIR_ITEMS}
                value={skillDirChoice()}
                onPick={setSkillDirChoice}
                label="Target skill directory"
              />
            </div>

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
              class="h-4 w-4 shrink-0"
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
  );
}
