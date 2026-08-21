CREATE TABLE request_embeddings (
  content_hash TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  canonical_text_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);

ALTER TABLE duplicate_candidates ADD COLUMN similarity_classification TEXT NOT NULL DEFAULT 'separate_request';
ALTER TABLE duplicate_candidates ADD COLUMN similarity_provider TEXT NOT NULL DEFAULT 'lexical';
ALTER TABLE duplicate_candidates ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'lexical-explainable-v1';
ALTER TABLE duplicate_candidates ADD COLUMN embedding_dimension INTEGER NOT NULL DEFAULT 768;
ALTER TABLE duplicate_candidates ADD COLUMN canonical_text_version TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE duplicate_candidates ADD COLUMN degraded_similarity INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_embeddings_request ON request_embeddings(request_id, created_at);
CREATE INDEX idx_embeddings_provider_model ON request_embeddings(provider, embedding_model, embedding_dimension);
