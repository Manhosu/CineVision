-- ============================================================================
-- Content edit approval workflow:
-- When an employee tries to edit content AFTER their edit window has expired,
-- the change goes to a queue for the master admin (Igor) to approve/reject
-- before being applied.
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changes JSONB NOT NULL,
  original_snapshot JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON content_edit_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_requests_content ON content_edit_requests(content_id);
CREATE INDEX IF NOT EXISTS idx_edit_requests_employee ON content_edit_requests(employee_id, status);

COMMENT ON TABLE content_edit_requests IS
  'Queue of content edits proposed by employees outside their edit window. Master admin reviews each before applying.';
