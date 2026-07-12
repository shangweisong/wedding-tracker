// The Resend SDK does NOT throw on failure — it returns { data, error }.
// sendEmail must surface that error as a rejection, otherwise callers
// (send-reminders dedup stamping, RSVP confirmations) record a send that
// never happened. Uses the SDK's RESEND_BASE_URL override to point at a
// local stub — no external traffic.
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import http from "node:http";
import { sendEmail } from "./emailProvider.js";

const servers = [];

function stubResend(statusCode, body) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
    servers.push(server);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

const MESSAGE = { from: "T & T", fromAddress: "rsvp@local.test", to: "x@local.test", subject: "s", html: "<p>hi</p>" };

describe("sendEmail via resend", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "rsvp@local.test";
  });

  afterEach(() => {
    for (const key of ["EMAIL_PROVIDER", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_BASE_URL"]) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  afterAll(() => {
    for (const s of servers) s.close();
  });

  it("resolves when the API accepts the email", async () => {
    const port = await stubResend(200, { id: "email_ok" });
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${port}`;
    await expect(sendEmail(MESSAGE)).resolves.not.toThrow();
  });

  it("rejects when the API returns an error payload", async () => {
    const port = await stubResend(422, { name: "validation_error", message: "invalid to address" });
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${port}`;
    await expect(sendEmail(MESSAGE)).rejects.toThrow(/invalid to address/);
  });

  it("rejects when the API is unreachable", async () => {
    process.env.RESEND_BASE_URL = "http://127.0.0.1:1";
    await expect(sendEmail(MESSAGE)).rejects.toThrow();
  });
});
