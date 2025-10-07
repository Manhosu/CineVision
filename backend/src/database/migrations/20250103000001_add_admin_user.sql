-- =====================================================
-- ADD ADMIN USER TO DATABASE
-- Email: adm@cinevision.com.br
-- Password: Admin123
-- =====================================================

-- Insert or update admin user
INSERT INTO users (
  id,
  name,
  email,
  password,
  role,
  status,
  blocked,
  email_verified_at,
  created_at,
  updated_at
) VALUES (
  'admin-cinevision-2025-0000-000000000001',
  'Administrador CineVision',
  'adm@cinevision.com.br',
  -- Password: Admin123 (hashed with bcrypt rounds=12)
  '$2b$12$RkZ492rLZOf4bkLDj61kyOtgJyvguKUHZnYmUSeYN60GU9IZ9a2vK',
  'admin',
  'active',
  false,
  CURRENT_TIMESTAMP, -- Email já verificado
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (email)
DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  blocked = EXCLUDED.blocked,
  email_verified_at = EXCLUDED.email_verified_at,
  updated_at = CURRENT_TIMESTAMP;

-- Log da criação do admin
INSERT INTO system_logs (
  type,
  level,
  message,
  meta,
  created_at
) VALUES (
  'auth',
  'info',
  'Admin user created/updated: adm@cinevision.com.br',
  '{"email": "adm@cinevision.com.br", "role": "admin", "migration": "20250103000001"}'::jsonb,
  CURRENT_TIMESTAMP
);
