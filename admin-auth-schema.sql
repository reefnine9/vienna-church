-- Required for login attempt rate limiting; run in D1 Console once.
CREATE TABLE IF NOT EXISTS admin_login_attempts (
 id TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0,
 blocked_until INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_updated ON admin_login_attempts(updated_at);
