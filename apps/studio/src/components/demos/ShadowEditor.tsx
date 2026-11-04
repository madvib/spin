import { createEffect, createSignal, on, Show } from "solid-js";
import { createSpinComponent } from "@spinjs/components/solid";
import { colorPicker } from "@spinjs/components/color-picker";
import { formatHex, parseColor } from "@spinjs/spin/theme";

/**
 * A shadow is four lengths, a colour swatch picker, and an opacity percentage.
 * Every shadow color is normalized into hex + alpha% so rows never mix raw
 * `rgb(...)`, `oklch(...)`, and `#hex` text boxes.
 */
export default function ShadowEditor(props: {
  value: string;
  onCommit: (value: string) => boolean;
}) {
  const parsed = () => parse(props.value);
  const [draft, setDraft] = createSignal(parsed());

  createEffect(on(() => props.value, (value) => setDraft(parse(value))));

  function commit(next: ShadowParts) {
    const color = formatShadowColor(next.hex, next.alpha);
    const value = `${next.x} ${next.y} ${next.blur} ${next.spread} ${color}`;
    if (!props.onCommit(value)) setDraft(parse(props.value));
  }

  function stepKey(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
    key: "x" | "y" | "blur" | "spread",
  ) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const dir = e.key === "ArrowUp" ? 1 : -1;
    const raw = draft()[key].trim();
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/);
    if (!m) return;
    const unit = m[2] || (Number(m[1]) === 0 ? "px" : "");
    const step = unit === "rem" ? 0.125 : 1;
    let nextNum = Number((Number(m[1]) + dir * step).toFixed(4));
    if (key === "blur" && nextNum < 0) nextNum = 0;
    const nextVal = nextNum === 0 ? "0" : `${nextNum}${unit || "px"}`;
    commit({ ...draft(), [key]: nextVal });
  }

  function stepAlpha(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const dir = e.key === "ArrowUp" ? 1 : -1;
    const nextAlpha = Math.max(0, Math.min(100, draft().alpha + dir * 5));
    commit({ ...draft(), alpha: nextAlpha });
  }

  const isNone = () => props.value.trim() === "none";

  return (
    <div class="row-sm flex-wrap items-center gap-2">
      <Show
        when={!isNone()}
        fallback={
          <>
            <span class="rounded-sm bg-surface-sunken px-2 py-1 font-mono text-xs text-text-muted">
              none
            </span>
            <button
              type="button"
              class="secondary s-sm min-h-0 cursor-pointer px-2 py-1 font-mono text-xs font-regular normal-case tracking-normal shadow-none hover:border-primary"
              onClick={() =>
                props.onCommit("0 4px 12px 0 rgb(0 0 0 / 0.12)")
              }
            >
              + shadow
            </button>
          </>
        }
      >
        <label class="row-sm items-center gap-1 font-mono text-xs text-text-muted">
          <span>x</span>
          <input
            type="text"
            class="w-12 px-1 text-center font-mono text-xs tabular-nums"
            value={draft().x}
            onKeyDown={(e) => stepKey(e, "x")}
            onChange={(e) => commit({ ...draft(), x: e.currentTarget.value })}
          />
        </label>
        <label class="row-sm items-center gap-1 font-mono text-xs text-text-muted">
          <span>y</span>
          <input
            type="text"
            class="w-12 px-1 text-center font-mono text-xs tabular-nums"
            value={draft().y}
            onKeyDown={(e) => stepKey(e, "y")}
            onChange={(e) => commit({ ...draft(), y: e.currentTarget.value })}
          />
        </label>
        <label class="row-sm items-center gap-1 font-mono text-xs text-text-muted">
          <span>blur</span>
          <input
            type="text"
            class="w-12 px-1 text-center font-mono text-xs tabular-nums"
            value={draft().blur}
            onKeyDown={(e) => stepKey(e, "blur")}
            onChange={(e) =>
              commit({ ...draft(), blur: e.currentTarget.value })
            }
          />
        </label>
        <label class="row-sm items-center gap-1 font-mono text-xs text-text-muted">
          <span>spread</span>
          <input
            type="text"
            class="w-12 px-1 text-center font-mono text-xs tabular-nums"
            value={draft().spread}
            onKeyDown={(e) => stepKey(e, "spread")}
            onChange={(e) =>
              commit({ ...draft(), spread: e.currentTarget.value })
            }
          />
        </label>
        <ShadowColorSwatch
          value={draft().hex}
          onCommit={(hex) => commit({ ...draft(), hex })}
        />
        <label class="row-sm items-center gap-1 font-mono text-xs text-text-muted">
          <span>α</span>
          <input
            type="text"
            aria-label="Shadow opacity"
            class="w-12 px-1 text-center font-mono text-xs tabular-nums"
            value={`${draft().alpha}%`}
            onKeyDown={stepAlpha}
            onChange={(e) => {
              const raw = Number.parseFloat(
                e.currentTarget.value.replace("%", "").trim(),
              );
              if (!Number.isFinite(raw)) return;
              const nextAlpha = raw <= 1 && !e.currentTarget.value.includes("%")
                ? Math.round(raw * 100)
                : Math.round(raw);
              commit({
                ...draft(),
                alpha: Math.max(0, Math.min(100, nextAlpha)),
              });
            }}
          />
        </label>
        <button
          type="button"
          class="bare px-1 font-mono text-xs font-regular normal-case tracking-normal text-text-muted hover:text-text"
          title="Remove shadow (set to none)"
          onClick={() => props.onCommit("none")}
        >
          none
        </button>
      </Show>
    </div>
  );
}

