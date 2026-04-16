-- Add audio_type column to content table
-- Values: 'dubbed', 'subtitled', 'dubbed_subtitled'
ALTER TABLE content ADD COLUMN IF NOT EXISTS audio_type text;
