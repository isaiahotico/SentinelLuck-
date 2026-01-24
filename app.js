
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

let currentUser = localStorage.getItem('ph_user_key');
let userData = null;
let admPage = 1;

// Background Randomizer
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#1E90FF','#DA70D6','#1ABC9C','#2ECC71','#3498DB','#9B59B6', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")'];
function changeVibe() {
    const b = document.getElementById('main-body');
    const t = themes[Math.floor(Math.random()*themes.length)];
    if(t.includes('url')) { b.style.backgroundImage = t; b.style.backgroundColor = '#111'; }
    else { b.style.backgroundImage = 'none'; b.style.backgroundColor = t; }
}

// --- AUTH ---
if(currentUser) init();

function doAuth() {
    const u = document.getElementById('auth-u').value.trim().toLowerCase();
    const g = document.getElementById('auth-g').value.trim();
    const r = document.getElementById('auth-r').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Username & GCash required");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').set(increment(1));
            });
        }
        localStorage.setItem('ph_user_key', u);
        location.reload();
    });
}

function init() {
    db.ref('users/'+currentUser).on('value', s => {
        userData = s.val();
        if(!userData) return;
        syncHome();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // Forced In-App Interstitial
    const showInApp = () => {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    };
    showInApp();
    setInterval(showInApp, 300000); // 5 mins

    setInterval(() => db.ref('users/'+currentUser+'/lastActive').set(Date.now()), 30000);
    setInterval(tickTimers, 1000);
    checkWeekly(); loadLB(); loadOnline(); loadChat(); loadWdHist();
}

function syncHome() {
    document.getElementById('txt-bal').innerText = userData.balance.toFixed(4);
    document.getElementById('txt-ref-c').innerText = userData.refCount || 0;
    document.getElementById('txt-ref-b').innerText = "₱"+(userData.refBonus || 0).toFixed(4);
    document.getElementById('ref-binder').value = userData.refBy || "";
    if(userData.refBy) document.getElementById('ref-binder').disabled = true;
}

// --- AD REWARDS (FIXED CREDITING) ---
async function getAd(type) {
    try {
        if(type === 'std') {
            await show_10337853();
            applyReward(0.01);
            localStorage.setItem('t_std', Date.now());
        } else {
            await show_10337853('pop');
            applyReward(0.0102);
            localStorage.setItem('t_pre', Date.now());
        }
    } catch(e) { alert("Ad Failed"); }
}

async function sendChatAd() {
    const msg = document.getElementById('chat-msg').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('t_chat')||0) < 300000) return alert("Cooldown Active!");

    alert("Watch 3 Ads to proceed...");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: currentUser, m: msg, t: Date.now() });
        applyReward(0.015);
        localStorage.setItem('t_chat', Date.now());
        document.getElementById('chat-msg').value = "";
    } catch(e) { alert("Process interrupted."); }
}

function applyReward(amt) {
    const updates = {};
    updates[`users/${currentUser}/balance`] = increment(amt);
    updates[`users/${currentUser}/adsCount`] = increment(1);
    updates[`users/${currentUser}/totalAds`] = increment(1);
    db.ref().update(updates);

    if(userData.refBy) db.ref('users/'+userData.refBy+'/refBonus').set(increment(amt * 0.08));
    
    // Popup Message
    document.getElementById('toast-v').innerText = "₱"+amt;
    document.getElementById('reward-toast').style.display = 'block';
    document.getElementById('toast-anim').className = "toast-circle animate__animated animate__bounceIn";
    setTimeout(() => document.getElementById('reward-toast').style.display='none', 2000);
}

// --- LEADERBOARD & ONLINE ---
function loadLB() {
    db.ref('users').orderByChild('balance').limitToLast(50).on('value', s => {
        const b = document.getElementById('lb-body'); b.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            b.innerHTML += `<tr><td>${i+1}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td><td>${u.adsCount}</td><td>${u.totalAds}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const el = document.getElementById('online-users'); el.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                el.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

// --- WALLET ---
function submitWd() {
    const val = parseFloat(document.getElementById('wd-amount').value);
    if(val >= 1 && userData.balance >= val) {
        db.ref('withdrawals').push({
            username: currentUser, gcash: userData.gcash, amount: val, status: 'pending', time: Date.now()
        });
        db.ref('users/'+currentUser+'/balance').set(increment(-val));
        alert("Success! Check History.");
    } else alert("Min ₱1 required.");
}

function loadWdHist() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const b = document.getElementById('wd-history'); b.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            b.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'#f80'}">${w.status}</td></tr>`;
        });
    });
}

// --- ADMIN ---
function admLogin() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-area').style.display = 'block';
        loadAdm();
    }
}

function loadAdm() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pending'), hArea = document.getElementById('adm-approved');
        let total = 0, hArr = []; pArea.innerHTML = "";
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'paid') { total += w.amount; hArr.push(w); }
            else {
                pArea.innerHTML += `<div class="card" style="font-size:0.75rem;">
                    <b>${w.username}</b> | ${w.gcash}<br>Amount: ₱${w.amount}<br>${new Date(w.time).toLocaleString()}<br>
                    <button class="btn btn-gold" style="padding:5px; margin-top:10px; width:80px;" onclick="payWd('${w.id}')">PAY</button>
                </div>`;
            }
        });
        document.getElementById('adm-paid-sum').innerText = total.toFixed(2);
        hArea.innerHTML = ""; hArr.reverse();
        let start = (admPage-1)*10, end = admPage*10;
        for(let i=start; i<end && i<hArr.length; i++) {
            hArea.innerHTML += `<div style="padding:8px; border-bottom:1px solid #333; font-size:0.7rem;">${hArr[i].username} | ₱${hArr[i].amount} | PAID</div>`;
        }
    });
}
function payWd(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }
function admMove(d) { admPage = Math.max(1, admPage+d); loadAdm(); }

// --- HELPERS ---
function updateRef() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== currentUser && !userData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+currentUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(increment(1));
                alert("Ref Linked!");
            }
        });
    }
}

function claimBonus() {
    if(userData.refBonus > 0) {
        db.ref('users/'+currentUser).update({ balance: increment(userData.refBonus), refBonus: 0 });
    }
}

function tickTimers() {
    updateBtn('t_std', 'btn-std', 'cd-std', 120000);
    updateBtn('t_pre', 'btn-pre', 'cd-pre', 120000);
    updateBtn('t_chat', 'btn-chat', 'cd-chat', 300000);
}

function updateBtn(key, bid, sid, limit) {
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
    if(event.currentTarget.classList) event.currentTarget.classList.add('active');
}

function checkWeekly() {
    db.ref('system/lastReset').once('value', s => {
        if(Date.now() - (s.val()||0) > 604800000) {
            db.ref('users').once('value', ss => {
                ss.forEach(u => db.ref('users/'+u.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const w = document.getElementById('chat-window'); w.innerHTML = "";
        s.forEach(c => { const m = c.val(); w.innerHTML += `<div class="msg"><b>${m.u}:</b> ${m.m}</div>`; });
        w.scrollTop = w.scrollHeight;
    });
}
