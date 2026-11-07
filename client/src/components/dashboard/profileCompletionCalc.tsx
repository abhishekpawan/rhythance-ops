/**
 * How complete a jobseeker's profile is: 13 personal, 4 address and 7
 * qualification fields, plus at least one document.
 */
import React from "react";
import { User as UserIcon, FileText, MapPin, Award } from "lucide-react";
import { JobSeekerDetailedProfile } from "../../types/jobseeker";

export interface ProfileCompletionSection {
  name: string;
  completed: number;
  total: number;
  percentage: number;
  icon: React.ReactNode;
}

/** Share of the profile filled in, overall and per section. */
export const calculateProfileCompletion = (
  profile: JobSeekerDetailedProfile | null
) => {
  if (!profile) {
    return {
      overall: 0,
      sections: [
        {
          name: "Personal Info",
          completed: 0,
          total: 13,
          percentage: 0,
          icon: <UserIcon size={16} />,
        },
        {
          name: "Address",
          completed: 0,
          total: 4,
          percentage: 0,
          icon: <MapPin size={16} />,
        },
        {
          name: "Qualifications",
          completed: 0,
          total: 7,
          percentage: 0,
          icon: <Award size={16} />,
        },
        {
          name: "Documents",
          completed: 0,
          total: 1,
          percentage: 0,
          icon: <FileText size={16} />,
        },
      ],
    };
  }

  // Personal Info Section - Count each field individually (13 fields)
  const personalInfoFields = [
    profile.firstName,
    profile.lastName,
    profile.dob,
    profile.email,
    profile.mobile,
    profile.licenseNumber,
    profile.passportNumber,
    profile.sinNumber,
    profile.sinExpiry,
    profile.workPermitUci,
    profile.workPermitExpiry,
    profile.businessNumber,
    profile.corporationName,
  ];
  const personalInfoCompleted = personalInfoFields.filter(
    (field) => field && field.toString().trim() !== ""
  ).length;

  // Address Section - Count each field individually (4 fields)
  const addressFields = [
    profile.street,
    profile.city,
    profile.province,
    profile.postalCode,
  ];
  const addressCompleted = addressFields.filter(
    (field) => field && field.toString().trim() !== ""
  ).length;

  // Qualifications Section - Count each field individually (7 fields)
  const qualificationFields = [
    profile.workPreference,
    profile.bio,
    profile.licenseType,
    profile.experience,
    profile.manualDriving,
    profile.availability,
    profile.weekendAvailability !== undefined ? "set" : null, // Boolean field - check if defined
  ];
  const qualificationsCompleted = qualificationFields.filter(
    (field) => field && field.toString().trim() !== ""
  ).length;

  // Documents Section - At least one document (1 field)
  const documentsCompleted =
    profile.documents && profile.documents.length > 0 ? 1 : 0;
  const documentsTotal = 1;

  const sections: ProfileCompletionSection[] = [
    {
      name: "Personal Info",
      completed: personalInfoCompleted,
      total: personalInfoFields.length,
      percentage: Math.round(
        (personalInfoCompleted / personalInfoFields.length) * 100
      ),
      icon: <UserIcon size={16} />,
    },
    {
      name: "Address",
      completed: addressCompleted,
      total: addressFields.length,
      percentage: Math.round((addressCompleted / addressFields.length) * 100),
      icon: <MapPin size={16} />,
    },
    {
      name: "Qualifications",
      completed: qualificationsCompleted,
      total: qualificationFields.length,
      percentage: Math.round(
        (qualificationsCompleted / qualificationFields.length) * 100
      ),
      icon: <Award size={16} />,
    },
    {
      name: "Documents",
      completed: documentsCompleted,
      total: documentsTotal,
      percentage: Math.round((documentsCompleted / documentsTotal) * 100),
      icon: <FileText size={16} />,
    },
  ];

  // Calculate overall completion
  const totalFields =
    personalInfoFields.length +
    addressFields.length +
    qualificationFields.length +
    documentsTotal;
  const totalCompleted =
    personalInfoCompleted +
    addressCompleted +
    qualificationsCompleted +
    documentsCompleted;
  const overallPercentage = Math.round((totalCompleted / totalFields) * 100);

  return {
    overall: overallPercentage,
    sections,
  };
};
