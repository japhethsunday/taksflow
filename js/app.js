(() => {
  "use strict";

  const PID = window.CONFIG?.PROJECT_ID || "";
  const BASE = "/api";
  const LIMIT = 500;

  // ── Helpers ──────────────────────────────────────────────
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateTime(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusBadge(val, map) {
    const info = map[val] || { label: val || "—", cls: "badge-secondary" };
    return `<span class="${info.cls}">${escapeHtml(info.label)}</span>`;
  }

  // ── Toast ────────────────────────────────────────────────
  function toast(msg, type = "ok") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast " + (type === "err" ? "toast-err" : "toast-ok");
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.className = "toast hidden";
    }, 3000);
  }

  // ── API Client ──────────────────────────────────────────
  async function api(path, opts = {}) {
    const auth = opts.auth || "project";
    const headers = { "Content-Type": "application/json" };

    if (auth === "none") {
      // no extra headers
    } else if (auth === "user") {
      const token = localStorage.getItem("token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } else {
      // project API key
      const key = window.CONFIG?.API_KEY || "";
      if (key) headers["Authorization"] = `Bearer ${key}`;
    }

    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  // ── CRUD Helpers ─────────────────────────────────────────
  async function list(table, filter = "", order = "") {
    let q = `?limit=${LIMIT}`;
    if (filter) q += `&${filter}`;
    if (order) q += `&${order}`;
    const d = await api(`/projects/${PID}/${table}${q}`);
    return d.data?.rows || [];
  }

  async function create(table, row) {
    const d = await api(`/projects/${PID}/${table}`, {
      method: "POST",
      body: row,
    });
    return d.data?.row;
  }

  async function update(table, id, patch) {
    const d = await api(`/projects/${PID}/${table}/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return d.data?.row;
  }

  async function remove(table, id) {
    await api(`/projects/${PID}/${table}/${id}`, { method: "DELETE" });
  }

  async function authLogin(email, password) {
    const d = await api("/auth/login", {
      method: "POST",
      auth: "none",
      body: { email, password, project_id: PID },
    });
    return d;
  }

  async function authSignup(email, password, name) {
    const d = await api("/auth/signup", {
      method: "POST",
      auth: "none",
      body: { email, password, name, project_id: PID },
    });
    return d;
  }

  // ── Router ───────────────────────────────────────────────
  const routes = {};
  function on(path, fn) {
    routes[path] = fn;
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function matchRoute() {
    const h = location.hash.slice(1) || "/";
    if (routes[h]) return routes[h]();
    // try pattern match
    for (const [pat, fn] of Object.entries(routes)) {
      const re = new RegExp(
        "^" + pat.replace(/:\w+/g, "([^/]+)") + "$"
      );
      const m = h.match(re);
      if (m) return fn(...m.slice(1));
    }
    // fallback to home
    if (routes["/"]) routes["/"]();
  }

  window.addEventListener("hashchange", matchRoute);

  // ── Modal ────────────────────────────────────────────────
  let modalResolve = null;

  function openModal(title, fields, values = {}) {
    return new Promise((resolve) => {
      modalResolve = resolve;
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.id = "active-modal";

      let fieldsHtml = "";
      for (const f of fields) {
        const v = values[f.name] ?? "";
        if (f.type === "textarea") {
          fieldsHtml += `
            <div class="form-group">
              <label>${escapeHtml(f.label)}</label>
              <textarea name="${escapeHtml(f.name)}" class="form-control" rows="3">${escapeHtml(v)}</textarea>
            </div>`;
        } else if (f.type === "select") {
          let opts = "";
          const options = Array.isArray(f.options) ? f.options : [];
          for (const o of options) {
            const val = typeof o === "object" ? o.value : o;
            const lbl = typeof o === "object" ? o.label : o;
            const sel = String(val) === String(v) ? "selected" : "";
            opts += `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(lbl)}</option>`;
          }
          fieldsHtml += `
            <div class="form-group">
              <label>${escapeHtml(f.label)}</label>
              <select name="${escapeHtml(f.name)}" class="form-control">
                <option value="">— Select —</option>
                ${opts}
              </select>
            </div>`;
        } else if (f.type === "checkbox") {
          const checked = v ? "checked" : "";
          fieldsHtml += `
            <div class="form-group">
              <label>
                <input type="checkbox" name="${escapeHtml(f.name)}" ${checked} /> ${escapeHtml(f.label)}
              </label>
            </div>`;
        } else {
          fieldsHtml += `
            <div class="form-group">
              <label>${escapeHtml(f.label)}</label>
              <input type="${f.type || "text"}" name="${escapeHtml(f.name)}" class="form-control" value="${escapeHtml(v)}" />
            </div>`;
        }
      }

      bg.innerHTML = `
        <div class="modal">
          <h3>${escapeHtml(title)}</h3>
          <form id="modal-form">
            ${fieldsHtml}
            <div style="display:flex;gap:8px;margin-top:16px">
              <button type="submit" class="btn btn-primary" id="modal-save">Save</button>
              <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
            </div>
          </form>
        </div>`;

      document.body.appendChild(bg);

      bg.addEventListener("click", (e) => {
        if (e.target === bg) closeModal(null);
      });
      document.getElementById("modal-cancel").onclick = () => closeModal(null);
      document.getElementById("modal-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {};
        for (const f of fields) {
          if (f.type === "checkbox") {
            data[f.name] = fd.has(f.name);
          } else if (f.type === "number") {
            const raw = fd.get(f.name);
            data[f.name] = raw === "" || raw == null ? null : Number(raw);
          } else {
            data[f.name] = fd.get(f.name) || "";
          }
        }
        closeModal(data);
      });
    });
  }

  function closeModal(data) {
    const bg = document.getElementById("active-modal");
    if (bg) bg.remove();
    if (modalResolve) {
      modalResolve(data);
      modalResolve = null;
    }
  }

  // ── Auth State ──────────────────────────────────────────
  function getToken() {
    return localStorage.getItem("token");
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("#/");
  }

  // ── Layout ───────────────────────────────────────────────
  function renderPublic(html, active = "") {
    const navLinks = [
      { href: "#/", label: "Home" },
      { href: "#/programs", label: "Programs" },
      { href: "#/faculty", label: "Faculty" },
      { href: "#/events", label: "Events" },
      { href: "#/announcements", label: "News" },
      { href: "#/gallery", label: "Gallery" },
      { href: "#/contact", label: "Contact" },
    ];
    const links = navLinks
      .map(
        (l) =>
          `<a href="${l.href}" class="${l.href === active ? "active" : ""}">${l.label}</a>`
      )
      .join("");

    const authLink = isLoggedIn()
      ? `<a href="#/admin" class="btn btn-primary" style="margin-left:12px">Admin</a>`
      : `<a href="#/admin/login" class="btn btn-primary" style="margin-left:12px">Login</a>`;

    document.getElementById("app").innerHTML = `
      <nav class="nav">
        <div class="nav-inner">
          <a href="#/" class="nav-logo">Greenwood Academy</a>
          <div class="nav-links">${links}${authLink}</div>
        </div>
      </nav>
      <main>${html}</main>
      <footer class="footer">
        <div class="container">
          <p>&copy; ${new Date().getFullYear()} Greenwood Academy. All rights reserved.</p>
        </div>
      </footer>`;
  }

  function renderAdmin(html, active = "") {
    if (!isLoggedIn()) {
      navigate("#/admin/login");
      return;
    }

    const navItems = [
      { href: "#/admin", label: "Dashboard", icon: "📊" },
      { href: "#/admin/students", label: "Students", icon: "🎓" },
      { href: "#/admin/teachers", label: "Teachers", icon: "👩‍🏫" },
      { href: "#/admin/courses", label: "Courses", icon: "📚" },
      { href: "#/admin/enrollments", label: "Enrollments", icon: "📋" },
      { href: "#/admin/grades", label: "Grades", icon: "📝" },
      { href: "#/admin/announcements", label: "Announcements", icon: "📢" },
      { href: "#/admin/events", label: "Events", icon: "📅" },
      { href: "#/admin/gallery", label: "Gallery", icon: "🖼️" },
      { href: "#/admin/messages", label: "Messages", icon: "✉️" },
    ];

    const links = navItems
      .map(
        (n) =>
          `<a href="${n.href}" class="sidebar-link ${n.href === active ? "active" : ""}">${n.icon} ${n.label}</a>`
      )
      .join("");

    document.getElementById("app").innerHTML = `
      <div class="admin-layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Greenwood</h2>
            <small>Admin Panel</small>
          </div>
          <nav class="sidebar-nav">${links}</nav>
          <div class="sidebar-footer">
            <a href="#/">← Back to Site</a>
            <a href="javascript:void(0)" id="logout-btn">Logout</a>
          </div>
        </aside>
        <main class="admin-main">${html}</main>
      </div>`;

    document.getElementById("logout-btn")?.addEventListener("click", logout);
  }

  // ── Tables ───────────────────────────────────────────────
  function renderTable(headers, rows, renderRow) {
    let html = `<div class="table-wrap"><table><thead><tr>`;
    for (const h of headers) html += `<th>${h}</th>`;
    html += `<th class="actions-cell">Actions</th></tr></thead><tbody>`;
    if (rows.length === 0) {
      html += `<tr><td colspan="${headers.length + 1}" style="text-align:center;padding:24px;color:#888">No records found</td></tr>`;
    }
    for (const row of rows) {
      html += `<tr>${renderRow(row)}<td class="actions-cell" id="act-${row.id}"></td></tr>`;
    }
    html += `</tbody></table></div>`;
    return html;
  }

  // ── PUBLIC PAGES ─────────────────────────────────────────

  // HOME
  on("/", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/");

    try {
      const [students, teachers, courses, events, announcements] = await Promise.all([
        list("students").catch(() => []),
        list("teachers").catch(() => []),
        list("courses").catch(() => []),
        list("events", "is_published=eq.true", "event_date=asc").catch(() => []),
        list("announcements", "is_published=eq.true", "published_at=desc").catch(() => []),
      ]);

      const latestAnn = announcements.slice(0, 3);

      renderPublic(`
        <section class="hero">
          <div class="container">
            <h1>Welcome to Greenwood Academy</h1>
            <p>Nurturing minds, building futures. Excellence in education since 1985.</p>
            <div style="margin-top:20px">
              <a href="#/programs" class="btn btn-primary">Our Programs</a>
              <a href="#/contact" class="btn btn-secondary" style="margin-left:8px">Contact Us</a>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="container">
            <div class="grid-4">
              <div class="stat-card">
                <h3>${students.length}</h3>
                <p>Students</p>
              </div>
              <div class="stat-card">
                <h3>${teachers.length}</h3>
                <p>Teachers</p>
              </div>
              <div class="stat-card">
                <h3>${courses.length}</h3>
                <p>Courses</p>
              </div>
              <div class="stat-card">
                <h3>${events.length}</h3>
                <p>Events</p>
              </div>
            </div>
          </div>
        </section>
        ${latestAnn.length ? `
        <section class="section">
          <div class="container">
            <h2>Latest Announcements</h2>
            <div class="grid-3">
              ${latestAnn.map(a => `
                <div class="card">
                  <div class="card-body">
                    <h3>${escapeHtml(a.title)}</h3>
                    <p style="color:#666;font-size:14px">${formatDate(a.published_at)}</p>
                    <p>${escapeHtml((a.content || "").substring(0, 150))}${(a.content || "").length > 150 ? "..." : ""}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </section>` : ""}
      `, "#/");
    } catch (err) {
      renderPublic(`<div class="container"><p>Error loading page: ${escapeHtml(err.message)}</p></div>`, "#/");
    }
  });

  // PROGRAMS
  on("/programs", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/programs");

    try {
      const [courses, teachers] = await Promise.all([
        list("courses"),
        list("teachers"),
      ]);

      const teacherMap = {};
      for (const t of teachers) teacherMap[t.id] = t;

      renderPublic(`
        <section class="section">
          <div class="container">
            <h2>Our Programs</h2>
            <p>Comprehensive academic programs designed for excellence.</p>
            <div class="grid-3" style="margin-top:24px">
              ${courses.map(c => {
                const t = teacherMap[c.teacher_id];
                const tName = t ? `${t.first_name} ${t.last_name}` : "TBA";
                return `
                  <div class="card">
                    <div class="card-body">
                      <h3>${escapeHtml(c.name)}</h3>
                      <p style="color:#666;font-size:14px">${escapeHtml(c.description || "")}</p>
                      <p style="margin-top:8px"><strong>Instructor:</strong> ${escapeHtml(tName)}</p>
                      <p><strong>Schedule:</strong> ${escapeHtml(c.schedule || "—")}</p>
                      <p><strong>Capacity:</strong> ${c.capacity ?? "—"}</p>
                    </div>
                  </div>`;
              }).join("")}
            </div>
          </div>
        </section>
      `, "#/programs");
    } catch (err) {
      renderPublic(`<div class="container"><p>Error: ${escapeHtml(err.message)}</p></div>`, "#/programs");
    }
  });

  // FACULTY
  on("/faculty", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/faculty");

    try {
      const teachers = await list("teachers");
      renderPublic(`
        <section class="section">
          <div class="container">
            <h2>Our Faculty</h2>
            <p>Meet our dedicated educators.</p>
            <div class="grid-3" style="margin-top:24px">
              ${teachers.map(t => `
                <div class="card">
                  <div class="card-body">
                    <h3>${escapeHtml(t.first_name)} ${escapeHtml(t.last_name)}</h3>
                    <p style="color:#666;font-size:14px">${escapeHtml(t.department || "")}</p>
                    <p>${escapeHtml(t.bio || "")}</p>
                    <p style="margin-top:8px"><strong>Email:</strong> ${escapeHtml(t.email || "—")}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </section>
      `, "#/faculty");
    } catch (err) {
      renderPublic(`<div class="container"><p>Error: ${escapeHtml(err.message)}</p></div>`, "#/faculty");
    }
  });

  // EVENTS
  on("/events", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/events");

    try {
      const events = await list("events", "is_published=eq.true", "event_date=asc");
      renderPublic(`
        <section class="section">
          <div class="container">
            <h2>Upcoming Events</h2>
            <div class="grid-3" style="margin-top:24px">
              ${events.map(e => `
                <div class="card">
                  <div class="card-body">
                    <h3>${escapeHtml(e.title)}</h3>
                    <p style="color:#666;font-size:14px">${formatDate(e.event_date)}</p>
                    <p>${escapeHtml(e.description || "")}</p>
                    <p style="margin-top:8px"><strong>Location:</strong> ${escapeHtml(e.location || "—")}</p>
                    <p><strong>Category:</strong> ${escapeHtml(e.category || "—")}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </section>
      `, "#/events");
    } catch (err) {
      renderPublic(`<div class="container"><p>Error: ${escapeHtml(err.message)}</p></div>`, "#/events");
    }
  });

  // NEWS / ANNOUNCEMENTS
  on("/announcements", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/announcements");

    try {
      const ann = await list("announcements", "is_published=eq.true", "published_at=desc");
      renderPublic(`
        <section class="section">
          <div class="container">
            <h2>News & Announcements</h2>
            <div style="margin-top:24px">
              ${ann.map(a => `
                <div class="card" style="margin-bottom:16px">
                  <div class="card-body">
                    <h3>${escapeHtml(a.title)}</h3>
                    <p style="color:#666;font-size:14px">${formatDate(a.published_at)}</p>
                    <p>${escapeHtml(a.content || "")}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </section>
      `, "#/announcements");
    } catch (err) {
      renderPublic(`<div class="container"><p>Error: ${escapeHtml(err.message)}</p></div>`, "#/announcements");
    }
  });

  // GALLERY
  on("/gallery", async () => {
    renderPublic(`<div class="container"><p style="text-align:center;padding:40px">Loading...</p></div>`, "#/gallery");

    try {
      const photos = await list("gallery", "is_published=eq.true", "sort_order=asc");
      const categories = [...new Set(photos.map(p => p.category).filter(Boolean))];

      let filterHtml = `<button class="btn btn-primary gallery-filter active" data-cat="all">All</button>`;
      for (const c of categories) {
        filterHtml += `<button class="btn btn-secondary gallery-filter" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
      }

      renderPublic(`
        <section class="section">
          <div class="container">
            <h2>Gallery</h2>
            <div style="margin:16px 0;display:flex;gap:8px;flex-wrap:wrap">${filterHtml}</div>
            <div class="grid-4" id="gallery-grid">
              ${photos.map(p => `
                <div class="card gallery-item" data-cat="${escapeHtml(p.category || "")}">
                  <div class="card-body">
                    ${p.url ? `<img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || p.title || "")}" style="width:100%;border-radius:8px" />` : ""}
                    <p style="margin-top:8px;font-size:14px">${escapeHtml(p.caption || p.title || "")}</p>
                    <p style="font-size:12px;color:#888">${escapeHtml(p.category || "")}</p>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </section>
      `, "#/gallery");

      document.querySelectorAll(".gallery-filter").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".gallery-filter").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const cat = btn.dataset.cat;
          document.querySelectorAll(".gallery-item").forEach(item => {
            item.style.display = cat === "all" || item.dataset.cat === cat ? "" : "none";
          });
        });
      });
    } catch (err) {
      renderPublic(`<div class="container"><p>Error: ${escapeHtml(err.message)}</p></div>`, "#/gallery");
    }
  });

  // CONTACT
  on("/contact", async () => {
    renderPublic(`
      <section class="section">
        <div class="container">
          <h2>Contact Us</h2>
          <div class="grid-3" style="margin-top:24px">
            <div class="card">
              <div class="card-body">
                <h3>Address</h3>
                <p>123 Greenwood Ave<br/>Springfield, IL 62701</p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <h3>Phone</h3>
                <p>(555) 123-4567</p>
              </div>
            </div>
            <div class="card">
              <div class="card-body">
                <h3>Email</h3>
                <p>info@greenwood.edu</p>
              </div>
            </div>
          </div>
          <div style="margin-top:32px;max-width:600px">
            <h3>Send a Message</h3>
            <form id="contact-form" style="margin-top:12px">
              <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" class="form-control" required />
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" class="form-control" required />
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input type="text" name="phone" class="form-control" />
              </div>
              <div class="form-group">
                <label>Subject</label>
                <input type="text" name="subject" class="form-control" />
              </div>
              <div class="form-group">
                <label>Message</label>
                <textarea name="message" class="form-control" rows="5" required></textarea>
              </div>
              <button type="submit" class="btn btn-primary" id="contact-submit">Send Message</button>
            </form>
          </div>
        </div>
      </section>
    `, "#/contact");

    document.getElementById("contact-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("contact-submit");
      btn.textContent = "Sending...";
      btn.disabled = true;
      try {
        const fd = new FormData(e.target);
        await create("contact_submissions", {
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          subject: fd.get("subject"),
          message: fd.get("message"),
          is_read: false,
        });
        toast("Message sent successfully!");
        e.target.reset();
      } catch (err) {
        toast(err.message, "err");
      }
      btn.textContent = "Send Message";
      btn.disabled = false;
    });
  });

  // ── ADMIN PAGES ──────────────────────────────────────────

  // LOGIN
  on("/admin/login", async () => {
    if (isLoggedIn()) {
      navigate("#/admin");
      return;
    }

    document.getElementById("app").innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <h2>Greenwood Academy</h2>
          <p>Admin Login</p>
          <form id="login-form" style="margin-top:16px">
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" class="form-control" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" class="form-control" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%" id="login-submit">Login</button>
          </form>
          <p style="margin-top:12px;font-size:14px;color:#668">Don't have an account? <a href="#/admin/signup">Sign up</a></p>
        </div>
      </div>`;

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("login-submit");
      btn.textContent = "Logging in...";
      btn.disabled = true;
      try {
        const fd = new FormData(e.target);
        const res = await authLogin(fd.get("email"), fd.get("password"));
        const token = res.data?.token || res.token;
        if (token) {
          localStorage.setItem("token", token);
          toast("Login successful");
          navigate("#/admin");
        } else {
          toast("Login failed: no token", "err");
        }
      } catch (err) {
        toast(err.message, "err");
      }
      btn.textContent = "Login";
      btn.disabled = false;
    });
  });

  // SIGNUP
  on("/admin/signup", async () => {
    document.getElementById("app").innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <h2>Greenwood Academy</h2>
          <p>Create Admin Account</p>
          <form id="signup-form" style="margin-top:16px">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" class="form-control" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" class="form-control" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" class="form-control" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%" id="signup-submit">Sign Up</button>
          </form>
          <p style="margin-top:12px;font-size:14px;color:#668">Already have an account? <a href="#/admin/login">Login</a></p>
        </div>
      </div>`;

    document.getElementById("signup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("signup-submit");
      btn.textContent = "Signing up...";
      btn.disabled = true;
      try {
        const fd = new FormData(e.target);
        const res = await authSignup(fd.get("email"), fd.get("password"), fd.get("name"));
        const token = res.data?.token || res.token;
        if (token) {
          localStorage.setItem("token", token);
          toast("Account created");
          navigate("#/admin");
        } else {
          toast("Signup failed", "err");
        }
      } catch (err) {
        toast(err.message, "err");
      }
      btn.textContent = "Sign Up";
      btn.disabled = false;
    });
  });

  // ADMIN DASHBOARD
  on("/admin", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin");

    try {
      const [students, teachers, courses, announcements, messages] = await Promise.all([
        list("students").catch(() => []),
        list("teachers").catch(() => []),
        list("courses").catch(() => []),
        list("announcements").catch(() => []),
        list("contact_submissions").catch(() => []),
      ]);

      const recentAnn = announcements.slice(0, 5);
      const recentMsg = messages.slice(0, 5);

      renderAdmin(`
        <h2>Dashboard</h2>
        <div class="grid-4" style="margin-top:16px">
          <div class="stat-card"><h3>${students.length}</h3><p>Students</p></div>
          <div class="stat-card"><h3>${teachers.length}</h3><p>Teachers</p></div>
          <div class="stat-card"><h3>${courses.length}</h3><p>Courses</p></div>
          <div class="stat-card"><h3>${messages.length}</h3><p>Messages</p></div>
        </div>
        <div class="grid-2" style="margin-top:24px">
          <div class="card">
            <div class="card-body">
              <h3>Recent Announcements</h3>
              ${recentAnn.length ? recentAnn.map(a => `
                <div style="padding:8px 0;border-bottom:1px solid #eee">
                  <strong>${escapeHtml(a.title)}</strong>
                  <span style="color:#888;font-size:12px;margin-left:8px">${formatDate(a.published_at)}</span>
                </div>
              `).join("") : "<p>No announcements</p>"}
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <h3>Recent Messages</h3>
              ${recentMsg.length ? recentMsg.map(m => `
                <div style="padding:8px 0;border-bottom:1px solid #eee">
                  <strong>${escapeHtml(m.name)}</strong> — ${escapeHtml(m.subject || "")}
                  <span style="color:#888;font-size:12px;margin-left:8px">${formatDate(m.created_at)}</span>
                </div>
              `).join("") : "<p>No messages</p>"}
            </div>
          </div>
        </div>
      `, "#/admin");
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin");
    }
  });

  // ADMIN STUDENTS
  on("/admin/students", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/students");

    try {
      let rows = await list("students");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Students</h2>
            <button class="btn btn-primary" id="add-student">+ Add Student</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search students..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Name", "Email", "Phone", "Grade"], filtered, r => `
            <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
            <td>${escapeHtml(r.email || "—")}</td>
            <td>${escapeHtml(r.phone || "—")}</td>
            <td>${escapeHtml(r.grade || "—")}</td>
          `)}
        `, "#/admin/students");

        // attach action buttons
        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-student")?.addEventListener("click", async () => {
          const data = await openModal("Add Student", [
            { name: "first_name", label: "First Name", type: "text" },
            { name: "last_name", label: "Last Name", type: "text" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone", type: "text" },
            { name: "grade", label: "Grade", type: "text" },
            { name: "date_of_birth", label: "Date of Birth", type: "date" },
            { name: "address", label: "Address", type: "textarea" },
          ]);
          if (data) {
            try {
              await create("students", data);
              toast("Student created");
              rows = await list("students");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Student", [
              { name: "first_name", label: "First Name", type: "text" },
              { name: "last_name", label: "Last Name", type: "text" },
              { name: "email", label: "Email", type: "email" },
              { name: "phone", label: "Phone", type: "text" },
              { name: "grade", label: "Grade", type: "text" },
              { name: "date_of_birth", label: "Date of Birth", type: "date" },
              { name: "address", label: "Address", type: "textarea" },
            ], row);
            if (data) {
              try {
                await update("students", id, data);
                toast("Student updated");
                rows = await list("students");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this student?")) return;
            try {
              await remove("students", btn.dataset.id);
              toast("Student deleted");
              rows = await list("students");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/students");
    }
  });

  // ADMIN TEACHERS
  on("/admin/teachers", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/teachers");

    try {
      let rows = await list("teachers");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.first_name} ${r.last_name} ${r.email} ${r.department}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Teachers</h2>
            <button class="btn btn-primary" id="add-teacher">+ Add Teacher</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search teachers..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Name", "Email", "Department", "Phone"], filtered, r => `
            <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
            <td>${escapeHtml(r.email || "—")}</td>
            <td>${escapeHtml(r.department || "—")}</td>
            <td>${escapeHtml(r.phone || "—")}</td>
          `)}
        `, "#/admin/teachers");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-teacher")?.addEventListener("click", async () => {
          const data = await openModal("Add Teacher", [
            { name: "first_name", label: "First Name", type: "text" },
            { name: "last_name", label: "Last Name", type: "text" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone", type: "text" },
            { name: "department", label: "Department", type: "text" },
            { name: "bio", label: "Bio", type: "textarea" },
          ]);
          if (data) {
            try {
              await create("teachers", data);
              toast("Teacher created");
              rows = await list("teachers");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Teacher", [
              { name: "first_name", label: "First Name", type: "text" },
              { name: "last_name", label: "Last Name", type: "text" },
              { name: "email", label: "Email", type: "email" },
              { name: "phone", label: "Phone", type: "text" },
              { name: "department", label: "Department", type: "text" },
              { name: "bio", label: "Bio", type: "textarea" },
            ], row);
            if (data) {
              try {
                await update("teachers", id, data);
                toast("Teacher updated");
                rows = await list("teachers");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this teacher?")) return;
            try {
              await remove("teachers", btn.dataset.id);
              toast("Teacher deleted");
              rows = await list("teachers");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/teachers");
    }
  });

  // ADMIN COURSES
  on("/admin/courses", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/courses");

    try {
      let rows = await list("courses");
      let teachers = await list("teachers");

      const teacherOpts = teachers.map(t => ({
        value: t.id,
        label: `${t.first_name} ${t.last_name}`,
      }));

      const teacherMap = {};
      for (const t of teachers) teacherMap[t.id] = t;

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.name} ${r.description} ${r.schedule}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Courses</h2>
            <button class="btn btn-primary" id="add-course">+ Add Course</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search courses..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Name", "Teacher", "Schedule", "Capacity"], filtered, r => {
            const t = teacherMap[r.teacher_id];
            return `
              <td>${escapeHtml(r.name)}</td>
              <td>${t ? escapeHtml(`${t.first_name} ${t.last_name}`) : "—"}</td>
              <td>${escapeHtml(r.schedule || "—")}</td>
              <td>${r.capacity ?? "—"}</td>`;
          })}
        `, "#/admin/courses");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-course")?.addEventListener("click", async () => {
          const data = await openModal("Add Course", [
            { name: "name", label: "Course Name", type: "text" },
            { name: "description", label: "Description", type: "textarea" },
            { name: "teacher_id", label: "Teacher", type: "select", options: teacherOpts },
            { name: "schedule", label: "Schedule", type: "text" },
            { name: "capacity", label: "Capacity", type: "number" },
          ]);
          if (data) {
            try {
              await create("courses", data);
              toast("Course created");
              rows = await list("courses");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Course", [
              { name: "name", label: "Course Name", type: "text" },
              { name: "description", label: "Description", type: "textarea" },
              { name: "teacher_id", label: "Teacher", type: "select", options: teacherOpts },
              { name: "schedule", label: "Schedule", type: "text" },
              { name: "capacity", label: "Capacity", type: "number" },
            ], row);
            if (data) {
              try {
                await update("courses", id, data);
                toast("Course updated");
                rows = await list("courses");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this course?")) return;
            try {
              await remove("courses", btn.dataset.id);
              toast("Course deleted");
              rows = await list("courses");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/courses");
    }
  });

  // ADMIN ANNOUNCEMENTS
  on("/admin/announcements", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/announcements");

    try {
      let rows = await list("announcements");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.title} ${r.content}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Announcements</h2>
            <button class="btn btn-primary" id="add-ann">+ Add Announcement</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search announcements..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Title", "Status", "Published At"], filtered, r => `
            <td>${escapeHtml(r.title)}</td>
            <td>${statusBadge(r.is_published, { true: { label: "Published", cls: "badge-success" }, false: { label: "Draft", cls: "badge-secondary" } })}</td>
            <td>${formatDate(r.published_at)}</td>
          `)}
        `, "#/admin/announcements");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-secondary toggle-btn" data-id="${r.id}" data-pub="${r.is_published}">${r.is_published ? "Unpublish" : "Publish"}</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-ann")?.addEventListener("click", async () => {
          const data = await openModal("Add Announcement", [
            { name: "title", label: "Title", type: "text" },
            { name: "content", label: "Content", type: "textarea" },
            { name: "is_published", label: "Published", type: "checkbox" },
          ]);
          if (data) {
            data.published_at = data.is_published ? new Date().toISOString() : null;
            try {
              await create("announcements", data);
              toast("Announcement created");
              rows = await list("announcements");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Announcement", [
              { name: "title", label: "Title", type: "text" },
              { name: "content", label: "Content", type: "textarea" },
              { name: "is_published", label: "Published", type: "checkbox" },
            ], row);
            if (data) {
              if (data.is_published && !row.is_published) {
                data.published_at = new Date().toISOString();
              }
              try {
                await update("announcements", id, data);
                toast("Announcement updated");
                rows = await list("announcements");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".toggle-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const isPub = btn.dataset.pub === "true";
            try {
              await update("announcements", id, {
                is_published: !isPub,
                published_at: !isPub ? new Date().toISOString() : null,
              });
              toast(isPub ? "Unpublished" : "Published");
              rows = await list("announcements");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this announcement?")) return;
            try {
              await remove("announcements", btn.dataset.id);
              toast("Announcement deleted");
              rows = await list("announcements");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/announcements");
    }
  });

  // ADMIN EVENTS
  on("/admin/events", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/events");

    try {
      let rows = await list("events");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.title} ${r.description} ${r.location} ${r.category}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Events</h2>
            <button class="btn btn-primary" id="add-event">+ Add Event</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search events..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Title", "Date", "Location", "Category", "Status"], filtered, r => `
            <td>${escapeHtml(r.title)}</td>
            <td>${formatDate(r.event_date)}</td>
            <td>${escapeHtml(r.location || "—")}</td>
            <td>${escapeHtml(r.category || "—")}</td>
            <td>${statusBadge(r.is_published, { true: { label: "Published", cls: "badge-success" }, false: { label: "Draft", cls: "badge-secondary" } })}</td>
          `)}
        `, "#/admin/events");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-secondary toggle-btn" data-id="${r.id}" data-pub="${r.is_published}">${r.is_published ? "Unpublish" : "Publish"}</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-event")?.addEventListener("click", async () => {
          const data = await openModal("Add Event", [
            { name: "title", label: "Title", type: "text" },
            { name: "description", label: "Description", type: "textarea" },
            { name: "event_date", label: "Event Date", type: "date" },
            { name: "location", label: "Location", type: "text" },
            { name: "category", label: "Category", type: "text" },
            { name: "is_published", label: "Published", type: "checkbox" },
          ]);
          if (data) {
            try {
              await create("events", data);
              toast("Event created");
              rows = await list("events");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Event", [
              { name: "title", label: "Title", type: "text" },
              { name: "description", label: "Description", type: "textarea" },
              { name: "event_date", label: "Event Date", type: "date" },
              { name: "location", label: "Location", type: "text" },
              { name: "category", label: "Category", type: "text" },
              { name: "is_published", label: "Published", type: "checkbox" },
            ], row);
            if (data) {
              try {
                await update("events", id, data);
                toast("Event updated");
                rows = await list("events");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".toggle-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const isPub = btn.dataset.pub === "true";
            try {
              await update("events", id, { is_published: !isPub });
              toast(isPub ? "Unpublished" : "Published");
              rows = await list("events");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this event?")) return;
            try {
              await remove("events", btn.dataset.id);
              toast("Event deleted");
              rows = await list("events");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/events");
    }
  });

  // ADMIN GALLERY
  on("/admin/gallery", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/gallery");

    try {
      let rows = await list("gallery");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.title} ${r.caption} ${r.category}`.toLowerCase().includes(search)
        );

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Gallery</h2>
            <button class="btn btn-primary" id="add-photo">+ Add Photo</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search gallery..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Title", "Category", "Sort Order", "Status"], filtered, r => `
            <td>${escapeHtml(r.title || r.caption || "—")}</td>
            <td>${escapeHtml(r.category || "—")}</td>
            <td>${r.sort_order ?? "—"}</td>
            <td>${statusBadge(r.is_published, { true: { label: "Published", cls: "badge-success" }, false: { label: "Draft", cls: "badge-secondary" } })}</td>
          `)}
        `, "#/admin/gallery");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-secondary toggle-btn" data-id="${r.id}" data-pub="${r.is_published}">${r.is_published ? "Hide" : "Show"}</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-photo")?.addEventListener("click", async () => {
          const data = await openModal("Add Photo", [
            { name: "title", label: "Title", type: "text" },
            { name: "caption", label: "Caption", type: "text" },
            { name: "url", label: "Image URL", type: "text" },
            { name: "category", label: "Category", type: "select", options: ["campus", "facilities", "activities", "events"] },
            { name: "sort_order", label: "Sort Order", type: "number" },
            { name: "is_published", label: "Published", type: "checkbox" },
          ]);
          if (data) {
            try {
              await create("gallery", data);
              toast("Photo added");
              rows = await list("gallery");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Photo", [
              { name: "title", label: "Title", type: "text" },
              { name: "caption", label: "Caption", type: "text" },
              { name: "url", label: "Image URL", type: "text" },
              { name: "category", label: "Category", type: "select", options: ["campus", "facilities", "activities", "events"] },
              { name: "sort_order", label: "Sort Order", type: "number" },
              { name: "is_published", label: "Published", type: "checkbox" },
            ], row);
            if (data) {
              try {
                await update("gallery", id, data);
                toast("Photo updated");
                rows = await list("gallery");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".toggle-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const isPub = btn.dataset.pub === "true";
            try {
              await update("gallery", id, { is_published: !isPub });
              toast(isPub ? "Hidden" : "Shown");
              rows = await list("gallery");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this photo?")) return;
            try {
              await remove("gallery", btn.dataset.id);
              toast("Photo deleted");
              rows = await list("gallery");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/gallery");
    }
  });

  // ADMIN MESSAGES
  on("/admin/messages", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/messages");

    try {
      let rows = await list("contact_submissions");

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r =>
          `${r.name} ${r.email} ${r.subject} ${r.message}`.toLowerCase().includes(search)
        );
        const unread = rows.filter(r => !r.is_read).length;

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Messages ${unread > 0 ? `<span class="badge-success" style="font-size:14px;margin-left:8px">${unread} unread</span>` : ""}</h2>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search messages..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["From", "Email", "Subject", "Date", "Status"], filtered, r => `
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.email || "—")}</td>
            <td>${escapeHtml(r.subject || "—")}</td>
            <td>${formatDate(r.created_at)}</td>
            <td>${r.is_read ? '<span class="badge-secondary">Read</span>' : '<span class="badge-success">Unread</span>'}</td>
          `)}
        `, "#/admin/messages");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary view-btn" data-id="${r.id}">View</button>
            <button class="btn btn-sm btn-secondary mark-btn" data-id="${r.id}" data-read="${r.is_read}">${r.is_read ? "Mark Unread" : "Mark Read"}</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.querySelectorAll(".view-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;

            // Mark as read
            if (!row.is_read) {
              try {
                await update("contact_submissions", id, { is_read: true });
                row.is_read = true;
              } catch (e) { /* ignore */ }
            }

            await openModal(`${row.name} — ${row.subject || "No Subject"}`, [
              { name: "_info", label: "Email", type: "text" },
              { name: "_phone", label: "Phone", type: "text" },
              { name: "_date", label: "Date", type: "text" },
              { name: "_msg", label: "Message", type: "textarea" },
              { name: "admin_notes", label: "Admin Notes", type: "textarea" },
            ], {
              _info: row.email || "",
              _phone: row.phone || "",
              _date: formatDateTime(row.created_at),
              _msg: row.message || "",
              admin_notes: row.admin_notes || "",
            });

            // Save admin notes if changed
            const notesData = await openModal("Save Notes", [
              { name: "admin_notes", label: "Admin Notes", type: "textarea" },
            ], { admin_notes: row.admin_notes || "" });

            if (notesData) {
              try {
                await update("contact_submissions", id, { admin_notes: notesData.admin_notes });
                toast("Notes saved");
                rows = await list("contact_submissions");
                render();
              } catch (e) { toast(e.message, "err"); }
            } else {
              rows = await list("contact_submissions");
              render();
            }
          });
        });

        document.querySelectorAll(".mark-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const isRead = btn.dataset.read === "true";
            try {
              await update("contact_submissions", id, { is_read: !isRead });
              toast(isRead ? "Marked unread" : "Marked read");
              rows = await list("contact_submissions");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this message?")) return;
            try {
              await remove("contact_submissions", btn.dataset.id);
              toast("Message deleted");
              rows = await list("contact_submissions");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/messages");
    }
  });

  // ADMIN ENROLLMENTS
  on("/admin/enrollments", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/enrollments");

    try {
      let rows = await list("enrollments");
      let studentsList = await list("students");
      let coursesList = await list("courses");

      const studentOpts = studentsList.map(s => ({
        value: s.id,
        label: `${s.first_name} ${s.last_name}`,
      }));
      const courseOpts = coursesList.map(c => ({
        value: c.id,
        label: c.name,
      }));

      const studentMap = {};
      for (const s of studentsList) studentMap[s.id] = s;
      const courseMap = {};
      for (const c of coursesList) courseMap[c.id] = c;

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r => {
          const s = studentMap[r.student_id];
          const c = courseMap[r.course_id];
          const txt = `${s ? s.first_name + " " + s.last_name : ""} ${c ? c.name : ""} ${r.status || ""}`.toLowerCase();
          return txt.includes(search);
        });

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Enrollments</h2>
            <button class="btn btn-primary" id="add-enrollment">+ Add Enrollment</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search enrollments..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Student", "Course", "Status", "Enrolled"], filtered, r => {
            const s = studentMap[r.student_id];
            const c = courseMap[r.course_id];
            return `
              <td>${s ? escapeHtml(`${s.first_name} ${s.last_name}`) : "—"}</td>
              <td>${c ? escapeHtml(c.name) : "—"}</td>
              <td>${statusBadge(r.status, {
                active: { label: "Active", cls: "badge-success" },
                completed: { label: "Completed", cls: "badge-primary" },
                dropped: { label: "Dropped", cls: "badge-danger" },
              })}</td>
              <td>${formatDate(r.enrolled_at)}</td>`;
          })}
        `, "#/admin/enrollments");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-enrollment")?.addEventListener("click", async () => {
          const data = await openModal("Add Enrollment", [
            { name: "student_id", label: "Student", type: "select", options: studentOpts },
            { name: "course_id", label: "Course", type: "select", options: courseOpts },
            { name: "status", label: "Status", type: "select", options: ["active", "completed", "dropped"] },
          ], { status: "active" });
          if (data) {
            data.enrolled_at = new Date().toISOString();
            try {
              await create("enrollments", data);
              toast("Enrollment created");
              rows = await list("enrollments");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Enrollment", [
              { name: "student_id", label: "Student", type: "select", options: studentOpts },
              { name: "course_id", label: "Course", type: "select", options: courseOpts },
              { name: "status", label: "Status", type: "select", options: ["active", "completed", "dropped"] },
            ], row);
            if (data) {
              try {
                await update("enrollments", id, data);
                toast("Enrollment updated");
                rows = await list("enrollments");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this enrollment?")) return;
            try {
              await remove("enrollments", btn.dataset.id);
              toast("Enrollment deleted");
              rows = await list("enrollments");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/enrollments");
    }
  });

  // ADMIN GRADES
  on("/admin/grades", async () => {
    renderAdmin(`<p>Loading...</p>`, "#/admin/grades");

    try {
      let rows = await list("grades");
      let studentsList = await list("students");
      let coursesList = await list("courses");

      const studentOpts = studentsList.map(s => ({
        value: s.id,
        label: `${s.first_name} ${s.last_name}`,
      }));
      const courseOpts = coursesList.map(c => ({
        value: c.id,
        label: c.name,
      }));

      const studentMap = {};
      for (const s of studentsList) studentMap[s.id] = s;
      const courseMap = {};
      for (const c of coursesList) courseMap[c.id] = c;

      function render() {
        const search = (document.getElementById("admin-search")?.value || "").toLowerCase();
        const filtered = rows.filter(r => {
          const s = studentMap[r.student_id];
          const c = courseMap[r.course_id];
          const txt = `${s ? s.first_name + " " + s.last_name : ""} ${c ? c.name : ""} ${r.assignment_name || ""} ${r.grade_letter || ""}`.toLowerCase();
          return txt.includes(search);
        });

        renderAdmin(`
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2>Grades</h2>
            <button class="btn btn-primary" id="add-grade">+ Add Grade</button>
          </div>
          <div class="search-bar" style="margin:16px 0">
            <input type="text" id="admin-search" placeholder="Search grades..." class="form-control" value="${escapeHtml(search)}" />
          </div>
          ${renderTable(["Student", "Course", "Assignment", "Score", "Grade"], filtered, r => {
            const s = studentMap[r.student_id];
            const c = courseMap[r.course_id];
            return `
              <td>${s ? escapeHtml(`${s.first_name} ${s.last_name}`) : "—"}</td>
              <td>${c ? escapeHtml(c.name) : "—"}</td>
              <td>${escapeHtml(r.assignment_name || "—")}</td>
              <td>${r.score != null ? r.score : "—"}/${r.max_score != null ? r.max_score : "—"}</td>
              <td>${escapeHtml(r.grade_letter || "—")}</td>`;
          })}
        `, "#/admin/grades");

        for (const r of filtered) {
          const cell = document.getElementById(`act-${r.id}`);
          if (!cell) continue;
          cell.innerHTML = `
            <button class="btn btn-sm btn-primary edit-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger del-btn" data-id="${r.id}">Del</button>`;
        }

        document.getElementById("admin-search")?.addEventListener("input", render);

        document.getElementById("add-grade")?.addEventListener("click", async () => {
          const data = await openModal("Add Grade", [
            { name: "student_id", label: "Student", type: "select", options: studentOpts },
            { name: "course_id", label: "Course", type: "select", options: courseOpts },
            { name: "assignment_name", label: "Assignment Name", type: "text" },
            { name: "score", label: "Score", type: "number" },
            { name: "max_score", label: "Max Score", type: "number" },
            { name: "grade_letter", label: "Grade Letter", type: "text" },
            { name: "comments", label: "Comments", type: "textarea" },
          ]);
          if (data) {
            try {
              await create("grades", data);
              toast("Grade added");
              rows = await list("grades");
              render();
            } catch (e) { toast(e.message, "err"); }
          }
        });

        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const row = rows.find(r => r.id == id);
            if (!row) return;
            const data = await openModal("Edit Grade", [
              { name: "student_id", label: "Student", type: "select", options: studentOpts },
              { name: "course_id", label: "Course", type: "select", options: courseOpts },
              { name: "assignment_name", label: "Assignment Name", type: "text" },
              { name: "score", label: "Score", type: "number" },
              { name: "max_score", label: "Max Score", type: "number" },
              { name: "grade_letter", label: "Grade Letter", type: "text" },
              { name: "comments", label: "Comments", type: "textarea" },
            ], row);
            if (data) {
              try {
                await update("grades", id, data);
                toast("Grade updated");
                rows = await list("grades");
                render();
              } catch (e) { toast(e.message, "err"); }
            }
          });
        });

        document.querySelectorAll(".del-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Delete this grade?")) return;
            try {
              await remove("grades", btn.dataset.id);
              toast("Grade deleted");
              rows = await list("grades");
              render();
            } catch (e) { toast(e.message, "err"); }
          });
        });
      }

      render();
    } catch (err) {
      renderAdmin(`<p>Error: ${escapeHtml(err.message)}</p>`, "#/admin/grades");
    }
  });

  // ── Init ─────────────────────────────────────────────────
  matchRoute();
})();
