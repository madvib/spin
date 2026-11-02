// node_modules/.bun/alien-signals@3.2.1/node_modules/alien-signals/esm/system.mjs
function createReactiveSystem({ update, notify, unwatched }) {
  return {
    link,
    unlink,
    propagate,
    checkDirty,
    shallowPropagate
  };
  function link(dep, sub, version) {
    const prevDep = sub.depsTail;
    if (prevDep !== undefined && prevDep.dep === dep) {
      return;
    }
    const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps;
    if (nextDep !== undefined && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
    const prevSub = dep.subsTail;
    if (prevSub !== undefined && prevSub.version === version && prevSub.sub === sub) {
      return;
    }
    const newLink = sub.depsTail = dep.subsTail = {
      version,
      dep,
      sub,
      prevDep,
      nextDep,
      prevSub,
      nextSub: undefined
    };
    if (nextDep !== undefined) {
      nextDep.prevDep = newLink;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = newLink;
    } else {
      sub.deps = newLink;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = newLink;
    } else {
      dep.subs = newLink;
    }
  }
  function unlink(link, sub = link.sub) {
    const { dep, prevDep, nextDep, nextSub, prevSub } = link;
    if (nextDep !== undefined) {
      nextDep.prevDep = prevDep;
    } else {
      sub.depsTail = prevDep;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = nextDep;
    } else {
      sub.deps = nextDep;
    }
    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub;
    } else {
      dep.subsTail = prevSub;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub;
    } else if ((dep.subs = nextSub) === undefined) {
      unwatched(dep);
    }
    return nextDep;
  }
  function propagate(link, innerWrite) {
    let next = link.nextSub;
    let stack;
    top:
      do {
        const sub = link.sub;
        let flags = sub.flags;
        if (!(flags & (4 | 8 | 16 | 32))) {
          sub.flags = flags | 32;
          if (innerWrite) {
            sub.flags |= 8;
          }
        } else if (!(flags & (4 | 8))) {
          flags = 0;
        } else if (!(flags & 4)) {
          sub.flags = flags & ~8 | 32;
        } else if (!(flags & (16 | 32)) && isValidLink(link, sub)) {
          sub.flags = flags | (8 | 32);
          flags &= 1;
        } else {
          flags = 0;
        }
        if (flags & 2) {
          notify(sub);
        }
        if (flags & 1) {
          const subSubs = sub.subs;
          if (subSubs !== undefined) {
            const nextSub = (link = subSubs).nextSub;
            if (nextSub !== undefined) {
              stack = { value: next, prev: stack };
              next = nextSub;
            }
            continue;
          }
        }
        if ((link = next) !== undefined) {
          next = link.nextSub;
          continue;
        }
        while (stack !== undefined) {
          link = stack.value;
          stack = stack.prev;
          if (link !== undefined) {
            next = link.nextSub;
            continue top;
          }
        }
        break;
      } while (true);
  }
  function checkDirty(link, sub) {
    let stack;
    let checkDepth = 0;
    let dirty = false;
    top:
      do {
        const dep = link.dep;
        const flags = dep.flags;
        if (sub.flags & 16) {
          dirty = true;
        } else if ((flags & (1 | 16)) === (1 | 16)) {
          const subs = dep.subs;
          if (update(dep)) {
            if (subs.nextSub !== undefined) {
              shallowPropagate(subs);
            }
            dirty = true;
          }
        } else if ((flags & (1 | 32)) === (1 | 32)) {
          stack = { value: link, prev: stack };
          link = dep.deps;
          sub = dep;
          ++checkDepth;
          continue;
        }
        if (!dirty) {
          const nextDep = link.nextDep;
          if (nextDep !== undefined) {
            link = nextDep;
            continue;
          }
        }
        while (checkDepth--) {
          link = stack.value;
          stack = stack.prev;
          if (dirty) {
            const subs = sub.subs;
            if (update(sub)) {
              if (subs.nextSub !== undefined) {
                shallowPropagate(subs);
              }
              sub = link.sub;
              continue;
            }
            dirty = false;
          } else {
            sub.flags &= ~32;
          }
          sub = link.sub;
          const nextDep = link.nextDep;
          if (nextDep !== undefined) {
            link = nextDep;
            continue top;
          }
        }
        return dirty && !!sub.flags;
      } while (true);
  }
  function shallowPropagate(link) {
    do {
      const sub = link.sub;
      const flags = sub.flags;
      if ((flags & (32 | 16)) === 32) {
        sub.flags = flags | 16;
        if ((flags & (2 | 4)) === 2) {
          notify(sub);
        }
      }
    } while ((link = link.nextSub) !== undefined);
  }
  function isValidLink(checkLink, sub) {
    let link = sub.depsTail;
    while (link !== undefined) {
      if (link === checkLink) {
        return true;
      }
      link = link.prevDep;
    }
    return false;
  }
}

// node_modules/.bun/alien-signals@3.2.1/node_modules/alien-signals/esm/index.mjs
var HasChildEffect = 64;
var cycle = 0;
var runDepth = 0;
var batchDepth = 0;
var notifyIndex = 0;
var queuedLength = 0;
var activeSub;
var queued = [];
var { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
  update(node) {
    if ("getter" in node) {
      return updateComputed(node);
    }
    if ("currentValue" in node) {
      return updateSignal(node);
    }
    node.flags = 1;
    return true;
  },
  notify(effect) {
    let insertIndex = queuedLength;
    let firstInsertedIndex = insertIndex;
    do {
      queued[insertIndex++] = effect;
      effect.flags &= ~2;
      effect = effect.subs?.sub;
      if (effect === undefined || !(effect.flags & 2)) {
        break;
      }
    } while (true);
    queuedLength = insertIndex;
    while (firstInsertedIndex < --insertIndex) {
      const left = queued[firstInsertedIndex];
      queued[firstInsertedIndex++] = queued[insertIndex];
      queued[insertIndex] = left;
    }
  },
  unwatched(node) {
    if ("getter" in node) {
      if (node.depsTail !== undefined) {
        node.flags = 1 | 16;
        disposeAllDepsInReverse(node);
      }
    } else if ("currentValue" in node) {} else if ("fn" in node) {
      effectOper.call(node);
    } else {
      effectScopeOper.call(node);
    }
  }
});
function setActiveSub(sub) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}
function startBatch() {
  ++batchDepth;
}
function endBatch() {
  if (!--batchDepth) {
    flush();
  }
}
function signal(initialValue) {
  return signalOper.bind({
    currentValue: initialValue,
    pendingValue: initialValue,
    subs: undefined,
    subsTail: undefined,
    flags: 1
  });
}
function computed(getter) {
  return computedOper.bind({
    value: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 0,
    getter
  });
}
function effect(fn) {
  const e = {
    fn,
    cleanup: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 2 | 4
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
    prevSub.flags |= HasChildEffect;
  }
  try {
    ++runDepth;
    e.cleanup = e.fn();
  } finally {
    --runDepth;
    activeSub = prevSub;
    e.flags &= ~4;
  }
  return effectOper.bind(e);
}
function effectScope(fn) {
  const e = {
    deps: undefined,
    depsTail: undefined,
    subs: undefined,
    subsTail: undefined,
    flags: 1
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
    prevSub.flags |= HasChildEffect;
  }
  try {
    fn();
  } finally {
    activeSub = prevSub;
  }
  return effectScopeOper.bind(e);
}
function trigger(fn) {
  const sub = {
    deps: undefined,
    depsTail: undefined,
    flags: 2
  };
  const prevSub = setActiveSub(sub);
  try {
    fn();
  } finally {
    activeSub = prevSub;
    sub.flags = 0;
    let link = sub.deps;
    while (link !== undefined) {
      const dep = link.dep;
      link = unlink(link, sub);
      const subs = dep.subs;
      if (subs !== undefined) {
        propagate(subs, !!runDepth);
        shallowPropagate(subs);
      }
    }
    if (!batchDepth) {
      flush();
    }
  }
}
function updateComputed(c) {
  if (c.flags & HasChildEffect) {
    let link = c.depsTail;
    while (link !== undefined) {
      const prev = link.prevDep;
      const dep = link.dep;
      if (!("getter" in dep) && !("currentValue" in dep)) {
        unlink(link, c);
      }
      link = prev;
    }
  }
  c.depsTail = undefined;
  c.flags = 1 | 4;
  const prevSub = setActiveSub(c);
  try {
    ++cycle;
    const oldValue = c.value;
    return oldValue !== (c.value = c.getter(oldValue));
  } finally {
    activeSub = prevSub;
    c.flags &= ~4;
    purgeDeps(c);
  }
}
function updateSignal(s) {
  s.flags = 1;
  return s.currentValue !== (s.currentValue = s.pendingValue);
}
function run(e) {
  const flags = e.flags;
  if (flags & 16 || flags & 32 && checkDirty(e.deps, e)) {
    if (flags & HasChildEffect) {
      let link = e.depsTail;
      while (link !== undefined) {
        const prev = link.prevDep;
        const dep = link.dep;
        if (!("getter" in dep) && !("currentValue" in dep)) {
          unlink(link, e);
        }
        link = prev;
      }
    }
    if (e.cleanup) {
      runCleanup(e);
      if (!e.flags) {
        return;
      }
    }
    e.depsTail = undefined;
    e.flags = 2 | 4;
    const prevSub = setActiveSub(e);
    try {
      ++cycle;
      ++runDepth;
      e.cleanup = e.fn();
    } finally {
      --runDepth;
      activeSub = prevSub;
      e.flags &= ~4;
      purgeDeps(e);
    }
  } else if (e.deps !== undefined) {
    e.flags = 2 | flags & HasChildEffect;
  }
}
function flush() {
  try {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex];
      queued[notifyIndex++] = undefined;
      run(effect);
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex];
      queued[notifyIndex++] = undefined;
      effect.flags |= 2 | 8;
    }
    notifyIndex = 0;
    queuedLength = 0;
  }
}
function computedOper() {
  const flags = this.flags;
  if (flags & 16 || flags & 32 && (checkDirty(this.deps, this) || (this.flags = flags & ~32, false))) {
    if (updateComputed(this)) {
      const subs = this.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (!flags) {
    this.flags = 1 | 4;
    const prevSub = setActiveSub(this);
    try {
      this.value = this.getter();
    } finally {
      activeSub = prevSub;
      this.flags &= ~4;
    }
  }
  const sub = activeSub;
  if (sub !== undefined) {
    link(this, sub, cycle);
  }
  return this.value;
}
function signalOper(...value) {
  if (value.length) {
    if (this.pendingValue !== (this.pendingValue = value[0])) {
      this.flags = 1 | 16;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs, !!runDepth);
        if (!batchDepth) {
          flush();
        }
      }
    }
  } else {
    if (this.flags & 16) {
      if (updateSignal(this)) {
        const subs = this.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    }
    const sub = activeSub;
    if (sub !== undefined) {
      link(this, sub, cycle);
    }
    return this.currentValue;
  }
}
function runCleanup(e) {
  const cleanup = e.cleanup;
  e.cleanup = undefined;
  const prevSub = activeSub;
  activeSub = undefined;
  try {
    cleanup();
  } finally {
    activeSub = prevSub;
  }
}
function effectOper() {
  effectScopeOper.call(this);
  if (this.cleanup) {
    runCleanup(this);
  }
}
function effectScopeOper() {
  this.flags = 0;
  disposeAllDepsInReverse(this);
  const sub = this.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
}
function disposeAllDepsInReverse(sub) {
  let link = sub.depsTail;
  while (link !== undefined) {
    const prev = link.prevDep;
    unlink(link, sub);
    link = prev;
  }
}
function purgeDeps(sub) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}

// packages/runtime/src/core/signal.ts
function batch(fn) {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}
function untrack(fn) {
  const prevSub = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(prevSub);
  }
}
var activeScope;
function scope(parent = activeScope) {
  const groups = [];
  const teardowns = [];
  let disposed = false;
  const self = {
    parent,
    run(fn) {
      if (disposed) {
        throw new Error("scope.run: the scope is disposed");
      }
      const prevScope = activeScope;
      activeScope = self;
      try {
        let value;
        groups.push(effectScope(() => {
          value = fn();
        }));
        return value;
      } finally {
        activeScope = prevScope;
      }
    },
    own(dispose) {
      if (disposed) {
        dispose();
        return;
      }
      teardowns.push(dispose);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (let i = groups.length - 1;i >= 0; i--) {
        groups[i]?.();
      }
      groups.length = 0;
      for (let i = teardowns.length - 1;i >= 0; i--) {
        teardowns[i]?.();
      }
      teardowns.length = 0;
    }
  };
  return self;
}
function own(dispose) {
  if (activeScope === undefined) {
    throw new Error("own: called outside of scope.run");
  }
  activeScope.own(dispose);
}
// packages/runtime/src/scope/table.ts
var elementTables = new WeakMap;
function apiOf(value) {
  if (value !== null && typeof value === "object" && "api" in value) {
    return value.api;
  }
  return value;
}
function controllerView(api, commands) {
  const record = api;
  const state = {};
  for (const key of Object.keys(record)) {
    if (typeof record[key] !== "function")
      state[key] = () => record[key];
  }
  const calls = {};
  for (const name of commands ?? []) {
    const method = record[name];
    if (typeof method === "function") {
      calls[name] = method;
    }
  }
  return { commands: calls, state };
}
function createScopeTable(owner, el) {
  const instances = new Map;
  let primary;
  function named(handle) {
    let byName = instances.get(handle);
    if (byName === undefined)
      instances.set(handle, byName = new Map);
    return byName;
  }
  function firstEntry(byName) {
    if (byName === undefined)
      return;
    return byName.get("") ?? byName.values().next().value;
  }
  owner.own(() => {
    if (el !== undefined)
      elementTables.delete(el);
    for (const byName of instances.values()) {
      for (const [, instance] of byName) {
        instance.dispose?.();
      }
    }
    instances.clear();
    primary = undefined;
  });
  function findLocal(handle) {
    return firstEntry(instances.get(handle));
  }
  function findAncestor(handle) {
    for (let current = el?.parentElement ?? null;current !== null; current = current.parentElement) {
      const ancestor = elementTables.get(current);
      const found = ancestor?.entry(handle);
      if (found !== undefined)
        return found;
    }
    return;
  }
  function resolve(handle) {
    return (findLocal(handle) ?? findAncestor(handle))?.api;
  }
  function consume(handle) {
    const found = resolve(handle);
    if (found === undefined) {
      throw new Error(`[spin] consume: no provider found for ${handle.name ?? "machine"}`);
    }
    return found;
  }
  function watch(handle, factory, commands, name) {
    const key = name ?? "";
    const byName = named(handle);
    const existing = byName.get(key);
    if (existing !== undefined)
      return existing.value;
    const value = factory();
    const entry = {
      value,
      api: apiOf(value),
      commands,
      primary: primary === undefined,
      dispose: getDispose(value)
    };
    byName.set(key, entry);
    primary ??= { handle, name: key };
    return value;
  }
  function entry(handle) {
    return findLocal(handle);
  }
  function hasNamed(handle, name) {
    return instances.get(handle)?.has(name) ?? false;
  }
  function namesOf(handle) {
    return [...instances.get(handle)?.keys() ?? []];
  }
  function controller(handle) {
    const target = handle ?? primary?.handle;
    const found = target === undefined ? undefined : findLocal(target) ?? (handle === undefined ? undefined : findAncestor(handle));
    if (found === undefined)
      return;
    const api = found.api;
    if (api !== null && typeof api === "object" && "commands" in api && "state" in api) {
      return api;
    }
    return controllerView(found.api ?? {}, found.commands);
  }
  function dispose() {
    if (el !== undefined)
      elementTables.delete(el);
    for (const byName of instances.values()) {
      for (const [, instance] of byName) {
        instance.dispose?.();
      }
    }
    instances.clear();
    primary = undefined;
  }
  function getDispose(value) {
    if (typeof value !== "object" || value === null)
      return;
    if (!("dispose" in value))
      return;
    const disposeFn = value.dispose;
    if (typeof disposeFn !== "function")
      return;
    return () => disposeFn();
  }
  const table = {
    resolve,
    watch,
    consume,
    controller,
    dispose,
    entry,
    hasNamed,
    namesOf
  };
  if (el !== undefined)
    elementTables.set(el, table);
  return table;
}
function consume(el, handle) {
  for (let current = el;current !== null; current = current.parentElement) {
    const table = elementTables.get(current);
    const found = table?.consume(handle);
    if (found !== undefined)
      return found;
  }
  throw new Error(`[spin] consume: no provider found for ${handle.name ?? "machine"}`);
}
function controllerOf(el, handle) {
  for (let current = el;current !== null; current = current.parentElement) {
    const found = elementTables.get(current)?.controller(handle);
    if (found !== undefined)
      return found;
    if (handle === undefined)
      return;
  }
  return;
}
function provideController(el, build, handle) {
  let table = elementTables.get(el);
  if (table === undefined) {
    table = createScopeTable(scope(), el);
  }
  const key = handle ?? build;
  const existing = table.resolve(key);
  if (existing !== undefined)
    return;
  const built = build();
  table.watch(key, () => ({ api: built, dispose: undefined }), Object.keys(built.commands));
}

