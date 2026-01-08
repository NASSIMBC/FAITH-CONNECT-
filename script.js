// ==========================================
// 1. CONFIGURATION APPWRITE
// ==========================================
const client = new Appwrite.Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('695fc25c0015900d7334');

const account   = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const storage   = new Appwrite.Storage(client);

const DB_ID = '695fcf8000003dcafb64';
const COLL_PROFILES = 'profiles';
const COLL_POSTS    = 'posts';
const COLL_REELS    = 'reels';
const COLL_MESSAGES = 'messages';
const BUCKET_ID     = 'faith-storage';

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let currentUser = null;
let userProfile = null;
let activeChatUser = null;
let selectedImageFile = null;
let selectedAvatarFile = null;

// ==========================================
// 3. SESSION & AUTH
// ==========================================
document.addEventListener('DOMContentLoaded', checkSession);

async function checkSession() {
  try {
    currentUser = await account.get();
    await loadUserProfile();
    loginSuccess();
  } catch {
    document.getElementById('login-page').classList.remove('hidden');
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  await account.createEmailPasswordSession(email, password);
  location.reload();
}

async function handleSignUp() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  await account.create(Appwrite.ID.unique(), email, password);
  await handleLogin();
}

async function logout() {
  await account.deleteSession('current');
  location.reload();
}

function loginSuccess() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  loadAppData();
}

// ==========================================
// 4. PROFIL UTILISATEUR
// ==========================================
async function loadUserProfile() {
  try {
    userProfile = await databases.getDocument(DB_ID, COLL_PROFILES, currentUser.$id);
  } catch {
    userProfile = await databases.createDocument(
      DB_ID,
      COLL_PROFILES,
      currentUser.$id,
      {
        username: currentUser.email.split('@')[0],
        bio: "Nouveau membre",
        avatar_url: "",
        status_text: "Nouveau ici !",
        status_emoji: "👋"
      }
    );
  }
  updateUIProfile();
}

function updateUIProfile() {
  document.querySelectorAll('#user-display, #profile-name')
    .forEach(e => e.innerText = userProfile.username);

  if (userProfile.avatar_url) {
    document.getElementById('profile-avatar-big').innerHTML =
      `<img src="${userProfile.avatar_url}" class="w-full h-full rounded-full object-cover">`;
  }
}

async function saveProfile() {
  let avatarUrl = userProfile.avatar_url;
  if (selectedAvatarFile) {
    const file = await storage.createFile(BUCKET_ID, Appwrite.ID.unique(), selectedAvatarFile);
    avatarUrl = storage.getFileView(BUCKET_ID, file.$id);
  }

  await databases.updateDocument(DB_ID, COLL_PROFILES, currentUser.$id, {
    username: document.getElementById('edit-username').value,
    bio: document.getElementById('edit-bio').value,
    avatar_url: avatarUrl
  });

  location.reload();
}

// ==========================================
// 5. POSTS
// ==========================================
async function publishPost() {
  const input = document.getElementById('new-post-input');
  if (!input.value && !selectedImageFile) return;

  let imageUrl = null;
  if (selectedImageFile) {
    const file = await storage.createFile(BUCKET_ID, Appwrite.ID.unique(), selectedImageFile);
    imageUrl = storage.getFileView(BUCKET_ID, file.$id);
  }

  await databases.createDocument(DB_ID, COLL_POSTS, Appwrite.ID.unique(), {
    user_id: currentUser.$id,
    user_name: userProfile.username,
    content: input.value,
    image_url: imageUrl
  });

  location.reload();
}

async function fetchPosts() {
  const container = document.getElementById('posts-container');
  const res = await databases.listDocuments(DB_ID, COLL_POSTS);
  container.innerHTML = '';
  res.documents.reverse().forEach(post => {
    container.innerHTML += `
      <div class="premium-card p-4 mb-4 rounded-xl">
        <b>${post.user_name}</b>
        <p>${post.content}</p>
        ${post.image_url ? `<img src="${post.image_url}" class="rounded-xl mt-2">` : ''}
      </div>`;
  });
}

// ==========================================
// 6. REELS
// ==========================================
async function uploadReelFile(input) {
  const file = input.files[0];
  if (!file) return;

  const uploaded = await storage.createFile(BUCKET_ID, Appwrite.ID.unique(), file);
  const videoUrl = storage.getFileView(BUCKET_ID, uploaded.$id);

  await databases.createDocument(DB_ID, COLL_REELS, Appwrite.ID.unique(), {
    user_id: currentUser.$id,
    video_url: videoUrl,
    caption: "Nouveau Reel ✨"
  });

  fetchReels();
}

async function fetchReels() {
  const container = document.getElementById('reels-container');
  const res = await databases.listDocuments(DB_ID, COLL_REELS);
  container.innerHTML = '';
  res.documents.forEach(reel => {
    container.innerHTML += `
      <div class="reel-item h-full">
        <video src="${reel.video_url}" class="w-full h-full object-cover" loop controls></video>
      </div>`;
  });
}

// ==========================================
// 7. MESSAGES / CHAT
// ==========================================
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input.value || !activeChatUser) return;

  await databases.createDocument(DB_ID, COLL_MESSAGES, Appwrite.ID.unique(), {
    from: currentUser.$id,
    to: activeChatUser,
    text: input.value
  });

  input.value = '';
  fetchMessages(activeChatUser);
}

async function fetchMessages(userId) {
  const container = document.getElementById('chat-messages');
  const res = await databases.listDocuments(DB_ID, COLL_MESSAGES);
  container.innerHTML = '';
  res.documents
    .filter(m => 
      (m.from === currentUser.$id && m.to === userId) ||
      (m.from === userId && m.to === currentUser.$id)
    )
    .forEach(m => {
      container.innerHTML += `<div>${m.text}</div>`;
    });
}

// ==========================================
// 8. NAVIGATION
// ==========================================
function switchView(view) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');

  if (view === 'home') fetchPosts();
  if (view === 'reels') fetchReels();
}

// ==========================================
// 9. INIT APP
// ==========================================
function loadAppData() {
  fetchPosts();
  fetchReels();
}
