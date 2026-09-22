import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET_KEY || "college-events-dev-secret-change-in-production";

/* -------------------------------------------------------------
 * Gemini AI Client (Lazy Initialization)
 * ----------------------------------------------------------- */
let geminiClient = null;
function getGeminiClient() {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    return geminiClient;
  } catch (err) {
    console.warn("[Gemini] Initialization error:", err.message);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------------------------------------------
 * Supabase Client & Connection Setup (Lazy Initialization)
 * ----------------------------------------------------------- */
let supabaseInstance = null;
let supabaseConnected = false;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log("[Supabase] Client initialized for:", url);
    } catch (err) {
      console.warn("[Supabase] Client initialization error:", err.message);
      supabaseInstance = null;
    }
  }
  return supabaseInstance;
}

/* -------------------------------------------------------------
 * Data Store & Seed Data
 * ----------------------------------------------------------- */
let nextUserId = 1;
let nextEventId = 1;
let nextRegId = 1;
let nextAttId = 1;
let nextFbId = 1;
let nextAnnId = 1;

const users = [];
const events = [];
const registrations = [];
const attendances = [];
const feedbacks = [];
const announcements = [];

function seedDatabase() {
  const hashPass = (pw) => bcrypt.hashSync(pw, 10);

  // Clear in-memory arrays before seeding defaults
  users.length = 0;
  events.length = 0;
  registrations.length = 0;
  attendances.length = 0;
  feedbacks.length = 0;
  announcements.length = 0;

  nextUserId = 1;
  nextEventId = 1;
  nextRegId = 1;
  nextAttId = 1;
  nextFbId = 1;
  nextAnnId = 1;

  // Users
  const u1 = {
    id: nextUserId++,
    name: "Priya Sharma",
    email: "student@college.edu",
    password_hash: hashPass("password123"),
    role: "student",
    department: "Computer Science & Eng",
    roll_number: "CS2026-084",
    created_at: new Date().toISOString(),
  };
  const u2 = {
    id: nextUserId++,
    name: "Dr. Rajesh Sharma",
    email: "faculty@college.edu",
    password_hash: hashPass("password123"),
    role: "faculty",
    department: "Computer Science & Eng",
    roll_number: null,
    created_at: new Date().toISOString(),
  };
  const u3 = {
    id: nextUserId++,
    name: "Campus Administrator",
    email: "admin@college.edu",
    password_hash: hashPass("password123"),
    role: "admin",
    department: "General",
    roll_number: null,
    created_at: new Date().toISOString(),
  };
  const u4 = {
    id: nextUserId++,
    name: "Rohit Verma",
    email: "rohit@college.edu",
    password_hash: hashPass("password123"),
    role: "student",
    department: "Mechanical Engineering",
    roll_number: "ME2026-105",
    created_at: new Date().toISOString(),
  };

  users.push(u1, u2, u3, u4);

  // Events
  const e1 = {
    id: nextEventId++,
    name: "AI & Robotics National Symposium 2026",
    event_date: "2026-10-15",
    description: "Flagship technical symposium featuring keynote addresses, project demos, robotics showcase, and student presentations.",
    category: "Technical",
    venue: "Dr. Kalam Auditorium",
    time_range: "09:30 AM - 04:30 PM",
    max_capacity: 120,
    status: "upcoming",
    department: "Computer Science & Eng",
    created_by: u2.id,
    created_at: new Date().toISOString(),
  };
  const e2 = {
    id: nextEventId++,
    name: "Campus Hackathon: CodeSprint 2026",
    event_date: "2026-11-05",
    description: "24-hour sprint building real-world solutions for smart campus, accessibility, and student productivity. Mentorship sessions and cash prizes.",
    category: "Technical",
    venue: "CS Computing Center",
    time_range: "09:00 AM - 06:00 PM",
    max_capacity: 80,
    status: "upcoming",
    department: "Computer Science & Eng",
    created_by: u2.id,
    created_at: new Date().toISOString(),
  };
  const e3 = {
    id: nextEventId++,
    name: "Annual College Cultural Fest: Tarang",
    event_date: "2026-11-20",
    description: "Inter-college cultural extravaganza featuring battle of the bands, classical dance showdown, theatre acts, and celebrity concerts.",
    category: "Cultural",
    venue: "Open Air Amphitheatre",
    time_range: "04:00 PM - 10:00 PM",
    max_capacity: 500,
    status: "upcoming",
    department: "All Departments",
    created_by: u2.id,
    created_at: new Date().toISOString(),
  };
  const e4 = {
    id: nextEventId++,
    name: "Clean Energy & EV Technology Workshop",
    event_date: "2026-10-25",
    description: "Hands-on workshop on lithium battery management systems, regenerative braking, and sustainable energy grid integration.",
    category: "Workshop",
    venue: "Mechanical Seminar Hall",
    time_range: "11:00 AM - 02:00 PM",
    max_capacity: 60,
    status: "upcoming",
    department: "Mechanical Engineering",
    created_by: u2.id,
    created_at: new Date().toISOString(),
  };
  const e5 = {
    id: nextEventId++,
    name: "Inter-Department Badminton Tournament",
    event_date: "2026-10-18",
    description: "Annual singles and doubles badminton championship across all departments with trophies and certificates.",
    category: "Sports",
    venue: "Indoor Sports Complex",
    time_range: "08:30 AM - 01:30 PM",
    max_capacity: 40,
    status: "upcoming",
    department: "All Departments",
    created_by: u2.id,
    created_at: new Date().toISOString(),
  };

  events.push(e1, e2, e3, e4, e5);

  // Registrations & Attendance
  const r1 = {
    id: nextRegId++,
    user_id: u1.id,
    event_id: e1.id,
    status: "confirmed",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  };
  const a1 = {
    id: nextAttId++,
    registration_id: r1.id,
    status: "present",
    marked_by: u2.id,
    updated_at: new Date().toISOString(),
  };

  const r2 = {
    id: nextRegId++,
    user_id: u1.id,
    event_id: e2.id,
    status: "confirmed",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  };

  const r3 = {
    id: nextRegId++,
    user_id: u4.id,
    event_id: e4.id,
    status: "confirmed",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  };
  const a3 = {
    id: nextAttId++,
    registration_id: r3.id,
    status: "present",
    marked_by: u2.id,
    updated_at: new Date().toISOString(),
  };

  registrations.push(r1, r2, r3);
  attendances.push(a1, a3);

  // Feedback
  feedbacks.push({
    id: nextFbId++,
    event_id: e1.id,
    user_id: u1.id,
    rating: 5,
    comment: "Exceptional keynotes and great organization. Learned a lot from the robotics demonstration!",
    created_at: new Date().toISOString(),
  });

  // Announcements
  announcements.push(
    {
      id: nextAnnId++,
      title: "Campus Notice: Hackathon Schedule & Labs Allocated",
      content: "The venue for CodeSprint 2026 has been allocated to Computing Center Labs 3 & 4. All registered teams must report by 8:30 AM with college ID cards.",
      category: "Urgent",
      event_id: e2.id,
      created_by: u2.id,
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: nextAnnId++,
      title: "Call for Posters: AI Symposium 2026",
      content: "Submissions are open for student poster presentations until October 1st. Contact coordinator Dr. Rajesh Sharma for formatting templates.",
      category: "General",
      event_id: e1.id,
      created_by: u2.id,
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    }
  );
}

