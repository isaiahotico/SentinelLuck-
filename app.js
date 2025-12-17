
// app.js

const REWARD_PER_VIDEO_PLAY = 0.005; // Peso awarded for each 1-minute video play
const COUNTDOWN_DURATION = 60; // seconds

let player; // YouTube Player instance
let currentPeso = parseFloat(localStorage.getItem('pesoBalance')) || 0.000;
let userPlaylist = JSON.parse(localStorage.getItem('userPlaylist')) || [];
let currentVideoIndex = parseInt(localStorage.getItem('currentVideoIndex')) || 0;
let countdownInterval;
let countdownSeconds = COUNTDOWN_DURATION;
let isPlayerReady = false; // Flag to indicate if YT player API is ready

// Get DOM elements
const pesoBalanceSpan = document.getElementById('pesoBalance');
const playerDiv = document.getElementById('player');
const playBtn = document.getElementById('playBtn');
const nextBtn = document.getElementById('nextBtn');
const youtubeUrlInput = document.getElementById('youtubeUrlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const userPlaylistDisplay = document.getElementById('userPlaylistDisplay');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const returnHomeButton = document.getElementById('returnHomeBtn');
const currentDateTimeSpan = document.getElementById('currentDateTime'); // Footer date/time span

// --- Utility Functions ---

function updateCoinDisplay() {
    pesoBalanceSpan.textContent = currentPeso.toFixed(3);
    localStorage.setItem('pesoBalance', currentPeso.toFixed(3));
}

function updatePlaylistDisplay() {
    userPlaylistDisplay.innerHTML = ''; // Clear existing list
    if (userPlaylist.length === 0) {
        userPlaylistDisplay.innerHTML = '<li>No videos in your playlist. Add some YouTube URLs!</li>';
        return;
    }

    userPlaylist.forEach((video, index) => {
        const li = document.createElement('li');
        li.dataset.videoId = video.id; // Store YouTube ID
        li.dataset.videoTitle = video.title; // Store title
        li.classList.add('playlist-item');
        if (index === currentVideoIndex) {
            li.classList.add('active-video');
        }

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('video-title');
        titleSpan.textContent = `${index + 1}. ${video.title || 'Untitled Video'}`;
        li.appendChild(titleSpan);

        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-video-btn');
        removeBtn.innerHTML = '✖️'; // Cross icon
        removeBtn.title = 'Remove from playlist';
        removeBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent li click from interfering
            removeVideoFromPlaylist(index);
        };
        li.appendChild(removeBtn);

        li.onclick = () => {
            // Play this video if clicked
            if (index !== currentVideoIndex) {
                currentVideoIndex = index;
                localStorage.setItem('currentVideoIndex', currentVideoIndex);
                loadVideo(userPlaylist[currentVideoIndex].id);
                updatePlaylistDisplay(); // Re-render to highlight active
            } else {
                // If it's the current video, toggle play/pause
                if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
            }
        };

        userPlaylistDisplay.appendChild(li);
    });
    localStorage.setItem('userPlaylist', JSON.stringify(userPlaylist));
}

function removeVideoFromPlaylist(index) {
    if (confirm(`Are you sure you want to remove "${userPlaylist[index].title || 'this video'}"?`)) {
        const removedIsCurrent = (index === currentVideoIndex);
        
        userPlaylist.splice(index, 1);
        
        if (userPlaylist.length === 0) {
            currentVideoIndex = 0; // Reset index if playlist is empty
            if (player) player.stopVideo(); // Stop player if no videos left
            stopCountdown();
            countdownOverlay.classList.remove('active');
        } else if (removedIsCurrent) {
            // If the current video was removed, try to play the next one
            // If it was the last video, loop to the start
            currentVideoIndex = currentVideoIndex % userPlaylist.length; 
            loadVideo(userPlaylist[currentVideoIndex].id);
        } else if (index < currentVideoIndex) {
            // If a video before the current one was removed, adjust current index
            currentVideoIndex--;
        }
        
        localStorage.setItem('currentVideoIndex', currentVideoIndex);
        updatePlaylistDisplay();
        updateCoinDisplay(); // No coin change, but good practice
    }
}


function extractYouTubeID(url) {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Function to update current date and time in the footer
function updateDateTime() {
    const now = new Date();
    const options = { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true 
    };
    currentDateTimeSpan.textContent = now.toLocaleDateString('en-US', options);
}

// --- YouTube Player API Functions ---

// This function is called by the YouTube IFrame Player API when it's ready
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: userPlaylist.length > 0 ? userPlaylist[currentVideoIndex].id : '',
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'modestbranding': 1,
            'rel': 0, // Disable related videos
            'showinfo': 0 // Hide video title and uploader info
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError // Add error handling
        }
    });
}

