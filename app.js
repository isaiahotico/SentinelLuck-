
// app.js

// --- Firebase Configuration ---
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, collection, setDoc, getDoc, updateDoc, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c", // Replace with your actual Firebase API Key
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// --- Configuration Constants ---
const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE'; // *** IMPORTANT: Replace with your actual YouTube Data API v3 key ***
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_REGION_CODE = 'PH'; // Philippines

const REWARD_PER_VIDEO_PLAY = 0.005; // Peso awarded for each 1-minute video play or full video watch
const REWARD_PER_AD_SEQUENCE = 0.025; // Peso awarded after watching 2 ads
const COUNTDOWN_DURATION = 60; // seconds for video countdown
const MONETAG_ZONES = [
    '10276123', // Monetag Zone 1
    '10337795', // Monetag Zone 2
    '10337853'  // Monetag Zone 3
];
const LEADERBOARD_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const ADMIN_PASSWORD = 'Propetas6';

const LOCAL_STORAGE_KEYS = {
    LEADERBOARD_CACHE: 'leaderboardCache',
    ADMIN_LOGGED_IN: 'adminLoggedIn'
};


// --- Global Variables (now synchronized with Firebase) ---
let player; // YouTube Player instance
let currentPeso = 0.000; // Loaded from Firebase
let userPlaylist = []; // Loaded from Firebase
let currentVideoIndex = 0; // Loaded from Firebase profile, or derived from it
let unplayedVideoIndices = []; // Derived from userPlaylist, also managed locally
let userName = ''; // Loaded from Firebase

let currentUser = null; // Firebase User object
let isAdminLoggedIn = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN) === 'true';

let leaderboardCache = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LEADERBOARD_CACHE)) || { timestamp: 0, videos: [] };

let countdownInterval;
let countdownSeconds = COUNTDOWN_DURATION;
let isPlayerReady = false; // Flag to indicate if YT player API is ready
let isAdShowing = false; // Flag to prevent multiple ad calls / UI interaction during ads
let isLeaderboardLoading = false; // Flag to prevent multiple leaderboard fetches