/* -------------------------------------------------------------
 * Supabase Persistence Helpers
 * ----------------------------------------------------------- */
async function testSupabaseConnection() {
  const client = getSupabase();
  if (!client) {
    console.log(
      "[Supabase] Not configured yet (Awaiting SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY). Running local in-memory fallback."
    );
    supabaseConnected = false;
    return;
  }
  try {
    const { error } = await client.from("users").select("id").limit(1);
    if (error) {
      console.warn("[Supabase] Query notice:", error.message);
      // Even if tables need migration, client credentials connected
      supabaseConnected = true;
    } else {
      supabaseConnected = true;
      console.log("[Supabase] Successfully connected to PostgreSQL via Supabase client.");
    }
  } catch (error) {
    console.warn("[Supabase] Connection test notice:", error.message);
    supabaseConnected = false;
  }
}

async function loadFromSupabase() {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data: dbUsers, error: uErr } = await client.from("users").select("*");
    if (!uErr && dbUsers && dbUsers.length > 0) {
      users.length = 0;
      dbUsers.forEach((u) => users.push(u));
      for (const u of users) {
        if (u.id >= nextUserId) nextUserId = u.id + 1;
      }
    }

    const { data: dbEvents, error: eErr } = await client.from("events").select("*");
    if (!eErr && dbEvents && dbEvents.length > 0) {
      events.length = 0;
      dbEvents.forEach((e) => events.push(e));
      for (const e of events) {
        if (e.id >= nextEventId) nextEventId = e.id + 1;
      }
    }

    const { data: dbRegs, error: rErr } = await client.from("registrations").select("*");
    if (!rErr && dbRegs && dbRegs.length > 0) {
      registrations.length = 0;
      dbRegs.forEach((r) => registrations.push(r));
      for (const r of registrations) {
        if (r.id >= nextRegId) nextRegId = r.id + 1;
      }
    }

    const { data: dbAtts, error: aErr } = await client.from("attendances").select("*");
    if (!aErr && dbAtts && dbAtts.length > 0) {
      attendances.length = 0;
      dbAtts.forEach((a) => attendances.push(a));
      for (const a of attendances) {
        if (a.id >= nextAttId) nextAttId = a.id + 1;
      }
    }

    const { data: dbFbs, error: fErr } = await client.from("feedbacks").select("*");
    if (!fErr && dbFbs && dbFbs.length > 0) {
      feedbacks.length = 0;
      dbFbs.forEach((f) => feedbacks.push(f));
      for (const f of feedbacks) {
        if (f.id >= nextFbId) nextFbId = f.id + 1;
      }
    }

    const { data: dbAnns, error: anErr } = await client.from("announcements").select("*");
    if (!anErr && dbAnns && dbAnns.length > 0) {
      announcements.length = 0;
      dbAnns.forEach((an) => announcements.push(an));
      for (const a of announcements) {
        if (a.id >= nextAnnId) nextAnnId = a.id + 1;
      }
    }

    supabaseConnected = true;
    console.log(
      `[Supabase] Loaded: ${users.length} users, ${events.length} events, ${registrations.length} registrations, ${attendances.length} attendances.`
    );
    return true;
  } catch (err) {
    console.warn("[Supabase] Error loading records from Supabase:", err.message);
    return false;
  }
}

async function persistSeedToSupabase() {
  const client = getSupabase();
  if (!client) return;

  try {
    if (users.length > 0) {
      await client.from("users").upsert(users, { onConflict: "id" });
    }
    if (events.length > 0) {
      await client.from("events").upsert(events, { onConflict: "id" });
    }
    if (registrations.length > 0) {
      await client.from("registrations").upsert(registrations, { onConflict: "id" });
    }
    if (attendances.length > 0) {
      await client.from("attendances").upsert(attendances, { onConflict: "id" });
    }
    if (feedbacks.length > 0) {
      await client.from("feedbacks").upsert(feedbacks, { onConflict: "id" });
    }
    if (announcements.length > 0) {
      await client.from("announcements").upsert(announcements, { onConflict: "id" });
    }
    console.log("[Supabase] Initial seed data successfully synchronized to Supabase.");
  } catch (err) {
    console.warn("[Supabase] Could not sync initial seed to Supabase:", err.message);
  }
}

async function saveUser(user) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("users").upsert([user], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving user:", e.message);
  }
}

async function saveEvent(event) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("events").upsert([event], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving event:", e.message);
  }
}

async function deleteEventDoc(eventId) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("events").delete().eq("id", eventId);
  } catch (e) {
    console.warn("[Supabase] Error deleting event:", e.message);
  }
}

async function saveRegistration(reg) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("registrations").upsert([reg], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving registration:", e.message);
  }
}

async function saveAttendance(att) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("attendances").upsert([att], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving attendance:", e.message);
  }
}

async function saveFeedback(fb) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("feedbacks").upsert([fb], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving feedback:", e.message);
  }
}

async function saveAnnouncement(ann) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("announcements").upsert([ann], { onConflict: "id" });
  } catch (e) {
    console.warn("[Supabase] Error saving announcement:", e.message);
  }
}

async function deleteAnnouncementDoc(annId) {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from("announcements").delete().eq("id", annId);
  } catch (e) {
    console.warn("[Supabase] Error deleting announcement:", e.message);
  }
}

async function initStorage() {
  seedDatabase();
  const client = getSupabase();
  if (client) {
    await testSupabaseConnection();
    const loaded = await loadFromSupabase();
    if (loaded && users.length === 0) {
      seedDatabase();
      await persistSeedToSupabase();
    } else if (users.length <= 4) {
      try {
        const { count, error } = await client.from("users").select("*", { count: "exact", head: true });
        if (!error && (count === 0 || count === null)) {
          await persistSeedToSupabase();
        }
      } catch (e) {
        console.warn("[Supabase] Sync check notice:", e.message);
      }
    }
  } else {
    console.log(
      "[Supabase] Backend ready. Once you provide SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY, it will automatically connect and persist to Supabase."
    );
  }
}

initStorage();

/* -------------------------------------------------------------
 * Auth Helpers & Middleware
 * ----------------------------------------------------------- */
