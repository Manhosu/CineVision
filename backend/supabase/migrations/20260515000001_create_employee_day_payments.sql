-- Igor (15/05): controle de pagamento por dia dos funcionários.
-- Igor paga por dia (cada filme/série upado conta) e quer marcar visualmente
-- na aba de produtividade quais dias já foram pagos.

CREATE TABLE IF NOT EXISTS employee_day_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT NOW(),
  paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
  amount_cents integer,
  notes text,
  CONSTRAINT employee_day_payments_unique UNIQUE (employee_id, payment_date)
);

COMMENT ON TABLE employee_day_payments IS
  'Marca dias da produtividade de um funcionário como pagos (verde no admin).';

CREATE INDEX IF NOT EXISTS idx_employee_day_payments_employee
  ON employee_day_payments(employee_id, payment_date DESC);

-- RLS: só admins manipulam.
ALTER TABLE employee_day_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_full_access ON employee_day_payments;
CREATE POLICY admins_full_access ON employee_day_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role::text = 'admin')
  );
