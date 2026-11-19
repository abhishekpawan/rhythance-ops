import { CreateAttachmentInput } from "../../types/support";

export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
];
export const ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".csv",
];

export interface UploadItem {
  id: string;
  file: File;
  status: "uploading" | "success" | "error";
  error?: string;
  attachment?: CreateAttachmentInput;
  previewUrl?: string;
  isImage: boolean;
}
