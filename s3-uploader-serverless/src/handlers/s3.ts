import { S3Client, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyHandler } from 'aws-lambda';

const s3Client = new S3Client({ region: process.env.AWS_REGION }) || "ap-southeast-1";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "emisa-pub-pictures"; // Use environment variable for bucket name

export const getPresignedUrl: APIGatewayProxyHandler = async (event) => {
  try {
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

export const listImages: APIGatewayProxyHandler = async (event) => {
  try {
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 10; // Default to 10
    const continuationToken = event.queryStringParameters?.continuationToken || undefined;

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET_NAME,
      MaxKeys: limit,
      ContinuationToken: continuationToken,
    });

    const { Contents, NextContinuationToken } = await s3Client.send(command);

    const imageUrls: string[] = [];
    if (Contents) {
      Contents.forEach(object => {
        if (object.Key && (object.Key.endsWith('.jpg') || object.Key.endsWith('.jpeg') || object.Key.endsWith('.png') || object.Key.endsWith('.gif') || object.Key.endsWith('.bmp') || object.Key.endsWith('.webp'))) {
          const imageUrl = `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${object.Key}`;
          imageUrls.push(imageUrl);
        }
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ imageUrls, nextContinuationToken: NextContinuationToken }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  } catch (error) {
    console.error("Error listing images from S3:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to list images from S3', error: error instanceof Error ? error.message : 'Unknown error' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    };
  }
};
