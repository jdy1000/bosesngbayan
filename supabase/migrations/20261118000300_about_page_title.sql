-- About page heading (client request 2026-11-18): "Tungkol sa Boses ng Bayan" -> "Boses ng Bayan".
-- Data only; idempotent; changes the title only while it still holds the starter text, so an edited title is left alone.
-- Rollback: update public.pages set title = 'Tungkol sa Boses ng Bayan' where slug = 'tungkol' and title = 'Boses ng Bayan';
update public.pages set title = 'Boses ng Bayan' where slug = 'tungkol' and title = 'Tungkol sa Boses ng Bayan';
