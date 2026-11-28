--
-- PostgreSQL database dump
--

\restrict Y9GfpO8HUx7PJZYvL4ZbobmG843AWRVu82PKziFbBBldichTf0jddHIa6eBkWYo

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_email_changes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    recovery_enabled boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    super_admin boolean DEFAULT false NOT NULL,
    full_name text,
    job_title text,
    phone text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    admin_email text,
    action text,
    booking_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id text NOT NULL,
    customer_name text NOT NULL,
    phone text NOT NULL,
    unit_id integer,
    check_in date NOT NULL,
    days integer NOT NULL,
    total bigint NOT NULL,
    status text DEFAULT 'MENUNGGU_TRANSFER'::text NOT NULL,
    proof_file text,
    created_at timestamp with time zone DEFAULT now(),
    payment_method text DEFAULT 'TRANSFER'::text NOT NULL,
    payment_verified_at timestamp with time zone,
    payment_verified_by text,
    commission_bps_snapshot integer,
    owner_id_snapshot bigint,
    actual_check_in timestamp with time zone,
    actual_check_out timestamp with time zone,
    customer_account_id bigint,
    CONSTRAINT bookings_commission_bps_snapshot_check CHECK (((commission_bps_snapshot >= 0) AND (commission_bps_snapshot <= 10000))),
    CONSTRAINT bookings_days_check CHECK (((days >= 1) AND (days <= 90))),
    CONSTRAINT bookings_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text])))
);


--
-- Name: customer_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_accounts (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    email_verified_at timestamp with time zone,
    google_sub text
);


--
-- Name: customer_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_accounts_id_seq OWNED BY public.customer_accounts.id;


--
-- Name: customer_email_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_email_tokens (
    digest text NOT NULL,
    customer_id bigint NOT NULL,
    purpose text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT customer_email_tokens_purpose_check CHECK ((purpose = ANY (ARRAY['verify'::text, 'reset'::text])))
);


--
-- Name: finance_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_entries (
    id bigint NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    entry_type text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount bigint NOT NULL,
    booking_id text,
    unit_id integer,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text DEFAULT 'CASH'::text NOT NULL,
    CONSTRAINT finance_entries_amount_check CHECK ((amount > 0)),
    CONSTRAINT finance_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['INCOME'::text, 'EXPENSE'::text]))),
    CONSTRAINT finance_entries_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text])))
);


--
-- Name: finance_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_entries_id_seq OWNED BY public.finance_entries.id;


--
-- Name: google_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_attempts (
    state text NOT NULL,
    poll_digest text NOT NULL,
    verifier text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    failed boolean DEFAULT false NOT NULL,
    customer_id bigint
);


--
-- Name: owner_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_accounts (
    id bigint NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    password_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recovery_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: owner_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owner_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owner_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owner_accounts_id_seq OWNED BY public.owner_accounts.id;


--
-- Name: owner_applications; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: owner_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owner_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owner_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owner_applications_id_seq OWNED BY public.owner_applications.id;


--
-- Name: owner_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_audit_logs (
    id bigint NOT NULL,
    owner_id bigint,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: owner_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owner_audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owner_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owner_audit_logs_id_seq OWNED BY public.owner_audit_logs.id;


--
-- Name: owner_signup_tokens; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id integer NOT NULL,
    owner_name text NOT NULL,
    phone text NOT NULL,
    property_name text NOT NULL,
    property_type text DEFAULT 'Apartemen'::text NOT NULL,
    cooperation_type text DEFAULT 'Pengelolaan sewa'::text NOT NULL,
    status text DEFAULT 'BARU'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: partners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partners_id_seq OWNED BY public.partners.id;


--
-- Name: payment_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_accounts (
    id integer NOT NULL,
    bank text NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: payment_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_accounts_id_seq OWNED BY public.payment_accounts.id;


--
-- Name: privileged_recovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.privileged_recovery (
    digest text NOT NULL,
    role text NOT NULL,
    account_id bigint NOT NULL,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT privileged_recovery_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'owner'::text])))
);


