
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, query, where, orderBy, limit, startAfter, endBefore, getDocs, limitToLast, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Firebase Configuration ---
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

// --- Telegram Web App Initialization ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand(); // Ensure the app is expanded

const tgUser = tg?.initDataUnsafe?.user;
// Use Telegram ID, or a unique local test ID if not in Telegram (for development)
const userId = tgUser?.id?.toString() || `local_test_${Date.now()}`;
// Get Telegram username or first name, default to "Guest User"
const initialUsername = tgUser ? `@${tgUser.username || tgUser.first_name || 'user'}` : "Guest User";

let userData = { balance: 0, cooldowns: {}, username: initialUsername }; // Initialize with potential username

// Display initial username immediately
document.getElementById("userBar").innerText = `👤 User: ${initialUsername}`;

// --- Pagination State ---
let userLastDoc = null;
let userFirstDoc = null;
let adminLastDoc = null;
let adminFirstDoc = null;
let userCurrentPage = 1;
let adminCurrentPage = 1;
const PAGE_SIZE = 5; // Number of items per page

// --- Initialize User Data and UI ---
async function initializeApp() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        // Create new user document if it doesn't exist
        await setDoc(userRef, { username: initialUsername, balance: 0, cooldowns: {} });
        userData.username = initialUsername; // Ensure local state is consistent
    } else {
        // If user exists, update their username in Firestore if Telegram's is different
        const storedUserData = userSnap.data();
        if (storedUserData.username !== initialUsername) {
            console.log(`Username changed from ${storedUserData.username} to ${initialUsername}. Updating Firestore.`);
            await updateDoc(userRef, { username: initialUsername });
        }
        userData.username = storedUserData.username; // Use stored username as primary until updated
    }
    
    // Real-time updates for user data (balance, cooldowns, and the most current username from Firestore)
    onSnapshot(userRef, (docSnapshot) => {
        const currentData = docSnapshot.data();
        if (currentData) {
            userData = currentData;
            document.getElementById("balanceVal").innerText = userData.balance.toFixed(3);
            document.getElementById("userBar").innerText = `👤 User: ${userData.username}`; // Always display latest from Firestore
            updateCooldownUI();
        }
    });

    // Trigger initial automatic ads
    triggerAutomaticAds();
    
    // Set initial clock and update UI
    updateClock();
    setInterval(updateClock, 1000); // Update clock every second
    setInterval(updateCooldownUI, 1000); // Update cooldowns every second
}

