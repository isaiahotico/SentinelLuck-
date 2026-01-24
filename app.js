ChatGPT | Midjourney:
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, 
    serverTimestamp, where, doc, setDoc, getDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 1. Telegram Identity
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "test_user", username: "Guest", first_name: "Web" };
const userId = String(user.id);
const fullUsername = `@${user.username || user.first_name}`;

document.getElementById('u-name').innerText = `👤 ${fullUsername}`;

// 2. Real-time User Data & Balance
const userRef = doc(db, "users", userId);
async function initUser() {
    const snap = await getDoc(userRef);
    if(!snap.exists()) {
        await setDoc(userRef, { username: fullUsername, balance: 0.010 }); // Starting bonus
    }
    onSnapshot(userRef, (d) => {
        document.getElementById('u-balance').innerText = `₱ ${d.data().balance.toFixed(3)}`;
    });
}
initUser();

// 3. Global Real-time Chat (3 Days Filter)
const chatWindow = document.getElementById('chat-window');
const qChat = query(
    collection(db, "messages"),
    where("timestamp", ">=", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
    orderBy("timestamp", "asc")
);

onSnapshot(qChat, (snap) => {
    chatWindow.innerHTML = "";
    snap.forEach(d => {
        const m = d.data();
        chatWindow.innerHTML += `<div class="m"><b>${m.user}:</b> ${m.text}</div>`;
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

document.getElementById('sendChat').onclick = async () => {
    const input = document.getElementById('chatMsg');
    if(!input.value) return;
    await addDoc(collection(db, "messages"), {
        user: fullUsername,
        text: input.value,
        timestamp: serverTimestamp()
    });
    input.value = "";
};

// 4. Withdrawal Logic (Min 0.015)
window.handleWithdraw = async () => {
    const name = document.getElementById('gName').value;

    const num = document.getElementById('gNum').value;
    const amt = parseFloat(document.getElementById('gAmt').value);
    
    const snap = await getDoc(userRef);
    const currentBalance = snap.data().balance;

    if(amt < 0.015) return alert("Minimum withdrawal is ₱0.015");
    if(amt > currentBalance) return alert("Insufficient balance");
    if(!name || !num) return alert("Fill all fields");

    await addDoc(collection(db, "withdrawals"), {
        uid: userId,
        user: fullUsername,
        gcashName: name,
        gcashNum: num,
        amount: amt,
        status: "pending",
        timestamp: serverTimestamp()
    });

    await updateDoc(userRef, { balance: increment(-amt) });
    alert("Request Sent!");
};

// 5. Withdrawal History Table
const qHistory = query(collection(db, "withdrawals"), where("uid", "==", userId));
onSnapshot(qHistory, (snap) => {
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";
    snap.forEach(d => {
        const data = d.data();
        tbody.innerHTML += `<tr><td>${data.timestamp?.toDate().toLocaleDateString() || ''}</td><td>₱${data.amount}</td><td class="status-${data.status}">${data.status}</td></tr>`;
    });
});

// 6. Owner Dashboard (Live Approval)
const qAdmin = query(collection(db, "withdrawals"), where("status", "==", "pending"));
onSnapshot(qAdmin, (snap) => {
    const tbody = document.getElementById('adminBody');
    tbody.innerHTML = "";
    snap.forEach(d => {
        const data = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${data.user}</td>
            <td>${data.gcashNum}</td>
            <td>₱${data.amount}</td>
            <td>
                <button onclick="approve('${d.id}')" style="background:#27ae60; padding:5px; margin-bottom:2px;">✔</button>
                <button onclick="reject('${d.id}', '${data.uid}', ${data.amount})" style="background:#c0392b; padding:5px;">✖</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
});

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
};

window.reject = async (id, uid, amt) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "rejected" });
    await updateDoc(doc(db, "users", uid), { balance: increment(amt) }); // Refund user
};

// 7. Simulated Ad Reward
document.getElementById('claimReward').onclick = async () => {
    tg.showConfirm("Watch ad for ₱0.005?", async (ok) => {
        if(ok) {
            await updateDoc(userRef, { balance: increment(0.005) });
            tg.showAlert("₱0.005 added to balance!");
        }
    });
};
