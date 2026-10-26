let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons(true);
});

function showInstallButtons(show) {
    const mobileBtn = document.getElementById('pwa-install-btn-mobile');
    const sidebarBtn = document.getElementById('pwa-install-btn-sidebar');

    if (show) {
        if (mobileBtn) mobileBtn.classList.remove('hidden');
        if (sidebarBtn) sidebarBtn.classList.remove('hidden');
    } else {
        if (mobileBtn) mobileBtn.classList.add('hidden');
        if (sidebarBtn) sidebarBtn.classList.add('hidden');
    }
}

async function installPWA() {
    if (!deferredPrompt) {
        showToast("A instalação não está disponível no momento ou a app já está instalada.");
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        showToast("App instalada com sucesso!");
        showInstallButtons(false);
    }
    deferredPrompt = null;
}

window.addEventListener('appinstalled', () => {
    showInstallButtons(false);
    deferredPrompt = null;
    showToast("PM Studio PRO foi instalado!");
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registado com sucesso:', reg.scope))
            .catch(err => console.log('Falha ao registar o Service Worker:', err));
    });
}

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwg0YBjv4_djqq6Nl4GqxYhbG-OKTGLf1S_nQaRGgOSPXFwZcHiRhkSmZUcOuYZ3rA_jA/exec";
const DB_NAME = 'PTPortalDB';
const DB_VERSION = 3;

class PTPortalDB {
    constructor() { this.db = null; }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('alunos')) db.createObjectStore('alunos', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('medidas')) {
                    const store = db.createObjectStore('medidas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('studentId', 'studentId', { unique: false });
                }
                if (!db.objectStoreNames.contains('forca')) {
                    const store = db.createObjectStore('forca', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('studentId', 'studentId', { unique: false });
                }
                if (!db.objectStoreNames.contains('fichas')) db.createObjectStore('fichas', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('nutricao')) db.createObjectStore('nutricao', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('notas')) db.createObjectStore('notas', { keyPath: 'studentId' });
                if (!db.objectStoreNames.contains('badges')) db.createObjectStore('badges', { keyPath: 'studentId' });
                if (!db.objectStoreNames.contains('aulas')) {
                    const store = db.createObjectStore('aulas', { keyPath: 'key' });
                    store.createIndex('studentId', 'studentId', { unique: false });
                }
            };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
            request.onerror = (e) => reject('Erro IndexedDB: ' + e.target.error);
        });
    }
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async put(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async add(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).add(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).index(indexName).getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
}

const portalDB = new PTPortalDB();
let activeStudentId = null;
let weightChartInstance = null;
let strengthChartInstance = null;
let currentPTRoutineTab = 'A';
let currentEditingRoutineObj = null;

function getInitials(name) {
    if (!name) return '--';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
}

async function populateStudentDropdowns() {
    const alunos = await portalDB.getAll('alunos');
    const sideSelect = document.getElementById('sidebar-student-select');
    const mobSelect = document.getElementById('mobile-student-select');
    sideSelect.innerHTML = '';
    mobSelect.innerHTML = '';

    if (alunos.length === 0) {
        sideSelect.innerHTML = '<option value="">Nenhum atleta</option>';
        mobSelect.innerHTML = '<option value="">Nenhum atleta</option>';
        return;
    }

    if (!activeStudentId && alunos.length > 0) activeStudentId = alunos[0].id;

    alunos.forEach(a => {
        const opt1 = document.createElement('option');
        opt1.value = a.id;
        opt1.innerText = a.name;
        if (a.id === activeStudentId) opt1.selected = true;
        sideSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = a.id;
        opt2.innerText = a.name;
        if (a.id === activeStudentId) opt2.selected = true;
        mobSelect.appendChild(opt2);
    });
}

async function changeStudent(id) {
    if (!id) return;
    activeStudentId = id;
    document.getElementById('sidebar-student-select').value = id;
    document.getElementById('mobile-student-select').value = id;
    await refreshPortalUI();
}

