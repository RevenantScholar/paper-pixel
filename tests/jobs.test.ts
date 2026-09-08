import { afterEach, describe, it, expect, vi } from "vitest";
import { Job } from "../src/core/job";
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  terminated = false;
  message: any;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: any) {
    this.message = message;
  }
  terminate() {
    this.terminated = true;
  }
  reply(result: any) {
    this.onmessage?.({ data: { id: this.message.id, result } });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.instances = [];
});
describe("worker lifecycle", () => {
  // @spec SCANNER-009, SCANNER-010, SCANNER-011, SCANNER-012, ARTWORK-016, ARTWORK-017, ARTWORK-028
  it("terminates cancelled work and rejects its late reply", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const job = new Job();
    const first = job.run("sample", {}).catch((e) => e.message);
    const worker = FakeWorker.instances[0];
    job.cancel();
    worker.reply("stale");
    expect(await first).toBe("Cancelled");
    expect(worker.terminated).toBe(true);
    const second = job.run("sample", {});
    FakeWorker.instances[1].reply("current");
    expect(await second).toBe("current");
    expect(FakeWorker.instances[1].terminated).toBe(true);
  });
  // @spec SCANNER-011, ARTWORK-017
  it("terminates processing after 15 seconds with a recoverable error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const job = new Job();
    const result = job.run("palette", {}).catch((e) => e.message);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toMatch(/too long/);
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
});
