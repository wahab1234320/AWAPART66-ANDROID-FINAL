-- Apply once to the reviewed production schema, in a transaction.
BEGIN;
LOCK TABLE public.admins, public.bookings, public.finance_entries IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.admins) <> 1 THEN RAISE EXCEPTION 'Expected exactly one existing admin'; END IF;
 IF EXISTS (SELECT 1 FROM public.bookings WHERE payment_method NOT IN ('CASH','TRANSFER')) OR EXISTS (SELECT 1 FROM public.finance_entries WHERE payment_method NOT IN ('CASH','TRANSFER')) THEN RAISE EXCEPTION 'Unclassified historical payments: review manually'; END IF;
END $$;
ALTER TABLE public.admins ADD COLUMN recovery_enabled boolean DEFAULT false NOT NULL;
ALTER TABLE public.admins ADD COLUMN active boolean DEFAULT true NOT NULL;
ALTER TABLE public.admins ADD COLUMN super_admin boolean DEFAULT false NOT NULL;
ALTER TABLE public.admins ADD COLUMN full_name text;
ALTER TABLE public.admins ADD COLUMN job_title text;
ALTER TABLE public.admins ADD COLUMN phone text;
ALTER TABLE public.admins ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE public.customer_accounts ADD COLUMN email_verified_at timestamp with time zone;
ALTER TABLE public.customer_accounts ADD COLUMN google_sub text;
ALTER TABLE public.owner_accounts ADD COLUMN recovery_enabled boolean DEFAULT false NOT NULL;
CREATE TABLE public.account_email_changes (
    digest text NOT NULL,
    role text NOT NULL,
    account_id bigint NOT NULL,
    old_email text NOT NULL,
    new_email text NOT NULL,
    old_hash text NOT NULL,
    new_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
CREATE TABLE public.customer_email_tokens (
    digest text NOT NULL,
    customer_id bigint NOT NULL,
    purpose text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT customer_email_tokens_purpose_check CHECK ((purpose = ANY (ARRAY['verify'::text, 'reset'::text])))
);
CREATE TABLE public.google_attempts (
    state text NOT NULL,
    poll_digest text NOT NULL,
    verifier text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    failed boolean DEFAULT false NOT NULL,
    customer_id bigint
);
CREATE TABLE public.owner_applications (
    id bigint NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    pending_password_hash text,
    email_verified_at timestamp with time zone,
    property_name text,
    property_location text,
    unit_count integer,
    decided_at timestamp with time zone,
    approved_owner_id bigint
);
CREATE SEQUENCE public.owner_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.owner_applications_id_seq OWNED BY public.owner_applications.id;
CREATE TABLE public.owner_signup_tokens (
    digest text NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    property_name text NOT NULL,
    property_location text NOT NULL,
    unit_count integer NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
CREATE TABLE public.privileged_recovery (
    digest text NOT NULL,
    role text NOT NULL,
    account_id bigint NOT NULL,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT privileged_recovery_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'owner'::text])))
);
CREATE TABLE public.revoked_sessions (
    jti text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);
CREATE TABLE public.unit_photos (
    unit_id integer NOT NULL,
    mime text NOT NULL,
    data bytea NOT NULL,
    version uuid NOT NULL
);
ALTER TABLE ONLY public.owner_applications ALTER COLUMN id SET DEFAULT nextval('public.owner_applications_id_seq'::regclass);
ALTER TABLE ONLY public.account_email_changes
    ADD CONSTRAINT account_email_changes_pkey PRIMARY KEY (digest);
ALTER TABLE ONLY public.customer_email_tokens
    ADD CONSTRAINT customer_email_tokens_pkey PRIMARY KEY (digest);
ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_pkey PRIMARY KEY (state);
ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_poll_digest_key UNIQUE (poll_digest);
ALTER TABLE ONLY public.owner_applications
    ADD CONSTRAINT owner_applications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.owner_signup_tokens
    ADD CONSTRAINT owner_signup_tokens_pkey PRIMARY KEY (digest);
ALTER TABLE ONLY public.privileged_recovery
    ADD CONSTRAINT privileged_recovery_pkey PRIMARY KEY (digest);
ALTER TABLE ONLY public.revoked_sessions
    ADD CONSTRAINT revoked_sessions_pkey PRIMARY KEY (jti);
ALTER TABLE ONLY public.unit_photos
    ADD CONSTRAINT unit_photos_pkey PRIMARY KEY (unit_id);
CREATE UNIQUE INDEX owner_application_pending_email ON public.owner_applications USING btree (lower(email)) WHERE (status = 'PENDING'::text);
CREATE INDEX owner_applications_approved_owner_idx ON public.owner_applications USING btree (approved_owner_id);
ALTER TABLE ONLY public.customer_email_tokens
    ADD CONSTRAINT customer_email_tokens_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.owner_applications
    ADD CONSTRAINT owner_applications_approved_owner_id_fkey FOREIGN KEY (approved_owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.units ADD COLUMN application_id bigint REFERENCES public.owner_applications(id) ON DELETE SET NULL;
CREATE INDEX idx_units_application_id ON public.units(application_id);
ALTER TABLE public.customer_accounts ADD CONSTRAINT customer_accounts_google_sub_key UNIQUE (google_sub);
UPDATE public.admins SET super_admin=true;
ALTER TABLE public.unit_photos ADD CONSTRAINT unit_photos_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ALTER COLUMN payment_method SET DEFAULT 'TRANSFER';
ALTER TABLE public.finance_entries ALTER COLUMN payment_method SET DEFAULT 'CASH';
COMMIT;
