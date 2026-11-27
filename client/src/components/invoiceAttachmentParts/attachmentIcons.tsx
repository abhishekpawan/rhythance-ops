import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Mail,
} from "lucide-react";

// The file icon of an attachment, moved out of InvoiceAttachments.tsx unchanged (R-5s).
// Helper function to get file icon based on type
export const getFileIcon = (fileType: string, fileName: string) => {
  if (fileType.startsWith("image/")) {
    return <ImageIcon size={16} />;
  } else if (fileType === "application/pdf") {
    return <FileText size={16} />;
  } else if (
    fileType.includes("excel") ||
    fileType.includes("spreadsheet") ||
    fileType === "text/csv" ||
    fileName.toLowerCase().endsWith(".csv")
  ) {
    return <FileSpreadsheet size={16} />;
  } else if (
    fileType === "message/rfc822" ||
    fileName.toLowerCase().endsWith(".eml")
  ) {
    return <Mail size={16} />;
  }
  return <FileText size={16} />;
};

// Helper function to format file size
