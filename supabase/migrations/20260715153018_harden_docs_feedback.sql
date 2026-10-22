-- DVL-82: keep anonymous documentation feedback narrowly scoped and bounded.

-- Remove legacy rows that cannot be produced by the hardened endpoint before
-- enforcing the same invariants in Postgres.
DELETE FROM public.docs_feedback
WHERE slug NOT IN (
  'account', 'api-analyze', 'api-batch', 'api-extract', 'api-keys',
  'api-overview', 'changelog', 'extraction', 'faq', 'installation',
  'monitoring', 'quick-start', 'risk-scoring', 'security-privacy',
  'understanding-results', 'usage-accounting', 'webhooks'
);

UPDATE public.docs_feedback
SET comment = left(comment, 1000)
WHERE length(comment) > 1000;

ALTER TABLE public.docs_feedback
  DROP CONSTRAINT IF EXISTS docs_feedback_slug_known,
  DROP CONSTRAINT IF EXISTS docs_feedback_comment_length,
  ADD CONSTRAINT docs_feedback_slug_known CHECK (
    slug IN (
      'account', 'api-analyze', 'api-batch', 'api-extract', 'api-keys',
      'api-overview', 'changelog', 'extraction', 'faq', 'installation',
      'monitoring', 'quick-start', 'risk-scoring', 'security-privacy',
      'understanding-results', 'usage-accounting', 'webhooks'
    )
  ),
  ADD CONSTRAINT docs_feedback_comment_length CHECK (
    comment IS NULL OR length(comment) <= 1000
  );

ALTER TABLE public.docs_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous feedback insert" ON public.docs_feedback;
CREATE POLICY "Allow validated anonymous feedback insert"
  ON public.docs_feedback
  FOR INSERT
  TO anon
  WITH CHECK (
    slug IN (
      'account', 'api-analyze', 'api-batch', 'api-extract', 'api-keys',
      'api-overview', 'changelog', 'extraction', 'faq', 'installation',
      'monitoring', 'quick-start', 'risk-scoring', 'security-privacy',
      'understanding-results', 'usage-accounting', 'webhooks'
    )
    AND (comment IS NULL OR length(comment) <= 1000)
  );

REVOKE ALL ON TABLE public.docs_feedback FROM anon, authenticated;
GRANT INSERT ON TABLE public.docs_feedback TO anon;

-- Raw feedback is retained for 180 days. Aggregate reporting remains available
-- across that window while old free-form comments are deleted automatically.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'prune-docs-feedback';

SELECT cron.schedule(
  'prune-docs-feedback',
  '17 3 * * *',
  $$DELETE FROM public.docs_feedback WHERE created_at < now() - interval '180 days'$$
);
