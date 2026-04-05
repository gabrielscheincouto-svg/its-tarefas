const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { supabase, seedDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'its-tarefas-secret-2026-mudar-em-producao',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
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
async function enrichTask(task, usersCache) {
    const user = usersCache.find(u => u.id === task.assignee_id);
    return {
          ...task,
          assignee_name: user ? user.name : 'Desconhecido',
          assignee_color: user ? user.color : '#868e96'
    };
}

async function enrichTasks(tasks) {
    const { data: users } = await supabase.from('users').select('id, name, color');
    return Promise.all(tasks.map(t => enrichTask(t, users || [])));
}

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== TV MODE (public) =====
app.get('/tv', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

app.get('/api/tv/tasks', async (req, res) => {
    try {
          const { data: tasks } = await supabase.from('tasks').select('*').neq('status', 'archived');
          const { data: users } = await supabase.from('users').select('id, name, color, role');
          const enriched = await Promise.all((tasks || []).map(t => enrichTask(t, users || [])));
          const members = (users || []).map(({ id, name, color, role }) => ({ id, name, color, role }));
          res.json({ tasks: enriched, members });
    } catch (err) {
          res.status(500).json({ error: 'Erro interno' });
    }
});

// ===== AUTH ROUTES =====
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: users } = await supabase.from('users').select('*').eq('username', username).limit(1);
    const user = users && users[0];
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

app.get('/api/me', requireAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*').eq('id', req.session.userId).limit(1);
    const user = users && users[0];
    if (!user) return res.status(401).json({ error: 'Sessao invalida' });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role, color: user.color });
});

// ===== USER ROUTES (admin) =====
app.get('/api/users', requireAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('id, name, username, role, color');
    res.json(users || []);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { name, username, password, role, color } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Campos obrigatorios: name, username, password' });

           const { data: existing } = await supabase.from('users').select('id').eq('username', username).limit(1);
    if (existing && existing.length > 0) return res.status(400).json({ error: 'Username ja existe' });

           const hash = bcrypt.hashSync(password, 10);
    const { data: newUsers, error } = await supabase.from('users').insert({
          name, username, password: hash, role: role || 'user', color: color || '#3b5bdb'
    }).select('id, name, username, role, color');

           if (error) return res.status(500).json({ error: error.message });
    res.json(newUsers[0]);
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { name, username, password, role, color } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (username) updates.username = username;
    if (role) updates.role = role;
    if (color) updates.color = color;
    if (password) updates.password = bcrypt.hashSync(password, 10);

          const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ error: 'Nao pode excluir a si mesmo' });
    await supabase.from('users').delete().eq('id', id);
    res.json({ ok: true });
});

// ===== TASK ROUTES =====
app.get('/api/tasks', requireAuth, async (req, res) => {
    const { data: tasks } = await supabase.from('tasks').select('*').neq('status', 'archived');
    const enriched = await enrichTasks(tasks || []);
    res.json(enriched);
});

app.post('/api/tasks', requireAuth, async (req, res) => {
    const { client, title, assignee_id, deadline, priority, status } = req.body;
    if (!client || !title || !deadline) return res.status(400).json({ error: 'Campos obrigatorios' });

           const { data: newTasks, error } = await supabase.from('tasks').insert({
                 client,
                 title,
                 assignee_id: assignee_id || req.session.userId,
                 deadline,
                 priority: priority || 'normal',
                 status: status || 'todo',
                 created_by: req.session.userId
           }).select();

           if (error) return res.status(500).json({ error: error.message });
    const enriched = await enrichTasks(newTasks);
    res.json(enriched[0]);
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { client, title, assignee_id, deadline, priority, status } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (client) updates.client = client;
    if (title) updates.title = title;
    if (assignee_id) updates.assignee_id = assignee_id;
    if (deadline) updates.deadline = deadline;
    if (priority) updates.priority = priority;
    if (status) updates.status = status;

          const { data: updated, error } = await supabase.from('tasks').update(updates).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });
    const enriched = await enrichTasks(updated || []);
    res.json(enriched[0]);
});

app.patch('/api/tasks/:id/status', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    const { data: updated } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select();
    const enriched = await enrichTasks(updated || []);
    res.json(enriched[0]);
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    await supabase.from('tasks').delete().eq('id', id);
    res.json({ ok: true });
});

// Bulk import
app.post('/api/tasks/bulk', requireAuth, async (req, res) => {
    const { tasks: newTasks } = req.body;
    if (!Array.isArray(newTasks)) return res.status(400).json({ error: 'Envie um array de tarefas' });

           const { data: users } = await supabase.from('users').select('id, name');
    const findUser = (name) => {
          if (!name) return req.session.userId;
          const lower = name.toLowerCase().trim();
          const u = (users || []).find(u => u.name.toLowerCase() === lower) ||
                          (users || []).find(u => u.name.toLowerCase().includes(lower) || lower.includes(u.name.toLowerCase()));
          return u ? u.id : req.session.userId;
    };

           const tasksToInsert = newTasks
      .filter(t => t.client && t.title)
      .map(t => ({
              client: t.client,
              title: t.title,
              assignee_id: findUser(t.assignee_name),
              deadline: t.deadline || defaultDeadline(),
              priority: t.priority || 'normal',
              status: 'todo',
              created_by: req.session.userId
      }));

           if (tasksToInsert.length === 0) return res.json({ imported: 0 });

           const { error } = await supabase.from('tasks').insert(tasksToInsert);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ imported: tasksToInsert.length });
});

function defaultDeadline() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
}

// ===== START =====
async function start() {
    await seedDatabase();
    app.listen(PORT, () => {
          console.log(`\nITS Tarefas rodando em http://localhost:${PORT}`);
          console.log(`Modo TV (sem login): http://localhost:${PORT}/tv`);
          console.log(`Login admin: gabriel / its2026\n`);
    });
}

start().catch(err => {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
});
