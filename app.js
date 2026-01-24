
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

let user = localStorage.getItem('ph_username');
let uData = null;

// Background Assets
const themes = [
    '#FF0000','#FF7F00','#FFFF00','#00FF00','#0000FF','#4B0082','#9400D3','#FF1493','#00CED1','#ADFF2F','#FF4500','#1E90FF','#DA70D6','#7CFC00','#00FA9A','#FF6347','#00BFFF','#F0E68C','#D2691E','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C',
    'url("https://www.transparenttextures.com/patterns/brick-wall.png")',
    'url("https://www.transparenttextures.com/patterns/dark-brick-wall.png")',
    'url("https://www.transparenttextures.com/patterns/old-wall.png")'
];

function changeTheme() {
    const body = document.getElementById('main-body');
    const picked = themes[Math.floor(Math.random() * themes.length)];
    if(picked.includes('url')) {
        body.style.backgroundImage = picked;
        body.style.backgroundColor = '#222';
    } else {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = picked;
    }
}

// --- AUTH ---
if(user) autoLogin();

function handleAuth() {
    const u = document.getElementById('auth-user').value.trim().toLowerCase();
    if(!u) return alert("Enter a username");

    db.ref('users/'+u).once('value', s => {
        if(s.exists()) {
            localStorage.setItem('ph_username', u);
            location.reload();
        } else {
            db.ref('users/'+u).set({
                username: u, gcash: "", balance: 0, miniBank: 0,
                refBy: "", refBonus: 0, refCount: 0, adsCount: 0, totalEarned: 0
            }).then(() => {
                localStorage.setItem('ph_username', u);
                location.reload();
            });
        }
    });
}

function autoLogin() {
    db.ref('users/'+user).on('value', s => {
        uData = s.val();
        if(!uData) return;
        syncUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // In-App Ad Logic (As Requested)
    setInterval(() => {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }, 240000); // 4 minutes

    loadHistory();
    loadLeaderboard();
    loadChat();
    setInterval(updateCooldowns, 1000);
}

function syncUI() {
    document.getElementById('txt-bal').innerText = uData.balance.toFixed(3);
    document.getElementById('txt-bank').innerText = (uData.miniBank || 0).toFixed(2);
    document.getElementById('txt-ref-count').innerText = uData.refCount || 0;
    document.getElementById('txt-ref-bonus').innerText = "₱" + (uData.refBonus || 0).toFixed(3);
    document.getElementById('wd-gcash').value = uData.gcash || "";
    document.getElementById('ref-input').value = uData.refBy || "";
    if(uData.refBy) document.getElementById('ref-input').disabled = true;
}

// --- ADS & REWARDS ---
function showStandardAd() {
    if(!checkCd('last_std', 120000)) return;
    show_10337853().then(() => {
        reward(0.01);
        localStorage.setItem('last_std', Date.now());
    });
}

function showPremiumAd() {
    if(!checkCd('last_pre', 120000)) return;
    show_10337853('pop').then(() => {
        reward(0.0102);
        localStorage.setItem('last_pre', Date.now());
    });
}

async function sendChatWithAds() {
    const msg = document.getElementById('chat-input').value.trim();
    if(!msg) return;
    if(!checkCd('last_chat', 300000)) return;

    alert("Watch 3 ads to Send & Earn!");
    try {
        await show_10337853();
        await show_10337853();
        await show_10337853();
        reward(0.015);
        db.ref('chat').push({ user: user, msg: msg, time: Date.now() });
        localStorage.setItem('last_chat', Date.now());
        document.getElementById('chat-input').value = "";
    } catch(e) { alert("Ads incomplete."); }
}

function reward(amt) {
    db.ref('users/'+user).transaction(d => {
        if(d) {
            d.balance += amt;
            d.totalEarned += amt;
            d.adsCount = (d.adsCount || 0) + 1;
        }
        return d;
    });
    // 8% Referral Bonus
    if(uData.refBy) {
        db.ref('users/'+uData.refBy+'/refBonus').transaction(b => (b||0) + (amt * 0.08));
    }
    showPop(amt);
}

// --- REFERRALS ---
function saveReferrer() {
    const ref = document.getElementById('ref-input').value.trim().toLowerCase();
    if(!ref || ref === user || uData.refBy) return;
    db.ref('users/'+ref).once('value', s => {
        if(s.exists()) {
            db.ref('users/'+user).update({ refBy: ref });
            db.ref('users/'+ref+'/refCount').transaction(c => (c||0) + 1);
            alert("Referrer linked!");
        } else alert("User not found!");
    });
}

function claimReferral() {
    if(uData.refBonus > 0) {
        const b = uData.refBonus;
        db.ref('users/'+user).update({ balance: uData.balance + b, refBonus: 0 });
        alert("Claimed ₱"+b.toFixed(3));
    }
}

// --- CASHOUT ---
function processWithdraw() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    const gcash = document.getElementById('wd-gcash').value.trim();
    if(amt < 0.02 || uData.balance < amt || gcash.length < 10) return alert("Check Balance/GCash/Min 0.02");

    db.ref('withdrawals').push({
        username: user, gcash: gcash, amount: amt, status: 'pending', time: Date.now()
    });
    db.ref('users/'+user).update({ balance: uData.balance - amt, gcash: gcash });
    alert("Withdrawal Pending!");
}

// --- HELPERS ---
function checkCd(key, limit) {
    const elapsed = Date.now() - (localStorage.getItem(key) || 0);
    return elapsed >= limit;
}

function updateCooldowns() {
    const now = Date.now();
    updateBtn('last_std', 'btn-std', 'cd-std', 120000);
    updateBtn('last_pre', 'btn-pre', 'cd-pre', 120000);
    updateBtn('last_chat', 'btn-chat', 'cd-chat', 300000);
}

function updateBtn(key, btnId, spanId, limit) {
    const elapsed = Date.now() - (localStorage.getItem(key) || 0);
    const rem = Math.max(0, limit - elapsed);
    if(rem > 0) {
        const m = Math.floor(rem/60000);
        const s = Math.floor((rem%60000)/1000);
        document.getElementById(spanId).innerText = `WAIT ${m}m ${s}s`;
        document.getElementById(btnId).disabled = true;
    } else {
        document.getElementById(spanId).innerText = "READY";
        document.getElementById(btnId).disabled = false;
    }
}

function loadHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(user).on('value', s => {
        const body = document.getElementById('wd-history-body');
        body.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            const date = new Date(w.time).toLocaleDateString();
            body.innerHTML += `<tr><td>${date}</td><td>₱${w.amount}</td><td style="color:${w.status==='paid'?'#0f0':'#f00'}">${w.status}</td></tr>`;
        });
    });
}

