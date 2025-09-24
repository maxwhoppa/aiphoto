-- Initialize the database with required extensions and setup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a test database for running tests
CREATE DATABASE aiphoto_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE aiphoto TO postgres;
GRANT ALL PRIVILEGES ON DATABASE aiphoto_test TO postgres;