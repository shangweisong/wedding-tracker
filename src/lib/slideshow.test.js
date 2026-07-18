import { describe, it, expect } from "vitest";
import { nextSlideIndex, mergePhotos, slideIndexAfterMerge } from "./slideshow";

describe("nextSlideIndex", () => {
  it("advances forward and wraps at the end", () => {
    expect(nextSlideIndex(0, 3, 1)).toBe(1);
    expect(nextSlideIndex(2, 3, 1)).toBe(0);
  });

  it("goes backward and wraps at the start", () => {
    expect(nextSlideIndex(1, 3, -1)).toBe(0);
    expect(nextSlideIndex(0, 3, -1)).toBe(2);
  });

  it("returns 0 when there are no slides", () => {
    expect(nextSlideIndex(0, 0, 1)).toBe(0);
    expect(nextSlideIndex(5, 0, -1)).toBe(0);
  });
});

describe("mergePhotos", () => {
  const p = (id, caption = "") => ({ id, caption });

  it("keeps the existing rotation order and appends new photos at the end", () => {
    const existing = [p("a"), p("b")];
    const incoming = [p("c"), p("a"), p("b")]; // RPC returns newest first
    expect(mergePhotos(existing, incoming).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("drops photos no longer live", () => {
    const existing = [p("a"), p("b"), p("c")];
    const incoming = [p("a"), p("c")];
    expect(mergePhotos(existing, incoming).map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("refreshes fields of kept photos from the incoming rows", () => {
    const existing = [p("a", "old caption")];
    const incoming = [p("a", "fixed caption")];
    expect(mergePhotos(existing, incoming)[0].caption).toBe("fixed caption");
  });

  it("starts from the incoming list when nothing was loaded yet", () => {
    expect(mergePhotos([], [p("a"), p("b")]).map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("slideIndexAfterMerge", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("keeps pointing at the current photo after a merge", () => {
    expect(slideIndexAfterMerge(photos, "b")).toBe(1);
  });

  it("falls back to the first slide when the current photo was removed", () => {
    expect(slideIndexAfterMerge(photos, "gone")).toBe(0);
  });

  it("returns 0 for an empty rotation", () => {
    expect(slideIndexAfterMerge([], "a")).toBe(0);
  });
});
