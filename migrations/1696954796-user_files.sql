-- Migration: user_files
-- Created at: 2023-10-10 10:19:56
-- ====  UP  ====

BEGIN;
  CREATE TABLE IF NOT EXISTS user_files (
    id serial PRIMARY KEY,
    "order" int DEFAULT 100,
    oidc_subject text NOT NULL,
    filename text NOT NULL,
    s3_key text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    deleted_at timestamp with time zone, -- someone's gonna delete something accidentally at some point
    shared_at timestamp with time zone
  );

  COMMENT ON TABLE user_files IS 'private files uploaded by logged in users';

COMMIT;

-- ==== DOWN ====

BEGIN;
  DROP TABLE user_files;
COMMIT;
