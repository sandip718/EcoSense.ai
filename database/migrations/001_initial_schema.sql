-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema with PostGIS support
-- Created: 2024-01-01

BEGIN;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create environmental measurements table
CREATE TABLE environmental_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    pollutant VARCHAR(50) NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    address TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    quality_grade CHAR(1) CHECK (quality_grade IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for efficient location queries
CREATE INDEX idx_environmental_data_location ON environmental_data USING GIST (location);
CREATE INDEX idx_environmental_data_timestamp ON environmental_data (timestamp);
CREATE INDEX idx_environmental_data_pollutant ON environmental_data (pollutant);
CREATE INDEX idx_environmental_data_source ON environmental_data (source);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    location GEOMETRY(POINT, 4326),
    preferences JSONB DEFAULT '{}',
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    badges TEXT[] DEFAULT '{}',
    contribution_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_location ON users USING GIST (location);

-- Create image analyses table
CREATE TABLE image_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    location GEOMETRY(POINT, 4326),
    upload_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    analysis_results JSONB NOT NULL,
    overall_score DECIMAL(3,2) CHECK (overall_score >= 0 AND overall_score <= 1),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for image analyses
CREATE INDEX idx_image_analyses_user_id ON image_analyses (user_id);
CREATE INDEX idx_image_analyses_location ON image_analyses USING GIST (location);
CREATE INDEX idx_image_analyses_status ON image_analyses (status);
CREATE INDEX idx_image_analyses_timestamp ON image_analyses (upload_timestamp);

-- Create community actions table
CREATE TABLE community_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    location GEOMETRY(POINT, 4326),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    points_earned INTEGER DEFAULT 0,
    impact_description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for community actions
CREATE INDEX idx_community_actions_user_id ON community_actions (user_id);
CREATE INDEX idx_community_actions_location ON community_actions USING GIST (location);
CREATE INDEX idx_community_actions_type ON community_actions (action_type);
CREATE INDEX idx_community_actions_timestamp ON community_actions (timestamp);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    location GEOMETRY(POINT, 4326),
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_type ON notifications (type);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);
CREATE INDEX idx_notifications_read_at ON notifications (read_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;