/**
 * The slice of the Chrome DevTools Protocol this oracle needs: one browser
 * socket, flat sessions, and the commands a visual check issues.
 *
 * Written by hand rather than pulled from a client library because the oracle
 * is the only consumer, and because a dependency here would make a local
 * visual check depend on a package manager.
 */

interface PendingCommand {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

type EventHandler = (params: Record<string, unknown>) => void;

/** One flattened CDP session: a page, with its own event stream. */
export class CdpSession {
  readonly #socket: CdpSocket;
  readonly #sessionId: string;
  readonly #handlers = new Map<string, Set<EventHandler>>();

  constructor(socket: CdpSocket, sessionId: string) {
    this.#socket = socket;
    this.#sessionId = sessionId;
  }

  get id(): string {
    return this.#sessionId;
  }

  command<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.#socket.command<T>(method, params, this.#sessionId);
  }

  on(method: string, handler: EventHandler): void {
    const handlers = this.#handlers.get(method);
    if (handlers === undefined) this.#handlers.set(method, new Set([handler]));
    else handlers.add(handler);
  }

  /** For internal routing: the handlers registered for a session event. */
  handlersFor(method: string): readonly EventHandler[] {
    return [...(this.#handlers.get(method) ?? [])];
  }
}

export class CdpSocket {
  readonly #socket: WebSocket;
  readonly #nextId: { value: number } = { value: 1 };
  readonly #pending = new Map<number, PendingCommand>();
  readonly #browserHandlers = new Map<string, Set<EventHandler>>();
  readonly #sessions = new Map<string, CdpSession>();

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener("message", (event: MessageEvent) => {
      this.#receive(event.data);
    });
    socket.addEventListener("close", () => {
      const error = new Error("CDP socket closed");
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
  }

  static async connect(
    endpoint: string,
    timeoutMs = 10_000,
  ): Promise<CdpSocket> {
    const socket = new WebSocket(endpoint);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const timer = setTimeout(
      () => reject(new Error(`no reply from ${endpoint}`)),
      timeoutMs,
    );
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`cannot open ${endpoint}`));
    });
    socket.addEventListener("close", () => {
      clearTimeout(timer);
      reject(new Error(`closed before opening ${endpoint}`));
    });
    await promise;
    return new CdpSocket(socket);
  }

  /** Browser-level events, such as `Target.targetCreated`. */
  on(method: string, handler: EventHandler): void {
    const handlers = this.#browserHandlers.get(method);
    if (handlers === undefined) {
      this.#browserHandlers.set(method, new Set([handler]));
    } else handlers.add(handler);
  }

  /** Attach to a page target and return the session that drives it. */
  async attach(targetId: string): Promise<CdpSession> {
    const result = await this.command<{ sessionId: string }>(
      "Target.attachToTarget",
      { targetId, flatten: true },
    );
    const session = new CdpSession(this, result.sessionId);
    this.#sessions.set(result.sessionId, session);
    return session;
  }

  async command<T>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
    timeoutMs = 30000,
  ): Promise<T> {
    const id = this.#nextId.value++;
    const { promise: outcome, resolve, reject } = Promise.withResolvers<T>();
    this.#pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    const timer = setTimeout(() => {
      const pending = this.#pending.get(id);
      this.#pending.delete(id);
      pending?.reject(
        new Error(`CDP command ${method} timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);
    const message: Record<string, unknown> = { id, method, params };
    if (sessionId !== undefined) message.sessionId = sessionId;
    try {
      this.#socket.send(JSON.stringify(message));
      return await outcome;
    } finally {
      clearTimeout(timer);
    }
  }

  #receive(raw: unknown): void {
    const text = typeof raw === "string"
      ? raw
      : new TextDecoder().decode(raw as ArrayBuffer);
    const message = JSON.parse(text) as Record<string, unknown>;
    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      const error = message.error as { message?: string } | undefined;
      if (error !== undefined) {
        pending.reject(new Error(error.message ?? "CDP error"));
      } else pending.resolve(message.result);
      return;
    }
    const method = message.method;
    if (typeof method !== "string") return;
    const params = (message.params ?? {}) as Record<string, unknown>;
    const sessionId = typeof message.sessionId === "string"
      ? message.sessionId
      : undefined;
    if (sessionId !== undefined) {
      for (
        const handler of this.#sessions.get(sessionId)?.handlersFor(method) ??
          []
      ) {
        handler(params);
      }
    }
    for (const handler of this.#browserHandlers.get(method) ?? []) {
      handler(sessionId === undefined ? params : { ...params, sessionId });
    }
  }

  close(): void {
    try {
      this.#socket.close();
    } catch {
      /* already gone: closing twice is not an error worth a message */
    }
  }
}
