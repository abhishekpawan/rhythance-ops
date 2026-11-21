import { Check, Edit2, Trash2, X } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import type { ClientDropdownOption } from "../../services/api/dropdownOptions";

interface DropdownOptionsListProps {
  options: ClientDropdownOption[];
  editingId: string | null;
  editValue: string;
  setEditValue: (value: string) => void;
  saving: boolean;
  startEdit: (opt: ClientDropdownOption) => void;
  cancelEdit: () => void;
  saveEdit: () => void | Promise<void>;
  handleDelete: (opt: ClientDropdownOption) => void | Promise<void>;
}

/** The current options of the chosen list, each with its edit and delete buttons. */
export function DropdownOptionsList({
  options,
  editingId,
  editValue,
  setEditValue,
  saving,
  startEdit,
  cancelEdit,
  saveEdit,
  handleDelete,
}: DropdownOptionsListProps) {
  const { t } = useLanguage();
  return (
    <ul className="dopts-list">
      {options.map((opt) => (
        <li key={opt.id} className="dopts-list-item">
          {editingId === opt.id ? (
            <div className="dopts-list-edit">
              <input
                type="text"
                className="form-input dopts-edit-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
              />
              <button
                type="button"
                className="button primary dopts-btn-icon"
                onClick={saveEdit}
                disabled={saving}
                title={t("buttons.save")}
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                className="button secondary dopts-btn-icon"
                onClick={cancelEdit}
                disabled={saving}
                title={t("buttons.cancel")}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <span className="dopts-list-name">{opt.name}</span>
              <div className="dopts-list-actions">
                <button
                  type="button"
                  className="button secondary dopts-btn-icon"
                  onClick={() => startEdit(opt)}
                  title={t("buttons.edit")}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  className="button secondary dopts-btn-icon dopts-btn-icon--danger"
                  onClick={() => handleDelete(opt)}
                  title={t("buttons.delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
