import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeColors,
  loadLospecPalette,
  readPalettes,
  savePalettes,
  type PaletteColor,
  type SelectedPalette,
} from "./core/palettes";
// @spec ARTWORK-033, ARTWORK-034, ARTWORK-035, ARTWORK-037, ARTWORK-038
export function useSelectedPalette() {
  const [mode, updateMode] = useState<"photo" | "selected">("photo");
  const [input, updateInput] = useState("");
  const [library, setLibrary] = useState(readPalettes);
  const [current, setCurrent] = useState<SelectedPalette | null>(null);
  const [history, setHistory] = useState<PaletteColor[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    savePalettes(library);
  }, [library]);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
    },
    [],
  );
  const active = useMemo(() => {
    if (!current) return { colors: [], valid: false, error: "" };
    try {
      return { colors: activeColors(current.colors), valid: true, error: "" };
    } catch (e) {
      return { colors: [], valid: false, error: (e as Error).message };
    }
  }, [current]);
  function cancel() {
    request.current++;
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
    setError("");
  }
  function remember(palette: SelectedPalette) {
    try {
      activeColors(palette.colors);
    } catch {
      return;
    }
    setLibrary((old) =>
      [palette, ...old.filter((p) => p.slug !== palette.slug)].slice(0, 16),
    );
  }
  function choose(palette: SelectedPalette) {
    cancel();
    setCurrent(palette);
    setHistory([]);
    remember(palette);
  }
  async function load() {
    cancel();
    const id = ++request.current,
      abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 10000);
    try {
      const palette = await loadLospecPalette(input, abort.signal);
      if (request.current !== id || abort.signal.aborted) return;
      setCurrent(palette);
      setHistory([]);
      remember(palette);
    } catch (e) {
      if (request.current === id)
        setError(
          timedOut
            ? "Loading took too long. Please try again."
            : e instanceof TypeError
              ? "Could not reach Lospec. Check your connection and try again."
              : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      if (request.current === id) {
        setLoading(false);
        controller.current = null;
      }
    }
  }
  function edit(colors: PaletteColor[]) {
    if (!current) return;
    cancel();
    setHistory((old) => [...old, current.colors].slice(-32));
    const next = { ...current, colors };
    setCurrent(next);
    remember(next);
  }
  function undo() {
    if (!current || !history.length) return;
    cancel();
    const next = { ...current, colors: history[history.length - 1] };
    setHistory((old) => old.slice(0, -1));
    setCurrent(next);
    remember(next);
  }
  return {
    mode,
    setMode: (value: "photo" | "selected") => {
      cancel();
      updateMode(value);
    },
    input,
    setInput: (value: string) => {
      cancel();
      updateInput(value);
    },
    library,
    current,
    loading,
    error,
    active,
    load,
    cancel,
    choose,
    edit,
    undo,
    canUndo: history.length > 0,
    reset: () => {
      if (current)
        edit(current.original.map((hex) => ({ hex, enabled: true })));
    },
    edited:
      !!current &&
      (current.colors.length !== current.original.length ||
        current.colors.some(
          (c, i) =>
            !c.enabled ||
            c.hex.replace(/^#/, "").toLowerCase() !== current.original[i],
        )),
  };
}
