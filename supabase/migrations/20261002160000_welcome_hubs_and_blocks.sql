CREATE TABLE IF NOT EXISTS welcome_hubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  guide_id     uuid REFERENCES guides(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT '',
  intro        text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT unique_company_guide_hub UNIQUE (company_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_welcome_hubs_lookup ON welcome_hubs(company_id, guide_id);

CREATE TABLE IF NOT EXISTS welcome_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES welcome_hubs(id) ON DELETE CASCADE,
  block_type    text NOT NULL,
  display_order int4 NOT NULL DEFAULT 0,
  content       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welcome_blocks_hub ON welcome_blocks(hub_id, display_order);

ALTER TABLE welcome_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_welcome_hubs" ON welcome_hubs FOR SELECT USING (true);
CREATE POLICY "public_read_welcome_blocks" ON welcome_blocks FOR SELECT USING (true);

CREATE POLICY "admin_company_manage_welcome_hubs" ON welcome_hubs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.company_id = welcome_hubs.company_id)
    )
  );

CREATE POLICY "admin_company_manage_welcome_blocks" ON welcome_blocks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM welcome_hubs
      JOIN profiles ON (profiles.role = 'admin' OR profiles.company_id = welcome_hubs.company_id)
      WHERE welcome_hubs.id = welcome_blocks.hub_id AND profiles.id = auth.uid()
    )
  );
