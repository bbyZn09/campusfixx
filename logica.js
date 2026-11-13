(function () {
    'use strict';

       // 1. Ligações ao Supabase
    const SUPABASE_URL = 'https://hwmxqvgwinzzwtcuqnuz.supabase.co'; 
    const SUPABASE_KEY = 'sb_publishable_edK8O_DnYOCXoVnYKxY34Q_tZNtwzww';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Função de segurança para limpar textos (evita que o HTML quebre)
    const esc = (str) => String(str || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
    // Variáveis do sistema
    let denuncias = [];
    let blocoSelecionado = null;
    let fotosBase64 = [];

    // 1. Carregar dados da Nuvem
    async function carregarDenuncias() {
        const { data, error } = await supabaseClient
            .from('denuncias')
            .select('*')
            .order('data', { ascending: false });
        
        if (error) { 
            console.error('Erro ao carregar:', error); 
            alert('Erro de ligação à base de dados.');
            return; 
        }
        denuncias = data || [];
        renderDashboard();
    }

    function salvarDenuncias() {}

    const views = {
        dashboard: document.getElementById('view-dashboard'),
        nova: document.getElementById('view-nova'),
        lista: document.getElementById('view-lista'),
        config: document.getElementById('view-config')
    };

    function mostrarView(nome) {
        Object.keys(views).forEach(k => { if (views[k]) views[k].classList.add('hidden'); });
        if (views[nome]) views[nome].classList.remove('hidden');
        
        document.getElementById('pageTitle').innerText =
            nome === 'dashboard' ? 'Dashboard' : 
            nome === 'nova' ? 'Nova denúncia' : 
            nome === 'lista' ? 'Lista de denúncias' : 'Configurações';
            
        document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
        const linkAtivo = document.querySelector(`.sidebar nav a[data-view="${nome}"]`);
        if (linkAtivo) linkAtivo.classList.add('active');
        
        if (nome === 'dashboard') renderDashboard();
        if (nome === 'lista') renderListaCompleta();
    }

    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if (link.dataset.view) mostrarView(link.dataset.view); 
        });
    });

    // ── RENDERIZAR O DASHBOARD ────────────────────────────────────────
    function renderDashboard() {
        const total = denuncias.length;
        const abertos = denuncias.filter(d => d.estado === 'Aberto').length;
        const emCurso = denuncias.filter(d => d.estado === 'Em curso').length;
        const resolvidos = denuncias.filter(d => d.estado === 'Resolvido').length;
        const criticasAbertas = denuncias.filter(d => d.critico && d.estado !== 'Resolvido').length;

        // Cards do Topo
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card"><span class="stat-label">Total denúncias</span><div class="stat-value">${total}</div><i class="fas fa-clipboard-list"></i></div>
            <div class="stat-card"><span class="stat-label">Em aberto</span><div class="stat-value">${abertos}</div><i class="fas fa-folder-open"></i></div>
            <div class="stat-card"><span class="stat-label">Em curso</span><div class="stat-value">${emCurso}</div><i class="fas fa-spinner"></i></div>
            <div class="stat-card"><span class="stat-label">Resolvidos</span><div class="stat-value">${resolvidos}</div><i class="fas fa-check-circle"></i></div>
            <div class="stat-card" style="border-left-color:var(--critico);">
                <span class="stat-label" style="color:var(--critico);">🚨 Críticas em aberto</span>
                <div class="stat-value" style="color:var(--critico);">${criticasAbertas}</div>
                <i class="fas fa-exclamation-triangle" style="color:var(--critico);"></i>
            </div>
        `;

        // Gráfico de Barras (Categorias)
        const cats = {};
        denuncias.forEach(d => { cats[d.categoria] = (cats[d.categoria] || 0) + 1; });
        const maxVal = Math.max(...Object.values(cats), 1);
        let barsHtml = '';
        Object.entries(cats).forEach(([cat, count]) => {
            const altura = Math.max(12, (count / maxVal) * 100);
            barsHtml += `<div class="chart-bar-item"><div class="chart-bar" style="height:${altura}px;"></div><span>${cat}</span><span style="font-size:0.7rem;color:#1e4a7a;">${count}</span></div>`;
        });
        document.getElementById('chartBars').innerHTML = barsHtml || '<p class="sem-dados">Sem dados</p>';

        // Atividades Recentes
        const actividades = [];
        denuncias.forEach(d => {
            (d.historico || []).forEach(h => { actividades.push({ ...h, titulo: d.titulo, id: d.id }); });
        });
        actividades.sort((a, b) => new Date(b.data) - new Date(a.data));
        const recentes = actividades.slice(0, 5);
        
        document.getElementById('recentActivities').innerHTML = recentes.map(a => `
            <li><div class="activity-icon"><i class="fas fa-circle"></i></div><div><strong>${esc(a.acao)}</strong><br><small>${esc(a.titulo)} · ${new Date(a.data).toLocaleDateString('pt-PT')}</small></div></li>
        `).join('') || '<li>Sem actividades recentes</li>';

        // Denúncias Recentes
        const recentesDen = [...denuncias].sort((a,b) => {
            if (a.critico !== b.critico) return b.critico ? 1 : -1;
            return new Date(b.data) - new Date(a.data);
        }).slice(0, 6);

        document.getElementById('ocorrenciasRecentes').innerHTML = recentesDen.map(d => `
            <div class="ocorrencia-card ${d.critico ? 'critico' : ''}" data-id="${d.id}">
                <div class="ocorrencia-info">
                    <h4>${esc(d.titulo)}</h4>
                    <small>Bloco ${esc(d.blocoSelecionado)} · ${esc(d.localizacaoExata)} · ${d.estado}</small>
                </div>
                ${d.critico ? '<span class="badge-critico"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : ''}
            </div>
        `).join('');

        document.querySelectorAll('#ocorrenciasRecentes .ocorrencia-card').forEach(card => {
            card.addEventListener('click', () => abrirDetalhes(card.dataset.id));
        });

        // Chamar os 3 novos painéis
        renderTopBlocos();
        renderParadasTempo();
        renderTermometro();
    }

    // ── TOP BLOCOS ────────────────────────────────────────────────────
    function renderTopBlocos() {
        const porBloco = {};
        denuncias.forEach(d => {
            const b = d.blocoSelecionado || '?';
            if (!porBloco[b]) porBloco[b] = { total: 0, criticas: 0 };
            porBloco[b].total++;
            if (d.critico && d.estado !== 'Resolvido') porBloco[b].criticas++;
        });

        const lista = Object.entries(porBloco).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
        const maxTotal = Math.max(...lista.map(([, v]) => v.total), 1);
        const el = document.getElementById('topBlocos');

        if (!lista.length) {
            el.innerHTML = '<p class="sem-dados">Sem denúncias registadas.</p>';
            return;
        }

        el.innerHTML = lista.map(([bloco, v], i) => `
            <div class="top-bloco-item">
                <div class="top-bloco-pos">${i + 1}</div>
                <div class="top-bloco-info">
                    <strong>Bloco ${esc(bloco)}</strong>
                    <small>${v.total} denúncia${v.total !== 1 ? 's' : ''} ${v.criticas ? `· <span class="top-bloco-critico">${v.criticas} crítica${v.criticas !== 1 ? 's' : ''}</span>` : ''}</small>
                    <div class="top-bloco-bar"><div style="width:${(v.total / maxTotal) * 100}%"></div></div>
                </div>
            </div>
        `).join('');
    }

    // ── PARADAS HÁ MAIS TEMPO ─────────────────────────────────────────
    function renderParadasTempo() {
        const agora = new Date();
        const paradas = denuncias.filter(d => d.estado !== 'Resolvido')
            .map(d => ({ ...d, dias: Math.max(0, Math.floor((agora - new Date(d.data)) / (1000 * 60 * 60 * 24))) }))
            .sort((a, b) => b.dias - a.dias).slice(0, 5);
            
        const el = document.getElementById('paradasTempo');
        if (!paradas.length) {
            el.innerHTML = '<p class="sem-dados">Tudo em dia! ✅</p>';
            return;
        }

        el.innerHTML = paradas.map(d => `
            <div class="parada-item" data-id="${d.id}">
                <div class="parada-dias ${d.dias >= 7 ? 'alerta' : ''}">
                    ${d.dias}<span>dias</span>
                </div>
                <div class="parada-info">
                    <strong>${esc(d.titulo)}</strong>
                    <small>Bloco ${esc(d.blocoSelecionado)} · ${d.estado}${d.critico ? ' · <span class="top-bloco-critico">CRÍTICO</span>' : ''}</small>
                </div>
            </div>
        `).join('');

        el.querySelectorAll('.parada-item').forEach(item => {
            item.addEventListener('click', () => abrirDetalhes(item.dataset.id));
        });
    }

    // ── TERMÓMETRO DE PRIORIDADE ──────────────────────────────────────
    function renderTermometro() {
        const total = denuncias.length;
        const aberto = denuncias.filter(d => d.estado === 'Aberto').length;
        const emCurso = denuncias.filter(d => d.estado === 'Em curso').length;
        const resolvido = denuncias.filter(d => d.estado === 'Resolvido').length;

        const el = document.getElementById('termometro');
        if (!total) {
            el.innerHTML = '<p class="sem-dados">Sem dados para mostrar.</p>';
            return;
        }

        const pct = n => ((n / total) * 100).toFixed(1);
        const seg = (n, cls, label) => n > 0 ? `<div class="termometro-seg ${cls}" style="width:${pct(n)}%">${n} ${label}</div>` : '';

        el.innerHTML = `
            <div class="termometro-barra">
                ${seg(aberto, 'aberto', 'aberto' + (aberto !== 1 ? 's' : ''))}
                ${seg(emCurso, 'emcurso', 'em curso')}
                ${seg(resolvido, 'resolvido', 'resolvido' + (resolvido !== 1 ? 's' : ''))}
            </div>
            <div class="termometro-legenda">
                <span><i style="background:#e0a800;"></i> Aberto (${aberto})</span>
                <span><i style="background:var(--azul-secundario);"></i> Em curso (${emCurso})</span>
                <span><i style="background:#1e7e34;"></i> Resolvido (${resolvido})</span>
                <span style="margin-left:auto; font-weight:700; color:var(--azul-escuro);">Total: ${total}</span>
            </div>
        `;
    }

    // ── LISTA COMPLETA ────────────────────────────────────────────────
    function renderListaCompleta() {
        const texto = document.getElementById('filtroTexto').value.toLowerCase();
        const estado = document.getElementById('filtroEstado').value;
        const prioridade = document.getElementById('filtroPrioridade').value;

        let filtradas = denuncias.filter(d => {
            if (texto && !d.titulo.toLowerCase().includes(texto) && !d.descricao.toLowerCase().includes(texto)) return false;
            if (estado !== 'Todos' && d.estado !== estado) return false;
            if (prioridade !== 'Todas' && d.prioridade !== prioridade) return false;
            return true;
        });

        filtradas.sort((a, b) => {
            if (a.critico !== b.critico) return b.critico ? 1 : -1;
            return new Date(b.data) - new Date(a.data);
        });

        document.getElementById('listaCompleta').innerHTML = filtradas.map(d => `
            <div class="ocorrencia-card ${d.critico ? 'critico' : ''}" data-id="${d.id}" style="margin-bottom:0.6rem;">
                <div class="ocorrencia-info">
                    <h4><span style="color:#64748b; font-weight:600;">${esc(d.id)}</span> · ${esc(d.titulo)} 
                        ${d.critico ? '<span class="badge-critico"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : ''}
                    </h4>
                    <small><strong>Bloco ${esc(d.blocoSelecionado)}</strong> · ${esc(d.localizacaoExata)} · ${esc(d.categoria)} · ${new Date(d.data).toLocaleDateString('pt-PT')}</small>
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span class="badge badge-${d.prioridade.toLowerCase() === 'média' ? 'media' : d.prioridade.toLowerCase()}">${esc(d.prioridade)}</span>
                    <span class="badge badge-${d.estado.toLowerCase() === 'em curso' ? 'em-curso' : d.estado.toLowerCase()}">${esc(d.estado)}</span>
                </div>
            </div>
        `).join('') || '<p class="sem-dados">Nenhuma denúncia encontrada.</p>';

        document.querySelectorAll('#listaCompleta .ocorrencia-card').forEach(card => {
            card.addEventListener('click', () => abrirDetalhes(card.dataset.id));
        });
    }

    document.getElementById('filtroTexto').addEventListener('input', renderListaCompleta);
    document.getElementById('filtroEstado').addEventListener('change', renderListaCompleta);
    document.getElementById('filtroPrioridade').addEventListener('change', renderListaCompleta);

    // ── MODAL DE DETALHES ─────────────────────────────────────────────
    function abrirDetalhes(id) {
        const d = denuncias.find(x => x.id === id);
        if (!d) return;

        const modal = document.getElementById('modalDetalhes');
        const content = document.getElementById('modalContent');

        let historicoHtml = (d.historico || []).map(h => 
            `<li><i class="fas fa-circle" style="font-size:0.4rem; vertical-align:middle; margin-right:6px;"></i> ${esc(h.acao)} · <small>${new Date(h.data).toLocaleString('pt-PT')}</small> (${esc(h.utilizador)})</li>`
        ).join('');

        let fotosHtml = '';
        if (d.fotos && d.fotos.length) {
            fotosHtml = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">' + 
                d.fotos.map(f => `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid var(--cinza-medio);">`).join('') + '</div>';
        }

        content.innerHTML = `
            <button class="modal-close" id="fecharModal">&times;</button>
            <h2 style="color:var(--azul-escuro); margin-bottom:0.3rem;">${esc(d.titulo)}</h2>
            <div style="display:flex; gap:0.8rem; margin:0.5rem 0 1rem;">
                <span class="badge badge-${d.prioridade.toLowerCase() === 'média' ? 'media' : d.prioridade.toLowerCase()}">${esc(d.prioridade)}</span>
                <span class="badge badge-${d.estado.toLowerCase() === 'em curso' ? 'em-curso' : d.estado.toLowerCase()}">${esc(d.estado)}</span>
                <span class="badge" style="background:#e2e8f0; color:#1e2a3a;">${esc(d.categoria)}</span>
            </div>
            <p style="margin-bottom:0.8rem;">${esc(d.descricao)}</p>
            
            <div class="local-destaque ${d.critico ? 'critico' : ''}">
                <i class="fas fa-map-pin"></i> <strong>Bloco ${esc(d.blocoSelecionado)}</strong> — ${esc(d.localizacaoExata)}
            </div>
            <div style="margin:0.6rem 0;">
                ${d.critico ? '<span class="badge-critico" style="font-size:0.8rem; padding:0.3rem 0.9rem;"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : '<span class="badge" style="background:#e2e8f0; color:#1e2a3a;">Não crítico</span>'}
            </div>
            
            <p style="font-size:0.9rem; color:#475569;"><i class="fas fa-calendar-alt"></i> ${new Date(d.data).toLocaleString('pt-PT')}</p>
            ${fotosHtml}
            <hr style="margin:1.2rem 0; border-color:var(--cinza-medio);">
            <h3 style="font-size:1rem; margin-bottom:0.5rem;">Histórico de actualizações</h3>
            <ul style="list-style:none; font-size:0.85rem; color:#1e2a3a; line-height:1.8;">${historicoHtml || '<li>Sem histórico.</li>'}</ul>
            
            <hr style="margin:1.2rem 0; border-color:var(--cinza-medio);">
            <h3 style="font-size:1rem; margin-bottom:0.5rem;">Painel administrativo</h3>
            <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <select id="modalEstado" style="padding:0.5rem 1rem; border-radius:30px; border:1.5px solid var(--cinza-medio);">
                    <option value="Aberto" ${d.estado === 'Aberto' ? 'selected' : ''}>Aberto</option>
                    <option value="Em curso" ${d.estado === 'Em curso' ? 'selected' : ''}>Em curso</option>
                    <option value="Resolvido" ${d.estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                </select>
                <input id="modalResponsavel" placeholder="Responsável" value="${esc(d.responsavel || '')}" style="padding:0.5rem 1rem; border-radius:30px; border:1.5px solid var(--cinza-medio);">
                <button class="btn btn-small" id="btnAtualizarEstado"><i class="fas fa-sync"></i> Actualizar</button>
            </div>
        `;

        modal.classList.add('active');
        document.getElementById('fecharModal').addEventListener('click', () => modal.classList.remove('active'));

       document.getElementById('btnAtualizarEstado').addEventListener('click', async () => {
            const novoEstado = document.getElementById('modalEstado').value;
            const responsavel = document.getElementById('modalResponsavel').value.trim() || 'Admin';
            
            if (novoEstado !== d.estado || responsavel !== d.responsavel) {
                              d.estado = novoEstado;
                d.responsavel = responsavel;
                d.historico = d.historico || [];
                d.historico.push({
                    data: new Date().toISOString(),
                    acao: `${d.critico ? '🚨 ' : ''}Estado alterado para "${novoEstado}" (responsável: ${responsavel})`,
                    utilizador: 'Admin'
                });

                const { error } = await supabaseClient
                    .from('denuncias')
                    .update({ 
                        estado: novoEstado, 
                        responsavel: responsavel, 
                        historico: d.historico 
                    })
                    .eq('id', d.id);

                if (error) {
                    alert('Erro ao atualizar na nuvem: ' + error.message);
                    return;
                }
                modal.classList.remove('active');
                
                if (!views.dashboard.classList.contains('hidden')) renderDashboard();
                if (!views.lista.classList.contains('hidden')) renderListaCompleta();
            } else {
                alert('Nenhuma alteração detectada.');
            }
        });
    }

    document.getElementById('modalDetalhes').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalDetalhes')) {
            document.getElementById('modalDetalhes').classList.remove('active');
        }
    });

    // ── FORMULÁRIO DE NOVA DENÚNCIA ───────────────────────────────────
    document.querySelectorAll('.bloco-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            blocoSelecionado = btn.dataset.bloco;
            document.getElementById('blocoSelecionado').value = blocoSelecionado;
        });
    });

    document.querySelectorAll('input[name="critico"]').forEach(r => {
        r.addEventListener('change', () => {
            const aviso = document.getElementById('criticoAviso');
            const critico = document.querySelector('input[name="critico"]:checked').value === 'sim';
            aviso.classList.toggle('visible', critico);
        });
    });

    document.getElementById('fotos').addEventListener('change', (e) => {
        const files = e.target.files;
        const preview = document.getElementById('fotoPreview');
        preview.innerHTML = '';
        fotosBase64 = [];
        
        if (files.length > 3) {
            alert('Máximo de 3 fotografias por denúncia.');
            e.target.value = '';
            return;
        }
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                fotosBase64.push(ev.target.result);
                const img = document.createElement('img');
                img.src = ev.target.result;
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

   document.getElementById('formDenuncia').addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = document.getElementById('titulo').value.trim();
        const descricao = document.getElementById('descricao').value.trim();
        const localizacaoExata = document.getElementById('localizacaoExata').value.trim();
        const criticoRadio = document.querySelector('input[name="critico"]:checked');

        if (!titulo || !descricao) { alert('Preencha o título e a descrição.'); return; }
        if (!blocoSelecionado) { alert('Seleccione um bloco (A, B, C ou D).'); return; }
        if (!localizacaoExata) { alert('Descreva a localização exacta.'); return; }
        if (!criticoRadio) { alert('Indique se o problema é crítico.'); return; }

        const critico = criticoRadio.value === 'sim';

        const nova = {
            id: 'd' + Date.now(),
            titulo, descricao,
            categoria: document.getElementById('categoria').value,
            prioridade: document.getElementById('prioridade').value,
            estado: 'Aberto',
            campus: document.getElementById('campus').value,
            blocoSelecionado, localizacaoExata, critico,
            data: new Date().toISOString(),
            fotos: [...fotosBase64],
            historico: [{ data: new Date().toISOString(), acao: critico ? 'Denúncia CRÍTICA criada' : 'Denúncia criada', utilizador: 'Aluno' }],
            responsavel: ''
        };

               const { error } = await supabaseClient
            .from('denuncias')
            .insert([{
                titulo: nova.titulo,
                descricao: nova.descricao,
                categoria: nova.categoria,
                prioridade: nova.prioridade,
                estado: 'Aberto',
                campus: nova.campus,
                bloco: nova.blocoSelecionado,
                localizacao_exata: nova.localizacaoExata,
                critico: nova.critico,
                fotos: nova.fotos,
                historico: nova.historico,
                responsavel: ''
            }]);

        if (error) { 
            alert('Erro ao guardar na nuvem: ' + error.message); 
            return; 
        }

        e.target.reset();
        fotosBase64 = [];
        document.getElementById('fotoPreview').innerHTML = '';
        document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
        blocoSelecionado = null;
        document.getElementById('criticoAviso').classList.remove('visible');

        alert(critico ? '✅ Denúncia CRÍTICA registada!' : '✅ Denúncia registada com sucesso!');
        mostrarView('dashboard');
    });

    document.getElementById('resetForm').addEventListener('click', () => {
        fotosBase64 = [];
        document.getElementById('fotoPreview').innerHTML = '';
        document.querySelectorAll('.bloco-btn').forEach(b => b.classList.remove('selected'));
        blocoSelecionado = null;
        document.getElementById('criticoAviso').classList.remove('visible');
    });

    // Inicialização
    carregarDenuncias();
    renderDashboard();

})();