import type { InvoiceAttachmentsProps } from "./attachmentRules";

export function readAttachmentProps(props: InvoiceAttachmentsProps) {
  const {
    value = [],
    onChange,
    disabled = false,
    bucketName = "invoice-attachments",
  } = props;

  return { value, onChange, disabled, bucketName };
}
