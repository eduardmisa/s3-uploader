import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
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

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const ff = spawn(ffmpegPath as string, [
        "-i",
        "pipe:0",
        "-ss",
        "00:00:00.500",
        "-vframes",
        "1",
        "-f",
        "image2",
        "pipe:1",
      ]) as ChildProcessWithoutNullStreams;

      const chunks: Buffer[] = [];
      ff.stdout.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      ff.stderr.on("data", (d: Buffer | string) => {
        // ffmpeg logs to stderr; keep for debugging
        console.error("ffmpeg:", d.toString());
      });
      ff.on("error", (err: Error) => reject(err));
      ff.on("close", (code: number | null) => {
        if (code === 0 || code === null) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ff.stdin.write(buffer);
      ff.stdin.end();
    } catch (err) {
      reject(err as Error);
    }
  });
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
