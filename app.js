// Telegram Mini App init
if (window.Telegram && Telegram.WebApp) {
  Telegram.WebApp.expand();
}

const playBtn = document.getElementById("playBtn");
const playerBox = document.getElementById("playerBox");

function extractVideoID(url) {
  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

playBtn.addEventListener("click", () => {
  const url = document.getElementById("ytUrl").value.trim();
  const videoId = extractVideoID(url);

  if (!videoId) {
    alert("Invalid YouTube URL");
    return;
  }

  playerBox.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${videoId}?rel=0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen>
    </iframe>
  `;
});

// Auto-load video from URL param (?video=)
const params = new URLSearchParams(window.location.search);
const autoVideo = params.get("video");
if (autoVideo) {
  document.getElementById("ytUrl").value = autoVideo;
  playBtn.click();
}
