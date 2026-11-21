import { useState } from "react";
import { Search } from "lucide-react";
import PDFThumbnail from "./PDFThumbnail";
import { useLanguage } from "../contexts/language/language-provider";
import { isImageDocument } from "../utils/documentKind";
import "../styles/components/PDFThumbnail.css";

interface DocumentThumbnailProps {
  /** Signed URL of the stored file, null until it is ready */
  url: string | null;
  /** The uploaded file's name or storage path: tells an image from a PDF */
  fileName?: string | null;
  filePath?: string | null;
  onClick: () => void;
}

/** The card preview of an uploaded document: an image shows as an image, a PDF through the PDF viewer. */
const DocumentThumbnail = ({
  url,
  fileName,
  filePath,
  onClick,
}: DocumentThumbnailProps) => {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState(false);

  if (!(isImageDocument(fileName) || isImageDocument(filePath))) {
    return <PDFThumbnail pdfUrl={url} onClick={onClick} />;
  }

  return (
    <div
      className="pdf-thumbnail-container image-document-thumbnail"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!url ? (
        <div className="pdf-thumbnail-loading">
          <div className="pdf-thumbnail-spinner"></div>
        </div>
      ) : failed ? (
        <div className="pdf-thumbnail-error">
          <p>{t("jobSeekerProfile.imagePreviewFailed")}</p>
        </div>
      ) : (
        <img
          src={url}
          alt={fileName || t("jobSeekerProfile.document")}
          className="image-document-thumbnail-image"
          onError={() => setFailed(true)}
        />
      )}
      {hover && (
        <div className="pdf-thumbnail-overlay">
          <div className="pdf-thumbnail-overlay-content">
            <Search size={24} />
            <span>{t("jobSeekerProfile.previewDocument")}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentThumbnail;
