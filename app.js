
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = localStorage.getItem('ph_u');
let uData = null;
let curLbPage = 1, curOnPage = 1, curAdmPage = 1;

// --- 1. THEMES & BACKGROUNDS ---
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#00CED1','#ADFF2F','#FF4500','#1E90FF','#DA70D6','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")','url("https://www.transparenttextures.com/patterns/dark-brick-wall.png")'];
function changeVibe() {
    const el = document.getElementById('bg-layer');
    const p = themes[Math.floor(Math.random()*themes.length)];
    if(p.includes('url')){ el.style.backgroundImage = p; el.style.backgroundColor = '#111'; }
    else { el.style.backgroundImage = 'none'; el.style.backgroundColor = p; }
}

// --- 2. AUTH ---
if(user) startSession();

function fastLogin() {
    const u = document.getElementById('login-u').value.trim().toLowerCase();
    if(!u) return;
    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, balance: 0, adsCount: 0, refBy: "", 
                refBonus: 0, refCount: 0, gcash: "", lastActive: Date.now()
            });
        }
        localStorage.setItem('ph_u', u);
        location.reload();
    });
}

function startSession() {
    db.ref('users/'+user).on('value', s => {
        uData = s.val();
        if(!uData) return;
        syncUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('bottom-nav').style.display = 'flex';
    });

    // In-App Ad frequency as requested
    setInterval(() => {
        show_10337853({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
    }, 240000); // 4 mins trigger

    setInterval(() => { db.ref('users/'+user+'/lastActive').set(Date.now()); }, 30000);
    setInterval(tickCd, 1000);
    loadLb(); loadOnline(); loadChat(); loadWdHistory();
}

function syncUI() {
    document.getElementById('txt-bal').innerText = uData.balance.toFixed(4);
    document.getElementById('txt-ref-count').innerText = uData.refCount || 0;
    document.getElementById('txt-ref-bonus').innerText = "₱"+(uData.refBonus || 0).toFixed(4);
    document.getElementById('ref-code-input').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-code-input').disabled = true;
    document.getElementById('wd-gc').value = uData.gcash || "";
}

// --- 3. ADS & CHAT (Triple Ad) ---
function watchAd(type) {
    if(type === 'std') {
        show_10337853().then(() => { giveReward(0.01); localStorage.setItem('cd_std', Date.now()); });
    } else {
        show_10337853('pop').then(() => { giveReward(0.0102); localStorage.setItem('cd_pre', Date.now()); });
    }
}

async function sendChatTripleAd() {
    const msg = document.getElementById('chat-in').value.trim();
    if(!msg) return;
    const last = localStorage.getItem('cd_chat') || 0;
    if(Date.now() - last < 300000) return alert("Chat cooldown!");

    alert("Watching 3 Ads to send...");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: user, m: msg, t: Date.now() });
        giveReward(0.015);
        localStorage.setItem('cd_chat', Date.now());
        document.getElementById('chat-in').value = "";
    } catch(e) { alert("Ad interrupted."); }
}

function giveReward(amt) {
    db.ref('users/'+user).transaction(d => {
        if(d){ d.balance += amt; d.adsCount++; }
        return d;
    });
    if(uData.refBy) db.ref('users/'+uData.refBy+'/refBonus').transaction(b => (b||0) + (amt*0.08));
    showPop(amt);
}

// --- 4. LISTS & PAGINATION ---
function loadLb() {
    db.ref('users').orderByChild('adsCount').on('value', s => {
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse();
        renderList('lb-container', arr, curLbPage, 15, i => `<span>#${i+1} ${arr[i].username}</span><b>${arr[i].adsCount} Ads</b>`);
    });
}

function loadOnline() {
    db.ref('users').orderByChild('lastActive').on('value', s => {
        let arr = []; s.forEach(c => {
            if(Date.now() - c.val().lastActive < 300000) arr.push(c.val());
        });
        renderList('online-container', arr, curOnPage, 15, i => `<span>${arr[i].username}</span><span style="color:#0f0">Online</span>`);
    });
}

function renderList(id, arr, page, limit, template) {
    const el = document.getElementById(id);
    el.innerHTML = "";
    let start = (page-1)*limit, end = page*limit;
    for(let i=start; i<end && i<arr.length; i++) {
        el.innerHTML += `<div class="list-row">${template(i)}</div>`;
    }
}

