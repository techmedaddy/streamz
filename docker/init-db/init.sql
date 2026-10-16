-- Create databases for each service
CREATE DATABASE orders_db;
CREATE DATABASE inventory_db;
CREATE DATABASE notifications_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE orders_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE inventory_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE notifications_db TO postgres;
