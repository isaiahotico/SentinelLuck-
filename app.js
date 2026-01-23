
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Telegram Setup ---
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser?.id?.toString() || "guest_user";
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest";
document.getElementById("userBar").innerText = "👤 User: " + username;

let userData = { balance: 0, cooldowns: {} };

// --- Initialize User ---
async function initUser() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        await setDoc(userRef, { username, balance: 0, cooldowns: {} });
    }

    onSnapshot(userRef, (doc) => {
        userData = doc.data();
        document.getElementById("userBalance").innerText = userData.balance.toFixed(2);
        renderTasks();
    });
    
    // Auto Show Interstitial (No reward)
    if(window.show_10337853) {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// --- Navigation ---
window.showPage = (pageId) => {
    document.querySelectorAll('.container').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if(pageId === 'withdrawPage') fetchUserWithdrawals();
};

// --- Ads Logic ---
const tasks = [
    { id: 1, label: "Task #1", wrapper: "3136495" },
    { id: 2, label: "Task #2", wrapper: "3152686" },
    { id: 3, label: "Task #3", wrapper: "3152703" },
    { id: 4, label: "Task #4", wrapper: "3152703" }
];

function renderTasks() {
    const container = document.getElementById("taskList");
    container.innerHTML = "";
    tasks.forEach(t => {
        const lastUsed = userData.cooldowns?.[t.id] || 0;
        const now = Date.now();
        const diff = now - lastUsed;
        const canDo = diff > 300000; // 5 mins

        const div = document.createElement("div");
        div.className = "task-card";
        div.innerHTML = `
            <button class="btn" ${!canDo ? 'disabled' : ''} onclick="runTask(${t.id})">
                🤑🍍${t.label}🍍🤑
            </button>
            <div class="cooldown">${!canDo ? `Wait ${Math.ceil((300000 - diff) / 1000)}s` : 'Ready!'}</div>
            <button id="claim-${t.id}" class="btn hidden" onclick="claimTask(${t.id})" style="background:orange">Claim 0.02</button>
        `;
        container.appendChild(div);
    });
}

window.runTask = async (id) => {
    try {
        // Show 3 Ads in a row
        await show_10276123();
        await show_10337795();
        await show_10337853();
        
        document.getElementById(`claim-${id}`).classList.remove('hidden');
        alert("Ads watched! Click the orange claim button.");
    } catch (e) {
        alert("Ad failed. Check connection.");
    }
};

window.claimTask = async (id) => {
    const userRef = doc(db, "users", userId);
    const newCooldowns = { ...userData.cooldowns, [id]: Date.now() };
    await updateDoc(userRef, {
        balance: userData.balance + 0.02,
        cooldowns: newCooldowns
    });
    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
};

// --- Withdrawal System ---
window.requestWithdrawal = async () => {
    const name = document.getElementById("gcashName").value;
    const num = document.getElementById("gcashNum").value;
    const amt = parseFloat(document.getElementById("withdrawAmount").value);

    if (amt > userData.balance || amt < 0.5) return alert("Insufficient balance or below 0.50");
    
    await addDoc(collection(db, "withdrawals"), {
        userId, username, name, num, amount: amt, status: "pending", date: new Date().toLocaleString()
    });
    
    await updateDoc(doc(db, "users", userId), { balance: userData.balance - amt });
    alert("Withdrawal Requested!");
    showPage('homePage');
};

async function fetchUserWithdrawals() {
    const q = query(collection(db, "withdrawals"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const tbody = document.querySelector("#userWithdrawTable tbody");
    tbody.innerHTML = "";
    snap.forEach(d => {
        tbody.innerHTML += `<tr><td>₱${d.data().amount}</td><td>${d.data().status}</td></tr>`;
    });
}

// --- Owner Dashboard ---
window.checkAdmin = () => {
    const pw = prompt("Enter Owner Password:");
    if (pw === "Propetas6") {
        showPage('adminPage');
        loadAdminData();
    } else {
        alert("Access Denied");
    }
};

function loadAdminData() {
    onSnapshot(collection(db, "withdrawals"), (snap) => {
        const tbody = document.querySelector("#adminTable tbody");
        tbody.innerHTML = "";
        snap.forEach(d => {
            if(d.data().status === "pending") {
                tbody.innerHTML += `
                    <tr>
                        <td>${d.data().username}</td>
                        <td>${d.data().num} (${d.data().name})</td>
                        <td>₱${d.data().amount}</td>
                        <td><button onclick="approveWithdrawal('${d.id}')">Approve</button></td>
                    </tr>`;
            }
        });
    });
}

window.approveWithdrawal = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
    alert("Approved!");
};

// --- Footer Time ---
setInterval(() => {
    document.getElementById("footerText").innerText = new Date().toLocaleString() + " PAPERHOUSE INC";
}, 1000);

initUser();
