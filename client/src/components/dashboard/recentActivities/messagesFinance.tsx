/** Activity sentences: invoices and timesheets. */
import React from "react";
import {
  ActivityContext,
  UNHANDLED,
  ActorName,
  PrimaryEntity,
  SecondaryEntity,
  TertiaryEntity,
} from "./EntityNames";

export const formatFinanceMessage = (
  ctx: ActivityContext
): React.ReactNode | typeof UNHANDLED => {
  const {
    activity,
    actor_name,
    secondary_entity_name,
    tertiary_entity_name,
    cleanPrimaryName,
    cleanSecondaryName,
  } = ctx;

  switch (activity.action_type) {
    case "create_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_invoice":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> of{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> created Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}
              for position <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "update_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> updated Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}
              for position <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "delete_timesheet": {
      const jobseekerName = secondary_entity_name || "";
      const positionTitle = tertiary_entity_name || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Timesheet for{" "}
          <PrimaryEntity>{jobseekerName}</PrimaryEntity>
          {positionTitle && (
            <>
              {" "}
              for position <SecondaryEntity>{positionTitle}</SecondaryEntity>
            </>
          )}
        </>
      );
    }

    case "create_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";
      const numberOfJobseekers =
        Number(activity.metadata?.numberOfJobseekers) || 0;

      return (
        <>
          <ActorName>{actor_name}</ActorName> created{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
          {numberOfJobseekers > 0 && (
            <>
              {" of "}
              {numberOfJobseekers} jobseeker
              {numberOfJobseekers !== 1 ? "s" : ""}
            </>
          )}
        </>
      );
    }

    case "update_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";
      const numberOfJobseekers =
        Number(activity.metadata?.numberOfJobseekers) || 0;

      return (
        <>
          <ActorName>{actor_name}</ActorName> updated{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
          {numberOfJobseekers > 0 && (
            <>
              {" of "}
              {numberOfJobseekers} jobseeker
              {numberOfJobseekers !== 1 ? "s" : ""}
            </>
          )}
        </>
      );
    }

    case "delete_bulk_timesheet": {
      const clientName = secondary_entity_name || "";
      const positionTitle = (activity.metadata?.positionTitle as string) || "";

      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{clientName}</SecondaryEntity>
          {positionTitle && (
            <>
              {" "}
              (<TertiaryEntity>{positionTitle}</TertiaryEntity>)
            </>
          )}
        </>
      );
    }

    default:
      return UNHANDLED;
  }
};
