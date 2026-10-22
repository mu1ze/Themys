ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS utm_source      TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium      TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign    TEXT,
  ADD COLUMN IF NOT EXISTS landing_page    TEXT;

COMMENT ON COLUMN public.users.utm_source   IS 'UTM source from signup landing (e.g. google, reddit, newsletter)';
COMMENT ON COLUMN public.users.utm_medium   IS 'UTM medium from signup landing (e.g. cpc, organic, email)';
COMMENT ON COLUMN public.users.utm_campaign IS 'UTM campaign from signup landing';
COMMENT ON COLUMN public.users.landing_page IS 'Full landing URL path + query used at signup';
