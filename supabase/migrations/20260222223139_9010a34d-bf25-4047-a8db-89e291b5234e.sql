-- RES-003: Add FK constraint on resource_shares.shared_by with ON DELETE SET NULL
ALTER TABLE public.resource_shares ALTER COLUMN shared_by DROP NOT NULL;

ALTER TABLE public.resource_shares
  ADD CONSTRAINT resource_shares_shared_by_fkey
  FOREIGN KEY (shared_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;