// --- Automatic Ads Logic ---
function triggerAutomaticAds() {
    // 1. Specific In-App Interstitial from your request
    if (window.show_10276123) {
        show_10276123({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }

    // 2. Random Interstitial every 3 Minutes
    const lastRandAdTime = parseInt(localStorage.getItem('last_rand_ad_time') || '0');
    const showRandomAd = () => {
        const zones = [window.show_10337853, window.show_10337795, window.show_10276123]; // Your three random zones
        const randomZone = zones[Math.floor(Math.random() * zones.length)];
        if (randomZone) {
            randomZone().then(() => {
                localStorage.setItem('last_rand_ad_time', Date.now());
            }).catch(err => console.error("Random ad failed:", err));
        }
    };

    // Show ad immediately if it's been over 3 mins since last one
    if (Date.now() - lastRandAdTime > 180000) { // 180,000 ms = 3 minutes
        showRandomAd();
    }
    // Set interval for subsequent ads
    setInterval(showRandomAd, 180000); // Trigger every 3 minutes
}

// --- Navigation Functions ---
window.nav = (pageId) => {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    // Reset pagination state when navigating
    if (pageId === 'page-withdraw') {
        userCurrentPage = 1; userFirstDoc = null; userLastDoc = null;
        fetchUserWithdrawals();
    }
    if (pageId === 'page-admin') {
        adminCurrentPage = 1; adminFirstDoc = null; adminLastDoc = null;
        fetchAdminWithdrawals();
    }
};

// --- Task & Ad Button Logic ---
window.runTask = async (id) => {
    const btn = document.getElementById(`btn-task${id}`);
    const claimBtn = document.getElementById(`claim-${id}`);

    // Prevent multiple clicks while ads are loading
    if (btn.disabled) return; 

    btn.disabled = true;
    btn.innerText = "Watching Ads...";
    btn.style.opacity = '0.8'; // Visual feedback for disabled state

    try {
        // Execute ads based on task ID
        switch(id) {
            case 'T1': // Task #1
                await show_10337853(); await show_10337795(); await show_10276123();
                break;
            case 'T2': // Task #2
                await show_10337853(); await show_10276123(); await show_10337795();
                break;
            case 'T3': // Task #3
                await show_10276123(); await show_10337795(); await show_10337853();
                break;
            case 'B1': // Bonus Task #1 (Example sequence)
                await show_10276123(); await show_10337853(); await show_10337795();
                break;
            case 'B2': // Bonus Task #2 (Example sequence)
                await show_10337795(); await show_10276123(); await show_10337853();
                break;
            case 'B3': // Bonus Task #3 (Example sequence)
                await show_10337853(); await show_10276123(); await show_10337795();
                break;
            default:
                console.warn("Unknown Task ID:", id);
                alert("Task not found. Please try again.");
                btn.disabled = false;
                btn.style.opacity = '1';
                // Reset button text based on task type
                btn.innerText = id.startsWith('B') ? `💎 Bonus Task #${id.substring(1)} 💎` : `🍍Task #${id.substring(1)}🍍`;
                return;
        }

        // Success: Hide task button, show claim button
        btn.classList.add('hidden');
        claimBtn.classList.remove('hidden');
        alert("Ads completed! You can now claim your reward.");
    } catch (error) {
        console.error("Ad sequence error:", error);
        alert("Oops! Ad failed to load properly. Please try again.");
        btn.disabled = false;
        btn.style.opacity = '1';
        // Reset button text based on task type
        btn.innerText = id.startsWith('B') ? `💎 Bonus Task #${id.substring(1)} 💎` : `🍍Task #${id.substring(1)}🍍`;
    }
};

window.claim = async (id, reward) => {
    const userRef = doc(db, "users", userId);
    const cooldownEnd = Date.now() + (20 * 60 * 1000); // 20 minutes in milliseconds

    await updateDoc(userRef, {
        balance: userData.balance + reward,
        [`cooldowns.${id}`]: cooldownEnd // Update specific task cooldown
    });

    alert("🎉Congratulations🎉 you earned some money!!😍🍍🎉");

    // Reset UI for the task
    document.getElementById(`claim-${id}`).classList.add('hidden');
    const taskBtn = document.getElementById(`btn-task${id}`);
    taskBtn.classList.remove('hidden');
    taskBtn.disabled = false; // Re-enable for next round
    taskBtn.style.opacity = '1';
    // Reset button text based on task type
    taskBtn.innerText = id.startsWith('B') ? `💎 Bonus Task #${id.substring(1)} 💎` : `🍍Task #${id.substring(1)}🍍`;
};

// --- Cooldown UI Update ---
function updateCooldownUI() {
    const allTaskIds = ['T1', 'T2', 'T3', 'B1', 'B2', 'B3']; // All task IDs including bonus
    allTaskIds.forEach(id => {
        const expiry = userData.cooldowns?.[id] || 0;
        const btn = document.getElementById(`btn-task${id}`);
        const cdDisplay = document.getElementById(`cooldown${id}`);
        
        if (!btn || !cdDisplay) return; // Skip if elements don't exist yet

        const remainingMillis = expiry - Date.now();
        if (remainingMillis > 0) {
            btn.disabled = true;
            btn.style.opacity = '0.7'; // Indicate disabled state
            const remainingSecs = Math.ceil(remainingMillis / 1000);
            const mins = Math.floor(remainingSecs / 60);
            const secs = remainingSecs % 60;
            cdDisplay.innerText = `Cooldown: ${mins}m ${secs}s`;
        } else {
            btn.disabled = false;
            btn.style.opacity = '1'; // Restore full opacity
            cdDisplay.innerText = ""; // Clear cooldown text if ready
            // Ensure original button text is restored if cooldown just ended
            if (btn.innerText.includes("Watching Ads...") || btn.innerText.includes("Claim ₱")) {
                btn.innerText = id.startsWith('B') ? `💎 Bonus Task #${id.substring(1)} 💎` : `🍍Task #${id.substring(1)}🍍`;
            }
        }
    });
}

// --- Withdrawal Logic ---
window.submitWithdraw = async () => {
    const nameInput = document.getElementById("wName");
    const numInput = document.getElementById("wNum");
    const amtInput = document.getElementById("wAmt");

    const name = nameInput.value.trim();
    const num = numInput.value.trim();
    const amt = parseFloat(amtInput.value);

    if (isNaN(amt) || amt < 0.015) return alert("Minimum withdrawal is ₱0.015");
    if (amt > userData.balance) return alert("Insufficient balance. You only have ₱" + userData.balance.toFixed(3));
    if (!name || !num) return alert("Please fill in your GCash Name and Number.");

    await addDoc(collection(db, "withdrawals"), {
        userId, username: userData.username, name, num, amount: amt, status: "pending", time: Timestamp.now() // Use Firestore Timestamp for better sorting
    });

    await updateDoc(doc(db, "users", userId), { balance: userData.balance - amt });

    alert("Your withdrawal request has been submitted!");
    nameInput.value = ''; // Clear form
    numInput.value = '';
    amtInput.value = '';
    nav('page-home'); // Go back home after submission
};

// --- User Withdrawal Table Pagination ---
async function fetchUserWithdrawals(isNext = true) {
    let userQuery;
    const withdrawalsRef = collection(db, "withdrawals");
    const baseQuery = query(withdrawalsRef, where("userId", "==", userId), orderBy("time", "desc"));

    if (isNext && userLastDoc) {
        userQuery = query(baseQuery, startAfter(userLastDoc), limit(PAGE_SIZE));
    } else if (!isNext && userFirstDoc) {
        userQuery = query(baseQuery, endBefore(userFirstDoc), limitToLast(PAGE_SIZE));
    } else { // Initial load or navigating to first page
        userCurrentPage = 1;
        userQuery = query(baseQuery, limit(PAGE_SIZE));
    }

    const snap = await getDocs(userQuery);
    if (snap.empty) {
        if ((isNext && userCurrentPage > 1) || (!isNext && userCurrentPage > 1)) {
            // If tried to go next/prev but no more docs, revert page count
            if (isNext) userCurrentPage--; else userCurrentPage++;
        }
        renderWithdrawalTable("userWithdrawTable", snap); // Render empty table or current docs
        userFirstDoc = null; userLastDoc = null;
        updatePaginationInfo("user");
        return;
    }

    userFirstDoc = snap.docs[0];
    userLastDoc = snap.docs[snap.docs.length - 1];
    renderWithdrawalTable("userWithdrawTable", snap);
    updatePaginationInfo("user");
}

function renderWithdrawalTable(tableId, snap) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = "";
    if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="3">No withdrawal requests found.</td></tr>`;
        return;
    }
    snap.forEach(doc => {
        const data = doc.data();
        const date = data.time.toDate().toLocaleDateString(); // Convert Firestore Timestamp to Date
        const status = data.status.toUpperCase();
        const statusColor = status === 'PENDING' ? 'orange' : (status === 'APPROVED' ? 'green' : 'red');
        tbody.innerHTML += `<tr>
            <td>${date}</td>
            <td>₱${data.amount.toFixed(3)}</td>
            <td style="color: ${statusColor}; font-weight: bold;">${status}</td>
        </tr>`;
    });
}

function updatePaginationInfo(type) {
    const pageInfoElement = document.getElementById(`${type}PageInfo`);
    if (pageInfoElement) {
        pageInfoElement.innerText = `Page ${type === 'user' ? userCurrentPage : adminCurrentPage}`;
    }
}

window.changeUserPage = async (next) => {
    if (next) userCurrentPage++;
    else userCurrentPage = Math.max(1, userCurrentPage - 1); // Don't go below page 1
    
    await fetchUserWithdrawals(next);
};

// --- Admin Dashboard Logic ---
window.adminCheck = () => {
    const password = prompt("Enter Owner Password:");
    if (password === "Propetas6") {
        nav('page-admin');
    } else {
        alert("Access Denied!");
    }
};

async function fetchAdminWithdrawals(isNext = true) {
    let adminQuery;
    const withdrawalsRef = collection(db, "withdrawals");
    const baseQuery = query(withdrawalsRef, where("status", "==", "pending"), orderBy("time", "asc"));

    if (isNext && adminLastDoc) {
        adminQuery = query(baseQuery, startAfter(adminLastDoc), limit(PAGE_SIZE));
    } else if (!isNext && adminFirstDoc) {
        adminQuery = query(baseQuery, endBefore(adminFirstDoc), limitToLast(PAGE_SIZE));
    } else { // Initial load or navigating to first page
        adminCurrentPage = 1;
        adminQuery = query(baseQuery, limit(PAGE_SIZE));
    }

    const snap = await getDocs(adminQuery);
    if (snap.empty) {
        if ((isNext && adminCurrentPage > 1) || (!isNext && adminCurrentPage > 1)) {
            if (isNext) adminCurrentPage--; else adminCurrentPage++;
        }
        renderAdminTable(snap);
        adminFirstDoc = null; adminLastDoc = null;
        updatePaginationInfo("admin");
        return;
    }

    adminFirstDoc = snap.docs[0];
    adminLastDoc = snap.docs[snap.docs.length - 1];
    renderAdminTable(snap);
    updatePaginationInfo("admin");
}

function renderAdminTable(snap) {
    const tbody = document.querySelector("#adminWithdrawTable tbody");
    tbody.innerHTML = "";
    if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5">No pending withdrawal requests.</td></tr>`;
        return;
    }
    snap.forEach(doc => {
        const data = doc.data();
        tbody.innerHTML += `<tr>
            <td>${data.username || 'N/A'}</td>
            <td>${data.num}<br>${data.name}</td>
            <td>₱${data.amount.toFixed(3)}</td>
            <td>${data.status.toUpperCase()}</td>
            <td><button class="admin-approve-btn" onclick="approveWithdrawal('${doc.id}')">Approve</button></td>
        </tr>`;
    });
}

