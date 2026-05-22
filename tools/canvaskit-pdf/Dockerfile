# ---------------------------------------------------------------------------
# Builds a CanvasKit WASM with the PDF backend enabled.
#
# The default upstream `canvaskit-wasm` npm package is built without
# `skia_enable_pdf`, so SkPDF symbols are stripped from the artifact. We:
#   1. Clone Skia at a known revision.
#   2. Drop in `canvaskit_pdf_bindings.cpp`, a tiny standalone source that
#      exposes `MakePDFDocument(width, height, metadata)` to JS.
#   3. Patch `BUILD.gn` to include the new file in the canvaskit target.
#   4. Patch `compile.sh` to flip `skia_enable_pdf=false` → `true`.
#   5. Run `modules/canvaskit/compile.sh release`.
#
# Output: /artifacts/canvaskit.{wasm,js}
#
# Build:
#   docker build -t canvaskit-pdf -f tools/canvaskit-pdf/Dockerfile .
# ---------------------------------------------------------------------------

FROM --platform=linux/amd64 emscripten/emsdk:3.1.56 AS builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        git python3 python3-pip curl ca-certificates build-essential \
        ninja-build pkg-config && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /src

ARG SKIA_REV=chrome/m121
RUN git clone --depth 1 --branch "$SKIA_REV" \
        https://skia.googlesource.com/skia.git /src/skia

WORKDIR /src/skia
RUN python3 tools/git-sync-deps

# Drop the additional translation unit into Skia's canvaskit module and patch
# the build to compile it. We deliberately use a separate .cpp instead of
# `git apply` so the build does not depend on exact line numbers in upstream.
COPY tools/canvaskit-pdf/canvaskit_pdf_bindings.cpp \
     /src/skia/modules/canvaskit/canvaskit_pdf_bindings.cpp

RUN set -eux; \
    # 1) Add the new source file to canvaskit's GN sources list (idempotent).
    if ! grep -q canvaskit_pdf_bindings modules/canvaskit/BUILD.gn; then \
      sed -i 's|"canvaskit_bindings.cpp",|"canvaskit_bindings.cpp",\n    "canvaskit_pdf_bindings.cpp",|' modules/canvaskit/BUILD.gn; \
    fi; \
    grep -n canvaskit_pdf_bindings modules/canvaskit/BUILD.gn; \
    \
    # 2) Enable PDF in the compile.sh GN args block.
    sed -i 's/skia_enable_pdf=false/skia_enable_pdf=true/' modules/canvaskit/compile.sh; \
    grep -n 'skia_enable_pdf' modules/canvaskit/compile.sh

# Compile CanvasKit (release). The compile.sh script also picks up any
# overrides from the GN_ARGS env var, but our changes above are enough.
RUN cd modules/canvaskit && \
    ./compile.sh release
# Stage artifacts in a separate RUN so a copy issue does not discard the full
# compile (Docker only caches successful RUNs). The compile.sh script `pushd`s
# to /src/skia and uses BUILD_DIR=out/canvaskit_wasm for the GN/Ninja output.
RUN set -eux; \
    mkdir -p /artifacts; \
    cp /src/skia/out/canvaskit_wasm/canvaskit.wasm /artifacts/canvaskit.wasm; \
    cp /src/skia/out/canvaskit_wasm/canvaskit.js   /artifacts/canvaskit.js; \
    ls -lh /artifacts; \
    # Sanity-check that our PDF symbol survived the link.
    grep -o "MakePDFDocument" /artifacts/canvaskit.js | head -1 || \
        (echo "ERROR: MakePDFDocument missing from CanvasKit JS" && exit 1)

# Final stage: a tiny image containing only the artifacts.
FROM alpine:3.20
COPY --from=builder /artifacts /artifacts
CMD ["sh", "-c", "ls -la /artifacts && echo 'Use: docker cp <container>:/artifacts ./public/canvaskit'"]
