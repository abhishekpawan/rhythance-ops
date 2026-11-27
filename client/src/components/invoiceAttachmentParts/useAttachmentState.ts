import { useState, useRef } from "react";

export function useAttachmentState() {
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>("Document");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return {
    selectedPdfUrl,
    setSelectedPdfUrl,
    selectedPdfName,
    setSelectedPdfName,
    isPdfModalOpen,
    setIsPdfModalOpen,
    errors,
    setErrors,
    fileInputRef,
  };
}