function ShadowColorSwatch(props: {
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [element, setElement] = createSignal<HTMLElement>();
  const ctl = createSpinComponent(element, colorPicker);
  createEffect(() =>
    ctl.bind(
      { value: props.value, format: "hex" },
      {
        "value-change-end": (event: CustomEvent<{ value: string }>) => {
          props.onCommit(event.detail.value);
        },
      },
    ),
  );
  return (
    <studio-color-picker
      ref={(el: HTMLElement) => setElement(el)}
      prop:value={props.value}
      prop:format="hex"
    />
  );
}

interface ShadowParts {
  x: string;
  y: string;
  blur: string;
  spread: string;
  hex: string;
  alpha: number;
}

function parseShadowColor(raw: string): { hex: string; alpha: number } {
  try {
    const c = parseColor(raw);
    return {
      hex: formatHex(c, false),
      alpha: Math.round((c.a ?? 1) * 100),
    };
  } catch {
    return { hex: "#000000", alpha: 12 };
  }
}

function formatShadowColor(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(alpha)));
  try {
    const c = parseColor(hex);
    if (clamped >= 100) return formatHex(c, false);
    const a = Number((clamped / 100).toFixed(2));
    return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)} / ${a})`;
  } catch {
    return hex;
  }
}

function parse(value: string): ShadowParts {
  if (value.trim() === "none") {
    return {
      x: "0",
      y: "0",
      blur: "0",
      spread: "0",
      hex: "#000000",
      alpha: 12,
    };
  }
  const match = value.trim().match(
    /^\s*(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?)\s+(\d+(?:\.\d+)?(?:px|rem|em|%)?)(?:\s+(-?\d+(?:\.\d+)?(?:px|rem|em|%)?))?\s+((?:#|rgb|hsl|oklch|var\(|color\(|[a-zA-Z]).*)$/,
  );
  if (!match) {
    return {
      x: "0",
      y: "4px",
      blur: "8px",
      spread: "0",
      hex: "#000000",
      alpha: 10,
    };
  }
  const { hex, alpha } = parseShadowColor(match[5]!.trim());
  return {
    x: match[1]!,
    y: match[2]!,
    blur: match[3]!,
    spread: match[4] ?? "0",
    hex,
    alpha,
  };
}
