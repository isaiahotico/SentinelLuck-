
// app.js

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
    PESO_BALANCE: 'pesoBalance',
    USER_PLAYLIST: 'userPlaylist',
    CURRENT_VIDEO_INDEX: 'currentVideoIndex',
    UNPLAYED_INDICES: 'unplayedVideoIndices',
    USER_NAME: 'userName',
    LEADERBOARD_CACHE: 'leaderboardCache',
    ALL_WITHDRAWAL_REQUESTS: 'allWithdrawalRequests',
    ADMIN_LOGGED_IN: 'adminLoggedIn'
};

// --- Global Variables ---
let player; // YouTube Player instance
let currentPeso = parseFloat(localStorage.getItem(LOCAL_STORAGE_KEYS.PESO_BALANCE)) || 0.000;
let userPlaylist = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USER_PLAYLIST)) || [];
let currentVideoIndex = parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX)) || 0;
let unplayedVideoIndices = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES)) || [];
let userName = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_NAME) || '';

let leaderboardCache = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LEADERBOARD_CACHE)) || { timestamp: 0, videos: [] };
let allWithdrawalRequests = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ALL_WITHDRAWAL_REQUESTS)) || [];
let isAdminLoggedIn = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN) === 'true';

let countdownInterval;
let countdownSeconds = COUNTDOWN_DURATION;
let isPlayerReady = false; // Flag to indicate if YT player API is ready
let isAdShowing = false; // Flag to prevent multiple ad calls / UI interaction during ads
let isLeaderboardLoading = false; // Flag to prevent multiple leaderboard fetches

// --- Get DOM elements ---
// Header
const pesoBalanceSpan = document.getElementById('pesoBalance');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const withdrawalRoomBtn = document.getElementById('withdrawalRoomBtn');
const adminBtn = document.getElementById('adminBtn');

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
 * Updates the displayed peso balance and saves it to local storage.
 */
function updateCoinDisplay() {
    pesoBalanceSpan.textContent = currentPeso.toFixed(3);
    profilePesoBalanceSpan.textContent = currentPeso.toFixed(3);
    withdrawalBalanceSpan.textContent = currentPeso.toFixed(3); // Update withdrawal balance too
    localStorage.setItem(LOCAL_STORAGE_KEYS.PESO_BALANCE, currentPeso.toFixed(3));
}

/**
 * Switches the active page display.
 * @param {string} pageId - The ID of the page to show ('playerPage', 'profilePage', 'leaderboardPage', 'withdrawalRoomPage', 'adminPage').
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
        removeBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent the li's click event from firing
            playSound(clickSound);
            removeVideoFromPlaylist(index);
        };
        li.appendChild(removeBtn);

        li.onclick = () => {
            playSound(clickSound);
            if (index !== currentVideoIndex) {
                currentVideoIndex = index;
                localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX, currentVideoIndex);
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
    localStorage.setItem(LOCAL_STORAGE_KEYS.USER_PLAYLIST, JSON.stringify(userPlaylist)); // Persist changes
}

/**
 * Removes a video from the playlist at a specific index.
 * @param {number} index - The index of the video to remove.
 */
function removeVideoFromPlaylist(index) {
    if (confirm(`Confirm removal of "${userPlaylist[index].title || 'this Global Stream'}" from your playlist?`)) {
        const removedIsCurrent = (index === currentVideoIndex);
        
        userPlaylist.splice(index, 1);
        
        if (userPlaylist.length === 0) {
            currentVideoIndex = 0;
            unplayedVideoIndices = []; // Clear unplayed indices as well
            if (player) player.stopVideo(); // Stop player if no videos left
            stopCountdown();
            countdownOverlay.classList.remove('active');
            alert('Your playlist is now empty. Time to curate new streams!');
        } else if (removedIsCurrent) {
            currentVideoIndex = currentVideoIndex % userPlaylist.length;
            // Rebuild unplayed indices to account for removal
            populateUnplayedIndices();
            if (userPlaylist.length > 0) { // Only load if there's still videos
                loadVideo(userPlaylist[currentVideoIndex].id);
                player.playVideo(); // Attempt to play the new current video
            } else {
                player.cueVideoById(''); // Clear player if no videos left
            }
        } else if (index < currentVideoIndex) {
            currentVideoIndex--;
        }
        
        localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX, currentVideoIndex);
        localStorage.setItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES, JSON.stringify(unplayedVideoIndices));
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
        localStorage.setItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES, JSON.stringify(unplayedVideoIndices));
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
    localStorage.setItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES, JSON.stringify(unplayedVideoIndices));
}

