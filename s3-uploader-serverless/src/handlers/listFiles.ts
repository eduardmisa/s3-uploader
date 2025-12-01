import { ListObjectsV2Command, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { APIGatewayProxyHandler } from "aws-lambda";
import { s3Client, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN } from "../lib/s3-utils";
import { withAuth } from "../lib/auth";
import { getCorsHeaders } from "../lib/http-utils";

/**
 * Lists all files in the S3 bucket. Uses pagination (ListObjectsV2) to ensure
 * we retrieve more than the 1000-object default limit.
 */
export const listFiles: APIGatewayProxyHandler = withAuth(async (event) => {
  try {
    const allObjects: NonNullable<ListObjectsV2CommandOutput["Contents"]> = [];
    let continuationToken: string | undefined = undefined;

    // Paginate through all objects in the bucket
    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: S3_BUCKET_NAME,
        ContinuationToken: continuationToken,
      });

      const response: ListObjectsV2CommandOutput = await s3Client.send(command);

      if (response.Contents && response.Contents.length > 0) {
        allObjects.push(...response.Contents);
      }

      // If truncated, use NextContinuationToken for the next request
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    const baseUrl = CLOUDFRONT_DOMAIN
      ? `https://${CLOUDFRONT_DOMAIN}`
      : `https://${S3_BUCKET_NAME}.s3.${process.env.DEPLOY_REGION}.amazonaws.com`;

    const allFileUrls = (allObjects || [])
      .filter((object) => object.Key && !object.Key.endsWith("/")) // Exclude "directory" markers
      .map((object) => `${baseUrl}/${object.Key}`);

    const fileUrls = allFileUrls.filter((url) => !url.includes("-thumbnail."));
    const imageThumbnailsUrls = allFileUrls.filter((url) => url.includes("-thumbnail."));

    return {
      statusCode: 200,
      body: JSON.stringify({ fileUrls, imageThumbnailsUrls }),
      headers: getCorsHeaders(event),
    };
  } catch (error) {
    console.error("Error listing files from S3:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to list files from S3",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      headers: getCorsHeaders(event),
    };
  }
});
