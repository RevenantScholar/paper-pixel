import { useMemo, useState, type ReactNode } from "react";
import {
  ExternalLink,
  LoaderCircle,
  Plus,
  RotateCcw,
  Undo2,
} from "lucide-react";
import bundled from "../data/palettes.json";
import { decodePalette } from "../core/palettes";
import type { useSelectedPalette } from "../useSelectedPalette";
const presets = bundled.map((p) => ({
  ...decodePalette(p, p.slug),
  attribution: p.attribution,
  size: p.size,
}));
type Model = ReturnType<typeof useSelectedPalette>;
// @spec ARTWORK-033, ARTWORK-034, ARTWORK-035, ARTWORK-037, ARTWORK-038, ARTWORK-039
export function SelectedPalette({
  model,
  preview,
  recolorControls,
}: {
  model: Model;
  preview?: ReactNode;
  recolorControls?: ReactNode;
}) {
  const [size, setSize] = useState("16"),
    [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      presets.filter(
        (p) =>
          (!size || p.size === Number(size)) &&
          `${p.name} ${p.author}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [size, search],
  );
  const current = model.current;
  return (
    <div className="selected-palette">
      <div className="palette-library-heading">
        <h4>Pick a palette</h4>
        <a
          href="https://lospec.com/palette-list"
          target="_blank"
          rel="noopener noreferrer"
        >
          Browse on Lospec <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="hint">
        Popular Lospec palettes, ready to use. Your photo stays here.
      </p>
      <div className="palette-library-filters">
        <label>
          Find a bundled palette
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or author"
          />
        </label>
        <label>
          Colors
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">All sizes</option>
            {[2, 4, 16, 256].map((n) => (
              <option key={n} value={n}>
                {n} colors
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="palette-cards" aria-label="Bundled palettes">
        {filtered.map((p) => (
          <button
            type="button"
            key={p.slug}
            className="palette-card"
            aria-pressed={current?.slug === p.slug}
            onClick={() =>
              model.choose(
                model.library.find((saved) => saved.slug === p.slug) ?? p,
              )
            }
          >
            <span className="palette-card-title">
              {p.name}
              <small>{p.size} colors</small>
            </span>
            <span className="palette-strip" aria-hidden="true">
              {p.original.map((hex, i) => (
                <i key={i} style={{ background: `#${hex}` }} />
              ))}
            </span>
            <small>{p.author || "View source on Lospec"}</small>
          </button>
        ))}
        {!filtered.length && (
          <p className="hint">
            No bundled palettes match. Try another size or browse Lospec.
          </p>
        )}
      </div>
      <form
        className="palette-import"
        onSubmit={(e) => {
          e.preventDefault();
          void model.load();
        }}
      >
        <label htmlFor="lospec-palette">Lospec palette URL or slug</label>
        <input
          id="lospec-palette"
          value={model.input}
          onChange={(e) => model.setInput(e.target.value)}
          placeholder="pico-8 or paste a palette link"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={512}
          aria-describedby="lospec-help"
        />
        <p className="hint" id="lospec-help">
          Find a palette on Lospec, then paste its link here.
        </p>
        <div className="inline-actions">
          <button
            className="secondary"
            disabled={!model.input.trim() || model.loading}
          >
            {model.loading ? (
              <>
                <LoaderCircle size={15} className="spin" />
                Loading…
              </>
            ) : (
              "Load palette"
            )}
          </button>
          {model.loading && (
            <button type="button" onClick={model.cancel}>
              Cancel import
            </button>
          )}
        </div>
      </form>
      {model.error && (
        <p className="field-error" role="alert">
          {model.error}
        </p>
      )}
      {model.library.length > 0 && (
        <label className="saved-palette-label">
          Remembered palettes
          <select
            value={current?.slug ?? ""}
            onChange={(e) => {
              const p = model.library.find((v) => v.slug === e.target.value);
              if (p) model.choose(p);
            }}
          >
            <option value="" disabled>
              Choose a remembered palette
            </option>
            {model.library.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="hint">
            Saved in this browser, including valid color edits.
          </span>
        </label>
      )}
      {current && (
        <div className="palette-editor">
          <h4>
            {current.name}
            {model.edited && <span className="small-badge">Edited</span>}
          </h4>
          <a
            className="palette-source"
            href={`https://lospec.com/palette-list/${current.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {current.author
              ? `${current.attribution ?? "By"} ${current.author} · `
              : ""}
            View palette on Lospec <ExternalLink size={12} aria-hidden="true" />
          </a>
          <p className="hint">
            {model.active.valid
              ? `${model.active.colors.length} colors enabled`
              : "Check your colors below"}
            . Paper is included in your drawing.
          </p>
          {preview && <div className="palette-edit-preview">{preview}</div>}
          {recolorControls}
          <details>
            <summary>Edit colors</summary>
            <p className="hint">
              Changes preview live. Turn off colors to leave them out.
            </p>
            <div className="palette-edit-actions">
              <button
                type="button"
                className="secondary"
                disabled={!model.canUndo}
                onClick={model.undo}
              >
                <Undo2 size={15} />
                Undo edit
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!model.edited}
                onClick={model.reset}
              >
                <RotateCcw size={15} />
                Reset palette
              </button>
            </div>
            <div className="palette-color-list">
              {current.colors.map((c, i) => {
                const valid = /^#?[0-9a-f]{6}$/i.test(c.hex);
                const change = (patch: Partial<typeof c>) =>
                  model.edit(
                    current.colors.map((v, j) =>
                      j === i ? { ...v, ...patch } : v,
                    ),
                  );
                return (
                  <div className="palette-color-row" key={i}>
                    <label className="palette-enabled">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => change({ enabled: e.target.checked })}
                        aria-label={`Enable color ${i + 1}`}
                      />
                      <span>{i + 1}</span>
                    </label>
                    <input
                      type="color"
                      aria-label={`Pick color ${i + 1}`}
                      value={valid ? `#${c.hex.replace(/^#/, "")}` : "#000000"}
                      onChange={(e) => change({ hex: e.target.value.slice(1) })}
                    />
                    <input
                      type="text"
                      aria-label={`Hex color ${i + 1}`}
                      aria-invalid={!valid}
                      value={c.hex}
                      maxLength={7}
                      autoCapitalize="none"
                      spellCheck={false}
                      onChange={(e) => change({ hex: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="secondary"
              disabled={current.colors.length >= 256}
              onClick={() =>
                model.edit([
                  ...current.colors,
                  { hex: "ffffff", enabled: true },
                ])
              }
            >
              <Plus size={15} />
              Add color
            </button>
          </details>
          {model.active.error && (
            <p className="field-error" role="alert">
              {model.active.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