// --- Profile Page Functions ---

/**
 * Updates all elements on the profile page.
 */
function updateProfilePage() {
    userNameInput.value = userName;
    userNameInput.onchange = () => {
        userName = userNameInput.value.trim();
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER_NAME, userName);
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
function displayLeaderboard(videos) {
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
        li.addEventListener('click', () => {
            playSound(clickSound);
            currentVideoIndex = userPlaylist.findIndex(v => v.id === video.id);
            if (currentVideoIndex === -1) { // If not in user playlist, add it
                userPlaylist.push({ id: video.id, title: video.title, views: 0 });
                currentVideoIndex = userPlaylist.length - 1;
                populateUnplayedIndices(); // Update unplayed indices
            }
            localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX, currentVideoIndex);
            updatePlaylistDisplay();
            loadVideo(video.id);
            player.playVideo();
            showPage('playerPage'); // Go back to player page
        });
        leaderboardList.appendChild(li);
    });
}

// --- Monetag Ad Integration --- (No changes from previous version)

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
            'autoplay': 0, // We manage autoplay programmatically after user interaction/ads
            'controls': 1, // User can see and use YouTube's own controls (play/pause, volume)
            'modestbranding': 1,
            'rel': 0, // Disable related videos
            'showinfo': 0, // Hide video title and uploader info
            // 'mute': 0 // YouTube videos play with sound by default. Explicitly setting mute:0 is redundant.
                     // If no sound, ensure browser isn't auto-muting or device volume is up.
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
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startCountdown();
        countdownOverlay.classList.add('active');
        // Increment views for the currently playing video
        if (userPlaylist[currentVideoIndex]) {
            userPlaylist[currentVideoIndex].views = (userPlaylist[currentVideoIndex].views || 0) + 1;
            localStorage.setItem(LOCAL_STORAGE_KEYS.USER_PLAYLIST, JSON.stringify(userPlaylist));
            updateProfilePage();
        }
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
    } else if (event.data === YT.PlayerState.ENDED) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
        currentPeso += REWARD_PER_VIDEO_PLAY;
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
function playNextVideo() {
    if (userPlaylist.length === 0) {
        console.log('GlobalStream playlist is exhausted. Awaiting new URLs.');
        if (player) player.stopVideo();
        return;
    }

    // Ensure we have unplayed indices for the current cycle
    populateUnplayedIndices();

    // Pick a random index from the unplayed ones
    if (unplayedVideoIndices.length > 0) {
        const randomIndexInUnplayed = Math.floor(Math.random() * unplayedVideoIndices.length);
        const nextPlaylistIndex = unplayedVideoIndices.splice(randomIndexInUnplayed, 1)[0];
        
        currentVideoIndex = nextPlaylistIndex;
    } else {
        // This should theoretically not be reached if populateUnplayedIndices works,
        // but as a fallback, just start a new cycle and pick the first
        populateUnplayedIndices();
        currentVideoIndex = unplayedVideoIndices.splice(0, 1)[0];
        console.warn("Unplayed indices was unexpectedly empty, replenished and picking first.");
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX, currentVideoIndex);
    localStorage.setItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES, JSON.stringify(unplayedVideoIndices));

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
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        countdownText.textContent = countdownSeconds;
        if (countdownSeconds <= 0) {
            stopCountdown();
            countdownOverlay.classList.remove('active');
            currentPeso += REWARD_PER_VIDEO_PLAY;
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
 */
function renderWithdrawalHistory() {
    withdrawalHistoryTableBody.innerHTML = '';
    const userWithdrawals = allWithdrawalRequests.filter(req => req.userName === userName);

    if (userWithdrawals.length === 0) {
        emptyWithdrawalHistoryMessage.classList.remove('hidden');
        withdrawalHistoryTableBody.innerHTML = '';
        return;
    } else {
        emptyWithdrawalHistoryMessage.classList.add('hidden');
    }

    userWithdrawals.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort newest first

    userWithdrawals.forEach(req => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${req.id.substring(0, 8)}...</td>
            <td>${req.amount.toFixed(2)}</td>
            <td class="status-${req.status}">${req.status}</td>
            <td>${new Date(req.timestamp).toLocaleDateString()}</td>
        `;
        withdrawalHistoryTableBody.appendChild(tr);
    });
}

/**
 * Handles the submission of a withdrawal request.
 */
function submitWithdrawalRequest() {
    const gcash = gcashNumberInput.value.trim();
    const amount = parseFloat(withdrawalAmountInput.value);

    // Reset messages
    withdrawalFormMessage.textContent = '';
    withdrawalFormMessage.classList.remove('success-message', 'error-message');

    if (!userName) {
        withdrawalFormMessage.textContent = 'Please set your Elite Name in the Profile section before making a withdrawal.';
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

    const newRequest = {
        id: `W${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, // Simple unique ID
        userName: userName,
        gcashNumber: gcash,
        amount: amount,
        status: 'Pending',
        timestamp: new Date().toISOString()
    };

    allWithdrawalRequests.push(newRequest);
    localStorage.setItem(LOCAL_STORAGE_KEYS.ALL_WITHDRAWAL_REQUESTS, JSON.stringify(allWithdrawalRequests));

    currentPeso -= amount; // Deduct from balance immediately
    updateCoinDisplay();

    gcashNumberInput.value = '';
    withdrawalAmountInput.value = '';
    withdrawalFormMessage.textContent = 'Withdrawal request submitted successfully! Pending admin approval.';
    withdrawalFormMessage.classList.add('success-message');
    playSound(rewardSound); // Use reward sound for successful submission

    renderWithdrawalHistory(); // Update user's history
}


// --- Admin Panel Functions ---

/**
 * Toggles the visibility of the admin login form and content.
 */
function toggleAdminContentVisibility() {
    if (isAdminLoggedIn) {
        adminLoginDiv.classList.add('hidden');
        adminContentDiv.classList.remove('hidden');
        renderAdminWithdrawalRequests(); // Render tables when logged in
    } else {
        adminLoginDiv.classList.remove('hidden');
        adminContentDiv.classList.add('hidden');
        adminPasswordInput.value = '';
        adminLoginMessage.textContent = '';
        // Clear admin tables
        pendingWithdrawalsTableBody.innerHTML = '';
        allWithdrawalsTableBody.innerHTML = '';
        emptyPendingWithdrawalsMessage.classList.remove('hidden');
        emptyAllWithdrawalsMessage.classList.remove('hidden');
    }
}

/**
 * Handles admin login attempt.
 */
function handleAdminLogin() {
    playSound(clickSound);
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_LOGGED_IN, 'true');
        toggleAdminContentVisibility();
        adminLoginMessage.textContent = '';
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

/**
 * Renders both pending and all withdrawal requests for the admin.
 */
function renderAdminWithdrawalRequests() {
    pendingWithdrawalsTableBody.innerHTML = '';
    allWithdrawalsTableBody.innerHTML = '';

    const pendingRequests = allWithdrawalRequests.filter(req => req.status === 'Pending');
    
    // Pending requests table
    if (pendingRequests.length === 0) {
        emptyPendingWithdrawalsMessage.classList.remove('hidden');
    } else {
        emptyPendingWithdrawalsMessage.classList.add('hidden');
        pendingRequests.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Oldest first
        pendingRequests.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${req.id.substring(0, 8)}...</td>
                <td>${req.userName}</td>
                <td>${req.gcashNumber}</td>
                <td>${req.amount.toFixed(2)}</td>
                <td>${new Date(req.timestamp).toLocaleDateString()}</td>
                <td>
                    <button class="gold-button approve-btn" data-id="${req.id}">Approve</button>
                    <button class="gold-button deny-btn" data-id="${req.id}">Deny</button>
                </td>
            `;
            pendingWithdrawalsTableBody.appendChild(tr);
        });
    }

    // All withdrawals table
    if (allWithdrawalRequests.length === 0) {
        emptyAllWithdrawalsMessage.classList.remove('hidden');
    } else {
        emptyAllWithdrawalsMessage.classList.add('hidden');
        allWithdrawalRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Newest first
        allWithdrawalRequests.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${req.id.substring(0, 8)}...</td>
                <td>${req.userName}</td>
                <td>${req.gcashNumber}</td>
                <td>${req.amount.toFixed(2)}</td>
                <td class="status-${req.status}">${req.status}</td>
                <td>${new Date(req.timestamp).toLocaleDateString()}</td>
            `;
            allWithdrawalsTableBody.appendChild(tr);
        });
    }
}

