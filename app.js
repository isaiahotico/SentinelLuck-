
// Firebase Configuration
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

let userData = null;
let username = localStorage.getItem('paperhouse_user');

// --- FAST LOGIN LOGIC ---
if (username) {
    autoLogin(username);
}

function processLogin() {
    const user = document.getElementById('reg-username').value.trim().toLowerCase();
    const gcash = document.getElementById('reg-gcash').value.trim();
    const refBy = document.getElementById('reg-ref').value.trim().toLowerCase();

    if (!user || gcash.length < 10) return alert("Enter valid Username & GCash!");

    db.ref('users/' + user).once('value', (snap) => {
        if (snap.exists()) {
            // Existing User: Just Login
            localStorage.setItem('paperhouse_user', user);
            location.reload();
        } else {
            // New User: Register
            const newUser = {
                username: user,
                gcash: gcash,
                balance: 0,
                referredBy: refBy || "none",
                totalEarned: 0
            };
            db.ref('users/' + user).set(newUser).then(() => {
                localStorage.setItem('paperhouse_user', user);
                location.reload();
            });
        }
    });
}

function autoLogin(user) {
    db.ref('users/' + user).on('value', (snap) => {
        userData = snap.val();
        if (userData) {
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('main-screen').classList.add('active');
            document.getElementById('bottom-nav').style.display = 'flex';
            updateDashboard();
        }
    });
    loadChat();
    loadLeaderboard();
}

function updateDashboard() {
    document.getElementById('user-balance').innerText = userData.balance.toFixed(2);
    document.getElementById('draw-gcash').innerText = userData.gcash;
    document.getElementById('ref-display').innerText = "REFERRAL CODE: " + userData.username;
}

// --- MONETAG ADS LOGIC ---
function watchAd() {
    if (typeof show_10337853 === 'function') {
        show_10337853().then(() => {
            rewardUser(0.01);
        }).catch(() => {
            alert("Ad failed. Try again.");
        });
    } else {
        alert("Ads loading... wait 5 seconds");
    }
}

function rewardUser(amount) {
    // 1. Reward the user
    const newBal = (userData.balance || 0) + amount;
    db.ref('users/' + userData.username).update({
        balance: newBal,
        totalEarned: (userData.totalEarned || 0) + amount
    });

    // 2. Best Referral System: Give 20% extra to referrer automatically
    if (userData.referredBy && userData.referredBy !== "none") {
        const refBonus = amount * 0.20;
        db.ref('users/' + userData.referredBy + '/balance').transaction((current) => (current || 0) + refBonus);
    }
    alert("Task Complete! +₱" + amount);
}

// --- WITHDRAWAL ---
function requestWithdraw() {
    const amt = parseFloat(document.getElementById('draw-amount').value);
    if (amt >= 0.02 && userData.balance >= amt) {
        const req = {
            username: userData.username,
            gcash: userData.gcash,
            amount: amt,
            status: 'pending',
            time: Date.now()
        };
        db.ref('withdrawals').push(req);
        db.ref('users/' + userData.username).update({ balance: userData.balance - amt });
        alert("Request Sent!");
    } else {
        alert("Invalid amount or insufficient balance!");
    }
}

// --- NAVIGATION ---
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- CHAT SYSTEM ---
function sendChat() {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    db.ref('chat').push({
        user: userData.username,
        text: msg,
        timestamp: Date.now()
    });
    document.getElementById('chat-input').value = "";
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(child => {
            const m = child.val();
            box.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// --- LEADERBOARD ---
function loadLeaderboard() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', (snap) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let players = [];
        snap.forEach(child => { players.push(child.val()); });
        players.reverse().forEach((p, i) => {
            list.innerHTML += `
                <div class="lb-item">
                    <span>#${i+1} ${p.username}</span>
                    <span style="color:var(--gold)">₱${p.totalEarned.toFixed(2)}</span>
                </div>`;
        });
    });
}

// --- ADMIN DASHBOARD ---
function showAdmin() { showPage('admin-screen'); }
function authAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-requests').style.display = 'block';
        loadRequests();
    } else {
        alert("Wrong Password");
    }
}

function loadRequests() {
    db.ref('withdrawals').on('value', (snap) => {
        const div = document.getElementById('req-list');
        div.innerHTML = "";
        snap.forEach(child => {
            const r = child.val();
            if (r.status === 'pending') {
                div.innerHTML += `
                <div style="background:#000; padding:10px; margin-bottom:5px; border-radius:5px;">
                    ${r.username} | ${r.gcash}<br>Amount: ₱${r.amount}
                    <button class="btn btn-blue" style="padding:5px;" onclick="markPaid('${child.key}')">Mark Paid</button>
                </div>`;
            }
        });
    });
}

function markPaid(key) {
    db.ref('withdrawals/' + key).update({ status: 'paid' });
    alert("Marked as Paid!");
}
