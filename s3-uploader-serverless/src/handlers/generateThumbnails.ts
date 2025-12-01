import { PutObjectCommand } from "@aws-sdk/client-s3";
import { APIGatewayProxyHandler } from "aws-lambda";
import sharp from "sharp";
import {
  S3_BUCKET_NAME,
  s3Client,
  isImageKey,
  isVideoKey,
  extractFrameFromVideo,
  buildThumbnailKey,
  getObjectBuffer,
} from "../lib/s3-utils";
import { withAuth } from "../lib/auth";
import { getCorsHeaders } from "../lib/http-utils";

export const generateThumbnails: APIGatewayProxyHandler = withAuth(async (event) => {
  try {
    if (!S3_BUCKET_NAME) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "S3_BUCKET_NAME is not configured" }),
        headers: getCorsHeaders(event),
      };
    }

    const BATCH_SIZE = 10;
    const body = JSON.parse(event.body || "{}");
    const inputList: any = body.keys || body.urls || body.files || [];

    if (!Array.isArray(inputList) || inputList.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Request body must include a non-empty array in "keys" or "urls"' }),
        headers: getCorsHeaders(event),
      };
    }

    if (inputList.length > BATCH_SIZE) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Too many files requested. Max per request is ${BATCH_SIZE}` }),
        headers: getCorsHeaders(event),
      };
    }

    const parseKeyFromUrl = (val: string): string => {
      if (!val) return "";
      if (!/^https?:\/\//i.test(val)) return val;

      try {
        const url = new URL(val);
        if (S3_BUCKET_NAME && url.hostname.includes(S3_BUCKET_NAME)) {
          return url.pathname.replace(/^\//, "");
        }
        if (process.env.CLOUDFRONT_DOMAIN && url.hostname.includes(process.env.CLOUDFRONT_DOMAIN)) {
          return url.pathname.replace(/^\//, "");
        }
        if (/s3[.-]amazonaws\.com$/i.test(url.hostname) || url.hostname.endsWith(".s3.amazonaws.com")) {
          return url.pathname.replace(/^\//, "");
        }
        return url.pathname.replace(/^\//, "");
      } catch (e) {
        return val;
      }
    };

    const requestedKeys = inputList
      .map((v: string) => parseKeyFromUrl(String(v).trim()))
      .filter((k: string) => k && !k.endsWith("/"));

    if (requestedKeys.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "No valid S3 keys were parsed from the request" }),
        headers: getCorsHeaders(event),
      };
    }

    const created: string[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const key of requestedKeys) {
      try {
        if (key.includes("-thumbnail")) {
          errors.push({ key, error: "Skipped (already a thumbnail)" });
          continue;
        }

        console.log(`Processing ${key}`);
        const originalBuffer = await getObjectBuffer(key);

        let thumbBuffer: Buffer;
        let contentType = "image/jpeg";

        if (isImageKey(key)) {
          thumbBuffer = await sharp(originalBuffer).resize({ width: 200, withoutEnlargement: true }).toBuffer();

          const extMatch = key.match(/\.(jpe?g|png|webp|gif)$/i);
          if (extMatch) {
            const ext = extMatch[1].toLowerCase();
            if (ext.startsWith("png")) contentType = "image/png";
            else if (ext.startsWith("webp")) contentType = "image/webp";
            else if (ext.startsWith("gif")) contentType = "image/gif";
            else contentType = "image/jpeg";
          }
        } else if (isVideoKey(key)) {
          const frameBuffer = await extractFrameFromVideo(originalBuffer);
          if (!frameBuffer || frameBuffer.length === 0) {
            throw new Error("Failed to extract frame from video");
          }

          thumbBuffer = await sharp(frameBuffer).resize({ width: 200, withoutEnlargement: true }).jpeg().toBuffer();
          contentType = "image/jpeg";
        } else {
          errors.push({ key, error: "Skipped (unsupported file type)" });
          continue;
        }

        const thumbKey = buildThumbnailKey(key);

        const putCmd = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: contentType,
          ACL: "bucket-owner-full-control",
        });

        await s3Client.send(putCmd);
        created.push(thumbKey);
      } catch (err) {
        console.error(`Failed to process ${key}:`, err);
        errors.push({ key, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ created, errors }),
      headers: getCorsHeaders(event),
    };
  } catch (error) {
    console.error("Error generating thumbnails:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to generate thumbnails", error: error instanceof Error ? error.message : "Unknown error" }),
      headers: getCorsHeaders(event),
    };
  }
});
