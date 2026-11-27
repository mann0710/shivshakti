-- One-meal quotes: a full price above the plate price, and whether the PDF shows that discount.
-- Additive only; the Full price box stays hidden until it is run. Meals in multi-day quotes keep theirs in event_days.
alter table quotations add column if not exists full_price numeric(12,2);
alter table quotations add column if not exists hide_discount boolean not null default false;
