-- People table (actors and directors)
CREATE TABLE IF NOT EXISTS people (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'actor', -- 'actor' | 'director'
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint on name+role (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_name_role ON people(lower(name), role);

-- Junction table: content <-> people
CREATE TABLE IF NOT EXISTS content_people (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'actor',
  character_name VARCHAR(255),
  display_order INT DEFAULT 0,
  UNIQUE(content_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS idx_content_people_content ON content_people(content_id);
CREATE INDEX IF NOT EXISTS idx_content_people_person ON content_people(person_id);
