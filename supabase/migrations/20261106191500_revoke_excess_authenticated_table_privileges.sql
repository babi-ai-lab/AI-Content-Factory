-- End-user sessions need row-scoped DML only. These table-level privileges
-- bypass RLS or allow schema-level operations and are not required by the app.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

-- Keep future tables created by the migration role from inheriting these
-- unnecessary privileges by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLES
FROM anon, authenticated;
