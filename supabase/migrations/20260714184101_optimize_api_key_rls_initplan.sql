DROP POLICY IF EXISTS "Users can view own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view own api usage logs" ON api_usage_logs;

CREATE POLICY "Users can view own api keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = api_keys.user_id
      AND u.clerk_id = ((SELECT auth.jwt())->>'sub')
  ));

CREATE POLICY "Users can view own api usage logs"
  ON api_usage_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = api_usage_logs.user_id
      AND u.clerk_id = ((SELECT auth.jwt())->>'sub')
  ));