// --- Get DOM elements ---
// Header
const coinDisplay = document.getElementById('coinDisplay');
const pesoBalanceSpan = document.getElementById('pesoBalance');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const withdrawalRoomBtn = document.getElementById('withdrawalRoomBtn');
const adminBtn = document.getElementById('adminBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Auth Page
const authPage = document.getElementById('authPage');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authMessage = document.getElementById('authMessage');

// Player Page
const playerPage = document.getElementById('playerPage');
const playerDiv = document.getElementById('player');
const playBtn = document.getElementById('playBtn');
const nextBtn = document.getElementById('nextBtn');
const youtubeUrlInput = document.getElementById('youtubeUrlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const userPlaylistDisplay = document.getElementById('userPlaylistDisplay');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const adLoadingOverlay = document.getElementById('adLoadingOverlay');
const resetPlaylistBtn = document.getElementById('resetPlaylistBtn');

// Profile Page
const profilePage = document.getElementById('profilePage');
const userNameInput = document.getElementById('userNameInput');
const totalViewsCountSpan = document.getElementById('totalViewsCount');
const profilePesoBalanceSpan = document.getElementById('profilePesoBalance');
const profileVideoList = document.getElementById('profileVideoList');
const backToPlayerBtn = document.getElementById('backToPlayerBtn');

// Leaderboard Page
const leaderboardPage = document.getElementById('leaderboardPage');
const leaderboardCategoryFilter = document.getElementById('leaderboardCategoryFilter');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
const leaderboardLoadingOverlay = document.getElementById('leaderboardLoadingOverlay');
const leaderboardList = document.getElementById('leaderboardList');
const backToPlayerFromLeaderboardBtn = document.getElementById('backToPlayerFromLeaderboardBtn');

// Withdrawal Room Page
const withdrawalRoomPage = document.getElementById('withdrawalRoomPage');
const withdrawalBalanceSpan = document.getElementById('withdrawalBalance');
const gcashNumberInput = document.getElementById('gcashNumberInput');
const withdrawalAmountInput = document.getElementById('withdrawalAmountInput');
const submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');
const withdrawalFormMessage = document.getElementById('withdrawalFormMessage');
const withdrawalHistoryTableBody = document.querySelector('#withdrawalHistoryTable tbody');
const emptyWithdrawalHistoryMessage = document.getElementById('emptyWithdrawalHistoryMessage');
const backToPlayerFromWithdrawalBtn = document.getElementById('backToPlayerFromWithdrawalBtn');

// Admin Page
const adminPage = document.getElementById('adminPage');
const adminLoginDiv = document.getElementById('adminLogin');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginMessage = document.getElementById('adminLoginMessage');
const adminContentDiv = document.getElementById('adminContent');
const pendingWithdrawalsTableBody = document.querySelector('#pendingWithdrawalsTable tbody');
const emptyPendingWithdrawalsMessage = document.getElementById('emptyPendingWithdrawalsMessage');
const allWithdrawalsTableBody = document.querySelector('#allWithdrawalsTable tbody');
const emptyAllWithdrawalsMessage = document.getElementById('emptyAllWithdrawalsMessage');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const backToPlayerFromAdminBtn = document.getElementById('backToPlayerFromAdminBtn');


// Audio elements for UI feedback (you need to provide these MP3 files in assets/sounds/)
const clickSound = document.getElementById('clickSound');
const rewardSound = document.getElementById('rewardSound');
const errorSound = document.getElementById('errorSound');

// Footer
const currentDateTimeSpan = document.getElementById('currentDateTime');


// --- Utility Functions ---

/**
 * Plays a short UI sound effect.
 * @param {HTMLAudioElement} audioElement - The audio element to play.
 */
function playSound(audioElement) {
    if (audioElement) {
        audioElement.currentTime = 0; // Rewind to start
        audioElement.play().catch(e => console.warn("Failed to play sound:", e));
    }
}

/**
 * Updates the displayed peso balance. (Saving to Firebase is handled by `updateProfileInFirestore`)
 */
function updateCoinDisplay() {
    pesoBalanceSpan.textContent = currentPeso.toFixed(3);
    profilePesoBalanceSpan.textContent = currentPeso.toFixed(3);
    withdrawalBalanceSpan.textContent = currentPeso.toFixed(3); // Update withdrawal balance too
}

/**
 * Switches the active page display.
 * @param {string} pageId - The ID of the page to show.
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    // Ensure scroll position is reset to top for new pages
    const mainAppContainer = document.getElementById('app');
    if (mainAppContainer) {
        mainAppContainer.scrollTop = 0;
    }
}

/**
 * Formats a number for display as view count (e.g., 1.2M, 523K).
 * @param {number} num - The number of views.
 * @returns {string} Formatted view count.
 */
function formatViewCount(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
}

/**
 * Updates the visual representation of the user's playlist on the main player page.
 * Highlights the actively playing video and provides remove functionality.
 */
function updatePlaylistDisplay() {
    userPlaylistDisplay.innerHTML = ''; // Clear existing list
    if (userPlaylist.length === 0) {
        userPlaylistDisplay.innerHTML = '<li class="empty-message">No videos in your elite playlist. Add some YouTube URLs!</li>';
        return;
    }

    userPlaylist.forEach((video, index) => {
        const li = document.createElement('li');
        li.dataset.videoId = video.id; // Store YouTube ID for easy access
        li.dataset.videoTitle = video.title; // Store title for display
        li.classList.add('playlist-item');
        if (index === currentVideoIndex) {
            li.classList.add('active-video');
        }

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('video-title');
        titleSpan.textContent = `${index + 1}. ${video.title || 'Untitled Global Stream'}`;
        li.appendChild(titleSpan);

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-video-btn');
        removeBtn.innerHTML = '✖️'; // Cross icon for removal
        removeBtn.title = 'Remove from playlist';
        removeBtn.onclick = async (e) => { // Made async for Firebase update
            e.stopPropagation(); // Prevent the li's click event from firing
            playSound(clickSound);
            await removeVideoFromPlaylist(index); // Await Firebase update
        };
        li.appendChild(removeBtn);

        li.onclick = () => {
            playSound(clickSound);
            if (index !== currentVideoIndex) {
                currentVideoIndex = index;
                // No localStorage.setItem here, playlist and currentVideoIndex are updated via Firebase through updateProfileInFirestore
                loadVideo(userPlaylist[currentVideoIndex].id);
                player.playVideo(); // Attempt to play directly
                updatePlaylistDisplay(); // Re-render to highlight new active video
            } else {
                // If it's the current video, toggle play/pause
                if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else if (player && (player.getPlayerState() === YT.PlayerState.PAUSED || player.getPlayerState() === YT.PlayerState.CUED)) {
                    player.playVideo();
                }
            }
        };

        userPlaylistDisplay.appendChild(li);
    });
    // The actual saving of userPlaylist to Firebase is handled when an item is added/removed
}

/**
 * Removes a video from the playlist at a specific index and updates Firebase.
 * @param {number} index - The index of the video to remove.
 */
async function removeVideoFromPlaylist(index) {
    if (!currentUser) return; // Must be logged in

    if (confirm(`Confirm removal of "${userPlaylist[index].title || 'this Global Stream'}" from your playlist?`)) {
        const removedIsCurrent = (index === currentVideoIndex);
        
        userPlaylist.splice(index, 1); // Update local playlist
        
        if (userPlaylist.length === 0) {
            currentVideoIndex = 0;
            unplayedVideoIndices = []; // Clear unplayed indices as well
            if (player) player.stopVideo(); // Stop player if no videos left
            stopCountdown();
            countdownOverlay.classList.remove('active');
            alert('Your playlist is now empty. Time to curate new streams!');
        } else if (removedIsCurrent) {
            currentVideoIndex = currentVideoIndex % userPlaylist.length;
            populateUnplayedIndices(); // Rebuild unplayed indices to account for removal
            if (userPlaylist.length > 0) { // Only load if there's still videos
                loadVideo(userPlaylist[currentVideoIndex].id);
                player.playVideo(); // Attempt to play the new current video
            } else {
                player.cueVideoById(''); // Clear player if no videos left
            }
        } else if (index < currentVideoIndex) {
            currentVideoIndex--;
        }
        
        // Update user profile in Firebase
        await updateProfileInFirestore({
            playlist: userPlaylist,
            currentVideoIndex: currentVideoIndex // Save new current index
        });
        
        updatePlaylistDisplay();
        updateProfilePage(); // Also update profile page to reflect change
        updateCoinDisplay(); 
    }
}

/**
 * Extracts the YouTube video ID from a given URL.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The video ID or null if not found.
 */
function extractYouTubeID(url) {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Updates the current date and time displayed in the footer.
 */
function updateDateTime() {
    const now = new Date();
    const options = { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true 
    };
    currentDateTimeSpan.textContent = now.toLocaleDateString('en-US', options);
}

/**
 * Populates or replenishes the list of unplayed video indices for a cycle.
 */
function populateUnplayedIndices() {
    if (userPlaylist.length === 0) {
        unplayedVideoIndices = [];
        return;
    }

    if (unplayedVideoIndices.length === 0 || unplayedVideoIndices.length !== userPlaylist.length) {
        unplayedVideoIndices = Array.from({ length: userPlaylist.length }, (_, i) => i);
        // Shuffle the unplayed indices for random play within a cycle
        for (let i = unplayedVideoIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unplayedVideoIndices[i], unplayedVideoIndices[j]] = [unplayedVideoIndices[j], unplayedVideoIndices[i]];
        }
        console.log("New cycle started. Unplayed indices shuffled:", unplayedVideoIndices);
    }
}

// --- Firebase Integration (Auth, Profile, Withdrawals) ---

/**
 * Authenticates a user with email and password.
 * @param {string} email
 * @param {string} password
 * @param {boolean} isSignup - True for signup, false for login.
 */
async function authenticateUser(email, password, isSignup) {
    playSound(clickSound);
    authMessage.textContent = '';
    authMessage.classList.remove('success-message', 'error-message');

    try {
        if (isSignup) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Create user profile in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: `User-${userCredential.user.uid.substring(0, 6)}`,
                balance: 0.000,
                playlist: [],
                totalViews: 0,
                createdAt: serverTimestamp()
            });
            authMessage.textContent = 'Account created successfully! Logging in...';
            authMessage.classList.add('success-message');
            playSound(rewardSound);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            authMessage.textContent = 'Logged in successfully!';
            authMessage.classList.add('success-message');
            playSound(rewardSound);
        }
    } catch (error) {
        console.error('Authentication error:', error);
        authMessage.textContent = `Error: ${error.message}`;
        authMessage.classList.add('error-message');
        playSound(errorSound);
    }
}

/**
 * Signs out the current user.
 */
async function logoutUser() {
    playSound(clickSound);
    try {
        await signOut(auth);
        alert('You have been logged out.');
        // onAuthStateChanged will handle UI updates
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out: ' + error.message);
        playSound(errorSound);
    }
}

