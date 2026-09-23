const API_BASE = "";
const TOKEN_KEY = "cems_token";
const USER_KEY = "cems_user";

// State
let currentUser = null;
let currentPreviewRole = "student"; // 'student' | 'faculty' | 'admin'
let eventsCache = [];
let myRegistrationsCache = [];
let activeEventDetails = null;
let editingEventId = null;
let searchTimers = {};

// Calendar State
let calDate = new Date();

// DOM elements
const authSection = document.getElementById("auth-section");
const app = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authError = document.getElementById("auth-error");
const toast = document.getElementById("toast");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

// Modals
const eventModal = document.getElementById("event-modal");
const eventDetailsModal = document.getElementById("event-details-modal");
const feedbackModal = document.getElementById("feedback-modal");
const announcementModal = document.getElementById("announcement-modal");
const certificateModal = document.getElementById("certificate-modal");
const profileModal = document.getElementById("profile-modal");

/* Utility Functions */
function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.remove("hidden");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3400);
}

function setFormError(node, message) {
    if (!message) {
        node.classList.add("hidden");
        node.textContent = "";
        return;
    }
    node.textContent = message;
    node.classList.remove("hidden");
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    currentUser = user;
    currentPreviewRole = user.role || "student";
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    currentUser = null;
}

function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name) {
    return String(name || "User")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("");
}

/* API Client */
async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (networkErr) {
        if (!navigator.onLine) {
            throw new Error("You are offline. Showing cached campus records where available.");
        }
        throw networkErr;
    }

    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("text/csv")) {
        return response.blob();
    }

    let data = null;
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { detail: text };
        }
    }

    if (response.status === 401) {
        if (!path.startsWith("/api/auth/login")) {
            clearSession();
            showAuth();
        }
        throw new Error(data?.detail || "Session expired. Please log in.");
    }

    if (!response.ok) {
        let msg = "Request failed.";
        if (data?.detail) {
            msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        }
        throw new Error(msg);
    }
    return data;
}

/* UI Transitions */
function showAuth() {
    app.classList.add("hidden");
    authSection.classList.remove("hidden");
    closeSidebar();
}

function showApplication() {
    authSection.classList.add("hidden");
    app.classList.remove("hidden");
    updateUserDisplay();
    showSection("dashboard");
    refreshAll();
}

let dashboardRecentEventsCache = [];
let dashActiveCategory = "All";

function getGreetingPrefix() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
}

function updateDashboardGreeting() {
    const greetingElem = document.getElementById("greeting-prefix");
    const nameElem = document.getElementById("greeting-username");
    const clockElem = document.getElementById("hero-clock");

    if (greetingElem) greetingElem.textContent = getGreetingPrefix();
    if (nameElem && currentUser) {
        const firstName = currentUser.name ? currentUser.name.split(" ")[0] : "Student";
        nameElem.textContent = firstName;
    }

    if (clockElem) {
        const now = new Date();
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dayName = days[now.getDay()];
        const monthName = months[now.getMonth()];
        const dateNum = now.getDate();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        clockElem.textContent = `${dayName}, ${dateNum} ${monthName} • ${hours}:${minutes} ${ampm}`;
    }
}

function animateCounter(element, target, duration = 850) {
    if (!element) return;
    const start = Number(element.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    if (start === target) {
        element.textContent = target;
        return;
    }
    const startTime = performance.now();
    function update(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * easeOut);
        element.textContent = current;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }
    requestAnimationFrame(update);
}

function launchConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ["#dc2626", "#ef4444", "#059669", "#10b981", "#34d399", "#d97706", "#f59e0b", "#b91c1c"];

    for (let i = 0; i < 90; i++) {
        particles.push({
            x: canvas.width * 0.5 + (Math.random() - 0.5) * 100,
            y: canvas.height * 0.45 + (Math.random() - 0.5) * 60,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.8) * 18 - 2,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngle: 0,
            tiltAngleInc: Math.random() * 0.09 + 0.04,
            alpha: 1,
            rotation: Math.random() * 360,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let activeCount = 0;
        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.38; // gravity
            p.tiltAngle += p.tiltAngleInc;
            p.tilt = Math.sin(p.tiltAngle) * 12;
            p.alpha -= 0.011;
            p.rotation += 3;

            if (p.alpha > 0 && p.y < canvas.height + 20) {
                activeCount++;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
                ctx.restore();
            }
        });

        if (activeCount > 0) {
            requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    draw();
}

function updateUserDisplay() {
    const effectiveRole = currentPreviewRole || currentUser?.role || "student";
    document.getElementById("user-name").textContent = currentUser?.name || "Student User";
    document.getElementById("user-dept-text").textContent = `${currentUser?.department || "General"} • ${effectiveRole.toUpperCase()}`;
    document.getElementById("user-avatar").textContent = initials(currentUser?.name);

    document.getElementById("sidebar-user-name").textContent = currentUser?.name || "Student User";
    document.getElementById("sidebar-user-role").textContent = effectiveRole.toUpperCase();
    document.getElementById("sidebar-user-avatar").textContent = initials(currentUser?.name);

    updateDashboardGreeting();

    // Update role preview switcher active button
    document.querySelectorAll(".role-pill-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.rolePreview === effectiveRole);
    });

    // Control visibility of coordinator-only elements
    const isCoordinator = effectiveRole === "faculty" || effectiveRole === "admin";
    document.getElementById("create-event-btn").classList.toggle("hidden", !isCoordinator);
    document.getElementById("hero-create-event-btn").classList.toggle("hidden", !isCoordinator);
    document.getElementById("mark-all-present-btn").classList.toggle("hidden", !isCoordinator);
    document.getElementById("create-notice-btn").classList.toggle("hidden", !isCoordinator);
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.hidden = true;
}

function showSection(sectionId) {
    document.querySelectorAll(".page-section").forEach((sec) => {
        sec.classList.toggle("active-section", sec.id === sectionId);
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.section === sectionId);
    });

    const titles = {
        dashboard: "Dashboard",
        events: "Events",
        calendar: "Calendar",
        "my-registrations": "My Registrations",
        attendance: "Attendance",
        announcements: "Notices",
        reports: "Reports",
    };
    document.getElementById("header-section-title").textContent = titles[sectionId] || "Dashboard";
    closeSidebar();

    if (sectionId === "calendar") renderCalendar();
}

function debounceSearch(key, callback) {
    window.clearTimeout(searchTimers[key]);
    searchTimers[key] = window.setTimeout(callback, 260);
}

/* Master Data Refresh */
async function refreshAll() {
    try {
        await Promise.all([
            loadDashboard(),
            loadEvents(),
            loadMyRegistrations(),
            loadAnnouncements(),
            loadReports(),
        ]);
    } catch (error) {
        showToast(error.message, true);
    }
}

