const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

// Default structure
db.defaults({
  users: [],
  tasks: [],
  nextUserId: 1,
  nextTaskId: 1
}).write();

// Seed default data if empty
if (db.get('users').size().value() === 0) {
  console.log('Criando usuarios padrao...');

  const defaultUsers = [
    { name: 'Felipe', username: 'felipe', password: bcrypt.hashSync('its2026', 10), role: 'admin', color: '#3b5bdb' },
    { name: 'Socio 2', username: 'socio2', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#7048e8' },
    { name: 'Socio 3', username: 'socio3', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#2b8a3e' },
    { name: 'Socio 4', username: 'socio4', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#e67700' },
    { name: 'Socio 5', username: 'socio5', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#c92a2a' },
    { name: 'Socio 6', username: 'socio6', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#0c8599' },
  ];

  let userId = 1;
  for (const u of defaultUsers) {
    db.get('users').push({ id: userId, ...u, created_at: new Date().toISOString() }).write();
    userId++;
  }
  db.set('nextUserId', userId).write();

  const sampleTasks = [
    { client: 'Tech Solutions Ltda', title: 'Alteracao contratual - Inclusao de socio', assignee_id: 1, deadline: '2026-04-04', priority: 'urgente', status: 'doing' },
    { client: 'Grupo Alfa S.A.', title: 'Planejamento tributario anual', assignee_id: 2, deadline: '2026-04-10', priority: 'alta', status: 'todo' },
    { client: 'Comercial Beta ME', title: 'Abertura de filial - CNPJ', assignee_id: 3, deadline: '2026-04-06', priority: 'normal', status: 'todo' },
    { client: 'Industria Gama Ltda', title: 'IRPJ - Declaracao trimestral', assignee_id: 1, deadline: '2026-04-03', priority: 'urgente', status: 'doing' },
    { client: 'StartUp Delta', title: 'Constituicao de holding familiar', assignee_id: 4, deadline: '2026-04-15', priority: 'normal', status: 'todo' },
    { client: 'Logistica Omega', title: 'Reestruturacao societaria', assignee_id: 2, deadline: '2026-03-30', priority: 'alta', status: 'doing' },
    { client: 'Farmacia Vida', title: 'Registro na Junta Comercial', assignee_id: 5, deadline: '2026-04-20', priority: 'normal', status: 'done' },
  ];

  let taskId = 1;
  for (const t of sampleTasks) {
    db.get('tasks').push({ id: taskId, ...t, created_by: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).write();
    taskId++;
  }
  db.set('nextTaskId', taskId).write();

  console.log('Usuarios e tarefas de exemplo criados!');
  console.log('Login admin: felipe / its2026');
  console.log('IMPORTANTE: Troque as senhas apos o primeiro acesso!');
}

module.exports = db;
