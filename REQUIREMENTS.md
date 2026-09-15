# Requirements

This document is the implementation source of truth for the College Event Management System. It restates the six features in `srs.md` and maps them to the product. Do not add features outside this list.

## Functional requirements

| ID | Requirement | Product behavior |
| --- | --- | --- |
| FR-01 | Users can register and log in | Name, email, and password on registration (3 fields). Email and password on login (2 fields). Passwords are hashed. Authenticated sessions use a JWT. |
| FR-02 | Users can create and edit events | Authenticated users create events (name, date, optional description) and edit existing events. Event deletion is out of scope. |
| FR-03 | Users can list and search events | Authenticated users see all events and can search by name. |
| FR-04 | Students can register for events | Authenticated users register themselves for an event. Duplicate registration for the same event is rejected. Listing registrations is included so students and staff can see who signed up. |
| FR-05 | Attendance can be tracked | Authenticated users mark a registered student present or absent for an event. Attendance cannot be recorded without a registration. |
| FR-06 | Basic event reports | Authenticated users view summary counts and per-event registration and attendance totals. Advanced analytics are out of scope. |

Student “CRUD” in this project means student **event registration** records (create and read registrations; update attendance against those records). A separate student-directory module is out of scope.

A dashboard is the home view of FR-02 through FR-06 (counts and recent events). It is not an extra feature.

## Non-functional requirements

| ID | Requirement | Product behavior |
| --- | --- | --- |
| NFR-01 | Normal requests complete within 3 seconds for small concurrent use | SQLite plus indexed lookups; simple queries only. |
| NFR-02 | Passwords stored with one-way hashing | bcrypt hashes; never store plain-text passwords. |
| NFR-03 | Registration and login use at most 5 input fields per screen | Register: name, email, password. Login: email, password. |
| NFR-04 | Data remains available during normal operation | SQLite file persisted on disk; API returns clear errors if a request fails. |

## Technical constraints

- Python backend (FastAPI)
- SQLite database
- Browser frontend connected to the API
- Validation on both client and server
- Only the six functional features above