// packages/runtime/src/props.ts
function defaultTwin(prop) {
  return `default${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
}
function resolveTwins(props, authored) {
  const out = { ...props };
  for (const key of Object.keys(props)) {
    if (!key.startsWith("default"))
      continue;
    const twin = key.charAt(7).toLowerCase() + key.slice(8);
    if (authored !== undefined && authored(twin))
      continue;
    out[twin] = props[key];
  }
  return out;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function coerceBool(raw, fallback) {
  if (raw === null || raw === undefined || raw === "" || raw === "true") {
    return true;
  }
  if (raw === "false")
    return false;
  return fallback;
}
function coerceString(raw) {
  return raw ?? "";
}
function coerceInt(raw, fallback) {
  if (raw === null || raw === undefined)
    return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}
function coerceList(raw) {
  if (raw === null || raw === undefined || raw === "")
    return [];
  const trimmed = raw.trim();
  const inner = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  return inner.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}
function coerceJsonArray(raw, fallback) {
  if (raw === null || raw === undefined || raw === "")
    return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function coerceObjectArrayItems(value, fallback, fields) {
  if (!Array.isArray(value))
    return fallback;
  const out = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const obj = {
      ...item
    };
    if (fields) {
      for (const field of fields) {
        if (field.type === "int") {
          const v = obj[field.name];
          const n = typeof v === "number" ? v : parseInt(String(v), 10);
          obj[field.name] = Number.isNaN(n) ? undefined : n;
        }
      }
    }
    out.push(obj);
  }
  return out;
}

// packages/runtime/src/scope/element.ts
var attrParsers = {
  bool: (value) => coerceBool(value, false),
  string: (value) => coerceString(value),
  int: (value) => coerceInt(value, undefined),
  "string[]": (value) => coerceJsonArray(value, []),
  "object[]": (value) => coerceJsonArray(value, [])
};
var authoredProps = new WeakMap;
var elementScopes = new WeakMap;
var writers = new WeakMap;
function writeProp(el, name, value) {
  const write = writers.get(el);
  if (write === undefined)
    return false;
  write(name, value);
  return true;
}
function scopeOf(node) {
  for (let current = node;current !== null; current = current.parentElement) {
    const owner = elementScopes.get(current);
    if (owner !== undefined)
      return owner;
  }
  return;
}
function runInElement(el, fn) {
  const owner = scopeOf(el);
  return owner === undefined ? fn() : owner.run(fn);
}
function authoredFor(el) {
  let set = authoredProps.get(el);
  if (!set)
    authoredProps.set(el, set = new Set);
  return set;
}
var idCounters = new Map;
function uniqueId(tag) {
  const next = (idCounters.get(tag) ?? 0) + 1;
  idCounters.set(tag, next);
  return `${tag}-${next}`;
}
function define(tag, spec) {
  const propNames = spec.props ?? [];
  const parsers = spec.attributes ?? {};
  const stores = new WeakMap;
  function storeFor(el) {
    let store = stores.get(el);
    if (!store)
      stores.set(el, store = new Map);
    return store;
  }
  function seedProps(el) {
    const store = storeFor(el);
    for (const name of propNames) {
      if (!store.has(name))
        store.set(name, signal(undefined));
    }
  }
  function propFor(el, name) {
    const store = storeFor(el);
    let value = store.get(name);
    if (!value)
      store.set(name, value = signal(undefined));
    return value;
  }
  function propsFor(el) {
    return new Proxy({}, {
      get: (_target, key) => typeof key === "string" ? propFor(el, key)() : undefined,
      has: (_target, key) => typeof key === "string" && storeFor(el).has(key),
      ownKeys: () => {
        const store = storeFor(el);
        const out = [];
        for (const name of propNames) {
          const sig = store.get(name);
          if (sig !== undefined && sig() !== undefined)
            out.push(name);
        }
        for (const name of store.keys()) {
          if (!propNames.includes(name))
            out.push(name);
        }
        return out;
      },
      getOwnPropertyDescriptor: () => ({
        configurable: true,
        enumerable: true
      })
    });
  }

  class Component extends HTMLElement {
    #scope;
    #table;
    constructor() {
      super();
      for (const name of propNames) {
        const own = Object.getOwnPropertyDescriptor(this, name);
        if (own === undefined || own.get !== undefined || own.set !== undefined)
          continue;
        const value = own.value;
        delete this[name];
        propFor(this, name)(value);
      }
      writers.set(this, (name, next) => {
        authoredFor(this).add(name);
        propFor(this, name)(coerceWrite(name, next));
      });
    }
    connectedCallback() {
      if (this.#scope !== undefined)
        return;
      if (this.style.display === "") {
        const view = this.ownerDocument.defaultView;
        const placed = typeof view?.getComputedStyle === "function" ? view.getComputedStyle(this).display : "inline";
        if (placed === "inline")
          this.style.display = "block";
      }
      const parentScope = this.parentElement !== null ? scopeOf(this.parentElement) : undefined;
      const owner = scope(parentScope);
      this.#scope = owner;
      elementScopes.set(this, owner);
      const table = createScopeTable(owner, this);
      this.#table = table;
      owner.run(() => {
        seedProps(this);
        spec.build({
          el: this,
          props: propsFor(this),
          scope: owner,
          resolve: (handle) => table.resolve(handle),
          watch: (handle, factory, commands, name) => {
            const peers = table.namesOf(handle);
            if ((name ?? "") === "" && peers.length > 0 && !peers.includes("")) {
              throw new Error(`[spin] ${tag}: two bindings share one machine; pass a binding name`);
            }
            return table.watch(handle, factory, commands, name);
          },
          consume: (handle) => table.consume(handle),
          authored: (name) => authoredFor(this).has(name)
        });
      });
    }
    disconnectedCallback() {
      queueMicrotask(() => {
        if (this.isConnected)
          return;
        this.#scope?.dispose();
        this.#scope = undefined;
        this.#table = undefined;
      });
    }
    attributeChangedCallback(name, _previous, next) {
      authoredFor(this).add(name);
      propFor(this, name)(parsers[name]?.(next));
    }
  }
  function coerceWrite(name, next) {
    const parser = parsers[name];
    if (parser === undefined)
      return next;
    if (typeof next === "string")
      return parser(next);
    if (parser !== attrParsers["object[]"])
      return next;
    return coerceObjectArrayItems(next, []);
  }
  for (const name of propNames) {
    Object.defineProperty(Component.prototype, name, {
      get() {
        return propFor(this, name)();
      },
      set(next) {
        authoredFor(this).add(name);
        propFor(this, name)(coerceWrite(name, next));
      },
      configurable: true,
      enumerable: true
    });
  }
  Object.defineProperty(Component, "observedAttributes", {
    value: Object.keys(parsers),
    configurable: true
  });
  if (customElements.get(tag) !== undefined)
    return;
  customElements.define(tag, Component);
}
// packages/runtime/src/component/ids.ts
function focuser(id) {
  return (part, slot) => {
    if (typeof document === "undefined")
      return;
    document.getElementById(id(part, slot))?.focus({ preventScroll: true });
  };
}
function measurer(id) {
  return (part, slot) => {
    if (typeof document === "undefined")
      return null;
    const node = document.getElementById(id(part, slot));
    if (!(node instanceof Element))
      return null;
    try {
      return node.getBoundingClientRect();
    } catch {
      return null;
    }
  };
}
function ids(name, id) {
  const root = id.startsWith(`${name}:`) ? id : `${name}:${id}`;
  return (part, slot) => {
    if (part === "")
      return root;
    return slot === undefined || slot === null ? `${root}:${part}` : `${root}:${part}:${String(slot)}`;
  };
}
// packages/runtime/src/machine/fsm/machine.ts
var INIT = { type: "xstate.init" };
function toEvent(event) {
  return event;
}
function stateOf(value, context) {
  return { value, context, matches: (v) => v === value };
}
function isList(value) {
  return Array.isArray(value);
}
var EMPTY = [];
function normalize(entry) {
  if (entry === undefined)
    return EMPTY;
  const list = isList(entry) ? entry : [entry];
  return list.map((candidate) => typeof candidate === "string" ? { target: candidate, cond: undefined, assign: undefined } : { target: candidate.target, cond: candidate.cond, assign: candidate.assign });
}
function isMatch(candidate, ctx, event) {
  return candidate.cond === undefined || candidate.cond(ctx, event);
}
function fold(assigns, startContext, event) {
  if (assigns === undefined)
    return startContext;
  let context = startContext;
  for (const entry of assigns) {
    const assign = "assign" in entry ? entry.assign : entry;
    context = { ...context, ...assign(context, event) };
  }
  return context;
}
function createMachine(spec) {
  const compile = (on) => {
    const table = new Map;
    for (const [name, entry] of Object.entries(on ?? {})) {
      table.set(name, normalize(entry));
    }
    return table;
  };
  const config = {
    ...spec.id === undefined ? {} : { id: spec.id },
    initial: spec.initial,
    context: spec.context,
    ...spec.on === undefined ? {} : { on: spec.on },
    states: spec.states
  };
  const rootTable = compile(spec.on);
  const stateTables = new Map;
  for (const [stateName, stateDef] of Object.entries(spec.states)) {
    stateTables.set(stateName, compile(stateDef.on));
  }
  const initial = fold(config.states[config.initial]?.entry, config.context ?? {}, INIT);
  return {
    config,
    fields: spec.fields ?? {},
    initialState: {
      value: config.initial,
      context: initial,
      matches: (v) => v === config.initial
    },
    transition(stateOrValue, eventOrType) {
      const event = toEvent(eventOrType);
      const from = typeof stateOrValue === "string" ? stateOf(stateOrValue, config.context ?? {}) : stateOrValue;
      const current = from.value;
      const ctx = from.context;
      const stateDef = config.states[current];
      const name = event.type;
      const first = stateTables.get(current)?.get(name) ?? EMPTY;
      const second = rootTable.get(name) ?? EMPTY;
      for (let tier = 0;tier < 2; tier++) {
        const list = tier === 0 ? first : second;
        for (let i = 0;i < list.length; i++) {
          const candidate = list[i];
          const { target, assign } = candidate;
          if (!isMatch(candidate, ctx, event))
            continue;
          if (target === undefined) {
            return {
              value: current,
              context: fold(assign === undefined ? undefined : isList(assign) ? assign : [assign], ctx, event),
              matches: (v) => v === current
            };
          }
          const nextDef = config.states[target];
          const context = fold(stateDef?.exit, ctx, event);
          const written = fold(assign === undefined ? undefined : isList(assign) ? assign : [assign], context, event);
          return {
            value: target,
            context: fold(nextDef?.entry, written, event),
            matches: (v) => v === target
          };
        }
      }
      return stateOf(current, ctx);
    }
  };
}
function interpret(machine) {
  let rawState = machine.initialState.value;
  let rawContext = { ...machine.initialState.context };
  let stopped = false;
  const stateSig = signal(rawState);
  const fieldSignals = new Map;
  const reactiveContext = {};
  const ensureField = (key, initialValue) => {
    let sig = fieldSignals.get(key);
    if (sig !== undefined)
      return sig;
    sig = signal(initialValue);
    fieldSignals.set(key, sig);
    Object.defineProperty(reactiveContext, key, {
      enumerable: true,
      configurable: true,
      get() {
        return sig();
      },
      set(next) {
        const rec = rawContext;
        if (!Object.is(rec[key], next)) {
          rec[key] = next;
          sig(next);
        }
      }
    });
    return sig;
  };
  for (const [key, val] of Object.entries(rawContext)) {
    ensureField(key, val);
  }
  const commitState = (nextValue, nextContext) => {
    batch(() => {
      if (nextValue !== rawState) {
        rawState = nextValue;
        stateSig(nextValue);
      }
      const prevRec = rawContext;
      const nextRec = nextContext;
      rawContext = { ...nextContext };
      for (const key of Object.keys(nextRec)) {
        const val = nextRec[key];
        const sig = fieldSignals.get(key);
        if (sig === undefined) {
          ensureField(key, val);
        } else if (!Object.is(prevRec[key], val)) {
          sig(val);
        }
      }
    });
  };
  const stateView = {
    get value() {
      return stateSig();
    },
    get context() {
      return reactiveContext;
    },
    matches: (v) => stateSig() === v
  };
  const service = {
    setContext(patch) {
      commitState(rawState, { ...rawContext, ...patch });
    },
    send(event) {
      if (stopped)
        return;
      const next = untrack(() => machine.transition({ value: rawState, context: rawContext, matches: (v) => v === rawState }, event));
      commitState(next.value, next.context);
    },
    start(next) {
      stopped = false;
      if (next !== undefined) {
        const value = typeof next === "string" ? next : next.value;
        const context = typeof next === "string" ? machine.initialState.context : next.context;
        const seeded = fold(machine.config.states[value]?.entry, context, INIT);
        commitState(value, seeded);
      } else {
        commitState(machine.initialState.value, machine.initialState.context);
      }
      return service;
    },
    stop() {
      stopped = true;
      return service;
    },
    get state() {
      return stateView;
    },
    get stopped() {
      return stopped;
    }
  };
  return service;
}

// packages/runtime/src/component/define.ts
function dataAttr(value) {
  return value ? "" : undefined;
}
function isComposing(event) {
  return event.isComposing === true || event.keyCode === 229;
}

// packages/runtime/src/component/synthesize.ts
function authoredProps2(props) {
  return (name) => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? predicate(name) : false;
  };
}
function pickCallback(props, name) {
  const value = props[name];
  return typeof value === "function" ? value : undefined;
}
function textProp(raw) {
  return typeof raw === "string" ? raw : "";
}
function applyContract(svc, fields, props, authored, cursor, send) {
  if (Object.keys(fields).length === 0)
    return { moved: false, events: [] };
  const parsed = props();
  const context = svc.state.context;
  const events = [];
  let moved = false;
  for (const [field, contract] of Object.entries(fields)) {
    const raw = parsed[field];
    if (raw === undefined || raw === null)
      continue;
    if (!authored(field))
      continue;
    if (Object.is(cursor.get(field), raw))
      continue;
    cursor.set(field, raw);
    if (contract.event === undefined) {
      const value = contract.parse === undefined ? raw : contract.parse(raw);
      if (context[field] !== value) {
        svc.setContext({ [field]: value });
        moved = true;
      }
      continue;
    }
    const event = { type: contract.event, [field]: raw };
    events.push(event);
    moved = true;
    send(event);
  }
  return { moved, events };
}
var sameWatch = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
function defineComponent(def) {
  const segments = new Map;
  for (const [key, partDef] of Object.entries(def.parts)) {
    segments.set(key, partDef.id ?? key);
  }
  for (const [key, slotDef] of Object.entries(def.slots ?? {})) {
    segments.set(key, slotDef.id ?? key);
  }
  const createBridge = (props, root = () => {
    throw new Error("[spin] bridge needs a root element");
  }, id) => {
    if (def.machine === undefined) {
      throw new Error(`[spin] ${def.name} has no machine`);
    }
    const owner = scope();
    const lastContract = new Map;
    const lastWatched = new Map;
    const authored = authoredProps2(props);
    const names = ids(def.name, id);
    const resolveId = (part, slot) => names(segments.get(part) ?? part, slot);
    const focusPart = focuser(names);
    const measurePart = measurer(names);
    let machine;
    const machineOf = () => {
      if (machine !== undefined)
        return machine;
      const resolved = resolveTwins(props(), authored);
      const args = def.args === undefined ? resolved : def.args(resolved);
      machine = def.machine(args, authored);
      return machine;
    };
    const refresh = (svc) => {
      if (def.scalars === undefined && def.scalarsOf === undefined) {
        return false;
      }
      const parsed = props();
      const writable = svc.state.context;
      const patch = {};
      if (def.scalarsOf !== undefined) {
        const merge = def.scalarsOf(parsed, authored);
        for (const [key, value] of Object.entries(merge)) {
          if (writable[key] !== value)
            patch[key] = value;
        }
      } else {
        for (const name of def.scalars ?? []) {
          if (parsed[name] === null || parsed[name] === undefined)
            continue;
          if (writable[name] !== parsed[name])
            patch[name] = parsed[name];
        }
      }
      if (Object.keys(patch).length === 0)
        return false;
      svc.setContext(patch);
      return true;
    };
    const readCallbacks = () => {
      const raw = props();
      const out = {};
      for (const event of Object.values(def.events)) {
        const found = pickCallback(raw, event.prop);
        if (found !== undefined)
          out[event.prop] = found;
      }
      return out;
    };
    const notify = (svc, callbacks, kind, event, beforeSnapshot, parsed, source) => {
      const context = svc.state.context;
      const state = svc.state.value;
      for (const [name, defEvent] of Object.entries(def.events)) {
        if (defEvent.on === "commit" && kind !== "commit")
          continue;
        const watched = defEvent.watch(context, state);
        const last = lastWatched.get(name);
        lastWatched.set(name, watched);
        if (defEvent.select !== undefined) {
          const before = beforeSnapshot?.context;
          if (event === undefined || before === undefined)
            continue;
          const beforeState = beforeSnapshot?.state ?? state;
          const payload = defEvent.select(event, before, context, {
            was: beforeState,
            is: state
          }, source);
          if (payload !== null) {
            if (Array.isArray(payload)) {
              for (const report of payload)
                callbacks[defEvent.prop]?.(report);
            } else
              callbacks[defEvent.prop]?.(payload);
          }
          continue;
        }
        if (defEvent.on !== "commit" && last !== undefined && sameWatch(last, watched)) {
          continue;
        }
        callbacks[defEvent.prop]?.(defEvent.detail(watched, event, parsed, context));
      }
    };
    let service;
    const transmit = (event) => {
      const svc = ensureService();
      refresh(svc);
      const before = {
        context: { ...svc.state.context },
        state: svc.state.value
      };
      svc.send(event);
      def.settled?.({
        event,
        before,
        after: { context: svc.state.context, state: svc.state.value },
        props: props(),
        root,
        id: resolveId,
        focus: focusPart,
        measure: measurePart,
        send: (report) => send(report)
      });
      return { svc, before };
    };
    const send = (event) => {
      const { svc, before } = transmit(event);
      notify(svc, readCallbacks(), def.commitEvents?.includes(event.type) === true ? "commit" : "move", event, before, props());
    };
    const ensureService = () => {
      if (service !== undefined)
        return service;
      const startState = typeof def.start === "function" ? def.start(props(), authored) : def.start;
      service = owner.run(() => {
        const svc = interpret(machineOf()).start(startState);
        refresh(svc);
        return svc;
      });
      for (const event of def.establish?.(props(), authored) ?? []) {
        transmit(event);
      }
      notify(service, {}, "move", undefined, undefined, props());
      return service;
    };
    const dispatch = (event) => {
      send(def.dispatch !== undefined ? def.dispatch(event, props()) : event);
    };
    let api;
    let mounted = false;
    const ensureConnect = () => {
      if (api !== undefined)
        return api;
      const svc = ensureService();
      const built = {};
      for (const [name, command] of Object.entries(def.commands)) {
        if (command.view !== undefined) {
          const view = command.view;
          built[name] = (...args) => view({
            args,
            id: resolveId,
            focus: focusPart,
            measure: measurePart,
            root
          });
          continue;
        }
        const toEvent = command.event;
        built[name] = (...args) => dispatch(toEvent(args, svc.state.context, resolveId));
      }
      for (const [name, reader] of Object.entries(def.readers ?? {})) {
        Object.defineProperty(built, name, {
          get: () => reader.read(svc.state.context, svc.state.value, props(), root),
          enumerable: true
        });
      }
      if (def.readers?.["state"] === undefined) {
        Object.defineProperty(built, "state", {
          get: () => svc.state.value,
          enumerable: true
        });
      }
      for (const [name, method] of Object.entries(def.methods ?? {})) {
        built[name] = (...args) => method.call(svc.state.context, svc.state.value, args, props(), resolveId);
      }
      const liveProps = new Proxy({}, {
        get: (_target, key) => props()[key],
        has: (_target, key) => typeof key === "string" && (key in props())
      });
      const viewFor = (slot) => {
        const view = {
          props: liveProps,
          context: svc.state.context,
          root,
          id: resolveId,
          measure: measurePart,
          send: dispatch,
          attr: dataAttr,
          slot
        };
        Object.defineProperty(view, "state", {
          get: () => svc.state.value,
          enumerable: true
        });
        return view;
      };
      const baseView = viewFor(undefined);
      const zeroArgBags = new Map;
      for (const [part, partDef] of Object.entries(def.parts)) {
        const method = `get${part[0]?.toUpperCase() ?? ""}${part.slice(1)}Props`;
        const segment = partDef.id ?? part;
        built[method] = (...callArgs) => {
          const raw = callArgs[0];
          if (raw === undefined) {
            let cached = zeroArgBags.get(part);
            if (cached === undefined) {
              const run = computed(() => ({
                id: resolveId(part === "root" ? "" : part),
                "data-scope": def.name,
                "data-part": segment,
                ...partDef.attrs === undefined ? {} : partDef.attrs(baseView, undefined)
              }));
              cached = () => run();
              zeroArgBags.set(part, cached);
            }
            return cached();
          }
          const stamped = {
            id: resolveId(part === "root" ? "" : part),
            "data-scope": def.name,
            "data-part": segment
          };
          if (partDef.attrs === undefined)
            return stamped;
          return {
            ...stamped,
            ...partDef.attrs(raw === undefined ? baseView : viewFor(raw), raw)
          };
        };
      }
      for (const [slotName, slotDef] of Object.entries(def.slots ?? {})) {
        const cap = `${slotName[0]?.toUpperCase() ?? ""}${slotName.slice(1)}`;
        const segment = slotDef.id ?? slotName;
        built[`get${cap}Props`] = (slot, ...callArgs) => {
          const attrs = slotDef.attrs(viewFor(slot), callArgs[0]);
          if (slotDef.stamp === false)
            return attrs;
          return {
            "data-scope": def.name,
            "data-part": segment,
            ...attrs
          };
        };
        const indexesMemo = computed(() => slotDef.indexes(svc.state.context, props()));
        built[`get${cap}Indexes`] = () => indexesMemo();
      }
      api = built;
      if (!mounted) {
        mounted = true;
        def.mounted?.({
          props: props(),
          root,
          id: resolveId,
          focus: focusPart,
          measure: measurePart
        });
      }
      return api;
    };
    owner.run(() => effect(() => {
      props();
      untrack(() => {
        const svc = ensureService();
        const beforeContext = {
          context: { ...svc.state.context },
          state: svc.state.value
        };
        refresh(svc);
        const syncResult = applyContract(svc, machineOf().fields, props, authored, lastContract, (event) => transmit(event));
        const parsed = props();
        const reconciled = [];
        const derivedMoved = def.reconcile?.({
          context: svc.state.context,
          state: svc.state.value,
          parsed,
          authored,
          send: (event) => {
            const typed = event;
            reconciled.push(typed);
            transmit(typed);
          }
        }) ?? false;
        const kindOf = (type) => def.commitEvents?.includes(type) === true ? "commit" : "move";
        for (const event of syncResult.events) {
          notify(svc, readCallbacks(), kindOf(event.type), event, beforeContext, props());
        }
        if (reconciled.length > 0) {
          const last = reconciled[reconciled.length - 1];
          if (last !== undefined) {
            notify(svc, readCallbacks(), kindOf(last.type), last, beforeContext, props(), "reconcile");
          }
        }
        if (syncResult.events.length === 0 && reconciled.length === 0 && derivedMoved) {
          notify(svc, readCallbacks(), "commit", undefined, beforeContext, props());
        }
      });
    }));
    const proxy = new Proxy({}, {
      get: (_target, key) => Reflect.get(ensureConnect(), key),
      has: (_target, key) => Reflect.has(ensureConnect(), key),
      ownKeys: () => Reflect.ownKeys(ensureConnect()),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(ensureConnect(), key);
        if (descriptor === undefined)
          return;
        return { ...descriptor, configurable: true };
      }
    });
    return {
      api: proxy,
      dispose: () => {
        service?.stop();
        owner.dispose();
      }
    };
  };
  const events = {};
  for (const [name, event] of Object.entries(def.events)) {
    events[name] = {
      on: event.prop,
      detail: (change) => change
    };
  }
  const fieldSet = new Set(def.scalars ?? []);
  for (const event of Object.values(def.events))
    fieldSet.add(event.prop);
  if (def.machine !== undefined) {
    try {
      const probed = def.machine(def.args === undefined ? {} : def.args({}), () => false);
      for (const key of Object.keys(probed.fields))
        fieldSet.add(key);
      for (const key of Object.keys(probed.initialState.context)) {
        fieldSet.add(key);
      }
    } catch {}
  }
  const manifest = {
    parts: Object.keys(def.parts),
    slots: Object.keys(def.slots ?? {}),
    readers: [...Object.keys(def.readers ?? {}), "state"],
    methods: Object.keys(def.methods ?? {}),
    commands: Object.keys(def.commands ?? {}),
    events: Object.keys(def.events ?? {})
  };
  const component = (_args) => {
    throw new Error(`[spin] ${def.name}() is a <script> binding compiled by spin-components; use ${def.name}.createBridge() for imperative bridges`);
  };
  Object.defineProperty(component, "name", { value: def.name });
  return Object.assign(component, {
    fields: [...fieldSet],
    createBridge,
    commands: Object.keys(def.commands),
    events,
    manifest
  });
}
// packages/runtime/src/math/numbers.ts
var { abs, floor, max, min, pow, round, sign } = Math;
var nan = (v) => Number.isNaN(v) ? 0 : v;
function clampValue(v, vmin, vmax) {
  return min(max(nan(v), vmin), vmax);
}
function getValuePercent(v, vmin, vmax) {
  return (nan(v) - vmin) / (vmax - vmin);
}
function roundValue(v, vmin, step) {
  return round((nan(v) - vmin) / step) * step + vmin;
}
function getPercentValue(p, vmin, vmax, step) {
  return clampValue(roundValue(p * (vmax - vmin) + vmin, vmin, step), vmin, vmax);
}
function roundToStepPrecision(v, step) {
  let rv = v;
  const ss = step.toString();
  const pi = ss.indexOf(".");
  const p = pi >= 0 ? ss.length - pi : 0;
  if (p > 0) {
    const pw = pow(10, p);
    rv = round(rv * pw) / pw;
  }
  return rv;
}
function snapValueToStep(v, vmin, vmax, step) {
  const min2 = vmin != null ? Number(vmin) : 0;
  const max2 = Number(vmax);
  const remainder = (v - min2) % step;
  let snapped = abs(remainder) * 2 >= step ? v + sign(remainder) * (step - abs(remainder)) : v - remainder;
  snapped = roundToStepPrecision(snapped, step);
  if (!Number.isNaN(min2) && snapped < min2) {
    snapped = min2;
  } else if (!Number.isNaN(max2) && snapped > max2) {
    const stepsInRange = floor((max2 - min2) / step);
    const largestValidStep = min2 + stepsInRange * step;
    snapped = stepsInRange <= 0 || largestValidStep < min2 ? max2 : largestValidStep;
  }
  return roundToStepPrecision(snapped, step);
}
function getValueRanges(vs, vmin, vmax, gap) {
  return vs.map((v, i) => ({
    min: i === 0 ? vmin : (vs[i - 1] ?? vmin) + gap,
    max: i === vs.length - 1 ? vmax : (vs[i + 1] ?? vmax) - gap,
    value: v
  }));
}
function getMinValueAtIndex(index, values, vmin) {
  return index === 0 ? vmin : values[index - 1] ?? vmin;
}
function getMaxValueAtIndex(index, values, vmax) {
  return index === values.length - 1 ? vmax : values[index + 1] ?? vmax;
}
function getNextStepValue(index, ctx) {
  const next = [...ctx.values];
  next[index] = snapValueToStep((ctx.values[index] ?? ctx.min) + ctx.step, getMinValueAtIndex(index, ctx.values, ctx.min), getMaxValueAtIndex(index, ctx.values, ctx.max), ctx.step);
  return next;
}
function getPreviousStepValue(index, ctx) {
  const next = [...ctx.values];
  next[index] = snapValueToStep((ctx.values[index] ?? ctx.min) - ctx.step, getMinValueAtIndex(index, ctx.values, ctx.min), getMaxValueAtIndex(index, ctx.values, ctx.max), ctx.step);
  return next;
}
function closestIndex(values, pointValue) {
  let closest = 0;
  let distance = Math.abs((values[0] ?? 0) - pointValue);
  for (let i = 1;i < values.length; i += 1) {
    const next = Math.abs((values[i] ?? 0) - pointValue);
    if (next <= distance) {
      closest = i;
      distance = next;
    }
  }
  return closest;
}
function round10(value) {
  return Math.round(value * 10000000000) / 10000000000;
}
function isInteractive(context) {
  return context.readOnly !== true && context.disabled !== true;
}
// packages/runtime/src/directives/use.ts
function createAction(fn) {
  return (node, param) => untrack(() => fn(node, param) ?? undefined);
}
function runAction(node, action, paramThunk) {
  if (typeof action !== "function")
    return;
  let result;
  let started = false;
  effect(() => {
    const param = paramThunk === undefined ? undefined : paramThunk();
    if (!started) {
      started = true;
      result = action(node, param) ?? undefined;
    } else {
      result?.update?.(param);
    }
  });
  own(() => {
    result?.destroy?.();
  });
}
function on(el, event, handler) {
  const wrapped = (e) => {
    handler(e);
  };
  el.addEventListener(event, wrapped);
  const stop = () => el.removeEventListener(event, wrapped);
  try {
    own(stop);
  } catch {}
  return stop;
}
// packages/runtime/src/directives/bind.ts
function bindText(node, get) {
  let last;
  effect(() => {
    const v = get();
    if (v !== last) {
      last = v;
      node.data = v == null ? "" : String(v);
    }
  });
}
function classOf(classes) {
  const out = [];
  const push = (text) => {
    for (const token of text.split(/\s+/)) {
      if (token.length > 0)
        out.push(token);
    }
  };
  const part = (value) => {
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value)
        part(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [name, condition] of Object.entries(value)) {
        if (!condition)
          continue;
        push(name);
      }
    }
  };
  part(classes);
  return out.join(" ");
}
function bindAttr(el, name, get) {
  let last = Symbol("init");
  effect(() => {
    const v = get();
    if (Object.is(v, last))
      return;
    last = v;
    if (v === undefined || v === null || v === false) {
      el.removeAttribute(name);
    } else if (v === true) {
      el.setAttribute(name, "");
    } else {
      el.setAttribute(name, String(v));
    }
  });
}
function bindProp(el, name, get) {
  const view = el;
  effect(() => {
    view[name] = get();
  });
}
function bindDynamic(el, name, get) {
  const isCustom = el.tagName.includes("-");
  if (isCustom)
    bindProp(el, name, get);
  else
    bindAttr(el, name, get);
}
function bindValue(el, source) {
  const view = el;
  let last = source();
  view["value"] = last;
  const onInput = () => {
    const next = view["value"];
    if (next === last)
      return;
    last = next;
    source.set(next);
  };
  el.addEventListener("input", onInput);
  const stopInput = () => el.removeEventListener("input", onInput);
  let stopEffect = () => {};
  {
    const owner = scope();
    const stop = owner.run(() => effect(() => {
      const next = source();
      if (next === last)
        return;
      last = next;
      if (view["value"] !== next)
        view["value"] = next;
    }));
    const dispose = () => owner.dispose();
    stopEffect = dispose;
  }
  const stop = () => {
    stopInput();
    stopEffect();
  };
  try {
    own(stop);
  } catch {}
  return {
    pull() {
      const next = source();
      if (next === last)
        return;
      last = next;
      if (view["value"] !== next)
        view["value"] = next;
    },
    stop
  };
}
function bindChecked(el, source) {
  let last = source();
  el.checked = last;
  const onInput = () => {
    const next = el.checked;
    if (next === last)
      return;
    last = next;
    source.set(next);
  };
  el.addEventListener("input", onInput);
  const stopInput = () => el.removeEventListener("input", onInput);
  let stopEffect = () => {};
  {
    const owner = scope();
    owner.run(() => effect(() => {
      const next = source();
      if (next === last)
        return;
      last = next;
      el.checked = next;
    }));
    stopEffect = () => owner.dispose();
  }
  const stop = () => {
    stopInput();
    stopEffect();
  };
  try {
    own(stop);
  } catch {}
  return {
    pull() {
      const next = source();
      if (next === last)
        return;
      last = next;
      el.checked = next;
    },
    stop
  };
}
var projectedSlots = new WeakMap;
function projectSlots(el) {
  const cached = projectedSlots.get(el);
  if (cached !== undefined) {
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 8)
        continue;
      el.removeChild(node);
    }
    return cached;
  }
  const groups = new Map;
  for (const node of [...el.childNodes]) {
    if (node.nodeType === 8)
      continue;
    const name = node instanceof Element ? node.getAttribute("slot") ?? "" : "";
    const group = groups.get(name);
    if (group !== undefined)
      group.push(node);
    else
      groups.set(name, [node]);
    el.removeChild(node);
  }
  projectedSlots.set(el, groups);
  return groups;
}
function placeSlot(host, anchor, assigned, fallback) {
  const nodes = assigned !== undefined && assigned.length > 0 ? assigned : fallback;
  for (const n of nodes) {
    if (n.parentNode !== host || n.nextSibling !== anchor) {
      host.insertBefore(n, anchor);
    }
  }
}
// packages/runtime/src/directives/for.ts
function bindFor(opts) {
  const { anchor, items, key, render } = opts;
  const parent = () => anchor.parentNode;
  let cells = [];
  let index = new Map;
  let last;
  const sync = (list) => {
    const host = parent();
    if (host === null)
      return;
    const next = new Array(list.length);
    for (let i = 0;i < list.length; i++) {
      const item = list[i];
      const k = key(item, i);
      const bucket = index.get(k);
      const hit = bucket !== undefined && bucket.at < bucket.cells.length ? bucket.cells[bucket.at++] : undefined;
      if (hit !== undefined) {
        hit.item = item;
        next[i] = hit;
      } else {
        const owner = scope();
        let rendered;
        untrack(() => {
          owner.run(() => {
            rendered = render(item, i);
          });
        });
        const nodes = [...rendered.nodes];
        for (const n of nodes)
          host.insertBefore(n, anchor);
        const cell = { key: k, item, rendered, nodes, owner };
        next[i] = cell;
      }
    }
    const dead = [];
    const keep = new Set;
    for (const cell of next)
      for (const n of cell.nodes)
        keep.add(n);
    for (const cell of cells) {
      let alive = false;
      for (const n of cell.nodes) {
        if (keep.has(n)) {
          alive = true;
          break;
        }
      }
      if (!alive)
        dead.push(cell);
    }
    let cursor = anchor;
    for (let idx = next.length - 1;idx >= 0; idx--) {
      const cell = next[idx];
      if (cell.nodes.length === 0)
        continue;
      for (let k = cell.nodes.length - 1;k >= 0; k--) {
        const n = cell.nodes[k];
        if (n.parentNode !== host)
          host.insertBefore(n, cursor);
        else if (n.nextSibling !== cursor)
          host.insertBefore(n, cursor);
        cursor = n;
      }
    }
    for (let i = 0;i < next.length; i++) {
      const cell = next[i];
      cell.rendered.update?.(cell.item, i);
    }
    for (const cell of dead) {
      for (const n of cell.nodes) {
        if (n.parentNode === host)
          host.removeChild(n);
      }
      cell.rendered.cleanup?.();
      cell.owner.dispose();
    }
    cells = next;
    const rebuilt = new Map;
    for (const cell of next) {
      const bucket = rebuilt.get(cell.key);
      if (bucket === undefined)
        rebuilt.set(cell.key, { cells: [cell], at: 0 });
      else
        bucket.cells.push(cell);
    }
    index = rebuilt;
  };
  effect(() => {
    const v = items();
    if (v !== last) {
      last = v;
      sync(v ?? []);
    }
  });
  const stop = () => {
    for (const cell of cells) {
      cell.rendered.cleanup?.();
      cell.owner.dispose();
    }
    cells = [];
  };
  try {
    own(stop);
  } catch {}
  return stop;
}
// packages/runtime/src/directives/if.ts
function bindIf(opts) {
  const { anchor, test, branches } = opts;
  let nodes = [];
  let cleanup;
  let owner;
  let last;
  const teardown = () => {
    cleanup?.();
    cleanup = undefined;
    owner?.dispose();
    owner = undefined;
    const host = anchor.parentNode;
    if (host !== null) {
      for (const n of nodes) {
        if (n.parentNode === host)
          host.removeChild(n);
      }
    }
    nodes = [];
  };
  effect(() => {
    const v = test();
    if (v === last)
      return;
    last = v;
    teardown();
    if (v < 0 || v >= branches.length)
      return;
    const next = scope();
    owner = next;
    let rendered;
    next.run(() => untrack(() => {
      rendered = branches[v]();
    }));
    cleanup = rendered.cleanup;
    nodes = rendered.nodes;
    const host = anchor.parentNode;
    if (host !== null) {
      for (const n of nodes)
        host.insertBefore(n, anchor);
    }
  });
  const stop = () => teardown();
  try {
    own(stop);
  } catch {}
  return stop;
}
// packages/runtime/src/directives/tpl.ts
function tpl(html) {
  let proto;
  return () => {
    if (proto === undefined) {
      const t = document.createElement("template");
      t.innerHTML = html;
      proto = t.content.firstElementChild;
    }
    return proto.cloneNode(true);
  };
}
function view(parts, nodes) {
  const host = document.createDocumentFragment();
  for (const n of nodes)
    host.appendChild(n);
  const rendered = {
    node: host,
    update() {
      const n = parts.length;
      for (let i = 0;i < n; i++)
        parts[i]();
    }
  };
  rendered.update();
  return rendered;
}
function text(initial = "") {
  const node = document.createTextNode(initial);
  return {
    node,
    set(value) {
      const next = String(value);
      if (node.data === next)
        return;
      node.data = next;
    }
  };
}
// packages/runtime/src/syntax/braces.ts
function matchBrace(source, start, end) {
  let depth = 0;
  let j = start;
  while (j < end) {
    const c = source[j];
    if (c === '"' || c === "'" || c === "`") {
      j = skipQuoted(source, j, end);
      continue;
    }
    if (c === "{")
      depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0)
        return j;
    }
    j++;
  }
  return end;
}
function skipQuoted(source, i, end) {
  const q = source[i];
  let j = i + 1;
  while (j < end) {
    if (source[j] === "\\") {
      j += 2;
      continue;
    }
    if (source[j] === q)
      return j + 1;
    j++;
  }
  return end;
}
// packages/runtime/src/syntax/display.ts
var WHITESPACE = /\s/;
var NAME_STOP = /[\s=/>]/;
function scanRun(html, i) {
  const open = html[i];
  if (open === '"' || open === "'" || open === "`") {
    return skipQuoted(html, i, html.length);
  }
  if (open === "{") {
    const close = matchBrace(html, i, html.length);
    return close >= html.length ? html.length : close + 1;
  }
  return i;
}
function tokenizeHtml(html) {
  const out = [];
  const push = (type, value) => {
    if (value !== "")
      out.push({ type, value });
  };
  let i = 0;
  const pushTextRuns = (from, to) => {
    let j = from;
    while (j < to) {
      const open = html.indexOf("{", j);
      if (open === -1 || open >= to) {
        push("text", html.slice(j, to));
        return;
      }
      if (open > j)
        push("text", html.slice(j, open));
      const stop = scanRun(html, open);
      push("expr", html.slice(open, Math.min(stop, to)));
      j = Math.min(stop, to);
      if (stop >= to)
        return;
    }
  };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      pushTextRuns(i, html.length);
      break;
    }
    if (lt > i)
      pushTextRuns(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      push("comment", html.slice(lt, stop));
      i = stop;
      continue;
    }
    push("punct", "<");
    i = lt + 1;
    if (html[i] === "/") {
      push("punct", "/");
      i += 1;
    }
    let end = i;
    while (end < html.length && !WHITESPACE.test(html[end]) && html[end] !== ">" && html[end] !== "/") {
      end += 1;
    }
    push("tag", html.slice(i, end));
    i = end;
    while (i < html.length) {
      const ch = html[i];
      if (ch === ">") {
        push("punct", ">");
        i += 1;
        break;
      }
      if (ch === "/" && html[i + 1] === ">") {
        push("punct", "/>");
        i += 2;
        break;
      }
      if (WHITESPACE.test(ch)) {
        let stop = i;
        while (stop < html.length && WHITESPACE.test(html[stop]))
          stop += 1;
        push("text", html.slice(i, stop));
        i = stop;
        continue;
      }
      if (ch === "/") {
        push("punct", "/");
        i += 1;
        continue;
      }
      if (ch === "{") {
        const stop = scanRun(html, i);
        push("expr", html.slice(i, stop));
        i = stop;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd])) {
        attrEnd += 1;
      }
      push("attr", html.slice(i, attrEnd));
      i = attrEnd;
      if (html[i] === "=") {
        push("punct", "=");
        i += 1;
        if (html[i] === '"' || html[i] === "'") {
          const stop = scanRun(html, i);
          push("string", html.slice(i, stop));
          i = stop;
        } else {
          let stop = i;
          while (stop < html.length && !WHITESPACE.test(html[stop]) && html[stop] !== ">") {
            stop += 1;
          }
          push("string", html.slice(i, stop));
          i = stop;
        }
      }
    }
  }
  return out;
}
var FORMAT_INDENT = "  ";
var VERBATIM_TAGS = {
  pre: true,
  textarea: true,
  listing: true
};
var VOID_TAGS = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true
};
function parseForFormat(html) {
  const roots = [];
  const stack = [];
  const parentChildren = () => stack.length === 0 ? roots : stack[stack.length - 1].children;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      parentChildren().push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) {
      parentChildren().push({ kind: "text", text: html.slice(i, lt) });
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      const stop = end === -1 ? html.length : end + 3;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const end = html.indexOf(">", lt);
      const stop = end === -1 ? html.length : end + 1;
      const name = html.slice(lt + 2, stop - 1).trim().toLowerCase();
      let match = -1;
      for (let s = stack.length - 1;s >= 0; s--) {
        if (stack[s].tag.toLowerCase() === name) {
          match = s;
          break;
        }
      }
      if (match !== -1) {
        stack.length = match;
      } else {
        parentChildren().push({ kind: "raw", text: html.slice(lt, stop) });
      }
      i = stop;
      continue;
    }
    i = lt + 1;
    let nameEnd = i;
    while (nameEnd < html.length && !WHITESPACE.test(html[nameEnd]) && html[nameEnd] !== ">" && html[nameEnd] !== "/") {
      nameEnd += 1;
    }
    const tag = html.slice(i, nameEnd);
    i = nameEnd;
    const attrs = [];
    let selfClose = false;
    while (i < html.length) {
      const ch = html[i];
      if (WHITESPACE.test(ch)) {
        i += 1;
        continue;
      }
      if (ch === ">") {
        i += 1;
        break;
      }
      if (ch === "/") {
        if (html[i + 1] === ">") {
          selfClose = true;
          i += 2;
          break;
        }
        i += 1;
        continue;
      }
      let attrEnd = i;
      while (attrEnd < html.length && !NAME_STOP.test(html[attrEnd])) {
        attrEnd += 1;
      }
      const name = html.slice(i, attrEnd);
      i = attrEnd;
      if (html[i] !== "=") {
        attrs.push([name, undefined]);
        continue;
      }
      i += 1;
      const quote = html[i];
      if (quote === '"' || quote === "'" || quote === "{") {
        const stop = scanRun(html, i);
        attrs.push([name, html.slice(i, stop)]);
        i = stop;
      } else {
        let stop = i;
        while (stop < html.length && !WHITESPACE.test(html[stop]) && html[stop] !== ">") {
          stop += 1;
        }
        attrs.push([name, stop > i ? `"${html.slice(i, stop)}"` : undefined]);
        i = stop;
      }
    }
    const element = {
      kind: "element",
      tag,
      attrs,
      children: [],
      selfClose
    };
    parentChildren().push(element);
    const lower = tag.toLowerCase();
    if (!selfClose && VOID_TAGS[lower] !== true) {
      if (VERBATIM_TAGS[lower] === true) {
        const close = html.toLowerCase().indexOf(`</${lower}`, i);
        const stop = close === -1 ? html.length : close;
        element.raw = html.slice(i, stop);
        if (close !== -1) {
          const gt = html.indexOf(">", close);
          i = gt === -1 ? html.length : gt + 1;
        }
      } else {
        stack.push(element);
      }
    }
  }
  return roots;
}
function formatOpenTag(tag, attrs, depth) {
  const spelled = attrs.map(([name, value]) => {
    if (value === undefined)
      return name;
    const cut = value.lastIndexOf(" ", 160);
    const shown = value.length > 160 ? `${value.slice(0, cut === -1 ? 160 : cut)}…(${value.length} chars)` : value;
    return `${name}=${shown}`;
  });
  if (spelled.length > 2 && spelled.every((s) => !s.includes("{"))) {
    const pad = FORMAT_INDENT.repeat(depth + 1);
    return `<${tag}
${spelled.map((s) => `${pad}${s}`).join(`
`)}
${FORMAT_INDENT.repeat(depth)}`;
  }
  return `<${tag}${spelled.length === 0 ? "" : ` ${spelled.join(" ")}`}`;
}
function formatNode(node, depth) {
  if (node.kind === "text" || node.kind === "raw") {
    return node.text.length > 320 ? `${node.text.slice(0, 320)}…(${node.text.length} chars)` : node.text;
  }
  const pad = FORMAT_INDENT.repeat(depth);
  const open = formatOpenTag(node.tag, node.attrs, depth);
  if (node.raw !== undefined)
    return `${pad}${open}>${node.raw}</${node.tag}>`;
  const close = node.selfClose ? "/>" : `</${node.tag}>`;
  if (node.children.length === 0) {
    return VOID_TAGS[node.tag.toLowerCase()] === true ? `${pad}${open}${node.selfClose ? "/>" : ">"}` : `${pad}${open}>${close}`;
  }
  const inline = node.children.some((c) => c.kind === "text" && !/^\s*$/.test(c.text));
  if (inline) {
    const inner = node.children.map((c) => formatNode(c, 0)).join("");
    return `${pad}${open}>${inner}${close}`;
  }
  const body = node.children.filter((c) => c.kind !== "text" || !/^\s*$/.test(c.text)).map((c) => formatNode(c, depth + 1)).join(`
`);
  return `${pad}${open}>
${body}
${pad}${close}`;
}
function formatExampleHtml(html) {
  const roots = parseForFormat(html).filter((n) => n.kind !== "text" || !/^\s*$/.test(n.text));
  const inline = roots.some((n) => n.kind === "text");
  return roots.map((n) => formatNode(n, 0)).join(inline ? "" : `
`);
}
// packages/runtime/src/syntax/expand-groups.ts
var GROUP = /([^\s:"'()]+):\(([^()]*)\)/g;
function expandOnce(classes) {
  return classes.replace(GROUP, (_match, prefix, body) => {
    const items = body.split(/\s+/).filter((item) => item.length > 0);
    return items.map((item) => `${prefix}:${item}`).join(" ");
  });
}
function expandVariantGroups(source) {
  let prev = source;
  for (let depth = 0;depth < 5; depth++) {
    const next = expandOnce(prev);
    if (next === prev)
      return next;
    prev = next;
  }
  return prev;
}
// packages/runtime/src/syntax/classes.ts
function literalsOf(expression) {
  const out = [];
  const pattern = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
  let match;
  while ((match = pattern.exec(expression)) !== null) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value !== undefined && value.length > 0)
      out.push(value);
  }
  return out;
}
function classTokensOf(value) {
  const out = [];
  const push = (text) => {
    for (const token of expandVariantGroups(text).split(/\s+/)) {
      if (token.length > 0)
        out.push(token);
    }
  };
  if (value.kind === "static") {
    push(value.value);
    return out;
  }
  if (/^\s*[[{]/.test(value.expr)) {
    for (const part of listPartsOf(value.expr)) {
      if (part.kind === "string")
        push(part.value);
      else
        for (const key of part.keys)
          push(key);
    }
    return out;
  }
  for (const literal of literalsOf(value.expr))
    push(literal);
  return out;
}
function listPartsOf(literal) {
  const out = [];
  const body = literal.trim().replace(/^\[/, "").replace(/\]$/, "");
  const parts = splitTop(body);
  for (const part of parts) {
    const text = part.trim();
    if (text.startsWith('"') || text.startsWith("'")) {
      out.push({ kind: "string", value: text.slice(1, -1) });
      continue;
    }
    if (text.startsWith("{")) {
      out.push({ kind: "object", keys: objectKeysOf(text) });
    }
  }
  return out;
}
function splitTop(body) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0;i <= body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(")
      depth++;
    else if (ch === "}" || ch === "]" || ch === ")")
      depth--;
    else if (ch === "," && depth === 0 || i === body.length) {
      const part = body.slice(start, i).trim();
      if (part.length > 0)
        out.push(part);
      start = i + 1;
    }
  }
  return out;
}
function objectKeysOf(literal) {
  const out = [];
  let depth = 0;
  let start = 0;
  const body = literal.trim().replace(/^\{/, "").replace(/\}$/, "");
  for (let i = 0;i <= body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(")
      depth++;
    else if (ch === "}" || ch === "]" || ch === ")")
      depth--;
    else if (ch === "," && depth === 0 || i === body.length) {
      const entry = body.slice(start, i).trim();
      start = i + 1;
      if (entry.length === 0)
        continue;
      const colon = entry.indexOf(":");
      const key = (colon < 0 ? entry : entry.slice(0, colon)).trim();
      const name = /^"([^"]*)"$|^'([^']*)'$/.exec(key);
      if (name !== null)
        out.push(name[1] ?? name[2] ?? "");
    }
  }
  return out.filter((name) => name.length > 0);
}
function tokensOfNode(node, out) {
  if (node.kind === "text") {
    return;
  }
  if (node.kind === "for") {
    for (const child of node.body)
      tokensOfNode(child, out);
    return;
  }
  for (const attr of node.attrs) {
    if (attr.name !== "class")
      continue;
    for (const token of classTokensOf(attr.value))
      out.push(token);
  }
  for (const child of node.children)
    tokensOfNode(child, out);
}
function classTokens(ir) {
  const out = [];
  for (const node of ir.nodes)
    tokensOfNode(node, out);
  return out;
}
function classAttrOf(node) {
  return node.attrs.find((attr) => attr.name === "class");
}
// packages/runtime/src/syntax/script-block.ts
var IMPORT_START = /^import(?:\s|\{|\*)/;
var TYPE_START = /^(?:export\s+)?(?:type|interface)\b/;
var MACHINE_CALL_START = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/;
function matchParen(source, openParen) {
  const end = source.length;
  let depth = 0;
  let i = openParen;
  while (i < end) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(source, i, end);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf(`
`, i + 2);
      i = nl < 0 ? end : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? end : close + 2;
      continue;
    }
    if (c === "(")
      depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0)
        return i;
    }
    i += 1;
  }
  return -1;
}
function scanStatementEnd(source, start) {
  const end = source.length;
  let depth = 0;
  let i = start;
  while (i < end) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipQuoted(source, i, end);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf(`
`, i + 2);
      if (depth === 0)
        return nl < 0 ? end : nl;
      i = nl < 0 ? end : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const close = source.indexOf("*/", i + 2);
      i = close < 0 ? end : close + 2;
      continue;
    }
    if (c === "{" || c === "(" || c === "[")
      depth += 1;
    else if (c === "}" || c === ")" || c === "]") {
      depth = Math.max(0, depth - 1);
    } else if (c === `
` && depth === 0) {
      const rest = source.slice(i + 1).trimStart();
      if (rest.startsWith("|") || rest.startsWith("&")) {
        i += 1;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return end;
}
function stripScript(body) {
  const kept = [];
  const bindings = [];
  const calls = [];
  const consumes = [];
  const stripped = [];
  const len = body.length;
  let pos = 0;
  while (pos < len) {
    const lineStart = pos;
    while (pos < len && (body[pos] === " " || body[pos] === "\t" || body[pos] === "\r"))
      pos += 1;
    if (pos >= len) {
      kept.push(body.slice(lineStart));
      break;
    }
    if (body[pos] === `
`) {
      kept.push(body.slice(lineStart, pos));
      pos += 1;
      continue;
    }
    const rest = body.slice(pos);
    if (rest.startsWith("//")) {
      const nl = body.indexOf(`
`, pos);
      const end = nl < 0 ? len : nl;
      kept.push(body.slice(lineStart, end));
      pos = nl < 0 ? len : nl + 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      const close = body.indexOf("*/", pos + 2);
      const after = close < 0 ? len : close + 2;
      const nl = body.indexOf(`
`, after);
      const end = nl < 0 ? len : nl;
      kept.push(body.slice(lineStart, end));
      pos = nl < 0 ? len : nl + 1;
      continue;
    }
    if (IMPORT_START.test(rest) || TYPE_START.test(rest)) {
      const stmtEnd = scanStatementEnd(body, pos);
      kept.push(body.slice(lineStart, stmtEnd));
      pos = stmtEnd < len && body[stmtEnd] === `
` ? stmtEnd + 1 : stmtEnd;
      continue;
    }
    const callMatch = MACHINE_CALL_START.exec(rest);
    if (callMatch !== null) {
      const name = callMatch[1] ?? "";
      const factory = callMatch[2] ?? "";
      const openParen = pos + callMatch[0].length - 1;
      const closeParen = matchParen(body, openParen);
      if (closeParen >= 0) {
        const nl = body.indexOf(`
`, closeParen);
        const lineEnd = nl < 0 ? len : nl;
        const tail = body.slice(closeParen + 1, lineEnd).trim();
        if (tail === "" || tail === ";" || tail.startsWith("//")) {
          if (factory === "consume") {
            kept.push(body.slice(lineStart, lineEnd));
            bindings.push(name);
            consumes.push({
              name,
              handle: body.slice(openParen + 1, closeParen).trim()
            });
          } else {
            kept.push(body.slice(lineStart, lineEnd));
            bindings.push(name);
            calls.push({
              name,
              factory,
              args: body.slice(openParen + 1, closeParen).trim()
            });
          }
          pos = nl < 0 ? len : nl + 1;
          continue;
        }
      }
    }
    const nl = body.indexOf(`
`, pos);
    const lineEnd = nl < 0 ? len : nl;
    stripped.push(body.slice(lineStart, lineEnd));
    pos = nl < 0 ? len : nl + 1;
  }
  return { module: kept.join(`
`), bindings, calls, consumes, stripped };
}
function extractScript(source) {
  const open = /<script(\s[^>]*)?>/.exec(source);
  if (open === null || open.index === undefined)
    return;
  const bodyStart = open.index + open[0].length;
  const close = source.indexOf("</script>", bodyStart);
  if (close < 0)
    return;
  return source.slice(bodyStart, close);
}
// packages/runtime/src/syntax/ir.ts
class ParseError extends Error {
  diagnostics;
  constructor(diagnostics) {
    super(diagnostics.map((d) => `${d.code}: ${d.message}`).join(`
`));
    this.diagnostics = diagnostics;
  }
}

// packages/runtime/src/syntax/parse.ts
var VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);
var span = (start, end) => ({ start, end });
function fail(p, code, message, start, end) {
  p.errors.push({ code, message, span: span(start, end) });
}
function skipWs(p) {
  while (p.pos < p.src.length && /\s/.test(p.src[p.pos]))
    p.pos++;
}
function readTagName(p) {
  const start = p.pos;
  while (p.pos < p.src.length && /[A-Za-z0-9\-\._:]/.test(p.src[p.pos]))
    p.pos++;
  return p.src.slice(start, p.pos);
}
function readAttrValue(p) {
  const quote = p.src[p.pos];
  if (quote === '"' || quote === "'") {
    const qStart = p.pos;
    p.pos++;
    const start = p.pos;
    let value = "";
    for (;; ) {
      if (p.pos >= p.src.length)
        break;
      const ch = p.src[p.pos];
      if (ch === quote) {
        p.pos++;
        break;
      }
      if (ch === "{") {
        const close = matchBrace(p.src, p.pos, p.src.length);
        value += p.src.slice(p.pos, close + 1);
        p.pos = close + 1;
        continue;
      }
      value += ch;
      p.pos++;
    }
    return { value, start, end: p.pos };
  }
  const start = p.pos;
  if (p.src[p.pos] === "{") {
    const close = matchBrace(p.src, p.pos, p.src.length);
    const value = p.src.slice(p.pos, close + 1);
    p.pos = close + 1;
    return { value, start, end: p.pos };
  }
  while (p.pos < p.src.length && !/[\s/>]/.test(p.src[p.pos]))
    p.pos++;
  return { value: p.src.slice(start, p.pos), start, end: p.pos };
}
function attrValue(raw, start, end) {
  const t = raw.trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    return {
      kind: "expr",
      expr: t.slice(1, -1).trim(),
      span: span(start, end)
    };
  }
  return { kind: "static", value: raw };
}
function parseText(p) {
  const start = p.pos;
  while (p.pos < p.src.length && p.src[p.pos] !== "<")
    p.pos++;
  const raw = p.src.slice(start, p.pos);
  const mixed = [];
  let last = 0;
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf("{", i);
    if (open === -1)
      break;
    const close = matchBrace(raw, open, raw.length);
    if (close >= raw.length)
      break;
    if (open > last) {
      const seg = raw.slice(last, open);
      mixed.push({ kind: "static", value: seg.includes("&") ? seg.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
        if (body[0] === "#") {
          const isHex = body[1] === "x" || body[1] === "X";
          const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
          if (Number.isNaN(code) || code < 0 || code > 1114111)
            return m;
          try {
            return String.fromCodePoint(code);
          } catch {
            return m;
          }
        }
        return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "×", mdash: "—", ndash: "–", hellip: "…", copy: "©" }[body] ?? m;
      }) : seg });
    }
    mixed.push({ kind: "expr", expr: raw.slice(open + 1, close).trim(), span: span(start + open, start + close + 1) });
    last = close + 1;
    i = close + 1;
  }
  if (last < raw.length) {
    const seg = raw.slice(last);
    mixed.push({ kind: "static", value: seg.includes("&") ? seg.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
      if (body[0] === "#") {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isNaN(code) || code < 0 || code > 1114111)
          return m;
        try {
          return String.fromCodePoint(code);
        } catch {
          return m;
        }
      }
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", times: "×", mdash: "—", ndash: "–", hellip: "…", copy: "©" }[body] ?? m;
    }) : seg });
  }
  return { kind: "text", parts: mixed, span: span(start, p.pos) };
}
function parseElement(p) {
  const start = p.pos;
  p.pos++;
  if (p.src[p.pos] === "/") {
    fail(p, "stray-close", "closing tag without an opener", start, p.pos + 1);
    while (p.pos < p.src.length && p.src[p.pos] !== ">")
      p.pos++;
    p.pos++;
    return { kind: "text", parts: [], span: span(start, p.pos) };
  }
  const tag = readTagName(p);
  const attrs = [];
  const events = [];
  const actions = [];
  const spreads = [];
  for (;; ) {
    skipWs(p);
    if (p.pos >= p.src.length)
      break;
    const ch = p.src[p.pos];
    if (ch === ">") {
      p.pos++;
      break;
    }
    if (ch === "/" && p.src[p.pos + 1] === ">") {
      p.pos += 2;
      return finishElement(p, tag, attrs, events, actions, spreads, [], start, p.pos);
    }
    const aStart = p.pos;
    let name = "";
    if (p.src[p.pos] === "{" && p.src.slice(p.pos, p.pos + 4) === "{...") {
      let depth = 0;
      let quote;
      while (p.pos < p.src.length) {
        const c = p.src[p.pos];
        if (quote !== undefined) {
          name += c;
          if (c === quote)
            quote = undefined;
        } else if (c === '"' || c === "'") {
          quote = c;
          name += c;
        } else if (c === "{") {
          depth++;
          name += c;
        } else if (c === "}") {
          depth--;
          name += c;
          if (depth === 0) {
            p.pos++;
            break;
          }
        } else {
          name += c;
        }
        p.pos++;
      }
    } else {
      while (p.pos < p.src.length && !/[\s=/>]/.test(p.src[p.pos])) {
        name += p.src[p.pos];
        p.pos++;
      }
    }
    skipWs(p);
    let raw = "";
    let vStart = p.pos;
    let vEnd = p.pos;
    if (p.src[p.pos] === "=") {
      p.pos++;
      skipWs(p);
      const v = readAttrValue(p);
      raw = v.value;
      vStart = v.start;
      vEnd = v.end;
    }
    const aSpan = span(aStart, p.pos);
    if (name.startsWith("{...") && name.endsWith("}")) {
      spreads.push({ expr: name.slice(4, -1).trim(), span: aSpan });
    } else if (name.startsWith("on:")) {
      const body = raw.trim();
      const handler = body.startsWith("{") && body.endsWith("}") ? body.slice(1, -1).trim() : body;
      events.push({ event: name.slice(3), handler, span: aSpan });
    } else if (name.startsWith("use:")) {
      const body = raw.trim();
      const param = body.startsWith("{") && body.endsWith("}") ? body.slice(1, -1).trim() : body.length > 0 ? JSON.stringify(body) : undefined;
      actions.push({ name: name.slice(4), param, span: aSpan });
    } else if (name === "for" || name === "as" || name === "key") {
      attrs.push({ name, value: attrValue(raw, vStart, vEnd), span: aSpan });
    } else {
      attrs.push({ name, value: attrValue(raw, vStart, vEnd), span: aSpan });
    }
  }
  if (VOID.has(tag)) {
    return finishElement(p, tag, attrs, events, actions, spreads, [], start, p.pos);
  }
  if (tag === "template") {
    return parseTemplate(p, attrs, events, actions, start);
  }
  const children = [];
  for (;; ) {
    skipWs(p);
    if (p.pos >= p.src.length) {
      fail(p, "unclosed", `element <${tag}> is never closed`, start, p.pos);
      break;
    }
    if (p.src[p.pos] === "<" && p.src[p.pos + 1] === "/") {
      p.pos += 2;
      const close = readTagName(p);
      skipWs(p);
      if (p.src[p.pos] === ">")
        p.pos++;
      if (close !== tag) {
        fail(p, "mismatch", `expected </${tag}> but found </${close}>`, start, p.pos);
      }
      break;
    }
    if (p.src[p.pos] === "<") {
      children.push(parseElement(p));
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0)
        children.push(t);
    }
  }
  return finishElement(p, tag, attrs, events, actions, spreads, children, start, p.pos);
}
function finishElement(p, tag, attrs, events, actions, spreads, children, start, end) {
  const at = attrs.findIndex((a) => a.name === "show");
  let show;
  if (at !== -1) {
    const found = attrs[at];
    if (found.value.kind !== "expr") {
      fail(p, "show-static", "`show` needs an expression: show={cond}", found.span.start, found.span.end);
    } else {
      show = found.value.expr;
    }
    attrs.splice(at, 1);
  }
  return { kind: "element", tag, attrs, events, actions, spreads, children, ...show !== undefined ? { show } : {}, span: span(start, end) };
}
function templateAttr(attrs, name) {
  const found = attrs.find((a) => a.name === name);
  if (!found)
    return;
  const v = found.value;
  if (v.kind === "static")
    return v.value;
  return `{${v.expr}}`;
}
function parseTemplate(p, attrs, events, actions, start) {
  const rawFor = templateAttr(attrs, "for");
  const rawAs = templateAttr(attrs, "as");
  const rawKey = templateAttr(attrs, "key");
  if (rawFor === undefined) {
    fail(p, "template-for", "<template> needs a for={items} attribute", start, p.pos);
  }
  const source = rawFor !== undefined && rawFor.startsWith("{") && rawFor.endsWith("}") ? rawFor.slice(1, -1).trim() : rawFor ?? "";
  const binding = rawAs !== undefined && rawAs.startsWith("{") && rawAs.endsWith("}") ? rawAs.slice(1, -1).trim() : rawAs ?? "item";
  const key = rawKey !== undefined && rawKey.startsWith("{") && rawKey.endsWith("}") ? rawKey.slice(1, -1).trim() : rawKey;
  const body = [];
  for (;; ) {
    skipWs(p);
    if (p.pos >= p.src.length) {
      fail(p, "unclosed", "<template> is never closed", start, p.pos);
      break;
    }
    if (p.src[p.pos] === "<" && p.src[p.pos + 1] === "/") {
      p.pos += 2;
      const close = readTagName(p);
      skipWs(p);
      if (p.src[p.pos] === ">")
        p.pos++;
      if (close !== "template") {
        fail(p, "mismatch", `expected </template> but found </${close}>`, start, p.pos);
      }
      break;
    }
    if (p.src[p.pos] === "<") {
      body.push(parseElement(p));
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0)
        body.push(t);
    }
  }
  return { kind: "for", source, binding, key, body, span: span(start, p.pos) };
}
function parse(source) {
  const p = { src: source, pos: 0, errors: [] };
  const nodes = [];
  for (;; ) {
    skipWs(p);
    if (p.pos >= p.src.length)
      break;
    if (p.src[p.pos] === "<") {
      const n = parseElement(p);
      if (n.kind === "text" && n.parts.length === 0)
        continue;
      nodes.push(n);
    } else {
      const t = parseText(p);
      if (t.kind === "text" && t.parts.length > 0)
        nodes.push(t);
    }
  }
  if (p.errors.length > 0)
    throw new ParseError(p.errors);
  return { nodes };
}
// packages/runtime/src/aria.ts
function targetId(scope, target) {
  if (target === undefined)
    return;
  if ("id" in target)
    return target.id;
  if ("parts" in target) {
    const ids = target.parts.map((ref) => scope.id(ref.part, ref.slot));
    return ids.length > 0 ? ids.join(" ") : undefined;
  }
  return scope.id(target.part, target.slot);
}
function ariaDisabled(state) {
  return { "aria-disabled": state };
}
function ariaHidden(state) {
  return { "aria-hidden": state };
}
function ariaInvalid(state) {
  return { "aria-invalid": state };
}
function ariaPressed(state) {
  return { "aria-pressed": state };
}
function ariaBusy(state) {
  return { "aria-busy": state };
}
function ariaCurrent(place) {
  return { "aria-current": place };
}
function ariaOrientation(dir) {
  return { "aria-orientation": dir };
}
function ariaRoleDescription(text) {
  return { "aria-roledescription": text };
}
function ariaDescription(text) {
  return { "aria-description": text };
}
function ariaAutocomplete(mode) {
  return { "aria-autocomplete": mode };
}
function ariaFlag(value) {
  return value ? true : undefined;
}
function ariaState(value) {
  if (typeof value === "boolean")
    return value;
  if (value === "true")
    return "true";
  if (value === "false")
    return "false";
  return;
}
function ariaRequired(state) {
  return { "aria-required": state };
}
function ariaReadOnly(state) {
  return { "aria-readonly": state };
}
function ariaDescribedBy(scope, target) {
  return { "aria-describedby": targetId(scope, target) };
}
function ariaLabelledBy(scope, target) {
  return { "aria-labelledby": targetId(scope, target) };
}
function ariaControls(scope, target) {
  return { "aria-controls": targetId(scope, target) };
}
function ariaOwns(scope, target) {
  return { "aria-owns": targetId(scope, target) };
}
function liveRegion(init) {
  return {
    ..."live" in init ? { "aria-live": init.live } : {},
    ..."atomic" in init ? { "aria-atomic": init.atomic } : {},
    ..."relevant" in init ? { "aria-relevant": init.relevant } : {}
  };
}
function disclosureTrigger(scope, init) {
  return {
    ..."expanded" in init ? { "aria-expanded": init.expanded } : {},
    ..."hasPopup" in init ? { "aria-haspopup": init.hasPopup } : {},
    ..."controls" in init ? { "aria-controls": targetId(scope, init.controls) } : {}
  };
}
function listSurface(scope, init) {
  return {
    ..."labelledBy" in init ? { "aria-labelledby": targetId(scope, init.labelledBy) } : {},
    ..."activeDescendant" in init ? { "aria-activedescendant": targetId(scope, init.activeDescendant) } : {},
    ..."multiSelectable" in init ? { "aria-multiselectable": init.multiSelectable } : {},
    ..."required" in init ? { "aria-required": init.required } : {},
    ..."readOnly" in init ? { "aria-readonly": init.readOnly } : {}
  };
}
function comboboxInput(scope, init) {
  return {
    ..."autocomplete" in init ? ariaAutocomplete(init.autocomplete) : {},
    ..."controls" in init ? { "aria-controls": targetId(scope, init.controls) } : {},
    ..."expanded" in init ? { "aria-expanded": init.expanded } : {},
    ..."activeDescendant" in init ? { "aria-activedescendant": targetId(scope, init.activeDescendant) } : {}
  };
}
function sliderThumb(init) {
  return {
    ..."min" in init ? { "aria-valuemin": init.min } : {},
    ..."max" in init ? { "aria-valuemax": init.max } : {},
    ..."now" in init ? { "aria-valuenow": init.now } : {},
    ..."text" in init ? { "aria-valuetext": init.text } : {}
  };
}
function optionRow(init) {
  return {
    ..."selected" in init ? { "aria-selected": init.selected } : {},
    ..."checked" in init ? { "aria-checked": init.checked } : {},
    ..."posInSet" in init ? { "aria-posinset": init.posInSet } : {},
    ..."setSize" in init ? { "aria-setsize": init.setSize } : {},
    ..."level" in init ? { "aria-level": init.level } : {},
    ..."disabled" in init ? ariaDisabled(init.disabled) : {}
  };
}
// packages/runtime/src/actions/action.ts
function createAction2(fn) {
  return (node, param) => untrack(() => fn(node, param) ?? undefined);
}
function runAction2(node, action, paramThunk) {
  if (typeof action !== "function")
    return;
  let result;
  let started = false;
  effect(() => {
    const param = paramThunk === undefined ? undefined : paramThunk();
    if (!started) {
      started = true;
      result = action(node, param) ?? undefined;
    } else {
      result?.update?.(param);
    }
  });
  own(() => {
    result?.destroy?.();
  });
}

