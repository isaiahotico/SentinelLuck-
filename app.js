
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
let admPage = 1;

// Background Themes
const themes = ['#FF0000','#00FF00','#0000FF','#FFD700','#FF1493','#1E90FF','#DA70D6','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C', 'url("https://www.transparenttextures.com/patterns/brick-wall.png")','url("https://www.transparenttextures.com/patterns/dark-brick-wall.png")'];
function changeTheme() {
    const el = document.getElementById('bg-body');
    const t = themes[Math.floor(Math.random()*themes.length)];
    if(t.includes('url')) { el.style.backgroundImage = t; el.style.backgroundColor = '#111'; }
    else { el.style.backgroundImage = 'none'; el.style.backgroundColor = t; }
}

// --- AUTHENTICATION ---
if(user) startSession();

function handleAuth() {
    const u = document.getElementById('auth-u').value.trim().toLowerCase();
    const g = document.getElementById('auth-g').value.trim();
    const r = document.getElementById('auth-r').value.trim().toLowerCase();
    if(!u || g.length < 10) return alert("Username & Valid GCash Required");

    db.ref('users/'+u).once('value', s => {
        if(!s.exists()) {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, adsCount: 0, totalAds: 0,
                refBy: r || "", refCount: 0, refBonus: 0, lastActive: Date.now()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').transaction(c => (c||0)+1);
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
        document.getElementById('navbar').style.display = 'flex';
    });

    // In-App Interstitial Ad Configuration (Requested)
    const showInAppAd = () => {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    };
    
    showInAppAd(); // Open Immediately
    setInterval(showInAppAd, 300000); // Repeat every 5 minutes

    setInterval(() => db.ref('users/'+user+'/lastActive').set(Date.now()), 30000);
    setInterval(tickCd, 1000);
    checkWeeklyReset(); loadLb(); loadOnline(); loadChat(); loadWdHist();
}

function syncUI() {
    document.getElementById('txt-bal').innerText = uData.balance.toFixed(4);
    document.getElementById('txt-ref-count').innerText = uData.refCount || 0;
    document.getElementById('txt-ref-bonus').innerText = "₱"+(uData.refBonus || 0).toFixed(4);
    document.getElementById('ref-binder').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-binder').disabled = true;
}

// --- AD LOGIC & POPUPS ---
function watchAd(type) {
    if(type === 'std') {
        show_10337853().then(() => { giveReward(0.01); localStorage.setItem('last_std', Date.now()); });
    } else {
        show_10337853('pop').then(() => { giveReward(0.0102); localStorage.setItem('last_pre', Date.now()); });
    }
}

async function sendChatTriple() {
    const msg = document.getElementById('chat-in').value.trim();
    if(!msg) return;
    if(Date.now() - (localStorage.getItem('last_chat') || 0) < 300000) return alert("Chat cooldown!");

    alert("Watch 3 Combined Ads to send message...");
    try {
        await show_10337853(); await show_10337853(); await show_10337853();
        db.ref('chat').push({ u: user, m: msg, t: Date.now() });
        giveReward(0.015);
        localStorage.setItem('last_chat', Date.now());
        document.getElementById('chat-in').value = "";
    } catch(e) { alert("Ad incomplete."); }
}

function giveReward(amt) {
    db.ref('users/'+user).transaction(d => {
        if(d){ d.balance += amt; d.adsCount++; d.totalAds++; }
        return d;
    });
    if(uData.refBy) db.ref('users/'+uData.refBy+'/refBonus').transaction(b => (b||0) + (amt*0.08));
    showToast(amt);
}

function showToast(v) {
    document.getElementById('toast-val').innerText = "₱"+v;
    document.getElementById('reward-toast').style.display = 'block';
    document.getElementById('toast-anim').className = "toast-content animate__animated animate__zoomIn";
    setTimeout(() => document.getElementById('reward-toast').style.display = 'none', 2000);
}

// --- WEEKLY RESET & DATA ---
function checkWeeklyReset() {
    db.ref('system/lastReset').once('value', s => {
        const last = s.val() || 0;
        const now = Date.now();
        if(now - last > 604800000) {
            db.ref('users').once('value', snapshot => {
                snapshot.forEach(child => db.ref('users/'+child.key+'/adsCount').set(0));
                db.ref('system/lastReset').set(now);
            });
        }
    });
}

function loadLb() {
    db.ref('users').orderByChild('adsCount').limitToLast(15).on('value', s => {
        const body = document.getElementById('lb-body'); body.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach(u => {
            body.innerHTML += `<tr><td>${u.username}</td><td>${u.adsCount}</td><td>${u.totalAds}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
        });
    });
}

function loadOnline() {
    db.ref('users').on('value', s => {
        const list = document.getElementById('online-list'); list.innerHTML = "";
        s.forEach(c => {
            if(Date.now() - c.val().lastActive < 120000) {
                list.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
                    <span>${c.val().username}</span><span style="color:#0f0">Online</span></div>`;
            }
        });
    });
}

