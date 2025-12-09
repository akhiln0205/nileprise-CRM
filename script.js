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

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase Init Error:", e);
}
const db = firebase.firestore();
const auth = firebase.auth();

/* ========================================================
   2. ACCESS CONTROL LIST (WHITELIST)
   ======================================================== */
const ALLOWED_USERS = {
    // EMPLOYEES
    'ali@nileprise.com': { name: 'Asif', role: 'Employee' },
    'mdi@nileprise.com': { name: 'Ikram', role: 'Employee' },
    'mmr@nileprise.com': { name: 'Manikanta', role: 'Employee' },
    'maj@nileprise.com': { name: 'Mazher', role: 'Employee' },
    'msa@nileprise.com': { name: 'Shoeb', role: 'Employee' },
    
    // MANAGERS
    'fma@nileprise.com': { name: 'Fayaz', role: 'Manager' },
    'an@nileprise.com': { name: 'Akhil', role: 'Manager' },
    'aman@nileprise.com': { name: 'Sanketh', role: 'Manager' },
    
    // ADMINS (Add Sravanthi here when mail is available)
    'nikhil@nileprise.com': { name: 'Nikhil Rapolu', role: 'Admin' },
    'admin@nileprise.com': { name: 'Admin', role: 'Admin' }
};

/* ========================================================
   3. STATE MANAGEMENT
   ======================================================== */
const state = {
    user: null,
    userRole: null, // New state for Role
    candidates: [],
    onboarding: [],
    filters: { text: '', recruiter: '', tech: '', status: '' },
    hubFilters: { text: '' },
    pagination: { cand: 1, hub: 1, onb: 1, limit: 10 },
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
    screens: { auth: document.getElementById('auth-screen'), app: document.getElementById('dashboard-screen') },
    navItems: document.querySelectorAll('.nav-item'),
    views: {
        dashboard: document.getElementById('view-dashboard'),
        candidates: document.getElementById('view-candidates'),
        hub: document.getElementById('view-hub'),
        onboarding: document.getElementById('view-onboarding'),
        settings: document.getElementById('view-settings')
    },
    profile: {
        img: document.getElementById('user-avatar'),
        name: document.getElementById('display-username'),
        role: document.getElementById('display-role'),
        profRole: document.getElementById('prof-role-display')
    },
    tables: {
        cand: { body: document.getElementById('table-body'), head: document.getElementById('table-head'), page: document.getElementById('page-info'), ctrls: document.getElementById('pagination-controls') },
        hub: { body: document.getElementById('hub-table-body'), head: document.getElementById('hub-table-head'), page: document.getElementById('hub-page-info'), ctrls: document.getElementById('hub-pagination-controls') },
        onb: { body: document.getElementById('onboarding-table-body'), head: document.getElementById('onboarding-table-head'), page: document.getElementById('onboarding-page-info'), ctrls: document.getElementById('onboarding-pagination-controls') }
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
   5. INITIALIZATION & AUTH (WITH WHITELIST CHECK)
   ======================================================== */
function init() {
    try {
        setupEventListeners();
        renderDropdowns();
        
        auth.onAuthStateChanged(user => {
            if (user) {
                // SECURITY CHECK: Is this user in our ALLOWED_USERS list?
                const email = user.email.toLowerCase();
                if (!ALLOWED_USERS[email]) {
                    // Unauthorized user found! Log them out immediately.
                    auth.signOut();
                    alert("Access Denied: Your email is not authorized for this portal.");
                    switchScreen('auth');
                    return;
                }

                // Authorized
                state.user = user;
                state.userRole = ALLOWED_USERS[email].role;
                updateUserProfile(user, ALLOWED_USERS[email]);
                switchScreen('app');
                initRealtimeListeners();
            } else {
                switchScreen('auth');
            }
        });
    } catch (err) {
        console.error("Init failed:", err);
        alert("Startup Error: " + err.message);
    }
    
    if(localStorage.getItem('np_theme') === 'light') document.body.classList.add('light-mode');
}

function updateUserProfile(user, userData) {
    if(!user) return;
    
    // Use the name from our whitelist, or fallback to Firebase name
    const displayName = userData ? userData.name : (user.displayName || 'User');
    dom.profile.name.innerText = displayName;
    
    // Display Role
    const roleName = userData ? userData.role : 'Staff';
    dom.profile.role.innerText = roleName;
    dom.profile.profRole.innerText = roleName;
    
    if(user.photoURL) {
        dom.profile.img.src = user.photoURL;
        dom.profile.img.style.display = 'block';
        document.getElementById('user-avatar-placeholder').style.display = 'none';
    } else {
        dom.profile.img.style.display = 'none';
        document.getElementById('user-avatar-placeholder').style.display = 'flex';
    }
    
    document.getElementById('prof-email').value = user.email;
    document.getElementById('prof-last-login').value = new Date().toLocaleString();
}

function switchScreen(screenName) {
    dom.screens.auth.classList.toggle('active', screenName === 'auth');
    dom.screens.app.classList.toggle('active', screenName === 'app');
}

/* --- AUTH ACTIONS --- */
window.switchAuth = (target) => {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`form-${target}`).classList.add('active');
};

window.handleLogin = () => {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    
    if(!email || !pass) return showToast("Please fill all fields");

    // Pre-check whitelist before even asking Firebase
    if(!ALLOWED_USERS[email]) {
        return showToast("Access Denied: Email not authorized.");
    }

    auth.signInWithEmailAndPassword(email, pass)
        .catch(err => showToast(cleanError(err.message)));
};

window.handleSignup = () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass').value;
    
    if(!name || !email || !pass) return showToast("All fields are required");
    
    // CRITICAL: WHITELIST CHECK
    if(!ALLOWED_USERS[email]) {
        return showToast("Restricted: You are not on the authorized staff list.");
    }

    if(pass.length < 6) return showToast("Password must be at least 6 chars");

    auth.createUserWithEmailAndPassword(email, pass)
        .then((result) => {
            return result.user.updateProfile({ displayName: name });
        })
        .then(() => {
            showToast("Account Activated!");
        })
        .catch(err => showToast(cleanError(err.message)));
};