/**
 * Fetches user profile data from Firestore or creates a new one.
 * Populates local variables (`userName`, `currentPeso`, `userPlaylist`, `currentVideoIndex`).
 * @param {string} uid - The Firebase User ID.
 */
async function fetchUserProfile(uid) {
    const userDocRef = doc(db, 'users', uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            userName = userData.name || `User-${uid.substring(0, 6)}`;
            currentPeso = userData.balance || 0.000;
            userPlaylist = userData.playlist || [];
            currentVideoIndex = userData.currentVideoIndex !== undefined ? userData.currentVideoIndex : 0;
            // totalViews is updated by onPlayerStateChange but stored in Firestore

            populateUnplayedIndices(); // Re-populate for the loaded playlist
        } else {
            // This should ideally not happen if profile is created on signup, but as a safeguard
            console.warn(`User profile for ${uid} not found. Creating a new one.`);
            await setDoc(userDocRef, {
                name: `User-${uid.substring(0, 6)}`,
                balance: 0.000,
                playlist: [],
                totalViews: 0,
                createdAt: serverTimestamp(),
                currentVideoIndex: 0
            });
            // Recursively call to load the new profile
            await fetchUserProfile(uid);
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        alert('Error loading your profile. Please try again.');
        playSound(errorSound);
        // Attempt to log out if profile fetch fails severely
        await logoutUser();
    }
}

/**
 * Updates specific fields in the current user's Firestore profile document.
 * @param {object} updates - An object containing fields to update (e.g., { balance: 10.0, name: "New Name" }).
 */
async function updateProfileInFirestore(updates) {
    if (!currentUser) {
        console.warn("Attempted to update profile but no user is logged in.");
        return;
    }
    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
        await updateDoc(userDocRef, updates);
        console.log("User profile updated in Firestore:", updates);
    } catch (error) {
        console.error('Error updating user profile in Firestore:', error);
        playSound(errorSound);
    }
}

/**
 * Sets up listeners for user-specific data after login.
 */
let unsubscribeUserWithdrawals = null;
function setupUserListeners() {
    // 1. Withdrawal history listener
    if (unsubscribeUserWithdrawals) unsubscribeUserWithdrawals(); // Stop previous listener
    
    if (currentUser) {
        const q = query(collection(db, 'withdrawals'), where('userId', '==', currentUser.uid), orderBy('requestedAt', 'desc'));
        unsubscribeUserWithdrawals = onSnapshot(q, (snapshot) => {
            const userWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderWithdrawalHistory(userWithdrawals);
        }, (error) => {
            console.error("Error listening to user withdrawals:", error);
            playSound(errorSound);
        });
    } else {
        // Clear history if no user logged in
        renderWithdrawalHistory([]);
    }
}

/**
 * Clears all user-specific data and UI elements on logout.
 */
function resetAppData() {
    currentPeso = 0.000;
    userPlaylist = [];
    currentVideoIndex = 0;
    unplayedVideoIndices = [];
    userName = '';
    
    // Stop any active player
    if (player) {
        player.stopVideo();
        player.cueVideoById('');
    }
    stopCountdown();
    countdownOverlay.classList.remove('active');

    // Clear UI
    updateCoinDisplay();
    updatePlaylistDisplay();
    updateProfilePage();
    renderWithdrawalHistory([]); // Clear user withdrawal history display

    // Unsubscribe from real-time listeners
    if (unsubscribeUserWithdrawals) unsubscribeUserWithdrawals();
    unsubscribeUserWithdrawals = null;

    // Reset admin state
    isAdminLoggedIn = false;
    localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN, 'false');
    if (unsubscribeAdminWithdrawals) unsubscribeAdminWithdrawals();
    unsubscribeAdminWithdrawals = null;
}

/**
 * Toggles header button visibility based on login status.
 * @param {boolean} isLoggedIn - True if user is logged in, false otherwise.
 */
function toggleHeaderButtons(isLoggedIn) {
    coinDisplay.classList.toggle('hidden', !isLoggedIn);
    viewProfileBtn.classList.toggle('hidden', !isLoggedIn);
    leaderboardBtn.classList.toggle('hidden', !isLoggedIn);
    withdrawalRoomBtn.classList.toggle('hidden', !isLoggedIn);
    adminBtn.classList.toggle('hidden', !isLoggedIn);
    logoutBtn.classList.toggle('hidden', !isLoggedIn);
}


// --- `onAuthStateChanged` Listener ---
// This is the primary entry point after Firebase is initialized
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);
        toggleHeaderButtons(true);
        await fetchUserProfile(user.uid); // Load user data from Firestore
        showPage('playerPage'); // Show main player page after login
        updateCoinDisplay(); // Refresh coin display
        updatePlaylistDisplay(); // Refresh playlist
        setupUserListeners(); // Start listening for user-specific data
        // If admin was previously logged in, re-enable admin view
        if (isAdminLoggedIn) {
            setupAdminWithdrawalsListener(); // Set up admin listener
        }

    } else {
        currentUser = null;
        console.log("User logged out.");
        resetAppData(); // Clear all user-specific data
        toggleHeaderButtons(false);
        showPage('authPage'); // Show authentication page
        updateCoinDisplay(); // Ensure balance shows 0.000
    }
});


// --- Profile Page Functions ---

/**
 * Updates all elements on the profile page.
 */
function updateProfilePage() {
    userNameInput.value = userName;
    userNameInput.onchange = async () => {
        if (!currentUser) return;
        const newName = userNameInput.value.trim();
        if (newName && newName !== userName) {
            userName = newName;
            await updateProfileInFirestore({ name: userName });
            alert('Elite Name updated!');
        }
    };

    let totalViews = 0;
    profileVideoList.innerHTML = '';
    if (userPlaylist.length === 0) {
        profileVideoList.innerHTML = '<li class="empty-message">No stream history to display.</li>';
    } else {
        userPlaylist.forEach(video => {
            totalViews += video.views || 0;
            const li = document.createElement('li');
            li.innerHTML = `<span class="video-title">${video.title || 'Untitled Stream'}</span> <span class="video-views">${video.views || 0} views</span>`;
            profileVideoList.appendChild(li);
        });
    }
    totalViewsCountSpan.textContent = totalViews;
    profilePesoBalanceSpan.textContent = currentPeso.toFixed(3);
}

// --- Leaderboard Functions ---

