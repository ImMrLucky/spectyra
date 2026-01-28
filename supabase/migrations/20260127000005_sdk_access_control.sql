-- Migration: SDK Access Control
-- Adds SDK access control to organizations

-- Add SDK access flag to orgs table
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS sdk_access_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_sdk_access ON orgs(sdk_access_enabled) WHERE sdk_access_enabled = true;

-- Add comment
COMMENT ON COLUMN orgs.sdk_access_enabled IS 'Controls whether this organization can use the SDK (agent endpoints)';
