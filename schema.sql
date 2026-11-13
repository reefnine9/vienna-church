-- Vienna Korean Methodist Church bulletin database (Cloudflare D1)
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS bulletins (
 id TEXT PRIMARY KEY,
 sunday_date TEXT NOT NULL UNIQUE,
 service_time TEXT NOT NULL DEFAULT '12:00',
 sermon_title TEXT NOT NULL DEFAULT '',
 scripture_reference TEXT NOT NULL DEFAULT '',
 preacher TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 published_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS worship_items (
 id TEXT PRIMARY KEY,
 bulletin_id TEXT NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 title TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 kind TEXT NOT NULL DEFAULT 'text',
 standing INTEGER NOT NULL DEFAULT 0 CHECK(standing IN (0,1)),
 UNIQUE(bulletin_id,position)
);
CREATE TABLE IF NOT EXISTS annual_schedule (
 id TEXT PRIMARY KEY,
 sunday_date TEXT NOT NULL,
 slot TEXT NOT NULL CHECK(slot IN ('opening_hymn','hymn','responsive_reading','offertory_hymn','prayer_leader','choir','custom')),
 value TEXT NOT NULL DEFAULT '',
 UNIQUE(sunday_date,slot)
);
CREATE TABLE IF NOT EXISTS announcements (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 starts_on TEXT NOT NULL,
 ends_on TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_bulletins_status_date ON bulletins(status,sunday_date);
CREATE INDEX IF NOT EXISTS idx_worship_items_bulletin ON worship_items(bulletin_id,position);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON announcements(active,starts_on,ends_on);
