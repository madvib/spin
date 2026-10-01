import { Show } from "solid-js";
import { formatHex, parseColor } from "@spin/theme";

function asHex(value: string): string | undefined {
  try {
    return formatHex(parseColor(value));
  } catch {
    return undefined;
  }
}

export default function ValueInput(props: {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const hex = () => asHex(props.value);
  return (
    <Show
      when={hex()}
      fallback={
        <input
          class="text-sm p-2 border border-border rounded-md"
          type="text"
          value={props.value}
          placeholder={props.placeholder}
          onChange={(event) => {
            if (event.currentTarget.value.trim() !== "" || !props.placeholder) {
              props.onCommit(event.currentTarget.value);
            }
          }}
        />
      }
    >
      {(current) => (
        <>
          <input
            type="color"
            value={current()}
            onChange={(event) => props.onCommit(event.currentTarget.value)}
          />
          <code>{props.value}</code>
        </>
      )}
    </Show>
  );
}
