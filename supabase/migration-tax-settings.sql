-- Add per-type income tax percentages to user_settings
-- Run in Supabase SQL Editor
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS federal_tax_percent numeric(5,2) NOT NULL DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS provincial_tax_percent numeric(5,2) NOT NULL DEFAULT 12.00;