/**
 * Fetches popular videos from YouTube Data API v3.
 * @param {string} category - YouTube API category ID (e.g., '10' for music, 'mostPopular' for general trending).
 * @returns {Promise<Array>} A promise that resolves to an array of video objects.
 */
async function fetchYouTubeLeaderboard(category = 'mostPopular') {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        console.error('YouTube API Key is missing or invalid. Please update YOUTUBE_API_KEY in app.js');
        alert('YouTube API Key is not configured. Leaderboard cannot fetch data.');
        return [];
    }

    const part = 'snippet,statistics';
    const chart = category === 'mostPopular' ? 'mostPopular' : 'mostPopular'; // Simplified, use `mostPopular` for now
    const videoCategoryId = category !== 'mostPopular' ? category : ''; // Apply category filter only if not 'mostPopular'

    let url = `${YOUTUBE_API_BASE_URL}?part=${part}&chart=${chart}&regionCode=${YOUTUBE_REGION_CODE}&maxResults=20&key=${YOUTUBE_API_KEY}`;
    if (videoCategoryId) {
        url += `&videoCategoryId=${videoCategoryId}`;
    }

    leaderboardLoadingOverlay.classList.remove('hidden');
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`YouTube API error: ${response.status} - ${errorData.error.message}`);
        }
        const data = await response.json();
        const videos = data.items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium.url,
            views: parseInt(item.statistics.viewCount || 0)
        }));
        return videos;
    } catch (error) {
        console.error('Failed to fetch YouTube leaderboard:', error);
        playSound(errorSound);
        alert('Failed to load top streams. Please check your API key or internet connection.');
        return [];
    } finally {
        leaderboardLoadingOverlay.classList.add('hidden');
    }
}

/**
 * Gets leaderboard videos, using cache if available and fresh.
 * @param {boolean} forceRefresh - If true, bypasses cache and fetches new data.
 * @param {string} category - The category to fetch.
 */
async function getLeaderboardVideos(forceRefresh = false, category = 'mostPopular') {
    if (isLeaderboardLoading) return; // Prevent multiple concurrent fetches
    isLeaderboardLoading = true;

    const now = Date.now();
    const isCacheStale = (now - leaderboardCache.timestamp > LEADERBOARD_CACHE_DURATION) || (leaderboardCache.videos.length === 0);

    let videosToDisplay = [];

    if (!forceRefresh && !isCacheStale) {
        console.log('Using cached leaderboard data.');
        videosToDisplay = leaderboardCache.videos;
    } else {
        console.log('Fetching new leaderboard data from YouTube API...');
        videosToDisplay = await fetchYouTubeLeaderboard(category);
        leaderboardCache = {
            timestamp: now,
            videos: videosToDisplay
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.LEADERBOARD_CACHE, JSON.stringify(leaderboardCache));
    }
    displayLeaderboard(videosToDisplay);
    isLeaderboardLoading = false;
}

/**
 * Displays the fetched videos on the leaderboard page.
 * @param {Array} videos - An array of video objects.
 */
async function displayLeaderboard(videos) {
    leaderboardList.innerHTML = '';
    if (videos.length === 0) {
        leaderboardList.innerHTML = '<li class="empty-message">No trending videos found.</li>';
        return;
    }

    videos.forEach((video, index) => {
        const li = document.createElement('li');
        li.classList.add(`rank-${index + 1}`);
        li.dataset.videoId = video.id;
        li.dataset.videoTitle = video.title;

        li.innerHTML = `
            <span class="leaderboard-rank">${index + 1}</span>
            <img src="${video.thumbnail}" alt="${video.title}" class="leaderboard-thumbnail">
            <div class="leaderboard-info">
                <span class="title">${video.title}</span>
                <span class="channel">${video.channel}</span>
            </div>
            <span class="leaderboard-views">${formatViewCount(video.views)} views</span>
        `;
        li.addEventListener('click', async () => { // Make event handler async
            playSound(clickSound);
            if (!currentUser) {
                alert('Please login to add videos to your playlist.');
                showPage('authPage');
                return;
            }

            let foundIndex = userPlaylist.findIndex(v => v.id === video.id);
            if (foundIndex === -1) { // If not in user playlist, add it
                userPlaylist.push({ id: video.id, title: video.title, views: 0 });
                foundIndex = userPlaylist.length - 1;
                populateUnplayedIndices(); // Update unplayed indices
                await updateProfileInFirestore({ playlist: userPlaylist }); // Save updated playlist to Firebase
                alert(`"${video.title}" added to your playlist.`);
            }
            currentVideoIndex = foundIndex;
            await updateProfileInFirestore({ currentVideoIndex: currentVideoIndex }); // Save current index to Firebase
            
            updatePlaylistDisplay();
            loadVideo(video.id);
            player.playVideo();
            showPage('playerPage'); // Go back to player page
        });
        leaderboardList.appendChild(li);
    });
}

// --- Monetag Ad Integration ---

/**
 * Ensures the Monetag SDK for a given zone is loaded and its show function is available.
 * @param {string} zoneId - The Monetag zone ID.
 */
async function ensureMonetagSDKLoaded(zoneId) {
    if (window[`show_${zoneId}`]) {
        return;
    }
    console.warn(`Monetag SDK for zone ${zoneId} not found, attempting dynamic load.`);
    const script = document.createElement('script');
    script.src = '//libtl.com/sdk.js';
    script.setAttribute('data-zone', zoneId);
    script.setAttribute('data-sdk', `show_${zoneId}`);
    script.async = true;
    document.head.appendChild(script);
    return new Promise(resolve => {
        script.onload = () => resolve();
        script.onerror = () => {
            console.error(`Failed to load Monetag SDK for zone ${zoneId}`);
            resolve();
        };
    });
}

/**
 * Shows a random rewarded popup ad from the configured Monetag zones.
 * @param {string} zoneId - The specific Monetag zone ID to use.
 * @returns {Promise<boolean>} Resolves to true if ad was shown, false otherwise.
 */
async function showMonetagRewardedPopup(zoneId) {
    await ensureMonetagSDKLoaded(zoneId); // Make sure SDK is ready for this zone
    if (!window[`show_${zoneId}`]) {
        console.error(`Monetag show function not available for zone ${zoneId}`);
        return false;
    }
    try {
        await window[`show_${zoneId}`]('pop');
        console.log(`Monetag rewarded popup from zone ${zoneId} watched!`);
        return true;
    } catch (e) {
        console.error(`Error showing rewarded popup from zone ${zoneId}:`, e);
        playSound(errorSound);
        return false;
    }
}

