const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'its-tarefas-secret-2026-mudar-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// ===== AUTH MIDDLEWARE =====
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Nao autenticado' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  res.status(403).json({ error: 'Acesso restrito ao administrador' });
}

// Helper: enrich task with user data
function enrichTask(task) {
  const user = db.get('users').find({ id: task.assignee_id }).value();
  return {
    ...task,
    assignee_name: user ? user.name : 'Desconhecido',
    assignee_color: user ? user.color : '#868e96'
  };
}

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== TV MODE (public) =====
app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

app.get('/api/tv/tasks', (req, res) => {
  const tasks = db.get('tasks').filter(t => t.status !== 'archived').value().map(enrichTask);
  const members = db.get('users').value().map(({ id, name, color, role }) => ({ id, name, color, role }));
  res.json({ tasks, members });
});

// ===== AUTH ROUTES =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username }).value();
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuario ou senha incorretos' });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.userName = user.name;
  res.json({ id: user.id, name: user.name, role: user.role, color: user.color });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user) return res.status(401).json({ error: 'Sessao invalida' });
  res.json({ id: user.id, name: user.name, username: user.username, role: user.role, color: user.color });
});

// ===== USER ROUTES (admin) =====
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.get('users').value().map(({ id, name, username, role, color }) => ({ id, name, username, role, color }));
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { name, username, password, role, color } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Campos obrigatorios: name, username, password' });
  const exists = db.get('users').find({ username }).value();
  if (exists) return res.status(400).json({ error: 'Username ja existe' });
  const id = db.get('nextUserId').value();
  const hash = bcrypt.hashSync(password, 10);
  db.get('users').push({ id, name, username, password: hash, role: role || 'user', color: color || '#3b5bdb', created_at: new Date().toISOString() }).write();
  db.update('nextUserId', n => n + 1).write();
  res.json({ id, name, username, role: role || 'user', color: color || '#3b5bdb' });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.get('users').find({ id }).value();
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
  const { name, username, password, role, color } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (username) updates.username = username;
  if (role) updates.role = role;
  if (color) updates.color = color;
  if (password) updates.password = bcrypt.hashSync(password, 10);
  db.get('users').find({ id }).assign(updates).write();
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) return res.status(400).json({ error: 'Nao pode excluir a si mesmo' });
  db.get('users').remove({ id }).write();
  res.json({ ok: true });
});

// ===== TASK ROUTES =====
app.get('/api/tasks', requireAuth, (req, res) => {
  const tasks = db.get('tasks').filter(t => t.status !== 'archived').value().map(enrichTask);
  res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { client, title, assignee_id, deadline, priority, status } = req.body;
  if (!client || !title || !deadline) return res.status(400).json({ error: 'Campos obrigatorios' });
  const id = db.get('nextTaskId').value();
  const task = {
    id, client, title,
    assignee_id: assignee_id || req.session.userId,
    deadline, priority: priority || 'normal',
    status: status || 'todo',
    created_by: req.session.userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.get('tasks').push(task).write();
  db.update('nextTaskId', n => n + 1).write();
  res.json(enrichTask(task));
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const task = db.get('tasks').find({ id }).value();
  if (!task) return res.status(404).json({ error: 'Tarefa nao encontrada' });
  const { client, title, assignee_id, deadline, priority, status } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (client) updates.client = client;
  if (title) updates.title = title;
  if (assignee_id) updates.assignee_id = assignee_id;
  if (deadline) updates.deadline = deadline;
  if (priority) updates.priority = priority;
  if (status) updates.status = status;
  db.get('tasks').find({ id }).assign(updates).write();
  const updated = db.get('tasks').find({ id }).value();
  res.json(enrichTask(updated));
});

app.patch('/api/tasks/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  db.get('tasks').find({ id }).assign({ status, updated_at: new Date().toISOString() }).write();
  const task = db.get('tasks').find({ id }).value();
  res.json(enrichTask(task));
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.get('tasks').remove({ id }).write();
  res.json({ ok: true });
});

// Bulk import
app.post('/api/tasks/bulk', requireAuth, (req, res) => {
  const { tasks: newTasks } = req.body;
  if (!Array.isArray(newTasks)) return res.status(400).json({ error: 'Envie um array de tarefas' });
  const users = db.get('users').value();

  const findUser = (name) => {
    if (!name) return req.session.userId;
    const lower = name.toLowerCase().trim();
    const u = users.find(u => u.name.toLowerCase() === lower) || users.find(u => u.name.toLowerCase().includes(lower) || lower.includes(u.name.toLowerCase()));
    return u ? u.id : req.session.userId;
  };

  let imported = 0;
  for (const t of newTasks) {
    if (t.client && t.title) {
      const id = db.get('nextTaskId').value();
      db.get('tasks').push({
        id, client: t.client, title: t.title,
        assignee_id: findUser(t.assignee_name),
        deadline: t.deadline || defaultDeadline(),
        priority: t.priority || 'normal',
        status: 'todo',
        created_by: req.session.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).write();
      db.update('nextTaskId', n => n + 1).write();
      imported++;
    }
  }
  res.json({ imported });
});

function defaultDeadline() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// ===== START =====
app.listen(PORT, () => {
  console.log(`\nITS Tarefas rodando em http://localhost:${PORT}`);
  console.log(`Modo TV (sem login): http://localhost:${PORT}/tv`);
  console.log(`Login admin: felipe / its2026\n`);
});
