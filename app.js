
// --- 1. FIREBASE CONFIGURATION AND INITIALIZATION ---

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = firebase.initializeApp(firebaseConfig);
const database = app.database();
const auth = app.auth();
firebase.analytics();

// --- 2. GLOBAL VARIABLES ---

let currentUser = null;
const REWARD_AMOUNT = 0.01;
const MIN_WITHDRAWAL = 0.02;
const ADMIN_PASSWORD = "Propetas12";

// --- 3. AUTHENTICATION (Simplified Telegram ID Login) ---

/**
 * Simulates a sign-in using a Telegram ID as the unique identifier.
 * Note: In a real app, you would use Firebase Auth providers (like Google/Email)
 * or a custom token system for secure authentication.
 */
function signIn() {
    const telegramId = document.getElementById('telegram-id').value.trim();
    if (!telegramId) {
        alert("Please enter your Telegram Username or ID.");
        return;
    }

    // Use a simple custom token or anonymous auth linked to the ID
    // For this demonstration, we use a simple hash/key derived from the ID as the UID
    const uid = btoa(telegramId).replace(/=/g, ""); // Simple pseudo-UID

    // Simulate login success
    currentUser = { uid: uid, displayName: telegramId };
    
    // Check if user exists in DB, if not, create profile
    database.ref('users/' + uid).once('value', snapshot => {
        if (!snapshot.exists()) {
            database.ref('users/' + uid).set({
                displayName: telegramId,
                balance: 0.00,
                totalEarned: 0.00,
                withdrawals: 0.00,
                gcashNumber: ""
            });
        }
        updateUI(true);
        listenForUserData(uid);
        loadChat();
        loadLeaderboard();
    });
}

function signOut() {
    currentUser = null;
    updateUI(false);
    // Clear inputs
    document.getElementById('telegram-id').value = '';
    document.getElementById('admin-content').style.display = 'none';
    alert("Signed out.");
}

function updateUI(loggedIn) {
    document.getElementById('auth-section').style.display = loggedIn ? 'none' : 'block';
    document.getElementById('app-section').style.display = loggedIn ? 'block' : 'none';
    if (loggedIn) {
        document.getElementById('user-display').textContent = currentUser.displayName;
    }
}

// --- 4. USER DATA AND BALANCE MANAGEMENT ---

function listenForUserData(uid) {
    database.ref('users/' + uid).on('value', snapshot => {
        const userData = snapshot.val();
        if (userData) {
            document.getElementById('user-balance').textContent = userData.balance.toFixed(2);
            // Pre-fill GCash number if available
            if (userData.gcashNumber) {
                document.getElementById('gcash-number').value = userData.gcashNumber;
            }
        }
    });
}

/**
 * Rewards the user after they successfully watch an ad.
 */
function rewardUser() {
    if (!currentUser) return;

    const userRef = database.ref('users/' + currentUser.uid);
    userRef.transaction((currentData) => {
        if (currentData) {
            currentData.balance = (currentData.balance || 0) + REWARD_AMOUNT;
            currentData.totalEarned = (currentData.totalEarned || 0) + REWARD_AMOUNT;
        }
        return currentData;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Transaction failed: ", error);
            alert("Reward failed to process. Try again.");
        } else if (committed) {
            alert(`Success! You earned ₱${REWARD_AMOUNT.toFixed(2)}.`);
        }
    });
}

// --- 5. MONETAG AD INTEGRATION ---

function showRewardedAd() {
    if (typeof show_10337853 !== 'function') {
        alert("Ad SDK not fully loaded. Please wait a moment.");
        return;
    }

    // Use the Rewarded Interstitial format
    show_10337853().then(() => {
        // This runs if the user successfully watches the ad
        rewardUser();
    }).catch(e => {
        // This runs if the ad fails to load or is closed prematurely
        console.error("Ad failed or was closed:", e);
        alert("Ad not completed or failed to load. Please try again.");
    });
}

// --- 6. WITHDRAWAL LOGIC ---

