import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   🔥 FIREBASE CONFIG
========================= */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_PROJECT.appspot.com",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
   👤 USER INFO
========================= */
const USER_ID =
  window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || "guest";
const USER_NAME =
  window.Telegram?.WebApp?.initDataUnsafe?.user?.username || "Guest";

/* =========================
   🎯 DOM ELEMENTS
========================= */
const input = document.getElementById("youtubeInput");
const previewContainer = document.getElementById("previewContainer");
const nextBtn = document.getElementById("nextVideoBtn");

/* =========================
   🔗 YOUTUBE UTILITIES
========================= */
function extractVideoId(url) {
  const reg =
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^\s&?/]+)/;
  const match = url.match(reg);
  return match ? match[1] : null;
}

/* =========================
   ☁️ FIRESTORE FUNCTIONS
========================= */
async function saveVideo(videoId, title) {
  await setDoc(doc(db, "videos", videoId), {
    title,
    userId: USER_ID,
    username: USER_NAME,
    createdAt: serverTimestamp()
  });
}

async function getVideo(videoId) {
  const snap = await getDoc(doc(db, "videos", videoId));
  return snap.exists() ? snap.data().title : null;
}

/* =========================
   🎬 FETCH VIDEO TITLE
========================= */
const YT_API_KEY = "YOUR_YOUTUBE_API_KEY";

async function fetchVideoTitle(videoId) {
  const cached = await getVideo(videoId);
  if (cached) return cached;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
  );
  const data = await res.json();

  const title = data.items?.[0]?.snippet?.title || "Unknown Video";
  await saveVideo(videoId, title);

  return title;
}

/* =========================
   🎥 RENDER VIDEO CARD
========================= */
async function renderVideo(videoId, username) {
  const card = document.createElement("div");
  card.className = "video-card";

  const userDiv = document.createElement("div");
  userDiv.className = "user-info";
  userDiv.innerText = `Pasted by: ${username}`;

  const titleDiv = document.createElement("div");
  titleDiv.className = "title";
  titleDiv.innerText = "Loading...";

  const iframe = document.createElement("iframe");
  iframe.width = "100%";
  iframe.height = "200";
  iframe.src = `https://www.youtube.com/embed/${videoId}`;
  iframe.allowFullscreen = true;

  card.append(userDiv, titleDiv, iframe);
  previewContainer.appendChild(card);

  const title = await fetchVideoTitle(videoId);
  titleDiv.innerText = title;
}

/* =========================
   ⚡ REALTIME LISTENER
========================= */
onSnapshot(collection(db, "videos"), (snapshot) => {
  previewContainer.innerHTML = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    renderVideo(doc.id, data.username);
  });
});

/* =========================
   📥 INPUT HANDLER
========================= */
input.addEventListener("paste", () => {
  setTimeout(() => {
    const urls = input.value.split(/\s+/);
    urls.forEach((url) => {
      const id = extractVideoId(url);
      if (id) fetchVideoTitle(id);
    });
    input.value = "";
  }, 50);
});

/* =========================
   🎲 NEXT RANDOM VIDEO
========================= */
async function getRandomVideo() {
  const snapshot = await getDocs(collection(db, "videos"));
  const videos = snapshot.docs.map(doc => ({
    id: doc.id,
    username: doc.data().username
  }));

  if (videos.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * videos.length);
  return videos[randomIndex];
}

nextBtn.addEventListener("click", async () => {
  const randomVideo = await getRandomVideo();
  if (!randomVideo) return alert("No videos available.");

  previewContainer.innerHTML = "";
  renderVideo(randomVideo.id, randomVideo.username);
});
