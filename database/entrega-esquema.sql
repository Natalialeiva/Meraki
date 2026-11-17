--
-- PostgreSQL database dump
--

\restrict iES5VYgW1UC2mQ8OgSiG9BE0FnawmdguWfKIcjYc2j9mxbiLfxgPJdvQutvdNqh

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: estado_abono; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_abono AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado',
    'anulado'
);


--
-- Name: estado_emprendedora; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_emprendedora AS ENUM (
    'activa',
    'inactiva'
);


--
-- Name: estado_pago_suscripcion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_pago_suscripcion AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado',
    'anulado'
);


--
-- Name: estado_reserva; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_reserva AS ENUM (
    'pendiente_abono',
    'confirmada',
    'atendida',
    'no_atendida',
    'cancelada'
);


--
-- Name: estado_suscripcion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_suscripcion AS ENUM (
    'prueba',
    'activa',
    'vencida',
    'cancelada'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abono; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abono (
    id_abono integer NOT NULL,
    id_reserva integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    estado public.estado_abono DEFAULT 'pendiente'::public.estado_abono NOT NULL,
    token_transaccion character varying(255),
    codigo_autorizacion character varying(100),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_pago timestamp without time zone,
    buy_order character varying(26),
    fase_webpay character varying(25),
    sesion_webpay character varying(61),
    fecha_fase_webpay timestamp with time zone,
    operacion_webpay uuid,
    tipo_operacion_webpay character varying(6),
    estado_proceso_webpay character varying(12),
    fecha_operacion_webpay timestamp with time zone,
    commit_webpay_reclamado_en timestamp with time zone,
    CONSTRAINT abono_fase_webpay_valida CHECK (((fase_webpay IS NULL) OR (((fase_webpay)::text = ANY ((ARRAY['creacion_en_curso'::character varying, 'pendiente_respuesta_pago'::character varying, 'resultado_incierto'::character varying])::text[])) AND (sesion_webpay IS NOT NULL) AND (buy_order IS NOT NULL) AND (fecha_fase_webpay IS NOT NULL) AND (((fase_webpay)::text <> 'pendiente_respuesta_pago'::text) OR (token_transaccion IS NOT NULL))))),
    CONSTRAINT abono_proceso_webpay_valido CHECK ((((operacion_webpay IS NULL) AND (tipo_operacion_webpay IS NULL) AND (estado_proceso_webpay IS NULL) AND (fecha_operacion_webpay IS NULL) AND (commit_webpay_reclamado_en IS NULL)) OR ((operacion_webpay IS NOT NULL) AND (tipo_operacion_webpay IS NOT NULL) AND ((tipo_operacion_webpay)::text = ANY ((ARRAY['commit'::character varying, 'status'::character varying])::text[])) AND (estado_proceso_webpay IS NOT NULL) AND ((estado_proceso_webpay)::text = ANY ((ARRAY['en_proceso'::character varying, 'incierto'::character varying, 'resuelto'::character varying])::text[])) AND (fecha_operacion_webpay IS NOT NULL) AND (((tipo_operacion_webpay)::text <> 'commit'::text) OR (commit_webpay_reclamado_en IS NOT NULL)))))
);


--
-- Name: abono_id_abono_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.abono ALTER COLUMN id_abono ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.abono_id_abono_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bloqueo_horario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bloqueo_horario (
    id_bloqueo integer NOT NULL,
    id_trabajadora integer NOT NULL,
    fecha_inicio timestamp without time zone NOT NULL,
    fecha_fin timestamp without time zone NOT NULL,
    motivo character varying(255),
    CONSTRAINT chk_bloqueo_horario_fechas CHECK ((fecha_fin > fecha_inicio))
);


--
-- Name: bloqueo_horario_id_bloqueo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bloqueo_horario ALTER COLUMN id_bloqueo ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bloqueo_horario_id_bloqueo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoria (
    id_categoria integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


--
-- Name: categoria_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categoria ALTER COLUMN id_categoria ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categoria_id_categoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clienta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clienta (
    id_clienta integer NOT NULL,
    nombre character varying(150) NOT NULL,
    correo character varying(150) NOT NULL,
    telefono character varying(20),
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: clienta_id_clienta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.clienta ALTER COLUMN id_clienta ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clienta_id_clienta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: contacto_reserva_invitada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacto_reserva_invitada (
    id_reserva integer NOT NULL,
    nombre character varying(100) NOT NULL,
    correo character varying(150) NOT NULL,
    telefono character varying(20),
    CONSTRAINT contacto_reserva_invitada_correo_check CHECK (((length(btrim((correo)::text)) >= 3) AND (length(btrim((correo)::text)) <= 150))),
    CONSTRAINT contacto_reserva_invitada_nombre_check CHECK (((length(btrim((nombre)::text)) >= 1) AND (length(btrim((nombre)::text)) <= 100)))
);


--
-- Name: correccion_correo_reserva; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correccion_correo_reserva (
    id_correccion integer NOT NULL,
    id_reserva integer NOT NULL,
    id_notificacion_anterior integer,
    id_notificacion_nueva integer NOT NULL,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: correccion_correo_reserva_id_correccion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.correccion_correo_reserva ALTER COLUMN id_correccion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.correccion_correo_reserva_id_correccion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emprendedora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emprendedora (
    id_emprendedora integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    rut character varying(20) NOT NULL,
    correo character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    telefono character varying(20),
    estado public.estado_emprendedora DEFAULT 'activa'::public.estado_emprendedora NOT NULL,
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: emprendedora_id_emprendedora_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emprendedora ALTER COLUMN id_emprendedora ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.emprendedora_id_emprendedora_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emprendimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emprendimiento (
    id_emprendimiento integer NOT NULL,
    id_emprendedora integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    direccion character varying(200),
    comuna character varying(100),
    latitud numeric(10,7),
    longitud numeric(10,7),
    telefono character varying(20),
    estado boolean DEFAULT true NOT NULL
);


--
-- Name: emprendimiento_id_emprendimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emprendimiento ALTER COLUMN id_emprendimiento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.emprendimiento_id_emprendimiento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: evento_suscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_suscripcion (
    id_evento bigint NOT NULL,
    id_suscripcion integer NOT NULL,
    tipo character varying(60) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    detalle jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: evento_suscripcion_id_evento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.evento_suscripcion ALTER COLUMN id_evento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.evento_suscripcion_id_evento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: horario_atencion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_atencion (
    id_horario integer NOT NULL,
    id_trabajadora integer NOT NULL,
    dia_semana character varying(15) NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_horario_atencion_horas CHECK ((hora_fin > hora_inicio))
);


--
-- Name: horario_atencion_id_horario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.horario_atencion ALTER COLUMN id_horario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.horario_atencion_id_horario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: imagen_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imagen_servicio (
    id_imagen integer NOT NULL,
    id_servicio integer NOT NULL,
    url character varying(500) NOT NULL,
    descripcion character varying(255)
);


--
-- Name: imagen_servicio_id_imagen_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.imagen_servicio ALTER COLUMN id_imagen ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.imagen_servicio_id_imagen_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inscripcion_suscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscripcion_suscripcion (
    id_inscripcion bigint NOT NULL,
    id_suscripcion integer NOT NULL,
    usuario_oneclick character varying(50) NOT NULL,
    token_hash character varying(64),
    estado character varying(20) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_resolucion timestamp with time zone,
    CONSTRAINT inscripcion_suscripcion_estado_check CHECK (((estado)::text = ANY ((ARRAY['iniciando'::character varying, 'pendiente'::character varying, 'confirmando'::character varying, 'completada'::character varying, 'rechazada'::character varying, 'revision'::character varying, 'cancelada'::character varying])::text[])))
);


--
-- Name: inscripcion_suscripcion_id_inscripcion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.inscripcion_suscripcion ALTER COLUMN id_inscripcion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.inscripcion_suscripcion_id_inscripcion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: intento_reserva_invitada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intento_reserva_invitada (
    contexto_hash character(64) NOT NULL,
    clave_hash character(64) NOT NULL,
    huella character(64) NOT NULL,
    estado character varying(12) NOT NULL,
    id_reserva integer,
    token_hash character(64),
    codigo character varying(40),
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vence timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval) NOT NULL,
    CONSTRAINT intento_reserva_invitada_check CHECK (((((estado)::text = 'en_proceso'::text) AND (id_reserva IS NULL) AND (token_hash IS NULL) AND (codigo IS NULL)) OR (((estado)::text = 'creada'::text) AND (id_reserva IS NOT NULL) AND (token_hash IS NOT NULL) AND (codigo IS NULL)) OR (((estado)::text = 'rechazada'::text) AND (id_reserva IS NULL) AND (token_hash IS NULL) AND (codigo IS NOT NULL)))),
    CONSTRAINT intento_reserva_invitada_estado_check CHECK (((estado)::text = ANY ((ARRAY['en_proceso'::character varying, 'creada'::character varying, 'rechazada'::character varying])::text[])))
);


--
-- Name: notificacion_correo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacion_correo (
    id_notificacion integer NOT NULL,
    id_reserva integer NOT NULL,
    tipo character varying(50) DEFAULT 'confirmacion_reserva'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_envio timestamp without time zone,
    ultimo_error text,
    fecha_inicio_envio timestamp without time zone,
    id_mensaje text,
    CONSTRAINT notificacion_estado_valido CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'enviando'::character varying, 'enviado'::character varying, 'fallido'::character varying])::text[]))),
    CONSTRAINT notificacion_intentos_validos CHECK ((intentos >= 0))
);


