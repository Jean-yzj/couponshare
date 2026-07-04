import { ApiError } from "./errors";

// Validate a base64 data-URI image (chat / report evidence): must be a real
// PNG/JPG/GIF/WebP (magic-byte sniff, no SVG) and under the size cap. Returns the
// data URI unchanged, or null if none. Throws VALIDATION_ERROR otherwise.
export function validateDataUriImage(
  image: string | null | undefined,
  maxBytes = 450 * 1024,
): string | null {
  if (!image) return null;
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) throw new ApiError("VALIDATION_ERROR", { message: "圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP" });
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > maxBytes) {
    throw new ApiError("VALIDATION_ERROR", { message: "圖片太大，請換一張或截圖裁小一點" });
  }
  if (!sniffImageType(bytes)) {
    throw new ApiError("VALIDATION_ERROR", { message: "圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP" });
  }
  return image;
}

// Verify the real image type from magic bytes — never trust the client-supplied
// MIME. SVG (and anything unrecognised) returns null and is rejected: an SVG can
// carry inline scripts and would be a stored-XSS vector if opened directly.
export function sniffImageType(b: Buffer): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}
