import {
  LIST_TYPE_LABELS,
  type DropdownListType,
} from "../../services/api/dropdownOptions";
import { useLanguage } from "../../contexts/language/language-provider";

const CLIENT_LIST_TYPES: DropdownListType[] = [
  "client_manager",
  "client_representative",
  "salesperson",
  "accounting_person",
  "accounting_manager",
  "list_name",
];

interface DropdownListTabsProps {
  selectedListType: DropdownListType;
  positionListTypes: DropdownListType[];
  setSelectedListType: (type: DropdownListType) => void;
}

/** The two rows of buttons that choose which list is shown (client lists, position lists). */
export function DropdownListTabs({
  selectedListType,
  positionListTypes,
  setSelectedListType,
}: DropdownListTabsProps) {
  const { t } = useLanguage();
  return (
    <div className="dopts-tabs" role="tablist">
      <div className="dopts-tab-group">
        <span className="dopts-tab-group-label">
          {t("dropdownOptions.clientOptions")}
        </span>
        <div className="dopts-tab-group-buttons">
          {CLIENT_LIST_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`dopts-tab-btn ${selectedListType === type ? "dopts-tab-btn--active" : ""}`}
              onClick={() => setSelectedListType(type)}
            >
              {LIST_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
      <div className="dopts-tab-group">
        <span className="dopts-tab-group-label">
          {t("dropdownOptions.positionOptions")}
        </span>
        <div className="dopts-tab-group-buttons">
          {positionListTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`dopts-tab-btn ${selectedListType === type ? "dopts-tab-btn--active" : ""}`}
              onClick={() => setSelectedListType(type)}
            >
              {LIST_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