--
-- Name: notificacion_correo_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notificacion_correo ALTER COLUMN id_notificacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notificacion_correo_id_notificacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pago_suscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pago_suscripcion (
    id_pago_suscripcion integer NOT NULL,
    id_suscripcion integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    estado public.estado_pago_suscripcion DEFAULT 'pendiente'::public.estado_pago_suscripcion NOT NULL,
    token_transaccion character varying(255),
    codigo_autorizacion character varying(100),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_pago timestamp without time zone,
    periodo_inicio date,
    periodo_fin date,
    orden_compra character varying(26),
    orden_tienda character varying(26),
    codigo_comercio character varying(20),
    intento integer DEFAULT 1 NOT NULL,
    proceso character varying(20) DEFAULT 'revision'::character varying NOT NULL,
    codigo_respuesta integer,
    dia_cobro integer,
    CONSTRAINT pago_suscripcion_proceso_check CHECK (((proceso)::text = ANY ((ARRAY['enviando'::character varying, 'revision'::character varying, 'finalizado'::character varying])::text[])))
);


--
-- Name: pago_suscripcion_id_pago_suscripcion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pago_suscripcion ALTER COLUMN id_pago_suscripcion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pago_suscripcion_id_pago_suscripcion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reserva; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva (
    id_reserva integer NOT NULL,
    id_emprendimiento integer NOT NULL,
    id_servicio integer NOT NULL,
    id_trabajadora integer NOT NULL,
    id_clienta integer,
    fecha_hora_inicio timestamp without time zone NOT NULL,
    fecha_hora_fin timestamp without time zone NOT NULL,
    estado public.estado_reserva DEFAULT 'pendiente_abono'::public.estado_reserva NOT NULL,
    precio_servicio numeric(10,2) NOT NULL,
    monto_abono numeric(10,2) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token_consulta uuid,
    correo_confirmacion character varying(150),
    nombre_clienta character varying(200),
    asistencia_confirmada_en timestamp with time zone,
    CONSTRAINT chk_reserva_fechas CHECK ((fecha_hora_fin > fecha_hora_inicio))
);