/**
 * Handles the display of two random ads and rewards the user.
 * @returns {Promise<boolean>} True if ads were successfully shown and rewarded, false otherwise.
 */
async function showPlayAdsSequence() {
    if (isAdShowing) {
        console.log("Ads already in progress, please wait.");
        return false;
    }
    isAdShowing = true;
    adLoadingOverlay.classList.remove('hidden');
    disableUI(true);
    playSound(clickSound); // Sound for clicking play button

    try {
        const availableZones = [...MONETAG_ZONES]; // Clone array to pick randomly
        const selectedZones = [];

        // Pick 2 unique random zones
        while (selectedZones.length < 2 && availableZones.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableZones.length);
            selectedZones.push(availableZones.splice(randomIndex, 1)[0]);
        }

        if (selectedZones.length < 2) {
            alert('Not enough Monetag zones configured or available to show 2 ads. Cannot play video.');
            throw new Error('Insufficient ad zones');
        }

        let adsWatchedCount = 0;
        for (const zoneId of selectedZones) {
            console.log(`Attempting to show ad from zone: ${zoneId}`);
            const adSuccess = await showMonetagRewardedPopup(zoneId);
            if (adSuccess) {
                adsWatchedCount++;
                // Give a short break between ads if both are to be shown
                if (adsWatchedCount < selectedZones.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                console.warn(`Ad from zone ${zoneId} failed or was skipped.`);
            }
        }

        if (adsWatchedCount === 2) {
            currentPeso += REWARD_PER_AD_SEQUENCE;
            await updateProfileInFirestore({ balance: currentPeso }); // Update balance in Firebase
            updateCoinDisplay();
            playSound(rewardSound);
            alert(`You earned ${REWARD_PER_AD_SEQUENCE.toFixed(3)} PHP for watching ads!`);
            return true;
        } else {
            alert('Ads not fully completed. No reward this time, and video playback may be restricted.');
            return false;
        }
    } catch (error) {
        console.error('Error during ad sequence:', error);
        alert('An error occurred while loading ads. Please try again.');
        playSound(errorSound);
        return false;
    } finally {
        isAdShowing = false;
        adLoadingOverlay.classList.add('hidden');
        disableUI(false);
    }
}

/**
 * Disables/enables UI elements during ad display.
 * @param {boolean} isDisabled - True to disable, false to enable.
 */
function disableUI(isDisabled) {
    playBtn.disabled = isDisabled;
    nextBtn.disabled = isDisabled;
    addUrlBtn.disabled = isDisabled;
    youtubeUrlInput.disabled = isDisabled;
    viewProfileBtn.disabled = isDisabled;
    resetPlaylistBtn.disabled = isDisabled;
    leaderboardBtn.disabled = isDisabled;
    withdrawalRoomBtn.disabled = isDisabled;
    adminBtn.disabled = isDisabled;
    logoutBtn.disabled = isDisabled;

    // Also disable playlist item clicks
    document.querySelectorAll('.playlist-item').forEach(item => {
        if (isDisabled) {
            item.style.pointerEvents = 'none';
        } else {
            item.style.pointerEvents = 'auto';
        }
    });
}

// --- YouTube Player API Functions ---

/**
 * This function is automatically called by the YouTube IFrame Player API when it's ready to be used.
 */
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: userPlaylist.length > 0 ? userPlaylist[currentVideoIndex].id : '',
        playerVars: {
            'autoplay': 0, 
            'controls': 1,
            'modestbranding': 1,
            'rel': 0, 
            'showinfo': 0,
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

/**
 * Callback when the YouTube player is ready.
 * @param {object} event - The YouTube API event object.
 */
function onPlayerReady(event) {
    isPlayerReady = true;
    console.log('GlobalStream YouTube Player is initialized and ready.');
    if (userPlaylist.length > 0) {
        // Ensure unplayed indices are ready for the first play
        populateUnplayedIndices();
        // Load the current video, but don't autoplay here directly (play button handles it)
        loadVideo(userPlaylist[currentVideoIndex].id);
    } else {
        console.log('Your curated playlist awaits. Add URLs to begin streaming.');
    }
    updatePlaylistDisplay();
}

/**
 * Callback for when the player's state changes (playing, paused, ended, etc.).
 * Manages countdown and rewards logic.
 * @param {object} event - The YouTube API event object.
 */
async function onPlayerStateChange(event) { // Made async for Firebase updates
    if (!currentUser) return; // Must be logged in

    if (event.data === YT.PlayerState.PLAYING) {
        startCountdown();
        countdownOverlay.classList.add('active');
        
        // Increment views for the currently playing video
        if (userPlaylist[currentVideoIndex]) {
            userPlaylist[currentVideoIndex].views = (userPlaylist[currentVideoIndex].views || 0) + 1;
            // Update total views for the user's profile
            const totalViews = userPlaylist.reduce((sum, video) => sum + (video.views || 0), 0);
            await updateProfileInFirestore({ playlist: userPlaylist, totalViews: totalViews }); // Update playlist and total views in Firebase
            updateProfilePage();
        }
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
    } else if (event.data === YT.PlayerState.ENDED) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
        currentPeso += REWARD_PER_VIDEO_PLAY;
        await updateProfileInFirestore({ balance: currentPeso }); // Update balance in Firebase
        updateCoinDisplay();
        playSound(rewardSound);
        console.log('GlobalStream concluded. Rewarding user and initiating next stream.');
        playNextVideo();
    } else if (event.data === YT.PlayerState.CUED) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
    }
}

/**
 * Callback for YouTube player errors.
 * Attempts to play the next video upon an error to maintain continuous experience.
 * @param {object} event - The YouTube API event object containing error data.
 */
function onPlayerError(event) {
    console.error('YouTube Player encountered an error:', event.data);
    playSound(errorSound);
    alert(`GlobalStream encountered an issue (Error Code: ${event.data}). Initiating next stream.`);
    stopCountdown();
    countdownOverlay.classList.remove('active');
    playNextVideo(); // Attempt to recover by playing the next video
}

/**
 * Loads a specific video into the player.
 * @param {string} videoId - The YouTube video ID to load.
 */
function loadVideo(videoId) {
    if (isPlayerReady && player) {
        player.loadVideoById(videoId);
    } else {
        console.warn('Player not ready or not initialized to load video:', videoId);
        // Fallback to try again after a short delay if player wasn't ready immediately
        setTimeout(() => {
            if (isPlayerReady && player) player.loadVideoById(videoId);
            else alert('Player not fully ready. Please try again or refresh.');
        }, 1000);
    }
}

