-- SQLite 3.35+ reversible migration for development rollback only.
ALTER TABLE duplicate_candidates DROP COLUMN degraded_similarity;
ALTER TABLE duplicate_candidates DROP COLUMN canonical_text_version;
ALTER TABLE duplicate_candidates DROP COLUMN embedding_dimension;
ALTER TABLE duplicate_candidates DROP COLUMN embedding_model;
ALTER TABLE duplicate_candidates DROP COLUMN similarity_provider;
ALTER TABLE duplicate_candidates DROP COLUMN similarity_classification;
DROP TABLE request_embeddings;
DELETE FROM schema_migrations WHERE version='002_semantic_embeddings.sql';