/* DASHBOARD */
function renderDashboardFeatured(category = "All") {
    dashActiveCategory = category;
    const featuredContainer = document.getElementById("dashboard-featured-events");
    let items = dashboardRecentEventsCache;
    if (category && category !== "All") {
        items = items.filter((ev) => ev.category && ev.category.toLowerCase().includes(category.toLowerCase()));
    }

    if (!items.length) {
        featuredContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 24px; text-align: center;">No ${category !== "All" ? category : ""} events found currently.</div>`;
        return;
    }

    featuredContainer.innerHTML = items
        .slice(0, 4)
        .map((ev) => {
            const pct = ev.max_capacity ? Math.min(100, Math.round((ev.registrations / ev.max_capacity) * 100)) : 0;
            return `
            <div class="featured-event-mini-card" onclick="openEventDetails(${ev.id})">
                <div class="mini-card-top">
                    <span class="category-tag">${escapeHtml(ev.category)}</span>
                    <span class="status ${escapeHtml(ev.status)}">${escapeHtml(ev.status)}</span>
                </div>
                <h4 class="mini-card-name">${escapeHtml(ev.name)}</h4>
                <div class="mini-card-meta">
                    <span>${escapeHtml(formatDate(ev.event_date))}</span>
                    <span class="meta-dot">•</span>
                    <span>${escapeHtml(ev.venue)}</span>
                </div>
                <div class="mini-card-capacity">
                    <span>${ev.registrations} / ${ev.max_capacity} Seats</span>
                    <span class="capacity-pct-label">${pct}%</span>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width: ${pct}%"></div>
                </div>
            </div>`;
        })
        .join("");
}

async function loadDashboard() {
    const data = await api("/api/dashboard");
    updateDashboardGreeting();

    // Smooth Numerical Count-Up Animations
    animateCounter(document.getElementById("stat-events"), data.total_events);
    animateCounter(document.getElementById("stat-registrations"), data.total_registrations);
    animateCounter(document.getElementById("stat-present"), data.total_present);
    animateCounter(document.getElementById("stat-my-regs"), data.my_registrations_count);

    document.getElementById("stat-upcoming-badge").textContent = `${data.upcoming_events_count} upcoming`;
    document.getElementById("stat-rate-text").textContent = `${data.attendance_rate}% attendance rate`;
    document.getElementById("nav-my-count").textContent = data.my_registrations_count;

    // Cache recent events and render with active filter
    dashboardRecentEventsCache = data.recent_events || [];
    renderDashboardFeatured(dashActiveCategory);

    // Bulletins widget with interactive styling
    const bulletinsContainer = document.getElementById("dashboard-announcements-list");
    if (!data.announcements.length) {
        bulletinsContainer.innerHTML = `<div class="empty-state">No active campus notices.</div>`;
    } else {
        bulletinsContainer.innerHTML = data.announcements
            .map(
                (a) => `
            <div class="notice-item ${a.category === 'Urgent' ? 'urgent' : ''}" style="cursor: pointer; transition: transform 180ms ease;" onclick="showSection('announcements')">
                <div class="notice-top">
                    <strong>${escapeHtml(a.category.toUpperCase())}</strong>
                    <span>${new Date(a.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                </div>
                <h5 class="notice-title">${escapeHtml(a.title)}</h5>
                <p class="notice-snippet">${escapeHtml(a.content.substring(0, 85))}${a.content.length > 85 ? "..." : ""}</p>
            </div>`
            )
            .join("");

        // Also set top banner ticker if urgent notice exists
        const urgent = data.announcements.find((a) => a.category === "Urgent") || data.announcements[0];
        if (urgent) {
            document.getElementById("ticker-text").textContent = `${urgent.title}: ${urgent.content}`;
            document.getElementById("notices-ticker").classList.remove("hidden");
        }
    }
}

/* EVENTS HUB */
async function loadEvents() {
    const q = document.getElementById("event-search").value.trim();
    const dept = document.getElementById("event-dept-filter").value;
    const status = document.getElementById("event-status-filter").value;
    const activeCategory = document.querySelector(".category-pill.active")?.dataset.category || "All";

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (dept) params.set("department", dept);
    if (status) params.set("status", status);
    if (activeCategory && activeCategory !== "All") params.set("category", activeCategory);

    eventsCache = await api(`/api/events?${params.toString()}`);
    document.getElementById("nav-events-count").textContent = eventsCache.length;

    renderEventsGrid();
    renderEventsTable();
    populateAttendanceEventDropdown();
}

function renderEventsGrid() {
    const container = document.getElementById("events-grid-view");
    if (!eventsCache.length) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">No campus events found matching your criteria.</div>`;
        return;
    }

    const effectiveRole = currentPreviewRole || currentUser?.role || "student";
    const canManage = effectiveRole === "faculty" || effectiveRole === "admin";

    container.innerHTML = eventsCache
        .map((ev) => {
            const pct = ev.max_capacity ? Math.min(100, Math.round((ev.registrations / ev.max_capacity) * 100)) : 0;
            const isFull = ev.registrations >= ev.max_capacity;

            let actionBtn = "";
            if (ev.is_registered) {
                actionBtn = `<button type="button" class="secondary-btn" style="color: #059669;" onclick="openEventDetails(${ev.id})">✓ Registered</button>`;
            } else if (isFull) {
                actionBtn = `<button type="button" class="secondary-btn" disabled>Full</button>`;
            } else if (ev.status === "cancelled") {
                actionBtn = `<button type="button" class="secondary-btn" disabled>Cancelled</button>`;
            } else {
                actionBtn = `<button type="button" class="primary-btn" onclick="quickRegisterEvent(${ev.id})">Register</button>`;
            }

            const editBtn = (canManage || ev.created_by === currentUser?.id)
                ? `<button type="button" class="ghost-btn" onclick="openEventModal(${ev.id})">Edit</button>`
                : "";

            return `
            <div class="event-card">
                <div class="card-top-banner">
                    <span class="category-tag">${escapeHtml(ev.category)}</span>
                    <div class="event-date-badge">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${escapeHtml(formatDate(ev.event_date))}</span>
                    </div>
                </div>

                <div class="event-card-body">
                    <h3 class="event-card-title" onclick="openEventDetails(${ev.id})">${escapeHtml(ev.name)}</h3>
                    <p class="event-card-desc">${escapeHtml(ev.description || "No description provided.")}</p>

                    <div class="event-details-tags">
                        <div class="tag-row" title="Venue">
                            <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${escapeHtml(ev.venue)}</span>
                        </div>
                        <div class="tag-row" title="Schedule">
                            <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span>${escapeHtml(ev.time_range)}</span>
                        </div>
                        <div class="tag-row" title="Department">
                            <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"></path><path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"></path></svg>
                            <span>${escapeHtml(ev.department)}</span>
                        </div>
                    </div>

                    <div class="capacity-meter-wrap">
                        <div class="meter-labels">
                            <span>${ev.registrations} / ${ev.max_capacity} registered</span>
                            <strong>${pct}%</strong>
                        </div>
                        <div class="meter-track">
                            <div class="meter-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>

                <div class="event-card-footer">
                    <div class="event-rating-mini">
                        <span>★ ${ev.average_rating ? ev.average_rating.toFixed(1) : 'New'}</span>
                        <small>(${ev.feedback_count})</small>
                    </div>
                    <div class="card-actions">
                        ${editBtn}
                        <button type="button" class="secondary-btn" onclick="openEventDetails(${ev.id})">Details</button>
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
        })
        .join("");
}

function renderEventsTable() {
    const tbody = document.getElementById("events-table-body");
    if (!eventsCache.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="text-align: center;">No events found.</td></tr>`;
        return;
    }

    tbody.innerHTML = eventsCache
        .map(
            (ev) => `
        <tr>
            <td>
                <strong>${escapeHtml(ev.name)}</strong>
                <div style="font-size: 11px; color: var(--muted);">${escapeHtml(ev.department)}</div>
            </td>
            <td>
                <span class="category-tag">${escapeHtml(ev.category)}</span>
                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">${escapeHtml(ev.venue)}</div>
            </td>
            <td>
                ${escapeHtml(formatDate(ev.event_date))}
                <div style="font-size: 11px; color: var(--muted);">${escapeHtml(ev.time_range)}</div>
            </td>
            <td>${ev.registrations} / ${ev.max_capacity}</td>
            <td>★ ${ev.average_rating ? ev.average_rating.toFixed(1) : "—"}</td>
            <td><span class="status ${escapeHtml(ev.status)}">${escapeHtml(ev.status)}</span></td>
            <td>
                <button type="button" class="secondary-btn" onclick="openEventDetails(${ev.id})">View Details</button>
            </td>
        </tr>`
        )
        .join("");
}

