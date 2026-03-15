-- Prevent negative/zero values on invoice_items that could be injected
-- via crafted API requests.
-- Using NOT VALID + VALIDATE CONSTRAINT to avoid full table lock and
-- safely handle any pre-existing rows.

ALTER TABLE invoice_items
  ADD CONSTRAINT chk_invoice_items_positive_price
  CHECK (unit_price_minor >= 0) NOT VALID;

ALTER TABLE invoice_items
  ADD CONSTRAINT chk_invoice_items_positive_amount
  CHECK (amount_minor >= 0) NOT VALID;

ALTER TABLE invoice_items
  ADD CONSTRAINT chk_invoice_items_positive_quantity
  CHECK (quantity > 0) NOT VALID;

-- Validate existing rows (takes ShareUpdateExclusiveLock, not AccessExclusive)
ALTER TABLE invoice_items VALIDATE CONSTRAINT chk_invoice_items_positive_price;
ALTER TABLE invoice_items VALIDATE CONSTRAINT chk_invoice_items_positive_amount;
ALTER TABLE invoice_items VALIDATE CONSTRAINT chk_invoice_items_positive_quantity;
