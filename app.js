
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

let currentUser = localStorage.getItem('ph_user');
let userData = null;

// 25+ Rainbow/Brick Backgrounds
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#00CED1','#ADFF2F','#FF4500','#1E90FF','#DA70D6','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C','#8E44AD','#2C3E50','#F1C40F','#D35400','#7F8C8D','#273C75','#44bd32','#0097e6', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")','url("https://www.transparenttextures.com/patterns/dark-brick-wall.png")'];

function triggerRainbow() {
    const el = document.getElementById('main-bg');
    const pick = themes[Math.floor(Math.random()*themes.length)];
    if(pick.includes('url')) { el.style.backgroundImage = pick; el.style.backgroundColor = '#111'; }
    else { el.style.backgroundImage = 'none'; el.style.backgroundColor = pick; }
}

// --- AUTH ---
if(currentUser) initApp();

function authNow() {
    const u = document.getElementById('in-user').value.trim().toLowerCase();
    const g = document.getElementById('in-gcash').value.trim();
    const r = document.getElementById('in-ref').value.trim().toLowerCase();

    if(!u || g.length < 10) return alert("Enter Username and Valid GCash");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').transaction(c => (c||0)+1);
            });
        }
        localStorage.setItem('ph_user', u);
        location.reload();
    });
}

function initApp() {
    db.ref('users/'+currentUser).on('value', s => {
        userData = s.val();
        if(!userData) return;
        syncUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // In-App Interstitial logic (5 min cooldown)
    setInterval(() => {
        const lastInApp = localStorage.getItem('last_inapp') || 0;
        if(Date.now() - lastInApp > 300000) {
            show_10337853({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }});
            localStorage.setItem('last_inapp', Date.now());
        }
    }, 60000);

    // Heartbeat for Online Status
    setInterval(() => db.ref('users/'+currentUser+'/lastActive').set(Date.now()), 30000);
    setInterval(tickCd, 1000);
    
    checkWeeklyReset();
    loadLb(); loadOnline(); loadChat(); loadWdHistory();
}

function syncUI() {
    document.getElementById('bal-txt').innerText = userData.balance.toFixed(4);
    document.getElementById('ref-count-txt').innerText = userData.refCount || 0;
    document.getElementById('ref-bonus-txt').innerText = "₱"+(userData.refBonus || 0).toFixed(4);
    document.getElementById('ref-input-box').value = userData.refBy || "";
    if(userData.refBy) document.getElementById('ref-input-box').disabled = true;
}

// --- ADS ---
function playAd(type) {
    if(type === 'std') {
        show_10337853().then(() => { addReward(0.01); localStorage.setItem('cd_std', Date.now()); });
    } else {
        show_10337853('pop').then(() => { addReward(0.0102); localStorage.setItem('cd_pre', Date.now()); });
    }
}

async function sendChatWithAds() {
    const msg = document.getElementById('chat-msg').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('cd_chat') || 0) < 300000) return alert("Wait for cooldown!");

    alert("Watch 3 Ads to Send & Earn ₱0.015!");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: currentUser, m: msg, t: Date.now() });
        addReward(0.015);
        localStorage.setItem('cd_chat', Date.now());
        document.getElementById('chat-msg').value = "";
    } catch(e) { alert("Ad failed."); }
}

function addReward(amt) {
    db.ref('users/'+currentUser).transaction(d => {
        if(d){ d.balance += amt; d.adsCount++; d.totalAds++; }
        return d;
    });
    if(userData.refBy) db.ref('users/'+userData.refBy+'/refBonus').transaction(b => (b||0) + (amt*0.08));
    showPop(amt);
}

// --- WEEKLY RESET ---
function checkWeeklyReset() {
    db.ref('system/lastReset').once('value', s => {
        const last = s.val() || 0;
        if(Date.now() - last > 604800000) { // 7 days
            db.ref('users').once('value', users => {
                users.forEach(u => {
                    db.ref('users/'+u.key+'/adsCount').set(0);
                });
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}

// --- LISTS ---
function loadLb() {
    db.ref('users').orderByChild('adsCount').limitToLast(20).on('value', s => {
        const body = document.getElementById('lb-body'); body.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach(u => {
            body.innerHTML += `<tr><td>${u.username}</td><td>${u.adsCount}</td><td>${u.totalAds}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const el = document.getElementById('online-list'); el.innerHTML = "";
        s.forEach(c => {
            const u = c.val();
            if(Date.now() - u.lastActive < 120000) {
                el.innerHTML += `<div class="list-item"><span>${u.username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

// --- WALLET ---
function requestWithdraw() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    if(amt >= 0.02 && userData.balance >= amt) {
        db.ref('withdrawals').push({
            username: currentUser, gcash: userData.gcash, amount: amt, status: 'pending', time: Date.now()
        });
        db.ref('users/'+currentUser).update({ balance: userData.balance - amt });
        alert("Request Sent!");
    } else alert("Min 0.02 required.");
}

function loadWdHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const body = document.getElementById('wd-history-body'); body.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            body.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'orange'}">${w.status}</td></tr>`;
        });
    });
}

// --- ADMIN ---
function loginAdmin() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-data').style.display = 'block';
        loadAdmin();
    }
}

function loadAdmin() {
    db.ref('withdrawals').on('value', s => {
        const pList = document.getElementById('adm-pending-list');
        const hList = document.getElementById('adm-paid-list');
        let paidTotal = 0; pList.innerHTML = ""; hList.innerHTML = "";
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            const date = new Date(w.time).toLocaleString();
            if(w.status === 'paid') {
                paidTotal += w.amount;
                hList.innerHTML += `<div class="list-item"><span>${w.username} (₱${w.amount})<br><small>${date}</small></span><span style="color:#0f0">PAID</span></div>`;
            } else {
                pList.innerHTML += `<div class="adm-card">
                    <b>${w.username}</b> | ${w.gcash}<br>Amount: ₱${w.amount} | ${date}<br>
                    <button class="btn btn-gold" style="padding:5px; margin-top:5px; width:100px;" onclick="approveWd('${w.id}')">APPROVE</button>
                </div>`;
            }
        });
        document.getElementById('adm-total-paid').innerText = paidTotal.toFixed(2);
    });
}
function approveWd(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }

// --- HELPERS ---
function bindReferrer() {
    const target = document.getElementById('ref-input-box').value.trim().toLowerCase();
    if(target && target !== currentUser && !userData.refBy) {
        db.ref('users/'+target).once('value', s => {
            if(s.exists()){
                db.ref('users/'+currentUser).update({ refBy: target });
                db.ref('users/'+target+'/refCount').transaction(c => (c||0)+1);
                alert("Referrer Updated!");
            }
        });
    }
}

function claimReferral() {
    if(userData.refBonus > 0) {
        db.ref('users/'+currentUser).update({ balance: userData.balance + userData.refBonus, refBonus: 0 });
    }
}

function tickCd() {
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

function tab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

function showPop(v) {
    document.getElementById('pop-val').innerText = "₱"+v;
    document.getElementById('reward-popup').style.display = 'block';
    setTimeout(() => document.getElementById('reward-popup').style.display = 'none', 2000);
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const w = document.getElementById('chat-window'); w.innerHTML = "";
        s.forEach(c => {
            const m = c.val(); w.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`;
        });
        w.scrollTop = w.scrollHeight;
    });
}