/* MY REGISTRATIONS */
async function loadMyRegistrations() {
    myRegistrationsCache = await api("/api/registrations/my");
    document.getElementById("nav-my-count").textContent = myRegistrationsCache.length;
    document.getElementById("stat-my-regs").textContent = myRegistrationsCache.length;

    const tbody = document.getElementById("my-registrations-table");
    if (!myRegistrationsCache.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px;" class="empty-state">You have not registered for any events yet. Browse the Events Directory to get started.</td></tr>`;
        return;
    }

    tbody.innerHTML = myRegistrationsCache
        .map((reg) => {
            const isAttended = reg.attendance_status === "present";
            let certAction = `<span style="color: var(--muted); font-size: 12px;">Attendance required</span>`;
            if (isAttended) {
                certAction = `<button type="button" class="primary-btn" style="padding: 5px 12px; font-size: 12px;" onclick="viewCertificate(${reg.id})">View Certificate</button>`;
            }

            let unregisterBtn = "";
            if (reg.attendance_status === "unmarked") {
                unregisterBtn = `<button type="button" class="ghost-btn" style="color: var(--danger);" onclick="cancelRegistration(${reg.id})">Cancel</button>`;
            }

            return `
            <tr>
                <td>
                    <strong>${escapeHtml(reg.event_name)}</strong>
                </td>
                <td>
                    <span class="category-tag">${escapeHtml(reg.event_category)}</span>
                    <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">📍 ${escapeHtml(reg.event_venue)}</div>
                </td>
                <td>
                    ${escapeHtml(formatDate(reg.event_date))}
                    <div style="font-size: 11px; color: var(--muted);">${escapeHtml(reg.event_time)}</div>
                </td>
                <td>
                    <span class="status ${escapeHtml(reg.attendance_status)}">${escapeHtml(reg.attendance_status)}</span>
                </td>
                <td>${certAction}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="secondary-btn" style="padding: 6px 10px; font-size: 12px;" onclick="openEventDetails(${reg.event_id})">Details</button>
                        ${unregisterBtn}
                    </div>
                </td>
            </tr>`;
        })
        .join("");
}

async function quickRegisterEvent(eventId) {
    try {
        await api("/api/registrations", {
            method: "POST",
            body: JSON.stringify({ event_id: eventId }),
        });
        launchConfetti();
        showToast("🎉 Successfully registered for event!");
        await refreshAll();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function cancelRegistration(regId) {
    if (!confirm("Are you sure you want to cancel your registration? This will release your seat for other students.")) {
        return;
    }
    try {
        await api(`/api/registrations/${regId}`, { method: "DELETE" });
        showToast("Registration cancelled.");
        await refreshAll();
    } catch (error) {
        showToast(error.message, true);
    }
}

/* EVENT DETAILS MODAL */
async function openEventDetails(eventId) {
    try {
        const ev = await api(`/api/events/${eventId}`);
        activeEventDetails = ev;

        document.getElementById("details-category-tag").textContent = ev.category;
        document.getElementById("details-event-name").textContent = ev.name;
        document.getElementById("details-datetime").textContent = `${formatDate(ev.event_date)} • ${ev.time_range}`;
        document.getElementById("details-venue").textContent = ev.venue;
        document.getElementById("details-dept").textContent = ev.department;
        document.getElementById("details-organizer").textContent = ev.creator_name || "College Staff";
        document.getElementById("details-description-text").textContent = ev.description || "No further details provided.";

        const pct = ev.max_capacity ? Math.min(100, Math.round((ev.registrations / ev.max_capacity) * 100)) : 0;
        document.getElementById("details-capacity-text").textContent = `${ev.registrations} of ${ev.max_capacity} Seats Enrolled (${ev.available_seats} remaining)`;
        document.getElementById("details-capacity-bar").style.width = `${pct}%`;

        const statusBadge = document.getElementById("details-status-badge");
        statusBadge.textContent = ev.status.toUpperCase();
        statusBadge.className = `status ${ev.status}`;

        document.getElementById("details-rating-badge").textContent = `★ ${ev.average_rating ? ev.average_rating.toFixed(1) : "0.0"} (${ev.feedback_count} reviews)`;

        // Register button state
        const regBtn = document.getElementById("details-register-btn");
        const fbBtn = document.getElementById("details-feedback-btn");

        if (ev.is_registered) {
            regBtn.textContent = "Cancel Registration";
            regBtn.className = "secondary-btn";
            regBtn.style.color = "var(--danger)";
            regBtn.onclick = async () => {
                const myReg = myRegistrationsCache.find((r) => r.event_id === ev.id);
                if (myReg) {
                    await cancelRegistration(myReg.id);
                    closeEventDetailsModal();
                }
            };
            fbBtn.classList.remove("hidden");
            fbBtn.onclick = () => openFeedbackModal(ev.id);
        } else if (ev.registrations >= ev.max_capacity) {
            regBtn.textContent = "Event Full";
            regBtn.className = "primary-btn";
            regBtn.disabled = true;
            fbBtn.classList.add("hidden");
        } else {
            regBtn.textContent = "Register for Event";
            regBtn.className = "primary-btn";
            regBtn.disabled = false;
            regBtn.onclick = async () => {
                await quickRegisterEvent(ev.id);
                closeEventDetailsModal();
            };
            fbBtn.classList.add("hidden");
        }

        // Load reviews
        loadEventReviews(ev.id);

        eventDetailsModal.classList.remove("hidden");
    } catch (error) {
        showToast(error.message, true);
    }
}

async function loadEventReviews(eventId) {
    const container = document.getElementById("details-reviews-list");
    try {
        const reviews = await api(`/api/events/${eventId}/feedback`);
        if (!reviews.length) {
            container.innerHTML = `<p style="font-size: 13px; color: var(--muted);">No student feedback posted yet.</p>`;
            return;
        }
        container.innerHTML = reviews
            .map(
                (r) => `
            <div class="review-item">
                <div class="review-top">
                    <strong>${escapeHtml(r.user_name)}</strong>
                    <span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
                </div>
                <div class="review-comment">${escapeHtml(r.comment || "Rated without comment.")}</div>
            </div>`
            )
            .join("");
    } catch {
        container.innerHTML = `<p style="font-size: 13px; color: var(--muted);">Could not load reviews.</p>`;
    }
}

function closeEventDetailsModal() {
    eventDetailsModal.classList.add("hidden");
    activeEventDetails = null;
}

/* ATTENDANCE HUB */
function populateAttendanceEventDropdown() {
    const select = document.getElementById("attendance-event-select");
    const currentVal = select.value;
    select.innerHTML = `<option value="">Choose an event to track...</option>` +
        eventsCache
            .map((ev) => `<option value="${ev.id}">${escapeHtml(ev.name)} (${formatDate(ev.event_date)})</option>`)
            .join("");
    if (currentVal && eventsCache.some((e) => String(e.id) === String(currentVal))) {
        select.value = currentVal;
    } else if (eventsCache.length > 0 && !select.value) {
        select.value = eventsCache[0].id;
        loadAttendanceRoster();
    }
}

async function loadAttendanceRoster() {
    const eventId = document.getElementById("attendance-event-select").value;
    const q = document.getElementById("attendance-search-input").value.trim();
    const status = document.getElementById("attendance-status-select").value;

    const tbody = document.getElementById("attendance-roster-body");
    if (!eventId) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px;" class="empty-state">Select an event above to view attendee roster.</td></tr>`;
        return;
    }

    const params = new URLSearchParams();
    params.set("event_id", eventId);
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);

    try {
        const roster = await api(`/api/attendance?${params.toString()}`);

        // Update live meter
        const total = roster.length;
        const present = roster.filter((r) => r.attendance === "present").length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        document.getElementById("meter-counts").textContent = `${present} / ${total} Students Checked In`;
        document.getElementById("meter-percentage").textContent = `${pct}% Attendance`;
        document.getElementById("meter-fill-bar").style.width = `${pct}%`;

        if (!roster.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px;" class="empty-state">No registered students found for this event.</td></tr>`;
            return;
        }

        const effectiveRole = currentPreviewRole || currentUser?.role || "student";
        const canMark = effectiveRole === "faculty" || effectiveRole === "admin";

        tbody.innerHTML = roster
            .map(
                (item) => `
            <tr>
                <td><strong>${escapeHtml(item.student_roll || "ROLL-" + item.student_id)}</strong></td>
                <td>${escapeHtml(item.student_name)}</td>
                <td>${escapeHtml(item.student_department || "General")}</td>
                <td>${escapeHtml(item.student_email || "—")}</td>
                <td><span class="status ${escapeHtml(item.attendance)}">${escapeHtml(item.attendance)}</span></td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="primary-btn" style="padding: 6px 12px; font-size: 12px; background: #059669;" ${!canMark ? 'disabled title="Only coordinators can mark attendance"' : ''} onclick="markAttendee(${item.registration_id}, 'present')">Present</button>
                        <button type="button" class="secondary-btn" style="padding: 6px 12px; font-size: 12px;" ${!canMark ? 'disabled title="Only coordinators can mark attendance"' : ''} onclick="markAttendee(${item.registration_id}, 'absent')">Absent</button>
                    </div>
                </td>
            </tr>`
            )
            .join("");
    } catch (error) {
        showToast(error.message, true);
    }
}

