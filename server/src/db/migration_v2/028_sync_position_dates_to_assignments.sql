-- Migration 028: Sync position dates to active assignments
-- Ensures that when a position's start_date or end_date is updated,
-- active and upcoming position_candidate_assignments are automatically updated,
-- their statuses are updated (e.g. 'completed' if end_date < CURRENT_DATE),
-- and positions.assigned_jobseekers is kept in sync.

CREATE OR REPLACE FUNCTION public.sync_position_dates_to_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.end_date IS DISTINCT FROM NEW.end_date) OR (OLD.start_date IS DISTINCT FROM NEW.start_date) THEN
    -- Update assignment dates for active and upcoming assignments
    UPDATE public.position_candidate_assignments
    SET 
      start_date = COALESCE(NEW.start_date, start_date),
      end_date = NEW.end_date,
      status = CASE 
        WHEN NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN 'completed'
        WHEN NEW.start_date IS NOT NULL AND NEW.start_date > CURRENT_DATE THEN 'upcoming'
        ELSE 'active'
      END,
      updated_at = NOW()
    WHERE position_id = NEW.id
      AND status IN ('active', 'upcoming');
      
    -- Sync positions.assigned_jobseekers to only include candidates with active status
    NEW.assigned_jobseekers := ARRAY(
      SELECT candidate_id 
      FROM public.position_candidate_assignments 
      WHERE position_id = NEW.id AND status = 'active'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_position_dates ON public.positions;
CREATE TRIGGER trg_sync_position_dates
BEFORE UPDATE OF start_date, end_date ON public.positions
FOR EACH ROW
EXECUTE FUNCTION public.sync_position_dates_to_assignments();
