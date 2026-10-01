import { createSignal } from "solid-js";

/**
 * The one interactive demo: a box that moves when asked. Motion is the only
 * utility family a static sample cannot show, so it keeps a play rig. Every
 * other family renders statically through Sample.
 */
export default function PlayRig(props: { utility: string }) {
  const [on, setOn] = createSignal(false);
  const companions = () => {
    if (props.utility.startsWith("transition-")) return "duration-base";
    if (props.utility.startsWith("duration-")) return "transition-colors";
    return "transition-colors duration-base";
  };
  return (
    <div>
      <button type="button" onClick={() => setOn(!on())}>
        {on() ? "reset" : "play"}
      </button>
      <div
        class={`h-8 w-full ${
          on() ? "bg-secondary" : "bg-primary"
        } ${companions()} ${props.utility}`}
      />
    </div>
  );
}
