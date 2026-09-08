# Worksheet, Scan, and Artwork Interaction Audit

Scope: the current high-level design, three component designs, and their behavioral requirements. The four resolutions below are approved and govern implementation.

## Approved Decisions

### 1. Retaking a photo and retaining palette comparisons

SCANNER-005 preserves the previous usable scan until replacement decode succeeds. SCANNER-010 cancels outstanding work on retake, while ARTWORK-031 clears cached palettes when samples become invalid. An implementation could treat opening the camera as invalidation and discard the comparisons even if the user cancels.

Resolution: starting a retake or file selection cancels outstanding requests but does not invalidate the committed drawing or its completed palette cache. Cancelled or failed replacement restores the existing usable scan and cache. Successful replacement decode commits the new image, invalidates old samples and clears their palette cache; old artwork can no longer be exported. A later detection failure belongs to the new image and offers manual alignment or retry.

Owning design: Scanner's replacement lifecycle. Artwork consumes the resulting explicit source-invalidation event.

### 2. Geometry changes and identity of cached artwork

SCANNER-009 distinguishes image revisions and worker requests, while SCANNER-027 exports a sampled revision and ARTWORK-026 keys cached results by that revision. Editing corners or rotation changes pixels without changing the photograph. The revision contract does not yet explicitly distinguish photograph identity from sampled-drawing identity.

Resolution: every committed sampling change, including dimension, corner, or orientation changes, advances a drawing revision independent of the photo revision. Old palette results and pending PNG encodes become invalid immediately. A successful sampling request carries that drawing revision into Artwork. A cached result cannot be reused solely because the photograph is unchanged. Sampling settings restored to an earlier value still receive a new revision; geometry undo does not resurrect old caches in the first release.

Owning design: Scanner owns drawing revision and publishes it through SampledDrawing. Artwork cache and export consume that revision.

### 3. Navigation during processing

WORKSHEET-018 and ARTWORK-031 preserve work and caches across Create/Scan navigation, while SCANNER-004 stops camera tracks on leaving Scan. Worker lifetime is not explicitly tied to navigation, so implementations could either discard pending calculations or finish them in the background.

Resolution: leaving Scan stops live camera tracks but preserves the current photo, alignment, artwork, and cache. Already-started detection, sampling, and palette calculations continue in application-owned workers while Create is shown, subject to the same timeout and revision checks. Returning to Scan displays the completed result or current activity/error. Explicit Cancel still terminates the corresponding operation. A pending camera request is cancelled on leaving Scan and cannot reopen the camera later.

Owning design: Worksheet owns application state lifetime. Scanner and Artwork own their operation lifecycle within that state.

### 4. Resolution warning after adjusting the scan

SCANNER-024 requires Continue for projected cells between 4 and 8 pixels thick. SCANNER-019 and SCANNER-020 allow dimension, corner, and orientation changes afterward. A single stored Continue flag could unintentionally authorize a different, lower-quality sampling configuration.

Resolution: bind Continue to the current drawing revision. Any change to sampling geometry or dimensions clears that acknowledgment and reruns the resolution check. Palette-size and export-scale changes preserve it because they do not change sampling geometry. Cells below 4 pixels remain blocked regardless of earlier acknowledgment.

Owning design: Scanner's sampling-quality gate; palette and export controls leave the gate unchanged.

## Consistent Interactions

- WORKSHEET-013/016 and SCANNER-014/028 define one normalized recognition layout with no scan paper-size dependency. Fit-to-page scaling preserves the geometric contract.
- SCANNER-026 and ARTWORK-013 include paper-colored cells in the inferred palette with no reserved white color.
- ARTWORK-014 and ARTWORK-027 separate uncached calculation from immediate cache restoration; ARTWORK-028 prevents an obsolete worker or timeout from overwriting a hit.
- ARTWORK-006/029 preserve original colors when capacity exceeds distinct-color count without allocating an entry for every equivalent capacity.
- ARTWORK-015/019 retain export-scale preferences across a new scan while revalidating the 4096-pixel bound against the new grid dimension.
- ARTWORK-020/032 make scaling an export operation that cannot mutate cached logical pixels or introduce interpolated colors.
- WORKSHEET-017 and SCANNER-019 prevent Create settings from reinterpreting a loaded scan.

## Validation Status

The approved resolutions are reflected in the component designs, requirements, and implementation. Runtime verification is recorded in [verification.md](verification.md). Physical camera and printer limits still require the trials described in the component designs.

## Color-sensitive Palette Distance

Artwork uses ΔL² + 8Δa² + 8Δb² consistently for initialization errors and axis selection, Lloyd assignment and candidate comparison, and finalized-palette assignment. Frequency-weighted means remain the minimizing centroids for these fixed axis weights. Scanner samples and Full RGB remain unchanged; no saturation transform or special paper-color slot is introduced. Grayscale inputs retain neutral representatives. Reduced results remain deterministic and cacheable by drawing revision and capacity. Distinct hue preservation is preferred to equal-axis lightness fidelity, but small palettes cannot guarantee every pigment a representative.