--
-- Name: reserva_id_reserva_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.reserva ALTER COLUMN id_reserva ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.reserva_id_reserva_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: revision_notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revision_notificacion (
    id_revision integer NOT NULL,
    id_notificacion integer NOT NULL,
    id_emprendedora integer NOT NULL,
    decision character varying(30) NOT NULL,
    evidencia text NOT NULL,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT revision_notificacion_decision_check CHECK (((decision)::text = ANY ((ARRAY['entregado'::character varying, 'no_entregado'::character varying, 'reintento'::character varying])::text[]))),
    CONSTRAINT revision_notificacion_evidencia_check CHECK (((length(evidencia) >= 10) AND (length(evidencia) <= 500)))
);


--
-- Name: revision_notificacion_id_revision_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.revision_notificacion ALTER COLUMN id_revision ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.revision_notificacion_id_revision_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio (
    id_servicio integer NOT NULL,
    id_emprendimiento integer NOT NULL,
    id_categoria integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    precio numeric(10,2) NOT NULL,
    duracion_min integer NOT NULL,
    monto_abono numeric(10,2) NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


--
-- Name: servicio_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.servicio ALTER COLUMN id_servicio ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.servicio_id_servicio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sesion_meraki; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesion_meraki (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: solicitud_cancelacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_cancelacion (
    id_solicitud integer NOT NULL,
    id_reserva integer NOT NULL,
    estado character varying(10) DEFAULT 'pendiente'::character varying NOT NULL,
    creada_en timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    motivo character varying(500),
    cerrada_en timestamp with time zone,
    cerrada_por integer,
    respuesta character varying(500),
    CONSTRAINT solicitud_cancelacion_check CHECK (((((estado)::text = 'pendiente'::text) AND (cerrada_en IS NULL) AND (cerrada_por IS NULL) AND (respuesta IS NULL)) OR (((estado)::text = 'cerrada'::text) AND (cerrada_en IS NOT NULL) AND (cerrada_por IS NOT NULL) AND (respuesta IS NOT NULL) AND ((length(btrim((respuesta)::text)) >= 1) AND (length(btrim((respuesta)::text)) <= 500))))),
    CONSTRAINT solicitud_cancelacion_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT solicitud_cancelacion_motivo_check CHECK (((motivo IS NULL) OR ((length(btrim((motivo)::text)) >= 1) AND (length(btrim((motivo)::text)) <= 500))))
);


--
-- Name: solicitud_cancelacion_id_solicitud_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_cancelacion ALTER COLUMN id_solicitud ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.solicitud_cancelacion_id_solicitud_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: suscripcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suscripcion (
    id_suscripcion integer NOT NULL,
    id_emprendedora integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin_prueba date,
    fecha_proximo_cobro date,
    monto_mensual numeric(10,2) NOT NULL,
    estado public.estado_suscripcion NOT NULL,
    renovacion_automatica boolean DEFAULT false NOT NULL,
    usuario_oneclick character varying(50),
    tarjeta_cifrada text,
    tarjeta_ultimos4 character varying(4),
    tarjeta_tipo character varying(100),
    consentimiento_fecha timestamp with time zone,
    consentimiento_version character varying(80),
    acceso_hasta date,
    dia_cobro integer,
    reintento_autorizado boolean DEFAULT false NOT NULL,
    cancelada_fecha timestamp with time zone,
    CONSTRAINT suscripcion_dia_cobro_check CHECK (((dia_cobro >= 1) AND (dia_cobro <= 31)))
);


--
-- Name: suscripcion_id_suscripcion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.suscripcion ALTER COLUMN id_suscripcion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.suscripcion_id_suscripcion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trabajadora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trabajadora (
    id_trabajadora integer NOT NULL,
    id_emprendimiento integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100),
    descripcion text,
    activa boolean DEFAULT true NOT NULL
);


--
-- Name: trabajadora_id_trabajadora_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.trabajadora ALTER COLUMN id_trabajadora ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.trabajadora_id_trabajadora_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trabajadora_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trabajadora_servicio (
    id_trabajadora integer NOT NULL,
    id_servicio integer NOT NULL
);


--
-- Name: abono abono_operacion_webpay_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT abono_operacion_webpay_key UNIQUE (operacion_webpay);


--
-- Name: abono abono_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT abono_pkey PRIMARY KEY (id_abono);


--
-- Name: abono abono_token_transaccion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT abono_token_transaccion_key UNIQUE (token_transaccion);


--
-- Name: bloqueo_horario bloqueo_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueo_horario
    ADD CONSTRAINT bloqueo_horario_pkey PRIMARY KEY (id_bloqueo);


--
-- Name: categoria categoria_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_nombre_key UNIQUE (nombre);


--
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id_categoria);


