// ==========================================================================================
// financeiro-routes.js - Modulo Financeiro (ITS Tarefas)
// Use em server.js assim, antes do "// ===== START =====":
//   require('./financeiro-routes')({ app, supabase, requireAuth, logTaskHistory, path });
// ==========================================================================================
const crypto = require('crypto');

module.exports = function({ app, supabase, requireAuth, logTaskHistory, path }) {

  async function requireFinanceiro(req, res, next) {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Nao autenticado' });
    try {
      const { data: users } = await supabase.from('users').select('is_financeiro, role').eq('id', req.session.userId).limit(1);
      const u = users && users[0];
      if (u && (u.is_financeiro === true || u.role === 'admin')) return next();
      return res.status(403).json({ error: 'Acesso restrito ao time financeiro' });
    } catch (err) { return res.status(500).json({ error: 'Erro ao validar permissao' }); }
  }

  async function nextNumero(table, prefix) {
    const year = new Date().getFullYear();
    const { data: rows } = await supabase.from(table).select('numero').like('numero', prefix + '-' + year + '-%').order('id', { ascending: false }).limit(1);
    let next = 1;
    if (rows && rows[0]) { const m = rows[0].numero.match(/-(\d+)$/); if (m) next = Number(m[1]) + 1; }
    return prefix + '-' + year + '-' + String(next).padStart(4, '0');
  }

  function renderTemplate(corpo, dados) {
    let out = corpo;
    out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => dados[key] ? inner : '');
    out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => dados[key] || '');
    return out;
  }

  function dataExtenso(d) {
    const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dt = d instanceof Date ? d : new Date(d);
    return dt.getUTCDate() + ' de ' + meses[dt.getUTCMonth()] + ' de ' + dt.getUTCFullYear();
  }

  // ===== SERVICOS CATALOGO =====
  app.get('/api/servicos-catalogo', requireAuth, async (req, res) => {
    const { data } = await supabase.from('servicos_catalogo').select('*').order('nome');
    res.json(data || []);
  });
  app.post('/api/servicos-catalogo', requireAuth, requireFinanceiro, async (req, res) => {
    const { nome, descricao, valor_padrao, tipo, categoria, ativo } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome obrigatorio' });
    const { data, error } = await supabase.from('servicos_catalogo').insert({ nome, descricao, valor_padrao: valor_padrao || 0, tipo: tipo || 'pontual', categoria: categoria || 'outro', ativo: ativo !== false, created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });
  app.put('/api/servicos-catalogo/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const upd = {};
    ['nome','descricao','valor_padrao','tipo','categoria','ativo'].forEach(f => { if (req.body[f] !== undefined) upd[f] = req.body[f]; });
    const { error } = await supabase.from('servicos_catalogo').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app.delete('/api/servicos-catalogo/:id', requireAuth, requireFinanceiro, async (req, res) => {
    await supabase.from('servicos_catalogo').delete().eq('id', Number(req.params.id));
    res.json({ ok: true });
  });

  // ===== PROPOSTAS =====
  app.get('/api/propostas', requireAuth, requireFinanceiro, async (req, res) => {
    const { data } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
    res.json(data || []);
  });
  app.get('/api/propostas/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { data: rows } = await supabase.from('propostas').select('*').eq('id', id).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    const { data: itens } = await supabase.from('proposta_itens').select('*').eq('proposta_id', id).order('sort_order');
    res.json({ ...p, itens: itens || [] });
  });
  app.post('/api/propostas', requireAuth, requireFinanceiro, async (req, res) => {
    const { client_id, cliente_nome, cliente_empresa, cliente_documento, cliente_email, cliente_contato, cliente_endereco, cliente_representante, cliente_cpf_representante, titulo, objeto, observacoes, vigencia, forma_pagamento, validade_dias, itens } = req.body;
    if (!cliente_nome || !titulo) return res.status(400).json({ error: 'cliente_nome e titulo obrigatorios' });
    const numero = await nextNumero('propostas', 'PROP');
    const valor_total = (itens || []).reduce((acc, it) => acc + Number(it.valor_total || 0), 0);
    const { data: created, error } = await supabase.from('propostas').insert({ numero, client_id: client_id || null, cliente_nome, cliente_empresa, cliente_documento, cliente_email, cliente_contato, cliente_endereco, cliente_representante, cliente_cpf_representante, titulo, objeto, observacoes, vigencia, forma_pagamento, valor_total, validade_dias: validade_dias || 15, status: 'rascunho', created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    const propostaId = created[0].id;
    if (Array.isArray(itens) && itens.length > 0) {
      const toInsert = itens.map((it, idx) => ({ proposta_id: propostaId, servico_id: it.servico_id || null, descricao: it.descricao, quantidade: it.quantidade || 1, valor_unitario: it.valor_unitario || 0, valor_total: it.valor_total || 0, tipo: it.tipo || null, sort_order: idx }));
      await supabase.from('proposta_itens').insert(toInsert);
    }
    res.json(created[0]);
  });
  app.put('/api/propostas/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { itens, ...fields } = req.body;
    const upd = { updated_at: new Date().toISOString() };
    ['client_id','cliente_nome','cliente_empresa','cliente_documento','cliente_email','cliente_contato','cliente_endereco','cliente_representante','cliente_cpf_representante','titulo','objeto','observacoes','vigencia','forma_pagamento','validade_dias','status'].forEach(f => { if (fields[f] !== undefined) upd[f] = fields[f]; });
    if (Array.isArray(itens)) upd.valor_total = itens.reduce((acc, it) => acc + Number(it.valor_total || 0), 0);
    const { error } = await supabase.from('propostas').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    if (Array.isArray(itens)) {
      await supabase.from('proposta_itens').delete().eq('proposta_id', id);
      if (itens.length > 0) {
        const toInsert = itens.map((it, idx) => ({ proposta_id: id, servico_id: it.servico_id || null, descricao: it.descricao, quantidade: it.quantidade || 1, valor_unitario: it.valor_unitario || 0, valor_total: it.valor_total || 0, tipo: it.tipo || null, sort_order: idx }));
        await supabase.from('proposta_itens').insert(toInsert);
      }
    }
    res.json({ ok: true });
  });
  app.delete('/api/propostas/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    // cascade: apagar contratos vinculados antes (FK)
    await supabase.from('contratos').delete().eq('proposta_id', id);
    await supabase.from('propostas').delete().eq('id', id);
    res.json({ ok: true });
  });
  app.post('/api/propostas/:id/enviar', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { data: rows } = await supabase.from('propostas').select('aceite_token,status').eq('id', id).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    const token = p.aceite_token || (crypto.randomBytes(5).toString('base64').replace(/[+/=]/g,'').slice(0,7));
    await supabase.from('propostas').update({ status: 'enviada', aceite_token: token, updated_at: new Date().toISOString() }).eq('id', id);
    const link = req.protocol + '://' + req.get('host') + '/p/' + token;
    res.json({ ok: true, token, link });
  });

  // Reverter aceite (caso cliente desista)
  app.post('/api/propostas/:id/reverter-aceite', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { data: rows } = await supabase.from('propostas').select('status').eq('id', id).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    if (p.status !== 'aceita') return res.status(400).json({ error: 'Proposta nao esta aceita' });
    await supabase.from('propostas').update({ status: 'enviada', aceita_em: null, aceita_ip: null, aceita_user_agent: null, updated_at: new Date().toISOString() }).eq('id', id);
    res.json({ ok: true });
  });

  // Reverter contratacao (apaga contrato gerado e volta para aceita)
  app.post('/api/propostas/:id/reverter-contratacao', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { data: rows } = await supabase.from('propostas').select('status').eq('id', id).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    if (p.status !== 'contratada') return res.status(400).json({ error: 'Proposta nao esta contratada' });
    await supabase.from('contratos').delete().eq('proposta_id', id);
    await supabase.from('propostas').update({ status: 'aceita', updated_at: new Date().toISOString() }).eq('id', id);
    res.json({ ok: true });
  });

  // ===== PUBLICO (aceite do cliente) =====
  app.get('/p/:token', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'proposta-publica.html')); });
  app.get('/api/p/:token', async (req, res) => {
    const { data: rows } = await supabase.from('propostas').select('*').eq('aceite_token', req.params.token).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    const criadaEm = new Date(p.created_at);
    const validade = new Date(criadaEm.getTime() + (p.validade_dias || 15) * 86400000);
    const expirada = Date.now() > validade.getTime();
    const { data: itens } = await supabase.from('proposta_itens').select('*').eq('proposta_id', p.id).order('sort_order');
    res.json({ numero: p.numero, titulo: p.titulo, objeto: p.objeto, observacoes: p.observacoes, cliente_nome: p.cliente_nome, cliente_empresa: p.cliente_empresa, cliente_documento: p.cliente_documento, valor_total: p.valor_total, forma_pagamento: p.forma_pagamento, validade_ate: validade.toISOString().slice(0,10), status: expirada && p.status === 'enviada' ? 'expirada' : p.status, itens: itens || [], aceita_em: p.aceita_em, recusada_em: p.recusada_em });
  });
  app.post('/api/p/:token/aceitar', async (req, res) => {
    const { data: rows } = await supabase.from('propostas').select('*').eq('aceite_token', req.params.token).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    if (p.status !== 'enviada') return res.status(400).json({ error: 'Proposta nao esta disponivel para aceite' });
    const criadaEm = new Date(p.created_at);
    const validade = new Date(criadaEm.getTime() + (p.validade_dias || 15) * 86400000);
    if (Date.now() > validade.getTime()) { await supabase.from('propostas').update({ status: 'expirada' }).eq('id', p.id); return res.status(400).json({ error: 'Proposta expirada' }); }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    await supabase.from('propostas').update({ status: 'aceita', aceita_em: new Date().toISOString(), aceita_ip: ip, aceita_user_agent: ua, updated_at: new Date().toISOString() }).eq('id', p.id);
    res.json({ ok: true });
  });
  app.post('/api/p/:token/recusar', async (req, res) => {
    const { motivo } = req.body || {};
    const { data: rows } = await supabase.from('propostas').select('id,status').eq('aceite_token', req.params.token).limit(1);
    const p = rows && rows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    if (p.status !== 'enviada') return res.status(400).json({ error: 'Proposta nao esta disponivel' });
    await supabase.from('propostas').update({ status: 'recusada', recusada_em: new Date().toISOString(), motivo_recusa: motivo || null, updated_at: new Date().toISOString() }).eq('id', p.id);
    res.json({ ok: true });
  });

  // ===== TEMPLATES DE CONTRATO =====
  app.get('/api/contrato-templates', requireAuth, requireFinanceiro, async (req, res) => {
    const { data } = await supabase.from('contrato_templates').select('*').order('nome');
    res.json(data || []);
  });
  app.post('/api/contrato-templates', requireAuth, requireFinanceiro, async (req, res) => {
    const { nome, corpo_html, is_default } = req.body;
    if (!nome || !corpo_html) return res.status(400).json({ error: 'nome e corpo_html obrigatorios' });
    if (is_default) await supabase.from('contrato_templates').update({ is_default: false }).eq('is_default', true);
    const { data, error } = await supabase.from('contrato_templates').insert({ nome, corpo_html, is_default: !!is_default, created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });
  app.put('/api/contrato-templates/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const upd = {};
    ['nome','corpo_html','is_default'].forEach(f => { if (req.body[f] !== undefined) upd[f] = req.body[f]; });
    if (upd.is_default) await supabase.from('contrato_templates').update({ is_default: false }).eq('is_default', true);
    const { error } = await supabase.from('contrato_templates').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app.delete('/api/contrato-templates/:id', requireAuth, requireFinanceiro, async (req, res) => {
    await supabase.from('contrato_templates').delete().eq('id', Number(req.params.id));
    res.json({ ok: true });
  });

  // ===== CONTRATOS =====
  app.get('/api/contratos', requireAuth, requireFinanceiro, async (req, res) => {
    const { data } = await supabase.from('contratos').select('*').order('created_at', { ascending: false });
    res.json(data || []);
  });
  app.get('/api/contratos/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const { data: rows } = await supabase.from('contratos').select('*').eq('id', Number(req.params.id)).limit(1);
    if (!rows || !rows[0]) return res.status(404).json({ error: 'Contrato nao encontrado' });
    res.json(rows[0]);
  });
  app.post('/api/contratos/gerar', requireAuth, requireFinanceiro, async (req, res) => {
    const { proposta_id, template_id, clausula_honorarios, forma_pagamento_texto, prazo_rescisao, foro, cidade_assinatura, vigencia_inicio, vigencia_fim } = req.body;
    if (!proposta_id) return res.status(400).json({ error: 'proposta_id obrigatorio' });
    const { data: pRows } = await supabase.from('propostas').select('*').eq('id', proposta_id).limit(1);
    const p = pRows && pRows[0];
    if (!p) return res.status(404).json({ error: 'Proposta nao encontrada' });
    if (p.status !== 'aceita' && p.status !== 'contratada') return res.status(400).json({ error: 'Proposta precisa estar aceita' });
    let tplRow;
    if (template_id) { const { data } = await supabase.from('contrato_templates').select('*').eq('id', template_id).limit(1); tplRow = data && data[0]; }
    else { const { data } = await supabase.from('contrato_templates').select('*').eq('is_default', true).limit(1); tplRow = data && data[0]; }
    if (!tplRow) return res.status(400).json({ error: 'Template de contrato nao encontrado' });
    const doc = (p.cliente_documento || '').replace(/\D/g,'');
    const isCnpj = doc.length === 14;
    const dadosRender = {
      cliente_nome: p.cliente_empresa || p.cliente_nome,
      cliente_cnpj: isCnpj ? p.cliente_documento : '',
      cliente_cpf: !isCnpj ? p.cliente_documento : '',
      cliente_endereco: p.cliente_endereco || '',
      cliente_representante: p.cliente_representante || '',
      cliente_cpf_representante: p.cliente_cpf_representante || '',
      cliente_documento_label: (isCnpj ? 'CNPJ n ' : 'CPF n ') + (p.cliente_documento || ''),
      objeto: p.objeto || '',
      clausula_honorarios: clausula_honorarios || '<p>Pelos servicos prestados, a CONTRATANTE pagara a CONTRATADA o valor total de R$ ' + Number(p.valor_total).toFixed(2).replace('.',',') + '.</p>',
      forma_pagamento: forma_pagamento_texto || '<p>' + (p.forma_pagamento || 'Conforme acordado entre as partes.') + '</p>',
      prazo_rescisao: prazo_rescisao || '<p>O presente contrato vigorara por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso previo de 30 (trinta) dias.</p>',
      foro: foro || 'Pelotas/RS',
      cidade_assinatura: cidade_assinatura || 'Pelotas',
      data_assinatura_extenso: dataExtenso(new Date())
    };
    const conteudo_html = renderTemplate(tplRow.corpo_html, dadosRender);
    const numero = await nextNumero('contratos', 'CT');
    const { data: ctCreated, error } = await supabase.from('contratos').insert({ numero, proposta_id: p.id, template_id: tplRow.id, client_id: p.client_id, cliente_nome: p.cliente_empresa || p.cliente_nome, cliente_documento: p.cliente_documento, titulo: p.titulo, conteudo_html, valor: p.valor_total, vigencia_inicio: vigencia_inicio || null, vigencia_fim: vigencia_fim || null, foro: foro || 'Pelotas/RS', cidade_assinatura: cidade_assinatura || 'Pelotas', data_assinatura: new Date().toISOString().slice(0,10), status: 'ativo', created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('propostas').update({ status: 'contratada' }).eq('id', p.id);
    res.json(ctCreated[0]);
  });
  app.put('/api/contratos/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const upd = { updated_at: new Date().toISOString() };
    ['titulo','conteudo_html','valor','vigencia_inicio','vigencia_fim','status','foro','cidade_assinatura'].forEach(f => { if (req.body[f] !== undefined) upd[f] = req.body[f]; });
    const { error } = await supabase.from('contratos').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });
  app.post('/api/contratos/:id/to-task', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const { assignee_id, deadline, priority, title, checklist_template_id } = req.body;
    const { data: cRows } = await supabase.from('contratos').select('*').eq('id', id).limit(1);
    const c = cRows && cRows[0];
    if (!c) return res.status(404).json({ error: 'Contrato nao encontrado' });
    if (c.task_id) return res.status(400).json({ error: 'Este contrato ja foi enviado para tarefa', task_id: c.task_id });
    const finalDeadline = deadline || (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0,10); })();
    const taskTitle = title || ('Inicio de trabalho - ' + c.titulo);
    const { data: newTasks, error } = await supabase.from('tasks').insert({ client: c.cliente_nome, title: taskTitle, assignee_id: assignee_id || req.session.userId, deadline: finalDeadline, priority: priority || 'normal', status: 'todo', value: c.valor, contract_link: '/contrato/' + c.id, created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    const task = newTasks[0];
    await supabase.from('contratos').update({ task_id: task.id, updated_at: new Date().toISOString() }).eq('id', id);
    await logTaskHistory(task.id, req.session.userId, req.session.userName, 'created', null, null, null, 'Criada a partir do contrato ' + c.numero);
    if (checklist_template_id) {
      const { data: tItems } = await supabase.from('checklist_template_items').select('title, sort_order').eq('template_id', checklist_template_id);
      if (tItems && tItems.length > 0) await supabase.from('task_checklist_items').insert(tItems.map(i => ({ task_id: task.id, title: i.title, done: false, sort_order: i.sort_order })));
    }
    res.json({ ok: true, task });
  });

  // ===== PAGINAS =====
  app.get('/financeiro', requireAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'financeiro.html')); });
  app.get('/contrato/:id', requireAuth, requireFinanceiro, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'contrato-view.html')); });

  // ============================================
  // ===== META ANUAL DE HONORARIOS ==============
  // ============================================
  app.get('/api/metas-honorarios/:ano', requireAuth, requireFinanceiro, async (req, res) => {
    const ano = Number(req.params.ano);
    const { data } = await supabase.from('metas_honorarios').select('*').eq('ano', ano).limit(1);
    res.json(data && data[0] ? data[0] : { ano, valor_meta: 0 });
  });

  app.put('/api/metas-honorarios/:ano', requireAuth, requireFinanceiro, async (req, res) => {
    const ano = Number(req.params.ano);
    const { valor_meta } = req.body;
    const { data: ex } = await supabase.from('metas_honorarios').select('id').eq('ano', ano).limit(1);
    if (ex && ex[0]) {
      const { error } = await supabase.from('metas_honorarios').update({ valor_meta: Number(valor_meta) || 0, updated_at: new Date().toISOString() }).eq('ano', ano);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase.from('metas_honorarios').insert({ ano, valor_meta: Number(valor_meta) || 0, created_by: req.session.userId });
      if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ ok: true });
  });

  app.get('/api/honorarios/:ano', requireAuth, requireFinanceiro, async (req, res) => {
    const ano = Number(req.params.ano);
    const start = ano + '-01-01';
    const end = (ano + 1) + '-01-01';
    const { data } = await supabase.from('honorarios_lancamentos').select('*').gte('data', start).lt('data', end).order('data', { ascending: false });
    res.json(data || []);
  });

  app.get('/api/honorarios/:ano/resumo', requireAuth, requireFinanceiro, async (req, res) => {
    const ano = Number(req.params.ano);
    const start = ano + '-01-01';
    const end = (ano + 1) + '-01-01';
    const { data } = await supabase.from('honorarios_lancamentos').select('data, valor').gte('data', start).lt('data', end);
    const porMes = Array(12).fill(0);
    let total = 0;
    (data || []).forEach(row => { const m = new Date(row.data).getUTCMonth(); porMes[m] += Number(row.valor) || 0; total += Number(row.valor) || 0; });
    const { data: mRows } = await supabase.from('metas_honorarios').select('valor_meta').eq('ano', ano).limit(1);
    const meta = mRows && mRows[0] ? Number(mRows[0].valor_meta) : 0;
    res.json({ ano, meta, total, porMes, falta: Math.max(0, meta - total), pct: meta > 0 ? Math.min(100, (total / meta) * 100) : 0 });
  });

  app.post('/api/honorarios', requireAuth, requireFinanceiro, async (req, res) => {
    const { data: dataLanc, valor, descricao, cliente, contrato_id } = req.body;
    if (!valor) return res.status(400).json({ error: 'valor obrigatorio' });
    const { data, error } = await supabase.from('honorarios_lancamentos').insert({ data: dataLanc || new Date().toISOString().slice(0,10), valor: Number(valor), descricao, cliente, contrato_id: contrato_id || null, created_by: req.session.userId }).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });

  app.put('/api/honorarios/:id', requireAuth, requireFinanceiro, async (req, res) => {
    const id = Number(req.params.id);
    const upd = {};
    ['data','valor','descricao','cliente'].forEach(f => { if (req.body[f] !== undefined) upd[f] = req.body[f]; });
    if (upd.valor !== undefined) upd.valor = Number(upd.valor);
    const { error } = await supabase.from('honorarios_lancamentos').update(upd).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  app.delete('/api/honorarios/:id', requireAuth, requireFinanceiro, async (req, res) => {
    await supabase.from('honorarios_lancamentos').delete().eq('id', Number(req.params.id));
    res.json({ ok: true });
  });
};
