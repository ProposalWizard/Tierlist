-- Add or_groups to objectives table.
-- Array of condition groups; the objective is complete when every OR group has
-- at least one condition met (in addition to all regular conditions being met).
-- NULL = no OR groups (original AND-only behaviour).

ALTER TABLE objectives ADD COLUMN IF NOT EXISTS or_groups JSONB DEFAULT NULL;