--
-- Name: clienta clienta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clienta
    ADD CONSTRAINT clienta_pkey PRIMARY KEY (id_clienta);


--
-- Name: contacto_reserva_invitada contacto_reserva_invitada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacto_reserva_invitada
    ADD CONSTRAINT contacto_reserva_invitada_pkey PRIMARY KEY (id_reserva);


--
-- Name: correccion_correo_reserva correccion_correo_reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correccion_correo_reserva
    ADD CONSTRAINT correccion_correo_reserva_pkey PRIMARY KEY (id_correccion);


--
-- Name: emprendedora emprendedora_correo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendedora
    ADD CONSTRAINT emprendedora_correo_key UNIQUE (correo);


--
-- Name: emprendedora emprendedora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendedora
    ADD CONSTRAINT emprendedora_pkey PRIMARY KEY (id_emprendedora);


--
-- Name: emprendedora emprendedora_rut_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendedora
    ADD CONSTRAINT emprendedora_rut_key UNIQUE (rut);


--
-- Name: emprendimiento emprendimiento_id_emprendedora_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendimiento
    ADD CONSTRAINT emprendimiento_id_emprendedora_key UNIQUE (id_emprendedora);


--
-- Name: emprendimiento emprendimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendimiento
    ADD CONSTRAINT emprendimiento_pkey PRIMARY KEY (id_emprendimiento);