window.approveWithdrawal = async (id) => {
    const withdrawalRef = doc(db, "withdrawals", id);
    await updateDoc(withdrawalRef, { status: "approved" });
    alert("Withdrawal approved!");
    // Refresh the admin list to remove the approved item
    fetchAdminWithdrawals(); 
};

window.changeAdminPage = async (next) => {
    if (next) adminCurrentPage++;
    else adminCurrentPage = Math.max(1, adminCurrentPage - 1); // Don't go below page 1

    await fetchAdminWithdrawals(next);
};

// --- Clock and Initialization ---
function updateClock() {
    document.getElementById("footerClock").innerText = `PAPERHOUSE INC | ${new Date().toLocaleString()}`;
}

// Initialize the app
initializeApp();

// Mock Ad functions for local testing if Monetag scripts aren't loaded
if (!window.show_10276123) {
    console.warn("Monetag SDKs not found. Using mock functions for ads.");
    const mockAdDelay = 1500; // 1.5 seconds per mock ad
    window.show_10276123 = () => new Promise(res => { console.log("Mock Ad 1 (10276123)"); setTimeout(res, mockAdDelay); });
    window.show_10337795 = () => new Promise(res => { console.log("Mock Ad 2 (10337795)"); setTimeout(res, mockAdDelay); });
    window.show_10337853 = () => new Promise(res => { console.log("Mock Ad 3 (10337853)"); setTimeout(res, mockAdDelay); });
}
