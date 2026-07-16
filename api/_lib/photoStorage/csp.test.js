// The photowall's browser-side hops live or die by the CSP in vercel.json:
// @vercel/blob v2 uploads via https://vercel.com/api/blob (connect-src) and
// photos render from *.public.blob.vercel-storage.com (img-src). A "tidied"
// CSP silently bricks uploads on the deployed site (the SDK retries a blocked
// request 10× before erroring, so it looks like a hang) — pin the directives.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const vercelJson = JSON.parse(
  readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")
);

function cspDirective(name) {
  const header = (vercelJson.headers ?? [])
    .flatMap((h) => h.headers ?? [])
    .find((h) => h.key === "Content-Security-Policy");
  expect(header, "CSP header missing from vercel.json").toBeTruthy();
  const directive = header.value
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
  expect(directive, `${name} directive missing from CSP`).toBeTruthy();
  return directive.split(/\s+/).slice(1);
}

describe("vercel.json CSP covers photowall storage hosts", () => {
  it("connect-src allows the @vercel/blob v2 upload API origin", () => {
    expect(cspDirective("connect-src")).toContain("https://vercel.com");
  });

  it("connect-src allows R2 presigned PUTs", () => {
    expect(cspDirective("connect-src")).toContain(
      "https://*.r2.cloudflarestorage.com"
    );
  });

  it("img-src allows serving photos from both providers", () => {
    const imgSrc = cspDirective("img-src");
    expect(imgSrc).toContain("https://*.public.blob.vercel-storage.com");
    expect(imgSrc).toContain("https://*.r2.dev");
  });
});
