import { describe, expect, it } from "vitest";
import { addParticipantLabels } from "../apps/web/src/participant-labels";

describe("temporary participant ordinals", () => {
  it("assigns distinct labels for colliding prefixes and duplicate arrivals without labeling self", () => {
    const ids = ["same-prefix-b", "self", "same-prefix-a", "same-prefix-b"];
    const labels = addParticipantLabels(new Map(), ids, "self");
    expect([...labels]).toEqual([["same-prefix-a", 1], ["same-prefix-b", 2]]);
    expect([...addParticipantLabels(new Map(), [...ids].reverse(), "self")]).toEqual([...labels]);
  });
  it("preserves departed/reconnected authors and never reuses their ordinal", () => {
    const initial = addParticipantLabels(new Map(), ["b", "c"], "self");
    expect(addParticipantLabels(initial, ["c"], "self")).toBe(initial);
    const next = addParticipantLabels(initial, ["a", "c"], "self");
    expect([...next]).toEqual([["b", 1], ["c", 2], ["a", 3]]);
    expect(addParticipantLabels(next, ["b", "a", "c"], "self")).toBe(next);
    expect([...initial]).toEqual([["b", 1], ["c", 2]]);
  });
  it("labels transcript-only senders consistently and keeps each room view independent", () => {
    const first = addParticipantLabels(new Map(), ["past-author", "present-author"], "self");
    expect(addParticipantLabels(first, ["past-author"], "self")).toBe(first);
    const second = addParticipantLabels(new Map(), ["present-author"], "self");
    expect(second.get("present-author")).toBe(1);
    expect(first.get("present-author")).toBe(2);
    expect(second.has("past-author")).toBe(false);
  });
});
