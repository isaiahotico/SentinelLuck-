// Telegram Mini App
if(window.Telegram?.WebApp) Telegram.WebApp.expand();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey:"AIzaSyAj6o2HbMEC472gDoNuFSDmdOSJj8k9S_U",
  authDomain:"fir-493d0.firebaseapp.com",
  projectId:"fir-493d0",
  storageBucket:"fir-493d0.firebasestorage.app",
  messagingSenderId:"935141131610",
  appId:"1:935141131610:web:7998e21d07d7b4c71b5f63"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const LOCAL_KEY = "yt_top_table";
const CLOUD_COLLECTION = "global_top_videos";

let player;

// =======================
// Utilities
// =======================
function extractVideoId(url) {
  const reg = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(reg);
  return match ? match[1] : null;
}
function getLocalData() { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; }
function saveLocalData(data) { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }

// =======================
// Table Rendering
// =======================
function renderTable() {
  const tbody=document.querySelector("#topTable tbody");
  const data=getLocalData();
  tbody.innerHTML="";
  data.forEach((v,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${i+1}</td>
      <td><a href="${v.videoUrl}" target="_blank">▶</a></td>
      <td>${v.plays}</td>
      <td>${v.lastPlayed}</td>
      <td>
        <button class="table-btn" onclick="playVideo('${v.videoId}','${v.videoUrl}')">Play</button>
        <button class="table-btn" onclick="nextVideo(${i})">Next</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =======================
// Firebase Sync
// =======================
async function syncToFirebase(video){
  try{
    await setDoc(doc(db,CLOUD_COLLECTION,video.videoId),{
      videoId:video.videoId,
      videoUrl:video.videoUrl,
      plays:video.plays,
      lastPlayed:video.lastPlayed,
      uploadedAt:serverTimestamp()
    },{merge:true});
  }catch(e){console.warn("Firebase sync failed");}
}

async function loadGlobalData(){
  try{
    const snap=await getDocs(collection(db,CLOUD_COLLECTION));
    const cloudData=[];
    snap.forEach(doc=>cloudData.push(doc.data()));
    cloudData.sort((a,b)=>b.plays-a.plays);
    saveLocalData(cloudData);
  }catch(e){console.warn("Offline – using local data");}
  renderTable();
}

// =======================
// Register Play
// =======================
function registerPlay(videoId, videoUrl){
  const now=new Date().toLocaleString();
  let data=getLocalData();
  let item=data.find(v=>v.videoId===videoId);
  if(item){ item.plays+=1; item.lastPlayed=now; } 
  else{ item={videoId,videoUrl,plays:1,lastPlayed:now}; data.push(item); }
  data.sort((a,b)=>b.plays-a.plays);
  saveLocalData(data);
  renderTable();
  syncToFirebase(item);
}

// =======================
// YouTube Player
// =======================
window.onYouTubeIframeAPIReady=()=>{};
window.loadVideo=()=>{
  const url=document.getElementById("ytUrl").value.trim();
  const videoId=extractVideoId(url);
  if(!videoId){alert("Invalid YouTube URL"); return;}
  if(player){player.loadVideoById(videoId);}
  else{player=new YT.Player("player",{height:"230",width:"100%",videoId,playerVars:{rel:0,modestbranding:1,playsinline:1}});}
  registerPlay(videoId,url);
}

// =======================
// Upload New Video
// =======================
window.uploadVideo=()=>{
  const url=document.getElementById("ytUpload").value.trim();
  const videoId=extractVideoId(url);
  if(!videoId){alert("Invalid YouTube URL"); return;}
  // Check duplicates locally
  const local=getLocalData();
  if(local.find(v=>v.videoId===videoId)){alert("Video already exists"); return;}
  const newVideo={videoId,videoUrl:url,plays:0,lastPlayed:"-"}; 
  local.push(newVideo); 
  saveLocalData(local); 
  renderTable(); 
  syncToFirebase(newVideo);
  document.getElementById("ytUpload").value="";
}

// =======================
// Play / Next Buttons
// =======================
window.playVideo=(videoId,url)=>{
  if(player){player.loadVideoById(videoId);}
  else{player=new YT.Player("player",{height:"230",width:"100%",videoId,playerVars:{rel:0,modestbranding:1,playsinline:1}});}
  registerPlay(videoId,url);
}
window.nextVideo=(currentIndex)=>{
  const data=getLocalData();
  const nextIndex=(currentIndex+1)%data.length;
  const next=data[nextIndex];
  playVideo(next.videoId,next.videoUrl);
}

// =======================
// Auto-load via URL param
// =======================
const params=new URLSearchParams(window.location.search);
const videoParam=params.get("video");
if(videoParam){document.getElementById("ytUrl").value=videoParam; setTimeout(loadVideo,800);}

// =======================
// Init
// =======================
loadGlobalData();
