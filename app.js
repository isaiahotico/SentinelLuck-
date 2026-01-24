import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit, startAfter,
  getDocs, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* Telegram */
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe.user;
const uid = String(user.id);

/* Instant username */
document.getElementById("username").innerText = user.username || "User";

/* Globals */
const OWNER_PASS = "Propetas6";
let balance = 0;
let userLast = null;
let adminLast = null;

/* Init User */
async function initUser() {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      username: user.username,
      balance: 0,
      country: "PH",
      createdAt: serverTimestamp()
    });
  }

  onSnapshot(ref, d => {
    balance = d.data().balance;
    document.getElementById("balance").innerText = balance.toFixed(3);
  });

  loadUserHistory();
}

/* Ads Reward */
window.watchAd = () => {
  show_10276123().then(() => {
    updateDoc(doc(db, "users", uid), { balance: balance + 0.015 });
  });
};

/* Withdraw */
window.requestWithdraw = async () => {
  const gcash = document.getElementById("gcash").value;
  const amount = Number(document.getElementById("amount").value);

  if (amount < 0.015 || amount > balance) {
    alert("Invalid amount");
    return;
  }

  await addDoc(collection(db, "withdrawals"), {
    uid,
    username: user.username,
    gcash,
    amount,
    status: "pending",
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, "users", uid), {
    balance: balance - amount
  });
};

/* User Pagination */
async function loadUserHistory(next = false) {
  let q = query(
    collection(db, "withdrawals"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(15)
  );

  if (next && userLast) q = query(q, startAfter(userLast));

  const snap = await getDocs(q);
  const h = document.getElementById("history");
  h.innerHTML = "";

  snap.forEach(d => {
    const w = d.data();
    h.innerHTML += `
      <tr>
        <td>${w.createdAt?.toDate().toLocaleString()}</td>
        <td>${w.gcash}</td>
        <td>₱${w.amount}</td>
        <td>${w.status}</td>
      </tr>`;
  });

  userLast = snap.docs[snap.docs.length - 1];
}

window.nextUserPage = () => loadUserHistory(true);
window.prevUserPage = () => loadUserHistory(false);

/* Owner Dashboard */
window.ownerLogin = async () => {
  if (prompt("Owner password") !== OWNER_PASS) return;

  document.getElementById("owner").style.display = "block";

  const users = await getDocs(collection(db, "users"));
  document.getElementById("totalUsers").innerText = users.size;

  let withdrawn = 0, pending = 0;
  const all = await getDocs(collection(db, "withdrawals"));

  all.forEach(d => {
    const w = d.data();
    if (w.status === "approved") withdrawn += w.amount;
    if (w.status === "pending") pending += w.amount;
  });

  document.getElementById("totalWithdraw").innerText = withdrawn.toFixed(3);
  document.getElementById("totalPending").innerText = pending.toFixed(3);

  loadAdminPage();
};

/* Admin Pagination */
async function loadAdminPage(next = false) {
  let q = query(
    collection(db, "withdrawals"),
    orderBy("createdAt", "desc"),
    limit(15)
  );

  if (next && adminLast) q = query(q, startAfter(adminLast));

  const snap = await getDocs(q);
  const t = document.getElementById("adminTable");
  t.innerHTML = "";

  snap.forEach(d => {
    const w = d.data();
    t.innerHTML += `
      <tr>
        <td>${w.username}</td>
        <td>${w.gcash}</td>
        <td>₱${w.amount}</td>
        <td>${w.status}</td>
        <td><button onclick="approve('${d.id}')">Approve</button></td>
      </tr>`;
  });

  adminLast = snap.docs[snap.docs.length - 1];
}

window.nextAdminPage = () => loadAdminPage(true);
window.prevAdminPage = () => loadAdminPage(false);

window.approve = id =>
  updateDoc(doc(db, "withdrawals", id), { status: "approved" });

initUser();
