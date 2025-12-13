// Constants
const MIN_WITHDRAW = 1;
const SESSION_REWARD = 0.03;
const SESSION_COOLDOWN = 30;
const ADMIN_PASSWORD = "Propetas6";
const MAX_APPROVED_DISPLAY = 10;

// User initialization
let user = JSON.parse(localStorage.getItem('paperHouseUser'));
if(!user){
    let username = prompt("Enter your username:", "User") || "User";
    let userCode = prompt("Create your permanent code (random string):");
    let referrer = prompt("Enter referral code (if any):") || null;
    user = {
        username,
        code: userCode,
        balance: 0,
        adsWatched: 0,
        referrer: referrer,
        totalAffiliateBonus: 0,
        lastSession: 0,
        withdrawHistory: []
    };
    localStorage.setItem('paperHouseUser', JSON.stringify(user));
}

// Save user
function saveUser(){ localStorage.setItem('paperHouseUser', JSON.stringify(user)); }

// Dashboard
function updateDashboard(){
    const dash = document.getElementById('dashboard');
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((SESSION_COOLDOWN*1000 - (now - user.lastSession))/1000));
    dash.innerHTML = `
╔════════════════════╗<br>
║     PAPER HOUSE INC. ║<br>
╚════════════════════╝<br>
User: ${user.username}<br>
Code: ${user.code}<br>
💰 Balance: ₱${user.balance.toFixed(3)}<br>
🎯 Ads Watched: ${user.adsWatched}<br>
🧾 Total Affiliate Bonus: ₱${user.totalAffiliateBonus.toFixed(3)}<br>
Cooldown: ${remaining>0?remaining+"s":"Ready"}<br>
`;
    updateLeaderboard();
    renderAdminRequests();
}

// Watch all ads
function watchAllAds(){
    const now = Date.now();
    if(now - user.lastSession < SESSION_COOLDOWN*1000){
        alert(`⏳ Cooldown active. Wait ${Math.ceil((SESSION_COOLDOWN*1000-(now-user.lastSession))/1000)}s`);
        return;
    }

    Promise.all([
        show_10276123(),
        show_10276123('pop'),
        show_10276123({ type:'inApp', inAppSettings:{ frequency:2, capping:0.1, interval:30, timeout:5, everyPage:false } })
    ]).then(()=>{
        user.balance += SESSION_REWARD;
        user.adsWatched += 3;
        user.lastSession = Date.now();

        // Referral bonus
        if(user.referrer){
            let allUsers = JSON.parse(localStorage.getItem('allPaperUsers')) || {};
            if(allUsers[user.referrer]){
                allUsers[user.referrer].balance += SESSION_REWARD*0.10;
                allUsers[user.referrer].totalAffiliateBonus += SESSION_REWARD*0.10;
            }
            localStorage.setItem('allPaperUsers', JSON.stringify(allUsers));
        }

        saveUser();
        alert(`✅ Session completed! +₱${SESSION_REWARD}`);
        updateDashboard();
    }).catch(()=>alert("Ad session failed."));
}

// Withdraw request
function withdraw(){
    if(user.balance < MIN_WITHDRAW){
        alert(`Minimum withdrawal is ₱${MIN_WITHDRAW}`);
        return;
    }
    let amount = user.balance;
    user.balance = 0;
    user.lastSession = 0;
    user.withdrawHistory.push({ amount, status:"Pending" });

    // Save global withdrawal requests
    let allRequests = JSON.parse(localStorage.getItem('allWithdrawRequests')) || [];
    allRequests.push({ username:user.username, amount, status:"Pending" });
    localStorage.setItem('allWithdrawRequests', JSON.stringify(allRequests));

    saveUser();
    alert(`💸 Withdrawal requested! Amount: ₱${amount.toFixed(3)} (Admin approval required)`);
    updateDashboard();
}

// Leaderboard
function updateLeaderboard(){
    const lb = document.getElementById('leaderboard');
    let allUsers = JSON.parse(localStorage.getItem('allPaperUsers')) || {};
    allUsers[user.code] = user; // Save current user
    localStorage.setItem('allPaperUsers', JSON.stringify(allUsers));

    if(lb){
        let topUsers = Object.values(allUsers).sort((a,b)=>b.balance-a.balance).slice(0,10);
        let html = "";
        topUsers.forEach((u,i)=>html+=`${i+1}. ${u.username} - ₱${u.balance.toFixed(3)}<br>`);
        lb.innerHTML = html;
    }
}

// Admin Panel
function showAdminPanel(){
    let pass = prompt("Enter admin password:");
    if(pass !== ADMIN_PASSWORD){
        alert("❌ Wrong password!");
        return;
    }
    document.getElementById('admin-panel').style.display = "block";
    renderAdminRequests();
}

function renderAdminRequests(){
    let requestsDiv = document.getElementById('withdraw-requests');
    let allRequests = JSON.parse(localStorage.getItem('allWithdrawRequests')) || [];
    if(allRequests.length===0){
        requestsDiv.innerHTML = "No withdrawal requests yet.";
        return;
    }

    let html = "";
    allRequests.forEach((req,index)=>{
        if(req.status==="Pending"){
            html+=`${index+1}. ${req.username} - ₱${req.amount.toFixed(3)} 
            <button onclick="approveRequest(${index})">✅ Approve</button>
            <button onclick="rejectRequest(${index})">❌ Reject</button><br>`;
        }else{
            html+=`${index+1}. ${req.username} - ₱${req.amount.toFixed(3)} - ${req.status}<br>`;
        }
    });
    requestsDiv.innerHTML = html;
}

function approveRequest(index){
    let allRequests = JSON.parse(localStorage.getItem('allWithdrawRequests'));
    allRequests[index].status = "Approved";
    localStorage.setItem('allWithdrawRequests', JSON.stringify(allRequests));

    // Trigger notification for all users
    showNotification(`${allRequests[index].username} withdrawal approved: ₱${allRequests[index].amount.toFixed(3)}`);

    alert("✅ Withdrawal approved!");
    renderAdminRequests();
}

function rejectRequest(index){
    let allRequests = JSON.parse(localStorage.getItem('allWithdrawRequests'));
    allRequests[index].status = "Rejected";
    localStorage.setItem('allWithdrawRequests', JSON.stringify(allRequests));
    alert("❌ Withdrawal rejected!");
    renderAdminRequests();
}

// Notification
function showNotification(message){
    const container = document.getElementById('notification-container');
    const div = document.createElement('div');
    div.className = "notification";
    div.innerText = message;
    container.appendChild(div);

    div.style.position = "fixed";
    div.style.top = "20px";
    div.style.right = "-300px";
    div.style.background = "#ffcc00";
    div.style.color = "#000";
    div.style.padding = "10px 20px";
    div.style.borderRadius = "5px";
    div.style.zIndex = "9999";
    div.style.whiteSpace = "nowrap";

    let pos = 0;
    const interval = setInterval(()=>{
        pos += 10;
        div.style.right = pos + "px";
        if(pos > window.innerWidth + 300){
            clearInterval(interval);
            container.removeChild(div);
        }
    },20);
}

// Init
saveUser();
updateDashboard();
setInterval(updateDashboard,1000);
