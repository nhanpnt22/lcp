import { describe, expect, it } from "vitest";
import { CacheSingleFlight } from "../../singleflight/cache.singleflight";

describe("singleflight/cache.singleflight", () => {
  it("deduplicates concurrent requests by cache key", async () => {
    const sf = new CacheSingleFlight();
    let calls = 0;

    const factory = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return "ok";
    };

    const [a, b] = await Promise.all([sf.run("k1", factory), sf.run("k1", factory)]);

    expect(a).toBe("ok");
    expect(b).toBe("ok");
    expect(calls).toBe(1);
    expect(sf.size()).toBe(0);
  });

  it("cleans up failed requests and allows retries", async () => {
    const sf = new CacheSingleFlight();
    let calls = 0;

    await expect(
      sf.run("k2", async () => {
        calls++;
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    await expect(sf.run("k2", async () => "retry-ok")).resolves.toBe("retry-ok");
    expect(calls).toBe(1);
  });
});
