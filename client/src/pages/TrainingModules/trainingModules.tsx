import { BookOpen, FileText, Video } from "lucide-react";

export interface Module {
  id: string;
  titleKey: string;
  descriptionKey: string;
  type: "document" | "video" | "interactive";
  duration: string;
  completed?: boolean;
  icon: JSX.Element;
  youtubeId?: string;
  comingSoon?: boolean;
  mandatory?: boolean;
}

/**
 * The modules the training page lists: mandatory videos first, then other videos, then other types.
 * The first two videos are this portal's own (portal settings `training.video1` and `training.video2`).
 */
export function buildTrainingModules(
  portalSettings: Record<string, string>
): Module[] {
  // Sample training modules data - Mandatory videos first, then other videos, then other types
  // In a real application, this would come from an API
  return [
    {
      id: "tm-001",
      titleKey: "training.modules.aodaTraining.title",
      descriptionKey: "training.modules.aodaTraining.description",
      type: "video",
      duration: "2 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: portalSettings["training.video1"],
      mandatory: true,
    },
    {
      id: "tm-002",
      titleKey: "training.modules.workplaceViolenceHarassment.title",
      descriptionKey:
        "training.modules.workplaceViolenceHarassment.description",
      type: "video",
      duration: "2 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: portalSettings["training.video2"],
      mandatory: true,
    },
    {
      id: "tm-003",
      titleKey: "training.modules.whmisTraining.title",
      descriptionKey: "training.modules.whmisTraining.description",
      type: "video",
      duration: "5 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: "H8pKkyP9FvY",
    },
    {
      id: "tm-004",
      titleKey: "training.modules.healthSafetyTraining.title",
      descriptionKey: "training.modules.healthSafetyTraining.description",
      type: "video",
      duration: "6 min",
      completed: false,
      icon: <Video className="module-icon video" />,
      youtubeId: "cuZ8xNY4TWo",
    },
    {
      id: "tm-005",
      titleKey: "training.modules.effectiveResumeScreening.title",
      descriptionKey: "training.modules.effectiveResumeScreening.description",
      type: "document",
      duration: "15 min",
      completed: false,
      icon: <FileText className="module-icon document" />,
      comingSoon: true,
    },
    {
      id: "tm-006",
      titleKey: "training.modules.interviewTechniques.title",
      descriptionKey: "training.modules.interviewTechniques.description",
      type: "interactive",
      duration: "45 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />,
      comingSoon: true,
    },
    {
      id: "tm-007",
      titleKey: "training.modules.clientManagementEssentials.title",
      descriptionKey: "training.modules.clientManagementEssentials.description",
      type: "document",
      duration: "20 min",
      completed: false,
      icon: <FileText className="module-icon document" />,
      comingSoon: true,
    },
    {
      id: "tm-008",
      titleKey: "training.modules.jobSeekerResumeBuilding.title",
      descriptionKey: "training.modules.jobSeekerResumeBuilding.description",
      type: "interactive",
      duration: "30 min",
      completed: false,
      icon: <BookOpen className="module-icon interactive" />,
      comingSoon: true,
    },
  ];
}