async function markAttendee(registrationId, status) {
    try {
        await api(`/api/attendance/${registrationId}`, {
            method: "PUT",
            body: JSON.stringify({ status }),
        });
        showToast(`Attendee marked ${status}.`);
        await loadAttendanceRoster();
        await loadDashboard();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function markAllPresent() {
    const eventId = document.getElementById("attendance-event-select").value;
    if (!eventId) return;

    try {
        const roster = await api(`/api/attendance?event_id=${eventId}`);
        const regIds = roster.map((r) => r.registration_id);
        if (!regIds.length) {
            showToast("No students registered for this event.");
            return;
        }
        await api("/api/attendance/bulk", {
            method: "POST",
            body: JSON.stringify({ registration_ids: regIds, status: "present" }),
        });
        showToast(`Marked all ${regIds.length} attendees present!`);
        await loadAttendanceRoster();
        await loadDashboard();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function exportAttendanceCsv() {
    const eventId = document.getElementById("attendance-event-select").value;
    if (!eventId) {
        showToast("Select an event first to export its attendance sheet.", true);
        return;
    }
    try {
        const blob = await api(`/api/attendance/export/${eventId}`);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_event_${eventId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Attendance CSV downloaded successfully!");
    } catch (error) {
        showToast(error.message, true);
    }
}

/* CERTIFICATES */
async function viewCertificate(registrationId) {
    try {
        const cert = await api(`/api/registrations/${registrationId}/certificate`);
        document.getElementById("cert-student-name").textContent = cert.student_name;
        document.getElementById("cert-student-meta").textContent = `Roll No: ${cert.student_roll || "N/A"} | Department of ${cert.student_department || "College"}`;
        document.getElementById("cert-event-title").textContent = cert.event_name;
        document.getElementById("cert-event-meta").textContent = `Conducted on ${formatDate(cert.event_date)} at ${cert.event_venue}`;
        document.getElementById("cert-id-text").textContent = cert.certificate_id;
        document.getElementById("cert-hash-text").textContent = cert.verification_code;
        document.getElementById("cert-issue-date").textContent = cert.issue_date;

        certificateModal.classList.remove("hidden");
        launchConfetti();
    } catch (error) {
        showToast(error.message, true);
    }
}

/* CAMPUS CALENDAR */
function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("cal-month-title").textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const grid = document.getElementById("calendar-days-grid");
    grid.innerHTML = "";

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.innerHTML = `<span class="cal-day-num">${prevMonthDays - i}</span>`;
        grid.appendChild(cell);
    }

    const today = new Date();
    // Current month days
    for (let d = 1; d <= totalDays; d++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d) {
            cell.classList.add("today");
        }

        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cell.innerHTML = `<span class="cal-day-num">${d}</span>`;

        // Find events on this date
        const dayEvents = eventsCache.filter((e) => e.event_date === dateStr);
        dayEvents.forEach((ev) => {
            const pill = document.createElement("div");
            let catClass = "tech";
            if (ev.category.includes("Workshop")) catClass = "workshop";
            else if (ev.category.includes("Cultural")) catClass = "cultural";
            else if (ev.category.includes("Sports")) catClass = "sports";

            pill.className = `cal-event-pill ${catClass}`;
            pill.textContent = ev.name;
            pill.title = `${ev.name} (${ev.time_range}) @ ${ev.venue}`;
            pill.onclick = (e) => {
                e.stopPropagation();
                openEventDetails(ev.id);
            };
            cell.appendChild(pill);
        });

        grid.appendChild(cell);
    }
}

/* ANNOUNCEMENTS & NOTICES */
async function loadAnnouncements() {
    try {
        const notices = await api("/api/announcements");
        const list = document.getElementById("full-announcements-list");
        if (!notices.length) {
            list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">No campus notices posted yet.</div>`;
            return;
        }

        const effectiveRole = currentPreviewRole || currentUser?.role || "student";
        const canDelete = effectiveRole === "admin";

        list.innerHTML = notices
            .map(
                (n) => `
            <div class="notice-full-card ${n.category === 'Urgent' ? 'urgent' : ''}">
                <div class="notice-author-row">
                    <span class="category-tag">${escapeHtml(n.category)}</span>
                    <span>${new Date(n.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <h3 style="font-size: 17px; font-weight: 700;">${escapeHtml(n.title)}</h3>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">${escapeHtml(n.content)}</p>
                <div style="font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-light);">
                    <span>Issued by: <strong>${escapeHtml(n.author_name)}</strong></span>
                    ${canDelete ? `<button type="button" class="ghost-btn" style="color: var(--danger);" onclick="deleteAnnouncement(${n.id})">Delete</button>` : ""}
                </div>
            </div>`
            )
            .join("");
    } catch (error) {
        showToast(error.message, true);
    }
}

async function deleteAnnouncement(annId) {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
        await api(`/api/announcements/${annId}`, { method: "DELETE" });
        showToast("Notice removed.");
        await loadAnnouncements();
        await loadDashboard();
    } catch (error) {
        showToast(error.message, true);
    }
}

/* REPORTS */
async function loadReports() {
    try {
        const rep = await api("/api/reports");
        document.getElementById("rep-total-events").textContent = rep.total_events;
        document.getElementById("rep-total-regs").textContent = rep.total_registrations;
        document.getElementById("rep-total-present").textContent = rep.total_present;
        document.getElementById("rep-overall-rate").textContent = `${rep.overall_attendance_rate}%`;

        const tbody = document.getElementById("reports-audit-table");
        if (!rep.events.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="text-align: center; padding: 30px;">No event records found for audit.</td></tr>`;
            return;
        }

        tbody.innerHTML = rep.events
            .map(
                (row) => `
            <tr>
                <td><strong>${escapeHtml(row.event_name)}</strong></td>
                <td><span class="category-tag">${escapeHtml(row.category)}</span></td>
                <td>${escapeHtml(formatDate(row.event_date))}</td>
                <td>${escapeHtml(row.venue)}</td>
                <td>${row.capacity}</td>
                <td>${row.registrations}</td>
                <td style="color: var(--success); font-weight: 600;">${row.present}</td>
                <td style="color: var(--danger); font-weight: 600;">${row.absent}</td>
                <td><strong>${row.attendance_percentage}%</strong></td>
                <td>★ ${row.average_rating ? row.average_rating.toFixed(1) : "—"}</td>
            </tr>`
            )
            .join("");
    } catch (error) {
        showToast(error.message, true);
    }
}

async function exportFullReportsCsv() {
    try {
        const blob = await api("/api/reports/export");
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "college_events_summary_report.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("Summary report CSV downloaded successfully!");
    } catch (error) {
        showToast(error.message, true);
    }
}

/* EVENT MODAL (CREATE / EDIT) */
function openEventModal(eventId = null) {
    editingEventId = eventId;
    const title = document.getElementById("modal-title");
    setFormError(document.getElementById("event-form-error"), "");

    if (eventId) {
        const ev = eventsCache.find((e) => e.id === eventId);
        if (ev) {
            title.textContent = "Edit Campus Event";
            document.getElementById("event-name").value = ev.name;
            document.getElementById("event-category").value = ev.category || "Technical";
            document.getElementById("event-dept").value = ev.department || "All Departments";
            document.getElementById("event-date").value = ev.event_date;
            document.getElementById("event-time").value = ev.time_range || "10:00 AM - 01:00 PM";
            document.getElementById("event-venue").value = ev.venue || "Main Auditorium";
            document.getElementById("event-capacity").value = ev.max_capacity || 100;
            document.getElementById("event-description").value = ev.description || "";
        }
    } else {
        title.textContent = "Create Campus Event";
        document.getElementById("event-form").reset();
        document.getElementById("event-capacity").value = "100";
        document.getElementById("event-time").value = "10:00 AM - 01:00 PM";
        document.getElementById("event-venue").value = "Main Auditorium";
    }
    eventModal.classList.remove("hidden");
}

function closeEventModal() {
    eventModal.classList.add("hidden");
    editingEventId = null;
    document.getElementById("event-form").reset();
}

/* FEEDBACK MODAL */
function openFeedbackModal(eventId) {
    document.getElementById("feedback-modal").dataset.eventId = eventId;
    setFormError(document.getElementById("feedback-form-error"), "");
    document.getElementById("feedback-form").reset();
    setStarRating(5);
    feedbackModal.classList.remove("hidden");
}

function closeFeedbackModal() {
    feedbackModal.classList.add("hidden");
}

function setStarRating(rating) {
    document.getElementById("feedback-rating").value = rating;
    document.querySelectorAll(".star-btn").forEach((btn) => {
        btn.classList.toggle("selected", Number(btn.dataset.rating) <= rating);
    });
}

/* PROFILE MODAL */
function openProfileModal() {
    closeSidebar();
    document.getElementById("profile-name").value = currentUser?.name || "";
    document.getElementById("profile-email").value = currentUser?.email || "";
    document.getElementById("profile-dept").value = currentUser?.department || "";
    document.getElementById("profile-roll").value = currentUser?.roll_number || "";
    setFormError(document.getElementById("profile-form-error"), "");
    profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    profileModal.classList.add("hidden");
}

/* ================= EVENT LISTENERS ================= */

// Auth Switchers
document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach((item) => {
            const active = item === tab;
            item.classList.toggle("active", active);
            item.setAttribute("aria-selected", String(active));
        });
        const isLogin = tab.dataset.auth === "login";
        loginForm.classList.toggle("hidden", !isLogin);
        registerForm.classList.toggle("hidden", isLogin);
        setFormError(authError, "");
    });
});

// Auth Submissions
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFormError(authError, "");
    const submit = document.getElementById("login-submit");
    submit.disabled = true;
    try {
        const data = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: document.getElementById("login-email").value.trim(),
                password: document.getElementById("login-password").value,
            }),
        });
        saveSession(data.access_token, data.user);
        showToast("Signed in successfully!");
        showApplication();
    } catch (error) {
        setFormError(authError, error.message);
    } finally {
        submit.disabled = false;
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFormError(authError, "");
    const pass = document.getElementById("register-password").value;
    if (pass.length < 8) {
        setFormError(authError, "Password must be at least 8 characters.");
        return;
    }

    const submit = document.getElementById("register-submit");
    submit.disabled = true;
    try {
        const payload = {
            name: document.getElementById("register-name").value.trim(),
            email: document.getElementById("register-email").value.trim(),
            password: pass,
            role: document.getElementById("register-role").value,
            department: document.getElementById("register-dept").value,
            roll_number: document.getElementById("register-roll").value.trim() || null,
        };
        const data = await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        saveSession(data.access_token, data.user);
        showToast("Account created successfully!");
        showApplication();
    } catch (error) {
        setFormError(authError, error.message);
    } finally {
        submit.disabled = false;
    }
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
    clearSession();
    loginForm.reset();
    registerForm.reset();
    showAuth();
});

// Navigation items
document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
});

document.querySelectorAll("[data-section-target]").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.sectionTarget));
});

// Role Preview Switcher Buttons
document.querySelectorAll(".role-pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        currentPreviewRole = btn.dataset.rolePreview;
        updateUserDisplay();
        renderEventsGrid();
        loadAttendanceRoster();
        loadAnnouncements();
        showToast(`Viewing interface as ${currentPreviewRole.toUpperCase()}`);
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    });
});

// Interactive Metric Cards click to jump to section
document.querySelectorAll(".interactive-metric").forEach((card) => {
    card.addEventListener("click", () => {
        const target = card.dataset.targetSection;
        if (target) showSection(target);
    });
});

// Quick Shortcut Chips on Hero
document.querySelectorAll(".quick-shortcut-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        const target = chip.dataset.sectionTarget;
        if (target) showSection(target);
    });
});

// Dashboard Featured Category Filter Pills
document.querySelectorAll(".dash-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".dash-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderDashboardFeatured(btn.dataset.dashCat);
    });
});

// Update dashboard greeting & clock every 30s
setInterval(updateDashboardGreeting, 30000);

// Mobile Sidebar
document.getElementById("menu-toggle").addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarBackdrop.hidden = !sidebar.classList.contains("open");
});
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener("click", closeSidebar);
}
sidebarBackdrop.addEventListener("click", closeSidebar);

// Event Filters & Search
document.getElementById("event-search").addEventListener("input", () => {
    debounceSearch("events", loadEvents);
});
document.getElementById("event-dept-filter").addEventListener("change", loadEvents);
document.getElementById("event-status-filter").addEventListener("change", loadEvents);

document.querySelectorAll(".category-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
        document.querySelectorAll(".category-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        loadEvents();
    });
});

// Grid / Table View Toggle
document.getElementById("view-grid-btn").addEventListener("click", () => {
    document.getElementById("view-grid-btn").classList.add("active");
    document.getElementById("view-table-btn").classList.remove("active");
    document.getElementById("events-grid-view").classList.remove("hidden");
    document.getElementById("events-table-view").classList.add("hidden");
});

document.getElementById("view-table-btn").addEventListener("click", () => {
    document.getElementById("view-table-btn").classList.add("active");
    document.getElementById("view-grid-btn").classList.remove("active");
    document.getElementById("events-grid-view").classList.add("hidden");
    document.getElementById("events-table-view").classList.remove("hidden");
});

// Calendar Navigation
document.getElementById("cal-prev-month").addEventListener("click", () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById("cal-next-month").addEventListener("click", () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
});
document.getElementById("cal-today-btn").addEventListener("click", () => {
    calDate = new Date();
    renderCalendar();
});

// Attendance Controls
document.getElementById("attendance-event-select").addEventListener("change", loadAttendanceRoster);
document.getElementById("attendance-status-select").addEventListener("change", loadAttendanceRoster);
document.getElementById("attendance-search-input").addEventListener("input", () => {
    debounceSearch("att_roster", loadAttendanceRoster);
});
document.getElementById("mark-all-present-btn").addEventListener("click", markAllPresent);
document.getElementById("export-attendance-csv-btn").addEventListener("click", exportAttendanceCsv);
document.getElementById("export-full-report-csv-btn").addEventListener("click", exportFullReportsCsv);

// Modals Trigger Buttons
document.getElementById("create-event-btn").addEventListener("click", () => openEventModal());
document.getElementById("hero-create-event-btn").addEventListener("click", () => openEventModal());
document.getElementById("hero-explore-btn").addEventListener("click", () => showSection("events"));
document.getElementById("modal-close").addEventListener("click", closeEventModal);
document.getElementById("cancel-event").addEventListener("click", closeEventModal);

document.getElementById("details-modal-close").addEventListener("click", closeEventDetailsModal);
document.getElementById("details-close-btn").addEventListener("click", closeEventDetailsModal);

document.getElementById("feedback-modal-close").addEventListener("click", closeFeedbackModal);
document.getElementById("cancel-feedback").addEventListener("click", closeFeedbackModal);

document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", () => setStarRating(Number(btn.dataset.rating)));
});

// Certificate Modal
document.getElementById("certificate-modal-close").addEventListener("click", () => {
    certificateModal.classList.add("hidden");
});
document.getElementById("print-certificate-btn").addEventListener("click", () => {
    window.print();
});

// Announcement Modal
document.getElementById("create-notice-btn").addEventListener("click", () => {
    document.getElementById("announcement-form").reset();
    setFormError(document.getElementById("announcement-form-error"), "");
    announcementModal.classList.remove("hidden");
});
document.getElementById("announcement-modal-close").addEventListener("click", () => {
    announcementModal.classList.add("hidden");
});
document.getElementById("cancel-announcement").addEventListener("click", () => {
    announcementModal.classList.add("hidden");
});

// Profile Modal
document.getElementById("open-profile-btn").addEventListener("click", openProfileModal);
document.getElementById("profile-modal-close").addEventListener("click", closeProfileModal);
document.getElementById("cancel-profile").addEventListener("click", closeProfileModal);

// Ticker Close
document.getElementById("ticker-close").addEventListener("click", () => {
    document.getElementById("notices-ticker").classList.add("hidden");
});

// Modal Overlay Click to Dismiss
[eventModal, eventDetailsModal, feedbackModal, announcementModal, certificateModal, profileModal].forEach((m) => {
    m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.add("hidden");
    });
});

// Forms Submissions
document.getElementById("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("save-event");
    saveBtn.disabled = true;
    setFormError(document.getElementById("event-form-error"), "");

    const payload = {
        name: document.getElementById("event-name").value.trim(),
        category: document.getElementById("event-category").value,
        department: document.getElementById("event-dept").value,
        event_date: document.getElementById("event-date").value,
        time_range: document.getElementById("event-time").value.trim(),
        venue: document.getElementById("event-venue").value.trim(),
        max_capacity: Number(document.getElementById("event-capacity").value),
        description: document.getElementById("event-description").value.trim() || null,
    };

    try {
        if (editingEventId) {
            await api(`/api/events/${editingEventId}`, { method: "PUT", body: JSON.stringify(payload) });
            showToast("Event updated successfully!");
        } else {
            await api("/api/events", { method: "POST", body: JSON.stringify(payload) });
            showToast("New event created!");
        }
        closeEventModal();
        await refreshAll();
    } catch (error) {
        setFormError(document.getElementById("event-form-error"), error.message);
    } finally {
        saveBtn.disabled = false;
    }
});

document.getElementById("feedback-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const eventId = Number(feedbackModal.dataset.eventId);
    const rating = Number(document.getElementById("feedback-rating").value);
    const comment = document.getElementById("feedback-comment").value.trim() || null;

    try {
        await api(`/api/events/${eventId}/feedback`, {
            method: "POST",
            body: JSON.stringify({ rating, comment }),
        });
        showToast("Feedback submitted. Thank you!");
        closeFeedbackModal();
        if (activeEventDetails && activeEventDetails.id === eventId) {
            openEventDetails(eventId);
        }
        await loadEvents();
    } catch (error) {
        setFormError(document.getElementById("feedback-form-error"), error.message);
    }
});

document.getElementById("announcement-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById("announcement-title").value.trim(),
        category: document.getElementById("announcement-category").value,
        content: document.getElementById("announcement-content").value.trim(),
    };

    try {
        await api("/api/announcements", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        showToast("Notice posted to campus board!");
        announcementModal.classList.add("hidden");
        await loadAnnouncements();
        await loadDashboard();
    } catch (error) {
        setFormError(document.getElementById("announcement-form-error"), error.message);
    }
});

document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById("profile-name").value.trim(),
        department: document.getElementById("profile-dept").value.trim() || "General",
        roll_number: document.getElementById("profile-roll").value.trim() || null,
    };

    try {
        const updated = await api("/api/auth/profile", {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        currentUser = updated;
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        updateUserDisplay();
        showToast("Profile updated!");
        closeProfileModal();
    } catch (error) {
        setFormError(document.getElementById("profile-form-error"), error.message);
    }
});

// Escape key to close all modals
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeEventModal();
        closeEventDetailsModal();
        closeFeedbackModal();
        closeProfileModal();
        announcementModal.classList.add("hidden");
        certificateModal.classList.add("hidden");
        closeSidebar();
        closeAiAssistant();
    }
});

/* =============================================================
 * AI Assistant & Recommendations Client
 * =========================================================== */
let aiChatHistory = [];
let isAiGenerating = false;

const aiLauncher = document.getElementById("ai-chat-launcher");
const aiPanel = document.getElementById("ai-assistant-panel");
const aiCloseBtn = document.getElementById("ai-close-panel-btn");
const aiClearBtn = document.getElementById("ai-clear-chat-btn");
const aiForm = document.getElementById("ai-input-form");
const aiInput = document.getElementById("ai-user-input");
const aiSendBtn = document.getElementById("ai-send-btn");
const aiMessagesContainer = document.getElementById("ai-messages-container");
const sidebarAiBtn = document.getElementById("sidebar-ai-btn");
const heroAiBtn = document.getElementById("hero-ai-recommendations-btn");
const eventsAiBtn = document.getElementById("events-ai-recommend-btn");

function formatAiMarkdown(text) {
    if (!text) return "";
    let safe = escapeHtml(text);
    
    // Bold **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    safe = safe.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Process paragraphs and lists
    const lines = safe.split("\n");
    let inList = false;
    let html = "";
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            continue;
        }
        
        // Bullet point
        if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
            if (!inList) {
                html += "<ul>";
                inList = true;
            }
            html += `<li>${line.substring(2).trim()}</li>`;
        } else if (/^\d+\.\s/.test(line)) {
            if (!inList) {
                html += "<ul>";
                inList = true;
            }
            html += `<li>${line.replace(/^\d+\.\s*/, "").trim()}</li>`;
        } else {
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            html += `<p>${line}</p>`;
        }
    }
    if (inList) {
        html += "</ul>";
    }
    return html;
}

function openAiAssistant(initialPrompt = null) {
    if (!aiPanel) return;
    aiPanel.classList.remove("hidden");
    if (aiChatHistory.length === 0) {
        showAiWelcomeMessage();
    }
    if (initialPrompt) {
        aiInput.value = initialPrompt;
        handleAiSubmit();
    } else {
        setTimeout(() => aiInput?.focus(), 150);
    }
}

function closeAiAssistant() {
    if (!aiPanel) return;
    aiPanel.classList.add("hidden");
}

function toggleAiAssistant() {
    if (!aiPanel) return;
    if (aiPanel.classList.contains("hidden")) {
        openAiAssistant();
    } else {
        closeAiAssistant();
    }
}

function showAiWelcomeMessage() {
    if (!aiMessagesContainer) return;
    aiMessagesContainer.innerHTML = "";
    const userName = currentUser ? currentUser.name.split(" ")[0] : "Student";
    const dept = currentUser?.department ? ` (${currentUser.department})` : "";
    const welcomeText = `Hello **${userName}**${dept}! I am your **CampusConnect AI Assistant**.\n\nI have real-time access to all campus events, seat capacity, notices, and certificate criteria. How can I help you today?`;
    renderAiMessage("assistant", welcomeText, []);
}

function renderAiMessage(role, text, recommendedEvents = []) {
    if (!aiMessagesContainer) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = `ai-msg ${role}`;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let cardsHtml = "";
    if (recommendedEvents && recommendedEvents.length > 0) {
        cardsHtml = `<div class="ai-recommended-cards">`;
        recommendedEvents.forEach((ev) => {
            const isReg = currentUser && eventsCache.some((e) => e.id === ev.id && e.is_registered);
            const regBtn = isReg
                ? `<span style="font-size: 11px; font-weight: 600; color: #10b981;">✓ Registered</span>`
                : ev.available_seats > 0
                ? `<button type="button" class="ai-card-btn primary" onclick="quickRegisterFromAi(${ev.id})">Register</button>`
                : `<span style="font-size: 11px; color: #ef4444; font-weight: 600;">Full</span>`;

            cardsHtml += `
                <div class="ai-event-card">
                    <div class="ai-event-card-top">
                        <span class="ai-event-badge">${escapeHtml(ev.category || "Event")}</span>
                        <span class="ai-event-seats">${ev.available_seats} seats remaining</span>
                    </div>
                    <h5 class="ai-event-title">${escapeHtml(ev.name)}</h5>
                    <div class="ai-event-meta">
                        <span>📅 ${escapeHtml(formatDate(ev.event_date))}</span>
                        <span>📍 ${escapeHtml(ev.venue || "Campus")}</span>
                    </div>
                    <div class="ai-event-actions">
                        <button type="button" class="ai-card-btn secondary" onclick="openEventDetails(${ev.id})">View Details</button>
                        ${regBtn}
                    </div>
                </div>
            `;
        });
        cardsHtml += `</div>`;
    }

    msgDiv.innerHTML = `
        <div class="ai-msg-bubble">
            ${role === "assistant" ? formatAiMarkdown(text) : escapeHtml(text)}
            ${cardsHtml}
        </div>
        <span class="ai-msg-time">${timeStr}</span>
    `;

    aiMessagesContainer.appendChild(msgDiv);
    aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

window.quickRegisterFromAi = async function (eventId) {
    await quickRegisterEvent(eventId);
    sendAiMessage(`I just registered for event #${eventId}. What should I know about attendance and the certificate?`);
};

function showAiTypingIndicator() {
    const typing = document.createElement("div");
    typing.id = "ai-typing-indicator";
    typing.className = "ai-typing-indicator";
    typing.innerHTML = `
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
    `;
    aiMessagesContainer.appendChild(typing);
    aiMessagesContainer.scrollTop = aiMessagesContainer.scrollHeight;
}

function removeAiTypingIndicator() {
    const indicator = document.getElementById("ai-typing-indicator");
    if (indicator) indicator.remove();
}

async function sendAiMessage(messageText) {
    if (!messageText || isAiGenerating) return;
    const text = messageText.trim();
    if (!text) return;

    isAiGenerating = true;
    if (aiSendBtn) aiSendBtn.disabled = true;
    if (aiInput) aiInput.value = "";

    // 1. Render user message
    renderAiMessage("user", text);
    aiChatHistory.push({ role: "user", text });

    // 2. Show typing indicator
    showAiTypingIndicator();

    try {
        const payload = {
            message: text,
            history: aiChatHistory.slice(-6),
        };
        const res = await api("/api/ai/assistant", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        removeAiTypingIndicator();

        const reply = res.reply || "I analyzed our event database for you.";
        const events = res.events || [];

        renderAiMessage("assistant", reply, events);
        aiChatHistory.push({ role: "model", text: reply });
    } catch (err) {
        removeAiTypingIndicator();
        renderAiMessage(
            "assistant",
            "Sorry, I encountered an issue retrieving that campus information. Please try again or ask for general event recommendations."
        );
    } finally {
        isAiGenerating = false;
        if (aiSendBtn) aiSendBtn.disabled = false;
        setTimeout(() => aiInput?.focus(), 100);
    }
}

function handleAiSubmit(e) {
    if (e) e.preventDefault();
    const val = aiInput?.value;
    if (val) sendAiMessage(val);
}

function clearAiChat() {
    aiChatHistory = [];
    showAiWelcomeMessage();
}

function setupAiAssistantListeners() {
    if (aiLauncher) {
        aiLauncher.addEventListener("click", toggleAiAssistant);
    }
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener("click", closeAiAssistant);
    }
    if (aiClearBtn) {
        aiClearBtn.addEventListener("click", clearAiChat);
    }
    if (aiForm) {
        aiForm.addEventListener("submit", handleAiSubmit);
    }
    if (sidebarAiBtn) {
        sidebarAiBtn.addEventListener("click", () => {
            closeSidebar();
            openAiAssistant();
        });
    }
    if (heroAiBtn) {
        heroAiBtn.addEventListener("click", () => {
            openAiAssistant("Recommend the best upcoming campus events for me based on my department");
        });
    }
    if (eventsAiBtn) {
        eventsAiBtn.addEventListener("click", () => {
            openAiAssistant("Recommend top events currently scheduled with open seats");
        });
    }

    // Quick prompts
    document.querySelectorAll(".ai-prompt-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const prompt = chip.getAttribute("data-prompt");
            if (prompt) {
                sendAiMessage(prompt);
            }
        });
    });
}

