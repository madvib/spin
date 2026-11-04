import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { modePicker } from "@spinjs/components/mode-picker";
import { ColorField } from "../components/ColorField.tsx";
import { ReferencePicker } from "../components/ReferencePicker.tsx";
import { contrastRatio, generateScale, toHex } from "@spinjs/spin/theme";
import { inDrawer } from "../lib/host.ts";
import {
  activeMode,
  activeModes,
  activeTree,
  lastRefusal,
  refusalFor,
  setActiveMode,
  themeText,
} from "../lib/store.ts";
import { editToken } from "../lib/editing.ts";
import { type MeasuredFloor, measureFloors } from "../lib/floors.ts";
import {
  colorRoles,
  colorTargets,
  contrastInk,
  FAMILIES,
  FAMILY_TITLES,
  familyCards,
  humanName,
  neutralRamp,
  pairedFillPath,
  pairedInkPath,
  type Role,
  type RoleCard,
  roleKind,
  type RoleValue,
  stepConsumers,
  type Target,
} from "../lib/colors.ts";
import { ConcernPage, Section } from "../components/Concern.tsx";
import { tokenValue } from "../lib/overview.ts";

/** Where a slot's commit lands: the authored `$value` when the slot is the
 * base slot, otherwise that mode's `$modes` restatement. */
function commitSlot(role: Role, slot: "light" | "dark"): "base" | "light" | "dark" {
  if (slot !== role.baseSlot) return slot;
  return "base";
}

function slotOf(role: Role | null | undefined, mode: string): RoleValue | null {
  if (!role) return null;
  return mode === "dark" ? role.dark ?? role.base : role.light ?? role.base;
}

function opaqueHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  return hex.length === 9 && hex.startsWith("#") ? hex.slice(0, 7) : hex;
}

function safeInk(
  preferredHex: string | null | undefined,
  bgHex: string | null | undefined,
): string | undefined {
  const bg = opaqueHex(bgHex);
  const fg = opaqueHex(preferredHex);
  if (!bg) return undefined;
  if (fg && contrastRatio(fg, bg) >= 4.55) {
    return fg;
  }
  return contrastInk(bg);
}

export default function ColorsPage() {
  const tree = createMemo(() => activeTree());
  const mode = createMemo(() => activeMode());
  const modes = createMemo(() => activeModes());
  const roles = createMemo(() => colorRoles(tree(), modes()));
  const floors = createMemo(() => measureFloors(themeText(), mode()));
  const targets = createMemo(() => colorTargets(tree(), mode()));
  const [editing, setEditing] = createSignal("");

  /** The role the inspector holds: the one pressed, or the first the theme has. */
  const editingRole = createMemo(() => {
    const all = roles();
    return all.find((role) => role.path === editing()) ?? all[0];
  });

  let picker: HTMLDivElement | undefined;

  function select(path: string): void {
    setEditing(path);
    if (!inDrawer()) return;
    picker?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <ConcernPage
      title="Colors"
      action={<ModeToggle />}
    >
      <div
        class={inDrawer()
          ? "stack-lg"
          : "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] [&>*]:min-w-0"}
      >
        <div class="stack-lg min-w-0">
          <For each={FAMILIES}>
            {(family, index) => {
              const cards = createMemo(() => familyCards(roles(), family));
              return (
                <Section
                  title={FAMILY_TITLES[family]}
                  fact={index() === 0 ? mode() : `${cards().length} cards`}
                >
                  <div class="grid gap-3 sm:grid-cols-2">
                    <For each={cards()}>
                      {(card) => (
                        <RoleCardView
                          card={card}
                          mode={mode()}
                          floors={floors()}
                          selectedPath={editingRole()?.path ?? ""}
                          onPick={select}
                        />
                      )}
                    </For>
                  </div>
                </Section>
              );
            }}
          </For>

          <Ramp />
          <InUse />
        </div>

        <div
          ref={picker}
          class="min-w-0"
          classList={{ "lg:sticky lg:top-4": !inDrawer() }}
        >
          <RolePicker
            role={editingRole()}
            allRoles={roles()}
            mode={mode()}
            floors={floors()}
            targets={targets()}
            onSelectRole={select}
          />
        </div>
      </div>
    </ConcernPage>
  );
}

