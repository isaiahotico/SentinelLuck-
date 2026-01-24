
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

let currentUser = localStorage.getItem('ph_username');
let uData = null;

// 25+ Background Colors & Bricks
const rainbow = ['#FF0000','#FF7F00','#FFFF00','#00FF00','#0000FF','#4B0082','#9400D3','#FF1493','#00CED1','#ADFF2F','#FF4500','#1E90FF','#DA70D6','#7CFC00','#00FA9A','#FF6347','#00BFFF','#F0E68C','#D2691E','#FF00FF','#1ABC9C','#2ECC71','#3498DB','#9B59B6','#E67E22','#E74C3C'];
const brickPatterns = ['https://www.transparenttextures.com/patterns/brick-wall.png','https://www.transparenttextures.com/patterns/old-wall.png','https://www.transparenttextures.com/patterns/dark-brick-wall.png'];

function triggerBgChange() {
    const body = document.getElementById('dynamic-bg');
    if(Math.random() > 0.3) {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = rainbow[Math.floor(Math.random()*rainbow.length)];
    } else {
        body.style.backgroundColor = '#222';
        body.style.backgroundImage = `url('${brickPatterns[Math.floor(Math.random()*brickPatterns.length)]}')`;
    }
}

// --- AUTH ---
if(currentUser) initUser();

function handleAuth() {
    const u = document.getElementById('in-user').value.trim().toLowerCase();
    const g = document.getElementById('in-gcash').value.trim();
    const r = document.getElementById('in-ref').value.trim().toLowerCase();

    if(!u || g.length < 10) return alert("Enter Username & Valid GCash");

    db.ref('users/'+u).once('value', s => {
        if(s.exists()) {
            localStorage.setItem('ph_username', u);
            location.reload();
        } else {
            db.ref('users/'+u).set({
                username: u, gcash: g, balance: 0, miniBank: 0,
                refBy: r || "none", refBonus: 0, refCount: 0,
                adsCount: 0, totalEarned: 0
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').transaction(c => (c||0)+1);
                localStorage.setItem('ph_username', u);
                location.reload();
            });
        }
    });
}

function initUser() {
    db.ref('users/'+currentUser).on('value', s => {
        uData = s.val();
        if(!uData) return;
        syncUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-home').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });
    
    checkWeeklyReset();
    loadLeaderboard();
    loadChat();
    loadWdHistory();
    setInterval(tickCooldowns, 1000);
}

function syncUI() {
    document.getElementById('bal-main').innerText = uData.balance.toFixed(4);
    document.getElementById('bal-bank').innerText = uData.miniBank.toFixed(2);
    document.getElementById('my-code').innerText = uData.username;
    document.getElementById('my-ref-count').innerText = uData.refCount || 0;
    document.getElementById('my-ref-bonus').innerText = (uData.refBonus || 0).toFixed(4);
    document.getElementById('my-gcash').innerText = uData.gcash;
}

// --- COOLDOWNS (Display in Minutes) ---
function tickCooldowns() {
    const now = Date.now();
    updateCdDisplay('last_std', 'std-cd', 'std-btn', 120000);
    updateCdDisplay('last_pre', 'pre-cd', 'pre-btn', 120000);
    updateCdDisplay('last_chat', 'chat-cd', 'chat-btn', 300000);
}

function updateCdDisplay(key, spanId, btnId, limit) {
    const elapsed = Date.now() - (localStorage.getItem(key) || 0);
    const remaining = Math.max(0, limit - elapsed);
    if(remaining > 0) {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        document.getElementById(spanId).innerText = `Wait ${mins}m ${secs}s`;
        document.getElementById(btnId).disabled = true;
        document.getElementById(btnId).style.opacity = "0.5";
    } else {
        document.getElementById(spanId).innerText = "Ready";
        document.getElementById(btnId).disabled = false;
        document.getElementById(btnId).style.opacity = "1";
    }
}

// --- ADS LOGIC ---
function playAd(type) {
    if(type === 'std') {
        show_10337853().then(() => {
            finalizeReward(0.01);
            localStorage.setItem('last_std', Date.now());
        });
    } else if(type === 'pre') {
        show_10337853('pop').then(() => {
            finalizeReward(0.0102);
            localStorage.setItem('last_pre', Date.now());
        });
    }
}

function finalizeReward(amt) {
    db.ref('users/'+currentUser).transaction(d => {
        if(d) {
            d.balance += amt;
            d.totalEarned += amt;
            d.adsCount = (d.adsCount || 0) + 1;
        }
        return d;
    });
    // 8% Ref Bonus
    if(uData.refBy !== 'none') {
        db.ref('users/'+uData.refBy+'/refBonus').transaction(b => (b||0) + (amt * 0.08));
    }
    popAnim(amt);
}

// --- CHAT ADS (2 Combined) ---
async function sendChatMessage() {
    const msg = document.getElementById('chat-msg').value.trim();
    if(!msg) return;

    alert("Watch 2 ads to earn ₱0.012 and send!");
    try {
        await show_10337853();
        await show_10337853();
        db.ref('chat').push({ user: currentUser, msg: msg, time: Date.now() });
        finalizeReward(0.012);
        localStorage.setItem('last_chat', Date.now());
        document.getElementById('chat-msg').value = "";
    } catch(e) { alert("Ads failed. Try again."); }
}

// --- WEEKLY EVENT & LEADERBOARD ---
function checkWeeklyReset() {
    db.ref('system/lastReset').once('value', s => {
        const lastReset = s.val() || 0;
        const now = Date.now();
        // Reset every Sunday (7 days = 604800000ms)
        if(now - lastReset > 604800000) {
            db.ref('users').orderByChild('adsCount').once('value', users => {
                users.forEach(userSnap => {
                    const u = userSnap.val();
                    if(u.adsCount >= 5000) {
                        db.ref('users/'+u.username+'/miniBank').transaction(b => (b||0) + 25);
                    }
                    db.ref('users/'+u.username+'/adsCount').set(0);
                });
                db.ref('system/lastReset').set(now);
            });
        }
    });
}

function loadLeaderboard() {
    db.ref('users').orderByChild('adsCount').limitToLast(10).on('value', s => {
        const list = document.getElementById('lb-list');
        list.innerHTML = "";
        let arr = [];
        s.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="lb-row"><span>#${i+1} ${u.username}</span><span>${u.adsCount || 0} Ads</span></div>`;
        });
    });
}