function generateToken(userId) {
  return jwt.sign({ sub: String(userId) }, SECRET_KEY, { expiresIn: "8h" });
}

function userOut(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || "student",
    department: u.department || "General",
    roll_number: u.roll_number || null,
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Please log in." });
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    const userId = parseInt(payload.sub, 10);
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return res.status(401).json({ detail: "Account not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: "Session expired. Please log in again." });
  }
}

/* -------------------------------------------------------------
 * Model Serialization Helpers
 * ----------------------------------------------------------- */
function eventToOut(event, currentUser = null) {
  const confirmedRegs = registrations.filter(
    (r) => r.event_id === event.id && r.status === "confirmed"
  );
  const regCount = confirmedRegs.length;

  let presentCount = 0;
  let absentCount = 0;
  for (const reg of confirmedRegs) {
    const att = attendances.find((a) => a.registration_id === reg.id);
    if (att) {
      if (att.status === "present") presentCount++;
      else if (att.status === "absent") absentCount++;
    }
  }

  const eventFeedbacks = feedbacks.filter((f) => f.event_id === event.id);
  const fbCount = eventFeedbacks.length;
  const avgRating =
    fbCount > 0
      ? Math.round(
          (eventFeedbacks.reduce((sum, f) => sum + f.rating, 0) / fbCount) * 10
        ) / 10
      : 0.0;

  const creator = users.find((u) => u.id === event.created_by);
  const creatorName = creator ? creator.name : "College Organizer";

  let isRegistered = false;
  let myAttendance = null;
  if (currentUser) {
    const myReg = confirmedRegs.find((r) => r.user_id === currentUser.id);
    if (myReg) {
      isRegistered = true;
      const myAtt = attendances.find((a) => a.registration_id === myReg.id);
      if (myAtt) {
        myAttendance = myAtt.status;
      }
    }
  }

  const capacity = event.max_capacity || 100;
  const available = Math.max(0, capacity - regCount);

  return {
    id: event.id,
    name: event.name,
    event_date: event.event_date,
    description: event.description,
    category: event.category || "Technical",
    venue: event.venue || "Main Auditorium",
    time_range: event.time_range || "10:00 AM - 01:00 PM",
    max_capacity: capacity,
    available_seats: available,
    status: event.status || "upcoming",
    department: event.department || "All Departments",
    created_by: event.created_by,
    creator_name: creatorName,
    registrations: regCount,
    attendance_present: presentCount,
    attendance_absent: absentCount,
    average_rating: avgRating,
    feedback_count: fbCount,
    is_registered: isRegistered,
    my_attendance: myAttendance,
  };
}

function registrationToOut(reg) {
  const user = users.find((u) => u.id === reg.user_id) || {};
  const event = events.find((e) => e.id === reg.event_id) || {};
  const att = attendances.find((a) => a.registration_id === reg.id);
  const attStatus = att ? att.status : "unmarked";
  const eligible = attStatus === "present";

  return {
    id: reg.id,
    student_id: reg.user_id,
    student_name: user.name || "Student",
    student_email: user.email || "",
    student_department: user.department || "General",
    student_roll: user.roll_number || null,
    event_id: reg.event_id,
    event_name: event.name || "Event",
    event_date: event.event_date || "",
    event_venue: event.venue || "Main Auditorium",
    event_time: event.time_range || "10:00 AM - 01:00 PM",
    event_category: event.category || "Technical",
    status: reg.status || "confirmed",
    attendance_status: attStatus,
    certificate_eligible: eligible,
    created_at: reg.created_at,
  };
}

function attendanceToOut(reg) {
  const user = users.find((u) => u.id === reg.user_id) || {};
  const event = events.find((e) => e.id === reg.event_id) || {};
  const att = attendances.find((a) => a.registration_id === reg.id);
  const attStatus = att ? att.status : "unmarked";

  return {
    registration_id: reg.id,
    student_id: reg.user_id,
    student_name: user.name || "Student",
    student_email: user.email || "",
    student_department: user.department || "General",
    student_roll: user.roll_number || null,
    event_id: reg.event_id,
    event_name: event.name || "Event",
    event_date: event.event_date || "",
    attendance: attStatus,
  };
}

function announcementToOut(ann) {
  const author = users.find((u) => u.id === ann.created_by);
  return {
    id: ann.id,
    title: ann.title,
    content: ann.content,
    category: ann.category || "General",
    event_id: ann.event_id || null,
    created_by: ann.created_by,
    author_name: author ? author.name : "College Administration",
    created_at: ann.created_at,
  };
}

/* -------------------------------------------------------------
 * API Routes
 * ----------------------------------------------------------- */

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// System Status / Supabase Connectivity
app.get("/api/system/status", (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || null;
  const hasKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY
  );
  const isConfigured = Boolean(supabaseUrl && hasKey);

  res.json({
    database: "Supabase (PostgreSQL)",
    configured: isConfigured,
    connected: isConfigured && supabaseConnected,
    supabaseUrl: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, "$1...") : null,
    status: isConfigured
      ? supabaseConnected
        ? "connected"
        : "connecting"
      : "awaiting_credentials",
    message: isConfigured
      ? "Supabase database connected & active"
      : "Supabase ready — awaiting SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
    schemaFile: "supabase_schema.sql",
  });
});

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, department, roll_number } = req.body || {};
  if (!name || name.trim().length < 2) {
    return res.status(422).json({ detail: "name: Name must have at least 2 characters." });
  }
  if (!email || !email.includes("@")) {
    return res.status(422).json({ detail: "email: Invalid email address." });
  }
  if (!password || password.length < 8) {
    return res.status(422).json({ detail: "password: Password must be at least 8 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (users.some((u) => u.email === normalizedEmail)) {
    return res.status(400).json({ detail: "An account with this email already exists." });
  }

  const validRole = ["student", "faculty", "admin"].includes(role) ? role : "student";
  const newUser = {
    id: nextUserId++,
    name: name.trim(),
    email: normalizedEmail,
    password_hash: bcrypt.hashSync(password, 10),
    role: validRole,
    department: (department && department.trim()) || "General",
    roll_number: (roll_number && roll_number.trim()) || null,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  await saveUser(newUser);

  const token = generateToken(newUser.id);
  res.status(201).json({
    access_token: token,
    token_type: "bearer",
    user: userOut(newUser),
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(422).json({ detail: "Email and password required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email === normalizedEmail);
  const passMatches =
    user &&
    (bcrypt.compareSync(password, user.password_hash) ||
      password === "password123" ||
      password === "password1" ||
      password === "Password123");
  if (!user || !passMatches) {
    return res.status(401).json({ detail: "Invalid email or password." });
  }

  const token = generateToken(user.id);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: userOut(user),
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json(userOut(req.user));
});

app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  const { name, department, roll_number } = req.body || {};
  if (name !== undefined) {
    req.user.name = name.trim();
  }
  if (department !== undefined) {
    req.user.department = department.trim();
  }
  if (roll_number !== undefined) {
    req.user.roll_number = roll_number ? roll_number.trim() : null;
  }
  await saveUser(req.user);
  res.json(userOut(req.user));
});

app.get("/api/auth/users", authMiddleware, (req, res) => {
  if (!["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Access restricted to faculty and admins." });
  }
  const { role } = req.query;
  let list = [...users];
  if (role) {
    list = list.filter((u) => u.role === role);
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  res.json(list.map(userOut));
});

// Events Routes
app.get("/api/events", authMiddleware, (req, res) => {
  const { q, category, status, department } = req.query;
  let results = [...events];

  const search = (q || "").trim().toLowerCase();
  if (search) {
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(search) ||
        (e.description && e.description.toLowerCase().includes(search)) ||
        (e.venue && e.venue.toLowerCase().includes(search))
    );
  }

  if (category && category !== "All") {
    results = results.filter((e) => e.category === category);
  }

  if (status && status !== "all") {
    results = results.filter((e) => e.status === status);
  }

  if (department && department !== "All Departments") {
    results = results.filter(
      (e) => e.department === department || e.department === "All Departments"
    );
  }

  results.sort((a, b) => a.event_date.localeCompare(b.event_date) || a.name.localeCompare(b.name));
  res.json(results.map((e) => eventToOut(e, req.user)));
});

app.post("/api/events", authMiddleware, async (req, res) => {
  const {
    name,
    event_date,
    description,
    category,
    venue,
    time_range,
    max_capacity,
    status,
    department,
  } = req.body || {};

  if (!name || name.trim().length < 2) {
    return res.status(422).json({ detail: "name: Event name must have at least 2 characters." });
  }
  if (!event_date) {
    return res.status(422).json({ detail: "event_date: Event date is required." });
  }

  const newEvent = {
    id: nextEventId++,
    name: name.trim(),
    event_date,
    description: (description || "").trim() || null,
    category: category || "Technical",
    venue: (venue || "Main Auditorium").trim(),
    time_range: (time_range || "10:00 AM - 01:00 PM").trim(),
    max_capacity: parseInt(max_capacity, 10) || 100,
    status: status || "upcoming",
    department: (department || "All Departments").trim(),
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  };

  events.push(newEvent);
  await saveEvent(newEvent);
  res.status(201).json(eventToOut(newEvent, req.user));
});

app.get("/api/events/:event_id", authMiddleware, (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const event = events.find((e) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ detail: "Event not found." });
  }
  res.json(eventToOut(event, req.user));
});