function ModeToggle() {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, modePicker);
  createEffect(() =>
    ctl.bind(
      {
        value: activeMode(),
        modes: [...activeModes()],
        hideWhenSingle: activeModes().length <= 1,
      },
      {
        "value-change": (event: CustomEvent<{ value: string }>) => {
          const next = event.detail.value;
          if (next === "light" || next === "dark") setActiveMode(next);
        },
      },
    )
  );
  return (
    <studio-mode-picker
      ref={(el: HTMLElement) => setElement(el)}
      prop:value={activeMode()}
      prop:modes={[...activeModes()]}
      prop:hideWhenSingle={activeModes().length <= 1}
    />
  );
}

/**
 * The right-hand inspector: edits the selected role, lets paired Fill/Ink
 * roles flip in one click, and shows live contrast pairs with 1-click fixes.
 */
function RolePicker(props: {
  role: Role | undefined;
  allRoles: readonly Role[];
  mode: string;
  floors: readonly MeasuredFloor[];
  targets: readonly Target[];
  onSelectRole: (path: string) => void;
}) {
  const partnerRole = createMemo<Role | null>(() => {
    const role = props.role;
    if (!role) return null;
    const partnerPath = pairedInkPath(role.path) ?? pairedFillPath(role.path);
    if (!partnerPath) return null;
    return props.allRoles.find((r) => r.path === partnerPath) ?? null;
  });

  const fillAndInk = createMemo<{ fill: Role; ink: Role } | null>(() => {
    const role = props.role;
    const partner = partnerRole();
    if (!role || !partner) return null;
    return roleKind(role.path) === "on-ink"
      ? { fill: partner, ink: role }
      : { fill: role, ink: partner };
  });

  const owed = createMemo(() =>
    props.floors.filter((floor) => floor.fg === props.role?.path)
  );
  const carried = createMemo(() =>
    props.floors.filter((floor) => floor.bg === props.role?.path)
  );
  const pairs = createMemo(() => {
    const seen = new Set<string>();
    const list: MeasuredFloor[] = [];
    for (const floor of [...owed(), ...carried()]) {
      const key = `${floor.fg} on ${floor.bg}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(floor);
      }
    }
    return list;
  });

  const current = createMemo(() => slotOf(props.role, props.mode));
  const [fixing, setFixing] = createSignal<string | null>(null);

  createEffect(() => {
    const key = fixing();
    if (key === null) return;
    const floor = pairs().find((f) => `${f.fg} on ${f.bg}` === key);
    if (floor === undefined || floor.ratio >= floor.min) setFixing(null);
  });

  const refusal = createMemo(() => {
    const path = props.role?.path;
    if (!path) return undefined;
    return refusalFor(path) ?? lastRefusal();
  });

  return (
    <Show
      when={props.role}
      fallback={
        <p class="text-sm text-text-muted">
          This theme declares no colour roles yet.
        </p>
      }
    >
      {(role) => (
        <div
          class="stack rounded-md border border-border bg-surface-raised p-4"
          data-testid="color-inspector"
        >
          <div class="stack-sm">
            <div class="split">
              <h2 class="truncate text-lg font-semibold" title={role().path}>
                {humanName(role().path)}
              </h2>
              <span class="row-sm font-mono text-xs text-text-muted">
                <span class="truncate">{role().path}</span>
                <CopyButton text={role().path} label={`Copy ${role().path}`} />
              </span>
            </div>

            <Show when={fillAndInk()}>
              {(pair) => {
                const fillHex = () => slotOf(pair().fill, props.mode)?.hex ?? "";
                const inkHex = () => slotOf(pair().ink, props.mode)?.hex ?? "";
                const onFill = () => role().path === pair().fill.path;
                return (
                  <div
                    class="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1"
                    role="group"
                    aria-label="Paired role target"
                  >
                    <button
                      type="button"
                      class="bare flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left text-xs font-medium"
                      classList={{
                        "bg-surface-raised text-text shadow-sm": onFill(),
                        "text-text-muted hover:text-text": !onFill(),
                      }}
                      onClick={() => props.onSelectRole(pair().fill.path)}
                    >
                      <swatch class="s-sm" style={{ "--swatch": fillHex() }} aria-hidden="true" />
                      <span class="truncate">Fill · {humanName(pair().fill.path)}</span>
                    </button>
                    <button
                      type="button"
                      class="bare flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-left text-xs font-medium"
                      classList={{
                        "bg-surface-raised text-text shadow-sm": !onFill(),
                        "text-text-muted hover:text-text": onFill(),
                      }}
                      onClick={() => props.onSelectRole(pair().ink.path)}
                    >
                      <swatch class="s-sm" style={{ "--swatch": inkHex() }} aria-hidden="true" />
                      <span class="truncate">Ink · {humanName(pair().ink.path)}</span>
                    </button>
                  </div>
                );
              }}
            </Show>

            <InspectorSpecimen role={role()} mode={props.mode} current={current()} />
          </div>

          <Show when={current()}>
            {(value) => (
              <SlotEditor
                role={role()}
                mode={props.mode}
                value={value()}
                targets={props.targets}
              />
            )}
          </Show>

          <Show when={refusal()}>
            {(msg) => (
              <p
                role="alert"
                class="rounded-md border border-semantic-error bg-surface p-2 text-xs text-semantic-error"
              >
                {msg()}
              </p>
            )}
          </Show>

          <Show when={pairs().length > 0}>
            <div class="stack-sm border-t border-border pt-3">
              <span class="text-xs font-medium text-text-muted">Legibility checks</span>
              <div class="row-sm flex-wrap">
                <For each={pairs()}>
                  {(floor) => (
                    <PairChip
                      floor={floor}
                      mode={props.mode}
                      open={fixing() === `${floor.fg} on ${floor.bg}`}
                      onToggle={() => {
                        const key = `${floor.fg} on ${floor.bg}`;
                        setFixing(fixing() === key ? null : key);
                      }}
                    />
                  )}
                </For>
              </div>
              <Show when={fixing()}>
                {(key) => {
                  const floor = pairs().find((f) => `${f.fg} on ${f.bg}` === key());
                  return (
                    <Show when={floor !== undefined && floor.ratio < floor.min ? floor : undefined}>
                      {(failed) => (
                        <FloorFix
                          floor={failed()}
                          role={role()}
                          mode={props.mode}
                          onClose={() => setFixing(null)}
                        />
                      )}
                    </Show>
                  );
                }}
              </Show>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}

/**
 * Compact live specimen inside the inspector showing the selected role on its
 * actual ground without screaming giant hex text.
 */
function InspectorSpecimen(props: {
  role: Role;
  mode: string;
  current: RoleValue | null;
}) {
  const kind = () => roleKind(props.role.path);
  const hexOf = (path: string): string | null =>
    opaqueHex(toHex(tokenValue(activeTree(), props.mode, path)));
  const surfaceHex = () => hexOf("color.surface") ?? "#ffffff";
  const textHex = () => hexOf("color.text") ?? "#111111";

  const bg = createMemo(() => {
    const k = kind();
    if (k === "ink" || k === "stroke") return surfaceHex();
    if (k === "on-ink") {
      const fill = pairedFillPath(props.role.path);
      return (fill ? hexOf(fill) : null) ?? surfaceHex();
    }
    return opaqueHex(props.current?.hex) ?? surfaceHex();
  });

  const fg = createMemo(() => {
    const k = kind();
    const preferred = (() => {
      if (k === "ink" || k === "on-ink") return props.current?.hex ?? textHex();
      if (k === "stroke" || k === "surface") return textHex();
      const inkPath = pairedInkPath(props.role.path);
      return (inkPath ? hexOf(inkPath) : null) ?? contrastInk(bg());
    })();
    return safeInk(preferred, bg());
  });

  return (
    <div
      class="split rounded-md border border-border px-3 py-2"
      style={{
        background: bg(),
        color: fg(),
        "border-color": kind() === "stroke" ? (props.current?.hex ?? undefined) : undefined,
      }}
    >
      <div class="row-sm min-w-0">
        <span class="text-md font-bold">Aa</span>
        <span class="truncate text-xs font-medium">
          {humanName(props.role.path)}
        </span>
      </div>
      <Show when={props.current?.reference}>
        {(followed) => (
          <span class="truncate font-mono text-xs" title={`follows ${followed()}`}>
            → {humanName(followed())}
          </span>
        )}
      </Show>
    </div>
  );
}

function CopyButton(props: { text: string; label: string }) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      class="bare shrink-0 cursor-pointer p-0 opacity-80 hover:opacity-100"
      title={props.text}
      aria-label={props.label}
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
    >
      <Show
        when={copied()}
        fallback={<span class="i-lucide-copy icon-sm" aria-hidden="true" />}
      >
        <span class="i-lucide-check icon-sm" aria-hidden="true" />
      </Show>
    </button>
  );
}

function SlotEditor(props: {
  role: Role;
  mode: string;
  value: RoleValue;
  targets: readonly Target[];
}) {
  const slot = (): "light" | "dark" => props.mode === "dark" ? "dark" : "light";
  const name = () => humanName(props.role.path);
  function commit(value: string): boolean {
    return editToken(
      props.role.path.split("."),
      value,
      commitSlot(props.role, slot()),
    );
  }
  return (
    <div class="stack rounded-md border border-border bg-surface p-3">
      <div class="stack-sm">
        <span class="text-xs font-medium text-text-muted">Color</span>
        <div class="split">
          <ColorField
            bare
            id={`token-${props.role.path}-${slot()}`}
            label={`${props.role.path} value in ${slot()}`}
            value={props.value.hex ?? "#000000"}
            onCommit={(v) => commit(v)}
          />
          <CopyValue
            value={props.value.hex ?? ""}
            label={`Copy ${name()} value ${props.value.hex ?? ""}`}
          />
        </div>
      </div>

      <div class="stack-sm border-t border-border pt-3">
        <span class="text-xs font-medium text-text-muted">Theme swatch</span>
        <ReferencePicker
          targets={props.targets.filter((t) => t.path !== props.role.path)}
          current={props.value.reference}
          ownHex={props.value.hex ?? ""}
          onPick={(path) => commit(`{${path}}`)}
          onUnlink={() => {
            if (props.value.hex !== null) commit(props.value.hex);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Single labeled hex copy control inside the inspector: quiet mono text + copy icon.
 */
function CopyValue(props: { value: string; label: string }) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      class="bare relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 font-mono text-xs text-text hover:bg-surface-sunken"
      title={`Copy ${props.value}`}
      aria-label={props.label}
      onClick={(e) => {
        e.stopPropagation();
        void copy();
      }}
    >
      <Show when={copied()} fallback={<span>{props.value}</span>}>
        <span>copied</span>
      </Show>
      <span class="i-lucide-copy icon-sm text-text-muted" aria-hidden="true" />
    </button>
  );
}

/**
 * A role card in the family grid.
 *
 * - Fill cards (`Primary`, `Accent`, `Success`, `Disabled`, …) paint the card
 *   with the fill and write the specimen in the actual paired `On *` ink,
 *   including a direct sub-target pill for `On *` and the live contrast badge.
 * - Surface cards (`Surface`, `Surface Raised`, …) wear `Text` and `Text Muted`.
 * - Ink cards (`Text`, `Text Muted`, `Link`) sit on `Surface` so their text
 *   legibility is visible directly.
 * - Stroke cards (`Border`, `Border Strong`, `Focus Ring`) frame a sample box
 *   on `Surface`.
 */
function RoleCardView(props: {
  card: RoleCard;
  mode: string;
  floors: readonly MeasuredFloor[];
  selectedPath: string;
  onPick: (path: string) => void;
}) {
  const role = () => props.card.role;
  const inkRole = () => props.card.ink;
  const kind = () => roleKind(role().path);

  const current = createMemo(() => slotOf(role(), props.mode));
  const inkCurrent = createMemo(() => slotOf(inkRole(), props.mode));

  const selectedFill = () => props.selectedPath === role().path;
  const selectedInk = () => inkRole() !== null && props.selectedPath === inkRole()!.path;
  const selectedAny = () => selectedFill() || selectedInk();

  const hexOf = (path: string): string | null =>
    opaqueHex(toHex(tokenValue(activeTree(), props.mode, path)));
  const surfaceVal = createMemo(() => hexOf("color.surface") ?? "#ffffff");
  const surfaceRaisedVal = createMemo(() =>
    hexOf("color.surface-raised") ?? surfaceVal()
  );
  const textVal = createMemo(() => hexOf("color.text") ?? "#111111");
  const textMutedVal = createMemo(() =>
    hexOf("color.text-muted") ?? textVal()
  );

  const cardBg = createMemo(() => {
    const k = kind();
    if (k === "ink" || k === "stroke") return surfaceVal();
    if (k === "on-ink") {
      const fill = pairedFillPath(role().path);
      return (fill ? hexOf(fill) : null) ?? surfaceVal();
    }
    return opaqueHex(current()?.hex) ?? surfaceVal();
  });

  const cardInk = createMemo(() => {
    const k = kind();
    if (k === "fill") {
      return safeInk(inkCurrent()?.hex, cardBg());
    }
    if (k === "on-ink") {
      return safeInk(current()?.hex, cardBg());
    }
    return safeInk(textVal(), cardBg());
  });

  /** The primary contrast floor this card demonstrates. */
  const primaryFloor = createMemo<MeasuredFloor | null>(() => {
    const ink = inkRole();
    if (ink) {
      const exact = props.floors.find(
        (f) => f.fg === ink.path && f.bg === role().path
      );
      if (exact) return exact;
    }
    const owed = props.floors.filter((f) => f.fg === role().path);
    if (owed.length > 0) {
      return owed.reduce((a, b) => (a.ratio / a.min < b.ratio / b.min ? a : b));
    }
    const carried = props.floors.filter((f) => f.bg === role().path);
    if (carried.length > 0) {
      return carried.reduce((a, b) => (a.ratio / a.min < b.ratio / b.min ? a : b));
    }
    return null;
  });

  const liveRatio = createMemo<number | null>(() => {
    const f = primaryFloor();
    if (f) return f.ratio;
    const c = current()?.hex;
    if (!c) return null;
    if (kind() === "surface") {
      const t = tokenValue(activeTree(), props.mode, "color.text");
      return t ? contrastRatio(t, c) : null;
    }
    return null;
  });

  const [fixing, setFixing] = createSignal(false);
  createEffect(() => {
    const f = primaryFloor();
    if (!f || f.ratio >= f.min) setFixing(false);
  });

  const name = () => humanName(role().path);
  const other = (): "light" | "dark" | null =>
    props.mode === "dark"
      ? (role().light === null ? null : "light")
      : (role().dark === null ? null : "dark");
  const otherValue = (): string | null => {
    const slot = other();
    if (slot === null) return null;
    const value = slot === "dark" ? role().dark : role().light;
    return value?.hex ?? null;
  };

  return (
    <div
      class="relative flex flex-col justify-between gap-3 rounded-md border border-border p-3 transition-colors"
      classList={{
        "border-primary border-2 shadow-lg": selectedAny(),
      }}
      style={{
        background: cardBg(),
        color: cardInk(),
      }}
    >
      {/* Whole-card click selects the primary role */}
      <button
        type="button"
        class="bare absolute inset-0 z-0 cursor-pointer"
        title={`Edit ${name()}`}
        aria-label={`Edit ${name()}`}
        aria-current={selectedFill() ? "true" : undefined}
        onClick={() => props.onPick(role().path)}
      />
      {/* Top row: Role Name + Quiet Metadata */}
      <div class="split">
        <div class="row-sm min-w-0">
          <Show when={kind() === "ink" || kind() === "stroke"}>
            <swatch
              class="s-md shrink-0"
              style={{ "--swatch": current()?.hex ?? "" }}
              aria-hidden="true"
            />
          </Show>
          <span class="truncate text-md font-semibold" title={role().path}>
            {name()}
          </span>
        </div>
        <Show
          when={current()?.reference}
          fallback={
            <span class="shrink-0 font-mono text-xs">
              {current()?.hex ?? ""}
            </span>
          }
        >
          {(followed) => (
            <span
              class="shrink-0 truncate font-mono text-xs"
              title={`Follows ${followed()} (${current()?.hex ?? ""})`}
            >
              → {humanName(followed())}
            </span>
          )}
        </Show>
      </div>

      {/* Middle row: Live Legibility Specimen */}
      <div class="split gap-2 py-1">
        <Show when={kind() === "fill"}>
          <div class="row-sm min-w-0">
            <span class="text-xl font-bold">Aa</span>
            <span class="truncate text-sm font-medium">
              {inkRole() ? `${humanName(inkRole()!.path)} ink` : "Sample text"}
            </span>
          </div>
        </Show>

        <Show when={kind() === "surface"}>
          <div class="stack-xs min-w-0">
            <span class="truncate text-sm font-semibold" style={{ color: safeInk(textVal(), cardBg()) }}>
              Aa — Text on {name()}
            </span>
            <span class="truncate text-xs" style={{ color: safeInk(textMutedVal(), cardBg()) }}>
              Muted text specimen
            </span>
          </div>
        </Show>

        <Show when={kind() === "ink" || kind() === "on-ink"}>
          <div
            class="row-sm min-w-0"
            style={{ color: safeInk(current()?.hex, cardBg()) }}
          >
            <span
              class="text-xl font-bold"
              classList={{ underline: role().path === "color.link" }}
            >
              Aa
            </span>
            <span
              class="truncate text-sm font-medium"
              classList={{ underline: role().path === "color.link" }}
            >
              {name()} on Surface
            </span>
          </div>
        </Show>

        <Show when={kind() === "stroke"}>
          <div
            class="w-full rounded-md border-2 border-solid px-3 py-1 text-xs font-medium"
            style={{
              "border-color": current()?.hex ?? undefined,
              background: surfaceRaisedVal(),
              color: safeInk(textVal(), surfaceRaisedVal()),
            }}
          >
            Framed with {name()}
          </div>
        </Show>

        <Show
          when={primaryFloor()}
          fallback={
            <Show when={liveRatio()}>
              {(ratio) => (
                <span
                  class="shrink-0 rounded-sm border border-current px-2 py-1 font-mono text-xs font-semibold"
                  title={`Text on ${name()} · ${ratio().toFixed(2)}:1`}
                >
                  {ratio().toFixed(1)}:1 ✓
                </span>
              )}
            </Show>
          }
        >
          {(floor) => {
            const holds = () => floor().ratio >= floor().min;
            return (
              <button
                type="button"
                class="bare relative z-10 shrink-0 cursor-pointer rounded-sm border px-2 py-1 font-mono text-xs font-semibold"
                classList={{
                  "border-current": holds(),
                  "border-semantic-error bg-semantic-error text-on-semantic-error": !holds(),
                }}
                title={`${humanName(floor().fg)} on ${humanName(floor().bg)} · ${floor().ratio.toFixed(2)}:1 (floor ${floor().min}:1)`}
                aria-label={
                  holds()
                    ? `${humanName(floor().fg)} on ${humanName(floor().bg)} · ${floor().ratio.toFixed(1)}:1 of ${floor().min}:1`
                    : `${humanName(floor().fg)} on ${humanName(floor().bg)} · ${floor().ratio.toFixed(1)}:1 of ${floor().min}:1. Show the fix.`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (!holds()) setFixing(!fixing());
                  else props.onPick(role().path);
                }}
              >
                {holds()
                  ? `${floor().ratio.toFixed(1)}:1 ✓`
                  : `${floor().ratio.toFixed(1)}:1 < ${floor().min} · Fix`}
              </button>
            );
          }}
        </Show>
      </div>

      {/* In-card FloorFix when failing contrast badge is clicked */}
      <Show when={fixing() && primaryFloor() && primaryFloor()!.ratio < primaryFloor()!.min ? primaryFloor() : undefined}>
        {(failed) => (
          <div class="relative z-10">
            <FloorFix
              floor={failed()}
              role={role()}
              mode={props.mode}
              onClose={() => setFixing(false)}
            />
          </div>
        )}
      </Show>

      {/* Bottom row: Paired Ink selector + Other-mode switch */}
      <div class="split border-t border-current/20 pt-2 text-xs">
        <Show
          when={inkRole()}
          fallback={
            <span class="truncate">
              <Show
                when={primaryFloor()}
                fallback={
                  <span>
                    {kind() === "surface" ? `Carries Text & Border` : `On Surface`}
                  </span>
                }
              >
                {(floor) => (
                  <span>
                    Floor {floor().min}:1 on {humanName(floor().bg)}
                  </span>
                )}
              </Show>
            </span>
          }
        >
          {(ink) => (
            <button
              type="button"
              class="bare relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-sm border px-2 py-1 text-xs font-medium"
              classList={{
                "border-current": selectedInk(),
                "border-transparent hover:border-current": !selectedInk(),
              }}
              title={`Edit ${humanName(ink().path)} (${inkCurrent()?.hex ?? ""})`}
              aria-label={`Edit ${humanName(ink().path)}`}
              aria-current={selectedInk() ? "true" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                props.onPick(ink().path);
              }}
            >
              <swatch
                class="s-sm"
                style={{ "--swatch": inkCurrent()?.hex ?? "" }}
                aria-hidden="true"
              />
              <span class="truncate">Ink: {humanName(ink().path)}</span>
            </button>
          )}
        </Show>

        <Show when={otherValue()}>
          {(hex) => (
            <button
              type="button"
              class="bare relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm px-1 py-1 text-xs"
              title={`Switch to ${other() ?? ""} mode (${hex()})`}
              aria-label={`Show ${name()} in ${other() ?? ""} mode`}
              onClick={(e) => {
                e.stopPropagation();
                if (other() !== null) setActiveMode(other()!);
              }}
            >
              <span class="uppercase">{other()}</span>
              <swatch class="s-sm" style={{ "--swatch": hex() }} aria-hidden="true" />
            </button>
          )}
        </Show>
      </div>

    </div>
  );
}

function PairChip(props: {
  floor: MeasuredFloor;
  mode: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [numbers, setNumbers] = createSignal(false);
  const holds = () => props.floor.ratio >= props.floor.min;
  const bg = createMemo(() => opaqueHex(toHex(tokenValue(activeTree(), props.mode, props.floor.bg))) ?? "#ffffff");
  const ink = createMemo(() => opaqueHex(toHex(tokenValue(activeTree(), props.mode, props.floor.fg))) ?? "#111111");
  const ratio = () => `${props.floor.ratio.toFixed(1)} of ${props.floor.min}`;
  const label = () =>
    `${humanName(props.floor.fg)} on ${humanName(props.floor.bg)} · ${props.floor.ratio.toFixed(2)}:1 of ${props.floor.min}:1`;
  return (
    <button
      type="button"
      class="bare relative z-10 shrink-0 cursor-pointer rounded-sm border border-border p-0"
      classList={{ "border-semantic-error border-2": !holds() }}
      style={{ background: bg() }}
      title={label()}
      aria-label={holds() ? label() : `${label()}. Show the fix.`}
      aria-expanded={props.open}
      onClick={(e) => {
        e.stopPropagation();
        setNumbers(!numbers());
        if (!holds()) props.onToggle();
      }}
    >
      <span class="row-sm px-2 py-1 text-xs font-medium" style={{ color: safeInk(ink(), bg()) }}>
        <swatch class="s-sm" style={{ "--swatch": ink() }} aria-hidden="true" />
        <span class="truncate">{humanName(props.floor.fg)} on {humanName(props.floor.bg)}</span>
        <Show when={numbers()} fallback={<span>{props.floor.ratio.toFixed(1)}:1</span>}>
          <span>{ratio()}</span>
        </Show>
      </span>
    </button>
  );
}

function FloorFix(props: {
  floor: MeasuredFloor;
  role: Role;
  mode: string;
  onClose: () => void;
}) {
  const slot = (): "light" | "dark" => props.mode === "dark" ? "dark" : "light";
  return (
    <div class="stack-sm rounded-md border border-border bg-surface p-3 text-text">
      <div class="split text-xs">
        <span>
          {humanName(props.floor.fg)} on {humanName(props.floor.bg)} is {props.floor.ratio.toFixed(2)}:1 — needs {props.floor.min}:1.
        </span>
        <button
          type="button"
          class="bare relative z-10 shrink-0 cursor-pointer p-0 opacity-80 hover:opacity-100"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
          }}
        >
          <span class="i-lucide-x icon-sm" aria-hidden="true" />
        </button>
      </div>
      <Show
        when={props.floor.remedy !== null}
        fallback={
          <span class="text-xs text-text-muted">No automatic fix — adjust the background fill first.</span>
        }
      >
        <button
          type="button"
          class="bare relative z-10 shrink-0 cursor-pointer justify-start p-0 text-left text-xs font-medium text-text"
          title={`Set ${props.floor.fg} to ${props.floor.remedy}`}
          onClick={(e) => {
            e.stopPropagation();
            editToken(
              props.floor.fg.split("."),
              props.floor.remedy as string,
              commitSlot(props.role, slot()),
            );
          }}
        >
          <span class="row-sm">
            <swatch class="s-sm" style={{ "--swatch": props.floor.remedy ?? "" }} aria-hidden="true" />
            <span class="underline">Use {humanName(props.floor.fg)} {props.floor.remedy}</span>
          </span>
        </button>
      </Show>
    </div>
  );
}

function Ramp() {
  const mode = createMemo(() => activeMode());
  const steps = createMemo(() => neutralRamp(activeTree()));
  const consumers = createMemo(() => stepConsumers(activeTree(), mode()));
  const [open, setOpen] = createSignal(false);
  const [custom, setCustom] = createSignal<string | null>(null);
  const valueInMode = (step: { light: string | null; dark: string | null }): string | null =>
    mode() === "dark" ? step.dark ?? step.light : step.light;
  const base = () =>
    custom() ?? valueInMode(steps().find((step) => step.step === "500") ?? { light: null, dark: null })
      ?? "#808080";
  const scale = createMemo<string[]>(() => {
    try {
      return generateScale(base(), steps().length);
    } catch {
      return [];
    }
  });
  const usedBy = (path: string): string => {
    const names = consumers().get(path) ?? [];
    return names.length > 0 ? `Used by ${names.join(", ")}` : "Unused step";
  };
  return (
    <Section
      title="Neutral ramp"
      fact={`${steps().length} steps`}
      info="The numbered grey scale that Surface, Border, and Text tokens reference. Rebuild regenerates all steps from one mid-tone seed."
      aside={
        <button
          type="button"
          class="secondary s-sm"
          aria-expanded={open()}
          onClick={() => setOpen(!open())}
        >
          {open() ? "Close rebuild" : "Rebuild from seed…"}
        </button>
      }
    >
      <div class="stack rounded-md border border-border bg-surface-raised p-3">
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <For each={steps()}>
              {(step) => {
                const rolesUsing = () => consumers().get(step.path) ?? [];
                return (
                  <div
                    class="stack-xs rounded-sm border border-border bg-surface p-1"
                    title={`${step.step} · ${valueInMode(step) ?? ""} — ${usedBy(step.path)}`}
                  >
                    <div
                      class="h-8 w-full rounded-sm border border-border"
                      classList={{ "opacity-60": rolesUsing().length === 0 }}
                      style={{ background: valueInMode(step) ?? "" }}
                    />
                    <div class="split px-1">
                      <span class="font-mono text-xs font-semibold text-text">
                        {step.step}
                      </span>
                      <span class="truncate text-xs text-text-muted">
                        {rolesUsing()[0] ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        <Show when={open()}>
          <div class="split flex-wrap gap-2 border-t border-border pt-2">
            <div class="row-sm">
              <span class="text-xs text-text-muted">Seed hue</span>
              <ColorField
                bare
                value={base()}
                onCommit={(v) => {
                  setCustom(v);
                  return true;
                }}
              />
            </div>
            <button
              type="button"
              class="secondary s-sm"
              title={`Repaints ${steps().map((s) => s.step).join(", ")} from ${base()}`}
              onClick={() => {
                const names = steps().map((step) => step.step);
                scale().forEach((hex, index) => {
                  const name = names[index];
                  if (name !== undefined) {
                    editToken(["color", "neutral", name], hex);
                  }
                });
                setCustom(null);
              }}
            >
              Rebuild ramp
            </button>
          </div>
        </Show>
      </div>
    </Section>
  );
}

function InUse() {
  return (
    <Section title="Palette in use">
      <div class="row-sm flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-4">
        <button type="button">Primary</button>
        <button type="button" class="danger">Danger</button>
        <badge variant="success">Success</badge>
        <badge variant="warning">Warning</badge>
        <a href="#link">Link</a>
      </div>
    </Section>
  );
}