/**
 * Advances to and plays the next random video in the user's playlist, ensuring a cycle.
 */
async function playNextVideo() { // Made async for Firebase update
    if (!currentUser) return; // Must be logged in

    if (userPlaylist.length === 0) {
        console.log('GlobalStream playlist is exhausted. Awaiting new URLs.');
        if (player) player.stopVideo();
        return;
    }

    populateUnplayedIndices();

    if (unplayedVideoIndices.length > 0) {
        const randomIndexInUnplayed = Math.floor(Math.random() * unplayedVideoIndices.length);
        const nextPlaylistIndex = unplayedVideoIndices.splice(randomIndexInUnplayed, 1)[0];
        
        currentVideoIndex = nextPlaylistIndex;
    } else {
        populateUnplayedIndices();
        currentVideoIndex = unplayedVideoIndices.splice(0, 1)[0];
        console.warn("Unplayed indices was unexpectedly empty, replenished and picking first.");
    }
    
    await updateProfileInFirestore({ currentVideoIndex: currentVideoIndex }); // Save new current index to Firebase

    loadVideo(userPlaylist[currentVideoIndex].id);
    player.playVideo(); // Attempt to auto-play the next video
    updatePlaylistDisplay();
}

// --- Countdown Logic ---

/**
 * Starts the 1-minute countdown timer, displaying it on the player overlay.
 * Rewards user and plays next video when countdown reaches zero.
 */
function startCountdown() {
    stopCountdown();
    countdownSeconds = COUNTDOWN_DURATION;
    countdownText.textContent = countdownSeconds;
    countdownOverlay.classList.add('active'); // Ensure active state for countdown
    countdownInterval = setInterval(async () => { // Made async for Firebase update
        countdownSeconds--;
        countdownText.textContent = countdownSeconds;
        if (countdownSeconds <= 0) {
            stopCountdown();
            countdownOverlay.classList.remove('active');
            currentPeso += REWARD_PER_VIDEO_PLAY;
            await updateProfileInFirestore({ balance: currentPeso }); // Update balance in Firebase
            updateCoinDisplay();
            playSound(rewardSound);
            console.log('Countdown concluded. Rewarding user for continuous engagement and playing next stream.');
            playNextVideo();
        }
    }, 1000);
}

/**
 * Clears the active countdown interval.
 */
function stopCountdown() {
    clearInterval(countdownInterval);
}

// --- Withdrawal Room Functions ---

/**
 * Renders the current user's withdrawal history table.
 * @param {Array} userWithdrawals - The array of withdrawal requests for the current user.
 */
function renderWithdrawalHistory(userWithdrawals) {
    withdrawalHistoryTableBody.innerHTML = '';
    
    if (userWithdrawals.length === 0) {
        emptyWithdrawalHistoryMessage.classList.remove('hidden');
        return;
    } else {
        emptyWithdrawalHistoryMessage.classList.add('hidden');
    }

    userWithdrawals.forEach(req => {
        const tr = document.createElement('tr');
        const reqDate = req.requestedAt ? new Date(req.requestedAt.toDate()).toLocaleDateString() : 'N/A';
        tr.innerHTML = `
            <td>${req.id.substring(0, 8)}...</td>
            <td>${req.amount.toFixed(2)}</td>
            <td class="status-${req.status}">${req.status}</td>
            <td>${reqDate}</td>
        `;
        withdrawalHistoryTableBody.appendChild(tr);
    });
}

/**
 * Handles the submission of a withdrawal request.
 */
async function submitWithdrawalRequest() {
    if (!currentUser) {
        withdrawalFormMessage.textContent = 'Please login to submit a withdrawal request.';
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        return;
    }

    const gcash = gcashNumberInput.value.trim();
    const amount = parseFloat(withdrawalAmountInput.value);

    // Reset messages
    withdrawalFormMessage.textContent = '';
    withdrawalFormMessage.classList.remove('success-message', 'error-message');

    if (!userName || userName.startsWith('User-')) { // Encourage setting a proper name
        withdrawalFormMessage.textContent = 'Please set a unique Elite Name in your Profile before making a withdrawal.';
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        return;
    }
    if (!gcash || !/^(09|\+639)\d{9}$/.test(gcash)) {
        withdrawalFormMessage.textContent = 'Please enter a valid 11-digit GCash number (e.g., 09xxxxxxxxx).';
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        withdrawalFormMessage.textContent = 'Please enter a valid amount greater than 0.';
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        return;
    }
    if (amount > currentPeso) {
        withdrawalFormMessage.textContent = `Insufficient balance. Your current balance is ${currentPeso.toFixed(3)} PHP.`;
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        return;
    }

    try {
        // Deduct from client-side balance (risky in production, but suitable for client-side demo)
        currentPeso -= amount;
        await updateProfileInFirestore({ balance: currentPeso }); // Update user's balance in Firestore

        await addDoc(collection(db, 'withdrawals'), {
            userId: currentUser.uid,
            userName: userName,
            gcashNumber: gcash,
            amount: amount,
            status: 'Pending',
            requestedAt: serverTimestamp(),
            processedAt: null
        });

        gcashNumberInput.value = '';
        withdrawalAmountInput.value = '';
        withdrawalFormMessage.textContent = 'Withdrawal request submitted successfully! Pending admin approval.';
        withdrawalFormMessage.classList.add('success-message');
        playSound(rewardSound); // Use reward sound for successful submission

        // The onSnapshot listener for userWithdrawals will automatically update the table
    } catch (error) {
        console.error('Error submitting withdrawal request:', error);
        withdrawalFormMessage.textContent = 'Failed to submit request. Please try again.';
        withdrawalFormMessage.classList.add('error-message');
        playSound(errorSound);
        // If Firebase write failed, you might want to rollback client-side balance
        currentPeso += amount;
        updateCoinDisplay();
    }
}


// --- Admin Panel Functions ---

/**
 * Toggles the visibility of the admin login form and content.
 */
function toggleAdminContentVisibility() {
    if (isAdminLoggedIn) {
        adminLoginDiv.classList.add('hidden');
        adminContentDiv.classList.remove('hidden');
        setupAdminWithdrawalsListener(); // Start admin listeners
    } else {
        adminLoginDiv.classList.remove('hidden');
        adminContentDiv.classList.add('hidden');
        adminPasswordInput.value = '';
        adminLoginMessage.textContent = '';
        // Clear admin tables
        renderAdminWithdrawalRequests([]);
        // Stop admin listeners
        if (unsubscribeAdminWithdrawals) unsubscribeAdminWithdrawals();
        unsubscribeAdminWithdrawals = null;
    }
}

