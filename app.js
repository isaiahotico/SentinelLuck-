
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
const increment = firebase.database.ServerValue.increment;

let currentUser = localStorage.getItem('ph_username');
let uData = null;
let admPage = 1;

// Multi-Color Dynamic Background
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#1E90FF','#DA70D6','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C','#D35400', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")','url("https://www.transparenttextures.com/patterns/dark-brick-wall.png")'];
function changeVibe() {
    const b = document.getElementById('dynamic-bg');
    const t = themes[Math.floor(Math.random()*themes.length)];
    if(t.includes('url')) { b.style.backgroundImage = t; b.style.backgroundColor = '#111'; }
    else { b.style.backgroundImage = 'none'; b.style.backgroundColor = t; }
}

// --- AUTH ---
if(currentUser) initSession();

function fastAuth() {
    const u = document.getElementById('log-u').value.trim().toLowerCase();
    const g = document.getElementById('log-g').value.trim();
    const r = document.getElementById('log-r').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Username & Valid GCash Required");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').set(increment(1));
            });
        }
        localStorage.setItem('ph_username', u);
        location.reload();
    });
}

function initSession() {
    db.ref('users/'+currentUser).on('value', s => {
        uData = s.val();
        if(!uData) return;
        updateUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('nav-bar').style.display = 'flex';
    });

    // Forced In-App Ad Configuration (Requested)
    const runInApp = () => {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    };
    runInApp(); 
    setInterval(runInApp, 300000); // 5-minute trigger

    setInterval(() => db.ref('users/'+currentUser+'/lastActive').set(Date.now()), 30000);
    setInterval(refreshCooldowns, 1000);
    
    checkWeeklyReset(); loadLB(); loadOnline(); loadChat(); loadWdHistory();
}

function updateUI() {
    document.getElementById('bal-val').innerText = uData.balance.toFixed(4);
    document.getElementById('ref-count-val').innerText = uData.refCount || 0;
    document.getElementById('ref-bonus-val').innerText = "₱"+(uData.refBonus || 0).toFixed(4);
    document.getElementById('ref-input').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-input').disabled = true;
}

// --- AD REWARD LOGIC (FIXED) ---
async function watchAd(type) {
    try {
        if(type === 'std') {
            await show_10337853();
            processReward(0.01);
            localStorage.setItem('last_std', Date.now());
        } else {
            await show_10337853('pop');
            processReward(0.0102);
            localStorage.setItem('last_pre', Date.now());
        }
    } catch(err) { alert("Ad interrupted or blocked."); }
}

async function sendChat3Ads() {
    const msg = document.getElementById('chat-input').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('last_chat')||0) < 300000) return alert("Cooldown Active!");

    alert("Watching 3 Ads to send message...");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: currentUser, m: msg, t: Date.now() });
        processReward(0.015);
        localStorage.setItem('last_chat', Date.now());
        document.getElementById('chat-input').value = "";
    } catch(e) { alert("Failed to load all ads."); }
}

function processReward(amt) {
    const updates = {};
    updates[`users/${currentUser}/balance`] = increment(amt);
    updates[`users/${currentUser}/adsCount`] = increment(1);
    updates[`users/${currentUser}/totalAds`] = increment(1);
    
    db.ref().update(updates);

    // Referral 8% commission
    if(uData.refBy) {
        db.ref('users/'+uData.refBy+'/refBonus').set(increment(amt * 0.08));
    }
    
    showPopup(amt);
}

function showPopup(v) {
    document.getElementById('toast-val').innerText = "₱"+v;
    document.getElementById('reward-toast').style.display = 'block';
    document.getElementById('toast-anim').className = "toast-box animate__animated animate__bounceIn";
    setTimeout(() => document.getElementById('reward-toast').style.display = 'none', 2500);
}