// FUNÇÃO DE REMOÇÃO TOTALMENTE CORRIGIDA (TRANSAÇÃO ATÓMICA SEM ERROS)
async function deleteActiveStudent() {
    if (!activeStudentId) {
        showToast("Nenhum atleta selecionado para remover.");
        return;
    }

    const student = await portalDB.get('alunos', activeStudentId);
    const studentName = student ? student.name : "este atleta";

    if (!confirm(`Tens a certeza absoluta que pretendes remover o atleta "${studentName}" e todos os seus registos?`)) {
        return;
    }

    try {
        const storeNames = ['alunos', 'medidas', 'forca', 'nutricao', 'aulas', 'fichas', 'notas', 'badges'];
        const tx = portalDB.db.transaction(storeNames, 'readwrite');

        tx.objectStore('alunos').delete(activeStudentId);

        const storesWithIndex = ['medidas', 'forca', 'nutricao', 'aulas'];
        for (const storeName of storesWithIndex) {
            const store = tx.objectStore(storeName);
            const index = store.index('studentId');
            const request = index.getAllKeys(activeStudentId);
            
            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => store.delete(key));
            };
        }

        tx.objectStore('notas').delete(activeStudentId);
        tx.objectStore('badges').delete(activeStudentId);

        const fichasStore = tx.objectStore('fichas');
        const fichasReq = fichasStore.getAllKeys();
        fichasReq.onsuccess = () => {
            const keys = fichasReq.result;
            keys.forEach(key => {
                if (typeof key === 'string' && key.startsWith(activeStudentId)) {
                    fichasStore.delete(key);
                }
            });
        };

        tx.oncomplete = async () => {
            showToast(`Atleta "${studentName}" removido com sucesso.`);
            activeStudentId = null;
            await populateStudentDropdowns();
            const alunosRestantes = await portalDB.getAll('alunos');
            if (alunosRestantes.length > 0) {
                await changeStudent(alunosRestantes[0].id);
            } else {
                window.location.reload();
            }
        };

        tx.onerror = (err) => {
            console.error("Erro na transação de remoção:", err);
            showToast("Erro ao remover o atleta.");
        };

    } catch (error) {
        console.error(error);
        showToast("Erro ao remover o atleta.");
    }
}

async function refreshPortalUI() {
    if (!activeStudentId) return;
    const student = await portalDB.get('alunos', activeStudentId);
    if (!student) return;

    document.getElementById('student-name-display').innerText = student.name;
    document.getElementById('student-avatar-large').innerText = getInitials(student.name);
    document.getElementById('student-level-badge').innerText = `Nível ${student.level || 1}`;
    document.getElementById('student-streak-display').innerText = student.streak || 0;
    document.getElementById('student-xp-display').innerText = student.xp || 0;
    document.getElementById('student-workouts-display').innerText = student.completedWorkoutsMonth || 0;

    const medidas = await portalDB.getByIndex('medidas', 'studentId', activeStudentId);
    medidas.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (medidas.length > 0) {
        const last = medidas[medidas.length - 1];
        document.getElementById('dash-weight').innerText = last.weight;
        document.getElementById('dash-fat').innerText = last.fat || '--';
    } else {
        document.getElementById('dash-weight').innerText = '--';
        document.getElementById('dash-fat').innerText = '--';
    }

    const today = new Date().toISOString().split('T')[0];
    const nutricao = await portalDB.get('nutricao', `${activeStudentId}_${today}`) || { water: 0, cals: 0, prot: 0, carbs: 0, fat: 0 };
    document.getElementById('dash-cals').innerText = nutricao.cals;
    document.getElementById('dash-water').innerText = nutricao.water.toFixed(1);
    document.getElementById('pt-cals-ingested').innerText = nutricao.cals;
    document.getElementById('pt-cals-bar').style.width = `${Math.min(100, (nutricao.cals / 2400) * 100)}%`;
    document.getElementById('pt-prot-ingested').innerText = nutricao.prot || 0;
    document.getElementById('pt-prot-bar').style.width = `${Math.min(100, ((nutricao.prot || 0) / 180) * 100)}%`;
    document.getElementById('pt-carbs-ingested').innerText = nutricao.carbs || 0;
    document.getElementById('pt-carbs-bar').style.width = `${Math.min(100, ((nutricao.carbs || 0) / 270) * 100)}%`;
    document.getElementById('pt-fat-ingested').innerText = nutricao.fat || 0;
    document.getElementById('pt-fat-bar').style.width = `${Math.min(100, ((nutricao.fat || 0) / 65) * 100)}%`;
    document.getElementById('pt-water-val').innerText = nutricao.water.toFixed(1);
    document.getElementById('pt-water-cups').innerText = Math.round(nutricao.water / 0.25);

    const nota = await portalDB.get('notas', activeStudentId);
    const notaText = nota ? nota.text : '';
    document.getElementById('quick-trainer-note').value = notaText;
    document.getElementById('full-trainer-notes').value = notaText;

    const aulas = await portalDB.getByIndex('aulas', 'studentId', activeStudentId) || [];
    const bookedClassesContainer = document.getElementById('pt-dash-booked-classes');
    if (bookedClassesContainer) {
        bookedClassesContainer.innerHTML = '';
        const booked = aulas.filter(c => c.booked);
        if (booked.length === 0) {
            bookedClassesContainer.innerHTML = `<p class="text-xs text-slate-500 py-2">Sem aulas reservadas pelo atleta.</p>`;
        } else {
            booked.forEach(b => {
                const item = document.createElement('div');
                item.className = "flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs";
                item.innerHTML = `
                    <div>
                        <p class="font-bold text-white">${b.name}</p>
                        <p class="text-[10px] text-slate-400">${b.time} (${b.category})</p>
                    </div>
                    <span class="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full font-semibold">Reservado</span>
                `;
                bookedClassesContainer.appendChild(item);
            });
        }
    }

    await renderStudentBadges(student);
    await renderDashboardRoutineSummary();
    renderMetricsTable(medidas);
    await renderPTRoutine(currentPTRoutineTab);
    await loadPrescriptionRoutine(document.getElementById('prescribe-routine-select').value);
    renderCharts();
}