/* System / Supabase Status */
async function checkSystemStatus() {
    try {
        const res = await fetch("/api/system/status");
        if (res.ok) {
            const data = await res.json();
            const label = document.getElementById("db-status-label");
            const pill = document.getElementById("db-status-pill");
            if (label && pill) {
                if (data.connected) {
                    label.textContent = "Supabase Live";
                    pill.className = "db-status-pill connected";
                    pill.title = `Supabase PostgreSQL Live (${data.supabaseUrl || "Connected"})`;
                } else if (data.configured) {
                    label.textContent = "Supabase Connecting";
                    pill.className = "db-status-pill awaiting";
                    pill.title = "Supabase configured - Connecting...";
                } else {
                    label.textContent = "Supabase Ready";
                    pill.className = "db-status-pill awaiting";
                    pill.title = "Supabase Client ready. Add SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY to connect live.";
                }
            }
        }
    } catch {
        // quiet fallback
    }
}

/* Session Restoration */
async function restoreSession() {
    checkSystemStatus();
    const token = getToken();
    const stored = localStorage.getItem(USER_KEY);
    if (!token || !stored) {
        showAuth();
        return;
    }
    try {
        currentUser = JSON.parse(stored);
        currentPreviewRole = currentUser.role || "student";
        if (navigator.onLine) {
            const me = await api("/api/auth/me");
            currentUser = me;
            currentPreviewRole = me.role || "student";
            localStorage.setItem(USER_KEY, JSON.stringify(me));
        }
        showApplication();
    } catch {
        if (!navigator.onLine) {
            // Keep user logged in offline with stored credentials
            showApplication();
            return;
        }
        clearSession();
        showAuth();
    }
}

