const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { supabase, seedDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Refuse to start in production without a strong session secret
if (IS_PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    console.error('ERRO: SESSION_SECRET obrigatorio em producao (minimo 32 caracteres).');
    process.exit(1);
}

// Trust proxy (necessario no Render/Heroku para detectar HTTPS)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Forcar HTTPS em producao
if (IS_PROD) {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, 'https://' + req.headers.host + req.url);
        }
        next();
    });
}

// Limites de tamanho
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sessao com cookies seguros em producao
app.use(session({
    name: 'its.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-troque-em-producao-32chars',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 horas (era 30 dias)
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD
    }
}));

// Rate limit para login (anti brute force): 8 tentativas por IP a cada 15 min
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
});

// Rate limit geral da API: 300 reqs por minuto por IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Helper: validar forca de senha
function isStrongPassword(pw) {
    if (!pw || typeof pw !== 'string') return false;
    if (pw.length < 8) return false;
    // pelo menos 1 letra e 1 numero
    return /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

// Helper: delay constante para evitar timing attacks em login
async function constantTimeDelay() {
    return new Promise(r => setTimeout(r, 200));
}

// ===== AUTH MIDDLEWARE =====
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ error: 'Nao autenticado' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') return next();
    res.status(403).json({ error: 'Acesso restrito ao administrador' });
}

// Helper: enrich task with user data and checklist progress
async function enrichTask(task, usersCache, lastHistoryByTask) {
    const user = usersCache.find(u => u.id === task.assignee_id);

    // Fetch checklist items for this task
    let checklist_total = 0;
    let checklist_done = 0;
    try {
        const { data: checklistItems } = await supabase
            .from('task_checklist_items')
            .select('id, done')
            .eq('task_id', task.id);

        if (checklistItems) {
            checklist_total = checklistItems.length;
            checklist_done = checklistItems.filter(item => item.done).length;
        }
    } catch (err) {
        // If checklist table doesn't exist yet, just continue
    }

    let last_history = lastHistoryByTask ? (lastHistoryByTask[task.id] || null) : null;
    if (!lastHistoryByTask) {
        try {
            const { data: hist } = await supabase
                .from('task_history')
                .select('*')
                .eq('task_id', task.id)
                .order('created_at', { ascending: false })
                .limit(1);
            if (hist && hist[0]) last_history = hist[0];
        } catch (err) {}
    }

    // Get original deadline from first deadline change in history
    let original_deadline = null;
    try {
        const { data: dlHist } = await supabase
            .from('task_history')
            .select('old_value')
            .eq('task_id', task.id)
            .eq('field_changed', 'deadline')
            .order('created_at', { ascending: true })
            .limit(1);
        if (dlHist && dlHist[0] && dlHist[0].old_value) {
            original_deadline = dlHist[0].old_value;
        }
    } catch (err) {}

    return {
          ...task,
          assignee_name: user ? user.name : 'Desconhecido',
          assignee_color: user ? user.color : '#868e96',
          checklist_total,
          checklist_done,
          last_history,
          original_deadline,
          additional_assignees_parsed: task.additional_assignees ? (() => {
              try {
                  const ids = JSON.parse(task.additional_assignees);
                  return ids.map(id => {
                      const u = usersCache.find(x => x.id === id);
                      return u ? { id: u.id, name: u.name, color: u.color } : null;
                  }).filter(Boolean);
              } catch(e) { return []; }
          })() : [],
    };
}

