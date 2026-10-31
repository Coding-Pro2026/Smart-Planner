import { extractText, getDocumentProxy } from "unpdf";
import { HttpError } from "../http";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 40;

/**
 * Extract text from an uploaded PDF. Local parsing only: this module performs NO network I/O, and
 * pdf.js is run with scripting/fonts-from-URL disabled by unpdf's serverless build, so a hostile PDF
 * cannot make the server fetch anything (SSRF) — external links in the file are just text.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) throw new HttpError(400, "Empty file");
  if (bytes.length > MAX_PDF_BYTES) throw new HttpError(413, "PDF is larger than 10 MB");
  // %PDF- magic bytes at the start of the file — don't trust the filename or MIME.
  const head = Buffer.from(bytes.subarray(0, 16)).toString("latin1");
  if (!/^(?:\xEF\xBB\xBF)?\s{0,4}%PDF-/.test(head)) throw new HttpError(400, "That file is not a PDF");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new HttpError(422, "Could not read this PDF (corrupt or password-protected)");
  }
  if (pdf.numPages > MAX_PAGES) throw new HttpError(413, `PDF has more than ${MAX_PAGES} pages`);
  const { text } = await extractText(pdf, { mergePages: true });
  const clean = text.replace(/[ \t]+/g, " ").trim();
  if (clean.length < 20) throw new HttpError(422, "No selectable text found — this looks like a scanned PDF");
  return clean;
}