function lbPage(d){ curLbPage = Math.max(1, curLbPage+d); loadLb(); document.getElementById('lb-page-num').innerText = curLbPage; }
function onPage(d){ curOnPage = Math.max(1, curOnPage+d); loadOnline(); document.getElementById('on-page-num').innerText = curOnPage; }

// --- 5. WITHDRAW & REFS ---
function doWithdraw() {
    const v = parseFloat(document.getElementById('wd-v').value);
    const gc = document.getElementById('wd-gc').value;
    if(v >= 0.02 && uData.balance >= v) {
        db.ref('withdrawals').push({ username: user, gcash: gc, amount: v, status: 'pending', time: Date.now() });
        db.ref('users/'+user).update({ balance: uData.balance - v, gcash: gc });
        alert("Requested!");
    }
}

function loadWdHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(user).on('value', s => {
        const el = document.getElementById('wd-history-list'); el.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            el.innerHTML += `<div class="list-row"><span>₱${w.amount}</span><span style="color:${w.status==='paid'?'#0f0':'#f80'}">${w.status}</span></div>`;
        });
    });
}

function bindRef() {
    const code = document.getElementById('ref-code-input').value.trim().toLowerCase();
    if(code && code !== user && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){ 
                db.ref('users/'+user).update({ refBy: code });
                db.ref('users/'+code+'/refCount').transaction(c => (c||0)+1);
            }
        });
    }
}

function claimBonus() {
    if(uData.refBonus > 0) {
        db.ref('users/'+user).update({ balance: uData.balance + uData.refBonus, refBonus: 0 });
    }
}

// --- 6. ADMIN ---
function showAdmin() { tab('page-admin'); }
function loginAdmin() {
    if(document.getElementById('adm-p').value === "Propetas12") {
        document.getElementById('adm-box').style.display = 'block';
        loadAdmin();
    }
}

function loadAdmin() {
    db.ref('withdrawals').on('value', s => {
        const pList = document.getElementById('adm-pend-list');
        const hList = document.getElementById('adm-paid-list');
        let paidTotal = 0, pCount = 0, paidArr = [], pendArr = [];
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'paid') { paidTotal += w.amount; paidArr.push(w); }
            else { pCount++; pendArr.push(w); }
        });
        document.getElementById('adm-total-p').innerText = paidTotal.toFixed(2);
        document.getElementById('adm-pend-count').innerText = pCount;
        
        pList.innerHTML = "";
        pendArr.forEach(w => {
            pList.innerHTML += `<div class="list-row">${w.username} (₱${w.amount})<button onclick="approveWd('${w.id}')">PAID</button></div>`;
        });
        renderList('adm-paid-list', paidArr.reverse(), curAdmPage, 10, i => `<span>${paidArr[i].username}</span><span>₱${paidArr[i].amount}</span>`);
    });
}
function approveWd(id) { db.ref('withdrawals/'+id).update({status:'paid'}); }

// --- UI UTILS ---
function tab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

function showPop(v) {
    document.getElementById('pop-amt').innerText = "₱"+v;
    const el = document.getElementById('reward-alert');
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 2000);
}

function tickCd() {
    const now = Date.now();
    updateBtn('cd_std', 'btn-std', 'cd-std', 120000);
    updateBtn('cd_pre', 'btn-pre', 'cd-pre', 120000);
    updateBtn('cd_chat', 'btn-chat', 'cd-chat', 300000);
}

function updateBtn(key, bid, sid, limit) {
    const rem = Math.max(0, limit - (Date.now() - (localStorage.getItem(key)||0)));
    const btn = document.getElementById(bid);
    const span = document.getElementById(sid);
    if(rem > 0) {
        btn.disabled = true; btn.style.opacity = 0.5;
        span.innerText = `WAIT ${Math.floor(rem/60000)}m ${Math.floor((rem%60000)/1000)}s`;
    } else {
        btn.disabled = false; btn.style.opacity = 1; span.innerText = "READY";
    }
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const win = document.getElementById('chat-window'); win.innerHTML = "";
        s.forEach(c => {
            const m = c.val();
            win.innerHTML += `<div class="msg-line"><b>${m.u}:</b> ${m.m}</div>`;
        });
        win.scrollTop = win.scrollHeight;
    });
}
