
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

let user = localStorage.getItem('ph_user');
let userData = null;

// Backgrounds
const colors = ['pink','green','blue','red','violet','yellow','yellowgreen','orange','white','cyan','brown'];
const bricks = [
    'https://www.transparenttextures.com/patterns/brick-wall.png',
    'https://www.transparenttextures.com/patterns/old-wall.png',
    'https://www.transparenttextures.com/patterns/dark-brick-wall.png'
];

function handleGlobalClick(e) {
    const isColor = Math.random() > 0.4;
    const body = document.getElementById('bg-body');
    if(isColor) {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
    } else {
        body.style.backgroundImage = `url('${bricks[Math.floor(Math.random()*bricks.length)]}')`;
        body.style.backgroundColor = '#333';
    }
}

// Auth Logic
if(user) startSession();

function login() {
    const u = document.getElementById('log-user').value.trim().toLowerCase();
    const g = document.getElementById('log-gcash').value.trim();
    const r = document.getElementById('log-ref').value.trim().toLowerCase();

    if(!u || g.length < 10) return alert("Enter Username and valid GCash");

    db.ref('users/'+u).once('value', snap => {
        if(snap.exists()) {
            localStorage.setItem('ph_user', u);
            location.reload();
        } else {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, 
                refBy: r || "none", refBonus: 0, refCount: 0, totalEarned: 0
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').transaction(c => (c||0)+1);
                localStorage.setItem('ph_user', u);
                location.reload();
            });
        }
    });
}

function startSession() {
    db.ref('users/'+user).on('value', snap => {
        userData = snap.val();
        if(!userData) return;
        updateUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-main').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // Tracking Cooldowns via LocalStorage
    setInterval(updateTimers, 1000);
    loadHistory();
    loadChat();
    
    // In-App Interstitial on Open
    setTimeout(() => {
        const last = localStorage.getItem('last_inapp') || 0;
        if(Date.now() - last > 300000) {
            show_10337853({ type: 'inApp', inAppSettings: { frequency: 1, interval: 30 } });
            localStorage.setItem('last_inapp', Date.now());
        }
    }, 3000);
}

function updateUI() {
    document.getElementById('u-bal').innerText = userData.balance.toFixed(4);
    document.getElementById('display-name').innerText = userData.username;
    document.getElementById('u-code').innerText = userData.username;
    document.getElementById('u-ref-count').innerText = userData.refCount || 0;
    document.getElementById('u-ref-bonus').innerText = (userData.refBonus || 0).toFixed(4);
    document.getElementById('u-gcash').innerText = userData.gcash;
}

// Ads and Cooldown Logic
function watchAd(type) {
    const now = Date.now();
    const cdTime = 120000; // 2 minutes

    if(type === 'std') {
        const last = localStorage.getItem('last_std') || 0;
        if(now - last < cdTime) return alert("Cooldown active!");
        show_10337853().then(() => {
            giveReward(0.01);
            localStorage.setItem('last_std', Date.now());
        });
    } else if (type === 'pre') {
        const last = localStorage.getItem('last_pre') || 0;
        if(now - last < cdTime) return alert("Cooldown active!");
        show_10337853('pop').then(() => {
            giveReward(0.0102);
            localStorage.setItem('last_pre', Date.now());
        });
    }
}

function giveReward(amt) {
    db.ref('users/'+user).transaction(d => {
        if(d) {
            d.balance += amt;
            d.totalEarned += amt;
        }
        return d;
    });
    if(userData.refBy !== 'none') {
        db.ref('users/'+userData.refBy+'/refBonus').transaction(b => (b||0) + (amt * 0.08));
    }
    showAnim(amt);
}

function updateTimers() {
    const now = Date.now();
    const cd = 120000;
    const chatCd = 300000;

    const stdLeft = Math.max(0, Math.floor((cd - (now - (localStorage.getItem('last_std') || 0)))/1000));
    document.getElementById('cd-std').innerText = stdLeft > 0 ? `Wait ${stdLeft}s` : "Ready";
    document.getElementById('btn-std').disabled = stdLeft > 0;

    const preLeft = Math.max(0, Math.floor((cd - (now - (localStorage.getItem('last_pre') || 0)))/1000));
    document.getElementById('cd-pre').innerText = preLeft > 0 ? `Wait ${preLeft}s` : "Ready";
    document.getElementById('btn-pre').disabled = preLeft > 0;

    const chatLeft = Math.max(0, Math.floor((chatCd - (now - (localStorage.getItem('last_chat') || 0)))/1000));
    document.getElementById('cd-chat').innerText = chatLeft > 0 ? `Earn CD ${chatLeft}s` : "Chat & Earn Ready";
}

// Chat
function sendChat() {
    const msg = document.getElementById('chat-in').value.trim();
    if(!msg) return;
    const now = Date.now();
    const last = localStorage.getItem('last_chat') || 0;

    if(now - last > 300000) {
        giveReward(0.012);
        localStorage.setItem('last_chat', now);
    }
    db.ref('chat').push({ user: user, msg: msg, time: now });
    document.getElementById('chat-in').value = "";
}

function loadChat() {
    db.ref('chat').limitToLast(15).on('value', snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    db.ref('presence').on('value', snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = "";
        snap.forEach(c => {
            const p = c.val();
            const status = (Date.now() - p.time) < 300000 ? "Online" : "Away";
            list.innerHTML += `${p.user} (${status}), `;
        });
    });
    setInterval(() => db.ref('presence/'+user).set({user: user, time: Date.now()}), 10000);
}

// Withdrawals
function requestWD() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    if(amt >= 0.02 && userData.balance >= amt) {
        db.ref('withdrawals').push({
            username: user, gcash: userData.gcash, amount: amt, status: 'pending', time: Date.now()
        });
        db.ref('users/'+user).update({ balance: userData.balance - amt });
        alert("Requested!");
    } else alert("Invalid Amount");
}

function loadHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(user).on('value', snap => {
        const div = document.getElementById('wd-history');
        div.innerHTML = "";
        snap.forEach(c => {
            const w = c.val();
            div.innerHTML += `<div class="history-item"><span>₱${w.amount.toFixed(2)}</span><span class="status-${w.status}">${w.status.toUpperCase()}</span></div>`;
        });
    });
}

