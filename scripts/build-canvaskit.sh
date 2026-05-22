#!/usr/bin/env bash
# Builds CanvasKit (Skia compiled to WASM) with the PDF backend enabled
# and drops the artifacts into public/canvaskit/, where the app picks them
# up via CanvasKitLoader.ts.
#
# Requires Docker. Allow ~30–60 minutes for the first run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_TAG="${IMAGE_TAG:-pixi-skia-pdf/canvaskit-pdf}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT/public/canvaskit}"

echo ">> Building Docker image ${IMAGE_TAG}…"
docker build \
    -t "$IMAGE_TAG" \
    -f "$ROOT/tools/canvaskit-pdf/Dockerfile" \
    "$ROOT"

echo ">> Extracting artifacts into ${OUTPUT_DIR}…"
mkdir -p "$OUTPUT_DIR"
CID="$(docker create "$IMAGE_TAG")"
trap 'docker rm "$CID" >/dev/null' EXIT
docker cp "$CID":/artifacts/canvaskit.wasm "$OUTPUT_DIR/canvaskit.wasm"
docker cp "$CID":/artifacts/canvaskit.js   "$OUTPUT_DIR/canvaskit.js"

echo ">> Done. CanvasKit (with PDF) ready at ${OUTPUT_DIR}"
ls -lh "$OUTPUT_DIR"
