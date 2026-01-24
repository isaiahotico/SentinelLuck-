
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fb = initializeApp(firebaseConfig);
const db = getDatabase(fb);

let user = null;
let uid = localStorage.getItem('ph_v4_pro_uid');
const REWARD = 0.0105;
const COOLDOWN = 45;
const ZONES = ['show_10276123', 'show_10337795', 'show_10337853'];

const app = {
    init: async () => {
        if (!uid) {
            document.getElementById('login-screen').classList.remove('hidden');
        } else {
            const snap = await get(ref(db, `users/${uid}`));
            if (snap.exists()) {
                user = snap.val();
                app.launch();
            } else {
                document.getElementById('login-screen').classList.remove('hidden');
            }
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Invalid inputs");
        
        uid = 'U' + Math.floor(Math.random() * 9000000);
        user = {
            uid, username: name, gcash, balance: 0, 
            totalAds: 0, dailyAds: 0, weeklyAds: 0, pendingBonus: 0,
            dailyDate: new Date().toDateString(), weeklyId: app.getWeek(),
            referredBy: null
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_v4_pro_uid', uid);
        app.launch();
    },

    getWeek: () => {
        const d = new Date();
        const start = new Date(d.getFullYear(), 0, 1);
        return `${d.getFullYear()}-W${Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7)}`;
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.presence();
        app.nav('home');
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            document.getElementById('u-name').innerText = user.username;
            document.getElementById('u-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('p-name').innerText = user.username;
            document.getElementById('p-gcash').innerText = user.gcash;
            document.getElementById('ref-bonus').innerText = `₱${(user.pendingBonus || 0).toFixed(4)}`;
            
            const isToday = user.dailyDate === new Date().toDateString();
            const isThisWeek = user.weeklyId === app.getWeek();
            document.getElementById('st-d').innerText = isToday ? user.dailyAds : 0;
            document.getElementById('st-w').innerText = isThisWeek ? user.weeklyAds : 0;
            document.getElementById('st-o').innerText = user.totalAds;
            document.getElementById('lb-progress').innerText = `${isThisWeek ? user.weeklyAds : 0} / 10000`;
            app.loadRefList();
        });
    },

    // AD ENGINE
    playAdSequence: async (type) => {
        if (app.cd[type] > 0) return;
        try {
            if (type === 'premium') {
                await show_10276123('pop');
                await show_10337795('pop');
                await show_10337853('pop');
            } else {
                for (const z of ZONES) { if(window[z]) await window[z](); }
            }
            app.reward(REWARD);
            app.startCD(type, COOLDOWN);
        } catch (e) { console.error(e); }
    },

    reward: async (amt) => {
        const d = new Date().toDateString();
        const w = app.getWeek();
        const updates = {};
        
        updates[`users/${uid}/balance`] = (user.balance || 0) + amt;
        updates[`users/${uid}/totalAds`] = (user.totalAds || 0) + 1;
        updates[`users/${uid}/dailyAds`] = (user.dailyDate === d ? user.dailyAds : 0) + 1;
        updates[`users/${uid}/weeklyAds`] = (user.weeklyId === w ? user.weeklyAds : 0) + 1;
        updates[`users/${uid}/dailyDate`] = d;
        updates[`users/${uid}/weeklyId`] = w;

        if (user.referredBy) {
            const refSnap = await get(ref(db, `users/${user.referredBy}`));
            if (refSnap.exists()) {
                const comm = amt * 0.08;
                updates[`users/${user.referredBy}/pendingBonus`] = (refSnap.val().pendingBonus || 0) + comm;
            }
        }
        await update(ref(db), updates);
    },

    cd: { premium: 0, turbo: 0, chat: 0 },
    startCD: (t, s) => {
        app.cd[t] = s;
        const box = document.getElementById(`box-${t}`);
        const timer = document.getElementById(`timer-${t}`);
        if(box) box.classList.add('hidden-el');
        if(timer) timer.classList.remove('hidden-el');

        const itv = setInterval(() => {
            app.cd[t]--;
            if(timer) timer.querySelector('.cd-val').innerText = app.cd[t] + 's';
            if(t === 'chat') document.getElementById('chat-cd-label').innerText = `Cooldown: ${app.cd[t]}s`;
            if (app.cd[t] <= 0) {
                clearInterval(itv);
                if(box) box.classList.remove('hidden-el');
                if(timer) timer.classList.add('hidden-el');
                if(t === 'chat') document.getElementById('chat-cd-label').innerText = "";
            }
        }, 1000);
    },

    // REFERRALS
    claimReferral: async () => {
        const code = document.getElementById('ref-input').value.trim();
        if (!code || code === user.username) return alert("Invalid code");
        const q = query(ref(db, 'users'), orderByChild('username'));
        const snap = await get(q);
        let found = null;
        snap.forEach(c => { if(c.val().username === code) found = c.key; });
        if (found) {
            await update(ref(db, `users/${uid}`), { referredBy: found });
            alert("Referral Synced!");
        } else { alert("User not found"); }
    },

    loadRefList: async () => {
        const q = query(ref(db, 'users'), orderByChild('referredBy'));
        const snap = await get(q);
        const list = document.getElementById('ref-list');
        list.innerHTML = "";
        let count = 0;
        snap.forEach(c => {
            if (c.val().referredBy === uid) {
                count++;
                list.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-[10px] font-bold"><span>${c.val().username}</span><span class="text-yellow-500">Active</span></div>`;
            }
        });
        document.getElementById('ref-count').innerText = count;
    },

    claimBonus: async () => {
        if (!user.pendingBonus || user.pendingBonus <= 0) return;
        const b = user.pendingBonus;
        await update(ref(db, `users/${uid}`), { balance: user.balance + b, pendingBonus: 0 });
        alert(`Claimed ₱${b.toFixed(4)}`);
    },

    // LEADERBOARD
    loadLB: () => {
        onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(10)), s => {
            const list = document.getElementById('lb-earners');
            list.innerHTML = "";
            let items = []; s.forEach(c => items.push(c.val()));
            items.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-xs font-bold"><span>#${i+1} ${u.username}</span><span class="text-green-500">₱${u.balance.toFixed(2)}</span></div>`;
            });
        });
        onValue(query(ref(db, 'users'), orderByChild('weeklyAds'), limitToLast(10)), s => {
            const list = document.getElementById('lb-ads');
            list.innerHTML = "";
            let items = []; s.forEach(c => items.push(c.val()));
            items.reverse().forEach((u, i) => {
                list.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between text-xs font-bold"><span>#${i+1} ${u.username}</span><span class="text-blue-400">${u.weeklyAds || 0} ADS</span></div>`;
            });
        });
    },

    // CHAT
    sendChatMessage: async () => {
        const msg = document.getElementById('chat-input').value.trim();
        if(!msg) return;
        for (const z of ZONES) { try { await window[z](); } catch(e){} }
        await push(ref(db, 'messages'), { u: user.username, t: msg, uid, time: serverTimestamp() });
        document.getElementById('chat-input').value = "";
        if (app.cd.chat <= 0) { app.reward(0.015); app.startCD('chat', 300); }
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(30)), s => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe?'justify-end':''}"><div class="chat-bubble ${isMe?'my-chat':''}"><b>${m.u}</b><br>${m.t}</div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    // ADMIN
    loadAdmin: () => {
        const p = prompt("Password:");
        if (p !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-withdrawals');
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if (w.status === 'pending') {
                    list.innerHTML += `<div class="glass p-3 rounded-xl flex justify-between items-center text-[10px]">
                        <div><b>${w.name}</b><br>₱${w.amount} | ${w.gcash}</div>
                        <button onclick="app.approvePayout('${c.key}')" class="bg-green-600 px-3 py-2 rounded-lg font-bold">PAY</button>
                    </div>`;
                }
            });
        });
    },

    approvePayout: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),

    withdraw: async () => {
        if (user.balance < 1) return alert("Min ₱1.00");
        const amt = user.balance;
        await push(ref(db, 'withdrawals'), {
            uid, name: user.username, gcash: user.gcash, amount: amt, status: 'pending',
            date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), timestamp: serverTimestamp()
        });
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Requested!");
    },

    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username, last_online: serverTimestamp() });
        onDisconnect(pRef).remove();
        onValue(ref(db, 'presence'), s => { document.getElementById('online-indicator').innerText = `${s.size} Online`; });
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-el'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden-el');
        if (id === 'leaderboard') app.loadLB();
        if (id === 'chat') app.loadChat();
        if (id === 'admin') app.loadAdmin();
    }
};

window.app = app;
app.init();
