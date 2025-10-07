-- Initial database setup for Cine Vision
-- This script runs when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create initial user if not exists
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cine_vision') THEN
      CREATE ROLE cine_vision LOGIN PASSWORD 'password123';
   END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cine_vision TO cine_vision;
GRANT ALL ON SCHEMA public TO cine_vision;

-- Create basic indexes for performance
-- These will be created properly by TypeORM migrations, but this ensures basic setup

-- Log the completion
INSERT INTO pg_catalog.pg_stat_statements_info VALUES (now(), 'Database initialized for Cine Vision')
ON CONFLICT DO NOTHING;