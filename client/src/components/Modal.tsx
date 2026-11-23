import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  /** the window's name for screen readers, already translated */
  ariaLabel: string;
  onClose: () => void;
  /** the content of the title block in the header */
  title: React.ReactNode;
  /** buttons in the header, left of the close button */
  actions?: React.ReactNode;
  /** the tooltip and screen-reader name of the close button, already translated */
  closeLabel: string;
  /** the body under the header */
  children: React.ReactNode;
  /** a block under the body (`<classPrefix>-footer`); nothing is drawn without it */
  footer?: React.ReactNode;
  /** the size of the cross of the close button; 18 unless a page's own window always had another */
  closeIconSize?: number;
  /**
   * The class of every part is `<classPrefix>-backdrop`, `-content`, `-header`, `-title`, `-body`, `-footer` and `-close`, so
   * a page keeps styling its window in its own stylesheet (stacking order included).
   */
  classPrefix: string;
}

/**
 * A window over the page: dark backdrop, header with title and close button, body. A click on the backdrop or the
 * close button, or the Escape key, closes it, and the focus goes back to what had it when the window opened.
 */
export const Modal: React.FC<ModalProps> = ({
  ariaLabel,
  onClose,
  title,
  actions,
  closeLabel,
  children,
  footer,
  closeIconSize = 18,
  classPrefix,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && opener !== document.body && document.contains(opener)) {
        opener.focus();
      }
    };
  }, []);

  const closeButton = (
    <button
      type="button"
      className={`${classPrefix}-close`}
      onClick={() => onClose()}
      title={closeLabel}
      aria-label={closeLabel}
    >
      <X size={closeIconSize} />
    </button>
  );

  return (
    <div
      className={`${classPrefix}-backdrop`}
      onClick={() => onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={`${classPrefix}-content`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${classPrefix}-header`}>
          <div className={`${classPrefix}-title`}>{title}</div>
          {actions ? (
            <div className="flex items-center gap-2">
              {actions}
              {closeButton}
            </div>
          ) : (
            closeButton
          )}
        </div>
        <div className={`${classPrefix}-body`}>{children}</div>
        {footer && <div className={`${classPrefix}-footer`}>{footer}</div>}
      </div>
    </div>
  );
};
