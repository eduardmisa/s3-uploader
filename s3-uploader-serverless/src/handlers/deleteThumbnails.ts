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
        (obj): obj is { Key: string } => obj.Key !== undefined && obj.Key.includes("-thumbnail.")
      ).map((obj) => ({ Key: obj.Key as string })) || [];

      allThumbnailKeys = allThumbnailKeys.concat(thumbnailsInBatch);
      continuationToken = listedObjects.NextContinuationToken;
    } while (continuationToken);

    console.log("Found thumbnails to delete:", allThumbnailKeys.length);
    if (allThumbnailKeys.length === 0) {
      console.log("No thumbnails found to delete. Returning early.");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No thumbnails found to delete." }),
        headers: getCorsHeaders(),
      };
    }

    const deleteParams = {
      Bucket: S3_BUCKET_NAME,
      Delete: {
        Objects: allThumbnailKeys.map(obj => ({ Key: obj.Key })),
        Quiet: false,
      },
    };

    console.log("Delete parameters:", JSON.stringify(deleteParams, null, 2));

    const BATCH_SIZE = 10;
    let deletedCount = 0;

    for (let i = 0; i < allThumbnailKeys.length; i += BATCH_SIZE) {
      const batch = allThumbnailKeys.slice(i, i + BATCH_SIZE);
      const batchDeleteParams = {
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: batch.map(obj => ({ Key: obj.Key })),
          Quiet: false,
        },
      };
      console.log(`Deleting batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allThumbnailKeys.length / BATCH_SIZE)}`);
      await s3Client.send(new DeleteObjectsCommand(batchDeleteParams));
      deletedCount += batch.length;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted ${deletedCount} thumbnails.` }),
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