import { useState } from "react";
import type { PaletteResult } from "../core/artwork";
import type { PaletteColor } from "../core/palettes";
// @spec ARTWORK-040, ARTWORK-041, ARTWORK-042, ARTWORK-043
export function GroupRecoloring({
  method,
  onMethod,
  count,
  onCount,
  valid,
  groups,
  palette,
  indices,
  onAssign,
  onReset,
}: {
  method: "groups" | "closest";
  onMethod: (value: "groups" | "closest") => void;
  count: string;
  onCount: (value: string) => void;
  valid: boolean;
  groups: PaletteResult | null;
  palette: PaletteColor[];
  indices: number[];
  onAssign: (color: string, target: number) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="group-recoloring">
      <label>
        Color matching
        <select
          value={method}
          onChange={(e) => onMethod(e.target.value as "groups" | "closest")}
        >
          <option value="groups">Recolor groups</option>
          <option value="closest">Closest colors</option>
        </select>
      </label>
      {method === "closest" ? (
        <p className="hint">
          Each pixel uses its nearest palette color. Similar drawing colors may
          merge.
        </p>
      ) : (
        <>
          <label>
            Drawing colors
            <input
              type="number"
              min="2"
              max="256"
              value={count}
              onChange={(e) => onCount(e.target.value)}
            />
          </label>
          <p className="hint">
            Find the drawing’s color groups first, then recolor each group
            together. Tap a row to change its color. Paper shades can share one
            background color.
          </p>
          {!valid && (
            <p className="field-error">Choose 2 to 256 drawing colors.</p>
          )}
          {groups && (
            <>
              <div
                className="group-mappings"
                aria-label="Drawing color mappings"
              >
                {groups.colors.map((color, i) => {
                  const key = color.join(","),
                    target = palette[indices[i]],
                    open = expanded === key;
                  return (
                    <div key={key} className="group-mapping">
                      <button
                        type="button"
                        className="group-mapping-row"
                        aria-label={`Drawing color ${i + 1}`}
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : key)}
                      >
                        <i
                          style={{ background: `rgb(${key})` }}
                          aria-hidden="true"
                        />
                        <span>
                          Color {i + 1}
                          <small>{groups.counts[i]} cells</small>
                        </span>
                        <span aria-hidden="true">→</span>
                        <i
                          style={{
                            background: target
                              ? `#${target.hex.replace(/^#/, "")}`
                              : undefined,
                          }}
                          aria-hidden="true"
                        />
                        <span>
                          {target
                            ? `#${target.hex.replace(/^#/, "")}`
                            : "Choose color"}
                        </span>
                      </button>
                      {open && (
                        <div
                          className="group-targets"
                          aria-label={`Targets for drawing color ${i + 1}`}
                        >
                          {palette.map((entry, index) =>
                            entry.enabled &&
                            /^#?[0-9a-f]{6}$/i.test(entry.hex) ? (
                              <button
                                type="button"
                                key={index}
                                aria-label={`Map drawing color ${i + 1} to color ${index + 1}, #${entry.hex.replace(/^#/, "")}`}
                                aria-pressed={indices[i] === index}
                                title={`Color ${index + 1}: #${entry.hex.replace(/^#/, "")}`}
                                onClick={() => onAssign(key, index)}
                              >
                                <i
                                  style={{
                                    background: `#${entry.hex.replace(/^#/, "")}`,
                                  }}
                                  aria-hidden="true"
                                />
                                <span>{index + 1}</span>
                              </button>
                            ) : null,
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {indices.some((i) => i < 0) && (
                <p className="field-error" role="alert">
                  An assigned color is disabled or missing. Choose another color
                  or reset mappings before exporting.
                </p>
              )}
              <button type="button" className="secondary" onClick={onReset}>
                Reset mappings
              </button>
              <p className="hint">
                Suggested colors are a starting point. Mappings stay for this
                drawing until you refresh.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
