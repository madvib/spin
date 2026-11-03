// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/shared/utils.js
var is_array = Array.isArray;
var index_of = Array.prototype.indexOf;
var array_from = Array.from;
var define_property = Object.defineProperty;
var get_descriptor = Object.getOwnPropertyDescriptor;
Array.prototype;
var is_extensible = Object.isExtensible;
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/reactivity/equality.js
/** @import { Equals } from '#client' */
/** @type {Equals} */
function equals(value) {
	return value === this.v;
}
/**
* Maximum update depth exceeded. This can happen when a reactive block or effect repeatedly sets a new value. Svelte limits the number of nested updates to prevent infinite loops
* @returns {never}
*/
function effect_update_depth_exceeded() {
	throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/flags/index.js
var legacy_mode_flag = false;
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/constants.js
var HYDRATION_ERROR = {};
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/context.js
/** @import { ComponentContext } from '#client' */
/** @type {ComponentContext | null} */
var component_context = null;
/** @param {ComponentContext | null} context */
function set_component_context(context) {
	component_context = context;
}
/**
* @param {Record<string, unknown>} props
* @param {any} runes
* @param {Function} [fn]
* @returns {void}
*/
function push(props, runes = false, fn) {
	var ctx = component_context = {
		p: component_context,
		c: null,
		d: false,
		e: null,
		m: false,
		s: props,
		x: null,
		l: null
	};
	if (legacy_mode_flag && !runes) component_context.l = {
		s: null,
		u: null,
		r1: [],
		r2: source(false)
	};
	teardown(() => {
		/** @type {ComponentContext} */ ctx.d = true;
	});
}
/**
* @template {Record<string, any>} T
* @param {T} [component]
* @returns {T}
*/
function pop(component) {
	const context_stack_item = component_context;
	if (context_stack_item !== null) {
		if (component !== void 0) context_stack_item.x = component;
		const component_effects = context_stack_item.e;
		if (component_effects !== null) {
			var previous_effect = active_effect;
			var previous_reaction = active_reaction;
			context_stack_item.e = null;
			try {
				for (var i = 0; i < component_effects.length; i++) {
					var component_effect = component_effects[i];
					set_active_effect(component_effect.effect);
					set_active_reaction(component_effect.reaction);
					effect(component_effect.fn);
				}
			} finally {
				set_active_effect(previous_effect);
				set_active_reaction(previous_reaction);
			}
		}
		component_context = context_stack_item.p;
		context_stack_item.m = true;
	}
	return component || {};
}
/** @returns {boolean} */
function is_runes() {
	return !legacy_mode_flag || component_context !== null && component_context.l === null;
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/reactivity/deriveds.js
/** @import { Derived, Effect } from '#client' */
/**
* @template V
* @param {() => V} fn
* @returns {Derived<V>}
*/
/*#__NO_SIDE_EFFECTS__*/
function derived(fn) {
	var flags = 2050;
	var parent_derived = active_reaction !== null && (active_reaction.f & 2) !== 0 ? active_reaction : null;
	if (active_effect === null || parent_derived !== null && (parent_derived.f & 256) !== 0) flags |= 256;
	else active_effect.f |= 1048576;
	return {
		ctx: component_context,
		deps: null,
		effects: null,
		equals,
		f: flags,
		fn,
		reactions: null,
		rv: 0,
		v: null,
		wv: 0,
		parent: parent_derived ?? active_effect
	};
}
/**
* @param {Derived} derived
* @returns {void}
*/
function destroy_derived_effects(derived) {
	var effects = derived.effects;
	if (effects !== null) {
		derived.effects = null;
		for (var i = 0; i < effects.length; i += 1) destroy_effect(effects[i]);
	}
}
/**
* @param {Derived} derived
* @returns {Effect | null}
*/
function get_derived_parent_effect(derived) {
	var parent = derived.parent;
	while (parent !== null) {
		if ((parent.f & 2) === 0) return parent;
		parent = parent.parent;
	}
	return null;
}
/**
* @template T
* @param {Derived} derived
* @returns {T}
*/
function execute_derived(derived) {
	var value;
	var prev_active_effect = active_effect;
	set_active_effect(get_derived_parent_effect(derived));
	try {
		destroy_derived_effects(derived);
		value = update_reaction(derived);
	} finally {
		set_active_effect(prev_active_effect);
	}
	return value;
}
/**
* @param {Derived} derived
* @returns {void}
*/
function update_derived(derived) {
	var value = execute_derived(derived);
	set_signal_status(derived, (skip_reaction || (derived.f & 256) !== 0) && derived.deps !== null ? 4096 : 1024);
	if (!derived.equals(value)) {
		derived.v = value;
		derived.wv = increment_write_version();
	}
}
var old_values = /* @__PURE__ */ new Map();
/**
* @template V
* @param {V} v
* @param {Error | null} [stack]
* @returns {Source<V>}
*/
function source(v, stack) {
	return {
		f: 0,
		v,
		reactions: null,
		equals,
		rv: 0,
		wv: 0
	};
}
/**
* Hydration failed because the initial UI does not match what was rendered on the server. The error occurred near %location%
* @param {string | undefined | null} [location]
*/
function hydration_mismatch(location) {
	console.warn(`https://svelte.dev/e/hydration_mismatch`);
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/dom/hydration.js
/** @import { TemplateNode } from '#client' */
/**
* Use this variable to guard everything related to hydration code so it can be treeshaken out
* if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
*/
var hydrating = false;
/**
* The node that is currently being hydrated. This starts out as the first node inside the opening
* <!--[--> comment, and updates each time a component calls `$.child(...)` or `$.sibling(...)`.
* When entering a block (e.g. `{#if ...}`), `hydrate_node` is the block opening comment; by the
* time we leave the block it is the closing comment, which serves as the block's anchor.
* @type {TemplateNode}
*/
var hydrate_node;
/** @param {TemplateNode} node */
function set_hydrate_node(node) {
	if (node === null) {
		hydration_mismatch();
		throw HYDRATION_ERROR;
	}
	return hydrate_node = node;
}
function hydrate_next() {
	return set_hydrate_node(/* @__PURE__ */ get_next_sibling(hydrate_node));
}
/** @param {TemplateNode} node */
function reset(node) {
	if (!hydrating) return;
	if (/* @__PURE__ */ get_next_sibling(hydrate_node) !== null) {
		hydration_mismatch();
		throw HYDRATION_ERROR;
	}
	hydrate_node = node;
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/dom/operations.js
/** @import { TemplateNode } from '#client' */
/** @type {Window} */
var $window;
/** @type {boolean} */
var is_firefox;
/** @type {() => Node | null} */
var first_child_getter;
/** @type {() => Node | null} */
var next_sibling_getter;
/**
* Initialize these lazily to avoid issues when using the runtime in a server context
* where these globals are not available while avoiding a separate server entry point
*/
function init_operations() {
	if ($window !== void 0) return;
	$window = window;
	is_firefox = /Firefox/.test(navigator.userAgent);
	var element_prototype = Element.prototype;
	var node_prototype = Node.prototype;
	var text_prototype = Text.prototype;
	first_child_getter = get_descriptor(node_prototype, "firstChild").get;
	next_sibling_getter = get_descriptor(node_prototype, "nextSibling").get;
	if (is_extensible(element_prototype)) {
		element_prototype.__click = void 0;
		element_prototype.__className = void 0;
		element_prototype.__attributes = null;
		element_prototype.__style = void 0;
		element_prototype.__e = void 0;
	}
	if (is_extensible(text_prototype)) text_prototype.__t = void 0;
}
/**
* @param {string} value
* @returns {Text}
*/
function create_text(value = "") {
	return document.createTextNode(value);
}
/**
* @template {Node} N
* @param {N} node
* @returns {Node | null}
*/
/*@__NO_SIDE_EFFECTS__*/
function get_first_child(node) {
	return first_child_getter.call(node);
}
/**
* @template {Node} N
* @param {N} node
* @returns {Node | null}
*/
/*@__NO_SIDE_EFFECTS__*/
function get_next_sibling(node) {
	return next_sibling_getter.call(node);
}
/**
* Don't mark this as side-effect-free, hydration needs to walk all nodes
* @template {Node} N
* @param {N} node
* @param {boolean} is_text
* @returns {Node | null}
*/
function child(node, is_text) {
	if (!hydrating) return /* @__PURE__ */ get_first_child(node);
	var child = /* @__PURE__ */ get_first_child(hydrate_node);
	if (child === null) child = hydrate_node.appendChild(create_text());
	else if (is_text && child.nodeType !== 3) {
		var text = create_text();
		child?.before(text);
		set_hydrate_node(text);
		return text;
	}
	set_hydrate_node(child);
	return child;
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/reactivity/effects.js
/** @import { ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */
/**
* @param {Effect} effect
* @param {Effect} parent_effect
*/
function push_effect(effect, parent_effect) {
	var parent_last = parent_effect.last;
	if (parent_last === null) parent_effect.last = parent_effect.first = effect;
	else {
		parent_last.next = effect;
		effect.prev = parent_last;
		parent_effect.last = effect;
	}
}
/**
* @param {number} type
* @param {null | (() => void | (() => void))} fn
* @param {boolean} sync
* @param {boolean} push
* @returns {Effect}
*/
function create_effect(type, fn, sync, push = true) {
	var parent = active_effect;
	/** @type {Effect} */
	var effect = {
		ctx: component_context,
		deps: null,
		nodes_start: null,
		nodes_end: null,
		f: type | 2048,
		first: null,
		fn,
		last: null,
		next: null,
		parent,
		prev: null,
		teardown: null,
		transitions: null,
		wv: 0
	};
	if (sync) try {
		update_effect(effect);
		effect.f |= 32768;
	} catch (e) {
		destroy_effect(effect);
		throw e;
	}
	else if (fn !== null) schedule_effect(effect);
	if (!(sync && effect.deps === null && effect.first === null && effect.nodes_start === null && effect.teardown === null && (effect.f & 1048704) === 0) && push) {
		if (parent !== null) push_effect(effect, parent);
		if (active_reaction !== null && (active_reaction.f & 2) !== 0) {
			var derived = active_reaction;
			(derived.effects ??= []).push(effect);
		}
	}
	return effect;
}
/**
* @param {() => void} fn
*/
function teardown(fn) {
	const effect = create_effect(8, null, false);
	set_signal_status(effect, 1024);
	effect.teardown = fn;
	return effect;
}
/**
* An effect root whose children can transition out
* @param {() => void} fn
* @returns {(options?: { outro?: boolean }) => Promise<void>}
*/
function component_root(fn) {
	const effect = create_effect(64, fn, true);
	return (options = {}) => {
		return new Promise((fulfil) => {
			if (options.outro) pause_effect(effect, () => {
				destroy_effect(effect);
				fulfil(void 0);
			});
			else {
				destroy_effect(effect);
				fulfil(void 0);
			}
		});
	};
}
/**
* @param {() => void | (() => void)} fn
* @returns {Effect}
*/
function effect(fn) {
	return create_effect(4, fn, false);
}
/**
* @param {(...expressions: any) => void | (() => void)} fn
* @param {Array<() => any>} thunks
* @returns {Effect}
*/
function template_effect(fn, thunks = [], d = derived) {
	const deriveds = thunks.map(d);
	const effect = () => fn(...deriveds.map(get));
	return block(effect);
}
/**
* @param {(() => void)} fn
* @param {number} flags
*/
function block(fn, flags = 0) {
	return create_effect(24 | flags, fn, true);
}
/**
* @param {(() => void)} fn
* @param {boolean} [push]
*/
function branch(fn, push = true) {
	return create_effect(40, fn, true, push);
}
/**
* @param {Effect} effect
*/
function execute_effect_teardown(effect) {
	var teardown = effect.teardown;
	if (teardown !== null) {
		const previously_destroying_effect = is_destroying_effect;
		const previous_reaction = active_reaction;
		set_is_destroying_effect(true);
		set_active_reaction(null);
		try {
			teardown.call(null);
		} finally {
			set_is_destroying_effect(previously_destroying_effect);
			set_active_reaction(previous_reaction);
		}
	}
}
/**
* @param {Effect} signal
* @param {boolean} remove_dom
* @returns {void}
*/
function destroy_effect_children(signal, remove_dom = false) {
	var effect = signal.first;
	signal.first = signal.last = null;
	while (effect !== null) {
		var next = effect.next;
		if ((effect.f & 64) !== 0) effect.parent = null;
		else destroy_effect(effect, remove_dom);
		effect = next;
	}
}
/**
* @param {Effect} signal
* @returns {void}
*/
function destroy_block_effect_children(signal) {
	var effect = signal.first;
	while (effect !== null) {
		var next = effect.next;
		if ((effect.f & 32) === 0) destroy_effect(effect);
		effect = next;
	}
}
/**
* @param {Effect} effect
* @param {boolean} [remove_dom]
* @returns {void}
*/
function destroy_effect(effect, remove_dom = true) {
	var removed = false;
	if ((remove_dom || (effect.f & 524288) !== 0) && effect.nodes_start !== null) {
		remove_effect_dom(effect.nodes_start, effect.nodes_end);
		removed = true;
	}
	destroy_effect_children(effect, remove_dom && !removed);
	remove_reactions(effect, 0);
	set_signal_status(effect, 16384);
	var transitions = effect.transitions;
	if (transitions !== null) for (const transition of transitions) transition.stop();
	execute_effect_teardown(effect);
	var parent = effect.parent;
	if (parent !== null && parent.first !== null) unlink_effect(effect);
	effect.next = effect.prev = effect.teardown = effect.ctx = effect.deps = effect.fn = effect.nodes_start = effect.nodes_end = null;
}
/**
*
* @param {TemplateNode | null} node
* @param {TemplateNode} end
*/
function remove_effect_dom(node, end) {
	while (node !== null) {
		/** @type {TemplateNode | null} */
		var next = node === end ? null : /* @__PURE__ */ get_next_sibling(node);
		node.remove();
		node = next;
	}
}
/**
* Detach an effect from the effect tree, freeing up memory and
* reducing the amount of work that happens on subsequent traversals
* @param {Effect} effect
*/
function unlink_effect(effect) {
	var parent = effect.parent;
	var prev = effect.prev;
	var next = effect.next;
	if (prev !== null) prev.next = next;
	if (next !== null) next.prev = prev;
	if (parent !== null) {
		if (parent.first === effect) parent.first = next;
		if (parent.last === effect) parent.last = prev;
	}
}
/**
* When a block effect is removed, we don't immediately destroy it or yank it
* out of the DOM, because it might have transitions. Instead, we 'pause' it.
* It stays around (in memory, and in the DOM) until outro transitions have
* completed, and if the state change is reversed then we _resume_ it.
* A paused effect does not update, and the DOM subtree becomes inert.
* @param {Effect} effect
* @param {() => void} [callback]
*/
function pause_effect(effect, callback) {
	/** @type {TransitionManager[]} */
	var transitions = [];
	pause_children(effect, transitions, true);
	run_out_transitions(transitions, () => {
		destroy_effect(effect);
		if (callback) callback();
	});
}
/**
* @param {TransitionManager[]} transitions
* @param {() => void} fn
*/
function run_out_transitions(transitions, fn) {
	var remaining = transitions.length;
	if (remaining > 0) {
		var check = () => --remaining || fn();
		for (var transition of transitions) transition.out(check);
	} else fn();
}
/**
* @param {Effect} effect
* @param {TransitionManager[]} transitions
* @param {boolean} local
*/
function pause_children(effect, transitions, local) {
	if ((effect.f & 8192) !== 0) return;
	effect.f ^= 8192;
	if (effect.transitions !== null) {
		for (const transition of effect.transitions) if (transition.is_global || local) transitions.push(transition);
	}
	var child = effect.first;
	while (child !== null) {
		var sibling = child.next;
		var transparent = (child.f & 65536) !== 0 || (child.f & 32) !== 0;
		pause_children(child, transitions, transparent ? local : false);
		child = sibling;
	}
}
var is_throwing_error = false;
var is_flushing = false;
/** @type {Effect | null} */
var last_scheduled_effect = null;
var is_updating_effect = false;
var is_destroying_effect = false;
/** @param {boolean} value */
function set_is_destroying_effect(value) {
	is_destroying_effect = value;
}
/** @type {Effect[]} */
var queued_root_effects = [];
/** @type {null | Reaction} */
var active_reaction = null;
var untracking = false;
/** @param {null | Reaction} reaction */
function set_active_reaction(reaction) {
	active_reaction = reaction;
}
/** @type {null | Effect} */
var active_effect = null;
/** @param {null | Effect} effect */
function set_active_effect(effect) {
	active_effect = effect;
}
/**
* When sources are created within a reaction, reading and writing
* them should not cause a re-run
* @type {null | Source[]}
*/
var reaction_sources = null;
/**
* The dependencies of the reaction that is currently being executed. In many cases,
* the dependencies are unchanged between runs, and so this will be `null` unless
* and until a new dependency is accessed — we track this via `skipped_deps`
* @type {null | Value[]}
*/
var new_deps = null;
var skipped_deps = 0;
/**
* Tracks writes that the effect it's executed in doesn't listen to yet,
* so that the dependency can be added to the effect later on if it then reads it
* @type {null | Source[]}
*/
var untracked_writes = null;
/**
* @type {number} Used by sources and deriveds for handling updates.
* Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
**/
var write_version = 1;
/** @type {number} Used to version each read of a source of derived to avoid duplicating depedencies inside a reaction */
var read_version = 0;
var skip_reaction = false;
/** @type {Set<Value> | null} */
var captured_signals = null;
function increment_write_version() {
	return ++write_version;
}
/**
* Determines whether a derived or effect is dirty.
* If it is MAYBE_DIRTY, will set the status to CLEAN
* @param {Reaction} reaction
* @returns {boolean}
*/
function check_dirtiness(reaction) {
	var flags = reaction.f;
	if ((flags & 2048) !== 0) return true;
	if ((flags & 4096) !== 0) {
		var dependencies = reaction.deps;
		var is_unowned = (flags & 256) !== 0;
		if (dependencies !== null) {
			var i;
			var dependency;
			var is_disconnected = (flags & 512) !== 0;
			var is_unowned_connected = is_unowned && active_effect !== null && !skip_reaction;
			var length = dependencies.length;
			if (is_disconnected || is_unowned_connected) {
				var derived = reaction;
				var parent = derived.parent;
				for (i = 0; i < length; i++) {
					dependency = dependencies[i];
					if (is_disconnected || !dependency?.reactions?.includes(derived)) (dependency.reactions ??= []).push(derived);
				}
				if (is_disconnected) derived.f ^= 512;
				if (is_unowned_connected && parent !== null && (parent.f & 256) === 0) derived.f ^= 256;
			}
			for (i = 0; i < length; i++) {
				dependency = dependencies[i];
				if (check_dirtiness(dependency)) update_derived(dependency);
				if (dependency.wv > reaction.wv) return true;
			}
		}
		if (!is_unowned || active_effect !== null && !skip_reaction) set_signal_status(reaction, 1024);
	}
	return false;
}
/**
* @param {unknown} error
* @param {Effect} effect
*/
function propagate_error(error, effect) {
	/** @type {Effect | null} */
	var current = effect;
	while (current !== null) {
		if ((current.f & 128) !== 0) try {
			current.fn(error);
			return;
		} catch {
			current.f ^= 128;
		}
		current = current.parent;
	}
	is_throwing_error = false;
	throw error;
}
/**
* @param {Effect} effect
*/
function should_rethrow_error(effect) {
	return (effect.f & 16384) === 0 && (effect.parent === null || (effect.parent.f & 128) === 0);
}
/**
* @param {unknown} error
* @param {Effect} effect
* @param {Effect | null} previous_effect
* @param {ComponentContext | null} component_context
*/
function handle_error(error, effect, previous_effect, component_context) {
	if (is_throwing_error) {
		if (previous_effect === null) is_throwing_error = false;
		if (should_rethrow_error(effect)) throw error;
		return;
	}
	if (previous_effect !== null) is_throwing_error = true;
	propagate_error(error, effect);
}
/**
* @param {Value} signal
* @param {Effect} effect
* @param {boolean} [root]
*/
function schedule_possible_effect_self_invalidation(signal, effect, root = true) {
	var reactions = signal.reactions;
	if (reactions === null) return;
	for (var i = 0; i < reactions.length; i++) {
		var reaction = reactions[i];
		if (reaction_sources?.includes(signal)) continue;
		if ((reaction.f & 2) !== 0) schedule_possible_effect_self_invalidation(reaction, effect, false);
		else if (effect === reaction) {
			if (root) set_signal_status(reaction, 2048);
			else if ((reaction.f & 1024) !== 0) set_signal_status(reaction, 4096);
			schedule_effect(reaction);
		}
	}
}
/**
* @template V
* @param {Reaction} reaction
* @returns {V}
*/
function update_reaction(reaction) {
	var previous_deps = new_deps;
	var previous_skipped_deps = skipped_deps;
	var previous_untracked_writes = untracked_writes;
	var previous_reaction = active_reaction;
	var previous_skip_reaction = skip_reaction;
	var previous_reaction_sources = reaction_sources;
	var previous_component_context = component_context;
	var previous_untracking = untracking;
	var flags = reaction.f;
	new_deps = null;
	skipped_deps = 0;
	untracked_writes = null;
	skip_reaction = (flags & 256) !== 0 && (untracking || !is_updating_effect || active_reaction === null);
	active_reaction = (flags & 96) === 0 ? reaction : null;
	reaction_sources = null;
	set_component_context(reaction.ctx);
	untracking = false;
	read_version++;
	reaction.f |= 2097152;
	try {
		var result = (0, reaction.fn)();
		var deps = reaction.deps;
		if (new_deps !== null) {
			var i;
			remove_reactions(reaction, skipped_deps);
			if (deps !== null && skipped_deps > 0) {
				deps.length = skipped_deps + new_deps.length;
				for (i = 0; i < new_deps.length; i++) deps[skipped_deps + i] = new_deps[i];
			} else reaction.deps = deps = new_deps;
			if (!skip_reaction) for (i = skipped_deps; i < deps.length; i++) (deps[i].reactions ??= []).push(reaction);
		} else if (deps !== null && skipped_deps < deps.length) {
			remove_reactions(reaction, skipped_deps);
			deps.length = skipped_deps;
		}
		if (is_runes() && untracked_writes !== null && !untracking && deps !== null && (reaction.f & 6146) === 0) for (i = 0; i < untracked_writes.length; i++) schedule_possible_effect_self_invalidation(untracked_writes[i], reaction);
		if (previous_reaction !== null && previous_reaction !== reaction) {
			read_version++;
			if (untracked_writes !== null) {
				if (previous_untracked_writes === null) previous_untracked_writes = untracked_writes;
				else previous_untracked_writes.push(...untracked_writes);
			}
		}
		return result;
	} finally {
		new_deps = previous_deps;
		skipped_deps = previous_skipped_deps;
		untracked_writes = previous_untracked_writes;
		active_reaction = previous_reaction;
		skip_reaction = previous_skip_reaction;
		reaction_sources = previous_reaction_sources;
		set_component_context(previous_component_context);
		untracking = previous_untracking;
		reaction.f ^= 2097152;
	}
}
/**
* @template V
* @param {Reaction} signal
* @param {Value<V>} dependency
* @returns {void}
*/
function remove_reaction(signal, dependency) {
	let reactions = dependency.reactions;
	if (reactions !== null) {
		var index = index_of.call(reactions, signal);
		if (index !== -1) {
			var new_length = reactions.length - 1;
			if (new_length === 0) reactions = dependency.reactions = null;
			else {
				reactions[index] = reactions[new_length];
				reactions.pop();
			}
		}
	}
	if (reactions === null && (dependency.f & 2) !== 0 && (new_deps === null || !new_deps.includes(dependency))) {
		set_signal_status(dependency, 4096);
		if ((dependency.f & 768) === 0) dependency.f ^= 512;
		destroy_derived_effects(dependency);
		remove_reactions(dependency, 0);
	}
}
/**
* @param {Reaction} signal
* @param {number} start_index
* @returns {void}
*/
function remove_reactions(signal, start_index) {
	var dependencies = signal.deps;
	if (dependencies === null) return;
	for (var i = start_index; i < dependencies.length; i++) remove_reaction(signal, dependencies[i]);
}
/**
* @param {Effect} effect
* @returns {void}
*/
function update_effect(effect) {
	var flags = effect.f;
	if ((flags & 16384) !== 0) return;
	set_signal_status(effect, 1024);
	var previous_effect = active_effect;
	var previous_component_context = component_context;
	var was_updating_effect = is_updating_effect;
	active_effect = effect;
	is_updating_effect = true;
	try {
		if ((flags & 16) !== 0) destroy_block_effect_children(effect);
		else destroy_effect_children(effect);
		execute_effect_teardown(effect);
		var teardown = update_reaction(effect);
		effect.teardown = typeof teardown === "function" ? teardown : null;
		effect.wv = write_version;
		effect.deps;
	} catch (error) {
		handle_error(error, effect, previous_effect, previous_component_context || effect.ctx);
	} finally {
		is_updating_effect = was_updating_effect;
		active_effect = previous_effect;
	}
}
function infinite_loop_guard() {
	try {
		effect_update_depth_exceeded();
	} catch (error) {
		if (last_scheduled_effect !== null) handle_error(error, last_scheduled_effect, null, null);
		else throw error;
	}
}
function flush_queued_root_effects() {
	var was_updating_effect = is_updating_effect;
	try {
		var flush_count = 0;
		is_updating_effect = true;
		while (queued_root_effects.length > 0) {
			if (flush_count++ > 1e3) infinite_loop_guard();
			var root_effects = queued_root_effects;
			var length = root_effects.length;
			queued_root_effects = [];
			for (var i = 0; i < length; i++) flush_queued_effects(process_effects(root_effects[i]));
			old_values.clear();
		}
	} finally {
		is_flushing = false;
		is_updating_effect = was_updating_effect;
		last_scheduled_effect = null;
	}
}
/**
* @param {Array<Effect>} effects
* @returns {void}
*/
function flush_queued_effects(effects) {
	var length = effects.length;
	if (length === 0) return;
	for (var i = 0; i < length; i++) {
		var effect = effects[i];
		if ((effect.f & 24576) === 0) try {
			if (check_dirtiness(effect)) {
				update_effect(effect);
				if (effect.deps === null && effect.first === null && effect.nodes_start === null) {
					if (effect.teardown === null) unlink_effect(effect);
					else effect.fn = null;
				}
			}
		} catch (error) {
			handle_error(error, effect, null, effect.ctx);
		}
	}
}
/**
* @param {Effect} signal
* @returns {void}
*/
function schedule_effect(signal) {
	if (!is_flushing) {
		is_flushing = true;
		queueMicrotask(flush_queued_root_effects);
	}
	var effect = last_scheduled_effect = signal;
	while (effect.parent !== null) {
		effect = effect.parent;
		var flags = effect.f;
		if ((flags & 96) !== 0) {
			if ((flags & 1024) === 0) return;
			effect.f ^= 1024;
		}
	}
	queued_root_effects.push(effect);
}
/**
*
* This function both runs render effects and collects user effects in topological order
* from the starting effect passed in. Effects will be collected when they match the filtered
* bitwise flag passed in only. The collected effects array will be populated with all the user
* effects to be flushed.
*
* @param {Effect} root
* @returns {Effect[]}
*/
function process_effects(root) {
	/** @type {Effect[]} */
	var effects = [];
	/** @type {Effect | null} */
	var effect = root;
	while (effect !== null) {
		var flags = effect.f;
		var is_branch = (flags & 96) !== 0;
		if (!(is_branch && (flags & 1024) !== 0) && (flags & 8192) === 0) {
			if ((flags & 4) !== 0) effects.push(effect);
			else if (is_branch) effect.f ^= 1024;
			else {
				var previous_active_reaction = active_reaction;
				try {
					active_reaction = effect;
					if (check_dirtiness(effect)) update_effect(effect);
				} catch (error) {
					handle_error(error, effect, null, effect.ctx);
				} finally {
					active_reaction = previous_active_reaction;
				}
			}
			/** @type {Effect | null} */
			var child = effect.first;
			if (child !== null) {
				effect = child;
				continue;
			}
		}
		var parent = effect.parent;
		effect = effect.next;
		while (effect === null && parent !== null) {
			effect = parent.next;
			parent = parent.parent;
		}
	}
	return effects;
}
/**
* @template V
* @param {Value<V>} signal
* @returns {V}
*/
function get(signal) {
	var is_derived = (signal.f & 2) !== 0;
	if (captured_signals !== null) captured_signals.add(signal);
	if (active_reaction !== null && !untracking) {
		if (!reaction_sources?.includes(signal)) {
			var deps = active_reaction.deps;
			if (signal.rv < read_version) {
				signal.rv = read_version;
				if (new_deps === null && deps !== null && deps[skipped_deps] === signal) skipped_deps++;
				else if (new_deps === null) new_deps = [signal];
				else if (!skip_reaction || !new_deps.includes(signal)) new_deps.push(signal);
			}
		}
	} else if (is_derived && signal.deps === null && signal.effects === null) {
		var derived = signal;
		var parent = derived.parent;
		if (parent !== null && (parent.f & 256) === 0) derived.f ^= 256;
	}
	if (is_derived) {
		derived = signal;
		if (check_dirtiness(derived)) update_derived(derived);
	}
	if (is_destroying_effect && old_values.has(signal)) return old_values.get(signal);
	return signal.v;
}
var STATUS_MASK = -7169;
/**
* @param {Signal} signal
* @param {number} status
* @returns {void}
*/
function set_signal_status(signal, status) {
	signal.f = signal.f & STATUS_MASK | status;
}
/**
* Subset of delegated events which should be passive by default.
* These two are already passive via browser defaults on window, document and body.
* But since
* - we're delegating them
* - they happen often
* - they apply to mobile which is generally less performant
* we're marking them as passive by default for other elements, too.
*/
var PASSIVE_EVENTS = ["touchstart", "touchmove"];
/**
* Returns `true` if `name` is a passive event
* @param {string} name
*/
function is_passive_event(name) {
	return PASSIVE_EVENTS.includes(name);
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/dom/elements/events.js
/** @type {Set<string>} */
var all_registered_events = /* @__PURE__ */ new Set();
/** @type {Set<(events: Array<string>) => void>} */
var root_event_handles = /* @__PURE__ */ new Set();
/**
* @this {EventTarget}
* @param {Event} event
* @returns {void}
*/
function handle_event_propagation(event) {
	var handler_element = this;
	var owner_document = handler_element.ownerDocument;
	var event_name = event.type;
	var path = event.composedPath?.() || [];
	var current_target = path[0] || event.target;
	var path_idx = 0;
	var handled_at = event.__root;
	if (handled_at) {
		var at_idx = path.indexOf(handled_at);
		if (at_idx !== -1 && (handler_element === document || handler_element === window)) {
			event.__root = handler_element;
			return;
		}
		var handler_idx = path.indexOf(handler_element);
		if (handler_idx === -1) return;
		if (at_idx <= handler_idx) path_idx = at_idx;
	}
	current_target = path[path_idx] || event.target;
	if (current_target === handler_element) return;
	define_property(event, "currentTarget", {
		configurable: true,
		get() {
			return current_target || owner_document;
		}
	});
	var previous_reaction = active_reaction;
	var previous_effect = active_effect;
	set_active_reaction(null);
	set_active_effect(null);
	try {
		/**
		* @type {unknown}
		*/
		var throw_error;
		/**
		* @type {unknown[]}
		*/
		var other_errors = [];
		while (current_target !== null) {
			/** @type {null | Element} */
			var parent_element = current_target.assignedSlot || current_target.parentNode || current_target.host || null;
			try {
				var delegated = current_target["__" + event_name];
				if (delegated != null && (!current_target.disabled || event.target === current_target)) {
					if (is_array(delegated)) {
						var [fn, ...data] = delegated;
						fn.apply(current_target, [event, ...data]);
					} else delegated.call(current_target, event);
				}
			} catch (error) {
				if (throw_error) other_errors.push(error);
				else throw_error = error;
			}
			if (event.cancelBubble || parent_element === handler_element || parent_element === null) break;
			current_target = parent_element;
		}
		if (throw_error) {
			for (let error of other_errors) queueMicrotask(() => {
				throw error;
			});
			throw throw_error;
		}
	} finally {
		event.__root = handler_element;
		delete event.currentTarget;
		set_active_reaction(previous_reaction);
		set_active_effect(previous_effect);
	}
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/dom/reconciler.js
/** @param {string} html */
function create_fragment_from_html(html) {
	var elem = document.createElement("template");
	elem.innerHTML = html;
	return elem.content;
}
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/client/dom/template.js
/** @import { Effect, TemplateNode } from '#client' */
/**
* @param {TemplateNode} start
* @param {TemplateNode | null} end
*/
function assign_nodes(start, end) {
	var effect = active_effect;
	if (effect.nodes_start === null) {
		effect.nodes_start = start;
		effect.nodes_end = end;
	}
}
/**
* @param {string} content
* @param {number} flags
* @returns {() => Node | Node[]}
*/
/*#__NO_SIDE_EFFECTS__*/
function template(content, flags) {
	var is_fragment = (flags & 1) !== 0;
	var use_import_node = (flags & 2) !== 0;
	/** @type {Node} */
	var node;
	/**
	* Whether or not the first item is a text/element node. If not, we need to
	* create an additional comment node to act as `effect.nodes.start`
	*/
	var has_start = !content.startsWith("<!>");
	return () => {
		if (hydrating) {
			assign_nodes(hydrate_node, null);
			return hydrate_node;
		}
		if (node === void 0) {
			node = create_fragment_from_html(has_start ? content : "<!>" + content);
			if (!is_fragment) node = /* @__PURE__ */ get_first_child(node);
		}
		var clone = use_import_node || is_firefox ? document.importNode(node, true) : node.cloneNode(true);
		if (is_fragment) {
			var start = /* @__PURE__ */ get_first_child(clone);
			var end = clone.lastChild;
			assign_nodes(start, end);
		} else assign_nodes(clone, clone);
		return clone;
	};
}
/**
* Assign the created (or in hydration mode, traversed) dom elements to the current block
* and insert the elements into the dom (in client mode).
* @param {Text | Comment | Element} anchor
* @param {DocumentFragment | Element} dom
*/
function append(anchor, dom) {
	if (hydrating) {
		/** @type {Effect} */ active_effect.nodes_end = hydrate_node;
		hydrate_next();
		return;
	}
	if (anchor === null) return;
	anchor.before(dom);
}
/**
* Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
* Transitions will play during the initial render unless the `intro` option is set to `false`.
*
* @template {Record<string, any>} Props
* @template {Record<string, any>} Exports
* @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
* @param {MountOptions<Props>} options
* @returns {Exports}
*/
function mount$1(component, options) {
	return _mount(component, options);
}
/** @type {Map<string, number>} */
var document_listeners = /* @__PURE__ */ new Map();
/**
* @template {Record<string, any>} Exports
* @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
* @param {MountOptions} options
* @returns {Exports}
*/
function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
	init_operations();
	var registered_events = /* @__PURE__ */ new Set();
	/** @param {Array<string>} events */
	var event_handle = (events) => {
		for (var i = 0; i < events.length; i++) {
			var event_name = events[i];
			if (registered_events.has(event_name)) continue;
			registered_events.add(event_name);
			var passive = is_passive_event(event_name);
			target.addEventListener(event_name, handle_event_propagation, { passive });
			var n = document_listeners.get(event_name);
			if (n === void 0) {
				document.addEventListener(event_name, handle_event_propagation, { passive });
				document_listeners.set(event_name, 1);
			} else document_listeners.set(event_name, n + 1);
		}
	};
	event_handle(array_from(all_registered_events));
	root_event_handles.add(event_handle);
	/** @type {Exports} */
	var component = void 0;
	var unmount = component_root(() => {
		var anchor_node = anchor ?? target.appendChild(create_text());
		branch(() => {
			if (context) {
				push({});
				var ctx = component_context;
				ctx.c = context;
			}
			if (events)
 /** @type {any} */ props.$$events = events;
			if (hydrating) assign_nodes(anchor_node, null);
			component = Component(anchor_node, props) || {};
			if (hydrating)
 /** @type {Effect} */ active_effect.nodes_end = hydrate_node;
			if (context) pop();
		});
		return () => {
			for (var event_name of registered_events) {
				target.removeEventListener(event_name, handle_event_propagation);
				var n = document_listeners.get(event_name);
				if (--n === 0) {
					document.removeEventListener(event_name, handle_event_propagation);
					document_listeners.delete(event_name);
				} else document_listeners.set(event_name, n);
			}
			root_event_handles.delete(event_handle);
			if (anchor_node !== anchor) anchor_node.parentNode?.removeChild(anchor_node);
		};
	});
	mounted_components.set(component, unmount);
	return component;
}
/**
* References of the components that were mounted or hydrated.
* Uses a `WeakMap` to avoid memory leaks.
*/
var mounted_components = /* @__PURE__ */ new WeakMap();
/**
* Unmounts a component that was previously mounted using `mount` or `hydrate`.
*
* Since 5.13.0, if `options.outro` is `true`, [transitions](https://svelte.dev/docs/svelte/transition) will play before the component is removed from the DOM.
*
* Returns a `Promise` that resolves after transitions have completed if `options.outro` is true, or immediately otherwise (prior to 5.13.0, returns `void`).
*
* ```js
* import { mount, unmount } from 'svelte';
* import App from './App.svelte';
*
* const app = mount(App, { target: document.body });
*
* // later...
* unmount(app, { outro: true });
* ```
* @param {Record<string, any>} component
* @param {{ outro?: boolean }} [options]
* @returns {Promise<void>}
*/
function unmount(component, options) {
	const fn = mounted_components.get(component);
	if (fn) {
		mounted_components.delete(component);
		return fn(options);
	}
	return Promise.resolve();
}
/**
* @param {Element | Text | Comment} node
* @param {() => string} get_value
* @param {boolean} [svg]
* @param {boolean} [mathml]
* @param {boolean} [skip_warning]
* @returns {void}
*/
function html(node, get_value, svg = false, mathml = false, skip_warning = false) {
	var anchor = node;
	var value = "";
	template_effect(() => {
		var effect = active_effect;
		if (value === (value = get_value() ?? "")) {
			if (hydrating) hydrate_next();
			return;
		}
		if (effect.nodes_start !== null) {
			remove_effect_dom(effect.nodes_start, effect.nodes_end);
			effect.nodes_start = effect.nodes_end = null;
		}
		if (value === "") return;
		if (hydrating) {
			hydrate_node.data;
			var next = hydrate_next();
			var last = next;
			while (next !== null && (next.nodeType !== 8 || next.data !== "")) {
				last = next;
				next = /* @__PURE__ */ get_next_sibling(next);
			}
			if (next === null) {
				hydration_mismatch();
				throw HYDRATION_ERROR;
			}
			assign_nodes(hydrate_node, last);
			anchor = set_hydrate_node(next);
			return;
		}
		var html = value + "";
		if (svg) html = `<svg>${html}</svg>`;
		else if (mathml) html = `<math>${html}</math>`;
		/** @type {DocumentFragment | Element} */
		var node = create_fragment_from_html(html);
		if (svg || mathml) node = /* @__PURE__ */ get_first_child(node);
		assign_nodes(/* @__PURE__ */ get_first_child(node), node.lastChild);
		if (svg || mathml) while (/* @__PURE__ */ get_first_child(node)) anchor.before(/* @__PURE__ */ get_first_child(node));
		else anchor.before(node);
	});
}
if (typeof HTMLElement === "function");
// ../../node_modules/.bun/svelte@5.28.0/node_modules/svelte/src/internal/disclose-version.js
if (typeof window !== "undefined") ((window.__svelte ??= {}).v ??= /* @__PURE__ */ new Set()).add("5");
var SUBJECT_HTML = {
	card: `
<card class="stack">
  <div class="split">
    <h2>Interactive Card</h2>
    <badge class="primary">live</badge>
  </div>
  <p class="text-text-muted">Same tokens, same markup, different runtime.</p>
  <label for="guest">Guest name</label>
  <input id="guest" placeholder="Ada" />
  <button class="primary" type="button">Add guest</button>
</card>`,
	tokens: `
<card class="stack">
  <h2>Theme Token Inspector</h2>
  <p class="text-sm text-text-muted">
    Every swatch spends a Spin token utility resolved against the active theme.
  </p>
  <div class="grid grid-cols-2 gap-2">
    <div class="rounded-md bg-primary p-4 text-on-primary">primary</div>
    <div class="rounded-md bg-surface-raised p-4 text-text">surface</div>
    <div class="rounded-md bg-success p-4 text-on-semantic-success">success</div>
    <div class="rounded-md bg-warning p-4 text-on-semantic-warning">warning</div>
    <div class="rounded-md bg-error p-4 text-on-semantic-error">error</div>
  </div>
</card>`,
	dialog: `
<card class="stack">
  <h2>Dialog &amp; Form Actions</h2>
  <p class="text-sm text-text-muted">
    A native dialog over Spin tokens; Escape and the form close it.
  </p>
  <button
    class="primary"
    type="button"
    onclick="this.closest('card').querySelector('dialog').showModal()"
  >
    Open dialog
  </button>
  <dialog>
    <form method="dialog" class="stack">
      <h2>Confirm action</h2>
      <p class="text-sm text-text-muted">This dialog is the platform's.</p>
      <div class="row justify-end">
        <button value="cancel">Cancel</button>
        <button class="primary" value="confirm">Confirm</button>
      </div>
    </form>
  </dialog>
</card>`
};
// examples/svelte/Card.svelte
var root = /* @__PURE__ */ template(`<div><!></div>`);
function Card($$anchor, $$props) {
	push($$props, true);
	var div = root();
	html(child(div), () => SUBJECT_HTML[$$props.subject]);
	reset(div);
	append($$anchor, div);
	pop();
}
// examples/svelte/main.ts
function mount(root, subject = "card") {
	const app = mount$1(Card, {
		target: root,
		props: { subject }
	});
	return () => {
		unmount(app);
	};
}
export { mount };
