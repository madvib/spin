import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotFileUpload,
  type FileUploadApi,
  type FileUploadConnectProps,
} from "./file-upload.connect.ts";
import {
  config,
  implementations,
  type FileRecord,
  type FileRejection,
  type FileUploadContext,
  type FileUploadEvent,
  type FileUploadValueChange,
} from "./file-upload.machine.ts";

export type { FileRecord, FileRejection, FileUploadValueChange };

/** An authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/**
 * The JSON transport for a seeded selection: `[{"name":"a.png","size":4,
 * "type":"image/png"}]`. Live files cannot travel as attributes; the
 * seeded channel carries their records.
 */
const parseFiles = (raw: unknown): FileRecord[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const files: FileRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const name = bag["name"];
    const size = bag["size"];
    const type = bag["type"];
    if (typeof name !== "string" || typeof size !== "number") continue;
    files.push({ name, size, type: typeof type === "string" ? type : "" });
  }
  return files;
};

const readInt = (props: Record<string, unknown>, name: string): number => {
  const value = props[name];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

/**
 * The file-upload bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from the authored `value` (or
 * `defaultValue`), alternate the controlled `value`, sync the scalars the
 * assigns read (the validation rules and `multiple`), and publish the
 * connect api through the live-view proxy.
 *
 * The change callback fires from one funnel after every send — the fork's
 * send is synchronous, so a "before" snapshot is the only honest diff.
 */
export function createFileUploadBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: FileUploadApi; dispose(): void } {
  void root;
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<FileUploadContext, FileUploadEvent>(config, implementations);

  let service: Service<FileUploadContext, FileUploadEvent> | undefined;

  const ensureService = (): Service<FileUploadContext, FileUploadEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two dropzones on a page would
      // otherwise share one context until the first drop.
      svc.send({ type: "VALUE.CLEAR" });
      svc.state.context.multiple = p["multiple"] === true;
      svc.state.context.accept = typeof p["accept"] === "string" ? p["accept"] : "";
      svc.state.context.maxFiles = readInt(p, "maxFiles");
      svc.state.context.maxSize = readInt(p, "maxSize");
      svc.state.context.minSize = readInt(p, "minSize");
      svc.state.context.disabled = p["disabled"] === true;
      const seeded = parseFiles(authored(props, "value") ? p["value"] : p["defaultValue"]);
      if (seeded !== null) svc.send({ type: "VALUE.SET", files: seeded });
      return svc;
    });
    return service;
  };

  /** The behavioural props, read per connect call: the connect is
   * long-lived, so a snapshot would freeze the first read's values inside
   * the handlers it caches. */
  const readConnectProps = (): FileUploadConnectProps => {
    const p = props();
    const label = p["label"];
    return {
      label: typeof label === "string" ? label : "",
      disabled: p["disabled"] === true,
    };
  };

  function send(event: FileUploadEvent): void {
    const svc = ensureService();
    const beforeAccepted = svc.state.context.acceptedFiles.map((file) => file.name).join(",");
    const beforeRejected = svc.state.context.rejectedFiles.map((item) => `${item.file.name}:${item.code}`)
      .join(",");
    svc.send(event);
    const after = svc.state.context;
    if (after.acceptedFiles.map((file) => file.name).join(",") !== beforeAccepted ||
      after.rejectedFiles.map((item) => `${item.file.name}:${item.code}`).join(",") !== beforeRejected) {
      (props()["onValueChange"] as ((d: FileUploadValueChange) => void) | undefined)?.({
        acceptedFiles: after.acceptedFiles,
        rejectedFiles: after.rejectedFiles,
      });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  ensureService();

  /** One connect per element, not one per machine move. */
  let uploadConnect: FileUploadApi | undefined;
  const ensureConnect = (): FileUploadApi => {
    uploadConnect ??= connectRobotFileUpload(
      {
        send,
        get context(): FileUploadContext {
          return ensureService().state.context;
        },
        get focused(): boolean {
          return ensureService().state.value === "focused";
        },
        get dragging(): boolean {
          return ensureService().state.value === "dragging";
        },
      },
      readConnectProps,
      id,
      root,
    );
    return uploadConnect;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      svc.state.context.multiple = p["multiple"] === true;
      svc.state.context.accept = typeof p["accept"] === "string" ? p["accept"] : "";
      svc.state.context.maxFiles = readInt(p, "maxFiles");
      svc.state.context.maxSize = readInt(p, "maxSize");
      svc.state.context.minSize = readInt(p, "minSize");
      svc.state.context.disabled = p["disabled"] === true;
      if (authored(props, "value")) {
        const outer = parseFiles(p["value"]) ?? [];
        const inner = svc.state.context.acceptedFiles.map((file) => file.name);
        if (outer.map((file) => file.name).join(",") !== inner.join(",")) {
          untrack(() => send({ type: "VALUE.SET", files: outer }));
        }
      }
    }),
  );

  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as FileUploadApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