--
-- Name: revoked_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revoked_sessions (
    jti text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: unit_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_photos (
    unit_id integer NOT NULL,
    mime text NOT NULL,
    data bytea NOT NULL,
    version uuid NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id integer NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    description text DEFAULT ''::text,
    price_daily bigint NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    owner_id bigint,
    commission_bps integer,
    operational_state text DEFAULT 'READY'::text NOT NULL,
    application_id bigint,
    CONSTRAINT units_commission_bps_check CHECK (((commission_bps >= 0) AND (commission_bps <= 10000))),
    CONSTRAINT units_price_daily_check CHECK ((price_daily >= 0))
);


--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: customer_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts ALTER COLUMN id SET DEFAULT nextval('public.customer_accounts_id_seq'::regclass);


--
-- Name: finance_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_entries ALTER COLUMN id SET DEFAULT nextval('public.finance_entries_id_seq'::regclass);


--
-- Name: owner_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts ALTER COLUMN id SET DEFAULT nextval('public.owner_accounts_id_seq'::regclass);


--
-- Name: owner_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_applications ALTER COLUMN id SET DEFAULT nextval('public.owner_applications_id_seq'::regclass);


--
-- Name: owner_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.owner_audit_logs_id_seq'::regclass);


--
-- Name: partners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners ALTER COLUMN id SET DEFAULT nextval('public.partners_id_seq'::regclass);


--
-- Name: payment_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_accounts ALTER COLUMN id SET DEFAULT nextval('public.payment_accounts_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: account_email_changes account_email_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_email_changes
    ADD CONSTRAINT account_email_changes_pkey PRIMARY KEY (digest);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: customer_accounts customer_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_email_key UNIQUE (email);


--
-- Name: customer_accounts customer_accounts_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_google_sub_key UNIQUE (google_sub);


--
-- Name: customer_accounts customer_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_pkey PRIMARY KEY (id);


--
-- Name: customer_email_tokens customer_email_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_email_tokens
    ADD CONSTRAINT customer_email_tokens_pkey PRIMARY KEY (digest);


--
-- Name: finance_entries finance_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_entries
    ADD CONSTRAINT finance_entries_pkey PRIMARY KEY (id);


--
-- Name: google_attempts google_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_pkey PRIMARY KEY (state);


--
-- Name: google_attempts google_attempts_poll_digest_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_poll_digest_key UNIQUE (poll_digest);


--
-- Name: owner_accounts owner_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts
    ADD CONSTRAINT owner_accounts_email_key UNIQUE (email);


--
-- Name: owner_accounts owner_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_accounts
    ADD CONSTRAINT owner_accounts_pkey PRIMARY KEY (id);


--
-- Name: owner_applications owner_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_applications
    ADD CONSTRAINT owner_applications_pkey PRIMARY KEY (id);


--
-- Name: owner_audit_logs owner_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs
    ADD CONSTRAINT owner_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: owner_signup_tokens owner_signup_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_signup_tokens
    ADD CONSTRAINT owner_signup_tokens_pkey PRIMARY KEY (digest);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: payment_accounts payment_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_accounts
    ADD CONSTRAINT payment_accounts_pkey PRIMARY KEY (id);


--
-- Name: privileged_recovery privileged_recovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.privileged_recovery
    ADD CONSTRAINT privileged_recovery_pkey PRIMARY KEY (digest);


--
-- Name: revoked_sessions revoked_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revoked_sessions
    ADD CONSTRAINT revoked_sessions_pkey PRIMARY KEY (jti);


--
-- Name: unit_photos unit_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_photos
    ADD CONSTRAINT unit_photos_pkey PRIMARY KEY (unit_id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: bookings_owner_snapshot_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_owner_snapshot_idx ON public.bookings USING btree (owner_id_snapshot);


--
-- Name: idx_bookings_verified_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_verified_at ON public.bookings USING btree (payment_verified_at);


--
-- Name: idx_finance_entries_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_entries_booking ON public.finance_entries USING btree (booking_id);


--
-- Name: idx_finance_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_entries_date ON public.finance_entries USING btree (entry_date DESC);


--
-- Name: idx_units_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_application_id ON public.units USING btree (application_id);


--
-- Name: idx_units_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_owner_id ON public.units USING btree (owner_id);


--
-- Name: owner_application_pending_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX owner_application_pending_email ON public.owner_applications USING btree (lower(email)) WHERE (status = 'PENDING'::text);


--
-- Name: owner_applications_approved_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX owner_applications_approved_owner_idx ON public.owner_applications USING btree (approved_owner_id);


--
-- Name: bookings bookings_customer_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_account_id_fkey FOREIGN KEY (customer_account_id) REFERENCES public.customer_accounts(id);


--
-- Name: bookings bookings_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: customer_email_tokens customer_email_tokens_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_email_tokens
    ADD CONSTRAINT customer_email_tokens_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_entries finance_entries_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_entries
    ADD CONSTRAINT finance_entries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: finance_entries finance_entries_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_entries
    ADD CONSTRAINT finance_entries_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: google_attempts google_attempts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_attempts
    ADD CONSTRAINT google_attempts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(id) ON DELETE CASCADE;


--
-- Name: owner_applications owner_applications_approved_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_applications
    ADD CONSTRAINT owner_applications_approved_owner_id_fkey FOREIGN KEY (approved_owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;


--
-- Name: owner_audit_logs owner_audit_logs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs
    ADD CONSTRAINT owner_audit_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;


--
-- Name: unit_photos unit_photos_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_photos
    ADD CONSTRAINT unit_photos_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: units units_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.owner_applications(id) ON DELETE SET NULL;


--
-- Name: units units_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict Y9GfpO8HUx7PJZYvL4ZbobmG843AWRVu82PKziFbBBldichTf0jddHIa6eBkWYo

