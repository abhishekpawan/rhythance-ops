/** Activity sentences: users, onboarding, emails, consent and settings. */
import React from "react";
import {
  ActivityContext,
  UNHANDLED,
  ActorName,
  PrimaryEntity,
  SecondaryEntity,
} from "./EntityNames";

export const formatAdminMessage = (
  ctx: ActivityContext
): React.ReactNode | typeof UNHANDLED => {
  const {
    activity,
    actor_name,
    primary_entity_name,
    secondary_entity_name,
    metadata,
    cleanPrimaryName,
  } = ctx;

  switch (activity.action_type) {
    case "update_user_manager": {
      const hasManager =
        activity.secondary_entity_name &&
        activity.secondary_entity_name !== "None";
      return hasManager ? (
        <>
          <ActorName>{actor_name}</ActorName> updated manager for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to{" "}
          <SecondaryEntity>{activity.secondary_entity_name}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> removed manager for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );
    }

    case "update_user_roles": {
      const roles = Array.isArray(activity.metadata?.roles)
        ? (activity.metadata?.roles as string[])
        : [];
      const rolesText = roles.join(", ");
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated roles for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {roles.length > 0 ? (
            <>
              {" "}
              to <SecondaryEntity>{rolesText}</SecondaryEntity>
            </>
          ) : null}
        </>
      );
    }

    case "complete_onboarding": {
      return (
        <>
          <ActorName>{actor_name}</ActorName> completed onboarding setup
        </>
      );
    }

    case "invite_recruiter": {
      const invitedName = activity.metadata?.invitedName as string;
      const invitedEmail = cleanPrimaryName; // email is stored as primary entity name
      return (
        <>
          <ActorName>{actor_name}</ActorName> invited{" "}
          <PrimaryEntity>{invitedName}</PrimaryEntity> (
          <SecondaryEntity>{invitedEmail}</SecondaryEntity>) as a recruiter
        </>
      );
    }

    case "resend_invitation": {
      const invitationType = activity.metadata?.invitationType as string;
      const isOnboardingReminder = invitationType === "onboarding_reminder";
      return (
        <>
          <ActorName>{actor_name}</ActorName> resent{" "}
          {isOnboardingReminder ? "onboarding reminder" : "invitation"} to{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );
    }

    case "send_bulk_timesheet_email": {
      const invoice = cleanPrimaryName;
      const emailsSent =
        (activity.metadata?.emailsSent as { name: string; email: string }[]) ||
        [];
      if (emailsSent.length === 0) {
        return (
          <>
            <ActorName>{actor_name}</ActorName> sent timesheet{" "}
            <PrimaryEntity>{invoice}</PrimaryEntity> via email
          </>
        );
      }
      return (
        <>
          {emailsSent.map((js, idx) => (
            <span key={idx}>
              <ActorName>{actor_name}</ActorName> sent timesheet{" "}
              <PrimaryEntity>{invoice}</PrimaryEntity> via email to{" "}
              <SecondaryEntity>
                {js.name} ({js.email})
              </SecondaryEntity>
              {idx < emailsSent.length - 1 ? <br /> : null}
            </span>
          ))}
        </>
      );
    }

    case "send_invoice_email": {
      const recipient =
        typeof metadata?.recipient === "string" ? metadata.recipient : "client";
      const clientName =
        typeof metadata?.clientName === "string" ? metadata.clientName : "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> sent invoice{" "}
          <PrimaryEntity>{primary_entity_name}</PrimaryEntity> to{" "}
          <SecondaryEntity>{recipient}</SecondaryEntity> for{" "}
          {clientName ? <SecondaryEntity>{clientName}</SecondaryEntity> : null}
        </>
      );
    }

    case "create_consent_request": {
      const recipientCount = Number(metadata?.recipientCount) || 0;
      const recipientType = metadata?.recipientType as string;
      const recipientLabel =
        recipientType === "client" ? "client" : "jobseeker";
      const pluralSuffix = recipientCount === 1 ? "" : "s";

      return (
        <>
          <ActorName>{actor_name}</ActorName> created consent request{" "}
          <PrimaryEntity>{primary_entity_name}</PrimaryEntity> for{" "}
          {recipientCount} {recipientLabel}
          {pluralSuffix}
        </>
      );
    }

    case "update_portal_settings": {
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated the{" "}
          <PrimaryEntity>portal settings</PrimaryEntity>
        </>
      );
    }

    case "update_feature_flag": {
      return (
        <>
          <ActorName>{actor_name}</ActorName> {activity.action_verb} feature{" "}
          <PrimaryEntity>{primary_entity_name}</PrimaryEntity>
        </>
      );
    }

    case "user_consent_given": {
      const documentName = secondary_entity_name || "Unknown Document";
      return (
        <>
          <PrimaryEntity>{primary_entity_name}</PrimaryEntity> provided digital
          consent for <SecondaryEntity>{documentName}</SecondaryEntity>
        </>
      );
    }

    case "resend_consent_request": {
      const recordCount = Number(metadata?.recordCount) || 0;
      const pluralSuffix = recordCount === 1 ? "" : "s";

      return (
        <>
          <ActorName>{actor_name}</ActorName> resent {recordCount} consent email
          {pluralSuffix}
        </>
      );
    }

    default:
      return UNHANDLED;
  }
};
