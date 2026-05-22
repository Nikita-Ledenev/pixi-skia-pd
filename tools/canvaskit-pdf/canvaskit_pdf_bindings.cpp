// canvaskit_pdf_bindings.cpp
//
// PDF backend bindings for the pixi-skia-pdf custom CanvasKit build.
// Exposes a tiny JS-friendly wrapper around SkPDF::MakeDocument so the web
// app can produce vector PDFs without dropping out of TypeScript.
//
// Usage from JS:
//   const doc = CanvasKit.MakePDFDocument(width, height, {title, author});
//   const skCanvas = doc.getCanvas();
//   // ...draw into skCanvas using CanvasKit's normal API...
//   doc.endPage();
//   const bytes = doc.close();   // Uint8Array (independent copy)
//   doc.delete();                 // free the C++ instance

#include "include/core/SkCanvas.h"
#include "include/core/SkData.h"
#include "include/core/SkDocument.h"
#include "include/core/SkRefCnt.h"
#include "include/core/SkStream.h"
#include "include/core/SkString.h"
#include "include/docs/SkPDFDocument.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <cstdint>
#include <string>
#include <utility>

namespace {

class SkPdfDocumentJs {
 public:
    SkPdfDocumentJs(float width, float height, std::string title, std::string author) {
        SkPDF::Metadata md;
        if (!title.empty())  md.fTitle  = SkString(title.c_str());
        if (!author.empty()) md.fAuthor = SkString(author.c_str());
        md.fCreator = SkString("pixi-skia-pdf");
        fDoc = SkPDF::MakeDocument(&fStream, md);
        if (fDoc) {
            fCanvas = fDoc->beginPage(width, height);
        }
    }

    // Returns the SkCanvas for the current page (raw pointer, owned by the doc).
    SkCanvas* getCanvas() const { return fCanvas; }

    void beginPage(float w, float h) {
        if (fDoc) {
            fCanvas = fDoc->beginPage(w, h);
        }
    }

    void endPage() {
        if (fDoc) {
            fDoc->endPage();
        }
        fCanvas = nullptr;
    }

    // Closes the document and returns the encoded bytes as a fresh JS Uint8Array.
    // The data is copied into the JS heap so SkData lifetime no longer matters.
    emscripten::val close() {
        if (fDoc) {
            fDoc->close();
            fDoc.reset();
        }
        sk_sp<SkData> data = fStream.detachAsData();
        if (!data || data->size() == 0) {
            return emscripten::val::global("Uint8Array").new_(0);
        }
        emscripten::val view = emscripten::val(emscripten::typed_memory_view(
            data->size(), static_cast<const uint8_t*>(data->data())));
        // .new_(view) creates a copy on the JS heap; the WASM-side SkData
        // is released when this function returns.
        return emscripten::val::global("Uint8Array").new_(view);
    }

 private:
    SkDynamicMemoryWStream fStream;
    sk_sp<SkDocument>      fDoc{nullptr};
    SkCanvas*              fCanvas{nullptr};
};

SkPdfDocumentJs* MakePDFDocument(float width, float height, emscripten::val meta) {
    std::string title;
    std::string author;
    if (!meta.isUndefined() && !meta.isNull()) {
        emscripten::val t = meta["title"];
        if (!t.isUndefined() && !t.isNull()) title = t.as<std::string>();
        emscripten::val a = meta["author"];
        if (!a.isUndefined() && !a.isNull()) author = a.as<std::string>();
    }
    return new SkPdfDocumentJs(width, height, std::move(title), std::move(author));
}

}  // namespace

EMSCRIPTEN_BINDINGS(PDFDocument) {
    emscripten::class_<SkPdfDocumentJs>("PDFDocument")
        .function("getCanvas", &SkPdfDocumentJs::getCanvas, emscripten::allow_raw_pointers())
        .function("beginPage", &SkPdfDocumentJs::beginPage)
        .function("endPage",   &SkPdfDocumentJs::endPage)
        .function("close",     &SkPdfDocumentJs::close);

    emscripten::function("MakePDFDocument", &MakePDFDocument,
                         emscripten::allow_raw_pointers());
}