/**
 * Handles admin login attempt.
 */
function handleAdminLogin() {
    playSound(clickSound);
    adminLoginMessage.textContent = '';
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN, 'true');
        toggleAdminContentVisibility();
        adminLoginMessage.textContent = '';
        // If current user is logged in, but just enabled admin, set up listeners
        if (currentUser) {
            setupAdminWithdrawalsListener();
        }
    } else {
        adminLoginMessage.textContent = 'Incorrect password.';
        adminLoginMessage.classList.add('error-message');
        playSound(errorSound);
    }
}

/**
 * Handles admin logout.
 */
function handleAdminLogout() {
    playSound(clickSound);
    isAdminLoggedIn = false;
    localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN, 'false');
    toggleAdminContentVisibility();
    alert('Admin logged out.');
}

let unsubscribeAdminWithdrawals = null;

/**
 * Sets up a real-time listener for all withdrawal requests for the admin panel.
 */
function setupAdminWithdrawalsListener() {
    if (unsubscribeAdminWithdrawals) unsubscribeAdminWithdrawals(); // Stop previous listener

    if (!isAdminLoggedIn || !currentUser) { // Must be logged in as admin AND have a user context
        renderAdminWithdrawalRequests([]);
        return;
    }

    const q = query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc'));
    unsubscribeAdminWithdrawals = onSnapshot(q, (snapshot) => {
        const allWithdrawalRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminWithdrawalRequests(allWithdrawalRequests);
    }, (error) => {
        console.error("Error listening to all withdrawals (admin):", error);
        playSound(errorSound);
    });
}


/**
 * Renders both pending and all withdrawal requests for the admin.
 * @param {Array} allRequests - All withdrawal requests from Firestore.
 */
function renderAdminWithdrawalRequests(allRequests) {
    pendingWithdrawalsTableBody.innerHTML = '';
    allWithdrawalsTableBody.innerHTML = '';

    const pendingRequests = allRequests.filter(req => req.status === 'Pending');
    
    // Pending requests table
    if (pendingRequests.length === 0) {
        emptyPendingWithdrawalsMessage.classList.remove('hidden');
    } else {
        emptyPendingWithdrawalsMessage.classList.add('hidden');
        pendingRequests.sort((a, b) => (a.requestedAt?.toDate() || 0) - (b.requestedAt?.toDate() || 0)); // Oldest first
        pendingRequests.forEach(req => {
            const tr = document.createElement('tr');
            const reqDate = req.requestedAt ? new Date(req.requestedAt.toDate()).toLocaleDateString() : 'N/A';
            tr.innerHTML = `
                <td>${req.id.substring(0, 8)}...</td>
                <td>${req.userName}</td>
                <td>${req.gcashNumber}</td>
                <td>${req.amount.toFixed(2)}</td>
                <td>${reqDate}</td>
                <td>
                    <button class="gold-button approve-btn" data-id="${req.id}">Approve</button>
                    <button class="gold-button deny-btn" data-id="${req.id}">Deny</button>
                </td>
            `;
            pendingWithdrawalsTableBody.appendChild(tr);
        });
    }

    // All withdrawals table
    if (allRequests.length === 0) {
        emptyAllWithdrawalsMessage.classList.remove('hidden');
    } else {
        emptyAllWithdrawalsMessage.classList.add('hidden');
        // allRequests is already sorted newest first by the onSnapshot query
        allRequests.forEach(req => {
            const tr = document.createElement('tr');
            const reqDate = req.requestedAt ? new Date(req.requestedAt.toDate()).toLocaleDateString() : 'N/A';
            tr.innerHTML = `
                <td>${req.id.substring(0, 8)}...</td>
                <td>${req.userName}</td>
                <td>${req.gcashNumber}</td>
                <td>${req.amount.toFixed(2)}</td>
                <td class="status-${req.status}">${req.status}</td>
                <td>${reqDate}</td>
            `;
            allWithdrawalsTableBody.appendChild(tr);
        });
    }
}

/**
 * Handles admin action (approve/deny) on a withdrawal request, updating Firebase.
 * @param {string} id - The Firestore document ID of the withdrawal request.
 * @param {string} status - The new status ('Approved' or 'Denied').
 */
async function handleWithdrawalAction(id, status) {
    playSound(clickSound);
    if (!currentUser || !isAdminLoggedIn) return; // Must be logged in as admin

    const withdrawalDocRef = doc(db, 'withdrawals', id);
    try {
        await updateDoc(withdrawalDocRef, {
            status: status,
            processedAt: serverTimestamp()
        });

        // If denying, refund the amount to the user's balance in Firestore
        if (status === 'Denied') {
            // Find the request details from the current state (or re-fetch if necessary)
            const withdrawalSnap = await getDoc(withdrawalDocRef);
            if (withdrawalSnap.exists()) {
                const request = withdrawalSnap.data();
                const userDocRef = doc(db, 'users', request.userId);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const currentBalance = userSnap.data().balance;
                    await updateDoc(userDocRef, {
                        balance: currentBalance + request.amount
                    });
                    console.log(`Refunded ${request.amount} to user ${request.userName} (${request.userId}) due to denied withdrawal.`);
                    alert(`Request ${id} ${status}! Amount ${request.amount} PHP refunded to user ${request.userName}.`);
                }
            }
        } else {
            alert(`Request ${id} ${status}!`);
        }
        // Firestore listeners will automatically update UI for both admin and user.
    } catch (error) {
        console.error(`Error processing withdrawal action (${status}) for ${id}:`, error);
        playSound(errorSound);
        alert(`Failed to ${status} request. Please try again.`);
    }
}


// --- Event Listeners ---

// Auth Page Buttons
loginBtn.addEventListener('click', () => authenticateUser(emailInput.value, passwordInput.value, false));
signupBtn.addEventListener('click', () => authenticateUser(emailInput.value, passwordInput.value, true));
emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
});
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// Logout Button
logoutBtn.addEventListener('click', logoutUser);