// packages/runtime/src/actions/form-control.ts
var formControl = createAction2((node, param) => {
  const stops = [];
  let observer;
  const reportFieldset = (fieldset) => {
    param?.onDisabledChange?.(fieldset !== null && fieldset.disabled);
  };
  const onReset = (event) => {
    event.preventDefault();
    param?.onFormReset?.();
  };
  queueMicrotask(() => {
    const fieldset = node.closest("fieldset");
    const form = node.closest("form");
    reportFieldset(fieldset);
    if (fieldset !== null && typeof MutationObserver === "function") {
      observer = new MutationObserver(() => reportFieldset(fieldset));
      observer.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    }
    if (form !== null) {
      form.addEventListener("reset", onReset);
      stops.push(() => form.removeEventListener("reset", onReset));
    }
  });
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      observer?.disconnect();
      for (const stop of stops)
        stop();
    }
  };
});

// packages/runtime/src/actions/anchor.ts
var anchor = createAction2((node, param) => {
  let current = param;
  let last;
  const resolveAnchor = () => current?.anchor instanceof Element ? current.anchor : node.previousElementSibling;
  const resolveHost = () => node instanceof HTMLElement ? node.offsetParent ?? node.parentElement : null;
  const measure = () => {
    const anchorEl = resolveAnchor();
    if (!(anchorEl instanceof HTMLElement))
      return;
    if (!(node instanceof HTMLElement))
      return;
    const topLayer = (() => {
      try {
        return node.matches(":popover-open");
      } catch {
        return false;
      }
    })();
    const host = topLayer ? null : resolveHost();
    if (!topLayer && host === null)
      return;
    const gap = current?.offset ?? 8;
    const want = current?.placement ?? "bottom";
    const anchorRect = anchorEl.getBoundingClientRect();
    const hostRect = host?.getBoundingClientRect();
    const hostLeft = hostRect?.left ?? 0;
    const hostTop = hostRect?.top ?? 0;
    const hostBottom = hostRect?.bottom ?? globalThis.innerHeight ?? 0;
    const panelHeight = node.offsetHeight;
    const panelWidth = node.offsetWidth;
    const viewportBottom = Number.isFinite(globalThis.innerHeight) ? globalThis.innerHeight : hostBottom;
    const roomBelow = Math.max(hostBottom - anchorRect.bottom - gap, viewportBottom - anchorRect.bottom - gap);
    const roomAbove = Math.max(anchorRect.top - hostTop - gap, anchorRect.top - gap);
    const hostRight = hostRect?.right ?? globalThis.innerWidth ?? 0;
    const roomRight = hostRight - anchorRect.right - gap;
    const hostLeftEdge = hostRect?.left ?? 0;
    const roomLeft = anchorRect.left - hostLeftEdge - gap;
    const horizontal = want === "left" || want === "right";
    const placement = horizontal ? want === "right" ? roomRight < panelWidth && roomLeft > roomRight ? "left" : "right" : roomLeft < panelWidth && roomRight > roomLeft ? "right" : "left" : want === "bottom" ? roomBelow < panelHeight && roomAbove > roomBelow ? "top" : "bottom" : roomAbove < panelHeight && roomBelow > roomAbove ? "bottom" : "top";
    const viewportWidth = globalThis.innerWidth;
    const shiftX = (x) => {
      if (!Number.isFinite(viewportWidth) || !Number.isFinite(panelWidth))
        return x;
      const viewX = hostLeft + x;
      const overflowRight = viewX + panelWidth + gap - viewportWidth;
      if (overflowRight > 0)
        return Math.max(-hostLeft + gap, x - overflowRight);
      const overflowLeft = gap - viewX;
      if (overflowLeft > 0)
        return x + overflowLeft;
      return x;
    };
    const geometry = horizontal ? {
      x: placement === "right" ? anchorRect.right - hostLeft + gap : anchorRect.left - hostLeft - panelWidth - gap,
      y: anchorRect.top - hostTop + (anchorRect.height - panelHeight) / 2,
      w: anchorRect.width,
      h: anchorRect.height,
      placement
    } : {
      x: shiftX(anchorRect.left - hostLeft),
      y: placement === "bottom" ? anchorRect.bottom - hostTop + gap : anchorRect.top - hostTop - panelHeight - gap,
      w: anchorRect.width,
      h: anchorRect.height,
      placement
    };
    const key = `${geometry.x},${geometry.y},${geometry.w},${geometry.placement}`;
    if (key === last)
      return;
    last = key;
    if (node instanceof HTMLElement) {
      if (node.style.position === "") {
        node.style.position = topLayer ? "fixed" : "absolute";
      }
      node.style.left = `${geometry.x}px`;
      node.style.top = `${geometry.y}px`;
      node.style.minWidth = `${geometry.w}px`;
    }
    current?.onGeometry?.(geometry);
  };
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : undefined;
  ro?.observe(node);
  const scrollRoot = node.ownerDocument;
  const onScroll = () => measure();
  const onResize = () => measure();
  const view = scrollRoot.defaultView;
  scrollRoot.addEventListener("scroll", onScroll, { capture: true, passive: true });
  view?.addEventListener("resize", onResize);
  measure();
  const visibly = () => {
    if (!(node instanceof HTMLElement))
      return false;
    if (node.hasAttribute("hidden"))
      return false;
    try {
      if (node.closest("[hidden]") !== null)
        return false;
    } catch {
      return false;
    }
    return true;
  };
  let shown = visibly();
  const viewOf = node.ownerDocument?.defaultView;
  const Mutation = viewOf?.MutationObserver ?? (typeof MutationObserver === "function" ? MutationObserver : undefined);
  const watcher = Mutation !== undefined ? new Mutation(() => {
    const now = visibly();
    if (now && !shown)
      measure();
    shown = now;
  }) : undefined;
  if (watcher !== undefined && node instanceof HTMLElement) {
    watcher.observe(node, { attributes: true, attributeFilter: ["hidden"] });
    watcher.observe(node.parentElement ?? node.ownerDocument.documentElement, {
      attributes: true,
      attributeFilter: ["hidden"],
      subtree: true
    });
  }
  return {
    update: (next) => {
      current = next;
      measure();
    },
    destroy: () => {
      ro?.disconnect();
      watcher?.disconnect();
      scrollRoot.removeEventListener("scroll", onScroll, true);
      view?.removeEventListener("resize", onResize);
    }
  };
});

