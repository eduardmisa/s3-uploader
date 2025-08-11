import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandler } from 'aws-lambda';
import sharp from "sharp";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

const s3Client = new S3Client({ region: process.env.DEPLOY_REGION });

export const getPresignedUrl: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("process.env.S3_BUCKET_NAME ->", process.env.S3_BUCKET_NAME);

    const { fileName, contentType, filePathPrefix } = JSON.parse(event.body || '{}');

    console.log("Request Body ->", { fileName, contentType, filePathPrefix });

    if (!fileName || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing fileName or contentType in request body' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      };
    }

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filePathPrefix ? `${filePathPrefix}/${fileName}` : fileName,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour

    return {
      statusCode: 200,
      body: JSON.stringify({ presignedUrl }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to generate presigned URL', error: error instanceof Error ? error.message : 'Unknown error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  }
};

export const listFiles: APIGatewayProxyHandler = async () => {
  try {
    const command: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
    });

    const response: ListObjectsV2CommandOutput = await s3Client.send(command);
    const baseUrl = CLOUDFRONT_DOMAIN
      ? `https://${CLOUDFRONT_DOMAIN}`
      : `https://${S3_BUCKET_NAME}.s3.${process.env.DEPLOY_REGION}.amazonaws.com`;
    const allFileUrls = (response.Contents || [])
      .filter(object => object.Key && !object.Key.endsWith('/')) // Exclude directories
      .map(object => `${baseUrl}/${object.Key}`);

    const fileUrls = allFileUrls.filter(url => !url.includes("-thumbnail."))
    const imageThumbnailsUrls = allFileUrls.filter(url => url.includes("-thumbnail."))

    return {
      statusCode: 200,
      body: JSON.stringify({ fileUrls, imageThumbnailsUrls }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  } catch (error) {
    console.error("Error listing files from S3:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to list files from S3', error: error instanceof Error ? error.message : 'Unknown error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  }
};

/**
 * Helper to convert a readable stream (GetObjectCommand output Body) to Buffer
 */
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

const isImageKey = (key: string) => {
  return /\.(jpe?g|png|webp|gif)$/i.test(key);
};

const buildThumbnailKey = (key: string) => {
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

export const generateThumbnails: APIGatewayProxyHandler = async (event) => {
  try {
    if (!S3_BUCKET_NAME) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'S3_BUCKET_NAME is not configured' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      };
    }

    /**
     * CONFIGURABLE BATCH SIZE
     * Change this constant to tweak how many files the endpoint accepts per request.
     */
    const BATCH_SIZE = 10;

    // Parse incoming keys/urls from request body
    const body = JSON.parse(event.body || '{}');
    const inputList: any = body.keys || body.urls || body.files || [];

    if (!Array.isArray(inputList) || inputList.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Request body must include a non-empty array in "keys" or "urls"' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      };
    }

    if (inputList.length > BATCH_SIZE) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Too many files requested. Max per request is ${BATCH_SIZE}` }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      };
    }

    // Utility to extract S3 key from either a plain key or a full URL (S3 or CloudFront)
    const parseKeyFromUrl = (val: string): string => {
      if (!val) return '';
      // if already looks like a key (no protocol)
      if (!/^https?:\/\//i.test(val)) return val;

      try {
        const url = new URL(val);
        // If URL host contains the bucket name, return everything after the bucket in the path
        if (S3_BUCKET_NAME && url.hostname.includes(S3_BUCKET_NAME)) {
          // path starts with /<key>
          return url.pathname.replace(/^\//, '');
        }

        // If CLOUDFRONT_DOMAIN is configured and matches, return path
        if (CLOUDFRONT_DOMAIN && url.hostname.includes(CLOUDFRONT_DOMAIN)) {
          return url.pathname.replace(/^\//, '');
        }

        // If AWS S3 REST style (bucket.s3.amazonaws.com), the key is pathname without leading slash
        if (/s3[.-]amazonaws\.com$/i.test(url.hostname) || url.hostname.endsWith('.s3.amazonaws.com')) {
          return url.pathname.replace(/^\//, '');
        }

        // Fallback: take the path part after the hostname
        return url.pathname.replace(/^\//, '');
      } catch (e) {
        // If URL constructor fails, fallback to raw value
        return val;
      }
    };

    // Normalize input to keys and filter invalid entries
    const requestedKeys = inputList
      .map((v: string) => parseKeyFromUrl(String(v).trim()))
      .filter((k: string) => k && !k.endsWith('/'));

    if (requestedKeys.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No valid S3 keys were parsed from the request' }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      };
    }

    const created: string[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const key of requestedKeys) {
      try {
        if (!isImageKey(key) || key.includes('-thumbnail')) {
          // Skip non-images or already-thumbnailed files
          errors.push({ key, error: 'Skipped (not image or already a thumbnail)' });
          continue;
        }

        console.log(`Processing ${key}`);
        const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key });
        const getResp = await s3Client.send(getCmd);
        const bodyStream = getResp.Body as any;
        const originalBuffer = await streamToBuffer(bodyStream);

        // Create thumbnail (resize width to 200 while preserving aspect ratio)
        const thumbBuffer = await sharp(originalBuffer)
          .resize({ width: 200, withoutEnlargement: true })
          .toBuffer();

        const thumbKey = buildThumbnailKey(key);

        // Determine content type from extension
        let contentType = 'image/jpeg';
        const extMatch = key.match(/\.(jpe?g|png|webp|gif)$/i);
        if (extMatch) {
          const ext = extMatch[1].toLowerCase();
          if (ext.startsWith('png')) contentType = 'image/png';
          else if (ext.startsWith('webp')) contentType = 'image/webp';
          else if (ext.startsWith('gif')) contentType = 'image/gif';
          else contentType = 'image/jpeg';
        }

        const putCmd = new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: contentType,
          ACL: 'bucket-owner-full-control',
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  } catch (error) {
    console.error("Error generating thumbnails:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to generate thumbnails', error: error instanceof Error ? error.message : 'Unknown error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  }
};
