import { MAX_FILES, validateFile, AttachmentFile } from "./attachmentRules";
import { supabase } from "../../lib/supabaseClient";
import PDFThumbnail from "../PDFThumbnail";
import { Eye } from "lucide-react";
import { getFileIcon } from "./attachmentIcons";
import type { readAttachmentProps } from "./readAttachmentProps";
import type { useAttachmentState } from "./useAttachmentState";

export function createAttachmentActions(
  ctx: ReturnType<typeof readAttachmentProps> &
    ReturnType<typeof useAttachmentState>
) {
  const {
    bucketName,
    fileInputRef,
    onChange,
    setErrors,
    setIsPdfModalOpen,
    setSelectedPdfName,
    setSelectedPdfUrl,
    value,
  } = ctx;
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newErrors: string[] = [];

    // Check total file count
    if (value.length + files.length > MAX_FILES) {
      newErrors.push(
        `Maximum ${MAX_FILES} files allowed. You're trying to add ${files.length} files but already have ${value.length}.`
      );
    }

    // Validate each file
    const validFiles: File[] = [];
    files.forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`File ${index + 1} (${file.name}): ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    setErrors(newErrors);

    // Add valid files to attachments
    if (
      validFiles.length > 0 &&
      value.length + validFiles.length <= MAX_FILES
    ) {
      const newAttachments: AttachmentFile[] = validFiles.map((file) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        isUploaded: false,
        uploadStatus: "pending",
      }));

      onChange([...value, ...newAttachments]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = value.find((a) => a.id === id);

    // Revoke preview URL if it exists
    if (attachment?.previewUrl && attachment.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(attachment.previewUrl);
    }

    onChange(value.filter((a) => a.id !== id));
  };

  const handlePreviewFile = async (attachment: AttachmentFile) => {
    if (attachment.fileType === "application/pdf") {
      let pdfUrl: string | null = null;

      if (attachment.file) {
        // Create object URL for local file
        pdfUrl = URL.createObjectURL(attachment.file);
      } else if (attachment.filePath) {
        // Get signed URL for uploaded file
        try {
          const bucket = attachment.bucketName || bucketName;
          const decodedFilePath = attachment.filePath.replace(/&#x2F;/g, "/");
          const { data } = await supabase.storage
            .from(bucket)
            .createSignedUrl(decodedFilePath, 300);
          pdfUrl = data?.signedUrl || null;
        } catch (error) {
          console.error("Error creating signed URL for PDF:", error);
        }
      }

      if (pdfUrl) {
        setSelectedPdfUrl(pdfUrl);
        setSelectedPdfName(attachment.fileName);
        setIsPdfModalOpen(true);
      }
    } else if (attachment.fileType.startsWith("image/")) {
      // For images, open in new tab or show in modal
      if (attachment.previewUrl) {
        window.open(attachment.previewUrl, "_blank");
      }
    } else {
      // For other file types, download
      handleDownloadFile(attachment);
    }
  };

  const handleDownloadFile = async (attachment: AttachmentFile) => {
    if (attachment.file) {
      // Download local file
      const url = URL.createObjectURL(attachment.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (attachment.filePath) {
      // Download uploaded file
      try {
        const bucket = attachment.bucketName || bucketName;
        const decodedFilePath = attachment.filePath.replace(/&#x2F;/g, "/");
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(decodedFilePath, 300);

        if (data?.signedUrl) {
          const a = document.createElement("a");
          a.href = data.signedUrl;
          a.download = attachment.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (error) {
        console.error("Error downloading file:", error);
      }
    }
  };

  const renderAttachmentThumbnail = (attachment: AttachmentFile) => {
    if (
      attachment.fileType === "application/pdf" &&
      (attachment.file || attachment.filePath)
    ) {
      let pdfUrl: string | null = null;

      if (attachment.file) {
        pdfUrl = URL.createObjectURL(attachment.file);
      } else if (attachment.previewUrl) {
        pdfUrl = attachment.previewUrl;
      }

      return (
        <PDFThumbnail
          pdfUrl={pdfUrl}
          onClick={() => handlePreviewFile(attachment)}
        />
      );
    } else if (
      attachment.fileType.startsWith("image/") &&
      attachment.previewUrl
    ) {
      return (
        <div
          className="attachment-image-thumbnail"
          onClick={() => handlePreviewFile(attachment)}
        >
          <img
            src={attachment.previewUrl}
            alt={attachment.fileName}
            className="attachment-image"
          />
          <div className="attachment-image-overlay">
            <Eye size={20} />
          </div>
        </div>
      );
    } else {
      return (
        <div
          className="attachment-file-placeholder"
          onClick={() => handlePreviewFile(attachment)}
        >
          {getFileIcon(attachment.fileType, attachment.fileName)}
          <span className="attachment-file-type">
            {attachment.fileName.split(".").pop()?.toUpperCase() || "FILE"}
          </span>
        </div>
      );
    }
  };

  return {
    handleFileSelect,
    handleRemoveAttachment,
    handlePreviewFile,
    handleDownloadFile,
    renderAttachmentThumbnail,
  };
}