async function enrichTasks(tasks) {
    const { data: users } = await supabase.from('users').select('id, name, color');
    // Bulk fetch latest history per task
    const lastHistoryByTask = {};
    try {
        const ids = tasks.map(t => t.id);
        if (ids.length > 0) {
            const { data: hist } = await supabase
                .from('task_history')
                .select('*')
                .in('task_id', ids)
                .order('created_at', { ascending: false });
            if (hist) {
                for (const h of hist) {
                    if (!lastHistoryByTask[h.task_id]) lastHistoryByTask[h.task_id] = h;
                }
            }
        }
    } catch (err) {}
    return Promise.all(tasks.map(t => enrichTask(t, users || [], lastHistoryByTask)));
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
app.post('/api/login', loginLimiter, async (req, res) => {
    await constantTimeDelay();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciais invalidas' });

    const { data: users } = await supabase.from('users').select('*').eq('username', username).limit(1);
    const user = users && users[0];
    // Sempre roda bcrypt mesmo se user nao existe (timing attack defense)
    const fakeHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8gMhKlG7AYj5LwY7V5cfQGT7Ul3dHG';
    const valid = user ? bcrypt.compareSync(password, user.password) : bcrypt.compareSync(password, fakeHash);

    if (!user || !valid) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    // Regenera sessao para prevenir session fixation
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Erro de sessao' });
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.userName = user.name;
        req.session.save(() => {
            res.json({ id: user.id, name: user.name, role: user.role, color: user.color });
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('its.sid');
        res.json({ ok: true });
    });
});

app.get('/api/me', requireAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*').eq('id', req.session.userId).limit(1);
    const user = users && users[0];
    if (!user) return res.status(401).json({ error: 'Sessao invalida' });
    res.json({ id: user.id, name: user.name, username: user.username, role: user.role, color: user.color });
});

