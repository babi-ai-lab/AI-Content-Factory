-- Keep future tables created by the migration role from inheriting these
-- unnecessary privileges by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLES
FROM anon, authenticated;
