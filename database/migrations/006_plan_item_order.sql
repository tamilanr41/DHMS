-- Plan items are entered in a deliberate clinical sequence. created_at is identical
-- for items inserted in one transaction, so a sort key is needed to keep the order
-- stable in the UI and on printed estimates.
ALTER TABLE treatment_plan_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
