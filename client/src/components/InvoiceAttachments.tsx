import PDFViewerModal from './PDFViewerModal';
import { 
  Eye, 
  Download, 
  Trash, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Plus,
  Loader2 // <-- add Loader2 for spinner
} from 'lucide-react';
import '../styles/components/InvoiceAttachments.css';

import {
  AttachmentFile,
  InvoiceAttachmentsProps,
  MAX_FILES,
  formatFileSize,
} from './invoiceAttachmentParts/attachmentRules';
import { getFileIcon } from './invoiceAttachmentParts/attachmentIcons';
import { readAttachmentProps } from './invoiceAttachmentParts/readAttachmentProps';
import { useAttachmentState } from './invoiceAttachmentParts/useAttachmentState';
import { createAttachmentActions } from './invoiceAttachmentParts/createAttachmentActions';
import { useAttachmentPreviewUrls } from './invoiceAttachmentParts/useAttachmentPreviewUrls';

export const InvoiceAttachments: React.FC<InvoiceAttachmentsProps> = (props) => {
  const attachmentProps = readAttachmentProps(props);
  const state = useAttachmentState();
  const actions = createAttachmentActions({ ...attachmentProps, ...state });
  useAttachmentPreviewUrls(attachmentProps);
  const {
    disabled,
    value,
  } = attachmentProps;
  const {
    errors,
    fileInputRef,
    isPdfModalOpen,
    selectedPdfName,
    selectedPdfUrl,
    setIsPdfModalOpen,
    setSelectedPdfUrl,
  } = state;
  const {
    handleDownloadFile,
    handleFileSelect,
    handlePreviewFile,
    handleRemoveAttachment,
    renderAttachmentThumbnail,
  } = actions;

  return (
    <div className="invoice-attachments-container">
      <div className="invoice-attachments-header">
        <h3>Attachments</h3>
        <p className="attachments-description">
          Upload attachments (PDF, Images, Excel, EML files). Max 10 files, 3MB each.
          Press Ctrl (Windows) or CMD (Mac) to select multiple files.
        </p>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="attachment-errors">
          {errors.map((error, index) => (
            <div key={index} className="attachment-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Section */}
      <div className="attachment-upload-section">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.xls,.xlsx,.xlsm,.csv,.eml"
          onChange={handleFileSelect}
          disabled={disabled || value.length >= MAX_FILES}
          className="attachment-file-input"
          id="invoice-file-input"
        />
        <label 
          htmlFor="invoice-file-input" 
          className={`attachment-upload-button ${disabled || value.length >= MAX_FILES ? 'disabled' : ''}`}
        >
          <Plus size={16} />
          Upload Attachments
          <span className="upload-count">({value.length}/{MAX_FILES})</span>
        </label>
      </div>

      {/* Attachments List */}
      {value.length > 0 && (
        <div className="attachment-list">
          {value.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              <div className="attachment-thumbnail">
                {renderAttachmentThumbnail(attachment)}
              </div>
              
              <div className="attachment-info">
                <div className="attachment-name" title={attachment.fileName}>
                  {getFileIcon(attachment.fileType, attachment.fileName)}
                  <span>{attachment.fileName}</span>
                </div>
                <div className="attachment-details">
                  <span className="attachment-size">{formatFileSize(attachment.fileSize)}</span>
                  {attachment.uploadStatus === 'uploaded' && (
                    <div className="attachment-status uploaded">
                      <CheckCircle size={14} />
                      <span>Uploaded</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'uploading' && (
                    <div className="attachment-status uploading">
                      <Loader2 size={14} className="attachment-uploading-spinner" />
                      <span>Uploading...</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'error' && (
                    <div className="attachment-status error">
                      <AlertCircle size={14} />
                      <span>Upload failed</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'pending' && (
                    <div className="attachment-status pending">
                      <Upload size={14} />
                      <span>Will upload when saved</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="attachment-actions">
                {(attachment.fileType === 'application/pdf' || 
                  attachment.fileType.startsWith('image/')) && (
                  <button
                    type="button"
                    className="attachment-action-btn preview"
                    onClick={() => handlePreviewFile(attachment)}
                    title="Preview"
                    disabled={attachment.uploadStatus === 'uploading'}
                  >
                    <Eye size={16} />
                  </button>
                )}
                
                <button
                  type="button"
                  className="attachment-action-btn download"
                  onClick={() => handleDownloadFile(attachment)}
                  title="Download"
                  disabled={attachment.uploadStatus === 'uploading'}
                >
                  <Download size={16} />
                </button>
                
                <button
                  type="button"
                  className="attachment-action-btn delete"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  title="Remove"
                  disabled={disabled || attachment.uploadStatus === 'uploading'}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        pdfUrl={selectedPdfUrl}
        documentName={selectedPdfName}
        isOpen={isPdfModalOpen}
        onClose={() => {
          setIsPdfModalOpen(false);
          // Clean up object URL if it was created locally
          if (selectedPdfUrl && selectedPdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPdfUrl);
          }
          setSelectedPdfUrl(null);
        }}
      />
    </div>
  );
}

export type { AttachmentFile }; 