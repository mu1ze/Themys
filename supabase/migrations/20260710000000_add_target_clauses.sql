-- Supabase Migration: 20260710000000_add_target_clauses
-- Adds target_clauses and strict_mode to users table
-- Adds is_standard_practice and is_target_clause to clauses table

ALTER TABLE users 
  ADD COLUMN target_clauses TEXT[] DEFAULT '{}',
  ADD COLUMN strict_mode BOOLEAN DEFAULT false;

ALTER TABLE clauses
  ADD COLUMN is_standard_practice BOOLEAN DEFAULT false,
  ADD COLUMN is_target_clause BOOLEAN DEFAULT false;