// packages/runtime/src/actions/drag.ts
var directionOf = (node) => {
  try {
    return node.ownerDocument?.defaultView?.getComputedStyle(node).direction === "rtl" ? "rtl" : "ltr";
  } catch {
    return "ltr";
  }
};
var boxOf = (node) => {
  if (typeof node.getBoundingClientRect !== "function")
    return null;
  try {
    return node.getBoundingClientRect();
  } catch {
    return null;
  }
};
var drag = createAction2((node, param) => {
  let originX = 0;
  let originY = 0;
  let pointerId = -1;
  let captured = false;
  let stop;
  const end = (cancelled) => {
    stop?.();
    stop = undefined;
    if (captured) {
      captured = false;
      const release = node.releasePointerCapture;
      if (typeof release === "function") {
        try {
          release.call(node, pointerId);
        } catch {}
      }
    }
    param?.onEnd?.({ cancelled });
  };
  const arm = (event) => {
    if (stop !== undefined)
      return;
    if (param?.enabled === false)
      return;
    if (event.button !== 0)
      return;
    const target = event.target;
    if (target instanceof Element && target !== node && target.closest("button, a, input, select, textarea") !== null)
      return;
    if (param?.preventDefault !== false)
      event.preventDefault();
    if (param?.stopPropagation === true)
      event.stopPropagation();
    originX = event.clientX;
    originY = event.clientY;
    pointerId = event.pointerId;
    const press = {
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      pressure: event.pressure,
      target,
      rect: boxOf(node),
      direction: directionOf(node)
    };
    if (param?.capture !== false) {
      const capture = node.setPointerCapture;
      if (typeof capture === "function") {
        try {
          capture.call(node, event.pointerId);
          captured = true;
        } catch {}
      }
    }
    param?.onStart?.(press);
    const doc = node.ownerDocument;
    const onMove = (moveEvent) => {
      if (param?.preventDefault !== false)
        moveEvent.preventDefault();
      param?.onMove?.({
        altKey: moveEvent.altKey || press.altKey,
        shiftKey: moveEvent.shiftKey || press.shiftKey,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        pointerId: moveEvent.pointerId,
        pressure: moveEvent.pressure,
        target: moveEvent.target,
        rect: boxOf(node),
        direction: directionOf(node),
        dx: moveEvent.clientX - originX,
        dy: moveEvent.clientY - originY
      });
    };
    const onUp = () => end(false);
    const onKey = (keyEvent) => {
      if (keyEvent.key !== "Escape")
        return;
      if (param?.cancelOnEscape === false)
        return;
      end(true);
    };
    doc.addEventListener("pointermove", onMove);
    doc.addEventListener("pointerup", onUp);
    doc.addEventListener("keydown", onKey);
    stop = () => {
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerup", onUp);
      doc.removeEventListener("keydown", onKey);
    };
  };
  node.addEventListener("pointerdown", arm);
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      end(true);
      node.removeEventListener("pointerdown", arm);
    }
  };
});

