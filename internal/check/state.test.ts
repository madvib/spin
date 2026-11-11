import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { findingKey } from "./harness.ts";
import {
  restingState,
  type StateCandidate,
  stateDetail,
  statesFor,
  stateSubject,
} from "./state.ts";

/** A candidate of the given kind, as the scan finds them. */
function candidate(over: Partial<StateCandidate> = {}): StateCandidate {
  return {
    path: "main > button",
    hoverable: true,
    activatable: true,
    focusable: true,
    disabled: false,
    ...over,
  };
}

describe("the states a control is measured in", () => {
  it("covers every state a reader can put a live control in", () => {
    assert.deepEqual(statesFor(candidate()), [
      "rest",
      "hover",
      "active",
      "focus",
      "focus-visible",
    ]);
  });

  it("rests a dead control dead", () => {
    assert.equal(restingState(candidate({ disabled: true })), "disabled");
    assert.equal(restingState(candidate()), "rest");
  });

  it("leaves out the focus states of a control the browser refuses", () => {
    assert.deepEqual(statesFor(candidate({ focusable: false })), [
      "rest",
      "hover",
      "active",
    ]);
  });

  it("leaves out the hover of a control the pointer cannot reach", () => {
    assert.deepEqual(statesFor(candidate({ hoverable: false })), [
      "rest",
      "active",
      "focus",
      "focus-visible",
    ]);
  });
});

describe("what a state-contrast finding says", () => {
  it("names where the control is and what it says", () => {
    assert.equal(
      stateSubject("main > button", "Save"),
      'main > button "Save"',
    );
  });

  it("states the ratio and the pair it was measured between", () => {
    assert.equal(
      stateDetail(4.25, "rgb(0, 0, 0)", "rgb(255, 255, 255)"),
      "4.25:1 — rgb(0, 0, 0) on rgb(255, 255, 255)",
    );
  });

  it("counts the same control in two states as two findings", () => {
    const finding = {
      route: "/components/button",
      theme: "minimal",
      mode: "base",
      check: "state-contrast",
      subject: 'main > button "Save"',
      detail: "3.20:1 — rgb(255, 255, 255) on rgb(28, 98, 194)",
    } as const;
    const keys = new Set([
      findingKey({ ...finding, state: "hover" }),
      findingKey({ ...finding, state: "focus" }),
      findingKey({ ...finding, state: "hover" }),
    ]);
    assert.equal(keys.size, 2);
  });
});
