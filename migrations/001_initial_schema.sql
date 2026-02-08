-- Team File Manager Database Schema
-- PostgreSQL 14+

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'tim');
CREATE TYPE file_status AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'DONE', 'FAILED');

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'tim',
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Files table
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    original_path VARCHAR(1000),
    final_path VARCHAR(1000),
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    processed_size_bytes BIGINT,
    status file_status NOT NULL DEFAULT 'PENDING_UPLOAD',
    direct_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Processing logs table
CREATE TABLE processing_logs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_files_team_id ON files(team_id);
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
CREATE INDEX idx_processing_logs_file_id ON processing_logs(file_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default teams
INSERT INTO teams (name) VALUES 
    ('Team Alpha'),
    ('Team Beta'),
    ('Team Gamma');

-- Insert default users (passwords are plain text for dev only - in production use bcrypt)
-- admin/admin - can access all teams
-- tim/tim - belongs to Team Alpha
INSERT INTO users (username, password, role, team_id) VALUES 
    ('admin', 'admin', 'admin', NULL),
    ('tim', 'tim', 'tim', 1);

-- Comments for documentation
COMMENT ON TABLE teams IS 'Teams that can upload and manage files';
COMMENT ON TABLE users IS 'User accounts with role-based access';
COMMENT ON TABLE files IS 'File metadata and processing status';
COMMENT ON TABLE processing_logs IS 'History of file processing attempts';
COMMENT ON COLUMN files.direct_link IS 'Permanent R2 public URL - never expires';
COMMENT ON COLUMN files.status IS 'File processing state machine';