async function renderStudentBadges(student) {
    const container = document.getElementById('dash-badges-grid');
    container.innerHTML = '';

    const badgesObj = await portalDB.get('badges', activeStudentId);
    const badgeList = badgesObj ? badgesObj.list : [
        { id: "a1", title: "Consistência de Ferro", desc: "Completou 5 dias seguidos", unlocked: (student.streak || 0) >= 5 },
        { id: "a2", title: "Primeiro Registo", desc: "Perfil Criado", unlocked: true },
        { id: "a3", title: "Atleta Consistente", desc: "10+ Treinos este mês", unlocked: (student.completedWorkoutsMonth || 0) >= 10 },
        { id: "a4", title: "Mestre da Hidratação", desc: "3L de água", unlocked: false },
        { id: "a5", title: "Atleta de Grupo", desc: "Aulas agendadas", unlocked: false }
    ];

    badgeList.forEach(b => {
        const card = document.createElement('div');
        const isUnlocked = b.unlocked !== undefined ? b.unlocked : false;
        card.className = `p-4 rounded-xl border flex items-center space-x-3 ${isUnlocked ? 'bg-slate-800/80 border-brand-500/40 text-white' : 'bg-slate-900/40 border-dark-border text-slate-600'}`;
        card.innerHTML = `
            <div class="w-10 h-10 rounded-lg ${isUnlocked ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-slate-800 text-slate-600'} flex items-center justify-center text-lg font-bold">
                <i class="fa-solid ${b.icon || 'fa-award'}"></i>
            </div>
            <div class="truncate">
                <p class="text-xs font-bold truncate">${b.title || b.name}</p>
                <p class="text-[10px] ${isUnlocked ? 'text-brand-400' : 'text-slate-500'} font-semibold uppercase">${isUnlocked ? 'Desbloqueado' : 'Bloqueado'}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

async function renderDashboardRoutineSummary() {
    const container = document.getElementById('dash-routine-summary');
    container.innerHTML = '';
    const ficha = await portalDB.get('fichas', `${activeStudentId}_A`);
    if (!ficha || !ficha.exercises) {
        container.innerHTML = `<p class="text-xs text-slate-500 py-2">Sem ficha ativa configurada.</p>`;
        return;
    }
    ficha.exercises.slice(0, 3).forEach((ex, idx) => {
        const totalSets = ex.sets ? ex.sets.length : 0;
        const doneSets = ex.sets ? ex.sets.filter(s => s.done).length : 0;

        const item = document.createElement('div');
        item.className = "flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50";
        item.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-brand-400">${idx + 1}</div>
                <div>
                    <p class="text-xs font-bold text-white">${ex.name}</p>
                    <p class="text-[10px] text-slate-400">${totalSets} séries agendadas</p>
                </div>
            </div>
            <span class="text-xs font-bold ${doneSets === totalSets && totalSets > 0 ? 'text-brand-400' : 'text-slate-400'}">
                ${doneSets}/${totalSets} Concluídas
            </span>
        `;
        container.appendChild(item);
    });
}