/* ==========================================================================
   PROGRESSIVE WEB APP (PWA) INITIALIZATION & INSTALL PROMPTS
   ========================================================================== */

let deferredInstallPrompt = null;

function initPWA() {
    const headerInstallBtn = document.getElementById("header-pwa-install-btn");
    const sidebarInstallBtn = document.getElementById("sidebar-pwa-install-btn");
    const offlineIndicator = document.getElementById("offline-indicator");
    const offlineRetryBtn = document.getElementById("offline-retry-btn");
    const iosModal = document.getElementById("ios-install-modal");
    const iosCloseBtn = document.getElementById("ios-install-close");
    const iosGotItBtn = document.getElementById("ios-install-got-it");

    // 1. Detect Standalone Display Mode
    const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

    // Detect iOS devices (iPhone, iPad, iPod)
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;

    function showInstallButtons() {
        if (isStandalone) return;
        if (headerInstallBtn) headerInstallBtn.classList.remove("hidden");
        if (sidebarInstallBtn) sidebarInstallBtn.classList.remove("hidden");
    }

    function hideInstallButtons() {
        if (headerInstallBtn) headerInstallBtn.classList.add("hidden");
        if (sidebarInstallBtn) sidebarInstallBtn.classList.add("hidden");
    }

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .then((reg) => {
                    console.log("[PWA] Service Worker registered successfully with scope:", reg.scope);

                    if (reg.waiting) {
                        reg.waiting.postMessage({ type: "SKIP_WAITING" });
                    }

                    reg.addEventListener("updatefound", () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener("statechange", () => {
                            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                                console.log("[PWA] Service Worker updated.");
                                showToast("App updated in background! New features ready.", false);
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.warn("[PWA] Service Worker registration failed:", err);
                });
        });
    }

    // 3. Listen for browser 'beforeinstallprompt'
    window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent default mini-infobar on mobile Chrome
        e.preventDefault();
        deferredInstallPrompt = e;
        console.log("[PWA] Captured beforeinstallprompt event");
        showInstallButtons();
    });

    // 4. Handle in-app install triggers
    async function triggerInstallFlow() {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const choiceResult = await deferredInstallPrompt.userChoice;
            console.log("[PWA] User choice outcome:", choiceResult.outcome);
            if (choiceResult.outcome === "accepted") {
                showToast("CampusConnect installed successfully! Launch it anytime from your home screen.", false);
                hideInstallButtons();
            }
            deferredInstallPrompt = null;
        } else if (isIOS) {
            if (iosModal) iosModal.classList.remove("hidden");
        } else {
            showToast("To install CampusConnect: Click the install icon in your browser address bar or menu.", false);
        }
    }

    if (headerInstallBtn) {
        headerInstallBtn.addEventListener("click", triggerInstallFlow);
    }
    if (sidebarInstallBtn) {
        sidebarInstallBtn.addEventListener("click", triggerInstallFlow);
    }

    // iOS Modal handlers
    if (iosCloseBtn && iosModal) {
        iosCloseBtn.addEventListener("click", () => iosModal.classList.add("hidden"));
    }
    if (iosGotItBtn && iosModal) {
        iosGotItBtn.addEventListener("click", () => iosModal.classList.add("hidden"));
    }
    if (iosModal) {
        iosModal.addEventListener("click", (e) => {
            if (e.target === iosModal) iosModal.classList.add("hidden");
        });
    }

    // If on iOS and not standalone, show install buttons for manual prompt
    if (isIOS && !isStandalone) {
        showInstallButtons();
    }

    // 5. Handle app installed event
    window.addEventListener("appinstalled", () => {
        console.log("[PWA] CampusConnect was successfully installed.");
        hideInstallButtons();
        showToast("CampusConnect was successfully installed!", false);
    });

    // 6. Online / Offline Connectivity Monitor
    function updateOnlineStatus() {
        if (navigator.onLine) {
            if (offlineIndicator) offlineIndicator.classList.add("hidden");
        } else {
            if (offlineIndicator) offlineIndicator.classList.remove("hidden");
            showToast("You are offline. Cached campus content is available.", true);
        }
    }

    window.addEventListener("online", () => {
        updateOnlineStatus();
        showToast("You are back online! Syncing latest campus events...", false);
        checkSystemStatus();
        if (currentUser) {
            loadDashboard();
            loadEvents();
        }
    });

    window.addEventListener("offline", () => {
        updateOnlineStatus();
    });

    if (offlineRetryBtn) {
        offlineRetryBtn.addEventListener("click", async () => {
            if (navigator.onLine) {
                showToast("Network detected! Refreshing...", false);
                location.reload();
            } else {
                showToast("Still offline. Please check your WiFi or network connection.", true);
            }
        });
    }

    // Initial check
    updateOnlineStatus();
}

// Boot
setupAiAssistantListeners();
initPWA();
restoreSession();
