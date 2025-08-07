import { S3Client, ListObjectsV2Command, PutObjectCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandler } from 'aws-lambda';

const s3Client = new S3Client({ region: process.env.DEPLOY_REGION });
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

export const getPresignedUrl: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("process.env.S3_BUCKET_NAME ->", process.env.S3_BUCKET_NAME);

    const { fileName, contentType } = JSON.parse(event.body || '{}');

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
      Key: fileName,
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

export const listFiles: APIGatewayProxyHandler = async (event) => {
  try {
    const command: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
    });

    const response: ListObjectsV2CommandOutput = await s3Client.send(command);
    const fileUrls = (response.Contents || [])
      .filter(object => object.Key && !object.Key.endsWith('/')) // Exclude directories
      .map(object => `https://${S3_BUCKET_NAME}.s3.${process.env.DEPLOY_REGION}.amazonaws.com/${object.Key}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ fileUrls }),
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
