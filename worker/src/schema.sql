-- Jobs table for the pipeline state machine
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'parsing', 'extracting', 'translating', 'rendering', 'complete', 'failed')),
  original_filename VARCHAR(500),
  company_name VARCHAR(255),
  target_language VARCHAR(5) DEFAULT 'en',
  file_path TEXT,
  extracted_text TEXT,
  extraction_json JSONB,
  translated_json JSONB,
  report_path TEXT,
  report_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for worker polling
CREATE INDEX IF NOT EXISTS idx_jobs_state_created
  ON jobs(state, created_at);

-- Translation cache
CREATE TABLE IF NOT EXISTS translation_cache (
  source_text TEXT NOT NULL,
  source_language VARCHAR(5) NOT NULL,
  target_language VARCHAR(5) NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_text, source_language, target_language)
);
