import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import ffmpegPath from "ffmpeg-static";
import mime from "mime-types";

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export const s3Client = new S3Client({ region: process.env.DEPLOY_REGION });

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    if (stream instanceof Buffer) {
      return resolve(stream);
    }
    stream.on("data", (chunk: any) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err: any) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

/**
 * Get MIME type from a key (based on extension) using mime-types.
 */
const getMimeTypeFromKey = (key: string): string => {
  const type = mime.lookup(key);
  return typeof type === "string" && type.length > 0
    ? type
    : "application/octet-stream";
};

export const isImageKey = (key: string) => {
  const mimeType = getMimeTypeFromKey(key);
  return mimeType.startsWith("image/");
};

export const isVideoKey = (key: string) => {
  const mimeType = getMimeTypeFromKey(key);
  return mimeType.startsWith("video/");
};

/**
 * Get the appropriate content type for an *image* response.
 * For image keys, we return the detected image MIME type.
 * For video keys (when generating thumbnails), we default to JPEG.
 * Otherwise we fall back to application/octet-stream.
 */
export const getImageContentType = (key: string): string => {
  const mimeType = getMimeTypeFromKey(key);

  if (mimeType.startsWith("image/")) {
    return mimeType;
  }

  // If the source is a video but we're generating an image thumbnail for it,
  // keep returning JPEG thumbnails.
  if (mimeType.startsWith("video/")) {
    return "image/jpeg";
  }

  return "application/octet-stream";
};

export const buildThumbnailKey = (key: string) => {
  // preserve directory path, append -thumbnail before the last extension
  const lastSlash = key.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : key.slice(0, lastSlash + 1);
  const base = lastSlash === -1 ? key : key.slice(lastSlash + 1);
  const dotIndex = base.lastIndexOf(".");
  let name = base;
  const ext = ".jpeg"; // Always JPEG for thumbnails

  if (dotIndex !== -1) {
    name = base.slice(0, dotIndex);
  }

  // Prepend "thumbnails/" to the key and preserve the original directory structure
  return `thumbnails/${dir}${name}-thumbnail${ext}`;
};

/**
 * Extract a single frame from a video buffer using ffmpeg (ffmpeg-static).
 * Returns an image buffer (raw image data) which can be processed by sharp.
 */
export const extractFrameFromVideo = async (buffer: Buffer): Promise<Buffer> => {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static returned null)");
  }

  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `video-${randomUUID()}.tmp`);
  const imagePath = path.join(tmpDir, `frame-${randomUUID()}.jpg`);

  try {
    await fs.writeFile(videoPath, buffer, { encoding: "binary" });

    const args = [
      "-ss",
      "00:00:00.500", // seek to 0.5s
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2", // quality for jpeg
      imagePath,
    ];

    const ff = spawn(ffmpegPath as string, args) as ChildProcessWithoutNullStreams;

    let stderr = "";
    ff.stderr.on("data", (d: Buffer | string) => {
      stderr += d.toString();
    });

    await new Promise<void>((resolve, reject) => {
      ff.on("error", (err: Error) => reject(err));
      ff.on("close", (code: number | null) => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderr}`));
      });
    });

    const imgBuffer = await fs.readFile(imagePath);
    return imgBuffer;
  } finally {
    try {
      await fs.unlink(videoPath).catch(() => {});
      await fs.unlink(imagePath).catch(() => {});
    } catch {
      // ignore cleanup errors
    }
  }
};

/**
 * Convenience wrapper to get an object buffer from S3 for a given key.
 * Returns the buffer of the object or throws.
 */
export const getObjectBuffer = async (key: string): Promise<Buffer> => {
  const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key });
  const getResp = await s3Client.send(getCmd);
  const bodyStream = getResp.Body as any;
  return await streamToBuffer(bodyStream);
};
