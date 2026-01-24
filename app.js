
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
const inc = firebase.database.ServerValue.increment;

let currentUser = localStorage.getItem('paper_u');
let uData = null;

// Dynamic Theme
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#1E90FF','#DA70D6','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")'];
function changeTheme() {
    const el = document.getElementById('main-bg');
    const t = themes[Math.floor(Math.random()*themes.length)];
    if(t.includes('url')) { el.style.backgroundImage = t; el.style.backgroundColor = '#111'; }
    else { el.style.backgroundImage = 'none'; el.style.backgroundColor = t; }
}

// --- AUTH ---
if(currentUser) startSession();

function auth() {
    const u = document.getElementById('in-user').value.trim().toLowerCase();
    const g = document.getElementById('in-gcash').value.trim();
    const r = document.getElementById('in-ref').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Valid Username & GCash required");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').set(inc(1));
            });
        }
        localStorage.setItem('paper_u', u);
        location.reload();
    });
}

function startSession() {
    db.ref('users/'+currentUser).on('value', s => {
        uData = s.val();
        if(!uData) return;
        syncUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // In-App Interstitial Ad (Requested Config)
    const runInApp = () => {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    };
    runInApp(); 
    setInterval(runInApp, 300000); // 5 minute cycle

    setInterval(() => db.ref('users/'+currentUser+'/lastActive').set(Date.now()), 30000);
    setInterval(tickCds, 1000);
    checkReset(); loadLB(); loadOnline(); loadChat(); loadWd();
}

function syncUI() {
    document.getElementById('u-bal').innerText = uData.balance.toFixed(4);
    document.getElementById('u-ref-c').innerText = uData.refCount || 0;
    document.getElementById('u-ref-b').innerText = "₱"+(uData.refBonus || 0).toFixed(4);
    document.getElementById('ref-binder').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-binder').disabled = true;
}

// --- ADS & REWARDS (Fixed Crediting) ---
async function playAd(type) {
    try {
        if(type === 'std') {
            await show_10337853();
            addReward(0.01);
            localStorage.setItem('cd_std', Date.now());
        } else {
            await show_10337853('pop');
            addReward(0.0102);
            localStorage.setItem('cd_pre', Date.now());
        }
    } catch(e) { alert("Ad Failed"); }
}

async function sendChat3() {
    const msg = document.getElementById('chat-input').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('cd_chat') || 0) < 300000) return alert("Wait for cooldown");

    alert("Watch 3 ads to Send & Earn...");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: currentUser, m: msg, t: Date.now() });
        addReward(0.015);
        localStorage.setItem('cd_chat', Date.now());
        document.getElementById('chat-input').value = "";
    } catch(e) { alert("Ad incomplete"); }
}

function addReward(amt) {
    db.ref('users/'+currentUser).update({
        balance: inc(amt),
        adsCount: inc(1),
        totalAds: inc(1)
    });
    if(uData.refBy) db.ref('users/'+uData.refBy+'/refBonus').set(inc(amt * 0.08));
    showPop(amt);
}

function showPop(v) {
    document.getElementById('pop-v').innerText = "₱"+v;
    document.getElementById('reward-popup').style.display = 'block';
    document.getElementById('toast-anim').className = "reward-circle animate__animated animate__zoomIn";
    setTimeout(() => document.getElementById('reward-popup').style.display='none', 2000);
}

// --- WALLET (Updated Min 1 Peso) ---
function requestWd() {
    const val = parseFloat(document.getElementById('wd-amt').value);
    if(val >= 1.00 && uData.balance >= val) {
        db.ref('withdrawals').push({
            username: currentUser, gcash: uData.gcash, amount: val, status: 'pending', time: Date.now()
        });
        db.ref('users/'+currentUser+'/balance').set(inc(-val));
        alert("Withdrawal Requested!");
    } else alert("Insufficient balance or below ₱1.00");
}

function loadWd() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const b = document.getElementById('wd-history-body'); b.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            b.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'orange'}">${w.status}</td></tr>`;
        });
    });
}

// --- SYSTEM ---
function checkReset() {
    db.ref('system/lastReset').once('value', s => {
        if(Date.now() - (s.val()||0) > 604800000) {
            db.ref('users').once('value', ss => {
                ss.forEach(u => db.ref('users/'+u.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(Date.now());
            });
        }
    });
}

function loadLB() {
    db.ref('users').orderByChild('adsCount').limitToLast(15).on('value', s => {
        const b = document.getElementById('lb-body'); b.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach(u => {
            b.innerHTML += `<tr><td>${u.username}</td><td>${u.adsCount}</td><td>${u.totalAds}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const l = document.getElementById('online-list'); l.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                l.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

// --- HELPERS ---
function syncRef() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== currentUser && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+currentUser).update({ refBy: code });
                db.ref('users/'+code+'/refCount').set(inc(1));
                alert("Referrer updated!");
            }
        });
    }
}

function claimRef() {
    if(uData.refBonus > 0) {
        db.ref('users/'+currentUser).update({ balance: inc(uData.refBonus), refBonus: 0 });
        alert("Bonus Claimed!");
    }
}

function tickCds() {
    updateBtn('cd_std', 'btn-std', 'cd-std', 120000);
    updateBtn('cd_pre', 'btn-pre', 'cd-pre', 120000);
    updateBtn('cd_chat', 'btn-chat', 'cd-chat', 300000);
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

// --- ADMIN ---
function admAuth() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-lock').style.display = 'none';
        document.getElementById('adm-content').style.display = 'block';
        loadAdm();
    }
}

function loadAdm() {
    db.ref('withdrawals').on('value', s => {
        const pArea = document.getElementById('adm-pend'), hArea = document.getElementById('adm-hist');
        let total = 0; pArea.innerHTML = ""; hArea.innerHTML = "";
        s.forEach(c => {
            const w = c.val(); w.id = c.key;
            if(w.status === 'paid') {
                total += w.amount;
                hArea.innerHTML += `<div style="padding:10px; font-size:0.7rem; border-bottom:1px solid #333;">${w.username} | ₱${w.amount} | PAID</div>`;
            } else {
                pArea.innerHTML += `<div class="card" style="font-size:0.8rem;">
                    <b>${w.username}</b> | ${w.gcash}<br>₱${w.amount} | ${new Date(w.time).toLocaleString()}<br>
                    <button class="btn btn-gold" style="padding:5px; margin-top:5px; width:100px;" onclick="approve('${w.id}')">PAY</button>
                </div>`;
            }
        });
        document.getElementById('adm-total-p').innerText = total.toFixed(2);
    });
}
function approve(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }
