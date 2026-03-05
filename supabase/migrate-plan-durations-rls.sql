-- RLS Policies for plan_durations
CREATE POLICY IF NOT EXISTS plan_durations_public_read ON plan_durations
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS plan_durations_admin_write ON plan_durations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