function onPlayerReady(event) {
    isPlayerReady = true;
    console.log('YouTube Player is ready.');
    if (userPlaylist.length > 0) {
        loadVideo(userPlaylist[currentVideoIndex].id);
        // Event.target.playVideo(); // Attempt to auto-play initial video (might be blocked by browsers)
    } else {
        console.log('Playlist is empty. Waiting for user to add URLs.');
        // Optionally display a placeholder video or message
    }
    updatePlaylistDisplay(); // Ensure display is updated when player is ready
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startCountdown();
        countdownOverlay.classList.add('active');
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
    } else if (event.data === YT.PlayerState.ENDED) {
        stopCountdown();
        countdownOverlay.classList.remove('active');
        currentPeso += REWARD_PER_VIDEO_PLAY; // Reward for watching full video
        updateCoinDisplay();
        console.log('Video ended. Rewarding user and playing next.');
        playNextVideo();
    } else if (event.data === YT.PlayerState.CUED) {
        stopCountdown(); // Stop countdown if video is cued but not playing
        countdownOverlay.classList.remove('active');
    }
}

function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    alert(`YouTube Player Error: ${event.data}. Trying next video.`);
    stopCountdown();
    countdownOverlay.classList.remove('active');
    playNextVideo(); // Try to play the next video on error
}


function loadVideo(videoId) {
    if (isPlayerReady && player) {
        player.loadVideoById(videoId);
        // The onPlayerStateChange will handle starting the countdown once it begins playing
    } else {
        console.warn('Player not ready or not initialized to load video:', videoId);
    }
}

function playNextVideo() {
    if (userPlaylist.length === 0) {
        console.log('Playlist is empty. Cannot play next video.');
        return;
    }

    currentVideoIndex = (currentVideoIndex + 1) % userPlaylist.length;
    localStorage.setItem('currentVideoIndex', currentVideoIndex);
    loadVideo(userPlaylist[currentVideoIndex].id);
    updatePlaylistDisplay(); // Highlight the new active video
}


// --- Countdown Logic ---
function startCountdown() {
    stopCountdown(); // Clear any existing interval
    countdownSeconds = COUNTDOWN_DURATION;
    countdownText.textContent = countdownSeconds;
    countdownInterval = setInterval(() => {
        countdownSeconds--;
        countdownText.textContent = countdownSeconds;
        if (countdownSeconds <= 0) {
            stopCountdown();
            countdownOverlay.classList.remove('active');
            currentPeso += REWARD_PER_VIDEO_PLAY; // Reward for reaching countdown end
            updateCoinDisplay();
            console.log('Countdown ended. Rewarding user and playing next.');
            playNextVideo();
        }
    }, 1000);
}

function stopCountdown() {
    clearInterval(countdownInterval);
}

// --- Event Listeners ---
playBtn.addEventListener('click', () => {
    if (userPlaylist.length > 0 && player) {
        if (player.getPlayerState() === YT.PlayerState.PAUSED || player.getPlayerState() === YT.PlayerState.CUED) {
            player.playVideo();
        } else if (player.getPlayerState() === YT.PlayerState.ENDED || player.getPlayerState() === YT.PlayerState.UNSTARTED) {
            // If ended or not started, load current video and play
            loadVideo(userPlaylist[currentVideoIndex].id);
        }
    } else if (userPlaylist.length === 0) {
        alert('Your playlist is empty. Please add a YouTube URL first.');
    }
});

nextBtn.addEventListener('click', () => {
    if (userPlaylist.length > 0) {
        playNextVideo();
    } else {
        alert('Your playlist is empty. Please add a YouTube URL first.');
    }
});

addUrlBtn.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    if (!url) {
        alert('Please enter a YouTube URL.');
        return;
    }

    const videoId = extractYouTubeID(url);
    if (!videoId) {
        alert('Invalid YouTube URL. Please enter a valid link.');
        return;
    }

    // Check for duplicates
    if (userPlaylist.some(video => video.id === videoId)) {
        alert('This video is already in your playlist!');
        youtubeUrlInput.value = '';
        return;
    }

    // Fetch video title (optional, but greatly improves UX)
    let videoTitle = `Video ${userPlaylist.length + 1}`;
    try {
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (data && data.title) {
            videoTitle = data.title;
        }
    } catch (error) {
        console.error('Could not fetch video title:', error);
    }

    userPlaylist.push({ id: videoId, title: videoTitle });
    youtubeUrlInput.value = '';
    updatePlaylistDisplay();
    
    // If this is the first video, load and attempt to play it
    if (userPlaylist.length === 1 && isPlayerReady) {
        currentVideoIndex = 0;
        localStorage.setItem('currentVideoIndex', currentVideoIndex);
        loadVideo(userPlaylist[currentVideoIndex].id);
        // player.playVideo(); // Attempt to auto-play (might be blocked)
    }
});

returnHomeButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire playlist and reset the player?')) {
        userPlaylist = [];
        currentVideoIndex = 0;
        localStorage.removeItem('userPlaylist');
        localStorage.removeItem('currentVideoIndex');
        if (player) {
            player.stopVideo(); // Stop any playing video
            player.cueVideoById(''); // Clear the player content
        }
        stopCountdown();
        countdownOverlay.classList.remove('active');
        updatePlaylistDisplay();
        alert('Playlist cleared. Ready for new streams!');
    }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateCoinDisplay();
    updateDateTime(); // Set initial date/time
    setInterval(updateDateTime, 1000); // Update date/time every second
    updatePlaylistDisplay(); // Display initial playlist from localStorage
    // The onYouTubeIframeAPIReady will be called automatically by the YouTube API script
});