/**
 * Handles admin action (approve/deny) on a withdrawal request.
 * @param {string} id - The ID of the withdrawal request.
 * @param {string} status - The new status ('Approved' or 'Denied').
 */
function handleWithdrawalAction(id, status) {
    playSound(clickSound);
    const requestIndex = allWithdrawalRequests.findIndex(req => req.id === id);
    if (requestIndex !== -1) {
        allWithdrawalRequests[requestIndex].status = status;
        localStorage.setItem(LOCAL_STORAGE_KEYS.ALL_WITHDRAWAL_REQUESTS, JSON.stringify(allWithdrawalRequests));
        
        // If denying, refund the amount to the user's balance
        // This requires tracking individual user balances more robustly in a real app.
        // For this simple implementation, if a user submits a request, funds are deducted.
        // If denied, we can either assume they manually get it back or re-add it here.
        // For now, funds are deducted on submission and not automatically refunded on denial in this client-side app.
        // In a real system, balance would only deduct AFTER admin approval/payment.

        alert(`Request ${id} ${status}!`);
        renderAdminWithdrawalRequests(); // Re-render admin tables
        renderWithdrawalHistory(); // Re-render user's history if they are on that page
    }
}


// --- Event Listeners ---

// Player Page Buttons
playBtn.addEventListener('click', async () => {
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
    playSound(clickSound);
    if (userPlaylist.length > 0) {
        playNextVideo();
    } else {
        alert('Your GlobalStream playlist is empty. Please add a YouTube URL first.');
    }
});