// packages/runtime/src/actions/hover-delay.ts
function listen(node, type, handler) {
  const listener = (event) => handler(event);
  node.addEventListener(type, listener);
  return () => node.removeEventListener(type, listener);
}
var hoverDelay = createAction2((node, param) => {
  let openTimer;
  let closeTimer;
  const clearOpen = () => {
    clearTimeout(openTimer);
    openTimer = undefined;
  };
  const clearClose = () => {
    clearTimeout(closeTimer);
    closeTimer = undefined;
  };
  const enter = (event) => {
    if (event.pointerType === "touch")
      return;
    clearClose();
    if (openTimer !== undefined || param?.onOpen === undefined)
      return;
    const delay = param?.openDelay ?? 150;
    if (delay <= 0) {
      param?.onOpen?.();
      return;
    }
    openTimer = setTimeout(() => {
      openTimer = undefined;
      param?.onOpen?.();
    }, delay);
  };
  const leave = () => {
    clearOpen();
    if (closeTimer !== undefined || param?.onClose === undefined)
      return;
    const delay = param?.closeDelay ?? 100;
    if (delay <= 0) {
      param?.onClose?.();
      return;
    }
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      param?.onClose?.();
    }, delay);
  };
  const stops = [
    listen(node, "pointerenter", enter),
    listen(node, "pointerleave", leave)
  ];
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      clearOpen();
      clearClose();
      for (const stop of stops)
        stop();
    }
  };
});

