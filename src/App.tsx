import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Download,
  Grid2X2,
  Github,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Printer,
  RotateCw,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  DEFAULT_GRID,
  layout,
  validateGrid,
  worksheetSvg,
  type Paper,
  type Point,
} from "./core/worksheet";
import { decodePhoto, type Photo } from "./core/image";
import { gridQuality, validCorners } from "./core/geometry";
import { exportSize, scaledPixels } from "./core/artwork";
import { Job } from "./core/job";
import { ScanSession } from "./core/session";
import type { Detection } from "./core/detection";
import { usePalette, type Drawing } from "./usePalette";
import { useSelectedPalette } from "./useSelectedPalette";
import { SelectedPalette } from "./components/SelectedPalette";
import { GroupRecoloring } from "./components/GroupRecoloring";
import { resolveGroupTargets } from "./core/recolor";
import { PixelCanvas } from "./components/PixelCanvas";
import { GridReview } from "./components/GridReview";
function PixelFlower() {
  const rows = [
    "0000330000",
    "0003333000",
    "0333223330",
    "3332222333",
    "0333223330",
    "0003333000",
    "0000330000",
    "0000440000",
    "0044440000",
    "0000440000",
  ];
  const colors: Record<string, string> = {
    "2": "#f0c665",
    "3": "#e76e48",
    "4": "#657a54",
  };
  return (
    <svg viewBox="0 0 10 10" className="pixel-flower" aria-hidden="true">
      {rows.flatMap((r, y) =>
        [...r].map((c, x) =>
          c === "0" ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={colors[c]}
            />
          ),
        ),
      )}
    </svg>
  );
}
function errorText(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Something went wrong. Please try again.";
}
// @spec ARTWORK-001, ARTWORK-004, WORKSHEET-001, WORKSHEET-002, WORKSHEET-003, WORKSHEET-004, WORKSHEET-012, WORKSHEET-017, WORKSHEET-018, WORKSHEET-019, WORKSHEET-020, WORKSHEET-021, SCANNER-031
export default function App() {
  const [view, setView] = useState<"create" | "scan">("create"),
    [grid, setGrid] = useState(String(DEFAULT_GRID)),
    [paper, setPaper] = useState<Paper>("LETTER");
  let n = 32,
    gridError = "";
  try {
    n = validateGrid(grid);
  } catch (e) {
    gridError = errorText(e);
  }
  const sheet = useMemo(() => worksheetSvg(paper, n), [paper, n]),
    page = layout(paper, n);
  const [photo, setPhoto] = useState<Photo | null>(null),
    [corners, setCorners] = useState<Point[]>([]),
    [scanGrid, setScanGrid] = useState("32"),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState(""),
    [scanError, setScanError] = useState(""),
    [busy, setBusy] = useState(""),
    [source, setSource] = useState<Drawing | null>(null),
    [ack, setAck] = useState(false);
  const session = useRef(new ScanSession()),
    scanJob = useRef(new Job()),
    photoRef = useRef<Photo | null>(null),
    importId = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false),
    [cameraPending, setCameraPending] = useState(false),
    video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    cameraId = useRef(0);
  const chosenPalette = useSelectedPalette();
  const [palette, setPalette] = useState("rgb"),
    [customK, setCustomK] = useState("8"),
    [scale, setScale] = useState("1");
  let k =
      palette === "rgb"
        ? null
        : Number(palette === "custom" ? customK : palette),
    paletteValid =
      k === null ||
      (Number.isInteger(k) &&
        k >= 2 &&
        k <= 16777216 &&
        (palette !== "custom" || customK.trim() !== ""));
  // @spec ARTWORK-040, ARTWORK-043, ARTWORK-044
  const [method, setMethod] = useState<"groups" | "closest">("groups");
  const [contexts, setContexts] = useState<
    Record<string, Record<string, number>>
  >({});
  useEffect(() => setContexts({}), [source?.revision]);
  const groupText =
    palette === "rgb" ? "4" : palette === "custom" ? customK : palette;
  const groupCount = Number(groupText);
  const groupValid =
    groupText.trim() !== "" &&
    Number.isInteger(groupCount) &&
    groupCount >= 2 &&
    groupCount <= 256;
  const grouping = chosenPalette.mode === "selected" && method === "groups";
  const base = usePalette(
    source,
    grouping ? groupCount : k,
    grouping ? groupValid : paletteValid,
  );
  const context = `${source?.revision}:${groupCount}:${chosenPalette.current?.slug}`;
  const mappings = useMemo(
    () =>
      resolveGroupTargets(
        grouping && base.ready && groupValid ? (base.output?.colors ?? []) : [],
        chosenPalette.current?.colors ?? [],
        contexts[context] ?? {},
      ),
    [
      grouping,
      base.ready,
      groupValid,
      base.output,
      chosenPalette.current,
      contexts,
      context,
    ],
  );
  const recolor = useMemo(
    () =>
      grouping && base.ready && base.output
        ? { groups: base.output, targets: mappings.targets, count: groupCount }
        : null,
    [grouping, base.ready, base.output, mappings, groupCount],
  );
  const mapped = usePalette(
    source,
    null,
    chosenPalette.mode === "selected" &&
      chosenPalette.active.valid &&
      (!grouping || (groupValid && base.ready && mappings.valid)),
    chosenPalette.active.colors,
    recolor,
  );
  const pal =
    chosenPalette.mode === "photo"
      ? base
      : grouping && (!base.ready || !groupValid)
        ? {
            ...mapped,
            ready: false,
            status: base.status,
            error: base.error,
            retry: base.retry,
            cancel: base.cancel,
          }
        : mapped;
  function assignGroup(color: string, target: number) {
    setContexts((previous) =>
      Object.fromEntries(
        [
          ...Object.entries(previous).filter(([key]) => key !== context),
          [context, { ...previous[context], [color]: target }],
        ].slice(-32),
      ),
    );
  }
  function resetMappings() {
    setContexts((previous) => {
      const next = { ...previous };
      delete next[context];
      return next;
    });
  }
  const [encoding, setEncoding] = useState(false),
    [exportError, setExportError] = useState(""),
    exportEpoch = useRef(0);
  useEffect(() => {
    exportEpoch.current++;
    setExportError("");
  }, [
    source,
    palette,
    customK,
    scale,
    chosenPalette.mode,
    chosenPalette.current,
    method,
    contexts,
  ]);
  // @spec SCANNER-004
  function stopCamera() {
    cameraId.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
    setCameraPending(false);
  }
  useEffect(() => {
    if (view !== "scan") stopCamera();
  }, [view]);
  useEffect(() => {
    if (camera && video.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [camera]);
  useEffect(
    () => () => {
      cameraId.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      scanJob.current.cancel();
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      importId.current++;
    },
    [],
  );
  // @spec SCANNER-001, SCANNER-002, SCANNER-003, SCANNER-004, SCANNER-005, SCANNER-029
  async function startCamera() {
    importId.current++;
    stopCamera();
    session.current.beginReplacement();
    scanJob.current.cancel();
    setBusy("");
    setScanError("");
    const id = ++cameraId.current;
    setCameraPending(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access needs HTTPS or localhost. You can choose a photo instead.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (id !== cameraId.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      setCamera(true);
      setCameraPending(false);
    } catch (e) {
      if (id !== cameraId.current) return;
      setCameraPending(false);
      setScanError(
        `Camera unavailable. Choose a photo instead. ${errorText(e)}`,
      );
    }
  }
  async function capture() {
    if (!video.current) return;
    const captureId = cameraId.current;
    const v = video.current,
      c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    if (!c.width || !c.height) {
      setScanError("The camera is not ready yet. Try again.");
      return;
    }
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      c.toBlob(resolve, "image/png"),
    );
    if (captureId !== cameraId.current) return;
    stopCamera();
    if (blob)
      void loadPhoto(new File([blob], "camera.png", { type: "image/png" }));
    else setScanError("Could not capture this frame. Try again.");
  }
  // @spec SCANNER-005, SCANNER-007, SCANNER-009, SCANNER-011, SCANNER-012, SCANNER-017, SCANNER-018, SCANNER-029
  async function loadPhoto(file: File) {
    stopCamera();
    const id = ++importId.current;
    session.current.beginReplacement();
    scanJob.current.cancel();
    setBusy("Preparing photo");
    setScanError("");
    try {
      const next = await decodePhoto(file);
      if (id !== importId.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      photoRef.current = next;
      session.current.commitPhoto();
      setPhoto(next);
      setSource(null);
      setAck(false);
      setConfirmed(false);
      setCorners(defaultCorners(next));
      setScanGrid(String(n));
      await detect(next);
    } catch (e) {
      if (id !== importId.current) return;
      setScanError(errorText(e));
      setBusy("");
    }
  }
  function defaultCorners(p: Photo) {
    return [
      { x: p.raster.width * 0.1, y: p.raster.height * 0.15 },
      { x: p.raster.width * 0.9, y: p.raster.height * 0.15 },
      { x: p.raster.width * 0.9, y: p.raster.height * 0.85 },
      { x: p.raster.width * 0.1, y: p.raster.height * 0.85 },
    ];
  }
  async function detect(p: Photo) {
    const request = session.current.beginRequest();
    setBusy("Finding your grid");
    try {
      const result = await scanJob.current.run<Detection>("detect", {
        image: p.raster,
      });
      if (!session.current.isCurrent(request)) return;
      setCorners(result.corners || defaultCorners(p));
      setScanGrid(String(result.n || n));
      setConfirmed(result.confirmed);
      setMessage(result.message);
      setBusy("");
    } catch (e) {
      if (!session.current.isCurrent(request)) return;
      setMessage("Place the grid corners and confirm the grid size.");
      setScanError(errorText(e));
      setBusy("");
    }
  }
  // @spec SCANNER-010, SCANNER-019, SCANNER-020, SCANNER-027, SCANNER-030
  function geometryChange(points?: Point[], dimension?: string) {
    importId.current++;
    session.current.changeGeometry();
    scanJob.current.cancel();
    setBusy("");
    setSource(null);
    setAck(false);
    if (points) setCorners(points);
    if (dimension !== undefined) {
      setScanGrid(dimension);
      setConfirmed(false);
    }
    setScanError("");
  }
  let scanN = 32,
    scanGridError = "";
  try {
    scanN = validateGrid(scanGrid);
  } catch (e) {
    scanGridError = errorText(e);
  }
  let quality: { minimum: number; level: string } | null = null,
    geometryError = "";
  if (photo && corners.length) {
    try {
      if (!validCorners(corners, photo.raster.width, photo.raster.height))
        throw new Error("Place all four corners clockwise inside the photo.");
      quality = gridQuality(corners, scanN);
    } catch (e) {
      geometryError = errorText(e);
    }
  }
  const canSample =
    !!photo &&
    confirmed &&
    !busy &&
    !scanGridError &&
    !geometryError &&
    quality?.level !== "blocked" &&
    (quality?.level !== "warning" || ack);
  // @spec SCANNER-024, SCANNER-025, SCANNER-027
  async function convert() {
    if (!photo || !canSample) return;
    const request = session.current.beginRequest(),
      revision = session.current.drawingRevision;
    setBusy("Reading your colors");
    setScanError("");
    try {
      const pixels = await scanJob.current.run<Uint8Array>("sample", {
        image: photo.raster,
        corners,
        n: scanN,
      });
      if (!session.current.isCurrent(request)) return;
      setSource({ pixels, n: scanN, revision });
      setBusy("");
    } catch (e) {
      if (!session.current.isCurrent(request)) return;
      setScanError(errorText(e));
      setBusy("");
    }
  }
  // @spec SCANNER-011
  function cancelScan() {
    importId.current++;
    session.current.beginReplacement();
    scanJob.current.cancel();
    setBusy("");
    setMessage("Processing cancelled. Adjust the grid or retry.");
  }
  let outputSize = 0,
    scaleError = "";
  try {
    outputSize = exportSize(source?.n || scanN, scale);
  } catch (e) {
    scaleError = errorText(e);
  }
  // @spec ARTWORK-019, ARTWORK-020, ARTWORK-021, ARTWORK-022, ARTWORK-023, ARTWORK-024, ARTWORK-025
  async function download() {
    if (!pal.ready || !pal.output || !source || scaleError || encoding) return;
    const epoch = exportEpoch.current;
    setEncoding(true);
    setExportError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("Could not create the export. Try a lower scale.");
      const data = ctx.createImageData(outputSize, outputSize);
      data.data.set(scaledPixels(pal.output.pixels, source.n, Number(scale)));
      ctx.putImageData(data, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (epoch !== exportEpoch.current) return;
      if (!blob)
        throw new Error("Could not encode the PNG. Try a lower scale.");
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `pixel-art-${source.n}x${source.n}-${scale}x.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      if (epoch === exportEpoch.current) setExportError(errorText(e));
    } finally {
      setEncoding(false);
    }
  }
  return (
    <>
      <style>{`@page { size: ${paper === "A4" ? "A4" : "letter"} portrait; margin: 0; }`}</style>
      <div className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView("create");
            }}
          >
            <span className="brand-mark">
              <Grid2X2 size={22} />
            </span>
            paper<span className="brand-light">pixel</span>
            <span className="beta">BETA</span>
          </a>
          <div className="header-links">
            <div className="private-label">
              <LockKeyhole size={13} />
              <span>Your art stays on your device</span>
            </div>
            <a
              className="github-link"
              href="https://github.com/RevenantScholar/paper-pixel"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository (opens in a new tab)"
              title="GitHub repository (opens in a new tab)"
            >
              <Github size={18} aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
        </header>
        <main>
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span /> A LITTLE PAPER. A LOT OF POSSIBILITY.
              </div>
              <h1>
                From paper <span>to pixels.</span>
              </h1>
              <p>
                A real pen. A paper grid. Your imagination.
                <br className="mobile-break" /> Turn your hand-drawn creations
                into pixel art.
              </p>
            </div>
            <div className="intro-art">
              <div className="flower-paper">
                <PixelFlower />
              </div>
              <span className="art-caption">made by hand, kept in pixels</span>
            </div>
          </section>
          <nav className="tabs" aria-label="Workspace">
            <button
              className={view === "create" ? "active" : ""}
              onClick={() => setView("create")}
              aria-label="Create worksheet"
            >
              <Grid2X2 size={17} />
              Create worksheet<span className="tab-number">01</span>
            </button>
            <button
              className={view === "scan" ? "active" : ""}
              onClick={() => setView("scan")}
              aria-label="Scan drawing"
            >
              <ScanLine size={18} />
              Scan drawing<span className="tab-number">02</span>
            </button>
          </nav>
          {view === "create" ? (
            <div className="workspace create-workspace">
              <aside className="settings">
                <div className="section-kicker">START WITH A BLANK CANVAS</div>
                <h2>
                  Make room for <br />
                  your imagination.
                </h2>
                <p className="muted">
                  Set up your grid, print it out, <br />
                  and make something only you could.
                </p>
                <div className="control">
                  <label htmlFor="grid-size">
                    Grid size <span>pixels per side</span>
                  </label>
                  <div className="number-with-unit">
                    <input
                      id="grid-size"
                      aria-describedby={gridError ? "grid-error" : undefined}
                      type="number"
                      min="2"
                      max="64"
                      value={grid}
                      onChange={(e) => setGrid(e.target.value)}
                    />
                    <span>× {gridError ? "—" : n}</span>
                    <Grid2X2 size={19} />
                  </div>
                  <div className="quick-options">
                    {[8, 16, 32, 64].map((v) => (
                      <button
                        key={v}
                        className={n === v && !gridError ? "selected" : ""}
                        onClick={() => setGrid(String(v))}
                      >
                        {v} × {v}
                      </button>
                    ))}
                  </div>
                  {gridError && (
                    <p id="grid-error" className="field-error">
                      {gridError}
                    </p>
                  )}
                  {n > 32 && !gridError && (
                    <p className="hint">
                      Smaller cells need a clear, close-up photo.
                    </p>
                  )}
                </div>
                <div className="control">
                  <label htmlFor="paper-size">Paper size</label>
                  <select
                    id="paper-size"
                    value={paper}
                    onChange={(e) => setPaper(e.target.value as Paper)}
                  >
                    <option value="LETTER">US Letter · 8.5 × 11 in</option>
                    <option value="A4">A4 · 210 × 297 mm</option>
                  </select>
                  <p className="hint">The grid grows to fill your page.</p>
                </div>
                <button
                  className="primary full"
                  disabled={!!gridError}
                  onClick={() => window.print()}
                  aria-label="Print worksheet"
                >
                  <Printer size={17} />
                  Print worksheet
                  <ArrowRight size={17} />
                </button>
                <p className="print-note">Print on paper or save as a PDF.</p>
                <div className="tip-card">
                  <Sparkles size={17} />
                  <div>
                    <strong>Let your colors do the talking.</strong>
                    <p>
                      Use any pens, pencils, or markers. We'll find the palette
                      in your drawing.
                    </p>
                  </div>
                </div>
              </aside>
              <section className="preview-area" aria-label="Worksheet preview">
                <div className="preview-top">
                  <span>
                    <span className="live-dot" />
                    PRINT PREVIEW
                  </span>
                  <span>
                    {paper === "A4" ? "A4" : "US LETTER"}
                    <span className="divider">/</span>PORTRAIT
                  </span>
                </div>
                <div className="sheet-stage">
                  <div
                    className="paper-preview"
                    dangerouslySetInnerHTML={{ __html: sheet }}
                  />
                  <div className="paper-tag">
                    <Grid2X2 size={13} />
                    {n} × {n}
                    <span>·</span>
                    {(n * n).toLocaleString()} little possibilities
                  </div>
                </div>
                <div className="preview-bottom">
                  <Maximize size={14} />
                  <span>A full-page grid, whatever your resolution.</span>
                  <span className="paper-measure">
                    {Math.round(page.side)} mm square
                  </span>
                </div>
              </section>
            </div>
          ) : (
            <div className="scan-workspace">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadPhoto(f);
                  e.target.value = "";
                }}
              />
              <div className="scan-heading">
                <div>
                  <div className="section-kicker">
                    BRING YOUR DRAWING TO LIFE
                  </div>
                  <h2>
                    {photo
                      ? "A little alignment. A little magic."
                      : "Your paper has a digital side."}
                  </h2>
                  <p className="muted">
                    Keep the grid and all four corner markers in the photo.
                  </p>
                </div>
                {photo && (
                  <button
                    className="secondary"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={16} />
                    Choose another photo
                  </button>
                )}
              </div>
              {scanError && (
                <div role="alert" className="alert">
                  <span>{scanError}</span>
                  <button
                    onClick={() => setScanError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {(camera || cameraPending) && (
                <div className="camera-panel">
                  {camera ? (
                    <video ref={video} autoPlay playsInline muted />
                  ) : (
                    <div className="loading-camera">
                      <LoaderCircle className="spin" />
                      Waiting for camera permission…
                    </div>
                  )}
                  <div className="camera-actions">
                    {camera && (
                      <button className="primary" onClick={capture}>
                        <Camera size={17} />
                        Capture drawing
                      </button>
                    )}
                    <button className="secondary" onClick={stopCamera}>
                      Cancel camera
                    </button>
                  </div>
                </div>
              )}
              {!photo && !camera && !cameraPending && (
                <div
                  className="upload-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) void loadPhoto(f);
                  }}
                >
                  <div className="upload-illustration">
                    <div className="mini-grid">
                      <PixelFlower />
                    </div>
                    <span>
                      <ScanLine size={28} />
                    </span>
                  </div>
                  <h3>Meet your next pixel masterpiece.</h3>
                  <p>
                    Take a photo of your finished worksheet
                    <br />
                    or drop an image here to get started.
                  </p>
                  <div className="upload-actions">
                    <button
                      className="primary"
                      onClick={() => fileInput.current?.click()}
                    >
                      <ImagePlus size={18} />
                      Choose photo
                    </button>
                    <button className="secondary" onClick={startCamera}>
                      <Camera size={18} />
                      Use camera
                    </button>
                  </div>
                  <span className="upload-formats">
                    JPG, PNG, OR WEBP · UP TO 20 MB
                  </span>
                </div>
              )}
              {busy && (
                <div className="processing" role="status">
                  <LoaderCircle size={17} className="spin" />
                  {busy}…<button onClick={cancelScan}>Cancel</button>
                </div>
              )}
              {photo && (
                <div className="scan-columns">
                  <section className="review-panel">
                    <div className="panel-top">
                      <h3>
                        <ScanLine size={16} />
                        Check your grid
                      </h3>
                      <button
                        className="icon-button"
                        aria-label="Rotate 90 degrees"
                        onClick={() =>
                          geometryChange([
                            corners[3],
                            corners[0],
                            corners[1],
                            corners[2],
                          ])
                        }
                        disabled={corners.length !== 4}
                      >
                        <RotateCw size={17} />
                      </button>
                    </div>
                    <GridReview
                      url={photo.url}
                      width={photo.raster.width}
                      height={photo.raster.height}
                      corners={corners}
                      n={scanN}
                      onChange={(p) => geometryChange(p)}
                    />
                    <p className="hint">
                      {message ||
                        "Drag the four handles onto the drawing corners."}
                    </p>
                    <div className="scan-controls">
                      <div>
                        <label htmlFor="scan-grid">Scan grid size</label>
                        <input
                          id="scan-grid"
                          type="number"
                          min="2"
                          max="64"
                          value={scanGrid}
                          onChange={(e) =>
                            geometryChange(undefined, e.target.value)
                          }
                        />
                      </div>
                      <button
                        className="secondary"
                        disabled={!!scanGridError || confirmed}
                        onClick={() => setConfirmed(true)}
                      >
                        {confirmed ? (
                          <>
                            <Check size={15} />
                            Confirmed
                          </>
                        ) : (
                          "Confirm grid size"
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Retry detection"
                        onClick={() => {
                          geometryChange();
                          void detect(photo);
                        }}
                      >
                        <ScanLine size={17} />
                      </button>
                    </div>
                    {(scanGridError || geometryError) && (
                      <p className="field-error">
                        {scanGridError || geometryError}
                      </p>
                    )}
                    {quality?.level === "blocked" && (
                      <p className="field-error">
                        Cells are too small to read. Take a closer or
                        higher-resolution photo.
                      </p>
                    )}
                    {quality?.level === "warning" && !ack && (
                      <div className="warning">
                        These cells may be too small for a clear result.
                        <button
                          className="secondary"
                          onClick={() => {
                            session.current.acknowledge();
                            setAck(true);
                          }}
                        >
                          Continue anyway
                        </button>
                      </div>
                    )}
                    <div className="review-actions">
                      <button
                        className="primary"
                        disabled={!canSample}
                        onClick={convert}
                      >
                        Convert to pixels
                        <ArrowRight size={16} />
                      </button>
                      <button className="secondary" onClick={startCamera}>
                        <Camera size={16} />
                        Retake
                      </button>
                    </div>
                  </section>
                  <section className="artwork-panel">
                    <div className="panel-top">
                      <h3>
                        <Grid2X2 size={16} />
                        Your pixel art
                      </h3>
                      {source && (
                        <span className="small-badge">
                          {source.n} × {source.n}
                        </span>
                      )}
                    </div>
                    {pal.output ? (
                      <div
                        className={`art-preview ${!pal.ready ? "stale" : ""}`}
                      >
                        <PixelCanvas
                          pixels={pal.output.pixels}
                          n={Math.sqrt(pal.output.pixels.length / 3)}
                        />
                        {!pal.ready && (
                          <span className="preview-status">
                            {pal.status === "working"
                              ? "Finding your palette…"
                              : "Previous result"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="art-placeholder">
                        <Grid2X2 size={34} />
                        <p>Your pixels will appear here.</p>
                        <span>Align your grid and hit convert.</span>
                      </div>
                    )}
                    {source && (
                      <>
                        <div
                          className="palette-mode"
                          role="group"
                          aria-label="Palette mode"
                        >
                          <button
                            type="button"
                            aria-pressed={chosenPalette.mode === "photo"}
                            onClick={() => chosenPalette.setMode("photo")}
                          >
                            From photo
                          </button>
                          <button
                            type="button"
                            aria-pressed={chosenPalette.mode === "selected"}
                            onClick={() => chosenPalette.setMode("selected")}
                          >
                            Choose palette
                          </button>
                        </div>
                        {chosenPalette.mode === "selected" ? (
                          <SelectedPalette
                            model={chosenPalette}
                            recolorControls={
                              <GroupRecoloring
                                method={method}
                                onMethod={setMethod}
                                count={groupText}
                                onCount={(value) => {
                                  setPalette("custom");
                                  setCustomK(value);
                                }}
                                valid={groupValid}
                                groups={
                                  base.ready && groupValid ? base.output : null
                                }
                                palette={chosenPalette.current?.colors ?? []}
                                indices={mappings.indices}
                                onAssign={assignGroup}
                                onReset={resetMappings}
                              />
                            }
                            preview={
                              pal.output ? (
                                <>
                                  <PixelCanvas
                                    pixels={pal.output.pixels}
                                    n={Math.sqrt(pal.output.pixels.length / 3)}
                                  />
                                  <span className="hint">
                                    {pal.ready
                                      ? "Live preview"
                                      : "Previous result"}
                                  </span>
                                </>
                              ) : undefined
                            }
                          />
                        ) : (
                          <>
                            <div className="palette-row">
                              <label htmlFor="palette-size">Palette size</label>
                              <select
                                id="palette-size"
                                value={palette}
                                onChange={(e) => setPalette(e.target.value)}
                              >
                                <option value="rgb">
                                  Full RGB · original colors
                                </option>
                                <option value="2">2 colors · 1-bit</option>
                                <option value="4">4 colors · 2-bit</option>
                                <option value="16">16 colors · 4-bit</option>
                                <option value="256">256 colors · 8-bit</option>
                                <option value="custom">
                                  Custom color count
                                </option>
                              </select>
                              {palette === "custom" && (
                                <input
                                  aria-label="Custom color count"
                                  type="number"
                                  min="2"
                                  max="16777216"
                                  value={customK}
                                  onChange={(e) => setCustomK(e.target.value)}
                                />
                              )}
                            </div>
                            {!paletteValid && (
                              <p className="field-error">
                                Choose a whole-number capacity from 2 to
                                16,777,216.
                              </p>
                            )}
                          </>
                        )}
                        {pal.output && (
                          <>
                            <div className="swatches">
                              {pal.output.colors.slice(0, 64).map((c, i) => (
                                <span
                                  key={i}
                                  style={{ background: `rgb(${c.join(",")})` }}
                                  title={`RGB ${c.join(", ")} · ${pal.output!.counts[i]} cells`}
                                />
                              ))}
                            </div>
                            <div className="palette-meta">
                              <span>{pal.output.colors.length} colors</span>
                              <span>
                                {pal.status === "cached"
                                  ? "Cached palette"
                                  : pal.status === "original"
                                    ? "Original colors"
                                    : chosenPalette.mode === "selected"
                                      ? "Matched to selected colors"
                                      : "Collected from your drawing"}
                              </span>
                            </div>
                          </>
                        )}
                        {pal.status === "working" && (
                          <div className="processing">
                            <LoaderCircle size={15} className="spin" />
                            Finding colors…
                            <button onClick={pal.cancel}>Cancel</button>
                          </div>
                        )}
                        {pal.error && (
                          <div className="alert" role="alert">
                            <div>
                              {pal.error}
                              <div className="inline-actions">
                                <button onClick={pal.retry}>Retry</button>
                                <button
                                  onClick={() => {
                                    setPalette("rgb");
                                    chosenPalette.setMode("photo");
                                  }}
                                >
                                  Use Full RGB
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="export-settings">
                          <div>
                            <label htmlFor="export-scale">Export scale</label>
                            <div className="scale-input">
                              <input
                                id="export-scale"
                                type="number"
                                min="1"
                                max={Math.floor(4096 / source.n)}
                                value={scale}
                                onChange={(e) => setScale(e.target.value)}
                              />
                              <span>×</span>
                            </div>
                          </div>
                          <div className="output-size">
                            <span>PNG DIMENSIONS</span>
                            <strong>
                              {scaleError
                                ? "—"
                                : `${outputSize} × ${outputSize}`}
                            </strong>
                          </div>
                        </div>
                        {scaleError && (
                          <p className="field-error">{scaleError}</p>
                        )}
                        {exportError && (
                          <p className="field-error" role="alert">
                            {exportError}
                          </p>
                        )}
                        <button
                          className="primary full"
                          disabled={!pal.ready || !!scaleError || encoding}
                          onClick={download}
                        >
                          {encoding ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <Download size={17} />
                          )}
                          Download PNG
                        </button>
                        <p className="print-note">
                          Sharp pixels at every size. Always yours.
                        </p>
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}
          <section className="how-it-works">
            <div className="how-title">
              ANALOG JOY.
              <br />
              <span>DIGITAL POSSIBILITIES.</span>
            </div>
            <div className="how-step">
              <span>01</span>
              <div>
                <strong>Print a little possibility</strong>
                <p>A grid that gives your ideas room.</p>
              </div>
            </div>
            <ChevronRight className="step-arrow" size={16} />
            <div className="how-step">
              <span>02</span>
              <div>
                <strong>Make your mark</strong>
                <p>Pick up your favorite colors.</p>
              </div>
            </div>
            <ChevronRight className="step-arrow" size={16} />
            <div className="how-step">
              <span>03</span>
              <div>
                <strong>Bring it into pixels</strong>
                <p>Scan, find your palette, and save.</p>
              </div>
            </div>
          </section>
        </main>
        <footer>
          <span>Made for the joy of making.</span>
          <span>
            <span className="footer-dot" />
            No accounts. No uploads. Just your art.
          </span>
        </footer>
      </div>
      <div
        className="print-sheet"
        dangerouslySetInnerHTML={{ __html: sheet }}
      />
    </>
  );
}