function requestWithdrawal() {
    if (!currentUser) return;

    const gcashNumber = document.getElementById('gcash-number').value.trim();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const currentBalance = parseFloat(document.getElementById('user-balance').textContent);
    const messageElement = document.getElementById('withdrawal-message');

    messageElement.textContent = '';

    if (!gcashNumber || gcashNumber.length < 11 || !gcashNumber.startsWith('09')) {
        messageElement.textContent = "Please enter a valid GCash number (e.g., 09xxxxxxxxx).";
        return;
    }
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
        messageElement.textContent = `Minimum withdrawal is ₱${MIN_WITHDRAWAL.toFixed(2)}.`;
        return;
    }
    if (amount > currentBalance) {
        messageElement.textContent = "Insufficient balance.";
        return;
    }

    const userRef = database.ref('users/' + currentUser.uid);

    // 1. Deduct balance and save GCash number
    userRef.transaction((currentData) => {
        if (currentData && currentData.balance >= amount) {
            currentData.balance -= amount;
            currentData.gcashNumber = gcashNumber; // Save for future use
            return currentData;
        }
        return; // Abort transaction if balance check fails
    }, (error, committed, snapshot) => {
        if (error) {
            messageElement.textContent = "Transaction failed. Try again.";
            console.error(error);
        } else if (committed) {
            // 2. Submit request to admin queue
            database.ref('withdrawals').push({
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                amount: amount,
                gcash: gcashNumber,
                status: 'Pending',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            messageElement.textContent = `Withdrawal request for ₱${amount.toFixed(2)} submitted! Processing...`;
            messageElement.style.color = var('--secondary-color');
        } else {
            messageElement.textContent = "Failed: Insufficient balance or data conflict.";
        }
    });
}

// --- 7. CHAT ROOM LOGIC ---

function loadChat() {
    const chatWindow = document.getElementById('chat-window');
    database.ref('chat').limitToLast(50).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        messageElement.innerHTML = `<span class="chat-user">${msg.user}:</span> ${msg.message}`;
        chatWindow.appendChild(messageElement);
        // Auto scroll to bottom
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}

function sendMessage() {
    if (!currentUser) {
        alert("Please sign in to chat.");
        return;
    }
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (message) {
        database.ref('chat').push({
            user: currentUser.displayName,
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        chatInput.value = '';
    }
}

// --- 8. LEADERBOARD LOGIC ---

function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    database.ref('users')
        .orderByChild('totalEarned')
        .limitToLast(10)
        .on('value', (snapshot) => {
            leaderboardList.innerHTML = '';
            let leaders = [];
            snapshot.forEach(childSnapshot => {
                leaders.push(childSnapshot.val());
            });

            // Reverse to get descending order (highest first)
            leaders.reverse().forEach((user, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>#${index + 1} ${user.displayName}</span>
                    <strong>₱${user.totalEarned ? user.totalEarned.toFixed(2) : '0.00'}</strong>
                `;
                leaderboardList.appendChild(li);
            });
        });
}

// --- 9. ADMIN DASHBOARD LOGIC ---

function loginAdmin() {
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('admin-content').style.display = 'block';
        alert("Admin access granted.");
        loadWithdrawalRequests();
    } else {
        alert("Incorrect Admin Password.");
    }
}

function loadWithdrawalRequests() {
    const requestsList = document.getElementById('withdrawal-requests');
    requestsList.innerHTML = '<li>Loading requests...</li>';

    database.ref('withdrawals').orderByChild('status').equalTo('Pending').on('value', (snapshot) => {
        requestsList.innerHTML = '';
        if (!snapshot.exists()) {
            requestsList.innerHTML = '<li>No pending requests.</li>';
            return;
        }

        snapshot.forEach(childSnapshot => {
            const req = childSnapshot.val();
            const reqId = childSnapshot.key;

            const li = document.createElement('li');
            li.style.borderBottom = '1px solid #ddd';
            li.style.padding = '10px 0';
            li.innerHTML = `
                <p><strong>User:</strong> ${req.displayName} (UID: ${req.uid})</p>
                <p><strong>Amount:</strong> ₱${req.amount.toFixed(2)}</p>
                <p><strong>GCash:</strong> ${req.gcash}</p>
                <button onclick="markAsPaid('${reqId}', '${req.uid}')" class="btn btn-success" style="width: auto; padding: 5px 10px;">Mark Paid</button>
                <button onclick="markAsRejected('${reqId}')" class="btn btn-danger" style="width: auto; padding: 5px 10px; margin-left: 5px;">Reject</button>
            `;
            requestsList.appendChild(li);
        });
    });
}

function markAsPaid(requestId, userId) {
    if (confirm("Are you sure you have paid this request?")) {
        database.ref('withdrawals/' + requestId).update({
            status: 'Paid',
            processedBy: currentUser ? currentUser.displayName : 'Admin',
            processedTime: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            alert("Request marked as Paid.");
            // Optional: Update user's withdrawal count
            database.ref('users/' + userId + '/withdrawals').transaction(current => (current || 0) + 1);
        }).catch(e => console.error("Error marking paid:", e));
    }
}

function markAsRejected(requestId) {
    if (confirm("Are you sure you want to reject this request? (You must manually refund the user if necessary)")) {
        database.ref('withdrawals/' + requestId).update({
            status: 'Rejected',
            processedBy: currentUser ? currentUser.displayName : 'Admin',
            processedTime: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            alert("Request marked as Rejected.");
        }).catch(e => console.error("Error marking rejected:", e));
    }
}

// --- 10. UI EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            this.classList.add('active');
            const targetTab = this.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            // Show admin panel if the user is signed in and we are on the earn tab (for easy access)
            if (targetTab === 'earn' && currentUser) {
                document.getElementById('admin-dashboard').style.display = 'block';
            } else {
                document.getElementById('admin-dashboard').style.display = 'none';
            }
        });
    });
    
    // Initial check for sign-in state (if using persistent auth, otherwise rely on manual sign-in)
    updateUI(false);
});
