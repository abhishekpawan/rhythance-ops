import { supabase } from "../../../lib/supabaseClient";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function createAttachmentUploader(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof useInvoicePageHooks>
) {
  const { attachments, invoiceNumber, setAttachments, user } = ctx;
  // Helper function to upload attachments
  const uploadAttachments = async () => {
    if (!attachments.length) return [];

    const updatedAttachments = [...attachments];
    const uploadedAttachments = [];

    for (const attachment of updatedAttachments) {
      if (attachment.file && !attachment.isUploaded) {
        // Set status to uploading
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachment.id
              ? { ...att, uploadStatus: "uploading" }
              : att
          )
        );
        try {
          // Create a unique filename to avoid conflicts
          const timestamp = Date.now();
          const fileExtension = attachment.file.name.split(".").pop();
          const fileNameWithoutExt = attachment.file.name.replace(
            /\.[^/.]+$/,
            ""
          );
          const uniqueFileName = `${fileNameWithoutExt}_${timestamp}.${fileExtension}`;
          const filePath = `${user?.id}/${invoiceNumber}/attachments/${uniqueFileName}`;
          // Upload to Supabase Storage with upsert enabled to handle duplicates
          const { data, error } = await supabase.storage
            .from("invoices")
            .upload(filePath, attachment.file, {
              cacheControl: "3600",
              upsert: true, // Allow overwriting existing files
            });
          if (error) {
            console.error("Error uploading file:", error);
            // Set status to error
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === attachment.id
                  ? { ...att, uploadStatus: "error" }
                  : att
              )
            );
            throw new Error(
              `Failed to upload ${attachment.fileName}: ${error.message}`
            );
          }
          // Add to uploaded attachments list
          uploadedAttachments.push({
            fileName: attachment.fileName,
            fileSize: attachment.fileSize,
            fileType: attachment.fileType,
            uploadStatus: "uploaded",
            filePath: data.path,
            bucketName: "invoices",
          });
          // Update attachment state to show as uploaded
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === attachment.id
                ? {
                    ...att,
                    isUploaded: true,
                    filePath: data.path,
                    uploadStatus: "uploaded",
                  }
                : att
            )
          );
        } catch (error) {
          console.error("Error uploading attachment:", error);
          setAttachments((prev) =>
            prev.map((att) =>
              att.id === attachment.id ? { ...att, uploadStatus: "error" } : att
            )
          );
          throw error;
        }
      } else if (attachment.isUploaded && attachment.filePath) {
        // Already uploaded, just add to list
        uploadedAttachments.push({
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          fileType: attachment.fileType,
          uploadStatus: "uploaded",
          filePath: attachment.filePath,
          bucketName: "invoices",
        });
      }
    }
    return uploadedAttachments;
  };

  return { uploadAttachments };
}
