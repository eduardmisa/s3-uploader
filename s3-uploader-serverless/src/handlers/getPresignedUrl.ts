import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandler } from "aws-lambda";
import { s3Client, S3_BUCKET_NAME } from "../lib/s3-utils";

export const getPresignedUrl: APIGatewayProxyHandler = async (event) => {
  try {
    const { fileName, contentType, filePathPrefix } = JSON.parse(event.body || "{}");

    if (!fileName || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing fileName or contentType in request body" }),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
      };
    }

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: filePathPrefix ? `${filePathPrefix}/${fileName}` : fileName,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ presignedUrl }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to generate presigned URL",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  }
};