// Admin
function authAdmin() {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-content').style.display = 'block';
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        const div = document.getElementById('adm-requests');
        let total = 0;
        div.innerHTML = "";
        snap.forEach(c => {
            const w = c.val();
            if(w.status === 'paid') total += w.amount;
            if(w.status === 'pending') {
                div.innerHTML += `<div class="card" style="font-size:0.8rem;">
                    ${w.username} - ${w.gcash}<br>Amount: ₱${w.amount}
                    <button class="btn btn-gold" style="padding:5px;" onclick="approve('${c.key}')">Mark Paid</button>
                </div>`;
            }
        });
        document.getElementById('adm-total-paid').innerText = total.toFixed(2);
    });
}

function approve(key) { db.ref('withdrawals/'+key).update({status: 'paid'}); }

// Misc
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

function showAnim(v) {
    const p = document.getElementById('reward-popup');
    document.getElementById('pop-val').innerText = v;
    const anims = ['animate__jackInTheBox', 'animate__bounceIn', 'animate__zoomIn', 'animate__flipInY'];
    document.getElementById('anim-box').className = 'circle animate__animated ' + anims[Math.floor(Math.random()*anims.length)];
    p.style.display = 'block';
    setTimeout(() => p.style.display = 'none', 2000);
}

function showAdmin() { showPage('page-admin'); }

function claimRef() {
    if(userData.refBonus > 0) {
        db.ref('users/'+user).update({ balance: userData.balance + userData.refBonus, refBonus: 0 });
        alert("Claimed!");
    }
}