--
-- Name: evento_suscripcion evento_suscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_suscripcion
    ADD CONSTRAINT evento_suscripcion_pkey PRIMARY KEY (id_evento);


--
-- Name: horario_atencion horario_atencion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_atencion
    ADD CONSTRAINT horario_atencion_pkey PRIMARY KEY (id_horario);


--
-- Name: horario_atencion horario_atencion_sin_superposicion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_atencion
    ADD CONSTRAINT horario_atencion_sin_superposicion EXCLUDE USING gist (id_trabajadora WITH =, dia_semana WITH =, tsrange(('2000-01-01'::date + hora_inicio), ('2000-01-01'::date + hora_fin), '[)'::text) WITH &&) WHERE ((activo = true));


--
-- Name: imagen_servicio imagen_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imagen_servicio
    ADD CONSTRAINT imagen_servicio_pkey PRIMARY KEY (id_imagen);


--
-- Name: inscripcion_suscripcion inscripcion_suscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion_suscripcion
    ADD CONSTRAINT inscripcion_suscripcion_pkey PRIMARY KEY (id_inscripcion);


--
-- Name: inscripcion_suscripcion inscripcion_suscripcion_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion_suscripcion
    ADD CONSTRAINT inscripcion_suscripcion_token_hash_key UNIQUE (token_hash);


--
-- Name: intento_reserva_invitada intento_reserva_invitada_id_reserva_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intento_reserva_invitada
    ADD CONSTRAINT intento_reserva_invitada_id_reserva_key UNIQUE (id_reserva);


--
-- Name: intento_reserva_invitada intento_reserva_invitada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intento_reserva_invitada
    ADD CONSTRAINT intento_reserva_invitada_pkey PRIMARY KEY (contexto_hash, clave_hash);


--
-- Name: notificacion_correo notificacion_correo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_correo
    ADD CONSTRAINT notificacion_correo_pkey PRIMARY KEY (id_notificacion);


--
-- Name: notificacion_correo notificacion_reserva_tipo_unico; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_correo
    ADD CONSTRAINT notificacion_reserva_tipo_unico UNIQUE (id_reserva, tipo);


--
-- Name: pago_suscripcion pago_suscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago_suscripcion
    ADD CONSTRAINT pago_suscripcion_pkey PRIMARY KEY (id_pago_suscripcion);


--
-- Name: pago_suscripcion pago_suscripcion_token_transaccion_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago_suscripcion
    ADD CONSTRAINT pago_suscripcion_token_transaccion_key UNIQUE (token_transaccion);


--
-- Name: trabajadora_servicio pk_trabajadora_servicio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajadora_servicio
    ADD CONSTRAINT pk_trabajadora_servicio PRIMARY KEY (id_trabajadora, id_servicio);


--
-- Name: reserva reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_pkey PRIMARY KEY (id_reserva);


--
-- Name: revision_notificacion revision_notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_notificacion
    ADD CONSTRAINT revision_notificacion_pkey PRIMARY KEY (id_revision);


--
-- Name: servicio servicio_abono_clp_valido; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.servicio
    ADD CONSTRAINT servicio_abono_clp_valido CHECK (((monto_abono >= (1)::numeric) AND (monto_abono <= (99999999)::numeric) AND (monto_abono = trunc(monto_abono)) AND (monto_abono <= precio))) NOT VALID;


--
-- Name: servicio servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT servicio_pkey PRIMARY KEY (id_servicio);


--
-- Name: sesion_meraki session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesion_meraki
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: solicitud_cancelacion solicitud_cancelacion_id_reserva_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cancelacion
    ADD CONSTRAINT solicitud_cancelacion_id_reserva_key UNIQUE (id_reserva);


--
-- Name: solicitud_cancelacion solicitud_cancelacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cancelacion
    ADD CONSTRAINT solicitud_cancelacion_pkey PRIMARY KEY (id_solicitud);


--
-- Name: suscripcion suscripcion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripcion
    ADD CONSTRAINT suscripcion_pkey PRIMARY KEY (id_suscripcion);


