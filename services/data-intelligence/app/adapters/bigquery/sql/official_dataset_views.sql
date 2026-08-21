-- Replace {{PROJECT_ID}} and {{DATASET}} before execution.
CREATE OR REPLACE VIEW `{{PROJECT_ID}}.{{DATASET}}.current_data_sources` AS
SELECT * FROM `{{PROJECT_ID}}.{{DATASET}}.data_sources`
WHERE is_current=TRUE AND synthetic=FALSE;

CREATE OR REPLACE VIEW `{{PROJECT_ID}}.{{DATASET}}.current_admin_units` AS
SELECT units.* FROM `{{PROJECT_ID}}.{{DATASET}}.admin_units` units
JOIN `{{PROJECT_ID}}.{{DATASET}}.current_data_sources` sources USING(source_id,snapshot_id,dataset_version);

CREATE OR REPLACE VIEW `{{PROJECT_ID}}.{{DATASET}}.current_demographic_features` AS
SELECT features.* FROM `{{PROJECT_ID}}.{{DATASET}}.demographic_features` features
JOIN `{{PROJECT_ID}}.{{DATASET}}.current_data_sources` sources USING(source_id,snapshot_id,dataset_version);

CREATE OR REPLACE VIEW `{{PROJECT_ID}}.{{DATASET}}.current_infrastructure_indices` AS
SELECT features.* FROM `{{PROJECT_ID}}.{{DATASET}}.infrastructure_indices` features
JOIN `{{PROJECT_ID}}.{{DATASET}}.current_data_sources` sources USING(source_id,snapshot_id,dataset_version);

CREATE OR REPLACE VIEW `{{PROJECT_ID}}.{{DATASET}}.current_investment_projects` AS
SELECT projects.* FROM `{{PROJECT_ID}}.{{DATASET}}.investment_projects` projects
JOIN `{{PROJECT_ID}}.{{DATASET}}.current_data_sources` sources USING(source_id,snapshot_id,dataset_version);
