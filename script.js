/* ========================================================
   1. FIREBASE CONFIGURATION
   ======================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyAKth3o5XhUTLNZ8JSbsKPKEIHmqhTHHH4",
  authDomain: "nileprise-crm.firebaseapp.com",
  projectId: "nileprise-crm",
  storageBucket: "nileprise-crm.firebasestorage.app",
  messagingSenderId: "1090344693240",
  appId: "1:1090344693240:web:68be4d7df18c82232b7a0d",
  measurementId: "G-RP3R2P9JPF"
};

try { firebase.initializeApp(firebaseConfig); } catch (e) { console.error("Firebase Init Error:", e); }
const db = firebase.firestore();
const auth = firebase.auth();

/* ========================================================
   2. ACCESS CONTROL LIST
   ======================================================== */
const ALLOWED_USERS = {
    'ali@nileprise.com': { name: 'Asif', role: 'Employee' },
    'mdi@nileprise.com': { name: 'Ikram', role: 'Employee' },
    'mmr@nileprise.com': { name: 'Manikanta', role: 'Employee' },
    'maj@nileprise.com': { name: 'Mazher', role: 'Employee' },
    'msa@nileprise.com': { name: 'Shoeb', role: 'Employee' },
    'fma@nileprise.com': { name: 'Fayaz', role: 'Manager' },
    'an@nileprise.com': { name: 'Akhil', role: 'Manager' },
    'aman@nileprise.com': { name: 'Sanketh', role: 'Manager' },
    'nikhil@nileprise.com': { name: 'Nikhil Rapolu', role: 'Admin' },
    'admin@nileprise.com': { name: 'Admin', role: 'Admin' }
};

/* ========================================================
   3. STATE MANAGEMENT
   ======================================================== */
const state = {
    user: null, 
    userRole: null, 
    candidates: [], 
    onboarding: [],
    // FILTERS
    filters: { text: '', recruiter: '', tech: '', status: '' },
    hubFilters: { text: '', recruiter: '' },
    onbFilters: { text: '' }, 
    // SELECTION (No more pagination logic needed for display)
    selection: { cand: new Set(), onb: new Set() },
    modal: { id: null, type: null },
    pendingDelete: { type: null },
    metadata: {
        recruiters: ["Asif", "Ikram", "Manikanta", "Mazher", "Shoeb"],
        techs: ["React", "Node.js", "Java", "Python", ".NET", "AWS"]
    }
};

/* ========================================================
   4. DOM ELEMENTS
   ======================================================== */
const dom = {
    screens: { auth: document.getElementById('auth-screen'), app: document.getElementById('dashboard-screen'), verify: document.getElementById('verify-screen') },
    navItems: document.querySelectorAll('.nav-item'),
    views: {
        dashboard: document.getElementById('view-dashboard'),
        candidates: document.getElementById('view-candidates'),
        hub: document.getElementById('view-hub'),
        onboarding: document.getElementById('view-onboarding'),
        settings: document.getElementById('view-settings'),
        profile: document.getElementById('view-profile')
    },
    headerUpdated: document.getElementById('header-updated'),
    tables: {
        cand: { body: document.getElementById('table-body'), head: document.getElementById('table-head') },
        hub: { body: document.getElementById('hub-table-body'), head: document.getElementById('hub-table-head') },
        onb: { body: document.getElementById('onboarding-table-body'), head: document.getElementById('onboarding-table-head') }
    },
    modal: {
        self: document.getElementById('activity-modal'),
        title: document.getElementById('act-modal-title'),
        week: document.getElementById('act-week'),
        month: document.getElementById('act-month'),
        total: document.getElementById('act-total'),
        input: document.getElementById('act-date-input'),
        list: document.getElementById('act-history-list')
    }
};

/* ========================================================
   5. INIT & AUTH
   ======================================================== */
function init() {
    try {
        console.log("App Initializing...");
        setupEventListeners();
        renderDropdowns();
        
        auth.onAuthStateChanged(user => {
            if (user) {
                if (!user.emailVerified) { 
                    document.getElementById('verify-email-display').innerText = user.email; 
                    switchScreen('verify'); 
                    return; 
                }
                state.user = user;
                const email = user.email.toLowerCase();
                const knownUser = ALLOWED_USERS[email];
                state.userRole = knownUser ? knownUser.role : 'Admin';
                
                updateUserProfile(user, knownUser);
                switchScreen('app');
                initRealtimeListeners();
            } else {
                switchScreen('auth');
            }
        });
    } catch (err) {
        console.error("Init Error:", err);
        switchScreen('auth'); 
    }
    if(localStorage.getItem('np_theme') === 'light') {
        document.body.classList.add('light-mode');
    }
}

