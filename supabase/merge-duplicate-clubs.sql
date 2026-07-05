-- One-off cleanup (2026-07-05): merge sponsor-variant duplicate club rows into
-- one canonical row per franchise, per the CLUB_NAME_OVERRIDES design.
-- Review the ids against your clubs table, then run in the Supabase SQL editor.
-- Safe to re-run: updates are idempotent, deletes target only the dupe ids.

begin;
-- repoint stats rows at the canonical club
update player_season_stats set club_id=2  where club_id=14;            -- MINT Vero Volley Monza -> Vero Volley Monza
update player_season_stats set club_id=12 where club_id in (15,19);    -- Sir Safety Susa/Conad -> Sir Susa Perugia
update player_season_stats set club_id=9  where club_id=17;            -- Top Volley Cisterna -> Cisterna Volley
update player_season_stats set club_id=11 where club_id in (18,23);    -- WithU Verona, Verona Volley -> Rana Verona
update player_season_stats set club_id=3  where club_id=20;            -- Leo Shoes PerkinElmer Modena -> Valsa Group Modena
update player_season_stats set club_id=5  where club_id=24;            -- Kioene Padova -> Pallavolo Padova
update player_season_stats set club_id=21 where club_id=26;            -- Consar Ravenna dupe -> Consar RCM Ravenna row
update player_season_stats set club_id=22 where club_id=27;            -- Tonno Callipo dupe
update player_season_stats set club_id=16 where club_id=30;            -- Emma Villas dupe

-- canonical names / short names on the kept rows
update clubs set full_name='Consar Ravenna' where id=21;
update clubs set full_name='Tonno Callipo Vibo Valentia', short_name='Vibo Valentia' where id=22;
update clubs set full_name='Emma Villas Siena' where id=16;
update clubs set short_name='Santa Croce'  where id=46;
update clubs set short_name='San Giustino' where id=35;

-- drop the now-orphaned duplicate rows
delete from clubs where id in (14,15,17,18,19,20,23,24,26,27,30);
commit;
