--
-- PostgreSQL database dump
--

\restrict s3OkrRntfMyr73mqh2gzGG5uaL2TScercyVuh9tgu9Qmp1HwpXMr0boEYFDZvwr

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
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
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
    payment_method text DEFAULT 'UNKNOWN'::text NOT NULL,
    payment_verified_at timestamp with time zone,
    payment_verified_by text,
    commission_bps_snapshot integer,
    owner_id_snapshot bigint,
    actual_check_in timestamp with time zone,
    actual_check_out timestamp with time zone,
    customer_account_id bigint,
    CONSTRAINT bookings_commission_bps_snapshot_check CHECK (((commission_bps_snapshot >= 0) AND (commission_bps_snapshot <= 10000))),
    CONSTRAINT bookings_days_check CHECK (((days >= 1) AND (days <= 90))),
    CONSTRAINT bookings_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text, 'UNKNOWN'::text])))
);


--
-- Name: customer_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_accounts (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
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
    payment_method text DEFAULT 'UNKNOWN'::text NOT NULL,
    CONSTRAINT finance_entries_amount_check CHECK ((amount > 0)),
    CONSTRAINT finance_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['INCOME'::text, 'EXPENSE'::text]))),
    CONSTRAINT finance_entries_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'TRANSFER'::text, 'UNKNOWN'::text])))
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
-- Name: legacy_unit_owner_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_unit_owner_review (
    unit_id integer NOT NULL,
    legacy_owner_id text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owners (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    address text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: owners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.owners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: owners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.owners_id_seq OWNED BY public.owners.id;


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
    owner_id integer,
    commission_percent numeric(5,2) DEFAULT 15 NOT NULL,
    commission_bps integer,
    operational_state text DEFAULT 'READY'::text NOT NULL,
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
-- Name: owner_audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.owner_audit_logs_id_seq'::regclass);


--
-- Name: owners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners ALTER COLUMN id SET DEFAULT nextval('public.owners_id_seq'::regclass);


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
-- Name: customer_accounts customer_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_accounts
    ADD CONSTRAINT customer_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_entries finance_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_entries
    ADD CONSTRAINT finance_entries_pkey PRIMARY KEY (id);


--
-- Name: legacy_unit_owner_review legacy_unit_owner_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_unit_owner_review
    ADD CONSTRAINT legacy_unit_owner_review_pkey PRIMARY KEY (unit_id);


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
-- Name: owner_audit_logs owner_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs
    ADD CONSTRAINT owner_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: owners owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owners
    ADD CONSTRAINT owners_pkey PRIMARY KEY (id);


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
-- Name: idx_units_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_owner_id ON public.units USING btree (owner_id);


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
-- Name: legacy_unit_owner_review legacy_unit_owner_review_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_unit_owner_review
    ADD CONSTRAINT legacy_unit_owner_review_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: owner_audit_logs owner_audit_logs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_audit_logs
    ADD CONSTRAINT owner_audit_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;


--
-- Name: units units_owner_accounts_v248_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_owner_accounts_v248_fk FOREIGN KEY (owner_id) REFERENCES public.owner_accounts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict s3OkrRntfMyr73mqh2gzGG5uaL2TScercyVuh9tgu9Qmp1HwpXMr0boEYFDZvwr

