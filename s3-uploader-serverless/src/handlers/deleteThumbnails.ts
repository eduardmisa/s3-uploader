import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { APIGatewayProxyHandler } from "aws-lambda";
import { S3_BUCKET_NAME, s3Client } from "../lib/s3-utils";
import { withAuth } from "../lib/auth";
import { getCorsHeaders } from "../lib/http-utils";

export const deleteThumbnails: APIGatewayProxyHandler = withAuth(async (event) => {
  try {
    if (!S3_BUCKET_NAME) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "S3_BUCKET_NAME is not configured" }),
        headers: getCorsHeaders(),
      };
    }

    let continuationToken: string | undefined = undefined;
    let allThumbnailKeys: { Key: string }[] = [];

    do {
      const listParams: { Bucket: string; ContinuationToken?: string } = {
        Bucket: S3_BUCKET_NAME,
        ContinuationToken: continuationToken,
      };

      const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));
      const thumbnailsInBatch = listedObjects.Contents?.filter(
        (obj: { Key?: string }) => obj.Key?.includes("-thumbnail.")
      ).map(({ Key }: { Key?: string }) => ({ Key: Key! })) || [];

      allThumbnailKeys = allThumbnailKeys.concat(thumbnailsInBatch);
      continuationToken = listedObjects.NextContinuationToken;
    } while (continuationToken);

    if (allThumbnailKeys.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No thumbnails found to delete." }),
        headers: getCorsHeaders(),
      };
    }

    const deleteParams = {
      Bucket: S3_BUCKET_NAME,
      Delete: {
        Objects: allThumbnailKeys,
        Quiet: false,
      },
    };

    await s3Client.send(new DeleteObjectsCommand(deleteParams));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted ${allThumbnailKeys.length} thumbnails.` }),
      headers: getCorsHeaders(),
    };
  } catch (error) {
    console.error("Error deleting thumbnails:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to delete thumbnails", error: error instanceof Error ? error.message : "Unknown error" }),
      headers: getCorsHeaders(),
    };
  }
});