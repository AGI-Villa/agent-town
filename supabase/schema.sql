-- Agent Town Database Schema
-- Run this in your Supabase SQL Editor

-- Events table: raw events from agent log watcher
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Moments table: LLM-generated social posts
CREATE TABLE moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  emotion TEXT,
  trigger_event_id UUID REFERENCES events(id),
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comments table: user/agent comments on moments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID REFERENCES moments(id),
  author_type TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_events_agent_id ON events(agent_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_moments_agent_id ON moments(agent_id);
CREATE INDEX idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX idx_comments_moment_id ON comments(moment_id);

-- Row Level Security (enable later when auth is set up)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Public read policies (adjust as needed)
CREATE POLICY "Allow public read on events" ON events FOR SELECT USING (true);
CREATE POLICY "Allow public read on moments" ON moments FOR SELECT USING (true);
CREATE POLICY "Allow public read on comments" ON comments FOR SELECT USING (true);

-- Service role insert policies (for watcher service)
CREATE POLICY "Allow service insert on events" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert on moments" ON moments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert on comments" ON comments FOR INSERT WITH CHECK (true);

-- Service role update for likes
CREATE POLICY "Allow service update on moments" ON moments FOR UPDATE USING (true);

-- Notifications table: important events that need user attention
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  event_id UUID REFERENCES events(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_agent_id ON notifications(agent_id);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow service insert on notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on notifications" ON notifications FOR UPDATE USING (true);