addUrlBtn.addEventListener('click', async () => {
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

    userPlaylist.push({ id: videoId, title: videoTitle, views: 0 }); // Initialize views
    youtubeUrlInput.value = '';
    updatePlaylistDisplay();
    updateProfilePage(); // Update profile immediately
    populateUnplayedIndices(); // Update unplayed indices to include new video
    alert(`"${videoTitle}" successfully added to your GlobalStream playlist!`);
    
    // If this is the first video added, set it as current
    if (userPlaylist.length === 1 && isPlayerReady) {
        currentVideoIndex = 0;
        localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX, currentVideoIndex);
        loadVideo(userPlaylist[currentVideoIndex].id);
    }
});

resetPlaylistBtn.addEventListener('click', () => {
    playSound(clickSound);
    if (confirm('Initiating a full system reset will clear your entire GlobalStream playlist and all view counts. Confirm action?')) {
        userPlaylist = [];
        currentVideoIndex = 0;
        unplayedVideoIndices = [];
        localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_PLAYLIST);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_VIDEO_INDEX);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.UNPLAYED_INDICES);
        if (player) {
            player.stopVideo();
            player.cueVideoById('');
        }
        stopCountdown();
        countdownOverlay.classList.remove('active');
        updatePlaylistDisplay();
        updateProfilePage();
        alert('GlobalStream system reset complete. Your playlist has been cleared.');
    }
});

// Navigation Buttons
viewProfileBtn.addEventListener('click', () => {
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
    playSound(clickSound);
    showPage('leaderboardPage');
    getLeaderboardVideos(); // Load leaderboard data
});

backToPlayerFromLeaderboardBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
});

withdrawalRoomBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('withdrawalRoomPage');
    updateCoinDisplay(); // Ensure balance is up-to-date
    renderWithdrawalHistory(); // Display user's history
});

backToPlayerFromWithdrawalBtn.addEventListener('click', () => {
    playSound(clickSound);
    showPage('playerPage');
});

adminBtn.addEventListener('click', () => {
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
pendingWithdrawalsTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('approve-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Approve withdrawal request ${id}?`)) {
            handleWithdrawalAction(id, 'Approved');
        }
    } else if (e.target.classList.contains('deny-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`Deny withdrawal request ${id}?`)) {
            handleWithdrawalAction(id, 'Denied');
        }
    }
});


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    updateCoinDisplay();
    updateDateTime();
    setInterval(updateDateTime, 1000); // Update footer date/time every second
    updatePlaylistDisplay(); // Load and display initial playlist
    
    // Initialize unplayed indices if it's the first load or playlist changed
    populateUnplayedIndices();

    // The onYouTubeIframeAPIReady will be automatically called by the YouTube API script once loaded.
});