// packages/runtime/src/actions/observe.ts
var observe = createAction2((node, param) => {
  if (typeof MutationObserver !== "function")
    return;
  const filter = param?.attributes ?? [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        param?.onAttributes?.(node);
        continue;
      }
      for (const removed of record.removedNodes) {
        if (removed instanceof Element)
          param?.onRemove?.(removed);
      }
    }
  });
  observer.observe(node, { childList: true, attributes: true, attributeFilter: [...filter] });
  param?.onAttach?.();
  return {
    destroy: () => observer.disconnect()
  };
});

// packages/runtime/src/actions/scroll-into-view.ts
var scrollIntoView = (_node, param) => {
  let last;
  const reveal = (next) => {
    const id = next?.activeId() ?? "";
    if (id.length === 0) {
      if (last !== undefined) {
        for (const list of _node.querySelectorAll('[role="group"]')) {
          list.scrollTop = 0;
        }
        last = undefined;
      }
      return;
    }
    if (id === last)
      return;
    last = id;
    if (next?.reveal !== undefined) {
      next.reveal();
      return;
    }
    const target = document.getElementById(id);
    if (!(target instanceof HTMLElement))
      return;
    target.scrollIntoView({ block: next?.edge ?? "nearest", inline: "nearest" });
  };
  reveal(param);
  return {
    update: (next) => reveal(next),
    destroy: () => {
      last = undefined;
    }
  };
};

