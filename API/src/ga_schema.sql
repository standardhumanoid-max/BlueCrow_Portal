-- update_updated_at function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tenancies_updated_at
  BEFORE UPDATE ON tenancies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER asset_files_updated_at
  BEFORE UPDATE ON asset_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indices
CREATE INDEX ON assets (spv);
CREATE INDEX ON assets (status);
CREATE INDEX ON assets (sector);
CREATE INDEX ON valuations (asset_id);
CREATE INDEX ON bovs (asset_id);
CREATE INDEX ON notes (asset_id);
CREATE INDEX ON tenancies (asset_id);
CREATE INDEX ON asset_files (asset_id);

-- History table
CREATE TABLE IF NOT EXISTS _row_history (
  id         bigserial PRIMARY KEY,
  tbl        text NOT NULL,
  row_id     text NOT NULL,
  row_data   jsonb NOT NULL,
  changed_at timestamptz DEFAULT now()
);
CREATE INDEX ON _row_history (tbl, row_id);
CREATE INDEX ON _row_history (changed_at);

CREATE OR REPLACE FUNCTION _save_row_history()
RETURNS trigger AS $$
BEGIN
  INSERT INTO _row_history (tbl, row_id, row_data)
  VALUES (TG_TABLE_NAME, OLD.id::text, row_to_json(OLD));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_history_assets
  BEFORE DELETE OR UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION _save_row_history();

CREATE TRIGGER trg_history_valuations
  BEFORE DELETE OR UPDATE ON valuations
  FOR EACH ROW EXECUTE FUNCTION _save_row_history();

CREATE TRIGGER trg_history_bovs
  BEFORE DELETE OR UPDATE ON bovs
  FOR EACH ROW EXECUTE FUNCTION _save_row_history();

CREATE TRIGGER trg_history_tenancies
  BEFORE DELETE OR UPDATE ON tenancies
  FOR EACH ROW EXECUTE FUNCTION _save_row_history();

CREATE TRIGGER trg_history_asset_files
  BEFORE DELETE OR UPDATE ON asset_files
  FOR EACH ROW EXECUTE FUNCTION _save_row_history();
