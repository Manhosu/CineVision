-- Migration: Create Series and Episodes tables
-- Description: Creates tables for TV series and episodes with full Stripe and S3 integration
-- Date: 2025-01-01

-- Create Series table
CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    synopsis TEXT,
    cover_url VARCHAR(1000),
    poster_url VARCHAR(1000),
    backdrop_url VARCHAR(1000),
    banner_url VARCHAR(1000),
    trailer_url VARCHAR(1000),

    -- Pricing
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    price_per_episode BOOLEAN DEFAULT FALSE,

    -- Stripe integration
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    -- Storage keys
    cover_storage_key VARCHAR(500),
    trailer_storage_key VARCHAR(500),

    -- Sales tracking
    weekly_sales INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,

    -- Metadata
    release_year INTEGER,
    director VARCHAR(255),
    cast TEXT,
    genres TEXT,
    imdb_rating DECIMAL(3,1),
    total_seasons INTEGER DEFAULT 1,
    total_episodes INTEGER DEFAULT 0,

    -- Status and availability
    availability VARCHAR(20) DEFAULT 'both',
    status VARCHAR(20) DEFAULT 'DRAFT',
    is_featured BOOLEAN DEFAULT FALSE,
    views_count INTEGER DEFAULT 0,
    purchases_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create Episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,
    description TEXT,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,

    thumbnail_url VARCHAR(1000),
    video_url VARCHAR(1000),

    -- Individual pricing (optional)
    price_cents INTEGER,
    currency VARCHAR(3) DEFAULT 'BRL',
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    duration_minutes INTEGER,

    -- Storage and streaming
    storage_path VARCHAR(1000),
    file_storage_key VARCHAR(500),
    original_file_path VARCHAR(1000),
    hls_master_url VARCHAR(1000),
    hls_base_path VARCHAR(500),

    -- Processing
    processing_status VARCHAR(20) DEFAULT 'pending',
    processing_progress INTEGER,
    available_qualities TEXT,
    file_size_bytes BIGINT,
    video_codec VARCHAR(50),
    audio_codec VARCHAR(50),
    bitrate_kbps INTEGER,
    width INTEGER,
    height INTEGER,
    frame_rate DECIMAL(5,2),
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,

    views_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT unique_series_episode UNIQUE(series_id, season_number, episode_number)
);

-- Create series_categories junction table
CREATE TABLE IF NOT EXISTS series_categories (
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    PRIMARY KEY (series_id, category_id)
);

-- Create indexes for Series
CREATE INDEX IF NOT EXISTS idx_series_title_search ON series USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_series_status_created ON series(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_popularity ON series(is_featured DESC, views_count DESC, purchases_count DESC);
CREATE INDEX IF NOT EXISTS idx_series_stripe_product ON series(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_series_sales ON series(weekly_sales DESC, total_sales DESC);

-- Create indexes for Episodes
CREATE INDEX IF NOT EXISTS idx_episode_series_season_number ON episodes(series_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_episode_processing_status ON episodes(processing_status);
CREATE INDEX IF NOT EXISTS idx_episode_stripe_product ON episodes(stripe_product_id);

-- Create function to auto-update total_episodes count
CREATE OR REPLACE FUNCTION update_series_episode_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE series SET total_episodes = total_episodes + 1 WHERE id = NEW.series_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE series SET total_episodes = total_episodes - 1 WHERE id = OLD.series_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for episode count
CREATE TRIGGER trigger_update_episode_count
AFTER INSERT OR DELETE ON episodes
FOR EACH ROW EXECUTE FUNCTION update_series_episode_count();

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_series_updated_at
BEFORE UPDATE ON series
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_episodes_updated_at
BEFORE UPDATE ON episodes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE series IS 'TV Series with Stripe integration and sales tracking';
COMMENT ON TABLE episodes IS 'Episodes belonging to series with individual HLS streaming support';
COMMENT ON COLUMN series.price_per_episode IS 'If true, each episode is sold individually';
COMMENT ON COLUMN episodes.stripe_product_id IS 'Stripe Product ID (only if sold individually)';
