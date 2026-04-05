const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
    // Verifica se ja existem usuarios
  const { data: existingUsers } = await supabase.from('users').select('id').limit(1);

  if (existingUsers && existingUsers.length > 0) {
        console.log('Banco de dados ja possui dados. Seed ignorado.');
        return;
  }

  console.log('Criando usuarios padrao...');

  const defaultUsers = [
    { name: 'Gabriel', username: 'gabriel', password: bcrypt.hashSync('its2026', 10), role: 'admin', color: '#3b5bdb' },
    { name: 'Socio 2', username: 'socio2', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#7048e8' },
    { name: 'Socio 3', username: 'socio3', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#2b8a3e' },
    { name: 'Socio 4', username: 'socio4', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#e67700' },
    { name: 'Socio 5', username: 'socio5', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#c92a2a' },
    { name: 'Socio 6', username: 'socio6', password: bcrypt.hashSync('its2026', 10), role: 'user', color: '#0c8599' },
      ];

  const { data: users, error: userError } = await supabase
      .from('users')
      .insert(defaultUsers)
      .select();

  if (userError) {
        console.error('Erro ao criar usuarios:', userError.message);
        return;
  }

  const gabriel = users.find(u => u.username === 'gabriel');
    const socio2 = users.find(u => u.username === 'socio2');
    const socio3 = users.find(u => u.username === 'socio3');
    const socio4 = users.find(u => u.username === 'socio4');
    const socio5 = users.find(u => u.username === 'socio5');

  const sampleTasks = [
    { client: 'Tech Solutions Ltda', title: 'Alteracao contratual - Inclusao de socio', assignee_id: gabriel.id, deadline: '2026-04-04', priority: 'urgente', status: 'doing', created_by: gabriel.id },
    { client: 'Grupo Alfa S.A.', title: 'Planejamento tributario anual', assignee_id: socio2.id, deadline: '2026-04-10', priority: 'alta', status: 'todo', created_by: gabriel.id },
    { client: 'Comercial Beta ME', title: 'Abertura de filial - CNPJ', assignee_id: socio3.id, deadline: '2026-04-06', priority: 'normal', status: 'todo', created_by: gabriel.id },
    { client: 'Industria Gama Ltda', title: 'IRPJ - Declaracao trimestral', assignee_id: gabriel.id, deadline: '2026-04-03', priority: 'urgente', status: 'doing', created_by: gabriel.id },
    { client: 'StartUp Delta', title: 'Constituicao de holding familiar', assignee_id: socio4.id, deadline: '2026-04-15', priority: 'normal', status: 'todo', created_by: gabriel.id },
    { client: 'Logistica Omega', title: 'Reestruturacao societaria', assignee_id: socio2.id, deadline: '2026-03-30', priority: 'alta', status: 'doing', created_by: gabriel.id },
    { client: 'Farmacia Vida', title: 'Registro na Junta Comercial', assignee_id: socio5.id, deadline: '2026-04-20', priority: 'normal', status: 'done', created_by: gabriel.id },
      ];

  const { error: taskError } = await supabase.from('tasks').insert(sampleTasks);

  if (taskError) {
        console.error('Erro ao criar tarefas:', taskError.message);
        return;
  }

  console.log('Usuarios e tarefas de exemplo criados!');
    console.log('Login admin: gabriel / its2026');
    console.log('IMPORTANTE: Troque as senhas apos o primeiro acesso!');
}

module.exports = { supabase, seedDatabase };
