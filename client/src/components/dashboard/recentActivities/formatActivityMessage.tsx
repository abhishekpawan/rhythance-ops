/**
 * Turns one activity record into a readable sentence ("Jane added Jobseeker
 * John to position Driver of Acme"). The sentences live in three groups.
 */
import React from "react";
import type { RecentActivity } from "./types";
import {
  ActivityContext,
  ActorName,
  PrimaryEntity,
  UNHANDLED,
} from "./EntityNames";
import { formatPeopleMessage } from "./messagesPeople";
import { formatFinanceMessage } from "./messagesFinance";
import { formatAdminMessage } from "./messagesAdmin";

export const formatActivityMessage = (
  activity: RecentActivity
): React.ReactNode => {
  const {
    actor_name,
    primary_entity_name,
    primary_entity_type,
    secondary_entity_name,
    tertiary_entity_name,
    metadata,
  } = activity;

  // Clean up entity names
  const cleanPrimaryName = primary_entity_name?.includes("ID:")
    ? `${primary_entity_type} profile`
    : primary_entity_name;

  const cleanSecondaryName =
    secondary_entity_name && !secondary_entity_name.includes("undefined")
      ? secondary_entity_name
      : null;

  // Extract tertiary entity name (client)
  const tertiaryEntityName = tertiary_entity_name;

  const ctx: ActivityContext = {
    activity,
    actor_name,
    primary_entity_name,
    primary_entity_type,
    secondary_entity_name,
    tertiary_entity_name,
    metadata,
    cleanPrimaryName,
    cleanSecondaryName,
    tertiaryEntityName,
  };

  // Each group handles its own action types and returns UNHANDLED for the rest.
  for (const format of [
    formatPeopleMessage,
    formatFinanceMessage,
    formatAdminMessage,
  ]) {
    const message = format(ctx);
    if (message !== UNHANDLED) return message;
  }

  // Any other action: a generic sentence from the activity's own verb.
  return (
    <>
      <ActorName>{activity.actor_name}</ActorName> {activity.action_verb}{" "}
      <PrimaryEntity>{activity.primary_entity_name}</PrimaryEntity>
    </>
  );
};

export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInSeconds = Math.floor(
    (now.getTime() - activityTime.getTime()) / 1000
  );

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
};
