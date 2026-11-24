import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileCheckError = {
  success: false;
  status: number;
  error: string;
};

/**
 * A timesheet's `jobseeker_profile_id` must belong to its `jobseeker_user_id`, for every role;
 * otherwise pay and bill could be put on another person's profile (inbox 66).
 * Returns an error result for the caller to return, or null when the pair is fine.
 */
export async function checkProfileBelongsToUser(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<ProfileCheckError | null> {
  const { data: profile, error } = await supabase
    .from("jobseeker_profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("Error checking the jobseeker profile owner:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to validate jobseeker profile",
    };
  }

  if (!profile || profile.user_id !== userId) {
    return {
      success: false,
      status: 400,
      error: "jobseeker_profile_id does not belong to jobseeker_user_id",
    };
  }

  return null;
}