--
-- Name: trabajadora trabajadora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajadora
    ADD CONSTRAINT trabajadora_pkey PRIMARY KEY (id_trabajadora);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sesion_meraki USING btree (expire);


--
-- Name: abono_buy_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX abono_buy_order_key ON public.abono USING btree (buy_order);


--
-- Name: abono_buy_order_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX abono_buy_order_unico ON public.abono USING btree (buy_order);


--
-- Name: abono_sesion_webpay_unica; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX abono_sesion_webpay_unica ON public.abono USING btree (sesion_webpay) WHERE (sesion_webpay IS NOT NULL);


--
-- Name: abono_un_aprobado_por_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX abono_un_aprobado_por_reserva ON public.abono USING btree (id_reserva) WHERE (estado = 'aprobado'::public.estado_abono);


--
-- Name: abono_un_pendiente_por_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX abono_un_pendiente_por_reserva ON public.abono USING btree (id_reserva) WHERE (estado = 'pendiente'::public.estado_abono);


--
-- Name: clienta_correo_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clienta_correo_unico ON public.clienta USING btree (lower(TRIM(BOTH FROM correo)));


--
-- Name: intento_reserva_invitada_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intento_reserva_invitada_fecha ON public.intento_reserva_invitada USING btree (contexto_hash, fecha);


--
-- Name: pago_suscripcion_intento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pago_suscripcion_intento ON public.pago_suscripcion USING btree (id_suscripcion, periodo_inicio, intento);


--
-- Name: pago_suscripcion_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pago_suscripcion_orden ON public.pago_suscripcion USING btree (orden_compra);


--
-- Name: pago_suscripcion_periodo_aprobado; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pago_suscripcion_periodo_aprobado ON public.pago_suscripcion USING btree (id_suscripcion, periodo_inicio) WHERE (estado = 'aprobado'::public.estado_pago_suscripcion);


--
-- Name: pago_suscripcion_tienda; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pago_suscripcion_tienda ON public.pago_suscripcion USING btree (orden_tienda);


--
-- Name: reserva_token_consulta_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reserva_token_consulta_unico ON public.reserva USING btree (token_consulta);


--
-- Name: suscripcion_por_emprendedora; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX suscripcion_por_emprendedora ON public.suscripcion USING btree (id_emprendedora);


--
-- Name: contacto_reserva_invitada contacto_reserva_invitada_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacto_reserva_invitada
    ADD CONSTRAINT contacto_reserva_invitada_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: correccion_correo_reserva correccion_correo_reserva_id_notificacion_anterior_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correccion_correo_reserva
    ADD CONSTRAINT correccion_correo_reserva_id_notificacion_anterior_fkey FOREIGN KEY (id_notificacion_anterior) REFERENCES public.notificacion_correo(id_notificacion);


--
-- Name: correccion_correo_reserva correccion_correo_reserva_id_notificacion_nueva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correccion_correo_reserva
    ADD CONSTRAINT correccion_correo_reserva_id_notificacion_nueva_fkey FOREIGN KEY (id_notificacion_nueva) REFERENCES public.notificacion_correo(id_notificacion);


--
-- Name: correccion_correo_reserva correccion_correo_reserva_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correccion_correo_reserva
    ADD CONSTRAINT correccion_correo_reserva_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: evento_suscripcion evento_suscripcion_id_suscripcion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_suscripcion
    ADD CONSTRAINT evento_suscripcion_id_suscripcion_fkey FOREIGN KEY (id_suscripcion) REFERENCES public.suscripcion(id_suscripcion);


--
-- Name: abono fk_abono_reserva; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT fk_abono_reserva FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: bloqueo_horario fk_bloqueo_horario_trabajadora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueo_horario
    ADD CONSTRAINT fk_bloqueo_horario_trabajadora FOREIGN KEY (id_trabajadora) REFERENCES public.trabajadora(id_trabajadora);


--
-- Name: emprendimiento fk_emprendimiento_emprendedora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emprendimiento
    ADD CONSTRAINT fk_emprendimiento_emprendedora FOREIGN KEY (id_emprendedora) REFERENCES public.emprendedora(id_emprendedora);


--
-- Name: horario_atencion fk_horario_atencion_trabajadora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_atencion
    ADD CONSTRAINT fk_horario_atencion_trabajadora FOREIGN KEY (id_trabajadora) REFERENCES public.trabajadora(id_trabajadora);


