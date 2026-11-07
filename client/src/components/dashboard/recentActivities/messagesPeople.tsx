/** Activity sentences: jobseekers, positions, clients and drafts. */
import React from "react";
import {
  ActivityContext,
  UNHANDLED,
  ActorName,
  PrimaryEntity,
  SecondaryEntity,
  TertiaryEntity,
} from "./EntityNames";

export const formatPeopleMessage = (
  ctx: ActivityContext
): React.ReactNode | typeof UNHANDLED => {
  const {
    actor_name,
    cleanPrimaryName,
    cleanSecondaryName,
    tertiaryEntityName,
  } = ctx;

  switch (ctx.activity.action_type) {
    case "assign_jobseeker":
      return cleanSecondaryName && tertiaryEntityName ? (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> of{" "}
          <TertiaryEntity>{tertiaryEntityName}</TertiaryEntity>
        </>
      ) : cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> added Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> to a position{" "}
        </>
      );

    case "remove_jobseeker":
      return cleanSecondaryName && tertiaryEntityName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> of
          <TertiaryEntity>{tertiaryEntityName}</TertiaryEntity>
        </>
      ) : cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from position{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> removed Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> from a position{" "}
        </>
      );

    case "create_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> modified Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Jobseeker Profile for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "pending_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <SecondaryEntity>pending</SecondaryEntity>
        </>
      );

    case "reject_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <TertiaryEntity>rejected</TertiaryEntity>
        </>
      );

    case "verify_jobseeker":
      return (
        <>
          <ActorName>{actor_name}</ActorName> set Jobseeker{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> status to{" "}
          <PrimaryEntity>verified</PrimaryEntity>
        </>
      );

    case "create_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> added new position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> added new position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> modified position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> modified position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_position":
      return cleanSecondaryName ? (
        <>
          <ActorName>{actor_name}</ActorName> removed position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity> for{" "}
          <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> removed position{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> added a new client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> modified Client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_client":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted Client{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "user_registration":
      return cleanSecondaryName ? (
        <>
          A new user <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity> has
          been registered with <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      ) : (
        <>
          <ActorName>{actor_name}</ActorName> registered new user{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "update_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "delete_client_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted client draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
        </>
      );

    case "create_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> created position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    case "update_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> updated position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    case "delete_position_draft":
      return (
        <>
          <ActorName>{actor_name}</ActorName> deleted position draft for{" "}
          <PrimaryEntity>{cleanPrimaryName}</PrimaryEntity>
          {cleanSecondaryName && (
            <>
              {" "}
              of <SecondaryEntity>{cleanSecondaryName}</SecondaryEntity>
            </>
          )}
        </>
      );

    default:
      return UNHANDLED;
  }
};
