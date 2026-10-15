import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Layers } from "lucide-react";
import "./DemoAutoFillWidget.css";

export interface DemoFieldPreview {
  label: string;
  value: string | number | boolean;
}

export interface DemoPreset {
  id: string;
  name: string;
  badge?: string;
}

export interface DemoAutoFillWidgetProps {
  title: string;
  stepBadge?: string;
  currentStep?: number;
  totalSteps?: number;
  fields: DemoFieldPreview[];
  onAutoFill: () => void | Promise<void>;
  onAutoFillAndNext?: () => void | Promise<void>;
  presets?: DemoPreset[];
  activePresetId?: string;
  onSelectPreset?: (presetId: string) => void;
  storageKey?: string;
  defaultCollapsed?: boolean;
  hide?: boolean;
}

export const DemoAutoFillWidget: React.FC<DemoAutoFillWidgetProps> = ({
  title,
  stepBadge,
  currentStep,
  totalSteps,
  fields,
  onAutoFill,
  onAutoFillAndNext,
  presets,
  activePresetId,
  onSelectPreset,
  defaultCollapsed = true,
  hide = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);

  const [isFilled, setIsFilled] = useState(false);
  const [isNextLoading, setIsNextLoading] = useState(false);

  if (hide) {
    return null;
  }

  const handleFill = async () => {
    try {
      await onAutoFill();
      setIsFilled(true);
      setTimeout(() => setIsFilled(false), 2400);
    } catch (err) {
      console.error("Auto-fill error:", err);
    }
  };

  const handleFillAndNext = async () => {
    if (!onAutoFillAndNext) return;
    try {
      setIsNextLoading(true);
      await onAutoFillAndNext();
      setIsFilled(true);
      setTimeout(() => setIsFilled(false), 2400);
    } catch (err) {
      console.error("Auto-fill & next error:", err);
    } finally {
      setIsNextLoading(false);
    }
  };

  // Format value display
  const renderValue = (val: string | number | boolean) => {
    if (typeof val === "boolean") {
      return (
        <span className={`demo-autofill-boolean-badge ${val ? "true" : "false"}`}>
          {val ? "Yes" : "No"}
        </span>
      );
    }
    if (val === "" || val === null || val === undefined) {
      return <span style={{ opacity: 0.5 }}>—</span>;
    }
    return String(val);
  };

  return (
    <div className="demo-autofill-container">
      {isCollapsed ? (
        <button
          type="button"
          className="demo-autofill-collapsed-trigger"
          onClick={() => setIsCollapsed(false)}
          title="Open Demo Auto-Fill Assistant"
        >
          <ChevronLeft size={14} />
          <span>Demo Auto-Fill</span>
          {stepBadge && (
            <span className="demo-autofill-collapsed-badge">
              {currentStep ? `Step ${currentStep}` : stepBadge}
            </span>
          )}
        </button>
      ) : (
        <div className="demo-autofill-card">
          {/* Header */}
          <div className="demo-autofill-header">
            <div className="demo-autofill-title-wrap">
              <span className="demo-autofill-title">Demo Auto-Fill</span>
              <span className="demo-autofill-demo-tag">DEMO</span>
            </div>
            <button
              type="button"
              className="demo-autofill-close-btn"
              onClick={() => setIsCollapsed(true)}
              title="Minimize to side button"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Subbar with Step or Page context */}
          <div className="demo-autofill-subbar">
            <div className="demo-autofill-step-pill">
              <Layers size={13} />
              <span>
                {stepBadge ||
                  (currentStep && totalSteps
                    ? `Step ${currentStep} of ${totalSteps}`
                    : title)}
              </span>
            </div>
            {currentStep && (
              <span className="demo-autofill-collapsed-badge">
                Step {currentStep}
              </span>
            )}
          </div>

          {/* Presets if provided */}
          {presets && presets.length > 1 && (
            <div className="demo-autofill-presets">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`demo-preset-btn ${activePresetId === p.id ? "active" : ""}`}
                  onClick={() => onSelectPreset?.(p.id)}
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Preview list */}
          <div className="demo-autofill-body">
            <div className="demo-autofill-preview-label">Sample Data to Fill:</div>
            {fields.map((f, i) => (
              <div key={`${f.label}-${i}`} className="demo-autofill-field-row">
                <span className="demo-autofill-field-key">{f.label}</span>
                <span className="demo-autofill-field-val">
                  {renderValue(f.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="demo-autofill-footer">
            <button
              type="button"
              className={`demo-autofill-btn-primary ${isFilled ? "filled" : ""}`}
              onClick={handleFill}
            >
              {isFilled ? (
                <>
                  <Check size={16} />
                  <span>Fields Auto-Filled</span>
                </>
              ) : (
                <span>
                  {currentStep ? `Auto-Fill Step ${currentStep}` : `Auto-Fill Form`}
                </span>
              )}
            </button>

            {onAutoFillAndNext && currentStep && totalSteps && currentStep < totalSteps && (
              <button
                type="button"
                className="demo-autofill-btn-next"
                onClick={handleFillAndNext}
                disabled={isNextLoading}
              >
                <span>Fill & Next Step</span>
                <ChevronRight size={14} />
              </button>
            )}

            <p className="demo-autofill-hint">
              Demo Mode • Rapid form population for client presentations
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
