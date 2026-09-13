/* Greenwood Academy — SPA (public + admin) */
(function () {
  "use strict";

  const cfg = window.CONFIG || {};
  const BASE = (cfg.API_BASE || "/api").replace(/\/+$/, "");
  const PID = cfg.PROJECT_ID || "";
  const KEY = cfg.API_KEY || "";
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  /* ─── STATE ─── */
  const state = {
    token: localStorage.getItem("ga_token") || "",
    user: JSON.parse(localStorage.getItem("ga_user") || "null"),
    students: [], teachers: [], courses: [], announcements: [],
    searchTerms: {},
  };

  /* ─── API CLIENT ─── */
  async function api(path, opts = {}) {
    const { method = "GET", body, auth } = opts;
    const h = { "Content-Type": "application/json" };

    if (auth === "user" && state.token) {
      h.Authorization = `Bearer ${state.token}`;
    } else if (auth !== "none") {
      h.Authorization = `Bearer ${KEY}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method, headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data?.error?.code;
      throw err;
    }
    return data.data || data;
  }

  /* ─── AUTH ─── */
  async function login(email, password) {
    const d = await api("/auth/login", { method: "POST", body: { email, password }, auth: "none" });
    state.token = d.token;
    state.user = d.user;
    localStorage.setItem("ga_token", d.token);
    localStorage.setItem("ga_user", JSON.stringify(d.user));
    return d;
  }

  async function signup(email, password) {
    const d = await api("/auth/signup", { method: "POST", body: { email, password }, auth: "none" });
    state.token = d.token;
    state.user = d.user;
    localStorage.setItem("ga_token", d.token);
    localStorage.setItem("ga_user", JSON.stringify(d.user));
    return d;
  }

  function logout() {
    state.token = "";
    state.user = null;
    localStorage.removeItem("ga_token");
    localStorage.removeItem("ga_user");
    navigate("#/admin/login");
  }

  function isAdmin() {
    return !!state.token && !!state.user;
  }

  /* ─── DATA QUERIES ─── */
  function q(table, params) {
    return `/projects/${PID}/${table}${params ? "?" + params : ""}`;
  }

  async function list(table, filter, order) {
    const p = [];
    if (filter) p.push(filter);
    if (order) p.push(`order=${order}`);
    p.push("limit=500");
    const d = await api(q(table, p.join("&")));
    return d.rows || [];
  }

  async function create(table, row) {
    const d = await api(q(table), { method: "POST", body: row });
    return d.row || d;
  }

  async function update(table, id, patch) {
    const d = await api(`${q(table)}/${id}`, {
      method: "PATCH",
      body: { ...patch, updated_at: new Date().toISOString() },
    });
    return d.row || d;
  }

  async function remove(table, id) {
    await api(`${q(table)}/${id}`, { method: "DELETE" });
  }

  /* ─── TOAST ─── */
  let toastTimer;
  function toast(msg, kind = "ok") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast toast-${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  /* ─── ROUTER ─── */
  function navigate(hash) {
    location.hash = hash;
  }

  function route() {
    const h = location.hash || "#/";
    const app = $("#app");

    if (h === "#/admin/login") {
      renderLogin(app);
      return;
    }
    if (h.startsWith("#/admin")) {
      if (!isAdmin()) {
        navigate("#/admin/login");
        return;
      }
      renderAdmin(app, h);
      return;
    }
    renderPublic(app, h);
  }

  /* ═══════════════════════════════════════════ */
  /*              PUBLIC PAGES                   */
  /* ═══════════════════════════════════════════ */

  function publicNav(active) {
    const links = [
      ["#/", "Home"],
      ["#/programs", "Programs"],
      ["#/faculty", "Faculty"],
      ["#/announcements", "News"],
      ["#/contact", "Contact"],
    ];
    return `<nav class="nav">
      <div class="nav-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Greenwood Academy</div>
      <div class="nav-links">${links.map(([h, t]) => `<a href="${h}" class="${active === h ? "active" : ""}">${t}</a>`).join("")}</div>
      <a href="#/admin" class="btn btn-primary btn-sm">Admin</a>
    </nav>`;
  }

  const footer = `<footer class="footer">
    <div class="footer-grid">
      <div><h4>Greenwood Academy</h4><p>Nurturing excellence in education since 1995. Empowering students to reach their full potential.</p></div>
      <div><h4>Quick Links</h4><ul><li><a href="#/programs">Programs</a></li><li><a href="#/faculty">Faculty</a></li><li><a href="#/announcements">News</a></li></ul></div>
      <div><h4>Contact</h4><ul><li>123 Academy Drive</li><li>Greenwood, CA 90210</li><li>info@greenwood.edu</li><li>(555) 123-4567</li></ul></div>
    </div>
    <div class="footer-bottom">&copy; ${new Date().getFullYear()} Greenwood Academy. All rights reserved.</div>
  </footer>`;

  function renderPublic(app, hash) {
    if (hash === "#/programs") { renderPrograms(app); return; }
    if (hash === "#/faculty") { renderFaculty(app); return; }
    if (hash === "#/announcements") { renderAnnouncements(app); return; }
    if (hash === "#/contact") { renderContact(app); return; }
    renderHome(app);
  }

  async function renderHome(app) {
    app.innerHTML = publicNav("#/") + `
      <section class="hero">
        <h1>Welcome to Greenwood Academy</h1>
        <p>A community of learners dedicated to academic excellence, personal growth, and leadership.</p>
        <a href="#/programs" class="btn">Explore Programs</a>
      </section>
      <section class="section">
        <h2 class="section-title">Why Greenwood?</h2>
        <p class="section-sub">Building tomorrow's leaders through excellence in education.</p>
        <div class="grid-4" id="statsGrid">
          <div class="stat-card"><div class="stat-value" id="statStudents">--</div><div class="stat-label">Students</div></div>
          <div class="stat-card"><div class="stat-value" id="statTeachers">--</div><div class="stat-label">Faculty</div></div>
          <div class="stat-card"><div class="stat-value" id="statCourses">--</div><div class="stat-label">Programs</div></div>
          <div class="stat-card"><div class="stat-value" id="statYears">29</div><div class="stat-label">Years of Excellence</div></div>
        </div>
      </section>
      <section class="section">
        <h2 class="section-title">Latest News</h2>
        <div class="grid-3" id="homeNews"></div>
      </section>` + footer;

    try {
      const [s, t, c, ann] = await Promise.allSettled([
        list("students"),
        list("teachers"),
        list("courses"),
        list("announcements", "is_published=eq.true", "published_at.desc"),
      ]);
      if (s.status === "fulfilled") $("#statStudents").textContent = s.value.length;
      if (t.status === "fulfilled") $("#statTeachers").textContent = t.value.length;
      if (c.status === "fulfilled") $("#statCourses").textContent = c.value.length;
      if (ann.status === "fulfilled") {
        const items = ann.value.slice(0, 3);
        $("#homeNews").innerHTML = items.length ? items.map(a => `
          <div class="card">
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.content).slice(0, 120)}${a.content.length > 120 ? "..." : ""}</p>
            <p style="margin-top:.75rem;font-size:.8rem;color:var(--text-muted)">${fmtDate(a.published_at)}</p>
          </div>`).join("")
          : '<p class="empty">No announcements yet.</p>';
      }
    } catch (e) {
      console.error("Home load error:", e);
    }
  }

  async function renderPrograms(app) {
    app.innerHTML = publicNav("#/programs") + `
      <section class="section">
        <h1 class="section-title">Programs & Courses</h1>
        <p class="section-sub">Discover our wide range of academic programs.</p>
        <div class="grid-3" id="courseList"><p class="empty">Loading...</p></div>
      </section>` + footer;
    try {
      const [courses, teachers] = await Promise.all([list("courses", "", "name.asc"), list("teachers")]);
      const tMap = Object.fromEntries(teachers.map(t => [t.id, t]));
      $("#courseList").innerHTML = courses.length ? courses.map(c => `
        <div class="card">
          <h3>${esc(c.name)}</h3>
          <p style="font-size:.8rem;color:var(--primary);margin-bottom:.5rem">${esc(c.code)}${c.teacher_id && tMap[c.teacher_id] ? " &mdash; " + esc(tMap[c.teacher_id].first_name + " " + tMap[c.teacher_id].last_name) : ""}</p>
          <p>${esc(c.description).slice(0, 150)}${(c.description || "").length > 150 ? "..." : ""}</p>
          <div style="margin-top:.75rem;display:flex;gap:1rem;font-size:.8rem;color:var(--text-muted)">
            <span>Schedule: ${esc(c.schedule || "TBA")}</span>
            <span>Enrolled: ${c.enrolled || 0}/${c.capacity}</span>
          </div>
        </div>`).join("")
        : '<p class="empty">No programs available yet.</p>';
    } catch (e) {
      console.error("Programs error:", e);
      $("#courseList").innerHTML = '<p class="empty">Failed to load programs.</p>';
    }
  }

  async function renderFaculty(app) {
    app.innerHTML = publicNav("#/faculty") + `
      <section class="section">
        <h1 class="section-title">Our Faculty</h1>
        <p class="section-sub">Meet the dedicated educators shaping the future.</p>
        <div class="grid-3" id="teacherList"><p class="empty">Loading...</p></div>
      </section>` + footer;
    try {
      const teachers = await list("teachers", "", "last_name.asc");
      $("#teacherList").innerHTML = teachers.length ? teachers.map(t => `
        <div class="card">
          <h3>${esc(t.first_name)} ${esc(t.last_name)}</h3>
          <p style="font-size:.85rem;color:var(--primary);margin-bottom:.5rem">${esc(t.designation || "")}${t.department ? " &mdash; " + esc(t.department) : ""}</p>
          <p>${esc(t.bio || "No bio available.").slice(0, 150)}${(t.bio || "").length > 150 ? "..." : ""}</p>
          <p style="margin-top:.5rem;font-size:.8rem;color:var(--text-muted)">${esc(t.email)}</p>
        </div>`).join("")
        : '<p class="empty">No faculty members yet.</p>';
    } catch (e) {
      console.error("Faculty error:", e);
      $("#teacherList").innerHTML = '<p class="empty">Failed to load faculty.</p>';
    }
  }

  async function renderAnnouncements(app) {
    app.innerHTML = publicNav("#/announcements") + `
      <section class="section">
        <h1 class="section-title">News & Announcements</h1>
        <div id="annList" style="display:flex;flex-direction:column;gap:1rem"><p class="empty">Loading...</p></div>
      </section>` + footer;
    try {
      const ann = await list("announcements", "is_published=eq.true", "published_at.desc");
      $("#annList").innerHTML = ann.length ? ann.map(a => `
        <div class="card">
          <h3>${esc(a.title)}</h3>
          <p style="margin-top:.5rem">${esc(a.content)}</p>
          <p style="margin-top:.75rem;font-size:.8rem;color:var(--text-muted)">By ${esc(a.author)} &mdash; ${fmtDate(a.published_at)}</p>
        </div>`).join("")
        : '<p class="empty">No announcements yet.</p>';
    } catch (e) {
      console.error("Announcements error:", e);
      $("#annList").innerHTML = '<p class="empty">Failed to load announcements.</p>';
    }
  }

  function renderContact(app) {
    app.innerHTML = publicNav("#/contact") + `
      <section class="section">
        <h1 class="section-title">Contact Us</h1>
        <div class="grid-3">
          <div class="card"><h3>Address</h3><p>123 Academy Drive<br>Greenwood, CA 90210</p></div>
          <div class="card"><h3>Phone & Email</h3><p>(555) 123-4567<br>info@greenwood.edu</p></div>
          <div class="card"><h3>Office Hours</h3><p>Monday &mdash; Friday<br>8:00 AM &mdash; 5:00 PM</p></div>
        </div>
      </section>` + footer;
  }

  /* ═══════════════════════════════════════════ */
  /*              ADMIN LOGIN                    */
  /* ═══════════════════════════════════════════ */

  function renderLogin(app) {
    app.innerHTML = `<div class="login-wrap"><div class="login-card">
      <h2>Greenwood Academy</h2><p>Admin Dashboard</p>
      <div class="login-error" id="loginErr"></div>
      <form id="loginForm">
        <div class="form-group"><label>Email</label><input type="email" id="loginEmail" required autocomplete="email" placeholder="admin@greenwood.edu" /></div>
        <div class="form-group"><label>Password</label><input type="password" id="loginPass" required autocomplete="current-password" placeholder="Password" /></div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:.7rem">Sign In</button>
      </form>
      <p style="text-align:center;margin-top:1rem;font-size:.85rem"><a href="#/" style="color:var(--text-muted)">&larr; Back to website</a></p>
    </div></div>`;

    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const errEl = $("#loginErr");
      errEl.style.display = "none";
      const btn = e.target.querySelector('button[type="submit"]');
      btn.textContent = "Signing in...";
      btn.disabled = true;
      try {
        await login($("#loginEmail").value.trim(), $("#loginPass").value);
        navigate("#/admin");
      } catch (err) {
        let msg = err.message || "Login failed.";
        if (err.status === 401) msg = "Incorrect email or password.";
        if (err.status === 500) msg = "Account not found. Please sign up first.";
        errEl.textContent = msg;
        errEl.style.display = "block";
        btn.textContent = "Sign In";
        btn.disabled = false;
      }
    };
  }

  /* ═══════════════════════════════════════════ */
  /*              ADMIN DASHBOARD                */
  /* ═══════════════════════════════════════════ */

  function adminNav(active) {
    const items = [
      ["#/admin", "Dashboard", "&#x1F4CA;"],
      ["#/admin/students", "Students", "&#x1F393;"],
      ["#/admin/teachers", "Teachers", "&#x1F469;&#x200D;&#x1F3EB;"],
      ["#/admin/courses", "Courses", "&#x1F4DA;"],
      ["#/admin/announcements", "Announcements", "&#x1F4E2;"],
    ];
    return `<aside class="sidebar">
      <div class="sidebar-brand">Greenwood Admin</div>
      <nav>${items.map(([h, t, icon]) => `<a href="${h}" class="${active === h ? "active" : ""}">${icon} ${t}</a>`).join("")}</nav>
      <div class="sidebar-footer">
        <a href="#/" style="color:rgba(255,255,255,.7);font-size:.85rem">&larr; Back to site</a><br/>
        <a href="javascript:void(0)" id="logoutBtn" style="color:rgba(255,255,255,.7);font-size:.85rem;margin-top:.5rem;display:block">Sign out</a>
      </div>
    </aside>`;
  }

  async function renderAdmin(app, hash) {
    if (hash === "#/admin/students") { await renderAdminStudents(app); return; }
    if (hash === "#/admin/teachers") { await renderAdminTeachers(app); return; }
    if (hash === "#/admin/courses") { await renderAdminCourses(app); return; }
    if (hash === "#/admin/announcements") { await renderAdminAnnouncements(app); return; }
    await renderAdminDashboard(app);
  }

  async function renderAdminDashboard(app) {
    app.innerHTML = `<div class="admin-layout">${adminNav("#/admin")}<main class="admin-main">
      <div class="admin-header"><h1>Dashboard</h1><span style="color:var(--text-secondary)">Welcome, ${esc(state.user?.email || "Admin")}</span></div>
      <div class="grid-4" id="dashStats">
        <div class="stat-card"><div class="stat-value" id="ds1">--</div><div class="stat-label">Students</div></div>
        <div class="stat-card"><div class="stat-value" id="ds2">--</div><div class="stat-label">Teachers</div></div>
        <div class="stat-card"><div class="stat-value" id="ds3">--</div><div class="stat-label">Courses</div></div>
        <div class="stat-card"><div class="stat-value" id="ds4">--</div><div class="stat-label">Announcements</div></div>
      </div>
      <h2 style="margin:2rem 0 1rem;font-size:1.2rem">Recent Announcements</h2>
      <div id="dashAnn" class="table-wrap"><p class="empty">Loading...</p></div>
    </main></div>`;
    logoutHandler();
    const [s, t, c, a] = await Promise.allSettled([
      list("students"),
      list("teachers"),
      list("courses"),
      list("announcements", "", "created_at.desc"),
    ]);
    if (s.status === "fulfilled") $("#ds1").textContent = s.value.length;
    if (t.status === "fulfilled") $("#ds2").textContent = t.value.length;
    if (c.status === "fulfilled") $("#ds3").textContent = c.value.length;
    if (a.status === "fulfilled") {
      $("#ds4").textContent = a.value.length;
      const rows = a.value.slice(0, 5);
      $("#dashAnn").innerHTML = rows.length ? `<table><thead><tr><th>Title</th><th>Author</th><th>Date</th><th>Status</th></tr></thead><tbody>
        ${rows.map(r => `<tr>
          <td>${esc(r.title)}</td>
          <td>${esc(r.author)}</td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.is_published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-yellow">Draft</span>'}</td>
        </tr>`).join("")}</tbody></table>` : '<p class="empty">No announcements yet.</p>';
    }
  }

  /* ─── STUDENTS ─── */
  async function renderAdminStudents(app) {
    app.innerHTML = `<div class="admin-layout">${adminNav("#/admin/students")}<main class="admin-main">
      <div class="admin-header"><h1>Students</h1><button class="btn btn-primary" id="addStudentBtn">+ Add Student</button></div>
      <div class="search-bar"><input type="text" id="studentSearch" placeholder="Search students by name, email, or grade..." /></div>
      <div class="table-wrap" id="studentTable"><p class="empty">Loading...</p></div>
    </main></div>`;
    logoutHandler();

    try {
      state.students = await list("students", "", "last_name.asc");
    } catch (e) {
      console.error("Load students error:", e);
      state.students = [];
    }

    renderStudentTable(state.students);

    bindAdd("addStudentBtn", studentForm(), async (vals) => {
      await create("students", vals);
      toast("Student added successfully");
    }, () => reloadStudents(app));

    const searchEl = $("#studentSearch");
    if (searchEl) {
      searchEl.oninput = () => {
        const term = searchEl.value.toLowerCase();
        const filtered = state.students.filter(r =>
          `${r.first_name} ${r.last_name} ${r.email} ${r.grade} ${r.phone}`.toLowerCase().includes(term)
        );
        renderStudentTable(filtered);
      };
    }
  }

  function renderStudentTable(rows) {
    $("#studentTable").innerHTML = rows.length ? `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Grade</th><th>Status</th><th>Enrolled</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td>${esc(r.first_name)} ${esc(r.last_name)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.phone || "—")}</td>
        <td>${esc(r.grade || "—")}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${fmtDate(r.enrollment_date)}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="window._editStudent('${r.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="window._deleteStudent('${r.id}','${esc(r.first_name + " " + r.last_name)}')">Delete</button>
        </td>
      </tr>`).join("")}</tbody></table>`
      : '<p class="empty">No students found.</p>';
  }

  window._editStudent = async (id) => {
    const row = state.students.find(r => r.id === id);
    if (!row) return;
    showModal("Edit Student", studentForm(row), async (vals) => {
      await update("students", id, vals);
      toast("Student updated");
      reloadStudents($("#app"));
    });
  };

  window._deleteStudent = async (id, name) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    try {
      await remove("students", id);
      state.students = state.students.filter(r => r.id !== id);
      renderStudentTable(state.students);
      toast("Student deleted");
    } catch (e) {
      toast("Failed to delete: " + e.message, "err");
    }
  };

  async function reloadStudents(app) {
    state.students = await list("students", "", "last_name.asc");
    renderAdminStudents(app);
  }

  function studentForm(r) {
    return [
      { name: "first_name", label: "First Name", value: r?.first_name || "", required: true },
      { name: "last_name", label: "Last Name", value: r?.last_name || "", required: true },
      { name: "email", label: "Email", value: r?.email || "", type: "email", required: true },
      { name: "phone", label: "Phone", value: r?.phone || "" },
      { name: "grade", label: "Grade / Year", value: r?.grade || "", required: true },
      { name: "status", label: "Status", value: r?.status || "active", type: "select", options: ["active", "inactive", "graduated", "transferred"] },
    ];
  }

  /* ─── TEACHERS ─── */
  async function renderAdminTeachers(app) {
    app.innerHTML = `<div class="admin-layout">${adminNav("#/admin/teachers")}<main class="admin-main">
      <div class="admin-header"><h1>Teachers</h1><button class="btn btn-primary" id="addTeacherBtn">+ Add Teacher</button></div>
      <div class="search-bar"><input type="text" id="teacherSearch" placeholder="Search teachers by name, department, or email..." /></div>
      <div class="table-wrap" id="teacherTable"><p class="empty">Loading...</p></div>
    </main></div>`;
    logoutHandler();

    try {
      state.teachers = await list("teachers", "", "last_name.asc");
    } catch (e) {
      console.error("Load teachers error:", e);
      state.teachers = [];
    }

    renderTeacherTable(state.teachers);

    bindAdd("addTeacherBtn", teacherForm(), async (vals) => {
      await create("teachers", vals);
      toast("Teacher added successfully");
    }, () => reloadTeachers(app));

    const searchEl = $("#teacherSearch");
    if (searchEl) {
      searchEl.oninput = () => {
        const term = searchEl.value.toLowerCase();
        const filtered = state.teachers.filter(r =>
          `${r.first_name} ${r.last_name} ${r.email} ${r.department} ${r.designation}`.toLowerCase().includes(term)
        );
        renderTeacherTable(filtered);
      };
    }
  }

  function renderTeacherTable(rows) {
    $("#teacherTable").innerHTML = rows.length ? `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Department</th><th>Designation</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td>${esc(r.first_name)} ${esc(r.last_name)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.phone || "—")}</td>
        <td>${esc(r.department)}</td>
        <td>${esc(r.designation || "—")}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="window._editTeacher('${r.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="window._deleteTeacher('${r.id}','${esc(r.first_name + " " + r.last_name)}')">Delete</button>
        </td>
      </tr>`).join("")}</tbody></table>`
      : '<p class="empty">No teachers found.</p>';
  }

  window._editTeacher = async (id) => {
    const row = state.teachers.find(r => r.id === id);
    if (!row) return;
    showModal("Edit Teacher", teacherForm(row), async (vals) => {
      await update("teachers", id, vals);
      toast("Teacher updated");
      reloadTeachers($("#app"));
    });
  };

  window._deleteTeacher = async (id, name) => {
    if (!confirm(`Delete teacher "${name}"? This cannot be undone.`)) return;
    try {
      await remove("teachers", id);
      state.teachers = state.teachers.filter(r => r.id !== id);
      renderTeacherTable(state.teachers);
      toast("Teacher deleted");
    } catch (e) {
      toast("Failed to delete: " + e.message, "err");
    }
  };

  async function reloadTeachers(app) {
    state.teachers = await list("teachers", "", "last_name.asc");
    renderAdminTeachers(app);
  }

  function teacherForm(r) {
    return [
      { name: "first_name", label: "First Name", value: r?.first_name || "", required: true },
      { name: "last_name", label: "Last Name", value: r?.last_name || "", required: true },
      { name: "email", label: "Email", value: r?.email || "", type: "email", required: true },
      { name: "phone", label: "Phone", value: r?.phone || "" },
      { name: "department", label: "Department", value: r?.department || "", required: true },
      { name: "designation", label: "Designation", value: r?.designation || "" },
      { name: "bio", label: "Bio", value: r?.bio || "", type: "textarea" },
    ];
  }

  /* ─── COURSES ─── */
  async function renderAdminCourses(app) {
    app.innerHTML = `<div class="admin-layout">${adminNav("#/admin/courses")}<main class="admin-main">
      <div class="admin-header"><h1>Courses</h1><button class="btn btn-primary" id="addCourseBtn">+ Add Course</button></div>
      <div class="search-bar"><input type="text" id="courseSearch" placeholder="Search courses by name, code, or schedule..." /></div>
      <div class="table-wrap" id="courseTable"><p class="empty">Loading...</p></div>
    </main></div>`;
    logoutHandler();

    try {
      [state.courses, state.teachers] = await Promise.all([list("courses", "", "name.asc"), list("teachers")]);
    } catch (e) {
      console.error("Load courses error:", e);
      state.courses = [];
      state.teachers = [];
    }

    renderCourseTable(state.courses);

    bindAdd("addCourseBtn", courseForm(), async (vals) => {
      await create("courses", vals);
      toast("Course added successfully");
    }, () => reloadCourses(app));

    const searchEl = $("#courseSearch");
    if (searchEl) {
      searchEl.oninput = () => {
        const term = searchEl.value.toLowerCase();
        const filtered = state.courses.filter(r =>
          `${r.name} ${r.code} ${r.schedule} ${r.description}`.toLowerCase().includes(term)
        );
        renderCourseTable(filtered);
      };
    }
  }

  function renderCourseTable(rows) {
    const tMap = Object.fromEntries(state.teachers.map(t => [t.id, t]));
    $("#courseTable").innerHTML = rows.length ? `<table><thead><tr><th>Name</th><th>Code</th><th>Teacher</th><th>Schedule</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r => {
        const teacher = r.teacher_id && tMap[r.teacher_id] ? `${tMap[r.teacher_id].first_name} ${tMap[r.teacher_id].last_name}` : "—";
        return `<tr>
          <td>${esc(r.name)}</td>
          <td>${esc(r.code)}</td>
          <td>${esc(teacher)}</td>
          <td>${esc(r.schedule || "TBA")}</td>
          <td>${r.enrolled || 0}/${r.capacity}</td>
          <td>${statusBadge(r.status)}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="window._editCourse('${r.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="window._deleteCourse('${r.id}','${esc(r.name)}')">Delete</button>
          </td>
        </tr>`;
      }).join("")}</tbody></table>`
      : '<p class="empty">No courses found.</p>';
  }

  window._editCourse = async (id) => {
    const row = state.courses.find(r => r.id === id);
    if (!row) return;
    showModal("Edit Course", courseForm(row), async (vals) => {
      await update("courses", id, vals);
      toast("Course updated");
      reloadCourses($("#app"));
    });
  };

  window._deleteCourse = async (id, name) => {
    if (!confirm(`Delete course "${name}"? This cannot be undone.`)) return;
    try {
      await remove("courses", id);
      state.courses = state.courses.filter(r => r.id !== id);
      renderCourseTable(state.courses);
      toast("Course deleted");
    } catch (e) {
      toast("Failed to delete: " + e.message, "err");
    }
  };

  async function reloadCourses(app) {
    [state.courses, state.teachers] = await Promise.all([list("courses", "", "name.asc"), list("teachers")]);
    renderAdminCourses(app);
  }

  function courseForm(r) {
    const teacherOpts = state.teachers.map(t => ({
      value: t.id,
      label: `${t.first_name} ${t.last_name} (${t.department})`,
    }));
    return [
      { name: "name", label: "Course Name", value: r?.name || "", required: true },
      { name: "code", label: "Course Code", value: r?.code || "", required: true },
      { name: "description", label: "Description", value: r?.description || "", type: "textarea" },
      { name: "teacher_id", label: "Teacher", value: r?.teacher_id || "", type: "select", options: teacherOpts },
      { name: "schedule", label: "Schedule", value: r?.schedule || "" },
      { name: "capacity", label: "Capacity", value: r?.capacity || 30, type: "number" },
      { name: "enrolled", label: "Enrolled", value: r?.enrolled || 0, type: "number" },
      { name: "status", label: "Status", value: r?.status || "active", type: "select", options: ["active", "inactive", "upcoming"] },
    ];
  }

  /* ─── ANNOUNCEMENTS ─── */
  async function renderAdminAnnouncements(app) {
    app.innerHTML = `<div class="admin-layout">${adminNav("#/admin/announcements")}<main class="admin-main">
      <div class="admin-header"><h1>Announcements</h1><button class="btn btn-primary" id="addAnnBtn">+ New Announcement</button></div>
      <div class="search-bar"><input type="text" id="annSearch" placeholder="Search announcements by title or author..." /></div>
      <div class="table-wrap" id="annTable"><p class="empty">Loading...</p></div>
    </main></div>`;
    logoutHandler();

    try {
      state.announcements = await list("announcements", "", "created_at.desc");
    } catch (e) {
      console.error("Load announcements error:", e);
      state.announcements = [];
    }

    renderAnnTable(state.announcements);

    bindAdd("addAnnBtn", annForm(), async (vals) => {
      vals.published_at = new Date().toISOString();
      await create("announcements", vals);
      toast("Announcement published");
    }, () => reloadAnnouncements(app));

    const searchEl = $("#annSearch");
    if (searchEl) {
      searchEl.oninput = () => {
        const term = searchEl.value.toLowerCase();
        const filtered = state.announcements.filter(r =>
          `${r.title} ${r.author} ${r.content}`.toLowerCase().includes(term)
        );
        renderAnnTable(filtered);
      };
    }
  }

  function renderAnnTable(rows) {
    $("#annTable").innerHTML = rows.length ? `<table><thead><tr><th>Title</th><th>Author</th><th>Published</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${rows.map(r => `<tr>
        <td>${esc(r.title)}</td>
        <td>${esc(r.author)}</td>
        <td>${fmtDate(r.published_at || r.created_at)}</td>
        <td>${r.is_published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-yellow">Draft</span>'}</td>
        <td class="actions-cell">
          <button class="btn btn-ghost btn-sm" onclick="window._editAnn('${r.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="window._deleteAnn('${r.id}','${esc(r.title)}')">Delete</button>
        </td>
      </tr>`).join("")}</tbody></table>`
      : '<p class="empty">No announcements found.</p>';
  }

  window._editAnn = async (id) => {
    const row = state.announcements.find(r => r.id === id);
    if (!row) return;
    showModal("Edit Announcement", annForm(row), async (vals) => {
      await update("announcements", id, vals);
      toast("Announcement updated");
      reloadAnnouncements($("#app"));
    });
  };

  window._deleteAnn = async (id, title) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await remove("announcements", id);
      state.announcements = state.announcements.filter(r => r.id !== id);
      renderAnnTable(state.announcements);
      toast("Announcement deleted");
    } catch (e) {
      toast("Failed to delete: " + e.message, "err");
    }
  };

  async function reloadAnnouncements(app) {
    state.announcements = await list("announcements", "", "created_at.desc");
    renderAdminAnnouncements(app);
  }

  function annForm(r) {
    return [
      { name: "title", label: "Title", value: r?.title || "", required: true },
      { name: "content", label: "Content", value: r?.content || "", type: "textarea", required: true },
      { name: "author", label: "Author", value: r?.author || (state.user?.email || "Admin") },
      { name: "is_published", label: "Published", value: r?.is_published !== false, type: "checkbox" },
    ];
  }

  /* ═══════════════════════════════════════════ */
  /*              HELPERS                        */
  /* ═══════════════════════════════════════════ */

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(d) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return d;
    }
  }

  function statusBadge(s) {
    const m = {
      active: "badge-green",
      inactive: "badge-red",
      graduated: "badge-blue",
      transferred: "badge-yellow",
      upcoming: "badge-blue",
    };
    return `<span class="badge ${m[s] || "badge-yellow"}">${esc(s)}</span>`;
  }

  function logoutHandler() {
    const btn = $("#logoutBtn");
    if (btn) btn.onclick = logout;
  }

  function bindAdd(btnId, fields, onSave, reloadFn) {
    const btn = $(`#${btnId}`);
    if (!btn) return;
    btn.onclick = () => {
      const title = btn.textContent.replace("+ ", "");
      showModal(title, fields, async (vals) => {
        await onSave(vals);
        reloadFn();
      });
    };
  }

  function showModal(title, fields, onSubmit) {
    const existing = $(".modal-bg");
    if (existing) existing.remove();

    const bg = document.createElement("div");
    bg.className = "modal-bg";

    const fieldsHtml = fields.map(f => {
      if (f.type === "textarea") {
        return `<div class="form-group"><label>${esc(f.label)}</label><textarea name="${f.name}" rows="3" ${f.required ? "required" : ""}>${esc(f.value)}</textarea></div>`;
      }
      if (f.type === "select") {
        const opts = Array.isArray(f.options) ? f.options : [];
        if (opts.length && typeof opts[0] === "object") {
          return `<div class="form-group"><label>${esc(f.label)}</label><select name="${f.name}"><option value="">-- Select --</option>${opts.map(o => `<option value="${esc(o.value)}" ${f.value === o.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`;
        }
        return `<div class="form-group"><label>${esc(f.label)}</label><select name="${f.name}">${opts.map(o => `<option value="${esc(o)}" ${f.value === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
      }
      if (f.type === "checkbox") {
        return `<div class="form-group"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer"><input type="checkbox" name="${f.name}" ${f.value ? "checked" : ""} style="width:auto" /> ${esc(f.label)}</label></div>`;
      }
      return `<div class="form-group"><label>${esc(f.label)}</label><input type="${f.type || "text"}" name="${f.name}" value="${esc(f.value)}" ${f.required ? "required" : ""} /></div>`;
    }).join("");

    bg.innerHTML = `<div class="modal">
      <h2>${esc(title)}</h2>
      <form id="modalForm">${fieldsHtml}
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="modalCancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>`;

    document.body.appendChild(bg);
    bg.querySelector("#modalCancel").onclick = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };

    bg.querySelector("#modalForm").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const vals = {};
      for (const [k, v] of fd.entries()) vals[k] = v;

      fields.forEach(f => {
        if (f.type === "checkbox") {
          vals[f.name] = fd.has(f.name);
        }
        if (f.type === "number") {
          vals[f.name] = Number(vals[f.name] || 0);
        }
      });

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.textContent = "Saving...";
      submitBtn.disabled = true;

      try {
        await onSubmit(vals);
        bg.remove();
      } catch (err) {
        toast(err.message || "Save failed", "err");
        submitBtn.textContent = "Save";
        submitBtn.disabled = false;
      }
    };

    bg.querySelector("#modalForm").onsubmit.bind(bg.querySelector("#modalForm"));
  }

  /* ─── INIT ─── */
  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);
})();
