BEGIN;

INSERT INTO depreciation_rule (asset_name, category_id, life_years)
SELECT v.asset_name, ac.id, (v.life_years)::int
FROM (VALUES
  ('Desktop Computer',  'COMPUTER',   5),
  ('Laptop',            'COMPUTER',   5),
  ('Printer',           'COMPUTER',   5),
  ('Steel Almirah',     'FURNITURE',  15),
  ('Wooden Table',      'FURNITURE',  10),
  ('Physics Equipment', 'OTHER',      10),
  ('Library Books',     'LIBRARY',    10),
  ('Air Conditioner',   'OFFICE_EQ',  10),
  ('Photocopier',       'OFFICE_EQ',  7)
) AS v(asset_name, cat_code, life_years)
JOIN asset_category ac ON ac.code = v.cat_code
WHERE NOT EXISTS (
  SELECT 1 FROM depreciation_rule dr WHERE dr.asset_name = v.asset_name
);

COMMIT;