function renderMetricsTable(medidas) {
    const tbody = document.getElementById('pt-metrics-table-body');
    tbody.innerHTML = '';
    [...medidas].reverse().forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-3 text-white">${m.date}</td><td class="p-3 text-brand-400 font-bold">${m.weight} kg</td><td class="p-3">${m.fat || '-'}%</td><td class="p-3">${m.arm || '-'} cm</td><td class="p-3">${m.waist || '-'} cm</td><td class="p-3">${m.chest || '-'} cm</td>`;
        tbody.appendChild(tr);
    });
}

async function renderCharts() {
    const ctxWeight = document.getElementById('ptWeightChart').getContext('2d');
    if (weightChartInstance) weightChartInstance.destroy();
    const medidas = await portalDB.getByIndex('medidas', 'studentId', activeStudentId);
    medidas.sort((a, b) => new Date(a.date) - new Date(b.date));

    weightChartInstance = new Chart(ctxWeight, {
        type: 'line',
        data: {
            labels: medidas.map(m => m.date),
            datasets: [{ label: 'Peso (kg)', data: medidas.map(m => m.weight), borderColor: '#ccff00', backgroundColor: 'rgba(204,255,0,0.1)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const selectedEx = document.getElementById('pt-exercise-chart-select').value;
    const forcaData = await portalDB.getByIndex('forca', 'studentId', activeStudentId);
    const filteredForca = forcaData.filter(f => f.exercise === selectedEx);
    filteredForca.sort((a, b) => new Date(a.date) - new Date(b.date));

    const ctxStrength = document.getElementById('ptStrengthChart').getContext('2d');
    if (strengthChartInstance) strengthChartInstance.destroy();

    strengthChartInstance = new Chart(ctxStrength, {
        type: 'bar',
        data: {
            labels: filteredForca.map(f => f.date),
            datasets: [{ label: 'Carga (kg)', data: filteredForca.map(f => f.load), backgroundColor: '#00f0ff', borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

async function renderPTRoutine(code) {
    const ficha = await portalDB.get('fichas', `${activeStudentId}_${code}`);
    const container = document.getElementById('pt-workout-routine-container');
    container.innerHTML = '';
    if (!ficha || !ficha.exercises || ficha.exercises.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 py-4">Sem exercícios registados para a Ficha ${code}.</p>`;
        return;
    }

    ficha.exercises.forEach(ex => {
        const card = document.createElement('div');
        card.className = "bg-dark-card p-4 rounded-xl border border-dark-border space-y-3";

        let setsHTML = '';
        if (ex.sets) {
            ex.sets.forEach((s, sIdx) => {
                setsHTML += `
                    <div class="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/40 text-xs">
                        <span class="font-semibold text-slate-400">Série #${sIdx + 1}</span>
                        <span class="text-white font-bold">${s.kg} kg</span>
                        <span class="text-slate-300">${s.reps} reps</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.done ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-400'}">
                            ${s.done ? 'Concluída' : 'Pendente'}
                        </span>
                    </div>
                `;
            });
        }

        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h4 class="font-bold text-white text-sm">${ex.name}</h4>
                <span class="text-xs text-brand-accent font-semibold">${ex.sets ? ex.sets.length : 0} séries</span>
            </div>
            <div class="space-y-1.5">${setsHTML}</div>
        `;
        container.appendChild(card);
    });
}

async function selectRoutineTab(code) {
    currentPTRoutineTab = code;
    document.querySelectorAll('.pt-routine-tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-500', 'text-black');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById(`btn-pt-routine-${code}`);
    if (activeBtn) activeBtn.classList.add('bg-brand-500', 'text-black');

    await renderPTRoutine(code);
}

async function loadPrescriptionRoutine(code) {
    let ficha = await portalDB.get('fichas', `${activeStudentId}_${code}`);
    if (!ficha) ficha = { key: `${activeStudentId}_${code}`, studentId: activeStudentId, routineCode: code, title: `Treino ${code}`, exercises: [] };
    currentEditingRoutineObj = ficha;
    const list = document.getElementById('prescription-exercises-list');
    list.innerHTML = '';
    ficha.exercises.forEach((ex, idx) => {
        const item = document.createElement('div');
        item.className = "p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex justify-between items-center";
        item.innerHTML = `<span class="text-xs text-white font-bold">${ex.name}</span><button onclick="removeEx(${idx})" class="text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>`;
        list.appendChild(item);
    });
}

async function saveRoutinePrescription() {
    if (!currentEditingRoutineObj) return;
    await portalDB.put('fichas', currentEditingRoutineObj);
    showToast("Ficha guardada com sucesso!");
}

async function saveQuickNote() {
    const text = document.getElementById('quick-trainer-note').value;
    await portalDB.put('notas', { studentId: activeStudentId, text });
    showToast("Nota guardada!");
}

async function saveFullNotes() {
    const text = document.getElementById('full-trainer-notes').value;
    await portalDB.put('notas', { studentId: activeStudentId, text });
    showToast("Prontuário atualizado!");
}

function openSyncModal() {
    openModal('sync-modal');
    fetchDriveFilesList();
}

async function fetchDriveFilesList() {
    const container = document.getElementById('drive-files-container');
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> A carregar atletas do Google Drive...</p>`;

    try {
        const response = await fetch(`${WEB_APP_URL}?action=list`);
        const result = await response.json();

        if (result.status === "success" && result.files.length > 0) {
            container.innerHTML = '';
            result.files.forEach(file => {
                const item = document.createElement('div');
                item.className = "flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-dark-border";
                item.innerHTML = `
                    <div>
                        <p class="text-xs font-bold text-white">${file.name}</p>
                        <p class="text-[10px] text-slate-400">Última sync: ${new Date(file.lastUpdated).toLocaleString()}</p>
                    </div>
                    <button onclick="importAthleteFromDrive('${file.id}', '${file.name}')" class="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-black font-bold text-xs rounded-lg transition">
                        Importar Progresso
                    </button>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Nenhum ficheiro encontrado na pasta do Drive.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p class="text-xs text-rose-400 text-center py-4">Erro ao comunicar com o Google Drive.</p>`;
    }
}

async function importAthleteFromDrive(fileId, fileName) {
    showToast(`A importar ${fileName}...`);
    try {
        const response = await fetch(`${WEB_APP_URL}?action=read&fileId=${fileId}`);
        const result = await response.json();

        if (result.status === "success") {
            await processImportedData(result.data);
            closeModal('sync-modal');
            showToast(`Atleta ${fileName} importado com progresso completo!`);
        } else {
            showToast("Erro ao ler dados do ficheiro.");
        }
    } catch (err) {
        showToast("Erro de ligação ao Google Drive.");
    }
}

async function syncActiveStudentToGoogleDrive() {
    if (!activeStudentId) return;
    const student = await portalDB.get('alunos', activeStudentId);
    const pesoData = await portalDB.getByIndex('medidas', 'studentId', activeStudentId);
    const forcaData = await portalDB.getByIndex('forca', 'studentId', activeStudentId);
    const notas = await portalDB.get('notas', activeStudentId);
    const badges = await portalDB.get('badges', activeStudentId);
    const aulasData = await portalDB.getByIndex('aulas', 'studentId', activeStudentId);

    const payloadData = {
        athleteName: student.name,
        payload: {
            profile: {
                name: student.name,
                level: student.level || 1,
                xp: student.xp || 0,
                streak: student.streak || 0,
                completedWorkoutsMonth: student.completedWorkoutsMonth || 0
            },
            peso: pesoData,
            forca: forcaData,
            aulas: aulasData,
            conquistasEBadges: badges ? badges.list : [],
            notasTrainer: notas ? notas.text : "",
            lastSync: new Date().toISOString()
        }
    };

    showToast("A guardar no Google Drive...");
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadData)
        });
        showToast(`Dados de ${student.name} sincronizados no Drive!`);
    } catch (err) {
        showToast("Erro ao sincronizar com o Drive.");
    }
}

// CORREÇÃO DA DUPLICAÇÃO DE ATLETAS E CORREÇÃO DO GRÁFICO DE PESO
async function processImportedData(data) {
    const rawData = data.payload || data;
    const profile = rawData.profile || rawData.atleta || rawData.perfil || rawData;
    const athleteName = profile.name || profile.nome || data.athleteName || "Atleta Importado";

    const alunos = await portalDB.getAll('alunos');
    const existingStudent = alunos.find(a => a.name.trim().toLowerCase() === athleteName.trim().toLowerCase());
    
    const targetId = existingStudent ? existingStudent.id : `student_${Date.now()}`;

    await portalDB.put('alunos', {
        id: targetId,
        name: athleteName,
        streak: profile.streak || profile.diasSeguidosStreak || 0,
        xp: profile.xp || profile.experienciaXP || 0,
        level: profile.level || profile.nivel || 1,
        completedWorkoutsMonth: profile.completedWorkoutsMonth || profile.treinosConcluidosMes || 0
    });

    // LIMPEZA PRÉVIA DE MEDIDAS ANTIGAS PARA EVITAR MULTIPLICAR/DISTORCER O GRÁFICO
    const oldMedidas = await portalDB.getByIndex('medidas', 'studentId', targetId);
    if (oldMedidas && oldMedidas.length > 0) {
        const txMedidasDel = portalDB.db.transaction('medidas', 'readwrite');
        const storeMedidasDel = txMedidasDel.objectStore('medidas');
        oldMedidas.forEach(m => storeMedidasDel.delete(m.id));
    }

    const pesoList = rawData.peso || rawData.medidasEPeso || [];
    if (Array.isArray(pesoList)) {
        for (const p of pesoList) {
            await portalDB.add('medidas', {
                studentId: targetId,
                date: p.date,
                weight: parseFloat(p.weight) || 0,
                fat: p.fat ? parseFloat(p.fat) : null,
                arm: p.arm ? parseFloat(p.arm) : null,
                waist: p.waist ? parseFloat(p.waist) : null,
                chest: p.chest ? parseFloat(p.chest) : null
            });
        }
    }

    // LIMPEZA PRÉVIA DE DADOS DE FORÇA
    const oldForca = await portalDB.getByIndex('forca', 'studentId', targetId);
    if (oldForca && oldForca.length > 0) {
        const txForcaDel = portalDB.db.transaction('forca', 'readwrite');
        const storeForcaDel = txForcaDel.objectStore('forca');
        oldForca.forEach(f => storeForcaDel.delete(f.id));
    }

    const forcaList = rawData.forca || rawData.evolucaoForca || [];
    if (Array.isArray(forcaList)) {
        for (const f of forcaList) {
            await portalDB.add('forca', {
                studentId: targetId,
                exercise: f.exercise,
                date: f.date,
                load: parseFloat(f.load) || 0
            });
        }
    }

    const treinosList = rawData.treinos || [];
    if (Array.isArray(treinosList)) {
        for (const t of treinosList) {
            await portalDB.put('fichas', {
                key: `${targetId}_${t.routineCode || 'A'}`,
                studentId: targetId,
                routineCode: t.routineCode || 'A',
                title: t.title || "Treino Prescrito",
                exercises: t.exercises || []
            });
        }
    }

    const nutricaoList = rawData.nutricao || rawData.nutricaoEHidratacao || [];
    if (Array.isArray(nutricaoList)) {
        for (const n of nutricaoList) {
            const dateKey = n.date || new Date().toISOString().split('T')[0];
            await portalDB.put('nutricao', {
                key: `${targetId}_${dateKey}`,
                studentId: targetId,
                date: dateKey,
                water: parseFloat(n.water) || 0,
                cals: parseInt(n.cals) || 0,
                prot: parseInt(n.prot) || 0,
                carbs: parseInt(n.carbs) || 0,
                fat: parseInt(n.fat) || 0
            });
        }
    }

    const aulasList = rawData.aulas || [];
    if (Array.isArray(aulasList)) {
        for (const a of aulasList) {
            await portalDB.put('aulas', {
                key: `${targetId}_${a.id}`,
                studentId: targetId,
                ...a
            });
        }
    }

    const badgesList = rawData.conquistasEBadges || rawData.badges || [];
    if (Array.isArray(badgesList) && badgesList.length > 0) {
        await portalDB.put('badges', {
            studentId: targetId,
            list: badgesList
        });
    }

    await populateStudentDropdowns();
    await changeStudent(targetId);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) btn.classList.add('text-brand-400', 'font-bold');
        else btn.classList.remove('text-brand-400', 'font-bold');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showToast(msg) {
    const toast = document.getElementById('toast-notification');
    document.getElementById('toast-message').innerText = msg;
    toast.classList.remove('translate-y-32');
    setTimeout(() => toast.classList.add('translate-y-32'), 3000);
}

window.onload = async function() {
    await portalDB.init();
    await populateStudentDropdowns();
    const alunos = await portalDB.getAll('alunos');
    if (alunos.length > 0) {
        activeStudentId = alunos[0].id;
        await refreshPortalUI();
    }
};
