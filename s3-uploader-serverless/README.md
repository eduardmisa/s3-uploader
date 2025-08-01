# S3 Uploader Backend API

A serverless API built with AWS Lambda to provide secure pre-signed URLs for S3 uploads and to list images from an S3 bucket. This backend allows the frontend application to interact with S3 without exposing AWS credentials directly.

## Repository Setup

1.  Clone the repository (if standalone) or navigate to the `s3-uploader-serverless` directory within your monorepo.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure AWS credentials (see Deployment Guide section)

## API Endpoints

### POST /upload
Generates a pre-signed URL for uploading a file to an S3 bucket. The frontend can then use this URL to directly upload the file to S3.

**Request Body:**
```json
{
  "fileName": "path/to/your/file.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "presignedUrl": "https://your-bucket.s3.amazonaws.com/path/to/your/file.jpg?AWSAccessKeyId=...&Expires=...&Signature=..."
}
```

### GET /images
Retrieves a list of image URLs from the configured S3 bucket. This endpoint supports fetching-level pagination.

**Query Parameters:**
- `limit` (optional): The maximum number of images to return per request (default is set in Lambda).
- `continuationToken` (optional): Token for fetching the next page of results.

**Response:**
```json
{
  "imageUrls": [
    "https://your-bucket.s3.amazonaws.com/image1.png",
    "https://your-bucket.s3.amazonaws.com/folder/image2.jpg"
  ],
  "nextContinuationToken": "some-token-for-next-page"
}
```

## CORS Support

The API is configured to allow cross-origin requests from any origin (`*`) for the S3-related endpoints.

## Deployment Guide

### Prerequisites

1.  Node.js and npm installed
2.  Serverless Framework installed globally:
    ```bash
    npm install -g serverless
    ```
3.  AWS credentials configured:
    ```bash
    # Using AWS CLI
    aws configure
    ```
    Or manually create ~/.aws/credentials:
    ```
    [default]
    aws_access_key_id = YOUR_ACCESS_KEY
    aws_secret_access_key = YOUR_SECRET_KEY
    ```

### Deploy Steps

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Deploy to AWS:
    ```bash
    serverless deploy
    ```

After successful deployment, the API endpoints will be available via an API Gateway URL. You will need to copy this URL and configure it in your frontend application's environment variables.

### Remove Deployment

To remove all deployed resources:
```bash
serverless remove
```

## Development

### Project Setup
The project uses TypeScript with ESBuild for optimal deployment package size.

### Build and Bundle
The deployment process automatically:
1.  Transpiles TypeScript code
2.  Bundles and minifies with ESBuild
3.  Excludes `@aws-sdk/*` (provided by Lambda)
4.  Optimizes for Node.js 18 runtime

### Environment Variables
The following environment variables are used:
-   `AWS_REGION`: The AWS region where the Lambda functions are deployed.
-   `S3_BUCKET_NAME`: The name of the S3 bucket for uploads and listings (e.g., `emisa-pub-pictures`).

### Utility Functions
This project contains minimal utility functions directly related to S3 operations.
