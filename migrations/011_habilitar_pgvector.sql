-- Migration 011: Habilitar pgvector para busca vetorial (RAG)
-- Necessario para embeddings de documentos de contrato

CREATE EXTENSION IF NOT EXISTS vector;
