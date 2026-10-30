-- Document settings (address, UPI, payment schedule, terms, what each PDF shows).
-- Additive only; the app uses defaults until it is run.
alter table data_center add column if not exists doc_settings jsonb;
