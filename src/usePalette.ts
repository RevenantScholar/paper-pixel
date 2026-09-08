import { useEffect, useRef, useState } from "react";
import { PaletteCache, quantize, type PaletteResult } from "./core/artwork";
import { Job } from "./core/job";
export type Drawing = { pixels: Uint8Array; n: number; revision: number };
// @spec ARTWORK-014, ARTWORK-015, ARTWORK-016, ARTWORK-017, ARTWORK-018, ARTWORK-026, ARTWORK-027, ARTWORK-028, ARTWORK-029, ARTWORK-030, ARTWORK-031, ARTWORK-032
export function usePalette(
  source: Drawing | null,
  k: number | null,
  valid: boolean,
) {
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cache = useRef(new PaletteCache()),
    job = useRef(new Job()),
    epoch = useRef(0),
    original = useRef<PaletteResult | null>(null),
    lastRevision = useRef(-1);
  const [output, setOutput] = useState<PaletteResult | null>(null),
    [status, setStatus] = useState("empty"),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const current = ++epoch.current;
    job.current.cancel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError("");
    if (!source) {
      cache.current.reset(-1);
      lastRevision.current = -1;
      original.current = null;
      setStatus("empty");
      return;
    }
    if (source.revision !== lastRevision.current) {
      cache.current.reset(source.revision);
      lastRevision.current = source.revision;
      original.current = quantize(source.pixels, null);
    }
    if (!valid) {
      setStatus("invalid");
      return;
    }
    if (k === null || k >= original.current!.colors.length) {
      setOutput(original.current);
      setStatus("original");
      return;
    }
    const hit = cache.current.get(source.revision, k);
    if (hit) {
      setOutput(hit);
      setStatus("cached");
      return;
    }
    setStatus("working");
    timer = setTimeout(() => {
      job.current
        .run<PaletteResult>("palette", { pixels: source.pixels, k })
        .then((result) => {
          if (current !== epoch.current) return;
          cache.current.set(source.revision, k, result);
          setOutput(result);
          setStatus("ready");
        })
        .catch((e) => {
          if (current !== epoch.current) return;
          setError(e.message);
          setStatus("error");
        });
    }, 150);
    pending.current = timer;
    return () => {
      if (timer) clearTimeout(timer);
      epoch.current++;
      job.current.cancel();
    };
  }, [source, k, valid, retry]);
  useEffect(() => () => job.current.cancel(), []);
  return {
    output,
    status,
    error,
    ready:
      !!source && valid && ["original", "cached", "ready"].includes(status),
    retry: () => setRetry((r) => r + 1),
    cancel: () => {
      if (pending.current) clearTimeout(pending.current);
      epoch.current++;
      job.current.cancel();
      setStatus("error");
      setError("Calculation cancelled. Showing the previous result.");
    },
  };
}
