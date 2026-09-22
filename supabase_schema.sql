-- =============================================================================
-- Supabase Schema for CampusConnect College Event Management System
-- Run this SQL in your Supabase project's SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in reverse dependency order if resetting
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS feedbacks CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    department VARCHAR(100) NOT NULL,
    roll_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Events Table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    time_range VARCHAR(100),
    max_capacity INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(50) NOT NULL CHECK (status IN ('upcoming', 'completed', 'cancelled')) DEFAULT 'upcoming',
    department VARCHAR(100) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Registrations Table
CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('confirmed', 'cancelled')) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_event_registration UNIQUE (user_id, event_id)
);

-- 4. Attendance Table
CREATE TABLE attendances (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('present', 'absent')) DEFAULT 'absent',
    marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_registration_attendance UNIQUE (registration_id)
);

-- 5. Feedback Table
CREATE TABLE feedbacks (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_event_feedback UNIQUE (user_id, event_id)
);

-- 6. Announcements Table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Urgent', 'General', 'Event Update')) DEFAULT 'General',
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_attendances_reg ON attendances(registration_id);
CREATE INDEX idx_feedbacks_event ON feedbacks(event_id);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and anon users (handled by backend API / service role)
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read registrations" ON registrations FOR SELECT USING (true);
CREATE POLICY "Public read attendances" ON attendances FOR SELECT USING (true);
CREATE POLICY "Public read feedbacks" ON feedbacks FOR SELECT USING (true);
CREATE POLICY "Public read announcements" ON announcements FOR SELECT USING (true);

-- Allow full access for backend service role key
CREATE POLICY "Service full users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full registrations" ON registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full attendances" ON attendances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full feedbacks" ON feedbacks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);