function switchScreen(screenName) {
    Object.values(dom.screens).forEach(s => s.classList.remove('active'));
    if(dom.screens[screenName]) dom.screens[screenName].classList.add('active');
}

window.switchAuth = (target) => { 
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active')); 
    document.getElementById(`form-${target}`).classList.add('active'); 
};

function showToast(msg) { 
    const t = document.getElementById('toast'); 
    document.getElementById('toast-msg').innerText = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 2000); 
}

function cleanError(msg) { 
    return msg.replace('Firebase: ', '').replace('Error ', '').replace('(auth/', '').replace(').', '').replace(/-/g, ' ').toUpperCase(); 
}

/* ========================================================
   6. PROFILE & NAVIGATION LOGIC
   ======================================================== */
// NAVIGATION
dom.navItems.forEach(btn => {
    btn.addEventListener('click', (e) => {
        dom.navItems.forEach(b => b.classList.remove('active'));
        const clickedBtn = e.target.closest('.nav-item');
        clickedBtn.classList.add('active');

        Object.values(dom.views).forEach(view => view.classList.remove('active'));
        const targetId = clickedBtn.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        
        if (targetView) {
            targetView.classList.add('active');
            if (targetId === 'view-dashboard') updateDashboardStats();
            if (targetId === 'view-profile') refreshProfileData();
        }
    });
});

