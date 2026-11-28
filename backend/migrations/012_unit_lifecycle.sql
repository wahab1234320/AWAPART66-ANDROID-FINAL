ALTER TABLE public.units ADD COLUMN IF NOT EXISTS application_id bigint REFERENCES public.owner_applications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_units_application_id ON public.units(application_id);
