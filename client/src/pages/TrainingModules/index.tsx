import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import {
  Award,
  ChevronRight,
  ArrowLeft,
  Search,
  Play,
  Clock,
} from "lucide-react";
import { VideoModal } from "./VideoModal";
import { buildTrainingModules, type Module } from "./trainingModules";
import { ComingSoonModal } from "./ComingSoonModal";
import { EmptyState } from "../../components/EmptyState";
import { useLanguage } from "../../contexts/language/language-provider";
import { usePortalSettings } from "../../contexts/PortalSettingsContext";
import "../../styles/pages/TrainingModules.css";
import "../../styles/pages/JobSeekerManagement.css";

export function TrainingModules() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  // The first two mandatory videos are this portal's own (portal settings)
  const { values: portalSettings } = usePortalSettings();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>("");
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] =
    useState<boolean>(false);
  const [currentComingSoonModule, setCurrentComingSoonModule] =
    useState<Module | null>(null);

  const trainingModules = buildTrainingModules(portalSettings);

  // Filter modules based on selected category and search query
  const filteredModules = trainingModules.filter((module) => {
    const matchesCategory =
      selectedCategory === "all" || selectedCategory === module.type;

    const title = t(module.titleKey);
    const description = t(module.descriptionKey);
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleModuleClick = (module: Module) => {
    if (module.comingSoon) {
      // Open coming soon modal
      setCurrentComingSoonModule(module);
      setIsComingSoonModalOpen(true);
    } else if (module.youtubeId) {
      // Open YouTube video in modal
      setCurrentVideoId(module.youtubeId);
      setCurrentVideoTitle(t(module.titleKey));
      setIsVideoModalOpen(true);
    } else {
      // Handle other module types
      console.log(`Opening module: ${module.id}`);
      // navigate(`/training-modules/${module.id}`);
    }
  };

  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    setCurrentVideoId("");
    setCurrentVideoTitle("");
  };

  const closeComingSoonModal = () => {
    setIsComingSoonModalOpen(false);
    setCurrentComingSoonModule(null);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <AppHeader
        title={t("training.title")}
        actions={
          <>
            <button className="button button-icon" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} className="icon" /> {t("buttons.back")}
            </button>
          </>
        }
      />

      {/* Main content */}
      <main className="training-modules-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t("training.subtitle")}</h1>
          <div className="user-role-badge">
            <Award className="role-icon" />
            <span>{t("training.learningPortal")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">{t("training.description")}</p>

        {/* Filters and search */}
        <div className="module-filters">
          <div className="category-filters">
            <button
              className={`filter-button ${selectedCategory === "all" ? "active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              {t("training.categories.all")}
            </button>
            <button
              className={`filter-button ${selectedCategory === "video" ? "active" : ""}`}
              onClick={() => setSelectedCategory("video")}
            >
              {t("training.categories.videos")}
            </button>
            <button
              className={`filter-button ${selectedCategory === "document" ? "active" : ""}`}
              onClick={() => setSelectedCategory("document")}
            >
              {t("training.categories.documents")}
            </button>
            <button
              className={`filter-button ${selectedCategory === "interactive" ? "active" : ""}`}
              onClick={() => setSelectedCategory("interactive")}
            >
              {t("training.categories.interactive")}
            </button>
          </div>

          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={t("training.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Module cards */}
        <div className="modules-grid">
          {filteredModules.length > 0 ? (
            filteredModules.map((module) => (
              <div
                key={module.id}
                className={`module-card ${module.completed ? "completed" : ""} ${module.youtubeId ? "video-module" : ""} ${module.comingSoon ? "coming-soon-module" : ""} ${module.mandatory ? "mandatory-module" : ""}`}
                onClick={() => handleModuleClick(module)}
              >
                <div className="module-card-header">
                  {module.icon}
                  <span className="module-type">
                    {t(`training.types.${module.type}`)}
                  </span>
                  {module.completed && (
                    <span className="completion-badge">
                      <Award size={14} />
                      {t("training.completed")}
                    </span>
                  )}
                  {module.comingSoon && (
                    <span className="coming-soon-badge">
                      <Clock size={14} />
                      {t("training.comingSoon")}
                    </span>
                  )}
                  {module.mandatory && (
                    <span className="mandatory-badge">
                      <Award size={14} />
                      {t("training.mandatory")}
                    </span>
                  )}
                </div>
                <h3 className="module-title">{t(module.titleKey)}</h3>
                <p className="module-description">{t(module.descriptionKey)}</p>
                <div className="module-footer">
                  <span className="module-duration">{module.duration}</span>
                  {module.youtubeId ? (
                    <div className="video-play-indicator">
                      <Play size={16} className="play-icon" />
                    </div>
                  ) : module.comingSoon ? (
                    <div className="coming-soon-indicator">
                      <Clock size={16} className="clock-icon" />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="arrow-icon" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              className="no-modules-message"
              description={t("training.noModulesMessage")}
              action={
                <button
                  className="button outline"
                  onClick={() => {
                    setSelectedCategory("all");
                    setSearchQuery("");
                  }}
                >
                  {t("training.resetFilters")}
                </button>
              }
            />
          )}
        </div>
      </main>

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        videoId={currentVideoId}
        title={currentVideoTitle}
        onClose={closeVideoModal}
      />

      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={isComingSoonModalOpen}
        module={currentComingSoonModule}
        onClose={closeComingSoonModal}
      />
    </div>
  );
}