// packages/runtime/src/actions/interact-outside.ts
var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),details,[tabindex]:not([tabindex="-1"])';
var makeEvent = (type, originalEvent, target) => {
  const contextmenu = originalEvent.type === "contextmenu" || originalEvent.button === 2;
  const event = {
    type,
    detail: {
      originalEvent,
      contextmenu,
      focusable: target instanceof Element && target.matches(FOCUSABLE),
      target
    },
    defaultPrevented: false
  };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  return event;
};
var interactOutside = createAction2((node, param) => {
  const excluded = (target) => {
    if (!(target instanceof Element))
      return false;
    if (target.getAttribute("aria-controls") === node.id)
      return true;
    const list = param?.exclude?.() ?? [];
    return list.some((el) => el !== null && (el === target || el.contains(target)));
  };
  const isOutside = (target) => {
    if (!(target instanceof Element))
      return false;
    if (!target.isConnected)
      return false;
    if (node.contains(target))
      return false;
    return !excluded(target);
  };
  const report = (type, originalEvent, target) => {
    const event = makeEvent(type, originalEvent, target);
    if (type === "pointerdown")
      param?.onPointerDownOutside?.(event);
    else
      param?.onFocusOutside?.(event);
    param?.onInteractOutside?.(event);
  };
  let pointerInFlight = false;
  const onPointerDown = (event) => {
    pointerInFlight = true;
    const release = () => {
      pointerInFlight = false;
    };
    document.addEventListener("pointerup", release, { once: true });
    if (isOutside(event.target))
      report("pointerdown", event, event.target);
  };
  const onFocusIn = (event) => {
    if (pointerInFlight)
      return;
    if (isOutside(event.target))
      report("focus", event, event.target);
  };
  const stops = [];
  const arm = () => {
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    stops.push(() => document.removeEventListener("pointerdown", onPointerDown, true));
    stops.push(() => document.removeEventListener("focusin", onFocusIn, true));
  };
  const frame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => arm()) : null;
  if (frame === null)
    arm();
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      if (frame !== null)
        cancelAnimationFrame(frame);
      for (const stop of stops)
        stop();
    }
  };
});

// packages/runtime/src/actions/select-options.ts
var selectOptions = createAction2((node, param) => {
  if (param === undefined)
    return;
  const select = node;
  const apply = (current) => {
    const wanted = current.rows;
    const existing = [...select.options].map((option) => option.value);
    const same = existing.length === wanted.length && existing.every((value, index) => value === wanted[index]?.value);
    if (!same) {
      select.replaceChildren();
      for (const row of wanted) {
        const option = document.createElement("option");
        option.value = row.value;
        option.textContent = row.label;
        select.append(option);
      }
    }
    if (current.multiple) {
      for (const option of [...select.options]) {
        option.selected = current.value.includes(option.value);
      }
    } else {
      select.value = current.value[0] ?? "";
    }
  };
  apply(param);
  return { update: apply };
});

// packages/runtime/src/actions/select-focus.ts
var selectFocus = createAction2((node, param) => {
  if (param === undefined)
    return;
  const apply = (current) => {
    if (!current.open)
      return;
    const active = node.getRootNode() instanceof ShadowRoot ? null : document.activeElement;
    if (active instanceof Node && node.contains(active))
      return;
    node.focus?.();
  };
  apply(param);
  return { update: apply };
});

// packages/runtime/src/actions/date-picker-focus.ts
var datePickerFocus = createAction2((node, param) => {
  if (param === undefined)
    return;
  const apply = (current) => {
    if (!current.open)
      return;
    const active = document.activeElement;
    if (active instanceof Node && node.contains(active))
      return;
    document.getElementById(current.cellId)?.focus?.();
  };
  apply(param);
  return { update: apply };
});

// packages/runtime/src/actions/infinite-scroll.ts
var infiniteScroll = createAction2((node, param) => {
  let intersecting = false;
  let enabled = param?.enabled !== false;
  const report = () => {
    if (!enabled || !intersecting)
      return;
    param?.onLoadMore?.();
  };
  let stops = [];
  const visibility = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    intersecting = entries.some((entry) => entry.isIntersecting);
    report();
  }, { threshold: 0 }) : undefined;
  visibility?.observe(node);
  const content = node.parentElement;
  const sizing = typeof ResizeObserver === "function" && content !== null ? new ResizeObserver(() => report()) : undefined;
  if (content !== null)
    sizing?.observe(content);
  stops = [
    () => visibility?.disconnect(),
    () => sizing?.disconnect()
  ];
  return {
    update: (next) => {
      param = next;
      enabled = next?.enabled !== false;
      report();
    },
    destroy: () => {
      for (const stop of stops)
        stop();
    }
  };
});