function updateUserProfile(user, userData) {
    if (!user) return;
    const displayName = userData ? userData.name : (user.displayName || 'Staff Member');
    const role = userData ? userData.role : 'Viewer';

    // Header Pill
    const headerUser = document.getElementById('display-username');
    if (headerUser) { headerUser.innerText = displayName; headerUser.style.display = 'block'; }

    // Profile Page Elements
    const nameDisplay = document.getElementById('prof-name-display');
    const roleDisplay = document.getElementById('prof-role-display');
    const emailInput = document.getElementById('prof-email');
    const userInput = document.getElementById('prof-username');
    const loginInput = document.getElementById('prof-last-login');

    if (nameDisplay) nameDisplay.innerText = displayName;
    if (roleDisplay) roleDisplay.innerText = role;
    if (emailInput) emailInput.value = user.email;
    if (userInput) userInput.value = user.email.split('@')[0].toUpperCase();
    if (loginInput && user.metadata) loginInput.value = new Date(user.metadata.lastSignInTime).toLocaleString();

    // Avatar
    const avatarImg = document.getElementById('profile-main-img');
    const avatarPlaceholder = document.getElementById('profile-main-icon');
    if (user.photoURL && avatarImg) {
        avatarImg.src = user.photoURL;
        avatarImg.style.display = 'block';
        if(avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    }
}

function refreshProfileData() {
    const user = firebase.auth().currentUser;
    const knownUser = ALLOWED_USERS[user?.email];
    if(user) updateUserProfile(user, knownUser);
}

/* ========================================================
   7. REAL-TIME DATA
   ======================================================== */
function initRealtimeListeners() {
    // Infinite Scroll: Listen to ALL changes, sorted by date
    db.collection('candidates').orderBy('createdAt', 'desc').onSnapshot(snap => {
        state.candidates = [];
        snap.forEach(doc => state.candidates.push({ id: doc.id, ...doc.data() }));
        renderCandidateTable();
        renderHubTable();
        updateDashboardStats();
        if(dom.headerUpdated) dom.headerUpdated.innerText = 'Synced';
    });
    db.collection('onboarding').orderBy('createdAt', 'desc').onSnapshot(snap => {
        state.onboarding = [];
        snap.forEach(doc => state.onboarding.push({ id: doc.id, ...doc.data() }));
        renderOnboardingTable();
    });
}

/* ========================================================
   8. RENDERERS
   ======================================================== */
// --- CANDIDATES TABLE ---
function renderCandidateTable() {
    const filtered = getFilteredData(state.candidates, state.filters);
    const headers = ['<input type="checkbox" id="select-all-cand" onclick="toggleSelectAll(\'cand\', this)">', '#', 'First Name', 'Last Name', 'Mobile', 'WhatsApp', 'Tech', 'Recruiter', 'Status', 'Assigned', 'Gmail', 'LinkedIn', 'Resume', 'Track', 'Comments'];
    dom.tables.cand.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    
    // UPDATE COUNT
    const footerCount = document.getElementById('cand-footer-count');
    if(footerCount) footerCount.innerText = `Showing ${filtered.length} records`;

    dom.tables.cand.body.innerHTML = filtered.map((c, i) => {
        const idx = i + 1;
        const isSel = state.selection.cand.has(c.id) ? 'checked' : '';
        const rowClass = state.selection.cand.has(c.id) ? 'selected-row' : '';
        
        let statusStyle = "";
        if(c.status === 'Active') statusStyle = 'active';
        else statusStyle = 'inactive';
        
        return `
        <tr class="${rowClass}">
            <td><input type="checkbox" ${isSel} onchange="toggleSelect('${c.id}', 'cand')"></td>
            <td>${idx}</td>
            <td onclick="inlineEdit('${c.id}', 'first', 'candidates', this)">${c.first}</td>
            <td onclick="inlineEdit('${c.id}', 'last', 'candidates', this)">${c.last}</td>
            <td onclick="inlineEdit('${c.id}', 'mobile', 'candidates', this)">${c.mobile}</td>
            <td onclick="inlineEdit('${c.id}', 'wa', 'candidates', this)">${c.wa}</td>
            <td onclick="inlineEdit('${c.id}', 'tech', 'candidates', this)">${c.tech}</td>
            <td onclick="editRecruiter('${c.id}', 'candidates', this)">${c.recruiter}</td>
            <td>
                <select class="status-select ${statusStyle}" onchange="updateStatus('${c.id}', 'candidates', this.value)">
                    <option value="Active" ${c.status==='Active'?'selected':''}>Active</option>
                    <option value="Inactive" ${c.status==='Inactive'?'selected':''}>Inactive</option>
                </select>
            </td>
            <td><input type="date" class="date-input-modern" value="${c.assigned}" onchange="inlineDateEdit('${c.id}', 'assigned', 'candidates', this.value)"></td>
            
            <td class="url-cell" onclick="inlineUrlEdit('${c.id}', 'gmail', 'candidates', this)">${c.gmail ? 'Gmail' : ''}</td>
            <td class="url-cell" onclick="inlineUrlEdit('${c.id}', 'linkedin', 'candidates', this)">${c.linkedin ? 'LinkedIn' : ''}</td>
            <td class="url-cell" onclick="inlineUrlEdit('${c.id}', 'resume', 'candidates', this)">${c.resume ? 'Resume' : ''}</td>
            <td class="url-cell" onclick="inlineUrlEdit('${c.id}', 'track', 'candidates', this)">${c.track ? 'Tracker' : ''}</td>
            
            <td onclick="inlineEdit('${c.id}', 'comments', 'candidates', this)">${c.comments || '-'}</td>
        </tr>`;
    }).join('');
}

// --- HUB TABLE ---
function renderHubTable() {
    const filtered = state.candidates.filter(c => {
        const matchesText = (c.first + ' ' + c.last).toLowerCase().includes(state.hubFilters.text);
        const matchesRec = state.hubFilters.recruiter ? c.recruiter === state.hubFilters.recruiter : true;
        return matchesText && matchesRec;
    });

    const headers = ['#', 'Name', 'Recruiter', 'Tech', 'Submissions', 'Screenings', 'Interviews', 'Last Activity'];
    
    dom.tables.hub.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    
    // UPDATE COUNT
    const footerCount = document.getElementById('hub-footer-count');
    if(footerCount) footerCount.innerText = `Showing ${filtered.length} records`;

    dom.tables.hub.body.innerHTML = filtered.map((c, i) => {
        const idx = i + 1;
        let lastAct = '-'; 
        if(c.interviewLog && c.interviewLog.length) lastAct = c.interviewLog.sort().reverse()[0];
        return `<tr><td>${idx}</td><td>${c.first} ${c.last}</td><td>${c.recruiter || '-'}</td><td style="color:var(--primary);">${c.tech}</td>
            <td class="text-cyan" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'submissionLog', '${c.first}')">${(c.submissionLog||[]).length}</td>
            <td class="text-gold" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'screeningLog', '${c.first}')">${(c.screeningLog||[]).length}</td>
            <td class="text-cyan" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'interviewLog', '${c.first}')">${(c.interviewLog||[]).length}</td>
            <td>${lastAct}</td></tr>`;
    }).join('');
}

// --- ONBOARDING TABLE ---
function renderOnboardingTable() {
    const filtered = state.onboarding.filter(item => {
        const searchText = state.onbFilters.text;
        const fullName = (item.first + ' ' + item.last).toLowerCase();
        const mobile = (item.mobile || '').toLowerCase();
        return fullName.includes(searchText) || mobile.includes(searchText);
    });

    const headers = ['<input type="checkbox" id="select-all-onb" onclick="toggleSelectAll(\'onb\', this)">', '#', 'First Name', 'Last Name', 'Recruiter', 'Mobile', 'Status', 'Assigned', 'Comments'];
    dom.tables.onb.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    // UPDATE COUNT
    const footerCount = document.getElementById('onb-footer-count');
    if(footerCount) footerCount.innerText = `Showing ${filtered.length} records`;

    dom.tables.onb.body.innerHTML = filtered.map((c, i) => {
        const idx = i + 1;
        const isSel = state.selection.onb.has(c.id) ? 'checked' : '';
        return `<tr><td><input type="checkbox" ${isSel} onchange="toggleSelect('${c.id}', 'onb')"></td><td>${idx}</td>
        <td onclick="inlineEdit('${c.id}', 'first', 'onboarding', this)">${c.first}</td><td onclick="inlineEdit('${c.id}', 'last', 'onboarding', this)">${c.last}</td>
        <td onclick="editRecruiter('${c.id}', 'onboarding', this)">${c.recruiter || '-'}</td>
        <td onclick="inlineEdit('${c.id}', 'mobile', 'onboarding', this)">${c.mobile}</td>
        <td><select class="status-select ${c.status === 'Onboarding' ? 'active' : 'inactive'}" onchange="updateStatus('${c.id}', 'onboarding', this.value)"><option value="Onboarding" ${c.status==='Onboarding'?'selected':''}>Onboarding</option><option value="Completed" ${c.status==='Completed'?'selected':''}>Completed</option></select></td>
        <td><input type="date" class="date-input-modern" value="${c.assigned}" onchange="inlineDateEdit('${c.id}', 'assigned', 'onboarding', this.value)"></td>
        <td onclick="inlineEdit('${c.id}', 'comments', 'onboarding', this)">${c.comments || '-'}</td></tr>`;
    }).join('');
}

/* ========================================================
   9. UTILITIES (Edit, Filter, Date, URL)
   ======================================================== */
function renderDropdowns() {
    const rSelect = document.getElementById('filter-recruiter');
    if (rSelect && state.metadata.recruiters) rSelect.innerHTML = `<option value="">All Recruiters</option>` + state.metadata.recruiters.map(r => `<option value="${r}">${r}</option>`).join('');
    const tSelect = document.getElementById('filter-tech');
    if (tSelect && state.metadata.techs) tSelect.innerHTML = `<option value="">All Tech</option>` + state.metadata.techs.map(t => `<option value="${t}">${t}</option>`).join('');
}

function getFilteredData(data, filters) {
    return data.filter(item => {
        const matchesText = (item.first + ' ' + item.last + ' ' + (item.tech||'')).toLowerCase().includes(filters.text);
        const matchesRec = filters.recruiter ? item.recruiter === filters.recruiter : true;
        const matchesTech = filters.tech ? item.tech === filters.tech : true;
        const matchesStatus = filters.status ? item.status === filters.status : true;
        return matchesText && matchesRec && matchesTech && matchesStatus;
    });
}

function inlineEdit(id, field, collection, el) {
    if(el.querySelector('input')) return;
    const currentText = el.innerText === '-' ? '' : el.innerText;
    el.innerHTML = ''; el.classList.add('editing-cell');
    const input = document.createElement('input'); input.type = 'text'; input.value = currentText; input.className = 'inline-input-active';
    const save = () => { const newVal = input.value.trim(); el.innerHTML = newVal || '-'; el.classList.remove('editing-cell'); if (newVal !== currentText) db.collection(collection).doc(id).update({ [field]: newVal }); };
    input.addEventListener('blur', save); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    el.appendChild(input); input.focus();
}

function inlineUrlEdit(id, field, collection, el) {
    if(el.querySelector('input')) return;
    
    el.innerHTML = ''; el.classList.add('editing-cell');
    const input = document.createElement('input'); 
    input.type = 'url'; 
    input.placeholder = 'Paste Link Here...';
    input.className = 'inline-input-active';
    
    const save = () => { 
        let newVal = input.value.trim(); 
        if(newVal && !newVal.startsWith('http')) newVal = 'https://' + newVal; 
        el.innerHTML = newVal ? 'Saved' : '';
        el.classList.remove('editing-cell'); 
        db.collection(collection).doc(id).update({ [field]: newVal }); 
    };
    
    input.addEventListener('blur', save); 
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    el.appendChild(input); 
    input.focus();
}

function inlineDateEdit(id, field, collection, val) {
    db.collection(collection).doc(id).update({ [field]: val });
}

function editRecruiter(id, collection, el) {
    if(el.querySelector('select')) return;
    const val = el.innerText; el.innerHTML = '';
    const sel = document.createElement('select'); sel.className = 'modern-select';
    state.metadata.recruiters.forEach(r => { const opt = document.createElement('option'); opt.value = r; opt.text = r; if(r === val) opt.selected = true; sel.appendChild(opt); });
    sel.focus(); const save = () => db.collection(collection).doc(id).update({ recruiter: sel.value });
    sel.addEventListener('blur', save); sel.addEventListener('change', save); el.appendChild(sel);
}

window.updateStatus = (id, col, val) => db.collection(col).doc(id).update({ status: val });

window.toggleSelect = (id, type) => {
    if(state.selection[type].has(id)) state.selection[type].delete(id); else state.selection[type].add(id);
    updateSelectButtons(type);
};

window.toggleSelectAll = (type, mainCheckbox) => {
    const isChecked = mainCheckbox.checked;
    let currentData = [];
    if (type === 'cand') currentData = getFilteredData(state.candidates, state.filters);
    else { 
        const searchText = state.onbFilters.text;
        currentData = state.onboarding.filter(item => (item.first + ' ' + item.last).toLowerCase().includes(searchText));
    }
    currentData.forEach(item => { if (isChecked) state.selection[type].add(item.id); else state.selection[type].delete(item.id); });
    updateSelectButtons(type);
    if (type === 'cand') renderCandidateTable(); else renderOnboardingTable();
    setTimeout(() => { const newMaster = document.getElementById(type === 'cand' ? 'select-all-cand' : 'select-all-onb'); if(newMaster) newMaster.checked = isChecked; }, 0);
};

function updateSelectButtons(type) {
    const btn = type === 'cand' ? document.getElementById('btn-delete-selected') : document.getElementById('btn-delete-onboarding');
    const countSpan = type === 'cand' ? document.getElementById('selected-count') : document.getElementById('onboarding-selected-count');
    if (state.selection[type].size > 0) { btn.style.display = 'inline-flex'; if (countSpan) countSpan.innerText = state.selection[type].size; } else { btn.style.display = 'none'; }
}

/* ========================================================
   10. EVENT LISTENERS
   ======================================================== */
function setupEventListeners() {
    document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());
    document.getElementById('theme-toggle').addEventListener('click', () => { document.body.classList.toggle('light-mode'); localStorage.setItem('np_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark'); });
    
    // Auth
    window.handleLogin = () => { const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value; auth.signInWithEmailAndPassword(e, p).catch(err => showToast(cleanError(err.message))); };
    window.handleSignup = () => { const n = document.getElementById('reg-name').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value; auth.createUserWithEmailAndPassword(e, p).then(r => r.user.updateProfile({displayName:n})).then(u=>{firebase.auth().currentUser.sendEmailVerification();showToast("Check Email!");switchAuth('login');}).catch(err => showToast(cleanError(err.message))); };
    window.handleReset = () => { auth.sendPasswordResetEmail(document.getElementById('reset-email').value).then(()=>showToast("Link Sent")).catch(err=>showToast(cleanError(err.message))); };
    window.checkVerificationStatus = () => { const u = firebase.auth().currentUser; if(u) u.reload().then(()=>{if(u.emailVerified) location.reload();}); };
    window.resendVerificationEmail = () => { const u = firebase.auth().currentUser; if(u) u.sendEmailVerification().then(()=>showToast("Sent!")); };

    // Seed
    document.getElementById('btn-seed-data').addEventListener('click', window.seedData);
    
    // Candidate Filters
    document.getElementById('search-input').addEventListener('input', e => { state.filters.text = e.target.value.toLowerCase(); renderCandidateTable(); });
    document.getElementById('filter-recruiter').addEventListener('change', e => { state.filters.recruiter = e.target.value; renderCandidateTable(); });
    document.getElementById('filter-tech').addEventListener('change', e => { state.filters.tech = e.target.value; renderCandidateTable(); });
    document.querySelectorAll('.btn-toggle').forEach(btn => { btn.addEventListener('click', e => { document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); state.filters.status = e.target.dataset.status; renderCandidateTable(); }); });
    document.getElementById('btn-reset-filters').addEventListener('click', () => { document.getElementById('search-input').value = ''; document.getElementById('filter-recruiter').value = ''; document.getElementById('filter-tech').value = ''; document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active')); document.querySelector('.btn-toggle[data-status=""]').classList.add('active'); state.filters = { text: '', recruiter: '', tech: '', status: '' }; renderCandidateTable(); showToast("Filters refreshed"); });

    // Hub Filter (New)
    document.getElementById('hub-search-input').addEventListener('input', e => { state.hubFilters.text = e.target.value.toLowerCase(); renderHubTable(); });
    const hubRecSelect = document.getElementById('hub-filter-recruiter');
    if(hubRecSelect) { hubRecSelect.addEventListener('change', (e) => { state.hubFilters.recruiter = e.target.value; renderHubTable(); }); }

    // Onboarding Filter
    const onbSearch = document.getElementById('onb-search-input');
    if(onbSearch) { onbSearch.addEventListener('input', e => { state.onbFilters.text = e.target.value.toLowerCase(); renderOnboardingTable(); }); }

    // Add Buttons
    document.getElementById('btn-add-candidate').addEventListener('click', () => { db.collection('candidates').add({ first: '', last: '', mobile: '', wa: '', tech: '', recruiter: '', status: 'Active', assigned: new Date().toISOString().split('T')[0], comments: '', createdAt: Date.now(), submissionLog: [], screeningLog: [], interviewLog: [] }).then(() => showToast("Inserted")); });
    document.getElementById('btn-add-onboarding').addEventListener('click', () => { db.collection('onboarding').add({ first: '', last: '', mobile: '', status: 'Onboarding', assigned: new Date().toISOString().split('T')[0], comments: '', createdAt: Date.now() }).then(() => showToast("Inserted")); });

    // Delete Buttons
    document.getElementById('btn-delete-selected').addEventListener('click', () => openDeleteModal('cand'));
    document.getElementById('btn-delete-onboarding').addEventListener('click', () => openDeleteModal('onb'));
}

/* ========================================================
   11. DATA OPS
   ======================================================== */
window.seedData = () => {
    const batch = db.batch();
    const techList = state.metadata.techs;
    const recList = state.metadata.recruiters;
    for (let i = 1; i <= 25; i++) {
        const newRef = db.collection('candidates').doc();
        batch.set(newRef, { first: `Candidate`, last: `${i}`, mobile: `98765432${i < 10 ? '0'+i : i}`, wa: `98765432${i < 10 ? '0'+i : i}`, tech: techList[Math.floor(Math.random() * techList.length)], recruiter: recList[Math.floor(Math.random() * recList.length)], status: i % 3 === 0 ? "Inactive" : "Active", assigned: new Date().toISOString().split('T')[0], comments: "Auto-generated demo data", createdAt: Date.now() + i });
    }
    batch.commit().then(() => { renderCandidateTable(); showToast("25 Demo Candidates Inserted"); });
};

window.openModal = (id, type, name) => { state.modal.id = id; state.modal.type = type; dom.modal.self.style.display = 'flex'; dom.modal.title.innerText = `${name} - ${type.replace('Log','').toUpperCase()}`; dom.modal.input.value = new Date().toISOString().split('T')[0]; renderModalContent(); };
window.closeActivityModal = () => { dom.modal.self.style.display = 'none'; };
window.saveActivityLog = () => { const date = dom.modal.input.value; if(!date) return; const c = state.candidates.find(x => x.id === state.modal.id); let logs = c[state.modal.type] || []; logs.push(date); logs.sort().reverse(); db.collection('candidates').doc(state.modal.id).update({ [state.modal.type]: logs }); renderModalContent(); showToast("Activity Logged"); };
function renderModalContent() { const c = state.candidates.find(x => x.id === state.modal.id); if(!c) return; const logs = c[state.modal.type] || []; const now = new Date(); let week = 0, month = 0; logs.forEach(dStr => { const d = new Date(dStr); const diff = (now - d) / (1000 * 60 * 60 * 24); if(diff <= 7) week++; if(d.getMonth() === now.getMonth()) month++; }); dom.modal.week.innerText = week; dom.modal.month.innerText = month; dom.modal.total.innerText = logs.length; dom.modal.list.innerHTML = logs.map(d => `<li>${d}</li>`).join(''); }

window.openDeleteModal = (type) => { const count = state.selection[type].size; if (count === 0) return; state.pendingDelete.type = type; document.getElementById('del-count').innerText = count; document.getElementById('delete-modal').style.display = 'flex'; };
window.closeDeleteModal = () => { document.getElementById('delete-modal').style.display = 'none'; state.pendingDelete.type = null; };
window.executeDelete = () => { const type = state.pendingDelete.type; if (!type) return; const collection = type === 'cand' ? 'candidates' : 'onboarding'; state.selection[type].forEach(id => { db.collection(collection).doc(id).delete(); }); state.selection[type].clear(); updateSelectButtons(type); showToast("Items Deleted"); closeDeleteModal(); };

window.exportData = () => { if (state.candidates.length === 0) return showToast("No data"); const headers = ["ID", "First", "Last", "Mobile", "Tech", "Recruiter", "Status", "Date", "Comments"]; const csvRows = [headers.join(",")]; state.candidates.forEach(c => { const row = [c.id, `"${c.first}"`, `"${c.last}"`, `"${c.mobile}"`, `"${c.tech}"`, `"${c.recruiter}"`, `"${c.status}"`, c.assigned, `"${(c.comments || '').replace(/"/g, '""')}"`]; csvRows.push(row.join(",")); }); const blob = new Blob([csvRows.join("\n")], { type: "text/csv" }); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "candidates.csv"; a.click(); };

/* ========================================================
   12. CHARTS & DASHBOARD
   ======================================================== */
function updateDashboardStats() { 
    const total = state.candidates.length;
    const techs = new Set(state.candidates.map(c=>c.tech)).size;
    const recruiters = state.metadata.recruiters.length;

    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = total;
    if(document.getElementById('stat-tech')) document.getElementById('stat-tech').innerText = techs;
    if(document.getElementById('stat-rec')) document.getElementById('stat-rec').innerText = recruiters;
    if(document.getElementById('current-date-display')) document.getElementById('current-date-display').innerText = new Date().toLocaleDateString();

    const techData = getChartData('tech');
    const recData = getChartData('recruiter');

    renderChart('chart-recruiter', recData, 'bar'); 
    renderChart('chart-tech', techData, 'doughnut');
}

function getChartData(key) { const counts = {}; state.candidates.forEach(c => counts[c[key]] = (counts[c[key]] || 0) + 1); return { labels: Object.keys(counts), data: Object.values(counts) }; }
let chartInstances = {}; 
function renderChart(id, data, type) { 
    const ctx = document.getElementById(id);
    if(!ctx) return; 
    const context = ctx.getContext('2d');
    if(chartInstances[id]) chartInstances[id].destroy(); 
    const colors = ['#06b6d4', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444', '#ec4899', '#6366f1'];
    chartInstances[id] = new Chart(context, { type: type, data: { labels: data.labels, datasets: [{ label: 'Candidates', data: data.data, backgroundColor: colors, borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1, borderRadius: 4, barThickness: 20 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type === 'doughnut', position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } }, scales: { y: { display: type === 'bar', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }, x: { display: type === 'bar', grid: { display: false }, ticks: { color: '#94a3b8' } } } } }); 
}

// START
document.addEventListener('DOMContentLoaded', init);
