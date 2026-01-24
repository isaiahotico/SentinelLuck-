
// Firebase Config
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
let userData = null;

// --- 1. THEMES & BACKGROUNDS ---
const colors = ['pink','green','blue','red','violet','yellow','yellowgreen','orange','white','cyan','brown'];
const bricks = [
    'https://images.unsplash.com/photo-1589939705384-5185138a047a?q=80&w=500', 
    'https://images.unsplash.com/photo-1523413555809-0fb1d4da238d?q=80&w=500',
    'https://images.unsplash.com/photo-1590059132718-26679b1df01d?q=80&w=500'
    // Add up to 25 URLS here
];

function changeBg() {
    const isBrick = Math.random() > 0.5;
    if(isBrick) {
        const brick = bricks[Math.floor(Math.random()*bricks.length)];
        document.body.style.background = `url('${brick}')`;
    } else {
        document.body.style.background = colors[Math.floor(Math.random()*colors.length)];
    }
}

// --- 2. AUTH & LOGIN ---
if(user) autoLogin();

function processLogin() {
    const u = document.getElementById('login-user').value.trim().toLowerCase();
    const g = document.getElementById('login-gcash').value.trim();
    const r = document.getElementById('login-ref').value.trim().toLowerCase();

    if(!u || g.length < 10) return alert("Valid username/GCash required!");

    db.ref('users/' + u).once('value', s => {
        if(s.exists()) {
            localStorage.setItem('ph_username', u);
            location.reload();
        } else {
            db.ref('users/' + u).set({
                username: u, gcash: g, balance: 0, 
                refBy: r || "none", refBonus: 0, refCount: 0,
                dailyAds: 0, dailyEarn: 0, totalEarned: 0,
                lastDate: new Date().toLocaleDateString()
            }).then(() => {
                if(r && r !== u) db.ref('users/'+r+'/refCount').transaction(c => (c||0)+1);
                localStorage.setItem('ph_username', u);
                location.reload();
            });
        }
    });
}

function autoLogin() {
    db.ref('users/' + user).on('value', s => {
        userData = s.val();
        if(!userData) return;
        
        // Reset daily stats if date changed
        const today = new Date().toLocaleDateString();
        if(userData.lastDate !== today) {
            db.ref('users/'+user).update({ dailyAds: 0, dailyEarn: 0, lastDate: today });
        }

        updateUI();
        document.getElementById('page-login').classList.remove('active');
        document.getElementById('page-main').classList.add('active');
        document.getElementById('navbar').style.display = 'flex';
    });

    // Presence
    setInterval(() => {
        db.ref('presence/' + user).set({ lastActive: Date.now(), username: user });
    }, 10000);

    // Initial Interstitial
    setTimeout(showInAppAd, 2000);
}

function updateUI() {
    document.getElementById('bal').innerText = userData.balance.toFixed(2);
    document.getElementById('day-ads').innerText = userData.dailyAds;
    document.getElementById('day-earn').innerText = userData.dailyEarn.toFixed(2);
    document.getElementById('ref-count').innerText = userData.refCount || 0;
    document.getElementById('ref-bonus').innerText = (userData.refBonus || 0).toFixed(2);
    document.getElementById('user-gcash').innerText = userData.gcash;
}

// --- 3. REWARD SYSTEM & ADS ---
function watchAd() {
    show_10337853().then(() => {
        processReward(0.01);
    });
}

function processReward(amt) {
    // Main Reward
    db.ref('users/' + user).transaction(d => {
        if(d) {
            d.balance += amt;
            d.dailyEarn += amt;
            d.totalEarned += amt;
            d.dailyAds += 1;
        }
        return d;
    });

    // 8% Referral Bonus to upline
    if(userData.refBy && userData.refBy !== "none") {
        db.ref('users/' + userData.refBy + '/refBonus').transaction(b => (b||0) + (amt * 0.08));
    }

    showRewardAnimation(amt);
}

function showRewardAnimation(amt) {
    const pop = document.getElementById('reward-popup');
    const target = document.getElementById('reward-anim-target');
    document.getElementById('pop-amt').innerText = "₱" + amt.toFixed(3);
    
    const anims = ['animate__bounceIn', 'animate__zoomInDown', 'animate__flipInX', 'animate__rotateIn', 'animate__jackInTheBox'];
    const randomAnim = anims[Math.floor(Math.random()*anims.length)];
    
    pop.style.display = 'block';
    target.className = 'reward-circle animate__animated ' + randomAnim;
    
    setTimeout(() => { pop.style.display = 'none'; }, 2500);
}

function showInAppAd() {
    const last = localStorage.getItem('last_interstitial') || 0;
    if(Date.now() - last > 300000) { // 5 mins
        show_10337853({ type: 'inApp', inAppSettings: { frequency: 1, interval: 30 } });
        localStorage.setItem('last_interstitial', Date.now());
    }
}

// --- 4. CHAT & MESSAGE ADS ---
function sendChat() {
    const msg = document.getElementById('chat-msg').value;
    const lastChatAd = localStorage.getItem('last_chat_ad') || 0;
    
    if(!msg) return;

    if(Date.now() - lastChatAd > 300000) {
        alert("Watch 2 ads to earn ₱0.012 and send!");
        show_10337853().then(() => {
            show_10337853().then(() => {
                db.ref('chat').push({ user: user, text: msg, time: Date.now() });
                processReward(0.012);
                localStorage.setItem('last_chat_ad', Date.now());
                document.getElementById('chat-msg').value = "";
            });
        });
    } else {
        db.ref('chat').push({ user: user, text: msg, time: Date.now() });
        document.getElementById('chat-msg').value = "";
    }
}

function loadChat() {
    db.ref('chat').limitToLast(15).on('value', snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="msg"><b>${m.user}:</b> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });

    // Online List
    db.ref('presence').on('value', snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = "";
        snap.forEach(c => {
            const p = c.val();
            const diff = (Date.now() - p.lastActive) / 1000;
            const status = diff < 300 ? "Online" : "5 mins ago";
            list.innerHTML += `<div>● ${p.username} - <span style="color:#aaa">${status}</span></div>`;
        });
    });
}
loadChat();

// --- 5. CASHOUT & HELP ---
function claimReferral() {
    if(userData.refBonus > 0) {
        const b = userData.refBonus;
        db.ref('users/'+user).update({ balance: userData.balance + b, refBonus: 0 });
        alert("Claimed ₱" + b.toFixed(2));
    }
}

function withdraw() {
    const amt = parseFloat(document.getElementById('withdraw-amt').value);
    if(amt >= 0.02 && userData.balance >= amt) {
        db.ref('withdrawals').push({ user: user, gcash: userData.gcash, amount: amt, status: 'pending' });
        db.ref('users/'+user).update({ balance: userData.balance - amt });
        alert("Sent!");
    } else {
        alert("Check balance or Min 0.02");
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
