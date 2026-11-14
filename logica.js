const SUPABASE_URL = 'https://lpzlcfxtqhqtbsunjuxm.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_zsQYiJHxYJp1xz7wIRWwiw_-hiNDOmf'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let denuncias = [];
let blocoSelecionado = null;

const esc = (str) => String(str || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function carregarDenuncias() {
    const { data, error } = await supabaseClient.from('denuncias').select('*').order('data', { ascending: false });
    if (error) { alert('Erro de ligação à base de dados.'); return; }
    denuncias = data || [];
    renderDashboard();
    if (!document.getElementById('view-lista').classList.contains('hidden')) renderLista();
}

function mostrarView(nome) {
    document.querySelectorAll('main > div').forEach(d => d.classList.add('hidden'));
    document.getElementById(`view-${nome}`).classList.remove('hidden');
    document.getElementById('pageTitle').innerText = nome === 'dashboard' ? 'Dashboard' : nome === 'nova' ? 'Nova denúncia' : 'Lista de denúncias';
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector(`.sidebar nav a[data-view="${nome}"]`).classList.add('active');
    if (nome === 'dashboard') renderDashboard();
    if (nome === 'lista') renderLista();
}

document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); mostrarView(link.dataset.view); });
});

function renderDashboard() {
    const total = denuncias.length;
    const abertos = denuncias.filter(d => d.estado === 'Aberto').length;
    const emCurso = denuncias.filter(d => d.estado === 'Em curso').length;
    const resolvidos = denuncias.filter(d => d.estado === 'Resolvido').length;
    const criticas = denuncias.filter(d => d.critico && d.estado !== 'Resolvido').length;

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><span class="stat-label">Total denúncias</span><div class="stat-value">${total}</div><i class="fas fa-clipboard-list"></i></div>
        <div class="stat-card"><span class="stat-label">Em aberto</span><div class="stat-value">${abertos}</div><i class="fas fa-folder-open"></i></div>
        <div class="stat-card"><span class="stat-label">Em curso</span><div class="stat-value">${emCurso}</div><i class="fas fa-spinner"></i></div>
        <div class="stat-card"><span class="stat-label">Resolvidos</span><div class="stat-value">${resolvidos}</div><i class="fas fa-check-circle"></i></div>
        <div class="stat-card" style="border-left-color:var(--critico);"><span class="stat-label" style="color:var(--critico);">🚨 Críticas em aberto</span><div class="stat-value" style="color:var(--critico);">${criticas}</div><i class="fas fa-exclamation-triangle" style="color:var(--critico);"></i></div>
    `;

    const cats = {};
    denuncias.forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + 1; });
    const maxVal = Math.max(...Object.values(cats), 1);
    document.getElementById('chartBars').innerHTML = Object.entries(cats).map(([cat, count]) => `
        <div class="chart-bar-item"><div class="chart-bar" style="height:${Math.max(12, (count / maxVal) * 100)}px;"></div><span>${cat}</span><span style="font-size:0.7rem;color:#1e4a7a;">${count}</span></div>
    `).join('') || '<p class="sem-dados">Sem dados</p>';

    const actividades = [];
    denuncias.forEach(d => (d.historico || []).forEach(h => actividades.push({ ...h, titulo: d.titulo })));
    actividades.sort((a, b) => new Date(b.data) - new Date(a.data));
    document.getElementById('recentActivities').innerHTML = actividades.slice(0, 5).map(a => `
        <li><div class="activity-icon"><i class="fas fa-circle"></i></div><div><strong>${esc(a.acao)}</strong><br><small>${esc(a.titulo)} · ${new Date(a.data).toLocaleDateString('pt-PT')}</small></div></li>
    `).join('') || '<li>Sem actividades recentes</li>';

    const recentes = [...denuncias].sort((a,b) => a.critico === b.critico ? new Date(b.data) - new Date(a.data) : (b.critico ? 1 : -1)).slice(0, 6);
    document.getElementById('ocorrenciasRecentes').innerHTML = recentes.map(d => `
        <div class="ocorrencia-card ${d.critico ? 'critico' : ''}" onclick="abrirDetalhes(${d.id})">
            <div class="ocorrencia-info"><h4>${esc(d.titulo)}</h4><small>Bloco ${esc(d.blocoSelecionado)} · ${esc(d.localizacaoExata)} · ${d.estado}</small></div>
            ${d.critico ? '<span class="badge-critico"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : ''}
        </div>
    `).join('');

    // Top Blocos
    const blocos = {};
    denuncias.forEach(d => { const b = d.blocoSelecionado || '?'; if (!blocos[b]) blocos[b] = { total: 0, crit: 0 }; blocos[b].total++; if (d.critico && d.estado !== 'Resolvido') blocos[b].crit++; });
    const listaBlocos = Object.entries(blocos).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    const maxB = Math.max(...listaBlocos.map(([, v]) => v.total), 1);
    document.getElementById('topBlocos').innerHTML = listaBlocos.length ? listaBlocos.map(([b, v], i) => `
        <div class="top-bloco-item">
            <div class="top-bloco-pos">${i + 1}</div>
            <div class="top-bloco-info"><strong>Bloco ${esc(b)}</strong><small>${v.total} denúncias ${v.crit ? `· <span class="top-bloco-critico">${v.crit} crítica(s)</span>` : ''}</small><div class="top-bloco-bar"><div style="width:${(v.total/maxB)*100}%"></div></div></div>
        </div>`).join('') : '<p class="sem-dados">Sem denúncias.</p>';

    // Paradas
    const agora = new Date();
    const paradas = denuncias.filter(d => d.estado !== 'Resolvido').map(d => ({ ...d, dias: Math.max(0, Math.floor((agora - new Date(d.data)) / (1000 * 60 * 60 * 24))) })).sort((a, b) => b.dias - a.dias).slice(0, 5);
    document.getElementById('paradasTempo').innerHTML = paradas.length ? paradas.map(d => `
        <div class="parada-item" onclick="abrirDetalhes(${d.id})">
            <div class="parada-dias ${d.dias >= 7 ? 'alerta' : ''}">${d.dias}<span>dias</span></div>
            <div class="parada-info"><strong>${esc(d.titulo)}</strong><small>Bloco ${esc(d.blocoSelecionado)} · ${d.estado}</small></div>
        </div>`).join('') : '<p class="sem-dados">Tudo em dia! ✅</p>';

    // Termómetro
    const elTerm = document.getElementById('termometro');
    if (!total) { elTerm.innerHTML = '<p class="sem-dados">Sem dados.</p>'; } else {
        const pct = n => ((n / total) * 100).toFixed(1);
        const seg = (n, cls, lab) => n > 0 ? `<div class="termometro-seg ${cls}" style="width:${pct(n)}%">${n} ${lab}</div>` : '';
        elTerm.innerHTML = `
            <div class="termometro-barra">${seg(abertos, 'aberto', 'aberto' + (abertos !== 1 ? 's' : ''))}${seg(emCurso, 'emcurso', 'em curso')}${seg(resolvidos, 'resolvido', 'resolvido' + (resolvidos !== 1 ? 's' : ''))}</div>
            <div class="termometro-legenda"><span><i style="background:#e0a800;"></i> Aberto (${abertos})</span><span><i style="background:var(--azul-secundario);"></i> Em curso (${emCurso})</span><span><i style="background:#1e7e34;"></i> Resolvido (${resolvidos})</span><span style="margin-left:auto;font-weight:700;color:var(--azul-escuro);">Total: ${total}</span></div>
        `;
    }
}

function renderLista() {
    document.getElementById('listaCompleta').innerHTML = denuncias.map(d => `
        <div class="ocorrencia-card ${d.critico ? 'critico' : ''}" onclick="abrirDetalhes(${d.id})" style="margin-bottom:0.6rem;">
            <div class="ocorrencia-info">
                <h4>${esc(d.titulo)} ${d.critico ? '<span class="badge-critico"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : ''}</h4>
                <small><strong>Bloco ${esc(d.blocoSelecionado)}</strong> · ${esc(d.localizacaoExata)} · ${esc(d.categoria)} · ${new Date(d.data).toLocaleDateString('pt-PT')}</small>
            </div>
            <div style="display:flex;gap:0.5rem;">
                <span class="badge badge-${d.prioridade.toLowerCase() === 'média' ? 'media' : d.prioridade.toLowerCase()}">${esc(d.prioridade)}</span>
                <span class="badge badge-${d.estado.toLowerCase() === 'em curso' ? 'em-curso' : d.estado.toLowerCase()}">${esc(d.estado)}</span>
            </div>
        </div>
    `).join('') || '<p class="sem-dados">Nenhuma denúncia.</p>';
}

// Formulário e Modal
document.querySelectorAll('.bloco-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        blocoSelecionado = btn.dataset.bloco;
        document.getElementById('blocoSelecionado').value = blocoSelecionado;
    });
});

document.querySelectorAll('input[name="critico"]').forEach(r => {
    r.addEventListener('change', () => document.getElementById('criticoAviso').classList.toggle('visible', document.querySelector('input[name="critico"]:checked').value === 'sim'));
});

document.getElementById('formDenuncia').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!blocoSelecionado) { alert('Seleccione um bloco.'); return; }
    
    const nova = {
        titulo: document.getElementById('titulo').value,
        descricao: document.getElementById('descricao').value,
        categoria: document.getElementById('categoria').value,
        prioridade: document.getElementById('prioridade').value,
        estado: 'Aberto',
        campus: document.getElementById('campus').value,
        blocoSelecionado,
        localizacaoExata: document.getElementById('localizacaoExata').value,
        critico: document.querySelector('input[name="critico"]:checked').value === 'sim',
        data: new Date().toISOString(),
        historico: [{ data: new Date().toISOString(), acao: 'Denúncia criada', utilizador: 'Aluno' }],
        responsavel: ''
    };

    const { error } = await supabaseClient.from('denuncias').insert([nova]);
    if (error) { alert('Erro ao guardar: ' + error.message); return; }
    
    alert('✅ Denúncia registada na nuvem!');
    e.target.reset();
    blocoSelecionado = null;
    document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('criticoAviso').classList.remove('visible');
    carregarDenuncias();
    mostrarView('dashboard');
});

document.getElementById('resetForm').addEventListener('click', () => {
    blocoSelecionado = null;
    document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('criticoAviso').classList.remove('visible');
});

async function abrirDetalhes(id) {
    const d = denuncias.find(x => x.id === id);
    if (!d) return;
    const modal = document.getElementById('modalDetalhes');
    
    document.getElementById('modalContent').innerHTML = `
        <button class="modal-close" onclick="document.getElementById('modalDetalhes').classList.remove('active')">&times;</button>
        <h2 style="color:var(--azul-escuro);margin-bottom:0.5rem;">${esc(d.titulo)}</h2>
        <div style="display:flex;gap:0.8rem;margin-bottom:1rem;">
            <span class="badge badge-${d.prioridade.toLowerCase() === 'média' ? 'media' : d.prioridade.toLowerCase()}">${esc(d.prioridade)}</span>
            <span class="badge badge-${d.estado.toLowerCase() === 'em curso' ? 'em-curso' : d.estado.toLowerCase()}">${esc(d.estado)}</span>
        </div>
        <p style="margin-bottom:1rem;">${esc(d.descricao)}</p>
        <div class="local-destaque ${d.critico ? 'critico' : ''}"><i class="fas fa-map-pin"></i> <strong>Bloco ${esc(d.blocoSelecionado)}</strong> — ${esc(d.localizacaoExata)}</div>
        <p style="font-size:0.9rem;color:#475569;margin-top:0.5rem;"><i class="fas fa-calendar-alt"></i> ${new Date(d.data).toLocaleString('pt-PT')}</p>
        
        <hr style="margin:1.2rem 0;border-color:var(--cinza-medio);">
        <h3 style="font-size:1rem;margin-bottom:0.5rem;">Histórico</h3>
        <ul style="list-style:none;font-size:0.85rem;line-height:1.8;">
            ${(d.historico || []).map(h => `<li>· ${esc(h.acao)} <small>(${new Date(h.data).toLocaleDateString('pt-PT')})</small></li>`).join('')}
        </ul>
        
        <hr style="margin:1.2rem 0;border-color:var(--cinza-medio);">
        <h3 style="font-size:1rem;margin-bottom:0.5rem;">Painel Administrativo</h3>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <select id="modalEstado" style="padding:0.5rem 1rem;border-radius:30px;border:1.5px solid var(--cinza-medio);">
                <option value="Aberto" ${d.estado === 'Aberto' ? 'selected' : ''}>Aberto</option>
                <option value="Em curso" ${d.estado === 'Em curso' ? 'selected' : ''}>Em curso</option>
                <option value="Resolvido" ${d.estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
            </select>
            <button class="btn btn-small" onclick="atualizarEstado(${d.id})"><i class="fas fa-sync"></i> Actualizar</button>
        </div>
    `;
    modal.classList.add('active');
}

async function atualizarEstado(id) {
    const novoEstado = document.getElementById('modalEstado').value;
    const d = denuncias.find(x => x.id === id);
    if (novoEstado === d.estado) { alert('Nenhuma alteração.'); return; }
    
    d.historico.push({ data: new Date().toISOString(), acao: `Estado alterado para ${novoEstado}`, utilizador: 'Admin' });
    
    const { error } = await supabaseClient.from('denuncias').update({ estado: novoEstado, historico: d.historico }).eq('id', id);
    if (error) { alert('Erro ao atualizar: ' + error.message); return; }
    
    document.getElementById('modalDetalhes').classList.remove('active');
    carregarDenuncias();
}

carregarDenuncias();