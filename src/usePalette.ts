import { useEffect, useRef, useState } from "react";
import {
  PaletteCache,
  quantize,
  type RGB,
  type PaletteResult,
} from "./core/artwork";
import { Job } from "./core/job";
export type Drawing = { pixels: Uint8Array; n: number; revision: number };
// @spec ARTWORK-014, ARTWORK-015, ARTWORK-016, ARTWORK-017, ARTWORK-018, ARTWORK-026, ARTWORK-027, ARTWORK-028, ARTWORK-029, ARTWORK-030, ARTWORK-031, ARTWORK-032, ARTWORK-036, ARTWORK-044
export function usePalette(
  source: Drawing | null,
  k: number | null,
  valid: boolean,
  selected: RGB[] | null = null,
  recolor: {
    groups: PaletteResult;
    targets: RGB[];
    count: number;
  } | null = null,
) {
  const selectionKey = recolor
    ? `groups:v1:${recolor.count}:${selected?.map((c) => c.join(",")).join(";")}:${recolor.targets.map((c) => c.join(",")).join(";")}`
    : selected === null
      ? k
      : `selected:v1:${selected.map((c) => c.join(",")).join(";")}`;
  const identity = `${source?.revision ?? -1}:${selectionKey}:${valid}`;
  const [completedIdentity, setCompletedIdentity] = useState("");
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
    if (
      selected === null &&
      (k === null || k >= original.current!.colors.length)
    ) {
      setOutput(original.current);
      setStatus("original");
      setCompletedIdentity(identity);
      return;
    }
    const hit = cache.current.get(source.revision, selectionKey!);
    if (hit) {
      setOutput(hit);
      setStatus("cached");
      setCompletedIdentity(identity);
      return;
    }
    setStatus("working");
    timer = setTimeout(() => {
      job.current
        .run<PaletteResult>(
          recolor ? "recolor" : selected === null ? "palette" : "map",
          recolor
            ? { groups: recolor.groups, targets: recolor.targets }
            : selected === null
              ? { pixels: source.pixels, k }
              : { pixels: source.pixels, colors: selected },
        )
        .then((result) => {
          if (current !== epoch.current) return;
          cache.current.set(source.revision, selectionKey!, result);
          setOutput(result);
          setStatus("ready");
          setCompletedIdentity(identity);
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
  }, [source, k, valid, retry, selected, identity, selectionKey, recolor]);
  useEffect(() => () => job.current.cancel(), []);
  return {
    output,
    status,
    error,
    ready:
      !!source &&
      valid &&
      completedIdentity === identity &&
      ["original", "cached", "ready"].includes(status),
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