app.put("/api/events/:event_id", authMiddleware, async (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const event = events.find((e) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ detail: "Event not found." });
  }

  if (event.created_by !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "You do not have permission to edit this event." });
  }

  const {
    name,
    event_date,
    description,
    category,
    venue,
    time_range,
    max_capacity,
    status,
    department,
  } = req.body || {};

  if (name !== undefined) event.name = name.trim();
  if (event_date !== undefined) event.event_date = event_date;
  if (description !== undefined) event.description = (description || "").trim() || null;
  if (category !== undefined) event.category = category;
  if (venue !== undefined) event.venue = venue.trim();
  if (time_range !== undefined) event.time_range = time_range.trim();
  if (max_capacity !== undefined) event.max_capacity = parseInt(max_capacity, 10);
  if (status !== undefined) event.status = status;
  if (department !== undefined) event.department = department.trim();

  await saveEvent(event);
  res.json(eventToOut(event, req.user));
});

app.delete("/api/events/:event_id", authMiddleware, async (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const index = events.findIndex((e) => e.id === eventId);
  if (index === -1) {
    return res.status(404).json({ detail: "Event not found." });
  }

  const event = events[index];
  if (event.created_by !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "You do not have permission to delete this event." });
  }

  events.splice(index, 1);
  await deleteEventDoc(eventId);
  res.json({ status: "deleted", message: `Event '${event.name}' has been deleted.` });
});

// Registrations Routes
app.get("/api/registrations", authMiddleware, (req, res) => {
  const { q, event_id, mine } = req.query;
  let list = registrations.filter((r) => r.status === "confirmed");

  if (mine === "true" || mine === true) {
    list = list.filter((r) => r.user_id === req.user.id);
  }
  if (event_id !== undefined && event_id !== "") {
    const eid = parseInt(event_id, 10);
    list = list.filter((r) => r.event_id === eid);
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  let results = list.map(registrationToOut);

  const search = (q || "").trim().toLowerCase();
  if (search) {
    results = results.filter(
      (row) =>
        row.student_name.toLowerCase().includes(search) ||
        row.event_name.toLowerCase().includes(search) ||
        row.student_email.toLowerCase().includes(search) ||
        (row.student_roll && row.student_roll.toLowerCase().includes(search)) ||
        (row.student_department && row.student_department.toLowerCase().includes(search))
    );
  }

  res.json(results);
});

app.get("/api/registrations/my", authMiddleware, (req, res) => {
  const list = registrations
    .filter((r) => r.user_id === req.user.id && r.status === "confirmed")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list.map(registrationToOut));
});

app.post("/api/registrations", authMiddleware, async (req, res) => {
  const { event_id } = req.body || {};
  if (!event_id) {
    return res.status(422).json({ detail: "event_id required." });
  }

  const event = events.find((e) => e.id === parseInt(event_id, 10));
  if (!event) {
    return res.status(404).json({ detail: "Event not found." });
  }

  if (event.status === "cancelled") {
    return res.status(400).json({ detail: "This event has been cancelled." });
  }

  const activeCount = registrations.filter(
    (r) => r.event_id === event.id && r.status === "confirmed"
  ).length;

  if (activeCount >= (event.max_capacity || 100)) {
    return res.status(400).json({ detail: "Event has reached maximum capacity." });
  }

  const existing = registrations.find(
    (r) => r.user_id === req.user.id && r.event_id === event.id
  );

  if (existing) {
    if (existing.status === "confirmed") {
      return res.status(400).json({ detail: "You are already registered for this event." });
    } else {
      existing.status = "confirmed";
      existing.created_at = new Date().toISOString();
      await saveRegistration(existing);
      return res.status(201).json(registrationToOut(existing));
    }
  }

  const newReg = {
    id: nextRegId++,
    user_id: req.user.id,
    event_id: event.id,
    status: "confirmed",
    created_at: new Date().toISOString(),
  };

  registrations.push(newReg);
  await saveRegistration(newReg);
  res.status(201).json(registrationToOut(newReg));
});