// packages/runtime/src/actions/toast-actions.ts
var toastTimer = createAction2((_node, param) => {
  let armed = false;
  let start = 0;
  let runFor = 0;
  let timer;
  let ready = false;
  const clearClock = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = (ms) => {
    clearClock();
    start = Date.now();
    runFor = ms;
    armed = true;
    timer = setTimeout(() => {
      timer = undefined;
      armed = false;
      param?.onTimeout();
    }, ms);
  };
  const stop = () => {
    const elapsed = Date.now() - start;
    clearClock();
    armed = false;
    if (runFor > elapsed)
      param?.onPause(runFor - elapsed);
  };
  const beat = () => {
    if (ready)
      return;
    ready = true;
    param?.onReady();
  };
  const schedule = () => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(beat);
    } else
      beat();
  };
  const clockable = (ms) => Number.isFinite(ms) && ms > 0;
  if (param !== undefined) {
    if (param.paused || !clockable(param.remaining)) {
      armed = false;
    } else {
      arm(param.remaining);
    }
    schedule();
  }
  return {
    update: (next) => {
      if (next === undefined)
        return;
      if (next.dismissing) {
        if (armed)
          stop();
        clearClock();
        timer = setTimeout(() => {
          timer = undefined;
          next.onRemove();
        }, next.removeDelay);
        return;
      }
      if (next.paused) {
        if (armed)
          stop();
        return;
      }
      if (!clockable(next.remaining)) {
        clearClock();
        armed = false;
        return;
      }
      if (!armed || runFor !== next.remaining)
        arm(next.remaining);
    },
    destroy: clearClock
  };
});
var toastRow = createAction2((node, param) => {
  if (typeof ResizeObserver !== "function")
    return;
  const measure = () => {
    const height = node.offsetHeight;
    if (height > 0)
      param?.onHeight(height);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(node);
  return {
    destroy: () => observer.disconnect()
  };
});
var toastRegion = createAction2((node, param) => {
  const onKeyDown = (event) => {
    const keys = param?.hotkey ?? [];
    if (keys.length === 0)
      return;
    const pressed = keys.every((key) => isModifier(key) ? event.getModifierState(key.slice(0, -3)) : event.code === key);
    if (!pressed)
      return;
    event.preventDefault();
    if (node instanceof HTMLElement)
      node.focus();
  };
  const onVisibility = () => {
    param?.onIdleChange(document.visibilityState === "hidden");
  };
  document.addEventListener("keydown", onKeyDown, { capture: true });
  if (param?.pauseOnPageIdle !== false) {
    document.addEventListener("visibilitychange", onVisibility);
  }
  return {
    destroy: () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
});
function isModifier(key) {
  return key === "altKey" || key === "ctrlKey" || key === "metaKey" || key === "shiftKey";
}

// packages/runtime/src/actions/index.ts
function listen2(target, type, handler, capture = false) {
  target.addEventListener(type, handler, { capture });
  return () => target.removeEventListener(type, handler, { capture });
}
var dismissable = createAction2((node, param) => {
  const outside = (event) => {
    const target = event.target;
    if (target && node.contains(target))
      return;
    if (param?.excludeId !== undefined && target instanceof Element) {
      const excluded = node.ownerDocument.getElementById(param.excludeId);
      if (excluded !== null && excluded.contains(target))
        return;
    }
    if (param?.excludeParent === true) {
      const parent = node.parentElement;
      if (parent !== null && target instanceof Element && parent.contains(target))
        return;
    }
    param?.onOutside?.(event);
  };
  const escape = (event) => {
    if (event.key === "Escape")
      param?.onEscape?.();
  };
  let cancelArm = () => {};
  let stopDoc;
  if (param?.armedByFrame === false) {
    stopDoc = listen2(document, "pointerdown", outside, true);
  } else {
    const raf = requestAnimationFrame(() => {
      stopDoc = listen2(document, "pointerdown", outside, true);
    });
    cancelArm = () => cancelAnimationFrame(raf);
  }
  const stopKey = listen2(document, "keydown", escape);
  return {
    destroy: () => {
      cancelArm();
      stopDoc?.();
      stopKey();
    }
  };
});
var autoplay = createAction2((_node, param) => {
  let timer;
  const clear = () => {
    if (timer !== undefined)
      clearInterval(timer);
    timer = undefined;
  };
  const start = (interval) => {
    clear();
    if (interval > 0)
      timer = setInterval(() => param?.onTick?.(), interval);
  };
  if (param?.enabled !== false)
    start(param?.interval ?? 3000);
  return {
    update: (next) => {
      if (next?.enabled === false)
        clear();
      else
        start(next?.interval ?? 3000);
    },
    destroy: clear
  };
});
var hoverIntent = createAction2((node, param) => {
  let timer;
  let opened = false;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const enter = (event) => {
    if (event.pointerType !== "mouse")
      return;
    const delay = param?.delay ?? 200;
    if (delay <= 0 || param?.onOpen === undefined)
      return;
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      opened = true;
      param?.onOpen?.();
    }, delay);
  };
  const leave = () => {
    clear();
    if (!opened)
      return;
    opened = false;
    param?.onClose?.();
  };
  const stops = [
    listen2(node, "pointerenter", enter),
    listen2(node, "pointerleave", leave)
  ];
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      clear();
      for (const stop of stops)
        stop();
    }
  };
});
var longPress = createAction2((node, param) => {
  let timer;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = (event) => {
    if (event.pointerType === "mouse")
      return;
    const delay = param?.delay ?? 700;
    if (delay <= 0 || param?.onPress === undefined)
      return;
    clear();
    const point = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = undefined;
      param?.onPress?.(point);
    }, delay);
  };
  const cancel = () => {
    if (timer === undefined)
      return;
    clear();
    param?.onCancel?.();
  };
  const stops = [
    listen2(node, "pointerdown", arm),
    listen2(node, "pointerup", cancel),
    listen2(node, "pointermove", cancel),
    listen2(node, "pointercancel", cancel)
  ];
  return {
    update: (next) => {
      param = next;
    },
    destroy: () => {
      clear();
      for (const stop of stops)
        stop();
    }
  };
});
var dragScroll = createAction2((node, param) => {
  let startX = 0;
  let startScroll = 0;
  let lastX = 0;
  let lastAt = 0;
  let dragging = false;
  const down = (event) => {
    dragging = true;
    startX = lastX = event.clientX;
    startScroll = node.scrollLeft;
    lastAt = performance.now();
    param?.onDragStart?.();
  };
  const move = (event) => {
    if (!dragging)
      return;
    node.scrollLeft = startScroll - (event.clientX - startX);
    lastX = event.clientX;
    lastAt = performance.now();
  };
  const up = () => {
    if (!dragging)
      return;
    dragging = false;
    const dt = performance.now() - lastAt;
    param?.onDragEnd?.(dt > 0 ? (lastX - startX) / dt : 0);
  };
  const stops = [
    listen2(node, "pointerdown", down),
    listen2(document, "pointermove", move),
    listen2(document, "pointerup", () => up())
  ];
  return { destroy: () => stops.forEach((s) => s()) };
});
var intersect = createAction2((node, param) => {
  if (typeof IntersectionObserver !== "function")
    return;
  const observer = new IntersectionObserver((entries) => {
    param?.onVisibility?.(entries.some((entry) => entry.isIntersecting));
  }, { threshold: param?.threshold ?? 0.5 });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
});
var resizeObserver = createAction2((node, param) => {
  if (typeof ResizeObserver !== "function")
    return;
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (box)
      param?.onResize?.(box);
  });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
});
var ACTIONS = {
  anchor,
  drag,
  "hover-delay": hoverDelay,
  dismissable,
  autoplay,
  "hover-intent": hoverIntent,
  "long-press": longPress,
  "drag-scroll": dragScroll,
  intersect,
  "resize-observer": resizeObserver,
  "form-control": formControl,
  observe,
  "scroll-into-view": scrollIntoView,
  "interact-outside": interactOutside,
  "select-options": selectOptions,
  "select-focus": selectFocus,
  "date-picker-focus": datePickerFocus,
  "infinite-scroll": infiniteScroll,
  "toast-timer": toastTimer,
  "toast-row": toastRow,
  "toast-region": toastRegion
};

// packages/runtime/src/core/style.ts
function toStyleString(style) {
  let out = "";
  for (const key in style) {
    const value = style[key];
    if (value === null || value === undefined)
      continue;
    if (!key.startsWith("--")) {
      const dashed = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      out += `${dashed}:${value};`;
      continue;
    }
    out += `${key}:${value};`;
  }
  return out;
}

// packages/runtime/src/directives/spread.ts
var ASSIGNABLE = new Set(["value", "checked", "selected", "tabIndex"]);
var hasAccessor = (el, name) => {
  let target = el;
  while (target !== null) {
    const desc = Object.getOwnPropertyDescriptor(target, name);
    if (desc !== undefined)
      return typeof desc.set === "function";
    target = Object.getPrototypeOf(target);
  }
  return false;
};
function bindActionProps(el, read) {
  let last = {};
  effect(() => {
    const props = read();
    for (const name of Object.keys(last)) {
      if (!(name in props) && !name.startsWith("on"))
        el.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on"))
        continue;
      if (!ASSIGNABLE.has(name) && Object.is(value, last[name]))
        continue;
      if (ASSIGNABLE.has(name)) {
        el[name] = value;
      } else if (name.startsWith("aria-") && (value === true || value === false)) {
        el.setAttribute(name, value === true ? "true" : "false");
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
      } else {
        el.setAttribute(name, String(value));
      }
    }
    last = props;
  });
}
function bindSpread(el, read) {
  let last = {};
  const attached = new Map;
  const latest = signal({});
  const attachedActions = new Set;
  effect(() => {
    const props = read();
    for (const name of Object.keys(last)) {
      const directive = name.startsWith("use:");
      if (!(name in props) && !name.startsWith("on") && !directive) {
        el.removeAttribute(name);
      }
    }
    const seen = new Set;
    const EVENT_ALIASES = { doubleclick: "dblclick" };
    for (const [name, value] of Object.entries(props)) {
      if (name.startsWith("on") && typeof value === "function") {
        const type = EVENT_ALIASES[name.slice(2).toLowerCase()] ?? name.slice(2).toLowerCase();
        const listener = value;
        seen.add(type);
        if (attached.get(type) !== listener) {
          const prev = attached.get(type);
          if (prev !== undefined)
            el.removeEventListener(type, prev);
          el.addEventListener(type, listener);
          attached.set(type, listener);
        }
        continue;
      }
      if (name.startsWith("use:"))
        continue;
      if (Object.is(value, last[name]))
        continue;
      if (name === "style") {
        el.setAttribute("style", toStyleString(value));
      } else if (ASSIGNABLE.has(name) || hasAccessor(el, name)) {
        el[name] = value;
      } else if (name.startsWith("aria-") && typeof value === "boolean") {
        el.setAttribute(name, String(value));
      } else if (value === undefined || value === null || value === false) {
        el.removeAttribute(name);
      } else if (value === true) {
        el.setAttribute(name, "");
      } else {
        el.setAttribute(name, String(value));
      }
    }
    for (const [type, fn] of attached) {
      if (!seen.has(type)) {
        el.removeEventListener(type, fn);
        attached.delete(type);
      }
    }
    last = props;
    latest(props);
    for (const name of Object.keys(props)) {
      if (!name.startsWith("use:") || name.length <= 4)
        continue;
      if (attachedActions.has(name))
        continue;
      const action = ACTIONS[name.slice(4)];
      if (typeof action !== "function")
        continue;
      attachedActions.add(name);
      runInElement(el, () => untrack(() => runAction2(el, action, () => {
        const entry = latest()[name];
        return typeof entry === "function" ? entry() : entry;
      })));
    }
  });
  return () => {};
}

// packages/runtime/src/directives/load.ts
function resolve(value) {
  if (typeof value === "function" && value.length === 0) {
    try {
      return value();
    } catch {
      return;
    }
  }
  return value;
}
function readExpr(expr, values) {
  const names = Object.keys(values);
  const args = names.map((name) => values[name]);
  try {
    return resolve(new Function(...names, `return (${expr});`)(...args));
  } catch {
    return;
  }
}
function callExpr(expr, values) {
  const fn = readExpr(expr, values);
  if (typeof fn === "function")
    return fn;
  return () => {
    return;
  };
}
function wire(root, ir, actions, values, _parts) {
  const walk = (nodes, mount, _target, rowScope) => {
    const active = rowScope ?? values;
    for (const node of nodes) {
      if (node.kind === "text") {
        const hasExpr = node.parts.some((part) => part.kind === "expr");
        if (!hasExpr) {
          const text = node.parts.map((part) => part.kind === "static" ? part.value : "").join("");
          if (text.length > 0)
            mount.appendChild(document.createTextNode(text));
          continue;
        }
        const t = document.createTextNode("");
        mount.appendChild(t);
        bindText(t, () => {
          let out = "";
          for (const part of node.parts) {
            if (part.kind === "static")
              out += part.value;
            else {
              const v = readExpr(part.expr, active);
              out += v == null ? "" : String(v);
            }
          }
          return out;
        });
        continue;
      }
      if (node.kind === "for") {
        const anchor = document.createComment("for");
        mount.appendChild(anchor);
        bindFor({
          anchor,
          items: () => readExpr(node.source, active) ?? [],
          key: node.key !== undefined ? (item, i) => readExpr(node.key, { ...active, [node.binding]: item, i }) : (_item, i) => i,
          render: (item) => {
            const frag = document.createDocumentFragment();
            const rowScope = { ...active, [node.binding]: item };
            walk(node.body, frag, [], rowScope);
            return { nodes: [...frag.childNodes] };
          }
        });
        continue;
      }
      const el = document.createElement(node.tag);
      for (const attr of node.attrs) {
        if (attr.value.kind === "static") {
          el.setAttribute(attr.name, attr.value.value);
        } else {
          const expr = attr.value.expr;
          bindAttr(el, attr.name, () => readExpr(expr, active));
        }
      }
      for (const ev of node.events) {
        const handler = callExpr(ev.handler, active);
        on(el, ev.event, (e) => handler(e));
      }
      for (const use of node.actions) {
        const action = actions[use.name];
        if (typeof action === "function") {
          if (use.param !== undefined) {
            runAction(el, action, () => readExpr(use.param, active));
          } else {
            runAction(el, action, undefined);
          }
        }
      }
      for (const spread of node.spreads) {
        bindSpread(el, () => readExpr(spread.expr, active));
      }
      mount.appendChild(el);
      walk(node.children, el, [], active);
    }
  };
  walk(ir.nodes, root, _parts);
}
function load(source, actions, values, onUnknown = "skip", resolve) {
  const ir = parse(source);
  const frag = document.createDocumentFragment();
  const owner = scope();
  const effectiveValues = resolve ? { ...values, "@@resolve": resolve } : values;
  const stop = owner.run(() => {
    wire(frag, ir, actions, effectiveValues, []);
    return () => owner.dispose();
  });
  return { nodes: [...frag.childNodes], dispose: stop };
}

// packages/runtime/src/index.ts
function defineController(def) {
  const callable = () => {
    throw new Error("[spin] controller() is a <script> binding compiled by spin-components; the element wires attach(el)");
  };
  return Object.assign(callable, def);
}
export {
  ParseError,
  ariaAutocomplete,
  ariaBusy,
  ariaControls,
  ariaCurrent,
  ariaDescribedBy,
  ariaDescription,
  ariaDisabled,
  ariaFlag,
  ariaHidden,
  ariaInvalid,
  ariaLabelledBy,
  ariaOrientation,
  ariaOwns,
  ariaPressed,
  ariaReadOnly,
  ariaRequired,
  ariaRoleDescription,
  ariaState,
  attrParsers,
  authoredProps2 as authoredProps,
  batch,
  bindActionProps,
  bindAttr,
  bindChecked,
  bindDynamic,
  bindFor,
  bindIf,
  bindProp,
  bindSpread,
  bindText,
  bindValue,
  clampValue,
  classAttrOf,
  classOf,
  classTokens,
  classTokensOf,
  closestIndex,
  coerceBool,
  coerceInt,
  coerceJsonArray,
  coerceList,
  coerceObjectArrayItems,
  coerceString,
  comboboxInput,
  computed,
  consume,
  controllerOf,
  controllerView,
  createAction,
  createMachine,
  createScopeTable,
  dataAttr,
  defaultTwin,
  define,
  defineComponent,
  defineController,
  disclosureTrigger,
  effect,
  expandVariantGroups,
  extractScript,
  focuser,
  formatExampleHtml,
  getNextStepValue,
  getPercentValue,
  getPreviousStepValue,
  getValuePercent,
  getValueRanges,
  ids,
  interpret,
  isComposing,
  isInteractive,
  isRecord,
  listSurface,
  liveRegion,
  load,
  matchBrace,
  measurer,
  on,
  optionRow,
  own,
  parse,
  pickCallback,
  placeSlot,
  projectSlots,
  provideController,
  resolveTwins,
  round10,
  runAction,
  scope,
  scopeOf,
  signal,
  skipQuoted,
  sliderThumb,
  snapValueToStep,
  stripScript,
  text,
  textProp,
  tokenizeHtml,
  tpl,
  trigger,
  uniqueId,
  untrack,
  view,
  writeProp
};