// Player Page Buttons
playBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please login to play videos.');
        showPage('authPage');
        return;
    }
    if (isAdShowing) return;
    playSound(clickSound);

    if (userPlaylist.length === 0) {
        alert('Your GlobalStream playlist is empty. Please add a YouTube URL first.');
        return;
    }

    const adsShown = await showPlayAdsSequence();
    if (adsShown) {
        // Only load/play if player is not already playing or has ended
        if (player && (player.getPlayerState() === YT.PlayerState.PAUSED || player.getPlayerState() === YT.PlayerState.CUED || player.getPlayerState() === YT.PlayerState.ENDED || player.getPlayerState() === YT.PlayerState.UNSTARTED)) {
            loadVideo(userPlaylist[currentVideoIndex].id);
            player.playVideo(); // Attempt to play after ads
        } else if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
            console.log("Player already playing, just continue after ads.");
        } else {
            // Player might not be ready yet, or in an unknown state
            console.warn("Player not ready to play video immediately after ads, attempting load/play shortly.");
            setTimeout(() => {
                if (isPlayerReady && player) {
                    loadVideo(userPlaylist[currentVideoIndex].id);
                    player.playVideo();
                }
            }, 500);
        }
    } else {
        console.log("Ads not completed, video not played.");
    }
});

nextBtn.addEventListener('click', () => {
    if (!currentUser) {
        alert('Please login to play videos.');
        showPage('authPage');
        return;
    }
    playSound(clickSound);
    if (userPlaylist.length > 0) {
        playNextVideo();
    } else {
        alert('Your GlobalStream playlist is empty. Please add a YouTube URL first.');
    }
});

addUrlBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please login to add videos to your playlist.');
        showPage('authPage');
        return;
    }
    playSound(clickSound);
    const url = youtubeUrlInput.value.trim();
    if (!url) {
        alert('Please provide a YouTube URL for your GlobalStream playlist.');
        return;
    }

    const videoId = extractYouTubeID(url);
    if (!videoId) {
        alert('The URL provided is not a valid YouTube video link. Please verify and retry.');
        return;
    }

    if (userPlaylist.some(video => video.id === videoId)) {
        alert('This GlobalStream is already integrated into your playlist!');
        youtubeUrlInput.value = '';
        return;
    }

    let videoTitle = `Untitled Global Stream`; // Default title
    try {
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data && data.title) {
            videoTitle = data.title;
        }
    } catch (error) {
        console.error('Failed to retrieve video title from noembed.com:', error);
    }

    userPlaylist.push({ id: videoId, title: videoTitle, views: 0 }); // Add to local playlist
    youtubeUrlInput.value = '';
    
    populateUnplayedIndices(); // Update unplayed indices to include new video
    await updateProfileInFirestore({ playlist: userPlaylist }); // Save updated playlist to Firebase
    updatePlaylistDisplay(); // Refresh UI
    updateProfilePage(); // Update profile immediately
    alert(`"${videoTitle}" successfully added to your GlobalStream playlist!`);
    
    // If this is the first video added, set it as current
    if (userPlaylist.length === 1 && isPlayerReady) {
        currentVideoIndex = 0;
        await updateProfileInFirestore({ currentVideoIndex: currentVideoIndex }); // Save current index to Firebase
        loadVideo(userPlaylist[currentVideoIndex].id);
    }
});

resetPlaylistBtn.addEventListener('click', async () => { // Made async for Firebase
    if (!currentUser) {
        alert('Please login.');
        showPage('authPage');
        return;
    }
    playSound(clickSound);
    if (confirm('Initiating a full system reset will clear your entire GlobalStream playlist and all view counts. Confirm action?')) {
        userPlaylist = [];
        currentVideoIndex = 0;
        unplayedVideoIndices = [];
        
        if (player) {
            player.stopVideo();
            player.cueVideoById('');
        }
        stopCountdown();
        countdownOverlay.classList.remove('active');

        await updateProfileInFirestore({ playlist: userPlaylist, totalViews: 0, currentVideoIndex: 0 }); // Clear playlist, views, and index in Firebase
        updatePlaylistDisplay();
        updateProfilePage();
        alert('GlobalStream system reset complete. Your playlist has been cleared.');
    }
});

// Navigation Buttons
viewProfileBtn.addEventListener('click', () => {
    if (!currentUser) { /* Should be hidden, but as safeguard */ return; }
    playSound(clickSound);
    showPage('profilePage');
    updateProfilePage(); // Ensure profile data is fresh
});

backToPlayerBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
    updatePlaylistDisplay(); // Ensure player playlist is fresh
});

leaderboardBtn.addEventListener('click', () => {
    if (!currentUser) { /* Should be hidden, but as safeguard */ return; }
    playSound(clickSound);
    showPage('leaderboardPage');
    getLeaderboardVideos(); // Load leaderboard data
});

backToPlayerFromLeaderboardBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
});

withdrawalRoomBtn.addEventListener('click', () => {
    if (!currentUser) { /* Should be hidden, but as safeguard */ return; }
    playSound(clickSound);
    showPage('withdrawalRoomPage');
    updateCoinDisplay(); // Ensure balance is up-to-date
    // renderWithdrawalHistory is called by the onSnapshot listener
});

backToPlayerFromWithdrawalBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
});

adminBtn.addEventListener('click', () => {
    if (!currentUser) { /* Should be hidden, but as safeguard */ return; }
    playSound(clickSound);
    showPage('adminPage');
    toggleAdminContentVisibility(); // Show login or content based on state
});

backToPlayerFromAdminBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
});

// Leaderboard Controls
refreshLeaderboardBtn.addEventListener('click', () => {
    playSound(clickSound);
    getLeaderboardVideos(true, leaderboardCategoryFilter.value); // Force refresh
});

leaderboardCategoryFilter.addEventListener('change', () => {
    playSound(clickSound);
    getLeaderboardVideos(true, leaderboardCategoryFilter.value); // Fetch new category
});

// Withdrawal Room Controls
submitWithdrawalBtn.addEventListener('click', () => {
    playSound(clickSound);
    submitWithdrawalRequest();
});

// Admin Panel Controls
adminLoginBtn.addEventListener('click', handleAdminLogin);
adminPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAdminLogin();
    }
});
adminLogoutBtn.addEventListener('click', handleAdminLogout);

// Event delegation for approve/deny buttons in admin table
pendingWithdrawalsTableBody.addEventListener('click', async (e) => { // Made async
    if (e.target.classList.contains('approve-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Approve withdrawal request ${id}?`)) {
            await handleWithdrawalAction(id, 'Approved');
        }
    } else if (e.target.classList.contains('deny-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Deny withdrawal request ${id}?`)) {
            await handleWithdrawalAction(id, 'Denied');
        }
    }
});


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update footer date/time every second
    
    // onAuthStateChanged will handle initial page load (authPage or playerPage)
    // and fetching of user data.
});

// The onYouTubeIframeAPIReady will be automatically called by the YouTube API script once loaded.
