-- Survey candidate photos can be repositioned (client request 2026-11-19): which part of the photo the card frame shows.
--   photo_x, photo_y : focal point as a percentage of the photo (CSS object-position), 0-100. Defaults 50 / 0 reproduce how
--                      every existing card is framed today (centred, from the top).
--   photo_zoom       : magnification in percent around that point, 100 (fit the frame) to 300.
-- Rollback: alter table public.survey_entries drop column photo_x, drop column photo_y, drop column photo_zoom;
alter table public.survey_entries
  add column photo_x smallint not null default 50 check (photo_x between 0 and 100),
  add column photo_y smallint not null default 0 check (photo_y between 0 and 100),
  add column photo_zoom smallint not null default 100 check (photo_zoom between 100 and 300);
