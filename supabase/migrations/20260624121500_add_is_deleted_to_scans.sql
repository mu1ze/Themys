-- Add is_deleted column to scans table to support soft delete
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
