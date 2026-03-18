// Firebase SDKs (Modular Version 10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// AAPKA FIREBASE CONFIG (Updated)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyALijpIAbmjIuqFYfCxvOZOk0Nm54OVk_c",
    authDomain: "settleup-b67de.firebaseapp.com",
    projectId: "settleup-b67de",
    storageBucket: "settleup-b67de.firebasestorage.app",
    messagingSenderId: "278043179077",
    appId: "1:278043179077:web:6c71b5bd11f840e8984b2c",
};

// Initialize Firebase
let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully!");
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("Firebase load nahi ho paya. Kripya Live Server use karein ya internet connection check karein.");
}

document.addEventListener('DOMContentLoaded', () => {
    
    // --- AUTH STATE ---
    let currentUser = localStorage.getItem('settleUpUser');
    let appState = { groups: [] };
    
    // --- STATE MANAGEMENT ---
    let tempMembers = [];
    let currentGroupIndex = null;
    let selectedGroupType = 'Trip';
    let selectedCategory = 'General';
    let selectedPayer = currentUser;

    // Chart Instances
    let dashboardPieInstance = null;
    let analyticsCategoryInstance = null; 
    let analyticsMemberInstance = null;   
    let analyticsTrendInstance = null;    

    // Elements
    const authModal = document.getElementById('auth-modal');
    const gModal = document.getElementById('group-modal');
    const tModal = document.getElementById('tx-modal');
    const sModal = document.getElementById('settle-modal');
    const jModal = document.getElementById('join-modal');

    // --- TOAST NOTIFICATION SYSTEM ---
    window.showToast = function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ph-info';
        if(type === 'success') icon = 'ph-check-circle';
        if(type === 'error') icon = 'ph-warning-circle';

        toast.innerHTML = `<i class="ph ${icon}" style="font-size: 1.2rem;"></i> ${message}`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function toggleBtnLoading(btnId, isLoading) {
        const btn = document.getElementById(btnId);
        const icon = btn.querySelector('.spin-icon');
        if(isLoading) { btn.disabled = true; if(icon) icon.style.display = 'inline-block'; } 
        else { btn.disabled = false; if(icon) icon.style.display = 'none'; }
    }

    // --- AUTHENTICATION FLOW ---
    if (!currentUser) {
        authModal.style.display = 'flex';
    } else {
        authModal.style.display = 'none';
        initApp();
    }

    document.getElementById('auth-login-btn').onclick = () => {
        const nameInput = document.getElementById('auth-user-name').value.trim();
        if (nameInput.length < 2) {
            return showToast("Please enter a valid name (min 2 characters)!", "error");
        }
        currentUser = nameInput;
        localStorage.setItem('settleUpUser', currentUser);
        selectedPayer = currentUser;
        authModal.style.display = 'none';
        showToast(`Welcome, ${currentUser}!`, "success");
        initApp();
    };

    // Enter key dabane par bhi login ho jaye
    document.getElementById('auth-user-name').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('auth-login-btn').click();
        }
    });

    document.getElementById('logout-btn').onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('settleUpUser');
        window.location.reload();
    };

    // --- INITIALIZATION ---
    function initApp() {
        if(!db) {
            showToast("Database not connected! Please check console.", "error");
            return;
        }
        updateGreeting();
        listenToMyGroups(); 
    }

    // 🟢 FIREBASE: REAL-TIME DATA FETCHING
    function listenToMyGroups() {
        const q = query(collection(db, "groups"), where("memberNames", "array-contains", currentUser));
        
        onSnapshot(q, (snapshot) => {
            appState.groups = [];
            snapshot.forEach((doc) => {
                appState.groups.push({ firebaseId: doc.id, ...doc.data() });
            });
            refreshActiveView();
            updateKPIs();
        }, (error) => {
            console.error("Error fetching groups:", error);
            showToast("Failed to sync with database", "error");
        });
    }

    function updateGreeting() {
        const hour = new Date().getHours();
        const el = document.getElementById('greeting-text');
        if (hour < 12) el.innerText = `Good Morning, ${currentUser}!`;
        else if (hour < 18) el.innerText = `Good Afternoon, ${currentUser}!`;
        else el.innerText = `Good Evening, ${currentUser}!`;
        
        const dateEl = document.getElementById('date-text');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.innerText = new Date().toLocaleDateString('en-US', options);
    }

    function formatDateTime(isoString) {
        if(!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    }

    function generateJoinCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    // --- NAVIGATION ---
    window.switchView = (viewName) => {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

        if (viewName === 'overview') {
            document.getElementById('nav-overview').classList.add('active');
            document.getElementById('view-overview').classList.add('active');
            renderGroups('overview'); renderRecentActivity(); renderDashboardPie();
        } else if (viewName === 'groups') {
            document.getElementById('nav-groups').classList.add('active');
            document.getElementById('view-groups').classList.add('active');
            renderGroups('groups');
        } else if (viewName === 'spend') {
            document.getElementById('nav-spend').classList.add('active');
            document.getElementById('view-spend').classList.add('active');
            renderGroupSpendReport();
        } else if (viewName === 'settlement') {
            document.getElementById('nav-settle').classList.add('active');
            document.getElementById('view-settlement').classList.add('active');
            renderSettlementView();
        } else if (viewName === 'charts') {
            document.getElementById('nav-charts').classList.add('active');
            document.getElementById('view-charts').classList.add('active');
            updateChartSelect();
        }
    };

    // --- SEARCH ---
    document.getElementById('group-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = appState.groups.filter(g => g.name.toLowerCase().includes(term));
        renderGroups('overview', filtered);
    });

    // --- MODALS ---
    document.getElementById('open-group-modal').onclick = () => { gModal.style.display = 'flex'; resetGroupModal(); };
    document.getElementById('open-join-modal').onclick = () => { jModal.style.display = 'flex'; document.getElementById('join-group-code').value = ''; };

    document.querySelectorAll('.close-btn, .modal-overlay').forEach(el => {
        el.onclick = (e) => {
            if(e.target === el || e.target.classList.contains('close-btn')) {
                if(el.id !== 'auth-modal' && !el.closest('#auth-modal')) {
                    gModal.style.display = 'none'; tModal.style.display = 'none'; sModal.style.display = 'none'; jModal.style.display = 'none';
                }
            }
        };
    });

    // 🟢 FIREBASE: JOIN GROUP LOGIC
    document.getElementById('final-join-group').onclick = async () => {
        const code = document.getElementById('join-group-code').value.trim().toUpperCase();
        if(code.length !== 5 || !/^[A-Z]{5}$/.test(code)) return showToast("Enter a valid 5-letter code.", "error");
        
        toggleBtnLoading('final-join-group', true);
        try {
            const q = query(collection(db, "groups"), where("joinCode", "==", code));
            const querySnapshot = await getDocs(q);
            
            if(querySnapshot.empty) {
                showToast("No group found with this code!", "error");
            } else {
                const groupDoc = querySnapshot.docs[0];
                const data = groupDoc.data();

                if(data.memberNames.includes(currentUser)) {
                    showToast(`You are already a member of "${data.name}"!`, "info");
                } else {
                    const updatedMembers = [...data.members, { name: currentUser, balance: 0, paid: 0 }];
                    const updatedMemberNames = [...data.memberNames, currentUser];

                    await updateDoc(doc(db, "groups", groupDoc.id), {
                        members: updatedMembers,
                        memberNames: updatedMemberNames
                    });
                    showToast(`Successfully joined "${data.name}"!`, "success");
                }
                jModal.style.display = 'none';
            }
        } catch (error) {
            console.error("Join Error:", error);
            showToast("Error joining group. Check Console.", "error");
        } finally {
            toggleBtnLoading('final-join-group', false);
        }
    };

    // --- CREATE GROUP ---
    document.querySelectorAll('#group-type-selector .cat-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('#group-type-selector .cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active'); selectedGroupType = chip.getAttribute('data-type');
        };
    });

    document.getElementById('add-member-btn').onclick = () => {
        const input = document.getElementById('member-name');
        const name = input.value.trim();
        if (name && !tempMembers.includes(name) && name !== currentUser) { tempMembers.push(name); renderTempMembers(); input.value = ''; }
    };

    function renderTempMembers() {
        const container = document.getElementById('member-chips-container');
        let html = `<span class="tag admin">${currentUser} (You)</span>`;
        tempMembers.forEach(m => { html += `<span class="tag">${m}</span>`; });
        container.innerHTML = html;
    }

    function resetGroupModal() {
        document.getElementById('group-name').value = ''; tempMembers = []; renderTempMembers(); selectedGroupType = 'Trip';
    }

    // 🟢 FIREBASE: CREATE GROUP
    document.getElementById('final-create-group').onclick = async () => {
        const name = document.getElementById('group-name').value;
        if (!name) return showToast("Enter group name", "error");

        toggleBtnLoading('final-create-group', true);
        
        const groupData = {
            name: name,
            type: selectedGroupType,
            members: [{name: currentUser, balance: 0, paid: 0}, ...tempMembers.map(m => ({name: m, balance: 0, paid: 0}))],
            memberNames: [currentUser, ...tempMembers],
            transactions: [],
            totalSpend: 0,
            createdAt: new Date().toISOString(),
            joinCode: generateJoinCode()
        };

        try {
            await addDoc(collection(db, "groups"), groupData);
            gModal.style.display = 'none';
            showToast("Group created successfully!", "success");
        } catch (error) {
            console.error("Create Error:", error);
            showToast("Failed to create group", "error");
        } finally {
            toggleBtnLoading('final-create-group', false);
        }
    };

    // --- TRANSACTIONS ---
    document.querySelectorAll('#expense-category-selector .cat-chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('#expense-category-selector .cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active'); selectedCategory = chip.getAttribute('data-cat');
        };
    });

    document.getElementById('tx-amt').addEventListener('input', (e) => {
        const amt = parseFloat(e.target.value);
        const group = appState.groups[currentGroupIndex];
        const preview = document.getElementById('split-preview');
        if (amt > 0 && group) {
            const perPerson = (amt / group.members.length).toFixed(0);
            preview.innerHTML = `<i class="ph ph-check-circle"></i> ₹${perPerson} / person`;
        } else preview.innerHTML = `<i class="ph ph-info"></i> Split equally`;
    });

    window.openTxModal = (idx) => {
        currentGroupIndex = idx;
        const group = appState.groups[idx];
        document.getElementById('tx-name').value = '';
        document.getElementById('tx-amt').value = '';
        document.getElementById('split-preview').innerHTML = `<i class="ph ph-info"></i> Split equally`;
        
        const container = document.getElementById('payer-list-container');
        container.innerHTML = group.members.map(m => `
            <div class="payer-item ${m.name === currentUser ? 'active' : ''}" onclick="selectPayer(this, '${m.name}')">
                <div class="p-av">${m.name.charAt(0).toUpperCase()}</div><span>${m.name === currentUser ? 'You' : m.name}</span>
            </div>`).join('');
        selectedPayer = currentUser;
        tModal.style.display = 'flex';
    };

    window.selectPayer = (el, name) => {
        document.querySelectorAll('.payer-item').forEach(c => c.classList.remove('active'));
        el.classList.add('active'); selectedPayer = name;
    };

    // 🟢 FIREBASE: ADD EXPENSE
    document.getElementById('final-add-tx').onclick = async () => {
        const amt = parseFloat(document.getElementById('tx-amt').value);
        if (!amt) return showToast("Enter amount", "error");
        
        toggleBtnLoading('final-add-tx', true);

        const group = appState.groups[currentGroupIndex];
        const share = amt / group.members.length;
        
        let newTotalSpend = group.totalSpend + amt;
        let newTx = {
            category: selectedCategory, 
            amount: amt, 
            payer: selectedPayer, 
            desc: document.getElementById('tx-name').value, 
            date: new Date().toISOString(),
            groupName: group.name
        };

        let updatedMembers = group.members.map(m => {
            let tempM = {...m};
            if (tempM.name === selectedPayer) { tempM.balance += (amt - share); tempM.paid += amt; }
            else { tempM.balance -= share; }
            return tempM;
        });

        let updatedTransactions = [...group.transactions, newTx];

        try {
            await updateDoc(doc(db, "groups", group.firebaseId), {
                totalSpend: newTotalSpend,
                members: updatedMembers,
                transactions: updatedTransactions
            });
            tModal.style.display = 'none';
            showToast("Expense added successfully!", "success");
        } catch(error) {
            console.error("Tx Error:", error);
            showToast("Failed to add expense", "error");
        } finally {
            toggleBtnLoading('final-add-tx', false);
        }
    };

    // --- DASHBOARD: ACTIVITY & PIE CHART ---
    function renderRecentActivity() {
        const container = document.getElementById('recent-activity-list');
        let allTx = [];
        
        appState.groups.forEach(g => {
            g.transactions.forEach(tx => {
                allTx.push({...tx, groupName: g.name});
            });
        });
        allTx.sort((a,b) => new Date(b.date) - new Date(a.date));
        const recent = allTx.slice(0, 10);

        if(recent.length === 0) {
            container.innerHTML = `<div class="empty-state-small">No activity yet.</div>`;
            return;
        }

        container.innerHTML = recent.map(tx => `
            <div class="feed-item">
                <div class="feed-icon"><i class="ph ${getCatIcon(tx.category)}"></i></div>
                <div class="feed-info">
                    <h4>${tx.desc || (tx.category === 'Settlement' ? 'Debt Cleared' : 'Expense')}</h4>
                    <p>${tx.payer === currentUser ? 'You' : tx.payer} in <b>${tx.groupName}</b></p>
                    <div class="feed-date">${formatDateTime(tx.date)}</div>
                </div>
                <div class="feed-amt">₹${tx.amount}</div>
            </div>
        `).join('');
    }

    function renderDashboardPie() {
        const ctx = document.getElementById('dashboardPieChart').getContext('2d');
        if(dashboardPieInstance) dashboardPieInstance.destroy();

        let catMap = { 'General': 0, 'Food': 0, 'Travel': 0, 'Fun': 0 };

        appState.groups.forEach(g => {
            g.transactions.forEach(tx => {
                if(tx.category !== 'Settlement') {
                    if (catMap[tx.category] !== undefined) catMap[tx.category] += tx.amount;
                    else catMap[tx.category] = tx.amount;
                }
            });
        });

        let dataValues = Object.values(catMap);
        let isEmpty = dataValues.every(val => val === 0);
        if(isEmpty) dataValues = [1, 0, 0, 0]; 

        dashboardPieInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{
                    data: isEmpty ? [1] : dataValues,
                    backgroundColor: isEmpty ? ['#e2e8f0'] : ['#94a3b8', '#f59e0b', '#3b82f6', '#ec4899'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }, tooltip: { enabled: !isEmpty } }
            }
        });
    }

    // 🟢 FIREBASE: SETTLEMENT LOGIC
    window.processSettlement = async (groupIdx, fromName, toName, amount) => {
        if(!confirm(`Confirm settlement: ${fromName} pays ${toName} ₹${amount.toFixed(0)}?`)) return;

        const group = appState.groups[groupIdx];
        
        let updatedMembers = group.members.map(m => {
            let tempM = {...m};
            if(tempM.name === fromName) tempM.balance += amount;
            if(tempM.name === toName) tempM.balance -= amount;
            return tempM;
        });

        let newTx = {
            category: 'Settlement',
            desc: `Paid to ${toName}`,
            amount: amount,
            payer: fromName,
            groupName: group.name,
            date: new Date().toISOString()
        };

        try {
            await updateDoc(doc(db, "groups", group.firebaseId), {
                members: updatedMembers,
                transactions: [...group.transactions, newTx]
            });
            showToast("Settlement recorded!", "success");
        } catch(e) {
            console.error(e);
            showToast("Failed to record settlement", "error");
        }
    };

    function renderSettlementView() {
        const container = document.getElementById('settlement-container');

        if (appState.groups.length === 0) {
            container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gray);">No groups available for settlement.</p>`;
            return;
        }

        container.innerHTML = appState.groups.map((group, idx) => {
            let debts = [];
            let debtors = [];
            let creditors = [];
            let simMembers = JSON.parse(JSON.stringify(group.members));
            
            simMembers.forEach(m => {
                if(m.balance < -0.1) debtors.push(m);
                if(m.balance > 0.1) creditors.push(m);
            });

            while(debtors.length > 0 && creditors.length > 0) {
                debtors.sort((a,b) => a.balance - b.balance);
                creditors.sort((a,b) => b.balance - a.balance);

                let d = debtors[0];
                let c = creditors[0];
                let amount = Math.min(Math.abs(d.balance), c.balance);

                debts.push({ from: d.name, to: c.name, amount: amount });

                d.balance += amount;
                c.balance -= amount;

                if(Math.abs(d.balance) < 0.1) debtors.shift();
                if(c.balance < 0.1) creditors.shift();
            }

            if(debts.length === 0) {
                return `
                <div class="settle-card">
                    <div class="settle-header">
                        <h3>${group.name}</h3>
                        <span class="settle-status" style="background:#dcfce7; color:#166534;">Settled</span>
                    </div>
                    <div style="text-align:center; padding:20px; color:var(--gray); font-size:0.9rem;">
                        <i class="ph ph-check-circle" style="font-size:1.5rem; margin-bottom:5px;"></i><br>
                        All settled!
                    </div>
                </div>`;
            }

            const debtListHtml = debts.map(d => `
                <div class="transfer-row">
                    <div class="t-details">
                        <div class="t-person"><div class="t-avatar">${d.from.charAt(0).toUpperCase()}</div><span>${d.from === currentUser ? 'You' : d.from}</span></div>
                        <div class="t-arrow"><i class="ph ph-arrow-right"></i></div>
                        <div class="t-person"><div class="t-avatar" style="background:var(--primary); color:white; border:none;">${d.to.charAt(0).toUpperCase()}</div><span>${d.to === currentUser ? 'You' : d.to}</span></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="t-amt">₹${d.amount.toFixed(0)}</div>
                        <button class="btn-settle-action" onclick="processSettlement(${idx}, '${d.from}', '${d.to}', ${d.amount})"><i class="ph-bold ph-check"></i></button>
                    </div>
                </div>
            `).join('');

            return `<div class="settle-card"><div class="settle-header"><h3>${group.name}</h3><span class="settle-status pending">Pending</span></div><div class="transfer-list">${debtListHtml}</div></div>`;
        }).join('');
    }

    function getCatIcon(cat) {
        if(cat === 'Food') return 'ph-pizza';
        if(cat === 'Travel') return 'ph-taxi';
        if(cat === 'Fun') return 'ph-popcorn';
        if(cat === 'Settlement') return 'ph-hand-shake';
        return 'ph-receipt';
    }

    // --- ANALYTICS ---
    function updateChartSelect() {
        const select = document.getElementById('chart-group-select');
        select.innerHTML = '<option value="">Select a Group</option>';
        
        appState.groups.forEach((g, idx) => { 
            select.innerHTML += `<option value="${idx}">${g.name}</option>`; 
        });
        
        select.onchange = (e) => {
            const idx = e.target.value;
            if(idx !== "") {
                document.getElementById('charts-empty-state').style.display = 'none';
                document.getElementById('charts-content').style.display = 'block';
                renderChartUI(appState.groups[idx]);
            } else {
                document.getElementById('charts-empty-state').style.display = 'block';
                document.getElementById('charts-content').style.display = 'none';
            }
        };
    }

    function renderChartUI(group) {
        let sortedMembers = [...group.members].sort((a,b) => b.paid - a.paid);
        let topSpender = sortedMembers[0].paid > 0 ? (sortedMembers[0].name === currentUser ? 'You' : sortedMembers[0].name) : "None";
        let catMap = { 'General': 0, 'Food': 0, 'Travel': 0, 'Fun': 0 };
        let totalTxns = 0;
        let dateMap = {}; 

        group.transactions.forEach(tx => {
            if(tx.category !== 'Settlement') {
                catMap[tx.category] += tx.amount;
                totalTxns++;
                const dateKey = new Date(tx.date).toLocaleDateString();
                if(!dateMap[dateKey]) dateMap[dateKey] = 0;
                dateMap[dateKey] += tx.amount;
            }
        });

        let topCat = Object.keys(catMap).reduce((a, b) => catMap[a] > catMap[b] ? a : b);
        if(catMap[topCat] === 0) topCat = "None";

        document.getElementById('stat-top-spender').innerText = topSpender;
        document.getElementById('stat-top-cat').innerText = topCat;
        document.getElementById('stat-tx-count').innerText = totalTxns;

        if(analyticsCategoryInstance) analyticsCategoryInstance.destroy();
        if(analyticsMemberInstance) analyticsMemberInstance.destroy();
        if(analyticsTrendInstance) analyticsTrendInstance.destroy();

        analyticsCategoryInstance = new Chart(document.getElementById('analyticsCategoryChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(catMap),
                datasets: [{
                    data: Object.values(catMap),
                    backgroundColor: ['#94a3b8', '#f59e0b', '#3b82f6', '#ec4899'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
        });

        analyticsMemberInstance = new Chart(document.getElementById('analyticsMemberChart'), {
            type: 'bar',
            data: {
                labels: sortedMembers.map(m => m.name === currentUser ? 'You' : m.name),
                datasets: [{
                    label: 'Paid Amount (₹)',
                    data: sortedMembers.map(m=>m.paid),
                    backgroundColor: '#22c55e',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: {display:false} }, x: { grid: {display:false} } },
                plugins: { legend: { display: false } }
            }
        });

        let trendLabels = Object.keys(dateMap);
        let trendData = Object.values(dateMap);
        if(trendLabels.length === 0) { trendLabels = ["Start"]; trendData = [0]; }

        analyticsTrendInstance = new Chart(document.getElementById('analyticsTrendChart'), {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Daily Spending',
                    data: trendData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#8b5cf6',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true }, x: { grid: {display:false} } }
            }
        });
    }

    window.openSettleModal = (idx) => {
        const group = appState.groups[idx];
        const body = document.getElementById('settle-body');
        let html = '';
        group.members.forEach(m => {
            const val = Math.abs(m.balance);
            const color = m.balance >= 0 ? '#22c55e' : '#ef4444';
            const nameToDisplay = m.name === currentUser ? 'You' : m.name;
            const textToDisplay = m.name === currentUser 
                ? (m.balance >= 0 ? 'Get back' : 'Owe') 
                : (m.balance >= 0 ? 'Gets back' : 'Owes');
            
            html += `<div class="settle-row"><div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;height:28px;background:${color}20;color:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;">${m.name.charAt(0).toUpperCase()}</div><b>${nameToDisplay}</b></div><span style="color:${color};font-weight:600;">${textToDisplay} ₹${val.toFixed(0)}</span></div>`;
        });
        body.innerHTML = html || '<p style="text-align:center;color:var(--gray);">No debts yet!</p>';
        sModal.style.display = 'flex';
    };

    function refreshActiveView() {
        const activeView = document.querySelector('.view-section.active')?.id || 'view-overview';
        if(activeView === 'view-spend') renderGroupSpendReport();
        else if(activeView === 'view-settlement') renderSettlementView();
        else if(activeView === 'view-charts') updateChartSelect();
        else { renderGroups('overview'); renderRecentActivity(); renderDashboardPie(); }
    }

    function renderGroups(viewMode, overrideData = null) {
        const container = viewMode === 'overview' ? document.getElementById('groups-container-overview') : document.getElementById('groups-container-all');
        
        let dataToRender = overrideData || appState.groups;
        
        if(dataToRender.length === 0) { container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray);background:white;border-radius:16px;border:1px dashed var(--border);">No groups found. Create or Join one!</div>`; return; }
        
        container.innerHTML = dataToRender.map((g, idx) => {
            return `
            <div class="group-card">
                <div style="display:flex;justify-content:space-between;">
                    <div style="display:flex;gap:10px;">
                        <div style="width:38px;height:38px;background:var(--light-gray);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--dark);"><i class="ph ${getIcon(g.type)}"></i></div>
                        <div>
                            <h4 style="font-weight:700;">${g.name}</h4>
                            <small style="color:var(--gray);font-size:0.75rem;">Created: ${formatDateTime(g.createdAt)}</small>
                            <br><span class="join-code-badge"><i class="ph ph-link"></i> Code: ${g.joinCode || 'N/A'}</span>
                        </div>
                    </div>
                    <h4 style="color:var(--primary);">₹${g.totalSpend}</h4>
                </div>
                <div style="margin-top:15px;display:flex;gap:8px;"><button class="btn-primary" style="flex:1;justify-content:center;padding:8px;font-size:0.8rem;" onclick="openTxModal(${idx})">+ Bill</button><button style="flex:1;background:white;border:1px solid var(--border);padding:8px;border-radius:10px;cursor:pointer;font-weight:600;font-size:0.8rem;color:var(--gray);" onclick="openSettleModal(${idx})">Settle</button></div>
            </div>`;
        }).join('');
    }

    function renderGroupSpendReport() {
        const container = document.getElementById('spend-groups-container');
        let totalExpenseForUser = 0;

        if(appState.groups.length === 0) { 
            container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gray);">No groups.</p>`; 
            document.getElementById('report-total-global').innerText = `₹0`;
            return; 
        }

        container.innerHTML = appState.groups.map(group => {
            totalExpenseForUser += group.totalSpend;
            const sortedMembers = [...group.members].sort((a,b) => b.paid - a.paid);
            const maxVal = sortedMembers[0].paid || 1; 
            
            const listHtml = sortedMembers.map((m, idx) => {
                const percent = (m.paid / maxVal) * 100;
                return `<div class="gs-item"><div class="gs-avatar">${m.name.charAt(0).toUpperCase()}</div><div class="gs-bar-wrap"><div class="gs-meta"><span>${m.name === currentUser ? 'You' : m.name} ${idx === 0 && m.paid > 0 ? '<span class="top-badge">Top</span>' : ''}</span><span>₹${m.paid}</span></div><div class="gs-bar-bg"><div class="gs-bar-fill" style="width: ${percent}%"></div></div></div></div>`;
            }).join('');
            
            return `<div class="gs-card"><div class="gs-header"><div><h3>${group.name}</h3><span class="gs-subtitle">Created: ${formatDateTime(group.createdAt)}</span></div><div class="gs-total">₹${group.totalSpend}</div></div><div class="gs-list">${listHtml}</div></div>`;
        }).join('');

        document.getElementById('report-total-global').innerText = `₹${totalExpenseForUser}`;
    }

    function getIcon(type) {
        if(type === 'Trip') return 'ph-airplane-tilt'; if(type === 'Home') return 'ph-house-line'; if(type === 'Couple') return 'ph-heart'; return 'ph-dots-three-circle';
    }

    function updateKPIs() {
        let owed = 0; 
        let myTotalSpend = 0;
        let myActivity = 0;
        
        appState.groups.forEach(g => { 
            const me = g.members.find(m => m.name === currentUser); 
            if(me) {
                if(me.balance > 0) owed += me.balance;
                else if(me.balance < 0) owed += me.balance;
            }
            myTotalSpend += g.totalSpend;
            myActivity += g.transactions.length;
        });
        
        document.getElementById('box-grp').innerText = appState.groups.length; 
        document.getElementById('box-exp').innerText = `₹${myTotalSpend}`; 
        
        const owedBox = document.getElementById('box-owed');
        if(owed >= 0) {
            owedBox.innerText = `₹${Math.round(owed)}`;
            document.getElementById('side-net-balance').innerText = `₹${Math.round(owed)}`;
        } else {
            owedBox.innerText = `-₹${Math.round(Math.abs(owed))}`;
            document.getElementById('side-net-balance').innerText = `-₹${Math.round(Math.abs(owed))}`;
        }
        
        document.getElementById('box-act').innerText = myActivity; 
    }
});