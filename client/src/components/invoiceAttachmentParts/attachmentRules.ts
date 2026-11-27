// The rules and types of the invoice attachments list, moved out of InvoiceAttachments.tsx unchanged (R-5s).

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
export const MAX_FILES = 10;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
  "message/rfc822", // .eml files
  "application/octet-stream", // fallback for .eml files
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".csv",
  ".eml",
];

export interface AttachmentFile {
  id: string;
  file?: File;
  fileName: string;
  fileSize: number;
  fileType: string;
  filePath?: string;
  previewUrl?: string;
  isUploaded: boolean;
  uploadStatus: "pending" | "uploading" | "uploaded" | "error";
  bucketName?: string;
}

export interface InvoiceAttachmentsProps {
  value: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
  disabled?: boolean;
  bucketName?: string;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to validate file
export const validateFile = (file: File): string | null => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds the 3MB limit. Current size: ${formatFileSize(file.size)}`;
  }

  // Check file extension
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `File type not allowed. Allowed types: PDF, Images (JPG, PNG, GIF, etc.), Excel (XLS, XLSX), EML files`;
  }

  // Check MIME type (less reliable but additional check)
  if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== "") {
    // Special case for .eml files which might have different MIME types
    if (!file.name.toLowerCase().endsWith(".eml")) {
      return `File type not supported. Please use PDF, image, Excel, or EML files.`;
    }
  }

  return null;
};
