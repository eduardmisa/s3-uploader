import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import ffmpegPath from "ffmpeg-static";

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export const s3Client = new S3Client({ region: process.env.DEPLOY_REGION });

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    if (stream instanceof Buffer) {
      return resolve(stream);
    }
    stream.on('data', (chunk: any) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: any) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

export const isImageKey = (key: string) => {
  return /\.(jpe?g|png|webp|gif)$/i.test(key);
};

export const isVideoKey = (key: string) => {
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(key);
};

export const buildThumbnailKey = (key: string) => {
  // preserve directory path, append -thumbnail before the last extension
  const lastSlash = key.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : key.slice(0, lastSlash + 1);
  const base = lastSlash === -1 ? key : key.slice(lastSlash + 1);
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${dir}${base}-thumbnail`;
  }
  const name = base.slice(0, dotIndex);
  const ext = base.slice(dotIndex); // includes dot
  return `${dir}${name}-thumbnail${ext}`;
};

/**
 * Extract a single frame from a video buffer using ffmpeg (ffmpeg-static).
 * Returns an image buffer (raw image data) which can be processed by sharp.
 */
export const extractFrameFromVideo = async (buffer: Buffer): Promise<Buffer> => {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary not found (ffmpeg-static returned null)");
  }

  // Write the video buffer to a temp file and have ffmpeg extract a single frame to a temp image file.
  // This avoids pipe-related demuxing issues for some files.
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

    // Collect stderr for debug, but we don't stream stdout since ffmpeg writes to a file
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

    // Read generated image
    const imgBuffer = await fs.readFile(imagePath);

    return imgBuffer;
  } finally {
    // Best-effort cleanup
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
