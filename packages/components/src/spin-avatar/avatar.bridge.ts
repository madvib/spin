import {
  defineBridge,
  pickCallback,
  textProp,
  type BridgeHooks,
  type BridgeSpec,
} from "@spin/runtime";
import {
  config,
  implementations,
  type AvatarContext,
  type AvatarEvent,
  type AvatarStatusChange,
} from "./avatar.machine.ts";
import {
  connectAvatar,
  type AvatarApi,
  type AvatarConnectProps,
  type AvatarService,
} from "./avatar.connect.ts";

/**
 * The avatar bridge: scope values in, machine state out.
 *
 * Seed the src from `defaultSrc`; alternate the one authored channel
 * (`src`) against a remembered shadow. A src change — authored or
 * observed on the node — returns the machine to loading; load and error
 * report through `status-change`. The callbacks live on the props surface
 * — the def maps them to CustomEvents.
 */

export interface AvatarCallbacks {
  readonly onStatusChange: ((details: AvatarStatusChange) => void) | undefined;
}

const spec: BridgeSpec<
  AvatarContext,
  AvatarEvent,
  AvatarApi,
  AvatarConnectProps,
  AvatarCallbacks
> = {
  config,
  implementations,
  startState: "loading",
  hooks: (): BridgeHooks<
    AvatarContext,
    AvatarEvent,
    AvatarApi,
    AvatarConnectProps,
    AvatarCallbacks
  > => {
    /** What the src channel last imposed, seeded from the same place the
     * machine was, so a host that authors the seeded value writes nothing. */
    let lastSrc = "";
    let lastStatus = "";
    return {
      seed: (props, authored) => {
        const seeded = textProp(authored("src") ? props()["src"] : props()["defaultSrc"]);
        lastSrc = seeded;
        lastStatus = "loading";
        return { src: seeded };
      },
      sync: (svc, props, authored, send) => {
        if (!authored("src")) return false;
        const outer = textProp(props()["src"]);
        if (lastSrc === outer) return false;
        send({ type: "SRC.CHANGE", src: outer });
        return true;
      },
      notify: (svc, callbacks) => {
        const after = svc.state.context;
        const status = svc.state.value;
        if (lastSrc !== after.src) lastSrc = after.src;
        if (lastStatus !== status) {
          lastStatus = status;
          callbacks.onStatusChange?.({ status: status as AvatarStatusChange["status"] });
        }
      },
      readCallbacks: (props) => ({
        onStatusChange: pickCallback<(d: AvatarStatusChange) => void>(props(), "onStatusChange"),
      }),
      readConnectProps: (props) => {
        const p = props();
        return {
          dir: p["dir"] === "rtl" ? "rtl" : "ltr",
          label: textProp(p["label"]),
          fallbackLabel: textProp(p["fallback"]) || textProp(p["label"]) || "avatar",
        };
      },
      connect: (service: AvatarService, readProps, id) => connectAvatar(service, readProps, id),
    };
  },
};

export function createAvatarBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: AvatarApi; dispose(): void } {
  return defineBridge(spec, props, id);
}