// ===== PASSWORD CHANGE ROUTE =====
app.put('/api/me/password', requireAuth, async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
        return res.status(400).json({ error: 'old_password e new_password sao obrigatorios' });
    }
    if (!isStrongPassword(new_password)) {
        return res.status(400).json({ error: 'Senha fraca: minimo 8 caracteres com letras e numeros' });
    }

    try {
        const { data: users } = await supabase.from('users').select('*').eq('id', req.session.userId).limit(1);
        const user = users && users[0];

        if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' });

        // Validate old password
        if (!bcrypt.compareSync(old_password, user.password)) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        // Hash new password
        const newHash = bcrypt.hashSync(new_password, 10);

        // Update password
        const { error } = await supabase.from('users').update({ password: newHash }).eq('id', req.session.userId);
        if (error) return res.status(500).json({ error: error.message });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// ===== USER ROUTES (admin) =====
app.get('/api/users', requireAuth, async (req, res) => {
    const { data: users } = await supabase.from('users').select('id, name, username, role, color');
    res.json(users || []);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { name, username, password, role, color } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'Campos obrigatorios: name, username, password' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'Senha fraca: minimo 8 caracteres com letras e numeros' });

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
    if (password) {
        if (!isStrongPassword(password)) return res.status(400).json({ error: 'Senha fraca: minimo 8 caracteres com letras e numeros' });
        updates.password = bcrypt.hashSync(password, 10);
    }

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

// ===== TASK HISTORY HELPER =====
async function logTaskHistory(taskId, userId, userName, action, fieldChanged, oldValue, newValue, reason) {
    try {
        await supabase.from('task_history').insert({
            task_id: taskId,
            user_id: userId,
            user_name: userName,
            action,
            field_changed: fieldChanged || null,
            old_value: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
            new_value: newValue !== undefined && newValue !== null ? String(newValue) : null,
            reason: reason || null,
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('Erro ao gravar historico:', err.message);
    }
}

// Field labels in Portuguese for history display
const fieldLabels = {
    client: 'Cliente',
    title: 'Descricao',
    assignee_id: 'Responsavel',
    deadline: 'Prazo',
    priority: 'Prioridade',
    status: 'Status',
    value: 'Valor',
    contract_link: 'Link do Contrato'
};

const statusLabels = { todo: 'A Fazer', doing: 'Em Andamento', done: 'Concluido' };
const priorityLabels = { normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };

// ===== TASK ROUTES =====
app.get('/api/tasks', requireAuth, async (req, res) => {
    const { data: tasks } = await supabase.from('tasks').select('*').neq('status', 'archived');
    const enriched = await enrichTasks(tasks || []);
    res.json(enriched);
});

app.post('/api/tasks', requireAuth, async (req, res) => {
    const { client, title, assignee_id, deadline, priority, status, value, contract_link, additional_assignees } = req.body;
    if (!client || !title || !deadline) return res.status(400).json({ error: 'Campos obrigatorios' });

           const { data: newTasks, error } = await supabase.from('tasks').insert({
                 client,
                 title,
                 assignee_id: assignee_id || req.session.userId,
                 deadline,
                 priority: priority || 'normal',
                 status: status || 'todo',
                 value: value || null,
                 contract_link: contract_link || null,
                 additional_assignees: additional_assignees ? JSON.stringify(additional_assignees) : null,
                 created_by: req.session.userId
           }).select();

           if (error) return res.status(500).json({ error: error.message });

    // Log task creation
    if (newTasks && newTasks[0]) {
        await logTaskHistory(newTasks[0].id, req.session.userId, req.session.userName, 'created', null, null, null, null);
    }

    const enriched = await enrichTasks(newTasks);
    res.json(enriched[0]);
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { client, title, assignee_id, deadline, priority, status, value, contract_link, deadline_reason, additional_assignees } = req.body;

    // Fetch current task to compare changes
    const { data: currentTasks } = await supabase.from('tasks').select('*').eq('id', id).limit(1);
    const current = currentTasks && currentTasks[0];
    if (!current) return res.status(404).json({ error: 'Tarefa nao encontrada' });

    // Require reason if deadline is changing
    if (deadline && deadline !== current.deadline && !deadline_reason) {
        return res.status(400).json({ error: 'Motivo obrigatorio ao alterar o prazo', require_reason: true });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (client) updates.client = client;
    if (title) updates.title = title;
    if (assignee_id) updates.assignee_id = assignee_id;
    if (deadline) updates.deadline = deadline;
    if (priority) updates.priority = priority;
    if (status) updates.status = status;
    if (value !== undefined) updates.value = value;
    if (contract_link !== undefined) updates.contract_link = contract_link;
    if (additional_assignees !== undefined) updates.additional_assignees = JSON.stringify(additional_assignees);

    const { data: updated, error } = await supabase.from('tasks').update(updates).eq('id', id).select();
    if (error) return res.status(500).json({ error: error.message });

    // Log all changes
    const fieldsToCheck = ['client', 'title', 'assignee_id', 'deadline', 'priority', 'status', 'value', 'contract_link'];
    const { data: allUsers } = await supabase.from('users').select('id, name');

    for (const field of fieldsToCheck) {
        if (updates[field] !== undefined && String(updates[field]) !== String(current[field])) {
            let oldVal = current[field];
            let newVal = updates[field];

            // Resolve assignee names
            if (field === 'assignee_id' && allUsers) {
                const oldUser = allUsers.find(u => u.id === current[field]);
                const newUser = allUsers.find(u => u.id === updates[field]);
                oldVal = oldUser ? oldUser.name : oldVal;
                newVal = newUser ? newUser.name : newVal;
            }
            if (field === 'status') { oldVal = statusLabels[oldVal] || oldVal; newVal = statusLabels[newVal] || newVal; }
            if (field === 'priority') { oldVal = priorityLabels[oldVal] || oldVal; newVal = priorityLabels[newVal] || newVal; }
            if (field === 'value') { oldVal = oldVal ? `R$ ${Number(oldVal).toFixed(2)}` : 'Nenhum'; newVal = newVal ? `R$ ${Number(newVal).toFixed(2)}` : 'Nenhum'; }

            const reason = field === 'deadline' ? deadline_reason : null;
            await logTaskHistory(id, req.session.userId, req.session.userName, 'updated', fieldLabels[field] || field, oldVal, newVal, reason);
        }
    }

    const enriched = await enrichTasks(updated || []);
    res.json(enriched[0]);
});

app.patch('/api/tasks/:id/status', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    // Get current status for logging
    const { data: currentTasks } = await supabase.from('tasks').select('status').eq('id', id).limit(1);
    const current = currentTasks && currentTasks[0];

    const { data: updated } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select();

    // Log status change
    if (current && current.status !== status) {
        const oldLabel = statusLabels[current.status] || current.status;
        const newLabel = statusLabels[status] || status;
        await logTaskHistory(id, req.session.userId, req.session.userName, 'updated', 'Status', oldLabel, newLabel, null);
    }

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
              value: t.value || null,
              contract_link: t.contract_link || null,
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

// ===== CHECKLIST TEMPLATE ROUTES =====
app.get('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
        const { data: templates } = await supabase.from('checklist_templates').select('*').order('created_at', { ascending: false });

        const result = await Promise.all((templates || []).map(async (template) => {
            const { data: items } = await supabase
                .from('checklist_template_items')
                .select('id, title, sort_order')
                .eq('template_id', template.id)
                .order('sort_order', { ascending: true });

            return {
                ...template,
                items: items || []
            };
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

app.post('/api/checklist-templates', requireAuth, async (req, res) => {
    const { name, items } = req.body;
    if (!name) return res.status(400).json({ error: 'name e obrigatorio' });

    try {
        const { data: newTemplate, error: templateError } = await supabase
            .from('checklist_templates')
            .insert({
                name,
                created_by: req.session.userId,
                created_at: new Date().toISOString()
            })
            .select()
            .limit(1);

        if (templateError) return res.status(500).json({ error: templateError.message });
        if (!newTemplate || newTemplate.length === 0) return res.status(500).json({ error: 'Erro ao criar template' });

        const templateId = newTemplate[0].id;
        let itemsCreated = [];

        if (items && Array.isArray(items) && items.length > 0) {
            const itemsToInsert = items.map((item, idx) => ({
                template_id: templateId,
                title: item.title,
                sort_order: item.sort_order !== undefined ? item.sort_order : idx
            }));

            const { data: createdItems, error: itemsError } = await supabase
                .from('checklist_template_items')
                .insert(itemsToInsert)
                .select();

            if (itemsError) return res.status(500).json({ error: itemsError.message });
            itemsCreated = createdItems || [];
        }

        res.json({
            ...newTemplate[0],
            items: itemsCreated
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar template' });
    }
});

app.put('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    const templateId = Number(req.params.id);
    const { name, items } = req.body;

    try {
        if (name) {
            const { error: updateError } = await supabase
                .from('checklist_templates')
                .update({ name })
                .eq('id', templateId);

            if (updateError) return res.status(500).json({ error: updateError.message });
        }

        if (items && Array.isArray(items)) {
            // Delete existing items
            await supabase.from('checklist_template_items').delete().eq('template_id', templateId);

            // Insert new items
            if (items.length > 0) {
                const itemsToInsert = items.map((item, idx) => ({
                    template_id: templateId,
                    title: item.title,
                    sort_order: item.sort_order !== undefined ? item.sort_order : idx
                }));

                const { error: itemsError } = await supabase
                    .from('checklist_template_items')
                    .insert(itemsToInsert);

                if (itemsError) return res.status(500).json({ error: itemsError.message });
            }
        }

        // Fetch updated template with items
        const { data: template } = await supabase
            .from('checklist_templates')
            .select('*')
            .eq('id', templateId)
            .limit(1);

        if (!template || template.length === 0) return res.status(404).json({ error: 'Template nao encontrado' });

        const { data: templateItems } = await supabase
            .from('checklist_template_items')
            .select('id, title, sort_order')
            .eq('template_id', templateId)
            .order('sort_order', { ascending: true });

        res.json({
            ...template[0],
            items: templateItems || []
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar template' });
    }
});

app.delete('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    const templateId = Number(req.params.id);

    try {
        // Delete items first
        await supabase.from('checklist_template_items').delete().eq('template_id', templateId);

        // Delete template
        const { error } = await supabase.from('checklist_templates').delete().eq('id', templateId);
        if (error) return res.status(500).json({ error: error.message });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar template' });
    }
});

// ===== TASK CHECKLIST ROUTES =====
app.get('/api/tasks/:id/checklist', requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);

    try {
        const { data: items } = await supabase
            .from('task_checklist_items')
            .select('id, task_id, title, done, deadline, sort_order')
            .eq('task_id', taskId)
            .order('sort_order', { ascending: true });

        res.json(items || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar checklist' });
    }
});

app.post('/api/tasks/:id/checklist', requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    const { items, template_id } = req.body;

    try {
        let itemsToInsert = [];

        if (template_id) {
            // Apply template
            const { data: templateItems } = await supabase
                .from('checklist_template_items')
                .select('title, sort_order')
                .eq('template_id', template_id);

            if (templateItems) {
                itemsToInsert = templateItems.map(item => ({
                    task_id: taskId,
                    title: item.title,
                    done: false,
                    deadline: null,
                    sort_order: item.sort_order
                }));
            }
        } else if (items && Array.isArray(items)) {
            // Add individual items
            itemsToInsert = items.map((item, idx) => ({
                task_id: taskId,
                title: item.title,
                done: false,
                deadline: item.deadline || null,
                sort_order: item.sort_order !== undefined ? item.sort_order : idx
            }));
        }

        if (itemsToInsert.length === 0) {
            return res.status(400).json({ error: 'items ou template_id obrigatorio' });
        }

        const { data: created, error } = await supabase
            .from('task_checklist_items')
            .insert(itemsToInsert)
            .select();

        if (error) return res.status(500).json({ error: error.message });
        res.json(created || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao adicionar items de checklist' });
    }
});

app.put('/api/tasks/:taskId/checklist/:itemId', requireAuth, async (req, res) => {
    const taskId = Number(req.params.taskId);
    const itemId = Number(req.params.itemId);
    const { title, done, deadline } = req.body;

    try {
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (done !== undefined) updates.done = done;
        if (deadline !== undefined) updates.deadline = deadline;

        const { data: updated, error } = await supabase
            .from('task_checklist_items')
            .update(updates)
            .eq('id', itemId)
            .eq('task_id', taskId)
            .select()
            .limit(1);

        if (error) return res.status(500).json({ error: error.message });
        if (!updated || updated.length === 0) return res.status(404).json({ error: 'Item nao encontrado' });

        res.json(updated[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar item' });
    }
});

app.delete('/api/tasks/:taskId/checklist/:itemId', requireAuth, async (req, res) => {
    const taskId = Number(req.params.taskId);
    const itemId = Number(req.params.itemId);

    try {
        const { error } = await supabase
            .from('task_checklist_items')
            .delete()
            .eq('id', itemId)
            .eq('task_id', taskId);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar item' });
    }
});

// ===== TASK HISTORY ROUTE =====
app.get('/api/tasks/:id/history', requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    try {
        const { data: history, error } = await supabase
            .from('task_history')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        res.json(history || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar historico' });
    }
});

// ===== CLIENT AUTH (portal do cliente) =====
function requireClient(req, res, next) {
    if (req.session && req.session.clientId) return next();
    res.status(401).json({ error: 'Nao autenticado' });
}

app.post('/api/client/login', loginLimiter, async (req, res) => {
    await constantTimeDelay();
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciais invalidas' });

    const { data: clients } = await supabase.from('clients').select('*').eq('username', username).eq('active', true).limit(1);
    const client = clients && clients[0];
    const fakeHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8gMhKlG7AYj5LwY7V5cfQGT7Ul3dHG';
    const valid = client ? bcrypt.compareSync(password, client.password) : bcrypt.compareSync(password, fakeHash);

    if (!client || !valid) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Erro de sessao' });
        req.session.clientId = client.id;
        req.session.clientName = client.name;
        req.session.save(() => {
            res.json({ id: client.id, name: client.name, company: client.company });
        });
    });
});

app.post('/api/client/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('its.sid');
        res.json({ ok: true });
    });
});

app.get('/api/client/me', requireClient, async (req, res) => {
    const { data: clients } = await supabase.from('clients').select('id, name, company, email').eq('id', req.session.clientId).limit(1);
    if (!clients || !clients[0]) return res.status(401).json({ error: 'Sessao invalida' });
    res.json(clients[0]);
});

// Client creates a ticket
app.post('/api/client/tickets', requireClient, async (req, res) => {
    const { subject, description, priority, department } = req.body;
    if (!subject || !description) return res.status(400).json({ error: 'Assunto e descricao obrigatorios' });
    const validDepts = ['fiscal', 'contabil', 'societario', 'rh', 'financeiro', 'geral'];
    const insertObj = {
        client_id: req.session.clientId,
        subject, description,
        priority: priority || 'normal',
        status: 'aberto'
    };
    if (department && validDepts.includes(department)) insertObj.department = department;
    const { data, error } = await supabase.from('tickets').insert(insertObj).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Client lists their own tickets
app.get('/api/client/tickets', requireClient, async (req, res) => {
    const { data } = await supabase.from('tickets').select('*').eq('client_id', req.session.clientId).order('created_at', { ascending: false });
    res.json(data || []);
});

// ===== ADMIN: manage clients =====
app.get('/api/clients', requireAuth, requireAdmin, async (req, res) => {
    const { data } = await supabase.from('clients').select('id, name, company, email, username, active, created_at').order('name');
    res.json(data || []);
});

app.post('/api/clients', requireAuth, requireAdmin, async (req, res) => {
    const { name, company, email, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password obrigatorios' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'Senha fraca: minimo 8 caracteres com letras e numeros' });
    const { data: ex } = await supabase.from('clients').select('id').eq('username', username).limit(1);
    if (ex && ex.length > 0) return res.status(400).json({ error: 'Username ja existe' });
    const hash = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase.from('clients').insert({ name, company, email, username, password: hash, active: true }).select('id, name, company, email, username, active');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.put('/api/clients/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { name, company, email, username, password, active } = req.body;
    const upd = {};
    if (name !== undefined) upd.name = name;
    if (company !== undefined) upd.company = company;
    if (email !== undefined) upd.email = email;
    if (username !== undefined) upd.username = username;
    if (active !== undefined) upd.active = active;
    if (password) {
        if (!isStrongPassword(password)) return res.status(400).json({ error: 'Senha fraca: minimo 8 caracteres com letras e numeros' });
        upd.password = bcrypt.hashSync(password, 10);
    }
    const { error } = await supabase.from('clients').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.delete('/api/clients/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    await supabase.from('clients').delete().eq('id', id);
    res.json({ ok: true });
});

// ===== ADMIN: tickets =====
app.get('/api/tickets', requireAuth, async (req, res) => {
    const { data: tickets } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
    const { data: clients } = await supabase.from('clients').select('id, name, company');
    const { data: allUsers } = await supabase.from('users').select('id, name, color');
    const enriched = (tickets || []).map(t => {
        const c = (clients || []).find(x => x.id === t.client_id);
        const u = (allUsers || []).find(x => x.id === t.assigned_to);
        return { ...t, client_name: c ? c.name : 'Cliente removido', client_company: c ? c.company : '', assigned_name: u ? u.name : null, assigned_color: u ? u.color : null };
    });
    res.json(enriched);
});

app.put('/api/tickets/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { status, assigned_to, response, priority } = req.body;
    const upd = { updated_at: new Date().toISOString() };
    if (status !== undefined) upd.status = status;
    if (assigned_to !== undefined) upd.assigned_to = assigned_to;
    if (response !== undefined) upd.response = response;
    if (priority !== undefined) upd.priority = priority;
    const { error } = await supabase.from('tickets').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

// Convert ticket to task
app.post('/api/tickets/:id/to-task', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { deadline, assignee_id, priority } = req.body;
    const { data: tickets } = await supabase.from('tickets').select('*').eq('id', id).limit(1);
    const ticket = tickets && tickets[0];
    if (!ticket) return res.status(404).json({ error: 'Chamado nao encontrado' });
    const { data: clientRows } = await supabase.from('clients').select('name, company').eq('id', ticket.client_id).limit(1);
    const c = clientRows && clientRows[0];
    const clientName = c ? (c.company || c.name) : 'Cliente';
    const { data: newTasks, error } = await supabase.from('tasks').insert({
        client: clientName,
        title: ticket.subject + ' - ' + ticket.description.slice(0, 100),
        assignee_id: assignee_id || req.session.userId,
        deadline: deadline || defaultDeadline(),
        priority: priority || ticket.priority || 'normal',
        status: 'todo',
        created_by: req.session.userId
    }).select();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('tickets').update({ status: 'em_andamento', task_id: newTasks[0].id, assigned_to: assignee_id || req.session.userId, updated_at: new Date().toISOString() }).eq('id', id);
    await logTaskHistory(newTasks[0].id, req.session.userId, req.session.userName, 'created', null, null, null, 'Criada a partir do chamado #' + id);
    res.json(newTasks[0]);
});

// ===== REPORTS =====
// Monthly report: stats per user for a given month (YYYY-MM)
app.get('/api/reports/monthly', requireAuth, async (req, res) => {
    const { month, user_id } = req.query; // month format: '2026-04'
    if (!month) return res.status(400).json({ error: 'month obrigatorio (YYYY-MM)' });
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    try {
        const { data: allUsers } = await supabase.from('users').select('id, name, color');
        let usersToReport = allUsers || [];
        if (user_id) usersToReport = usersToReport.filter(u => u.id === Number(user_id));

        // Fetch tasks updated/created in range + history
        const { data: allTasks } = await supabase.from('tasks').select('*');
        const { data: historyInMonth } = await supabase
            .from('task_history')
            .select('*')
            .gte('created_at', start)
            .lt('created_at', end);

        const result = usersToReport.map(u => {
            const userTasks = (allTasks || []).filter(t => t.assignee_id === u.id);
            const userHist = (historyInMonth || []).filter(h => h.user_id === u.id);

            // Completed in month: status changed to done in this month
            const completedHist = userHist.filter(h => h.field_changed === 'Status' && h.new_value === 'Concluido');
            const completedTaskIds = new Set(completedHist.map(h => h.task_id));
            const completedTasks = (allTasks || []).filter(t => completedTaskIds.has(t.id));

            // Pending open: tasks assigned to user not done
            const pending = userTasks.filter(t => t.status !== 'done');

            // Deadline extensions in month
            const deadlineChanges = userHist.filter(h => h.field_changed === 'Prazo');

            // Avg completion time (days) for tasks completed this month
            let avgDays = null;
            if (completedTasks.length > 0) {
                const totalMs = completedTasks.reduce((acc, t) => {
                    const created = new Date(t.created_at || t.updated_at);
                    const done = new Date(t.updated_at);
                    return acc + Math.max(0, done - created);
                }, 0);
                avgDays = Math.round((totalMs / completedTasks.length) / 86400000 * 10) / 10;
            }

            return {
                user: { id: u.id, name: u.name, color: u.color },
                completed: completedTasks.map(t => ({ id: t.id, client: t.client, title: t.title, deadline: t.deadline })),
                completed_count: completedTasks.length,
                pending: pending.map(t => ({ id: t.id, client: t.client, title: t.title, deadline: t.deadline, status: t.status, priority: t.priority })),
                pending_count: pending.length,
                deadline_extensions: deadlineChanges.map(h => ({ task_id: h.task_id, old: h.old_value, new: h.new_value, reason: h.reason, at: h.created_at })),
                deadline_extensions_count: deadlineChanges.length,
                avg_days_to_complete: avgDays
            };
        });

        res.json({ month, start, end, data: result });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao gerar relatorio: ' + err.message });
    }
});

// Client portal page routes
app.get('/cliente', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cliente.html')));
app.get('/cliente/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cliente-login.html')));
app.get('/relatorio', (req, res) => res.sendFile(path.join(__dirname, 'public', 'relatorio.html')));

// ===== WEATHER PROXY =====
app.get('/api/weather', async (req, res) => {
    try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=-30.0346&longitude=-51.2177&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Sao_Paulo&forecast_days=5&hourly=relativehumidity_2m';
        const r = await fetch(url);
        const data = await r.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
