// @spec SCANNER-009, SCANNER-010, SCANNER-011, SCANNER-012, ARTWORK-016, ARTWORK-017, ARTWORK-028
export class Job {
  private worker: Worker | null = null;
  private reject: ((e: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private id = 0;
  cancel() {
    this.id++;
    this.worker?.terminate();
    this.worker = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const reject = this.reject;
    this.reject = null;
    reject?.(new Error("Cancelled"));
  }
  run<T>(kind: string, args: object): Promise<T> {
    this.cancel();
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.reject = reject;
      this.worker = new Worker(
        new URL("../processing.worker.ts", import.meta.url),
        { type: "module" },
      );
      const finish = () => {
        this.worker?.terminate();
        this.worker = null;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.reject = null;
      };
      this.worker.onmessage = (e) => {
        if (id !== this.id || e.data.id !== id) return;
        finish();
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
      };
      this.worker.onerror = (e) => {
        if (id !== this.id) return;
        finish();
        reject(
          new Error(e.message || "Image processing failed. Please try again."),
        );
      };
      this.timer = setTimeout(() => {
        if (id !== this.id) return;
        finish();
        reject(
          new Error("Processing took too long. Retry or use a smaller image."),
        );
      }, 15000);
      this.worker.postMessage({ id, kind, ...args });
    });
  }
}
