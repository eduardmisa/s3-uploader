import { ListObjectsV2Command, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { APIGatewayProxyHandler } from "aws-lambda";
import { s3Client, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN } from "../lib/s3-utils";

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
      .filter((object) => object.Key && !object.Key.endsWith("/")) // Exclude directories
      .map((object) => `${baseUrl}/${object.Key}`);

    const fileUrls = allFileUrls.filter((url) => !url.includes("-thumbnail."));
    const imageThumbnailsUrls = allFileUrls.filter((url) => url.includes("-thumbnail."));

    return {
      statusCode: 200,
      body: JSON.stringify({ fileUrls, imageThumbnailsUrls }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  } catch (error) {
    console.error("Error listing files from S3:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to list files from S3",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
};
