
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

let currentUser = localStorage.getItem('ph_user_v2');
let userData = null;

// UI Aesthetics
function changeVibe() {
    const colors = ['#05050a','#1a1a2e','#0a0a16','#121212','#050a0a'];
    document.getElementById('bg-vibe').style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
}

// --- AUTHENTICATION ---
if(currentUser) startSession();

function doLogin() {
    const u = document.getElementById('auth-u').value.trim().toLowerCase();
    const g = document.getElementById('auth-g').value.trim();
    const r = document.getElementById('auth-r').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Valid Username & GCash Number Required");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').set(increment(1));
            });
        }
        localStorage.setItem('ph_user_v2', u);
        location.reload();
    });
}

function startSession() {
    db.ref('users/'+currentUser).on('value', s => {
        userData = s.val();
        if(!userData) return;
        updateDashboard();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    setInterval(() => db.ref('users/'+currentUser+'/lastActive').set(Date.now()), 30000);
    setInterval(updateTimers, 1000);
    
    syncLeaderboard(); syncOnline(); syncChat(); syncHistory(); checkSundayReset();
}

function updateDashboard() {
    document.getElementById('txt-bal').innerText = userData.balance.toFixed(4);
    document.getElementById('txt-ref-c').innerText = userData.refCount || 0;
    document.getElementById('txt-ref-b').innerText = "₱"+(userData.refBonus || 0).toFixed(4);
    document.getElementById('ref-binder').value = userData.refBy || "";
    if(userData.refBy) document.getElementById('ref-binder').disabled = true;
}

// --- AD REWARDS (₱0.0102 / 5 MIN COOLDOWN) ---
async function loadAds(type) {
    try {
        if(type === 'std') {
            await show_10337853();
            grantReward(0.0102);
            localStorage.setItem('cd_std', Date.now());
        } else {
            await show_10337853('pop');
            grantReward(0.0102);
            localStorage.setItem('cd_pre', Date.now());
        }
    } catch(e) { alert("Ad interrupted."); }
}

async function processChat() {
    const msg = document.getElementById('chat-msg').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('cd_chat')||0) < 300000) return alert("Wait for cooldown");

    alert("Verifying... Please watch 3 Premium Ads to send.");
    try {
        await show_10337853('pop'); 
        await show_10337853('pop'); 
        await show_10337853('pop');
        
        db.ref('chat').push({ u: currentUser, m: msg, t: Date.now() });
        grantReward(0.016);
        localStorage.setItem('cd_chat', Date.now());
        document.getElementById('chat-msg').value = "";
    } catch(e) { alert("Security check failed."); }
}

function grantReward(amt) {
    const updates = {};
    updates[`users/${currentUser}/balance`] = increment(amt);
    updates[`users/${currentUser}/adsCount`] = increment(1);
    updates[`users/${currentUser}/totalAds`] = increment(1);
    db.ref().update(updates);

    if(userData.refBy) db.ref('users/'+userData.refBy+'/refBonus').set(increment(amt * 0.08));
    
    document.getElementById('pop-val').innerText = "₱"+amt;
    document.getElementById('reward-pop').style.display = 'block';
    document.getElementById('pop-anim').className = "pop-box animate__animated animate__zoomIn";
    setTimeout(() => document.getElementById('reward-pop').style.display='none', 2000);
}

// --- REAL-TIME LISTS ---
function syncLeaderboard() {
    db.ref('users').orderByChild('balance').limitToLast(100).on('value', s => {
        const list = document.getElementById('lb-list'); list.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td><td>${u.totalAds}</td></tr>`;
        });
    });
}

function syncOnline() {
    db.ref('users').on('value', s => {
        const el = document.getElementById('online-users'); el.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                el.innerHTML += `<div style="padding:12px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

function syncChat() {
    db.ref('chat').limitToLast(25).on('value', s => {
        const win = document.getElementById('chat-window'); win.innerHTML = "";
        s.forEach(c => { const m = c.val(); win.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`; });
        win.scrollTop = win.scrollHeight;
    });
}

// --- WALLET ---
function requestCashout() {
    const val = parseFloat(document.getElementById('wd-amount').value);
    if(val >= 1 && userData.balance >= val) {
        db.ref('withdrawals').push({
            username: currentUser, gcash: userData.gcash, amount: val, status: 'pending', time: Date.now()
        });
        db.ref('users/'+currentUser+'/balance').set(increment(-val));
        alert("Withdrawal Requested Successfully!");
    } else alert("Minimum payout is ₱1.00");
}

function syncHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const hist = document.getElementById('wd-history'); hist.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            hist.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'#f80'}">${w.status}</td></tr>`;
        });
    });
}

// --- ADMIN SYSTEM ---
function admEntry() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-main').style.display = 'block';
        loadAdminPanel();
    }
}

function loadAdminPanel() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pendings'), hArea = document.getElementById('adm-paid-logs');
        let total = 0; pArea.innerHTML = ""; hArea.innerHTML = "";
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'paid') {
                total += w.amount;
                hArea.innerHTML += `<div style="font-size:0.7rem; border-bottom:1px solid #333; padding:5px;">${w.username} | ₱${w.amount} | PAID</div>`;
            } else {
                pArea.innerHTML += `<div class="card" style="font-size:0.8rem;">
                    <b>${w.username}</b> | ${w.gcash}<br>₱${w.amount}<br>
                    <button class="btn btn-gold" style="width:100px; padding:6px; margin-top:8px;" onclick="approvePayout('${w.id}')">APPROVE</button>
                </div>`;
            }
        });
        document.getElementById('adm-total').innerText = total.toFixed(2);
    });
}
function approvePayout(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }

// --- HELPERS ---
function syncReferrer() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== currentUser && !userData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+currentUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(increment(1));
                alert("Successfully Bound!");
            }
        });
    }
}

function claimBonus() {
    if(userData.refBonus > 0) {
        db.ref('users/'+currentUser).update({ balance: increment(userData.refBonus), refBonus: 0 });
        alert("Referral Bonus Added to Balance!");
    }
}

function updateTimers() {
    tick('cd_std', 'btn-std', 'cd-std', 300000);
    tick('cd_pre', 'btn-pre', 'cd-pre', 300000);
    tick('cd_chat', 'btn-chat', 'cd-chat', 300000);
}

function tick(key, bid, sid, limit) {
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

function checkSundayReset() {
    db.ref('system/lastReset').once('value', s => {
        if(Date.now() - (s.val()||0) > 604800000) {
            db.ref('users').once('value', ss => {
                ss.forEach(u => db.ref('users/'+u.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}
