/**
 * Styled names inside activity sentences, and what every message group receives.
 */
import React from "react";
import type { RecentActivity } from "./types";

// Helper components for styled entity names
export const ActorName: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-actor">{children}</span>;

export const PrimaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-primary">{children}</span>;

export const SecondaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-secondary">{children}</span>;

export const TertiaryEntity: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <span className="entity-tertiary">{children}</span>;

/** Everything a message group needs to build one activity sentence. */
export interface ActivityContext {
  activity: RecentActivity;
  actor_name: string;
  primary_entity_name?: string;
  primary_entity_type?: string;
  secondary_entity_name?: string;
  tertiary_entity_name?: string;
  metadata?: Record<string, unknown>;
  cleanPrimaryName?: string;
  cleanSecondaryName: string | null;
  tertiaryEntityName?: string;
}

/** Returned by a message group that does not handle the action type. */
export const UNHANDLED = Symbol("unhandled-activity");
