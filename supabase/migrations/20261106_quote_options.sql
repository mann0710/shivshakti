-- Quotation options (A / B / C of one enquiry) and price ranges for "choose any" groups.
-- Additive only; the app hides these features until it is run.
alter table quotations add column if not exists option_group uuid;
alter table quotations add column if not exists option_label text;
alter table quotations add column if not exists option_name text;
alter table quotations add column if not exists per_plate_max numeric(12,2);
alter table quotations add column if not exists total_max numeric(12,2);
create index if not exists quotations_option_group_idx on quotations (option_group);