// --- WITHDRAWAL & REFERRAL ---
function submitWd() {
    const v = parseFloat(document.getElementById('wd-amt').value);
    if(v >= 0.02 && uData.balance >= v) {
        db.ref('withdrawals').push({
            username: user, gcash: uData.gcash, amount: v, status: 'pending', time: Date.now()
        });
        db.ref('users/'+user).update({ balance: uData.balance - v });
        alert("Withdrawal Pending!");
    } else alert("Invalid amount or insufficient funds.");
}

function loadWdHist() {
    db.ref('withdrawals').orderByChild('username').equalTo(user).on('value', s => {
        const body = document.getElementById('wd-history-body'); body.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            body.innerHTML += `<tr><td>${new Date(w.time).toLocaleDateString()}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'#f80'}">${w.status}</td></tr>`;
        });
    });
}

function updateReferral() {
    const code = document.getElementById('ref-binder').value.trim().toLowerCase();
    if(code && code !== user && !uData.refBy) {
        db.ref('users/'+code).once('value', s => {
            if(s.exists()){
                db.ref('users/'+user).update({ refBy: code });
                db.ref('users/'+code+'/refCount').transaction(c => (c||0)+1);
                alert("Referrer Synced!");
            }
        });
    }
}

function claimBonus() {
    if(uData.refBonus > 0) {
        db.ref('users/'+user).update({ balance: uData.balance + uData.refBonus, refBonus: 0 });
        alert("Claimed!");
    }
}

// --- ADMIN ---
function authAdmin() {
    if(document.getElementById('adm-p').value === "Propetas12") {
        document.getElementById('adm-login').style.display = 'none';
        document.getElementById('adm-content').style.display = 'block';
        loadAdmin();
    }
}

function loadAdmin() {
    db.ref('withdrawals').on('value', s => {
        const pendList = document.getElementById('adm-pend-list');
        const histList = document.getElementById('adm-hist-list');
        let totalPaid = 0, hArr = []; pendList.innerHTML = "";
        
        s.forEach(c => {
            let w = c.val(); w.id = c.key;
            const date = new Date(w.time).toLocaleString();
            if(w.status === 'paid') { totalPaid += w.amount; hArr.push(w); }
            else {
                pendList.innerHTML += `<div class="card" style="font-size:0.8rem;">
                    <b>USER: ${w.username}</b><br>GCash: ${w.gcash}<br>Amount: ₱${w.amount}<br>Date: ${date}<br>
                    <button class="btn btn-gold" style="padding:5px; margin-top:5px; width:100px;" onclick="approve('${w.id}')">PAY NOW</button>
                </div>`;
            }
        });
        document.getElementById('adm-total-withdrawn').innerText = totalPaid.toFixed(2);
        
        histList.innerHTML = "";
        hArr.reverse();
        let start = (admPage-1)*10, end = admPage*10;
        for(let i=start; i<end && i<hArr.length; i++) {
            histList.innerHTML += `<div style="padding:10px; border-bottom:1px solid #222; font-size:0.75rem;">
                <b>${hArr[i].username}</b> | ₱${hArr[i].amount} | ${hArr[i].status} | ${new Date(hArr[i].time).toLocaleDateString()}</div>`;
        }
    });
}
function approve(id) { db.ref('withdrawals/'+id).update({status: 'paid'}); }
function admPg(d) { admPage = Math.max(1, admPage+d); loadAdmin(); }

// --- UI HELPERS ---
function tickCd() {
    updateBtn('last_std', 'btn-std', 'cd-std', 120000);
    updateBtn('last_pre', 'btn-pre', 'cd-pre', 120000);
    updateBtn('last_chat', 'btn-chat', 'cd-chat', 300000);
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