--
-- Name: imagen_servicio fk_imagen_servicio_servicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imagen_servicio
    ADD CONSTRAINT fk_imagen_servicio_servicio FOREIGN KEY (id_servicio) REFERENCES public.servicio(id_servicio);


--
-- Name: pago_suscripcion fk_pago_suscripcion_suscripcion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago_suscripcion
    ADD CONSTRAINT fk_pago_suscripcion_suscripcion FOREIGN KEY (id_suscripcion) REFERENCES public.suscripcion(id_suscripcion);


--
-- Name: reserva fk_reserva_clienta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT fk_reserva_clienta FOREIGN KEY (id_clienta) REFERENCES public.clienta(id_clienta);


--
-- Name: reserva fk_reserva_emprendimiento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT fk_reserva_emprendimiento FOREIGN KEY (id_emprendimiento) REFERENCES public.emprendimiento(id_emprendimiento);


--
-- Name: reserva fk_reserva_servicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT fk_reserva_servicio FOREIGN KEY (id_servicio) REFERENCES public.servicio(id_servicio);


--
-- Name: reserva fk_reserva_trabajadora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT fk_reserva_trabajadora FOREIGN KEY (id_trabajadora) REFERENCES public.trabajadora(id_trabajadora);


--
-- Name: servicio fk_servicio_categoria; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT fk_servicio_categoria FOREIGN KEY (id_categoria) REFERENCES public.categoria(id_categoria);


--
-- Name: servicio fk_servicio_emprendimiento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT fk_servicio_emprendimiento FOREIGN KEY (id_emprendimiento) REFERENCES public.emprendimiento(id_emprendimiento);


--
-- Name: suscripcion fk_suscripcion_emprendedora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripcion
    ADD CONSTRAINT fk_suscripcion_emprendedora FOREIGN KEY (id_emprendedora) REFERENCES public.emprendedora(id_emprendedora);


--
-- Name: trabajadora fk_trabajadora_emprendimiento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajadora
    ADD CONSTRAINT fk_trabajadora_emprendimiento FOREIGN KEY (id_emprendimiento) REFERENCES public.emprendimiento(id_emprendimiento);


--
-- Name: trabajadora_servicio fk_trabajadora_servicio_servicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajadora_servicio
    ADD CONSTRAINT fk_trabajadora_servicio_servicio FOREIGN KEY (id_servicio) REFERENCES public.servicio(id_servicio);


--
-- Name: trabajadora_servicio fk_trabajadora_servicio_trabajadora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajadora_servicio
    ADD CONSTRAINT fk_trabajadora_servicio_trabajadora FOREIGN KEY (id_trabajadora) REFERENCES public.trabajadora(id_trabajadora);


--
-- Name: inscripcion_suscripcion inscripcion_suscripcion_id_suscripcion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripcion_suscripcion
    ADD CONSTRAINT inscripcion_suscripcion_id_suscripcion_fkey FOREIGN KEY (id_suscripcion) REFERENCES public.suscripcion(id_suscripcion);


--
-- Name: intento_reserva_invitada intento_reserva_invitada_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intento_reserva_invitada
    ADD CONSTRAINT intento_reserva_invitada_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: notificacion_correo notificacion_correo_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion_correo
    ADD CONSTRAINT notificacion_correo_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- Name: revision_notificacion revision_notificacion_id_emprendedora_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_notificacion
    ADD CONSTRAINT revision_notificacion_id_emprendedora_fkey FOREIGN KEY (id_emprendedora) REFERENCES public.emprendedora(id_emprendedora);


--
-- Name: revision_notificacion revision_notificacion_id_notificacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revision_notificacion
    ADD CONSTRAINT revision_notificacion_id_notificacion_fkey FOREIGN KEY (id_notificacion) REFERENCES public.notificacion_correo(id_notificacion);


--
-- Name: solicitud_cancelacion solicitud_cancelacion_cerrada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cancelacion
    ADD CONSTRAINT solicitud_cancelacion_cerrada_por_fkey FOREIGN KEY (cerrada_por) REFERENCES public.emprendedora(id_emprendedora);


--
-- Name: solicitud_cancelacion solicitud_cancelacion_id_reserva_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_cancelacion
    ADD CONSTRAINT solicitud_cancelacion_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reserva(id_reserva);


--
-- PostgreSQL database dump complete
--

\unrestrict iES5VYgW1UC2mQ8OgSiG9BE0FnawmdguWfKIcjYc2j9mxbiLfxgPJdvQutvdNqh

