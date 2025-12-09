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
    const body: { url: string; thumbnail?: string }[] = JSON.parse(event.body || "[]");
    const inputList = body;

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
        body: JSON.stringify({ message: `Too many items requested. Max per request is ${BATCH_SIZE}` }),
        headers: getCorsHeaders(event),
      };
    }

    const parseKeyFromUrl = (val: string): string => {
      if (!val) return "";
      if (!/^https?:\/\//i.test(val)) return val;

      try {
        const url = new URL(val);
        return decodeURIComponent(url.pathname.replace(/^\//, ""))
      } catch (e) {
        return val;
      }
    };

    const created: string[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const item of inputList) {
      const { url, thumbnail } = item;
      const key = parseKeyFromUrl(url);

      if (!key || key.endsWith("/")) {
        errors.push({ url, error: "Skipped (invalid S3 key)" });
        continue;
      }

      try {
        if (key.includes("-thumbnail")) {
          errors.push({ url, error: "Skipped (already a thumbnail)" });
          continue;
        }

        console.log(`Processing ${url}`);
        let thumbBuffer: Buffer;

        if (thumbnail) {
          // Use provided base64 thumbnail
          const base64Data = thumbnail.replace(/^data:image\/\w+;base64,/, "");
          thumbBuffer = Buffer.from(base64Data, "base64");
        } else {
          // Generate thumbnail from URL
          const originalBuffer = await getObjectBuffer(key);

          if (isImageKey(key)) {
            thumbBuffer = await sharp(originalBuffer).resize({ width: 200, withoutEnlargement: true }).jpeg().toBuffer();
          } else if (isVideoKey(key)) {
            const frameBuffer = await extractFrameFromVideo(originalBuffer);
            if (!frameBuffer || frameBuffer.length === 0) {
              throw new Error("Failed to extract frame from video");
            }
            thumbBuffer = await sharp(frameBuffer).resize({ width: 200, withoutEnlargement: true }).jpeg().toBuffer();
          } else {
            errors.push({ url, error: "Skipped (unsupported file type for thumbnail generation)" });
            continue;
          }
        }

        const thumbKey = buildThumbnailKey(key);

        const putCmd = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/jpeg", // Always JPEG for thumbnails
          ACL: "bucket-owner-full-control",
        });

        await s3Client.send(putCmd);
        created.push(thumbKey);
      } catch (err) {
        console.error(`Failed to process ${url}:`, err);
        errors.push({ url, error: err instanceof Error ? err.message : String(err) });
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
