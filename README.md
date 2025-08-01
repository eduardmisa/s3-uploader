# S3 File Uploader Application

This repository contains a full-stack application for securely uploading files to AWS S3 and displaying an image gallery. It is composed of two main parts: a React-TypeScript frontend and a Node.js Serverless backend.

## Architecture Overview

The application follows a decoupled architecture:

*   **Frontend (`s3-uploader-web`)**: A Vite-based React-TypeScript application that provides the user interface for file selection, upload progress, and image display. It interacts with the backend API to perform S3 operations.
*   **Backend (`s3-uploader-serverless`)**: A Serverless Framework project that deploys AWS Lambda functions and API Gateway endpoints. Its primary responsibilities are:
    *   Generating secure, time-limited pre-signed URLs for direct file uploads from the frontend to S3. This avoids exposing AWS credentials in the client-side application.
    *   Listing image files from the S3 bucket, with support for fetching-level pagination.

**Interaction Flow:**
1.  The frontend requests a pre-signed URL from the backend for a specific file.
2.  The backend generates and returns the pre-signed URL.
3.  The frontend uses the pre-signed URL to directly upload the file to S3.
4.  The frontend requests image listings from the backend.
5.  The backend lists images from S3 and returns their public URLs.

## Features

*   Secure file uploads to S3 using pre-signed URLs.
*   Drag-and-drop interface with interactive progress indicators.
*   Parallel uploads and folder upload support.
*   Image previews and local storage persistence for uploaded files.
*   Option to override existing files during upload.
*   Collapsible and paginated file lists for better UI management.
*   S3 Image Gallery with fetching-level pagination.
*   Modern UI built with Radix UI and state management with TanStack Query.

## Getting Started

To set up and run the application, follow these high-level steps. Refer to the individual `README.md` files within `s3-uploader-serverless/` and `s3-uploader-web/` for detailed instructions.

### 1. Deploy the Backend

Navigate to the `s3-uploader-serverless/` directory and deploy the Serverless project to your AWS account.

```bash
cd s3-uploader-serverless
npm install # Install backend dependencies
serverless deploy # Deploy to AWS
```

After deployment, copy the API Gateway endpoint URL provided by the Serverless Framework.

### 2. Configure and Run the Frontend

Navigate to the `s3-uploader-web/` directory, configure the backend API URL, and start the development server.

```bash
cd s3-uploader-web
npm install # Install frontend dependencies
```

Create or update the `.env` file in `s3-uploader-web/` with the API Gateway URL:

```
VITE_BACKEND_API_URL="YOUR_API_GATEWAY_ENDPOINT_HERE"
```

Replace `"YOUR_API_GATEWAY_ENDPOINT_HERE"` with the URL copied from the backend deployment.

Then, run the frontend:

```bash
npm run dev
```

Open your browser to the address provided by Vite (e.g., `http://localhost:5173`).

## Project Structure

```
.
├── README.md                   # This file
├── s3-uploader-serverless/     # Serverless backend project
│   ├── README.md               # Backend specific README
│   ├── serverless.yml          # Serverless configuration
│   ├── src/                    # Lambda function source code
│   └── package.json            # Backend dependencies
└── s3-uploader-web/            # React frontend project
    ├── README.md               # Frontend specific README
    ├── src/                    # React components and logic
    ├── .env                    # Frontend environment variables
    └── package.json            # Frontend dependencies