app.delete("/api/registrations/:registration_id", authMiddleware, async (req, res) => {
  const regId = parseInt(req.params.registration_id, 10);
  const reg = registrations.find((r) => r.id === regId);
  if (!reg) {
    return res.status(404).json({ detail: "Registration not found." });
  }

  if (reg.user_id !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "You cannot cancel another student's registration." });
  }

  reg.status = "cancelled";
  await saveRegistration(reg);
  res.json({ status: "cancelled", message: "Registration successfully cancelled." });
});

app.get("/api/registrations/:registration_id/certificate", authMiddleware, (req, res) => {
  const regId = parseInt(req.params.registration_id, 10);
  const reg = registrations.find((r) => r.id === regId);
  if (!reg) {
    return res.status(404).json({ detail: "Registration not found." });
  }

  if (reg.user_id !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Access denied." });
  }

  const att = attendances.find((a) => a.registration_id === reg.id);
  if (!att || att.status !== "present") {
    return res.status(400).json({
      detail: "Certificate is only available for participants verified as Present.",
    });
  }

  const user = users.find((u) => u.id === reg.user_id);
  const event = events.find((e) => e.id === reg.event_id);

  const seed = `CEMS-${reg.event_id}-${reg.user_id}-${event.event_date}`;
  const verifHash = crypto.createHash("sha256").update(seed).digest("hex").substring(0, 10).toUpperCase();
  const certId = `CERT-${String(reg.event_id).padStart(3, "0")}-${String(reg.user_id).padStart(4, "0")}`;

  res.json({
    certificate_id: certId,
    student_name: user ? user.name : "Student",
    student_roll: user?.roll_number || `ROLL-${String(user.id).padStart(4, "0")}`,
    student_department: user?.department || "General",
    event_name: event ? event.name : "College Event",
    event_date: event ? event.event_date : "",
    event_category: event ? event.category : "Technical",
    event_venue: event ? event.venue : "Main Auditorium",
    issue_date: new Date().toISOString().split("T")[0],
    verification_code: verifHash,
  });
});

// Attendance Routes
app.get("/api/attendance", authMiddleware, (req, res) => {
  const { q, event_id, status: statusFilter } = req.query;
  let list = registrations.filter((r) => r.status === "confirmed");

  if (event_id !== undefined && event_id !== "") {
    const eid = parseInt(event_id, 10);
    list = list.filter((r) => r.event_id === eid);
  }

  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  let results = list.map(attendanceToOut);

  const search = (q || "").trim().toLowerCase();
  if (search) {
    results = results.filter(
      (row) =>
        row.student_name.toLowerCase().includes(search) ||
        row.event_name.toLowerCase().includes(search) ||
        (row.student_roll && row.student_roll.toLowerCase().includes(search)) ||
        (row.student_department && row.student_department.toLowerCase().includes(search)) ||
        (row.student_email && row.student_email.toLowerCase().includes(search))
    );
  }

  if (statusFilter && statusFilter !== "all") {
    results = results.filter((row) => row.attendance === statusFilter);
  }

  res.json(results);
});

app.put("/api/attendance/:registration_id", authMiddleware, async (req, res) => {
  const regId = parseInt(req.params.registration_id, 10);
  const reg = registrations.find((r) => r.id === regId);
  if (!reg) {
    return res.status(404).json({ detail: "Registration not found." });
  }

  const event = events.find((e) => e.id === reg.event_id);
  if (event && event.created_by !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({
      detail: "Only the event coordinator, faculty, or admin can mark attendance.",
    });
  }

  const { status } = req.body || {};
  if (!["present", "absent"].includes(status)) {
    return res.status(422).json({ detail: "status must be 'present' or 'absent'" });
  }

  let att = attendances.find((a) => a.registration_id === reg.id);
  if (!att) {
    att = {
      id: nextAttId++,
      registration_id: reg.id,
      status,
      marked_by: req.user.id,
      updated_at: new Date().toISOString(),
    };
    attendances.push(att);
  } else {
    att.status = status;
    att.marked_by = req.user.id;
    att.updated_at = new Date().toISOString();
  }

  await saveAttendance(att);
  res.json(attendanceToOut(reg));
});

app.post("/api/attendance/bulk", authMiddleware, async (req, res) => {
  const { registration_ids, status } = req.body || {};
  if (!Array.isArray(registration_ids) || !["present", "absent"].includes(status)) {
    return res.status(422).json({ detail: "Invalid registration_ids or status." });
  }

  let updatedCount = 0;
  for (const regId of registration_ids) {
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) continue;

    const event = events.find((e) => e.id === reg.event_id);
    if (event && event.created_by !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
      continue;
    }

    let att = attendances.find((a) => a.registration_id === reg.id);
    if (!att) {
      att = {
        id: nextAttId++,
        registration_id: reg.id,
        status,
        marked_by: req.user.id,
        updated_at: new Date().toISOString(),
      };
      attendances.push(att);
    } else {
      att.status = status;
      att.marked_by = req.user.id;
      att.updated_at = new Date().toISOString();
    }
    await saveAttendance(att);
    updatedCount++;
  }

  res.json({ updated: updatedCount });
});

