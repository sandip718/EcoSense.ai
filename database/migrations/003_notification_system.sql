-- Migration: 003_notification_system.sql
-- Description: Create notification rules and alerts tables for real-time notification system
-- Created: 2024-01-01

BEGIN;

-- Create notification rules table for user preferences
CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    radius DECIMAL(10,2) NOT NULL DEFAULT 5.0, -- radius in kilometers
    triggers JSONB NOT NULL DEFAULT '{}',
    delivery_methods TEXT[] NOT NULL DEFAULT '{"push"}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification rules
CREATE INDEX idx_notification_rules_user_id ON notification_rules (user_id);
CREATE INDEX idx_notification_rules_location ON notification_rules USING GIST (location);
CREATE INDEX idx_notification_rules_active ON notification_rules (active);

-- Create alerts table for generated alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('health_warning', 'trend_alert', 'community_update', 'threshold_breach')),
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    affected_radius DECIMAL(10,2) NOT NULL DEFAULT 1.0,
    pollutant VARCHAR(50),
    current_value DECIMAL(10,4),
    threshold_value DECIMAL(10,4),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for alerts
CREATE INDEX idx_alerts_type ON alerts (type);
CREATE INDEX idx_alerts_severity ON alerts (severity);
CREATE INDEX idx_alerts_location ON alerts USING GIST (location);
CREATE INDEX idx_alerts_created_at ON alerts (created_at);
CREATE INDEX idx_alerts_expires_at ON alerts (expires_at);
CREATE INDEX idx_alerts_pollutant ON alerts (pollutant);

-- Create user device tokens table for push notifications
CREATE TABLE user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for device tokens
CREATE INDEX idx_user_device_tokens_user_id ON user_device_tokens (user_id);
CREATE INDEX idx_user_device_tokens_active ON user_device_tokens (active);
CREATE UNIQUE INDEX idx_user_device_tokens_unique ON user_device_tokens (user_id, device_token);

-- Create notification delivery log table
CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('push', 'email', 'sms')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification deliveries
CREATE INDEX idx_notification_deliveries_alert_id ON notification_deliveries (alert_id);
CREATE INDEX idx_notification_deliveries_user_id ON notification_deliveries (user_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries (status);
CREATE INDEX idx_notification_deliveries_created_at ON notification_deliveries (created_at);

-- Add trigger for notification rules updated_at
CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for user device tokens updated_at
CREATE TRIGGER update_user_device_tokens_updated_at BEFORE UPDATE ON user_device_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;