# Software Requirements Specification (SRS)

## College Event Management System

### 1. Purpose and Scope

**Purpose:**
The purpose of the College Event Management System is to provide a simple system for managing college events. It will support user registration and login, event creation and editing, event listing and search, student event registration, attendance tracking, and basic event reports.

**In Scope**

* User registration and login.
* Event creation and editing.
* Event listing and search.
* Student event registration.
* Attendance tracking.
* Basic event reports.

**Out of Scope**

* Features not included in the six stated requirements.
* Advanced reporting beyond basic event reports.
* Additional event management functions not specified in the requirements.

### 2. Functional Requirements

**FR-01:** The system shall allow users to register and log in.

**FR-02:** The system shall allow users to create and edit events.

**FR-03:** The system shall allow users to list and search for events.

**FR-04:** The system shall allow students to register for events.

**FR-05:** The system shall allow attendance to be tracked for events.

**FR-06:** The system shall generate basic event reports.

### 3. Non-Functional Requirements

**NFR-01:** The system shall display normal user requests within 3 seconds under a load of up to 20 concurrent users.

**NFR-02:** The system shall require passwords to be stored using a secure one-way hashing method and shall not store plain-text passwords.

**NFR-03:** The system shall allow a new user to complete registration and login using no more than 5 input fields per screen.

**NFR-04:** The system shall maintain 99% data availability during normal college project operation.

### 4. Assumptions

* Users have access to a computer or device capable of running the system.
* Users provide valid registration information.
* The college provides the event and attendance information required by the system.
* Python and SQLite are available in the development environment.

### 5. Constraints

* The system shall be developed using Python.
* SQLite shall be used as the database.
* The project shall be small enough to develop within a few weeks.
* The system shall use only the six specified functional features.