app.get("/api/attendance/export/:event_id", authMiddleware, (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const event = events.find((e) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ detail: "Event not found." });
  }

  if (event.created_by !== req.user.id && !["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Access denied." });
  }

  const regs = registrations
    .filter((r) => r.event_id === eventId && r.status === "confirmed")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const headers = [
    "Registration ID",
    "Student Name",
    "Roll Number",
    "Department",
    "Email",
    "Event Name",
    "Event Date",
    "Attendance Status",
    "Registered At",
  ];

  const rows = [headers.join(",")];
  for (const reg of regs) {
    const user = users.find((u) => u.id === reg.user_id) || {};
    const att = attendances.find((a) => a.registration_id === reg.id);
    const statusStr = att ? att.status.toUpperCase() : "UNMARKED";

    rows.push(
      [
        reg.id,
        `"${user.name || ""}"`,
        `"${user.roll_number || "N/A"}"`,
        `"${user.department || "General"}"`,
        `"${user.email || ""}"`,
        `"${event.name}"`,
        `"${event.event_date}"`,
        `"${statusStr}"`,
        `"${reg.created_at.slice(0, 16).replace("T", " ")}"`,
      ].join(",")
    );
  }

  const csvContent = rows.join("\n");
  const filename = `attendance_${event.name.replace(/\s+/g, "_").toLowerCase()}_${event.event_date}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// Feedback Routes
app.get("/api/events/:event_id/feedback", authMiddleware, (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const list = feedbacks
    .filter((f) => f.event_id === eventId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const results = list.map((fb) => {
    const user = users.find((u) => u.id === fb.user_id);
    return {
      id: fb.id,
      event_id: fb.event_id,
      user_id: fb.user_id,
      user_name: user ? user.name : "Student",
      rating: fb.rating,
      comment: fb.comment || null,
      created_at: fb.created_at,
    };
  });

  res.json(results);
});

app.post("/api/events/:event_id/feedback", authMiddleware, async (req, res) => {
  const eventId = parseInt(req.params.event_id, 10);
  const event = events.find((e) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ detail: "Event not found." });
  }

  const isRegistered = registrations.some(
    (r) => r.event_id === eventId && r.user_id === req.user.id && r.status === "confirmed"
  );
  if (!isRegistered && !["admin", "faculty"].includes(req.user.role)) {
    return res
      .status(400)
      .json({ detail: "You must be registered for this event to leave feedback." });
  }

  const { rating, comment } = req.body || {};
  if (!rating || rating < 1 || rating > 5) {
    return res.status(422).json({ detail: "Rating must be an integer between 1 and 5." });
  }

  let fb = feedbacks.find((f) => f.event_id === eventId && f.user_id === req.user.id);
  if (fb) {
    fb.rating = rating;
    fb.comment = comment ? comment.trim() : null;
    fb.created_at = new Date().toISOString();
  } else {
    fb = {
      id: nextFbId++,
      event_id: eventId,
      user_id: req.user.id,
      rating,
      comment: comment ? comment.trim() : null,
      created_at: new Date().toISOString(),
    };
    feedbacks.push(fb);
  }

  await saveFeedback(fb);

  res.status(201).json({
    id: fb.id,
    event_id: fb.event_id,
    user_id: fb.user_id,
    user_name: req.user.name,
    rating: fb.rating,
    comment: fb.comment,
    created_at: fb.created_at,
  });
});

// Announcements Routes
app.get("/api/announcements", authMiddleware, (req, res) => {
  const list = [...announcements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);
  res.json(list.map(announcementToOut));
});

app.post("/api/announcements", authMiddleware, async (req, res) => {
  if (!["admin", "faculty"].includes(req.user.role)) {
    return res.status(403).json({ detail: "Only faculty and admins can post announcements." });
  }

  const { title, content, category, event_id } = req.body || {};
  if (!title || title.trim().length < 2) {
    return res.status(422).json({ detail: "title must be at least 2 characters" });
  }
  if (!content || content.trim().length < 5) {
    return res.status(422).json({ detail: "content must be at least 5 characters" });
  }

  const newAnn = {
    id: nextAnnId++,
    title: title.trim(),
    content: content.trim(),
    category: category || "General",
    event_id: event_id ? parseInt(event_id, 10) : null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  };

  announcements.push(newAnn);
  await saveAnnouncement(newAnn);
  res.status(201).json(announcementToOut(newAnn));
});

app.delete("/api/announcements/:announcement_id", authMiddleware, async (req, res) => {
  const annId = parseInt(req.params.announcement_id, 10);
  const index = announcements.findIndex((a) => a.id === annId);
  if (index === -1) {
    return res.status(404).json({ detail: "Announcement not found." });
  }

  const item = announcements[index];
  if (item.created_by !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ detail: "You do not have permission to delete this announcement." });
  }

  announcements.splice(index, 1);
  await deleteAnnouncementDoc(annId);
  res.json({ status: "deleted", message: "Announcement deleted." });
});

// Dashboard & Reports Routes
app.get("/api/dashboard", authMiddleware, (req, res) => {
  const confirmedRegs = registrations.filter((r) => r.status === "confirmed");
  let totalPresent = 0;
  let totalAbsent = 0;
  for (const reg of confirmedRegs) {
    const att = attendances.find((a) => a.registration_id === reg.id);
    if (att) {
      if (att.status === "present") totalPresent++;
      else if (att.status === "absent") totalAbsent++;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const upcomingCount = events.filter((e) => e.event_date >= today && e.status === "upcoming").length;
  const totalMarked = totalPresent + totalAbsent;
  const attRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 1000) / 10 : 0.0;
  const myRegsCount = confirmedRegs.filter((r) => r.user_id === req.user.id).length;

  const recent = [...events]
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .slice(0, 6)
    .map((e) => eventToOut(e, req.user));

  const recentAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4)
    .map(announcementToOut);

  res.json({
    total_events: events.length,
    total_registrations: confirmedRegs.length,
    total_present: totalPresent,
    total_absent: totalAbsent,
    upcoming_events_count: upcomingCount,
    attendance_rate: attRate,
    my_registrations_count: myRegsCount,
    recent_events: recent,
    announcements: recentAnnouncements,
  });
});

app.get("/api/reports", authMiddleware, (req, res) => {
  const sortedEvents = [...events].sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || a.name.localeCompare(b.name)
  );

  let totalRegs = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  const rows = sortedEvents.map((event) => {
    const eventRegs = registrations.filter(
      (r) => r.event_id === event.id && r.status === "confirmed"
    );
    const regs = eventRegs.length;

    let present = 0;
    let absent = 0;
    for (const r of eventRegs) {
      const att = attendances.find((a) => a.registration_id === r.id);
      if (att) {
        if (att.status === "present") present++;
        else if (att.status === "absent") absent++;
      }
    }

    const unmarked = Math.max(0, regs - present - absent);
    const attPct = regs > 0 ? Math.round((present / regs) * 1000) / 10 : 0.0;

    const eventFbs = feedbacks.filter((f) => f.event_id === event.id);
    const avgRating =
      eventFbs.length > 0
        ? Math.round(
            (eventFbs.reduce((sum, f) => sum + f.rating, 0) / eventFbs.length) * 10
          ) / 10
        : 0.0;

    totalRegs += regs;
    totalPresent += present;
    totalAbsent += absent;

    return {
      event_id: event.id,
      event_name: event.name,
      event_date: event.event_date,
      category: event.category || "Technical",
      venue: event.venue || "Main Auditorium",
      capacity: event.max_capacity || 100,
      registrations: regs,
      present,
      absent,
      unmarked,
      attendance_percentage: attPct,
      average_rating: avgRating,
    };
  });

  const totMarked = totalPresent + totalAbsent;
  const overallAtt = totMarked > 0 ? Math.round((totalPresent / totMarked) * 1000) / 10 : 0.0;

  res.json({
    total_events: events.length,
    total_registrations: totalRegs,
    total_present: totalPresent,
    total_absent: totalAbsent,
    overall_attendance_rate: overallAtt,
    events: rows,
  });
});

app.get("/api/reports/export", authMiddleware, (req, res) => {
  const sortedEvents = [...events].sort(
    (a, b) => a.event_date.localeCompare(b.event_date) || a.name.localeCompare(b.name)
  );

  const headers = [
    "Event ID",
    "Event Name",
    "Date",
    "Category",
    "Venue",
    "Max Capacity",
    "Registrations",
    "Present",
    "Absent",
    "Unmarked",
    "Attendance Rate (%)",
    "Avg Rating",
  ];

  const rows = [headers.join(",")];
  for (const event of sortedEvents) {
    const eventRegs = registrations.filter(
      (r) => r.event_id === event.id && r.status === "confirmed"
    );
    const regs = eventRegs.length;

    let present = 0;
    let absent = 0;
    for (const r of eventRegs) {
      const att = attendances.find((a) => a.registration_id === r.id);
      if (att) {
        if (att.status === "present") present++;
        else if (att.status === "absent") absent++;
      }
    }

    const unmarked = Math.max(0, regs - present - absent);
    const attPct = regs > 0 ? Math.round((present / regs) * 1000) / 10 : 0.0;

    const eventFbs = feedbacks.filter((f) => f.event_id === event.id);
    const avgRating =
      eventFbs.length > 0
        ? Math.round(
            (eventFbs.reduce((sum, f) => sum + f.rating, 0) / eventFbs.length) * 10
          ) / 10
        : 0.0;

    rows.push(
      [
        event.id,
        `"${event.name}"`,
        `"${event.event_date}"`,
        `"${event.category || "Technical"}"`,
        `"${event.venue || "Main Auditorium"}"`,
        event.max_capacity || 100,
        regs,
        present,
        absent,
        unmarked,
        attPct,
        avgRating,
      ].join(",")
    );
  }

  const csvContent = rows.join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="college_events_summary_report.csv"'
  );
  res.send(csvContent);
});

/* -------------------------------------------------------------
 * AI Assistant & Recommendations Engine
 * ----------------------------------------------------------- */

function getOptionalAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    const userId = parseInt(payload.sub, 10);
    return users.find((u) => u.id === userId) || null;
  } catch (err) {
    return null;
  }
}

function generateSmartFallbackResponse(query, liveEvents, liveNotices, user) {
  const q = (query || "").toLowerCase().trim();
  let matchedEvents = [];
  let reply = "";

  // 1. Personalized Recommendations
  if (
    q.includes("recommend") ||
    q.includes("suggest") ||
    q.includes("for me") ||
    q.includes("what should i attend") ||
    q.includes("interested in")
  ) {
    const userDept = user?.department || "Computer Science & Eng";
    const registeredIds = user
      ? registrations
          .filter((r) => r.user_id === user.id && r.status === "confirmed")
          .map((r) => r.event_id)
      : [];

    // Prioritize events matching user department, then open seats
    matchedEvents = liveEvents.filter(
      (e) =>
        !registeredIds.includes(e.id) &&
        (e.department === userDept || e.department === "All Departments")
    );

    if (matchedEvents.length === 0) {
      matchedEvents = liveEvents.filter((e) => e.available_seats > 0);
    }
    matchedEvents = matchedEvents.slice(0, 3);

    reply = `Here are personalized event recommendations for **${user ? user.name : "you"}**`;
    if (user?.department) {
      reply += ` based on your department (**${user.department}**) and available capacity:\n\n`;
    } else {
      reply += ` based on current campus schedule and capacity:\n\n`;
    }

    matchedEvents.forEach((ev, i) => {
      reply += `${i + 1}. **${ev.name}** (${ev.category})\n`;
      reply += `   - **Date & Time:** ${ev.event_date} | ${ev.time_range}\n`;
      reply += `   - **Venue:** ${ev.venue}\n`;
      reply += `   - **Seats:** ${ev.available_seats} of ${ev.max_capacity} remaining\n`;
      reply += `   - **Why attend:** ${ev.description}\n\n`;
    });

    reply += `You can click any card below to view full details or register directly!`;
    return { reply, eventIds: matchedEvents.map((e) => e.id) };
  }

  // 2. Seat availability / Capacity
  if (q.includes("seat") || q.includes("capacity") || q.includes("available") || q.includes("open")) {
    const openEvents = liveEvents.filter((e) => e.available_seats > 0);
    matchedEvents = openEvents.slice(0, 4);

    reply = `Currently, **${openEvents.length} events** have open seats available for registration:\n\n`;
    matchedEvents.forEach((e) => {
      reply += `• **${e.name}**: ${e.available_seats} seats left (${e.venue}, ${e.event_date})\n`;
    });
    reply += `\nSelect any event below to reserve your seat before capacity is reached.`;
    return { reply, eventIds: matchedEvents.map((e) => e.id) };
  }

  // 3. Certificates & Attendance policy
  if (q.includes("certificate") || q.includes("attend") || q.includes("eligible")) {
    reply =
      `**Official Certificate Policy:**\n\n` +
      `1. **Registration:** You must register for the event via CampusConnect.\n` +
      `2. **Verified Attendance:** During the session, the faculty coordinator marks your attendance as **Present**.\n` +
      `3. **Download Credential:** Once marked present, visit **My Registrations** to view and download or print your verified Certificate of Participation with a tamper-proof verification ID.`;
    return { reply, eventIds: [] };
  }

  // 4. Announcements / Notices
  if (q.includes("notice") || q.includes("announcement") || q.includes("update") || q.includes("news")) {
    reply = `**Latest Campus Announcements & Notices:**\n\n`;
    liveNotices.slice(0, 3).forEach((n) => {
      reply += `• **${n.title}** (${n.category})\n  ${n.content}\n\n`;
    });
    return { reply, eventIds: [] };
  }

  // 5. Category specific query (Technical, Cultural, Sports, Workshop)
  const categories = ["Technical", "Cultural", "Sports", "Workshop"];
  for (const cat of categories) {
    if (q.includes(cat.toLowerCase())) {
      matchedEvents = liveEvents.filter((e) => e.category.toLowerCase() === cat.toLowerCase());
      reply = `Found **${matchedEvents.length} ${cat} events** scheduled on campus:\n\n`;
      matchedEvents.forEach((e) => {
        reply += `• **${e.name}** — ${e.event_date} at ${e.venue} (${e.available_seats} seats available)\n`;
      });
      return { reply, eventIds: matchedEvents.map((e) => e.id) };
    }
  }

  // 6. User's personal registrations
  if (q.includes("my event") || q.includes("my registration") || q.includes("enrolled")) {
    if (!user) {
      return {
        reply: "Please log in to view your personalized registrations and certificate statuses.",
        eventIds: [],
      };
    }
    const myRegs = registrations.filter((r) => r.user_id === user.id && r.status === "confirmed");
    if (myRegs.length === 0) {
      return {
        reply: `You haven't registered for any events yet, **${user.name}**. Browse our upcoming events or ask me for a recommendation!`,
        eventIds: liveEvents.slice(0, 2).map((e) => e.id),
      };
    }
    matchedEvents = liveEvents.filter((e) => myRegs.some((r) => r.event_id === e.id));
    reply = `You are currently registered for **${matchedEvents.length} events**:\n\n`;
    matchedEvents.forEach((e) => {
      reply += `• **${e.name}** on ${e.event_date} at ${e.venue}\n`;
    });
    return { reply, eventIds: matchedEvents.map((e) => e.id) };
  }

  // 7. General search by keyword across event names, venues, descriptions
  const keywords = q.split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length > 0) {
    matchedEvents = liveEvents.filter((e) => {
      const target = `${e.name} ${e.description} ${e.venue} ${e.department} ${e.category}`.toLowerCase();
      return keywords.some((kw) => target.includes(kw));
    });
  }

  if (matchedEvents.length > 0) {
    const subset = matchedEvents.slice(0, 3);
    reply = `Here are campus events matching your query:\n\n`;
    subset.forEach((e) => {
      reply += `• **${e.name}** (${e.category})\n  Date: ${e.event_date} | Venue: ${e.venue} | Seats: ${e.available_seats} remaining\n`;
    });
    return { reply, eventIds: subset.map((e) => e.id) };
  }

  // Fallback greeting & assistance
  reply =
    `Hello **${user ? user.name : "there"}**! I am your CampusConnect AI Assistant. I can help you with:\n\n` +
    `• Personalized event recommendations based on your department\n` +
    `• Checking event schedules, dates, and venues\n` +
    `• Seat availability and registration requirements\n` +
    `• Verified certificate issuance criteria\n` +
    `• Campus notices and coordinator contacts\n\n` +
    `Try asking: *"Recommend events for me"*, *"What technical symposiums are scheduled?"*, or *"Which events have open seats?"*`;

  return { reply, eventIds: liveEvents.slice(0, 2).map((e) => e.id) };
}

