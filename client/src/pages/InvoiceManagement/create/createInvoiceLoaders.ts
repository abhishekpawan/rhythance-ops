import { getClients } from "../../../services/api/client";
import { getClientPositions } from "../../../services/api/position";
import { getJobseekerProfiles } from "../../../services/api/jobseeker";
import { AssignedJobseeker } from "../invoiceTypes";
import type { useInvoiceFormState } from "./useInvoiceFormState";

export function createInvoiceLoaders(
  ctx: ReturnType<typeof useInvoiceFormState>
) {
  const {
    setAllJobseekers,
    setClientLoading,
    setClients,
    setJobseekerLoading,
    setPositionLoading,
    setPositions,
  } = ctx;
  const fetchClients = async () => {
    try {
      setClientLoading(true);
      const response = await getClients({ limit: 100000000 }); // Get all clients
      setClients(response.clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setClientLoading(false);
    }
  };

  const fetchClientPositions = async (clientId: string) => {
    try {
      setPositionLoading(true);
      const response = await getClientPositions(clientId, {
        limit: 10000000,
        showAllSiblings: "true",
      });

      setPositions(response.positions);
    } catch (error) {
      console.error("Error fetching client positions:", error);
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  };

  // Fetch all jobseekers (no longer position-dependent)
  const fetchAllJobseekers = async () => {
    try {
      setJobseekerLoading(true);
      const response = await getJobseekerProfiles({
        limit: 100000000, // Absurd limit to fetch all
      });

      if (response.profiles && response.profiles.length > 0) {
        // Transform jobseeker profiles to match our interface
        const transformedJobseekers: AssignedJobseeker[] =
          response.profiles.map((profile) => {
            // Parse name into firstName and lastName
            const nameParts = profile.name?.split(" ") || [];
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            return {
              id: profile.id,
              candidateId: profile.userId,
              firstName: firstName,
              lastName: lastName,
              email: profile.email || "",
              mobile: profile.phoneNumber,
              status: profile.status || "active",
              startDate: "",
              endDate: undefined,
              // employeeId may not be in JobSeekerProfile type but could be in API response
              employeeId: (profile as { employeeId?: string }).employeeId || "",
            };
          });

        setAllJobseekers(transformedJobseekers);
      } else {
        setAllJobseekers([]);
      }
    } catch (error) {
      console.error("Error fetching all jobseekers:", error);
      setAllJobseekers([]);
    } finally {
      setJobseekerLoading(false);
    }
  };

  return { fetchClients, fetchClientPositions, fetchAllJobseekers };
}
