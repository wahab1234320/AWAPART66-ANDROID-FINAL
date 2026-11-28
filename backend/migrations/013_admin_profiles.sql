ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS job_title text;
