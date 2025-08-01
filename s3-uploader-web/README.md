# S3 File Uploader Frontend

This project is a React-TypeScript frontend application designed for securely uploading files to an AWS S3 bucket and displaying an image gallery from the same bucket. It interacts with a separate serverless backend for handling S3 operations, ensuring that AWS credentials are not exposed on the client-side.

## Features

*   **Drag-and-Drop Interface**: Easily upload files by dragging and dropping them onto a designated area.
*   **Modern UI with Radix UI**: Built with Radix UI components for a clean, accessible, and responsive user experience, optimized for desktop.
*   **Parallel Uploads**: Efficiently uploads multiple files concurrently.
*   **Interactive File Lists**: Displays files in different states (queued, uploading, uploaded, failed, skipped) with progress indicators and micro-animations.
*   **Image Previews**: Shows small thumbnail previews for image files in the lists.
*   **Local Storage Persistence**: Remembers previously uploaded files to prevent re-uploading duplicates.
*   **Override Existing Files**: Option to re-upload files that already exist in S3, replacing them.
*   **Upload Skipped Files**: Button to re-queue and upload files that were initially skipped.
*   **Collapsible Sections**: File lists are organized into collapsible cards for better UI management.
*   **Pagination**: All file lists and the S3 Image Gallery include pagination for managing large numbers of items.
*   **S3 Image Gallery**: Displays images directly from your S3 bucket in a collage-like layout, with fetching-level pagination.
*   **React Query Integration**: Utilizes TanStack Query (`useQuery`, `useInfiniteQuery`, `useMutation`) for robust data fetching, caching, and state management.

## Backend Dependency

This frontend application relies on a separate serverless backend (e.g., `s3-uploader-serverless`) to handle secure S3 operations. The backend provides API endpoints for generating pre-signed upload URLs and listing S3 bucket contents.

## Getting Started

### Prerequisites

*   Node.js and npm installed.
*   The `s3-uploader-serverless` backend deployed and its API Gateway URL available.

### Installation

1.  Navigate to the project directory:
    ```bash
    cd s3-uploader-web
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration

Create a `.env` file in the root of the `s3-uploader-web` directory with the following content:

```
VITE_BACKEND_API_URL="YOUR_API_GATEWAY_ENDPOINT_HERE"
```

Replace `"YOUR_API_GATEWAY_ENDPOINT_HERE"` with the actual API Gateway URL obtained after deploying your `s3-uploader-serverless` backend.

### Running the Application

1.  Start the development server:
    ```bash
    npm run dev
    ```
2.  Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## Development

This project uses React with TypeScript and Vite.

*   **React**: A JavaScript library for building user interfaces.
*   **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.
*   **Vite**: A fast build tool that provides a lightning-fast development experience.
*   **Radix UI**: A low-level UI component library for building accessible design systems.
*   **TanStack Query**: For server state management (fetching, caching, synchronizing, and updating server data).
