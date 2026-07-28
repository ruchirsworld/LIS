-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type user_role as enum ('admin','cxo','staff');
create type project_status as enum ('active','completed');
create type invoice_status as enum ('draft','sent'); -- 'paid'/'overdue' are always computed, never stored
create type capital_tx_type as enum ('injection','withdrawal');
create type attendance_status as enum ('absent','half','leave','holiday','weeklyoff');