function loadLeaderboard() {
    db.ref('users').orderByChild('adsCount').limitToLast(10).on('value', s => {
        const div = document.getElementById('lb-data');
        div.innerHTML = "";
        let arr = []; s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            div.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #333;">
                <span>#${i+1} ${u.username}</span><b>${u.adsCount || 0} ADS</b>
            </div>`;
        });
    });
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const disp = document.getElementById('chat-display');
        disp.innerHTML = "";
        s.forEach(c => {
            const m = c.val();
            disp.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.msg}</div>`;
        });
        disp.scrollTop = disp.scrollHeight;
    });
}

function tab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

function showPop(v) {
    const p = document.getElementById('pop-reward');
    document.getElementById('pop-val').innerText = "₱" + v;
    p.style.display = 'block';
    document.getElementById('reward-anim').className = "reward-circle animate__animated animate__zoomIn";
    setTimeout(() => { p.style.display = 'none'; }, 2000);
}

// --- ADMIN ---
function showAdmin() { tab('page-admin'); }
function authAdmin() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-content').style.display = 'block';
        db.ref('withdrawals').on('value', s => {
            const body = document.getElementById('adm-req-body');
            let paid = 0, reqs = 0; body.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'paid') paid += w.amount;
                else {
                    reqs++;
                    body.innerHTML += `<tr><td>${w.username}</td><td>${w.gcash}</td><td>₱${w.amount}</td><td><button onclick="approve('${c.key}')">PAID</button></td></tr>`;
                }
            });
            document.getElementById('adm-total-paid').innerText = "₱" + paid.toFixed(2);
            document.getElementById('adm-total-req').innerText = reqs;
        });
    }
}
function approve(k) { db.ref('withdrawals/'+k).update({status: 'paid'}); }
function claimBank() {
    if(uData.miniBank > 0) {
        db.ref('users/'+user).update({ balance: uData.balance + uData.miniBank, miniBank: 0 });
        alert("Bank Claimed!");
    }
}