// --- SYSTEM & LISTS ---
function checkWeeklyReset() {
    db.ref('system/lastReset').once('value', s => {
        const last = s.val() || 0;
        if(Date.now() - last > 604800000) {
            db.ref('users').once('value', snapshot => {
                snapshot.forEach(child => db.ref('users/'+child.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}

function loadLB() {
    db.ref('users').orderByChild('adsCount').limitToLast(20).on('value', s => {
        const list = document.getElementById('lb-list'); list.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach(u => {
            list.innerHTML += `<tr><td>${u.username}</td><td>${u.adsCount}</td><td>${u.totalAds}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const list = document.getElementById('online-users-list'); list.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                list.innerHTML += `<div style="padding:12px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                    <span>${c.val().username}</span><span style="color:#0f0">Active</span></div>`;
            }
        });
    });
}

// --- WALLET ---
function requestWd() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    if(amt >= 0.02 && uData.balance >= amt) {
        db.ref('withdrawals').push({
            username: currentUser, gcash: uData.gcash, amount: amt, status: 'pending', time: Date.now()
        });
        db.ref('users/'+currentUser+'/balance').set(increment(-amt));
        alert("Requested successfully!");
    } else alert("Insufficient balance or below min 0.02");
}

function loadWdHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const body = document.getElementById('wd-history-list'); body.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            body.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'orange'}">${w.status}</td></tr>`;
        });
    });
}

function bindRef() {
    const code = document.getElementById('ref-input').value.trim().toLowerCase();
    if(code && code !== currentUser && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+currentUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(increment(1));
                alert("Referrer Synced!");
            }
        });
    }
}

function claimReferral() {
    if(uData.refBonus > 0) {
        db.ref('users/'+currentUser+'/balance').set(increment(uData.refBonus));
        db.ref('users/'+currentUser+'/refBonus').set(0);
        alert("Bonus claimed!");
    }
}

// --- ADMIN ---
function unlockAdmin() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-ui').style.display = 'block';
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pending-area');
        const hArea = document.getElementById('adm-history-area');
        let totalPaid = 0, hArr = []; pArea.innerHTML = "";
        
        s.forEach(c => {
            let w = c.val(); w.id = c.key;
            if(w.status === 'paid') { totalPaid += w.amount; hArr.push(w); }
            else {
                pArea.innerHTML += `<div class="adm-req">
                    <b>USER: ${w.username}</b><br>GCash: ${w.gcash}<br>Amount: ₱${w.amount}<br>Date: ${new Date(w.time).toLocaleString()}<br>
                    <button class="btn btn-gold" style="padding:6px; margin-top:8px; width:120px;" onclick="approveWd('${w.id}')">APPROVE</button>
                </div>`;
            }
        });
        document.getElementById('adm-total-p').innerText = totalPaid.toFixed(2);
        
        hArea.innerHTML = ""; hArr.reverse();
        let start = (admPage-1)*10, end = admPage*10;
        for(let i=start; i<end && i<hArr.length; i++) {
            const d = hArr[i];
            hArea.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222; font-size:0.75rem;">
                <b>${d.username}</b> | ₱${d.amount} | ${d.gcash} | ${new Date(d.time).toLocaleDateString()}</div>`;
        }
    });
}
function approveWd(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }
function admPg(d) { admPage = Math.max(1, admPage+d); loadAdminData(); }

// --- HELPERS ---
function refreshCooldowns() {
    updateTimer('last_std', 'btn-std', 'cd-std', 120000);
    updateTimer('last_pre', 'btn-pre', 'cd-pre', 120000);
    updateTimer('last_chat', 'btn-chat', 'cd-chat', 300000);
}

function updateTimer(key, bid, sid, limit) {
    const rem = Math.max(0, limit - (Date.now() - (localStorage.getItem(key)||0)));
    const btn = document.getElementById(bid), span = document.getElementById(sid);
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
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const w = document.getElementById('chat-win'); w.innerHTML = "";
        s.forEach(c => {
            const m = c.val(); w.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`;
        });
        w.scrollTop = w.scrollHeight;
    });
}
