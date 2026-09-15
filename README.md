# CampusConnect - College Event Management System

A comprehensive, full-stack **College Event Management Portal** designed for universities and academic institutions. Built with **FastAPI**, **SQLite** (with automatic schema evolution), and a modern, responsive browser frontend.

---

## 🌟 Key Features

### 1. Role-Based Access & Profiles
- **Roles**: `Student`, `Faculty / Coordinator`, and `Admin`.
- **Student Profile**: Tracks student roll number, department, email, and full name.
- **Role Preview Switcher**: Interactive header switcher allows exploring the UI from Student, Coordinator, or Admin perspectives seamlessly.

### 2. Events Directory & Categories
- **Categorization**: Technical & Coding, Workshops & Labs, Seminars & Talks, Cultural & Arts, Sports & Athletics, Hackathons, Club Activities.
- **Rich Event Metadata**: Venue, date, duration/timing, host department, organizer info, and detailed agenda.
- **Seat Capacity Enforcement**: Maximum capacity per event with live enrollment progress meters (e.g. `42 / 50 seats filled`) preventing overbooking.
- **Event Lifecycle**: Status tracking (`upcoming`, `completed`, `cancelled`) with creator/coordinator authorization checks.

### 3. Campus Calendar View
- Interactive visual month view displaying all campus events as colored badges on their scheduled dates.
- Filter by category and click any date/event to open full details.

### 4. Student Hub & Participation e-Certificates
- **My Registrations**: Dedicated portal for students to track enrolled events, venue details, and attendance verification.
- **Seat Cancellation**: Students can cancel un-attended registrations to free up seats for peers.
- **Official e-Certificate of Participation**: When marked "Present" by a coordinator, students can view and **Print / Save as PDF** an official collegiate certificate complete with college crest, verification hash, and signature blocks.

### 5. Event Coordinator Suite & Attendance Hub
- **Live Attendance Meter**: Visual progress bar tracking present vs. absent attendees in real time.
- **One-Tap Check-In**: Mark registered students "Present" or "Absent" instantly.
- **Bulk Check-In**: "Mark All Present" convenience button.
- **CSV Attendance Export**: Download official attendance rosters (Name, Roll Number, Department, Email, Status, Timestamp) for HOD and academic record keeping.

### 6. Student Reviews & Ratings
- 5-star rating widget with written feedback for events students enrolled in.
- Real-time display of average ratings and feedback counts.

### 7. Campus Bulletins & Advisories
- Live notice board with priority levels (`Urgent`, `General`, `Event Update`).
- Real-time marquee alert banner across the top header for critical updates.

### 8. Analytics & CSV Audit Reports
- Summary dashboard metrics: total events, total registrations, present attendees, and overall attendance rate.
- Per-event audit breakdown table.
- One-click **Download Full Summary CSV** export.

---

## 🚀 Setup & Run

### Prerequisites
- Python 3.10 or newer
- pip

### 1. Activate Environment & Install Dependencies
```bash
# Windows
venv\Scripts\activate
pip install -r requirements.txt

# macOS / Linux
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 🧪 Tests

Run the complete test suite (includes regression tests and comprehensive college features test suite):
```bash
pytest
```

---

## 📡 API Overview

| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user (Student or Faculty) | Public |
| `POST` | `/api/auth/login` | Sign in & receive JWT token | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile | Authenticated |
| `PUT` | `/api/auth/profile` | Update name, department, roll number | Authenticated |
| `GET` | `/api/events` | List/search events with filters | Authenticated |
| `POST` | `/api/events` | Create new event with venue & capacity | Authenticated |
| `GET` | `/api/events/{id}` | Get event details & live capacity | Authenticated |
| `PUT` | `/api/events/{id}` | Edit event (authorized creator/admin) | Creator/Admin |
| `DELETE` | `/api/events/{id}` | Delete event (authorized creator/admin) | Creator/Admin |
| `GET` | `/api/registrations` | List event registrations | Authenticated |
| `GET` | `/api/registrations/my` | Current student's registered events | Authenticated |
| `POST` | `/api/registrations` | Register for event (capacity-checked) | Authenticated |
| `DELETE` | `/api/registrations/{id}` | Cancel registration (releases seat) | Attendee/Admin |
| `GET` | `/api/registrations/{id}/certificate` | Generate verified participation certificate | Present Student |
| `GET` | `/api/attendance` | List attendance for an event | Authenticated |
| `PUT` | `/api/attendance/{id}` | Mark present/absent | Coordinator/Admin |
| `POST` | `/api/attendance/bulk` | Mark all present in bulk | Coordinator/Admin |
| `GET` | `/api/attendance/export/{event_id}` | Export attendance roster CSV | Coordinator/Admin |
| `GET` | `/api/events/{id}/feedback` | List feedback and ratings | Authenticated |
| `POST` | `/api/events/{id}/feedback` | Submit 5-star rating and comment | Registered User |
| `GET` | `/api/announcements` | List campus notices and bulletins | Authenticated |
| `POST` | `/api/announcements` | Post notice | Faculty/Admin |
| `DELETE` | `/api/announcements/{id}` | Remove notice | Author/Admin |
| `GET` | `/api/dashboard` | Dashboard metrics & recent events | Authenticated |
| `GET` | `/api/reports` | Event audit and attendance rates | Authenticated |
| `GET` | `/api/reports/export` | Download full event summary CSV | Authenticated |
