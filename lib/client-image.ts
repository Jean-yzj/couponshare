"use client";

// Read an image File and return a downscaled JPEG data URI (white background,
// max 960px, quality 0.82). Keeps chat / report-evidence screenshots well under
// the server size cap and strips EXIF. Runs in the browser only.
export function fileToDataUri(file: File, maxSide = 960, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Downscale a large photo File to a smaller JPEG Blob before upload — used for the
// barcode / QR image so multi-MB phone photos don't time out on mobile or hit the
// server's 5MB cap (a failed upload leaves the coupon stuck as an un-publishable
// draft). Deliberately conservative — generous 1600px, high 0.92 quality — so
// barcodes/QR stay scannable. Small files pass through untouched; any decode error
// falls back to the original (the server still enforces its own 5MB + type checks).
// 2000px / q0.92 verified offline: every QR that decoded uncompressed still decoded
// after this compression (barcodes are simpler/more robust than dense QRs).
export function compressForUpload(
  file: File,
  {
    maxSide = 2000,
    quality = 0.92,
    skipUnderBytes = 1_000_000,
  }: { maxSide?: number; quality?: number; skipUnderBytes?: number } = {},
): Promise<Blob> {
  return new Promise((resolve) => {
    if (file.size <= skipUnderBytes) return resolve(file);
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? blob : file), "image/jpeg", quality);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
