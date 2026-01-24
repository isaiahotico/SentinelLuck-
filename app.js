
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

// Telegram Setup
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser?.id?.toString() || "local_user_test";
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest";

document.getElementById("userBar").innerText = "👤 User: " + username;

let currentBalance = 0;

// Initialize User Data
async function initUser() {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        await setDoc(userRef, { balance: 0, username: username });
    }

    onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            currentBalance = doc.data().balance;
            document.getElementById("balanceVal").innerText = currentBalance.toFixed(2);
        }
    });

    // Auto In-App Ad Logic
    if (window.show_10337853) {
        show_10337853({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// Global Nav Function
window.nav = (pageId) => {
    document.querySelectorAll('.container').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if (pageId === 'page-withdraw') listenToUserWithdrawals();
    if (pageId === 'page-admin') listenToAdminWithdrawals();
};

// Ad Handling (3 Ads Combined, No Cooldown)
window.handleAdTask = async (taskId) => {
    const btn = document.getElementById(`task${taskId}`);
    btn.disabled = true;
    btn.innerText = "Watching Ads...";

    try {
        // Sequentially show 3 ads
        await show_10276123();
        await show_10337795();
        await show_10337853();

        // Unlock Claim Button
        btn.classList.add('hidden');
        document.getElementById(`claim${taskId}`).classList.remove('hidden');
    } catch (e) {
        alert("Ad failed. Please try again.");
        btn.disabled = false;
        btn.innerText = "Retry Task";
    }
};

window.claimReward = async (taskId) => {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { balance: currentBalance + 0.02 });
    
    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");
    
    // Reset UI for next round (No cooldown)
    document.getElementById(`claim${taskId}`).classList.add('hidden');
    const tBtn = document.getElementById(`task${taskId}`);
    tBtn.classList.remove('hidden');
    tBtn.disabled = false;
    tBtn.innerText = taskId.toString().startsWith('B') ? "💎 BONUS TASK 💎" : `🤑🍍Task #${taskId}🍍🤑`;
};

// Withdrawal Logic
window.submitWithdraw = async () => {
    const name = document.getElementById("gcName").value;
    const num = document.getElementById("gcNum").value;
    const amt = parseFloat(document.getElementById("gcAmt").value);

    if (!name || !num || amt < 0.5) return alert("Fill all fields. Min 0.50");
    if (amt > currentBalance) return alert("Insufficient Balance");

    await addDoc(collection(db, "withdrawals"), {
        userId, username, name, num, amount: amt, status: "pending", timestamp: Date.now()
    });

    await updateDoc(doc(db, "users", userId), { balance: currentBalance - amt });
    alert("Request Submitted!");
};

function listenToUserWithdrawals() {
    const q = query(collection(db, "withdrawals"), where("userId", "==", userId));
    onSnapshot(q, (snap) => {
        const tbody = document.querySelector("#userWithdrawTable tbody");
        tbody.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            tbody.innerHTML += `<tr>
                <td>${new Date(data.timestamp).toLocaleDateString()}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td style="color:${data.status === 'pending' ? 'orange' : 'green'}">${data.status.toUpperCase()}</td>
            </tr>`;
        });
    });
}

// Admin Logic
window.accessAdmin = () => {
    const pw = prompt("Enter Password:");
    if (pw === "Propetas6") nav('page-admin');
};

function listenToAdminWithdrawals() {
    const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const tbody = document.querySelector("#adminWithdrawTable tbody");
        tbody.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${data.username}</td>
                <td>${data.num}<br>${data.name}</td>
                <td>₱${data.amount.toFixed(2)}</td>
                <td><button onclick="approveNow('${d.id}')">Approve</button></td>
            `;
            tbody.appendChild(row);
        });
    });
}

window.approveNow = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved" });
    alert("Paid successfully!");
};

// Footer Clock
setInterval(() => {
    const now = new Date();
    document.getElementById("footerTime").innerText = `PAPERHOUSE INC | ${now.toLocaleString()}`;
}, 1000);

// Start app
initUser();

// Mock Ad functions (These are replaced by real Monetag scripts if they exist)
if (!window.show_10276123) {
    window.show_10276123 = () => new Promise(res => { console.log("Ad 1"); res(); });
    window.show_10337795 = () => new Promise(res => { console.log("Ad 2"); res(); });
    window.show_10337853 = () => new Promise(res => { console.log("Ad 3"); res(); });
}
