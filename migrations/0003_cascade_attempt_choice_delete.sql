-- Ensure deleting/replacing choices during MCQ update does not fail when
-- preview attempts still reference those choice rows.
PRAGMA foreign_keys = OFF;

CREATE TABLE mcq_attempts_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id) ON DELETE CASCADE
);

INSERT INTO mcq_attempts_new (id, mcq_id, choice_id, is_correct, created_at)
SELECT id, mcq_id, choice_id, is_correct, created_at
FROM mcq_attempts;

DROP TABLE mcq_attempts;

ALTER TABLE mcq_attempts_new RENAME TO mcq_attempts;

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts(mcq_id);

PRAGMA foreign_keys = ON;
