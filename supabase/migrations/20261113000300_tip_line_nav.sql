-- Header and footer links to the tip line (/mag-ulat, ADR-024). Separate from 20261113000200_tips.sql so the
-- links reach the live site only after the page is deployed. Fresh databases get them from seed.sql.
-- Rollback: delete from public.navigation_items where href = '/mag-ulat';

insert into public.navigation_items (menu_id, label, label_en, href, position)
select m.id, v.label, v.label_en, '/mag-ulat',
       (select coalesce(max(i.position), 0) + 1 from public.navigation_items i where i.menu_id = m.id)
from public.navigation_menus m
join (values ('header', 'Mag-ulat', 'Report'), ('footer_main', 'Mag-ulat ng Katiwalian', 'Report Corruption')) as v(menu_key, label, label_en)
  on v.menu_key = m.key
where not exists (select 1 from public.navigation_items i where i.menu_id = m.id and i.href = '/mag-ulat');
