import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Define a type for the file state
export type FileUploadState = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "uploaded" | "failed" | "skipped";
  progress: number;
  // s3Location?: string; // Removed as frontend no longer constructs this
  error?: string;
  preview?: string; // Add preview URL for images
};

export interface TreeNode {
  name: string;
  type: "folder" | "file";
  url?: string;
  children?: TreeNode[];
}