window.handleReset = () => {
    const email = document.getElementById('reset-email').value;
    if(!email) return showToast("Please enter your email");

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast("Reset link sent! Check your email.");
            switchAuth('login');
        })
        .catch(err => showToast(cleanError(err.message)));
};

function cleanError(msg) {
    return msg.replace('Firebase: ', '').replace('Error ', '').replace('(auth/', '').replace(').', '').replace(/-/g, ' ').toUpperCase();
}

/* ========================================================
   6. REAL-TIME DATA SYNC
   ======================================================== */
function initRealtimeListeners() {
    db.collection('candidates').onSnapshot(snap => {
        state.candidates = [];
        snap.forEach(doc => state.candidates.push({ id: doc.id, ...doc.data() }));
        refreshAllTables();
        updateDashboardStats();
        document.getElementById('header-updated').innerText = 'Synced';
    }, err => console.error(err));

    db.collection('onboarding').onSnapshot(snap => {
        state.onboarding = [];
        snap.forEach(doc => state.onboarding.push({ id: doc.id, ...doc.data() }));
        renderOnboardingTable();
    });
}

function refreshAllTables() {
    renderCandidateTable();
    renderHubTable();
}

/* ========================================================
   7. RENDER FUNCTIONS
   ======================================================== */

// --- Render Candidates ---
function renderCandidateTable() {
    const { filtered, totalPages } = getFilteredData(state.candidates, state.filters, state.pagination.cand);
    
    const headers = [
        '<input type="checkbox" id="select-all-cand" onclick="toggleSelectAll(\'cand\', this)">', 
        '#', 'First Name', 'Last Name', 'Mobile', 'WhatsApp', 'Tech', 'Recruiter', 'Status', 'Assigned', 'Gmail', 'LinkedIn', 'Resume', 'Track', 'Comments'
    ];
    dom.tables.cand.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    dom.tables.cand.body.innerHTML = filtered.map((c, i) => {
        const idx = (state.pagination.cand - 1) * state.pagination.limit + i + 1;
        const isSel = state.selection.cand.has(c.id) ? 'checked' : '';
        const rowClass = state.selection.cand.has(c.id) ? 'selected-row' : '';
        
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
                <select class="status-select ${c.status.toLowerCase()}" onchange="updateStatus('${c.id}', 'candidates', this.value)">
                    <option value="Active" ${c.status==='Active'?'selected':''}>Active</option>
                    <option value="Inactive" ${c.status==='Inactive'?'selected':''}>Inactive</option>
                </select>
            </td>
            <td>${c.assigned}</td>
            <td>-</td><td>-</td><td>-</td><td>-</td>
            <td onclick="inlineEdit('${c.id}', 'comments', 'candidates', this)">${c.comments || '-'}</td>
        </tr>`;
    }).join('');

    renderPagination(dom.tables.cand, totalPages, 'cand');
}

// --- Render Hub ---
function renderHubTable() {
    const filtered = state.candidates.filter(c => 
        (c.first + ' ' + c.last).toLowerCase().includes(state.hubFilters.text)
    );
    const totalPages = Math.ceil(filtered.length / state.pagination.limit);
    const start = (state.pagination.hub - 1) * state.pagination.limit;
    const pageData = filtered.slice(start, start + state.pagination.limit);

    const headers = ['#', 'Name', 'Tech', 'Submissions', 'Screenings', 'Interviews', 'Last Activity'];
    dom.tables.hub.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    dom.tables.hub.body.innerHTML = pageData.map((c, i) => {
        const idx = start + i + 1;
        const subLen = c.submissionLog ? c.submissionLog.length : 0;
        const scrLen = c.screeningLog ? c.screeningLog.length : 0;
        const intLen = c.interviewLog ? c.interviewLog.length : 0;
        
        let lastAct = '-';
        if(c.interviewLog && c.interviewLog.length) lastAct = c.interviewLog.sort().reverse()[0];

        return `
        <tr>
            <td>${idx}</td>
            <td>${c.first} ${c.last}</td>
            <td>${c.tech}</td>
            <td class="text-cyan" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'submissionLog', '${c.first}')">${subLen}</td>
            <td class="text-cyan" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'screeningLog', '${c.first}')">${scrLen}</td>
            <td class="text-cyan" style="font-weight:bold; cursor:pointer" onclick="openModal('${c.id}', 'interviewLog', '${c.first}')">${intLen}</td>
            <td>${lastAct}</td>
        </tr>`;
    }).join('');

    renderPagination(dom.tables.hub, totalPages, 'hub');
}

// --- Render Onboarding ---
function renderOnboardingTable() {
    const totalPages = Math.ceil(state.onboarding.length / state.pagination.limit);
    const start = (state.pagination.onb - 1) * state.pagination.limit;
    const pageData = state.onboarding.slice(start, start + state.pagination.limit);

    const headers = [
        '<input type="checkbox" id="select-all-onb" onclick="toggleSelectAll(\'onb\', this)">',
        '#', 'First Name', 'Last Name', 'Mobile', 'Status', 'Assigned', 'Comments'
    ];
    dom.tables.onb.head.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    dom.tables.onb.body.innerHTML = pageData.map((c, i) => {
        const idx = start + i + 1;
        const isSel = state.selection.onb.has(c.id) ? 'checked' : '';
        return `
        <tr>
            <td><input type="checkbox" ${isSel} onchange="toggleSelect('${c.id}', 'onb')"></td>
            <td>${idx}</td>
            <td onclick="inlineEdit('${c.id}', 'first', 'onboarding', this)">${c.first}</td>
            <td onclick="inlineEdit('${c.id}', 'last', 'onboarding', this)">${c.last}</td>
            <td onclick="inlineEdit('${c.id}', 'mobile', 'onboarding', this)">${c.mobile}</td>
            <td>
                <select class="status-select ${c.status === 'Onboarding' ? 'active' : 'inactive'}" onchange="updateStatus('${c.id}', 'onboarding', this.value)">
                    <option value="Onboarding" ${c.status==='Onboarding'?'selected':''}>Onboarding</option>
                    <option value="Completed" ${c.status==='Completed'?'selected':''}>Completed</option>
                </select>
            </td>
            <td>${c.assigned}</td>
            <td onclick="inlineEdit('${c.id}', 'comments', 'onboarding', this)">${c.comments || '-'}</td>
        </tr>`;
    }).join('');

    renderPagination(dom.tables.onb, totalPages, 'onb');
}

/* ========================================================
   8. UTILITY FUNCTIONS (Filter, Pagination, Inputs)
   ======================================================== */
function getFilteredData(data, filters, page) {
    const filtered = data.filter(item => {
        const matchesText = (item.first + ' ' + item.last + ' ' + item.tech).toLowerCase().includes(filters.text);
        const matchesRec = filters.recruiter ? item.recruiter === filters.recruiter : true;
        const matchesTech = filters.tech ? item.tech === filters.tech : true;
        const matchesStatus = filters.status ? item.status === filters.status : true;
        return matchesText && matchesRec && matchesTech && matchesStatus;
    });
    
    const start = (page - 1) * state.pagination.limit;
    const paginated = filtered.slice(start, start + state.pagination.limit);
    return { filtered: paginated, totalPages: Math.ceil(filtered.length / state.pagination.limit) };
}

function renderPagination(tableDom, total, type) {
    tableDom.page.innerText = `Page ${state.pagination[type]} of ${total || 1}`;
    let html = '';
    for(let i=1; i<=total; i++) {
        const active = i === state.pagination[type] ? 'active' : '';
        html += `<button class="${active}" onclick="setPage(${i}, '${type}')">${i}</button>`;
    }
    tableDom.ctrls.innerHTML = html;
}

window.setPage = (p, type) => {
    state.pagination[type] = p;
    if(type === 'cand') renderCandidateTable();
    if(type === 'hub') renderHubTable();
    if(type === 'onb') renderOnboardingTable();
}

function inlineEdit(id, field, collection, el) {
    if(el.querySelector('input')) return;
    const val = el.innerText === '-' ? '' : el.innerText;
    el.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'inline-input';
    input.value = val;
    input.focus();
    
    const save = () => {
        const newVal = input.value;
        db.collection(collection).doc(id).update({ [field]: newVal });
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if(e.key === 'Enter') save(); });
    el.appendChild(input);
}

function editRecruiter(id, collection, el) {
    if(el.querySelector('select')) return;
    const val = el.innerText;
    el.innerHTML = '';
    const sel = document.createElement('select');
    sel.className = 'modern-select';
    state.metadata.recruiters.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.text = r;
        if(r === val) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.focus();
    const save = () => db.collection(collection).doc(id).update({ recruiter: sel.value });
    sel.addEventListener('blur', save);
    sel.addEventListener('change', save);
    el.appendChild(sel);
}

window.updateStatus = (id, col, val) => db.collection(col).doc(id).update({ status: val });

window.toggleSelect = (id, type) => {
    if(state.selection[type].has(id)) state.selection[type].delete(id);
    else state.selection[type].add(id);
    
    const btn = type === 'cand' ? document.getElementById('btn-delete-selected') : document.getElementById('btn-delete-onboarding');
    const countSpan = type === 'cand' ? document.getElementById('selected-count') : document.getElementById('onboarding-selected-count');

    if (state.selection[type].size > 0) {
        btn.style.display = 'inline-flex';
        btn.classList.remove('hidden');
        if (countSpan) countSpan.innerText = state.selection[type].size;
    } else {
        btn.style.display = 'none';
    }
    
    if(type === 'cand') renderCandidateTable();
    else renderOnboardingTable();
};

window.toggleSelectAll = (type, mainCheckbox) => {
    const isChecked = mainCheckbox.checked;
    
    let currentData = [];
    if (type === 'cand') {
        const result = getFilteredData(state.candidates, state.filters, state.pagination.cand);
        currentData = result.filtered;
    } else {
        const start = (state.pagination.onb - 1) * state.pagination.limit;
        currentData = state.onboarding.slice(start, start + state.pagination.limit);
    }

    currentData.forEach(item => {
        if (isChecked) state.selection[type].add(item.id);
        else state.selection[type].delete(item.id);
    });

    const btn = type === 'cand' ? document.getElementById('btn-delete-selected') : document.getElementById('btn-delete-onboarding');
    const countSpan = type === 'cand' ? document.getElementById('selected-count') : document.getElementById('onboarding-selected-count');

    if (state.selection[type].size > 0) {
        btn.style.display = 'inline-flex';
        btn.classList.remove('hidden');
        if (countSpan) countSpan.innerText = state.selection[type].size;
    } else {
        btn.style.display = 'none';
    }

    if (type === 'cand') renderCandidateTable();
    else renderOnboardingTable();
    
    setTimeout(() => {
        const newMaster = document.getElementById(type === 'cand' ? 'select-all-cand' : 'select-all-onb');
        if(newMaster) newMaster.checked = isChecked;
    }, 0);
};

/* ========================================================
   9. EVENT LISTENERS
   ======================================================== */
function setupEventListeners() {
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', () => auth.signOut());

    dom.navItems.forEach(btn => {
        btn.addEventListener('click', e => {
            dom.navItems.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            Object.values(dom.views).forEach(v => v.classList.remove('active'));
            
            const target = e.currentTarget.dataset.target;
            if(document.getElementById(target)) {
                document.getElementById(target).classList.add('active');
                if(target === 'view-dashboard') updateDashboardStats();
            }
        });
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('np_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });

    document.getElementById('search-input').addEventListener('input', e => { state.filters.text = e.target.value.toLowerCase(); state.pagination.cand = 1; renderCandidateTable(); });
    document.getElementById('hub-search-input').addEventListener('input', e => { state.hubFilters.text = e.target.value.toLowerCase(); state.pagination.hub = 1; renderHubTable(); });
    
    const recFilter = document.getElementById('filter-recruiter');
    recFilter.addEventListener('change', e => { state.filters.recruiter = e.target.value; renderCandidateTable(); });
    const techFilter = document.getElementById('filter-tech');
    techFilter.addEventListener('change', e => { state.filters.tech = e.target.value; renderCandidateTable(); });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.filters.status = e.target.dataset.status;
            renderCandidateTable();
        });
    });

    document.getElementById('btn-add-candidate').addEventListener('click', () => {
        openAddModal();
    });
    
    document.getElementById('btn-add-onboarding').addEventListener('click', () => {
        db.collection('onboarding').add({
            first: 'New', last: 'User', mobile: '', status: 'Onboarding',
            assigned: new Date().toISOString().split('T')[0], comments: ''
        });
    });

    document.getElementById('btn-delete-selected').addEventListener('click', () => {
        openDeleteModal('cand');
    });
    document.getElementById('btn-delete-onboarding').addEventListener('click', () => {
        openDeleteModal('onb');
    });
}

function renderDropdowns() {
    const rSelect = document.getElementById('filter-recruiter');
    if(rSelect) rSelect.innerHTML = `<option value="">All Recruiters</option>` + state.metadata.recruiters.map(r => `<option value="${r}">${r}</option>`).join('');
    
    const tSelect = document.getElementById('filter-tech');
    if(tSelect) tSelect.innerHTML = `<option value="">All Tech</option>` + state.metadata.techs.map(t => `<option value="${t}">${t}</option>`).join('');
}

/* ========================================================
   10. MODAL LOGIC (ACTIVITY)
   ======================================================== */
window.openModal = (id, type, name) => {
    state.modal.id = id;
    state.modal.type = type;
    dom.modal.self.style.display = 'flex';
    dom.modal.title.innerText = `${name} - ${type.replace('Log','').toUpperCase()}`;
    dom.modal.input.value = new Date().toISOString().split('T')[0];
    renderModalContent();
};

window.closeActivityModal = () => { dom.modal.self.style.display = 'none'; };

window.saveActivityLog = () => {
    const date = dom.modal.input.value;
    if(!date) return;
    const c = state.candidates.find(x => x.id === state.modal.id);
    let logs = c[state.modal.type] || [];
    logs.push(date);
    logs.sort().reverse();
    db.collection('candidates').doc(state.modal.id).update({ [state.modal.type]: logs });
    renderModalContent();
    showToast("Activity Logged");
};

function renderModalContent() {
    const c = state.candidates.find(x => x.id === state.modal.id);
    if(!c) return;
    const logs = c[state.modal.type] || [];
    
    const now = new Date();
    let week = 0, month = 0;
    logs.forEach(dStr => {
        const d = new Date(dStr);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        if(diff <= 7) week++;
        if(d.getMonth() === now.getMonth()) month++;
    });

    dom.modal.week.innerText = week;
    dom.modal.month.innerText = month;
    dom.modal.total.innerText = logs.length;
    dom.modal.list.innerHTML = logs.map(d => `<li>${d}</li>`).join('');
}

/* ========================================================
   11. MODAL LOGIC (ADD CANDIDATE VALIDATION)
   ======================================================== */
window.openAddModal = () => {
    const techSel = document.getElementById('add-tech');
    const recSel = document.getElementById('add-recruiter');
    
    techSel.innerHTML = state.metadata.techs.map(t => `<option value="${t}">${t}</option>`).join('');
    recSel.innerHTML = state.metadata.recruiters.map(r => `<option value="${r}">${r}</option>`).join('');
    
    ['add-first', 'add-last', 'add-mobile', 'add-wa'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('add-modal').style.display = 'flex';
};

window.closeAddModal = () => {
    document.getElementById('add-modal').style.display = 'none';
};

window.validateAndSaveCandidate = () => {
    const first = document.getElementById('add-first').value.trim();
    const last = document.getElementById('add-last').value.trim();
    const mobile = document.getElementById('add-mobile').value.trim();
    const wa = document.getElementById('add-wa').value.trim();
    const tech = document.getElementById('add-tech').value;
    const recruiter = document.getElementById('add-recruiter').value;

    const errors = [];
    if (!first || !last) errors.push("First and Last name are required.");
    const phoneRegex = /^[0-9]{10,}$/; 
    if (!phoneRegex.test(mobile)) errors.push("Mobile number must be at least 10 digits.");

    if (errors.length > 0) {
        showToast("⚠️ " + errors[0]);
        return;
    }

    db.collection('candidates').add({
        first, last, mobile, wa, tech, recruiter,
        status: 'Active',
        assigned: new Date().toISOString().split('T')[0],
        comments: '',
        submissionLog: [], screeningLog: [], interviewLog: []
    }).then(() => {
        showToast("Candidate Added Successfully");
        closeAddModal();
    }).catch(err => {
        console.error(err);
        showToast("Error adding candidate");
    });
};

/* ========================================================
   12. DELETE MODAL LOGIC
   ======================================================== */
window.openDeleteModal = (type) => {
    const count = state.selection[type].size;
    if (count === 0) return;

    state.pendingDelete.type = type;
    document.getElementById('del-count').innerText = count;
    document.getElementById('delete-modal').style.display = 'flex';
};

window.closeDeleteModal = () => {
    document.getElementById('delete-modal').style.display = 'none';
    state.pendingDelete.type = null;
};

window.executeDelete = () => {
    const type = state.pendingDelete.type;
    if (!type) return;

    const collection = type === 'cand' ? 'candidates' : 'onboarding';
    
    state.selection[type].forEach(id => {
        db.collection(collection).doc(id).delete().catch(err => console.error(err));
    });

    state.selection[type].clear();
    
    if (type === 'cand') {
        renderCandidateTable();
        document.getElementById('btn-delete-selected').style.display = 'none';
        document.getElementById('selected-count').innerText = '0';
    } else {
        renderOnboardingTable();
        document.getElementById('btn-delete-onboarding').style.display = 'none';
        document.getElementById('onboarding-selected-count').innerText = '0';
    }

    showToast("Items Deleted Successfully");
    closeDeleteModal();
};

/* ========================================================
   13. EXPORT DATA
   ======================================================== */
window.exportData = () => {
    if (state.candidates.length === 0) {
        showToast("No data to export");
        return;
    }

    const headers = ["ID", "First Name", "Last Name", "Mobile", "Tech", "Recruiter", "Status", "Assigned Date", "Comments"];
    const csvRows = [];
    csvRows.push(headers.join(","));

    state.candidates.forEach(c => {
        const row = [
            c.id, `"${c.first}"`, `"${c.last}"`, `"${c.mobile}"`, `"${c.tech}"`,
            `"${c.recruiter}"`, `"${c.status}"`, c.assigned,
            `"${(c.comments || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", "nileprise_candidates.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Data Exported Successfully");
};

/* ========================================================
   14. CHARTS & TOAST
   ======================================================== */
function updateDashboardStats() {
    document.getElementById('stat-total').innerText = state.candidates.length;
    document.getElementById('stat-tech').innerText = new Set(state.candidates.map(c=>c.tech)).size;
    document.getElementById('stat-rec').innerText = state.metadata.recruiters.length;
    
    renderChart('chart-tech', getChartData('tech'));
    renderChart('chart-recruiter', getChartData('recruiter'));
}

function getChartData(key) {
    const counts = {};
    state.candidates.forEach(c => counts[c[key]] = (counts[c[key]] || 0) + 1);
    return { labels: Object.keys(counts), data: Object.values(counts) };
}

let chartInstances = {};
function renderChart(id, data) {
    const ctx = document.getElementById(id).getContext('2d');
    if(chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: ['#06b6d4', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444', '#ec4899', '#6366f1'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } } }
    });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// Start
init();
