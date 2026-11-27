import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { readAttachmentProps } from "./readAttachmentProps";

export function useAttachmentPreviewUrls(
  ctx: ReturnType<typeof readAttachmentProps>
) {
  const { bucketName, onChange, value } = ctx;
  // Generate preview URLs for image files
  useEffect(() => {
    const updatePreviewUrls = async () => {
      const updatedAttachments = await Promise.all(
        value.map(async (attachment) => {
          if (
            attachment.file &&
            attachment.fileType.startsWith("image/") &&
            !attachment.previewUrl
          ) {
            const previewUrl = URL.createObjectURL(attachment.file);
            return { ...attachment, previewUrl };
          } else if (
            attachment.filePath &&
            attachment.fileType.startsWith("image/") &&
            !attachment.previewUrl
          ) {
            try {
              const bucket = attachment.bucketName || bucketName;
              const decodedFilePath = attachment.filePath.replace(
                /&#x2F;/g,
                "/"
              );
              const { data } = await supabase.storage
                .from(bucket)
                .createSignedUrl(decodedFilePath, 300);
              if (data?.signedUrl) {
                return { ...attachment, previewUrl: data.signedUrl };
              }
            } catch (error) {
              console.error("Error creating signed URL for image:", error);
            }
          }
          return attachment;
        })
      );

      if (JSON.stringify(updatedAttachments) !== JSON.stringify(value)) {
        onChange(updatedAttachments);
      }
    };

    updatePreviewUrls();
  }, [value, onChange, bucketName]);

  return {};
}