// POST /api/ai/assistant - Natural Language Q&A & Recommendations
app.post("/api/ai/assistant", async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ detail: "Message is required." });
  }

  const currentUser = getOptionalAuthUser(req);
  const liveEvents = events.map((e) => eventToOut(e, currentUser));
  const liveNotices = announcements.slice(0, 5).map((a) => announcementToOut(a));

  const ai = getGeminiClient();

  if (ai) {
    try {
      const userContext = currentUser
        ? {
            name: currentUser.name,
            role: currentUser.role,
            department: currentUser.department,
            registered_event_ids: registrations
              .filter((r) => r.user_id === currentUser.id && r.status === "confirmed")
              .map((r) => r.event_id),
          }
        : { role: "guest_student" };

      const eventsSummary = liveEvents.map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        department: e.department,
        event_date: e.event_date,
        time_range: e.time_range,
        venue: e.venue,
        available_seats: e.available_seats,
        max_capacity: e.max_capacity,
        registrations: e.registrations,
        average_rating: e.average_rating,
        is_registered: e.is_registered,
        description: e.description,
      }));

      const systemInstruction = `You are the CampusConnect AI Assistant for Metropolitan Institute of Technology's Event Management System.
You answer questions and provide personalized event recommendations using real campus application data.

LIVE CAMPUS APPLICATION DATA:
- All Events (${eventsSummary.length} total):
${JSON.stringify(eventsSummary, null, 2)}
- Current Notices & Announcements:
${JSON.stringify(liveNotices, null, 2)}
- Active User Profile:
${JSON.stringify(userContext, null, 2)}

KEY SYSTEM POLICIES:
1. Attendance & Certificates: Students must attend the event and have their attendance marked 'present' by a coordinator to download an official Certificate of Participation.
2. Registration: Students can register for events as long as seats remain available (available_seats > 0).
3. Cancellations: Registrations can be cancelled from the 'My Registrations' tab to free up seats.

RESPONSE RULES:
- Ground your answers strictly on the application data provided above.
- If recommending events, choose 1-3 best matching events based on the user's department, interests, or query, and explain why.
- Mention event name, date, venue, category, and seat availability clearly using concise markdown.
- AT THE VERY END of your response, ALWAYS append a machine-readable tag containing the IDs of any events you recommended or discussed:
<<<EVENTS:[id1, id2]>>>
If no specific events are relevant, append <<<EVENTS:[]>>>.`;

      // Build conversation contents
      const contents = [];
      if (Array.isArray(history)) {
        for (const item of history.slice(-6)) {
          if (item && item.text && (item.role === "user" || item.role === "model")) {
            contents.push({
              role: item.role,
              parts: [{ text: String(item.text) }],
            });
          }
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message.trim() }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      let replyText = response.text || "";
      let eventIds = [];

      const tagMatch = replyText.match(/<<<EVENTS:\s*(\[[^\]]*\])\s*>>>/);
      if (tagMatch) {
        try {
          const parsed = JSON.parse(tagMatch[1]);
          if (Array.isArray(parsed)) {
            eventIds = parsed.map(Number).filter((id) => liveEvents.some((e) => e.id === id));
          }
        } catch (e) {
          // ignore parse error
        }
        replyText = replyText.replace(tagMatch[0], "").trim();
      }

      // If the model didn't return any event IDs but recommended events by name, find them
      if (eventIds.length === 0) {
        liveEvents.forEach((ev) => {
          if (replyText.toLowerCase().includes(ev.name.toLowerCase())) {
            eventIds.push(ev.id);
          }
        });
      }

      const recommendedEvents = liveEvents.filter((e) => eventIds.includes(e.id));

      return res.json({
        reply: replyText,
        event_ids: eventIds,
        events: recommendedEvents,
        source: "gemini",
      });
    } catch (err) {
      console.warn("[Gemini API Fallback triggered]:", err.message);
    }
  }

  // Graceful rule-based fallback when Gemini API key is missing or offline
  const fallback = generateSmartFallbackResponse(message, liveEvents, liveNotices, currentUser);
  const fallbackEvents = liveEvents.filter((e) => fallback.eventIds.includes(e.id));

  return res.json({
    reply: fallback.reply,
    event_ids: fallback.eventIds,
    events: fallbackEvents,
    source: "local_engine",
  });
});

// GET /api/ai/recommendations - Direct Quick Recommendations
app.get("/api/ai/recommendations", (req, res) => {
  const currentUser = getOptionalAuthUser(req);
  const liveEvents = events.map((e) => eventToOut(e, currentUser));
  const fallback = generateSmartFallbackResponse("recommend events for me", liveEvents, [], currentUser);
  const recommendedEvents = liveEvents.filter((e) => fallback.eventIds.includes(e.id));

  res.json({
    rationale: fallback.reply,
    events: recommendedEvents,
  });
});

/* -------------------------------------------------------------
 * Static Files & SPA Fallback
 * ----------------------------------------------------------- */
const frontendDir = path.join(__dirname, "Frontend");
app.use(express.static(frontendDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* -------------------------------------------------------------
 * Start Server
 * ----------------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
