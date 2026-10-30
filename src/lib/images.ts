import { HttpError } from "./http";
import type { ImageInput } from "./llm/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Validate a base64 image by magic bytes — never trust the declared MIME type. */
export function validateImage(img: ImageInput): ImageInput {
  const buf = Buffer.from(img.base64, "base64");
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Image must be under 5 MB");
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
  const actual = isPng ? "image/png" : isJpg ? "image/jpeg" : isWebp ? "image/webp" : null;
  if (!actual) throw new HttpError(400, "Unsupported image (use PNG, JPEG or WebP)");
  return { mime: actual, base64: img.base64 };
}