// --- BANK & WALLET ---
function claimBank() {
    if(uData.miniBank > 0) {
        const val = uData.miniBank;
        db.ref('users/'+currentUser).update({ balance: uData.balance + val, miniBank: 0 });
        alert("Moved ₱"+val+" to main balance!");
    }
}

function requestWd() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    if(amt >= 0.02 && uData.balance >= amt) {
        db.ref('withdrawals').push({ username: currentUser, gcash: uData.gcash, amount: amt, status: 'pending', time: Date.now() });
        db.ref('users/'+currentUser).update({ balance: uData.balance - amt });
        alert("Request Sent!");
    } else alert("Min 0.02 required.");
}

function loadWdHistory() {
    db.ref('withdrawals').orderByChild('username').equalTo(currentUser).on('value', s => {
        const div = document.getElementById('wd-history');
        div.innerHTML = "";
        s.forEach(c => {
            const w = c.val();
            div.innerHTML += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:5px;"><span>₱${w.amount}</span><span style="color:${w.status==='paid'?'#0f0':'orange'}">${w.status}</span></div>`;
        });
    });
}

// --- UI HELPERS ---
function tab(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

function popAnim(v) {
    const p = document.getElementById('reward-popup');
    const b = document.getElementById('anim-body');
    document.getElementById('pop-amt').innerText = "₱" + v;
    const a = ['animate__bounceIn', 'animate__zoomIn', 'animate__rotateIn', 'animate__jackInTheBox'];
    b.className = 'reward-circle animate__animated ' + a[Math.floor(Math.random()*a.length)];
    p.style.display = 'block';
    setTimeout(() => p.style.display = 'none', 2000);
}

// --- ADMIN ---
function showAdmin() { tab('page-admin'); }
function authAdmin() {
    if(document.getElementById('adm-pass').value === "Propetas12") {
        document.getElementById('adm-data').style.display = 'block';
        db.ref('withdrawals').on('value', s => {
            const list = document.getElementById('adm-pending-list');
            let total = 0; list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'paid') total += w.amount;
                else {
                    list.innerHTML += `<div class="card">${w.username} (${w.gcash}) - ₱${w.amount} <button onclick="approveWd('${c.key}')">MARK PAID</button></div>`;
                }
            });
            document.getElementById('adm-paid-total').innerText = total.toFixed(2);
        });
    }
}
function approveWd(key) { db.ref('withdrawals/'+key).update({status: 'paid'}); }

function loadChat() {
    db.ref('chat').limitToLast(15).on('value', s => {
        const win = document.getElementById('chat-window');
        win.innerHTML = "";
        s.forEach(c => {
            const m = c.val();
            win.innerHTML += `<div class="msg-bubble"><b>${m.user}:</b> ${m.msg}</div>`;
        });
        win.scrollTop = win.scrollHeight;
    });
}
