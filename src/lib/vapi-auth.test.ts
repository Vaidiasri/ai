import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  safeEqual,
  signCallToken,
  verifyCallToken,
  verifyVapiWebhookSecret,
} from "./vapi-auth";

// fake fixture values, deliberately low entropy so secret scanners stay quiet
const HOOK = "fake";

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/vapi/tools", { method: "POST", headers });

describe("safeEqual", () => {
  it("compares by value, any length, without throwing", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "abc")).toBe(false);
  });
});

describe("verifyVapiWebhookSecret", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects everything when the env is unset, even in development", () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyVapiWebhookSecret(req())).toBe(false);
    expect(verifyVapiWebhookSecret(req({ "x-vapi-secret": "" }))).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects when the env is whitespace only", () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "   ");
    expect(verifyVapiWebhookSecret(req({ "x-vapi-secret": "   " }))).toBe(
      false,
    );
  });

  it("never falls back to VAPI_PRIVATE_KEY", () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "");
    vi.stubEnv("VAPI_PRIVATE_KEY", "pk");
    expect(verifyVapiWebhookSecret(req({ "x-vapi-secret": "pk" }))).toBe(false);
    expect(verifyVapiWebhookSecret(req({ authorization: "Bearer pk" }))).toBe(
      false,
    );
  });

  describe("with a secret set", () => {
    beforeEach(() => vi.stubEnv("VAPI_WEBHOOK_SECRET", HOOK));

    it.each([
      [{ "x-vapi-secret": HOOK }],
      [{ authorization: `Bearer ${HOOK}` }],
      [{ authorization: `bearer ${HOOK}` }],
      [{ authorization: `BEARER ${HOOK}` }],
    ])("accepts %j", (headers) => {
      expect(verifyVapiWebhookSecret(req(headers))).toBe(true);
    });

    it.each([
      [{}],
      [{ "x-vapi-secret": "" }],
      [{ "x-vapi-secret": "wrong!" }],
      [{ "x-vapi-secret": `${HOOK}x` }],
      [{ "x-vapi-secret": "s" }],
      [{ authorization: "Bearer " }],
      [{ authorization: `Basic ${HOOK}` }],
    ])("rejects %j", (headers) => {
      expect(verifyVapiWebhookSecret(req(headers))).toBe(false);
    });

    it("never logs the presented value", () => {
      verifyVapiWebhookSecret(req({ "x-vapi-secret": "leaky-value" }));
      const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
      expect(logged).not.toContain("leaky-value");
      expect(logged).not.toContain(HOOK);
    });
  });
});

describe("call token", () => {
  const SECRET = "x".repeat(32);
  const NOW = 1_700_000_000_000;
  const TTL = 30 * 60 * 1000;
  const token = signCallToken("user_abc123", SECRET, NOW);
  const [v, id, exp, sig] = token.split(".");

  it("has the v1.<id>.<exp>.<sig> shape with a 30 minute expiry", () => {
    expect(v).toBe("v1");
    expect(id).toBe("user_abc123");
    expect(Number(exp)).toBe((NOW + TTL) / 1000);
  });

  it("verifies a fresh token to its clerkId", () => {
    expect(verifyCallToken(token, SECRET, NOW)).toEqual({
      ok: true,
      clerkId: "user_abc123",
    });
    expect(verifyCallToken(token, SECRET, NOW + TTL - 1)).toEqual({
      ok: true,
      clerkId: "user_abc123",
    });
  });

  it("fails when exp equals now, and after", () => {
    expect(verifyCallToken(token, SECRET, NOW + TTL)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(verifyCallToken(token, SECRET, NOW + TTL + 1).ok).toBe(false);
  });

  it.each([
    ["tampered clerkId", `${v}.user_evil.${exp}.${sig}`],
    ["tampered exp", `${v}.${id}.${Number(exp) + 3600}.${sig}`],
    [
      "tampered signature",
      `${v}.${id}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`,
    ],
    ["wrong version", `v2.${id}.${exp}.${sig}`],
    ["3 parts", `${v}.${id}.${exp}`],
    ["5 parts", `${token}.x`],
    ["non numeric exp", `${v}.${id}.12ab.${sig}`],
    ["id without user_ prefix", signCallToken("org_abc", SECRET, NOW)],
  ])("rejects %s as invalid", (_, bad) => {
    expect(verifyCallToken(bad, SECRET, NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects a token signed with another secret", () => {
    expect(
      verifyCallToken(signCallToken("user_abc123", "other", NOW), SECRET, NOW),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([[""], ["   "], [undefined], [null], [42], [{}]])(
    "treats %j as missing",
    (bad) => {
      expect(verifyCallToken(bad, SECRET, NOW)).toEqual({
        ok: false,
        reason: "missing",
      });
    },
  );

  it.each([[undefined], [""], ["  "]])(
    "refuses every token when the secret is %j",
    (secret) => {
      expect(verifyCallToken(token, secret, NOW)).toEqual({
        ok: false,
        reason: "unconfigured",
      });
    },
  );
});
