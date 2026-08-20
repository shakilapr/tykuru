import { describe, expect, it } from "vitest";
import { isNewerRevision, isSameSession, DisplayedState, PreviewEvent } from "@/preview/revision-guard";

describe("revision-guard", () => {
  const ev = (sessionId: string, revision: number): PreviewEvent => ({ sessionId, revision });

  it("accepts a newer revision for the same session", () => {
    const current: DisplayedState = { sessionId: "a", revision: 2 };
    expect(isNewerRevision(current, ev("a", 3))).toBe(true);
  });

  it("ignores an older revision for the same session", () => {
    const current: DisplayedState = { sessionId: "a", revision: 2 };
    expect(isNewerRevision(current, ev("a", 1))).toBe(false);
  });

  it("ignores the same revision", () => {
    const current: DisplayedState = { sessionId: "a", revision: 2 };
    expect(isNewerRevision(current, ev("a", 2))).toBe(false);
  });

  it("accepts a first revision when nothing is displayed", () => {
    const current: DisplayedState = { sessionId: null, revision: null };
    expect(isNewerRevision(current, ev("a", 1))).toBe(true);
  });

  it("isSameSession true only for matching session id", () => {
    expect(isSameSession({ sessionId: "a", revision: 1 }, ev("a", 2))).toBe(true);
    expect(isSameSession({ sessionId: "a", revision: 1 }, ev("b", 2))).toBe(false);
    expect(isSameSession({ sessionId: null, revision: null }, ev("a", 1))).toBe(false);
  });

  it("accepts a different session as newer (switch)", () => {
    const current: DisplayedState = { sessionId: "a", revision: 9 };
    expect(isNewerRevision(current, ev("b", 1))).toBe(true);
  });
});
