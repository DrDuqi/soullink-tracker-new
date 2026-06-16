-- migration_v7: add 'revive' to request_type constraint

DO $$
DECLARE v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.table_schema = cc.constraint_schema
  WHERE tc.table_name = 'link_requests'
    AND cc.check_clause LIKE '%request_type%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE link_requests DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE link_requests
  ADD CONSTRAINT link_requests_request_type_check
  CHECK (request_type IN ('link', 'death', 'team_sync', 'team_remove', 'team_move', 'revive'));
