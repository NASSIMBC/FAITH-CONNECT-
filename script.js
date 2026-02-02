// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. GESTION UTILISATEUR & AUTH
// ==========================================
let currentUser = null;
let userProfile = null;
let activeChatUser = null;
let selectedImageFile = null;
let selectedAvatarFile = null;

// ✅ CANVAS global (évite variables implicites)
let canvas = null;
let ctx = null;

document.addEventListener('DOMContentLoaded', checkSession);

// --- GESTION TOUCHE ENTRÉE ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    if (document.activeElement.id === 'chat-input') {
      e.preventDefault();
      sendChatMessage();
    }
    if (document.activeElement.id.startsWith('input-comment-')) {
      e.preventDefault();
      const postId = document.activeElement.id.replace('input-comment-', '');
      sendComment(postId);
    }
    if (document.activeElement.id === 'reel-comment-input') {
      e.preventDefault();
      sendReelComment();
    }
    // NOUVEAU : Touche Entrée pour l'IA
    if (document.activeElement.id === 'ai-bible-input') {
      e.preventDefault();
      askFaithAI();
    }
  }
});

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    loginSuccess();
  } else {
    document.getElementById('login-page').classList.remove('hidden');
  }
}

async function loadUserProfile() {
  let { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
  if (!data) {
    const namePart = currentUser.email.split('@')[0];
    const newProfile = {
      id: currentUser.id,
      email: currentUser.email,
      username: namePart,
      bio: "Nouveau membre",
      status_text: "Nouveau ici !",
      status_emoji: "👋"
    };
    await supabaseClient.from('profiles').insert([newProfile]);
    userProfile = newProfile;
  } else {
    userProfile = data;
  }
  updateUIProfile();
  updateFriendCount(currentUser.id);
}

function loginSuccess() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  loadAppData();
}

async function handleSignUp() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) alert(error.message); else alert("Compte créé ! Vérifiez vos emails.");
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert(error.message); else location.reload();
}

async function logout() { await supabaseClient.auth.signOut(); location.reload(); }

// ==========================================
// 3. NAVIGATION & UI (DESIGN PREMIUM + ANIMATIONS)
// ==========================================
function switchView(viewName) {
  ['home', 'reels', 'bible', 'messages', 'profile', 'public-profile'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('animate-view');
    }
    const btn = document.getElementById('nav-' + v);
    if (btn) {
      btn.classList.remove('text-purple-400', 'scale-110');
      btn.classList.add('text-gray-500');
    }
  });

  const target = document.getElementById('view-' + viewName);
  if (target) {
    target.classList.remove('hidden');
    void target.offsetWidth;
    target.classList.add('animate-view');
  }

  const activeBtn = document.getElementById('nav-' + viewName);
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-500');
    activeBtn.classList.add('text-purple-400', 'scale-110', 'transition-transform', 'duration-200');
  }

  const reelsContainer = document.getElementById('reels-container');
  if (viewName === 'reels') {
    fetchReels();
  } else {
    if (reelsContainer) reelsContainer.innerHTML = '';
  }

  if (viewName === 'bible') showTestament('NT');

  if (viewName === 'messages') {
    const badge = document.getElementById('msg-badge');
    if (badge) badge.classList.add('hidden');
    if (!activeChatUser) resetChat();
  }
  if (viewName === 'profile') switchProfileTab('friends');
  if (viewName !== 'messages' && viewName !== 'public-profile') activeChatUser = null;
}

async function loadAppData() {
  await Promise.all([
    fetchPosts(),
    renderStoriesList(),
    fetchPrayers(),
    fetchHelpRequests(),
    fetchEvents(),
    loadConversations(),
    fetchNotifications()
  ]);
  resetChat();
  subscribeToRealtime();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. BIBLE (VERSION FINALE & CORRIGÉE)
// ==========================================
let currentBibleVersion = 'ls1910';
let currentBookId = 43;
let currentBookName = "Jean";
let currentChapter = 1;

const bibleStructure = {
  AT: [
    { name: "Genèse", id: 1 }, { name: "Exode", id: 2 }, { name: "Lévitique", id: 3 }, { name: "Nombres", id: 4 },
    { name: "Deutéronome", id: 5 }, { name: "Josué", id: 6 }, { name: "Juges", id: 7 }, { name: "Ruth", id: 8 },
    { name: "1 Samuel", id: 9 }, { name: "2 Samuel", id: 10 }, { name: "1 Rois", id: 11 }, { name: "2 Rois", id: 12 },
    { name: "1 Chroniques", id: 13 }, { name: "2 Chroniques", id: 14 }, { name: "Esdras", id: 15 }, { name: "Néhémie", id: 16 },
    { name: "Esther", id: 17 }, { name: "Job", id: 18 }, { name: "Psaumes", id: 19 }, { name: "Proverbes", id: 20 },
    { name: "Ecclésiaste", id: 21 }, { name: "Cantique", id: 22 }, { name: "Ésaïe", id: 23 }, { name: "Jérémie", id: 24 },
    { name: "Lamentations", id: 25 }, { name: "Ézéchiel", id: 26 }, { name: "Daniel", id: 27 }, { name: "Osée", id: 28 },
    { name: "Joël", id: 29 }, { name: "Amos", id: 30 }, { name: "Abdias", id: 31 }, { name: "Jonas", id: 32 },
    { name: "Michée", id: 33 }, { name: "Nahum", id: 34 }, { name: "Habacuc", id: 35 }, { name: "Sophonie", id: 36 },
    { name: "Aggée", id: 37 }, { name: "Zacharie", id: 38 }, { name: "Malachie", id: 39 }
  ],
  NT: [
    { name: "Matthieu", id: 40 }, { name: "Marc", id: 41 }, { name: "Luc", id: 42 }, { name: "Jean", id: 43 },
    { name: "Actes", id: 44 }, { name: "Romains", id: 45 }, { name: "1 Corinthiens", id: 46 }, { name: "2 Corinthiens", id: 47 },
    { name: "Galates", id: 48 }, { name: "Éphésiens", id: 49 }, { name: "Philippiens", id: 50 }, { name: "Colossiens", id: 51 },
    { name: "1 Thessal.", id: 52 }, { name: "2 Thessal.", id: 53 }, { name: "1 Timothée", id: 54 }, { name: "2 Timothée", id: 55 },
    { name: "Tite", id: 56 }, { name: "Philémon", id: 57 }, { name: "Hébreux", id: 58 }, { name: "Jacques", id: 59 },
    { name: "1 Pierre", id: 60 }, { name: "2 Pierre", id: 61 }, { name: "1 Jean", id: 62 }, { name: "2 Jean", id: 63 },
    { name: "3 Jean", id: 64 }, { name: "Jude", id: 65 }, { name: "Apocalypse", id: 66 }
  ]
};

function showTestament(type) {
  const atBtn = document.getElementById('btn-at');
  const ntBtn = document.getElementById('btn-nt');
  const listContainer = document.getElementById('bible-books-list');
  const reader = document.getElementById('bible-reader');

  if (reader) reader.classList.add('hidden');
  if (listContainer) listContainer.classList.remove('hidden');

  if (!atBtn || !ntBtn) return;

  if (type === 'AT') {
    atBtn.className = "flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg";
    ntBtn.className = "flex-1 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors";
  } else {
    ntBtn.className = "flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg";
    atBtn.className = "flex-1 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors";
  }

  if (listContainer) {
    listContainer.innerHTML = bibleStructure[type].map(book => `
      <button onclick="loadBibleChapter(${book.id}, '${book.name}', 1)" class="p-3 bg-gray-800 border border-white/5 rounded-xl hover:bg-gray-700 transition-all text-left group active:scale-95 animate-fade-in">
          <span class="font-bold text-white group-hover:text-purple-400 text-sm transition-colors">${book.name}</span>
      </button>
    `).join('');
  }
}

async function loadBibleChapter(id, name, chapter) {
  const reader = document.getElementById('bible-reader');
  const listContainer = document.getElementById('bible-books-list');
  const content = document.getElementById('reader-content');
  const title = document.getElementById('reader-title');

  if (!reader) return;

  if (listContainer) listContainer.classList.add('hidden');
  reader.classList.remove('hidden');

  currentBookId = id;
  currentBookName = name;
  currentChapter = chapter;

  if (title) title.innerText = `${name} ${chapter}`;

  content.innerHTML = `
    <div class="flex flex-col h-full items-center justify-center space-y-4">
      <div class="w-8 h-8 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
      <p class="text-xs text-gray-500 animate-pulse">Chargement...</p>
    </div>`;

  try {
    // ✅ Proxy anti-CORS (GitHub Pages)
    const base = (window.APP_CONFIG && window.APP_CONFIG.BIBLE_API_BASE) || "https://api.getbible.net/v2";
    let apiUrl = `${base}/${currentBibleVersion}/${id}/${chapter}.json`;

    const proxy = window.APP_CONFIG && window.APP_CONFIG.BIBLE_PROXY_URL;
    const useProxy = (window.APP_CONFIG && window.APP_CONFIG.ENABLE_BIBLE_PROXY) !== false;

    if (proxy && useProxy) apiUrl = proxy + encodeURIComponent(apiUrl);

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Chapitre introuvable");

    const data = await response.json();

    if (data.verses && data.verses.length > 0) {
      const isArabic = currentBibleVersion === 'vandyke';
      const dir = isArabic ? 'rtl' : 'ltr';
      const align = isArabic ? 'text-right' : 'text-justify';
      const font = isArabic ? 'font-sans' : 'font-serif';

      let formattedText = data.verses.map(v =>
        `<p class="mb-3 leading-relaxed text-gray-200 ${align}" dir="${dir}">
          <sup class="text-purple-400 text-[10px] font-bold mr-1 select-none">${v.verse}</sup>${v.text}
        </p>`
      ).join('');

      const prevBtn = chapter > 1
        ? `<button onclick="loadBibleChapter(${id}, '${name}', ${chapter - 1})" class="flex-1 bg-gray-800 py-3 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-700 transition-colors">← Précédent</button>`
        : `<div class="flex-1"></div>`;

      const nextBtn = `<button onclick="loadBibleChapter(${id}, '${name}', ${chapter + 1})" class="flex-1 bg-purple-600 py-3 rounded-xl text-xs font-bold text-white shadow-lg hover:bg-purple-500 transition-colors">Suivant →</button>`;

      content.innerHTML = `
        <div class="${font} text-sm px-2 pt-2 pb-20 animate-fade-in">
          ${formattedText}
          <div class="flex justify-between gap-4 mt-8 border-t border-white/10 pt-6" dir="ltr">
            ${prevBtn}
            ${nextBtn}
          </div>
        </div>
      `;
      content.scrollTop = 0;
    } else {
      content.innerHTML = `
        <div class="text-center text-gray-400 mt-20">
          <p class="mb-4">Fin du livre.</p>
          <button onclick="closeBibleReader()" class="bg-gray-800 px-6 py-2 rounded-full text-xs text-white border border-white/10 hover:bg-gray-700">Retour aux livres</button>
        </div>`;
    }
  } catch (error) {
    console.error("Erreur Bible:", error);
    content.innerHTML = `
      <div class="text-center text-red-400 mt-20 px-6">
        <p class="text-xs mb-2">Impossible de charger le texte.</p>
        <p class="text-[10px] text-gray-600 mb-4 opacity-50">${error.message}</p>
        <button onclick="loadBibleChapter(${id}, '${name}', ${chapter})" class="bg-red-500/10 text-red-400 px-4 py-2 rounded text-xs hover:bg-red-500/20">Réessayer</button>
      </div>`;
  }
}

function closeBibleReader() {
  document.getElementById('bible-reader').classList.add('hidden');
  const listContainer = document.getElementById('bible-books-list');
  if (listContainer) listContainer.classList.remove('hidden');
}

function changeBibleVersion(version) {
  currentBibleVersion = version;
  const reader = document.getElementById('bible-reader');
  if (reader && !reader.classList.contains('hidden')) {
    loadBibleChapter(currentBookId, currentBookName, currentChapter);
  }
}

// ==========================================
// 5. FAITH AI (HYBRIDE & ROBUSTE)
// ==========================================
async function askFaithAI() {
  const input = document.getElementById('ai-bible-input');
  const area = document.getElementById('ai-response-area');
  const question = input.value.trim();

  const FUNCTION_URL = 'https://uduajuxobmywmkjnawjn.supabase.co/functions/v1/faith-ai';
  if (!question) return;

  area.classList.remove('hidden');
  area.innerHTML = `<div class="flex items-center gap-2 text-purple-300 text-xs animate-pulse">Faith AI réfléchit...</div>`;
  input.value = '';

  try {
    // ✅ token user (évite 401) + fallback
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token || SUPABASE_KEY;

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    area.innerHTML = `<div class="bg-gray-800/50 border-l-4 border-purple-500 pl-3 py-2 rounded-r-lg shadow-lg">
      <p class="text-[10px] text-gray-500 mb-1">QUESTION : "${question}"</p>
      <p class="text-white text-sm font-serif leading-relaxed text-justify">${data.answer}</p>
    </div>`;
  } catch (error) {
    console.error("Erreur Faith AI:", error);
    area.innerHTML = `<div class="text-red-400 text-xs">Erreur : ${error.message}</div>`;
  }
}

// ==========================================
// 5. PROFIL
// ==========================================
async function updateMyStatus() {
  const text = prompt("Ton humeur actuelle ?");
  if (text === null) return;
  const emoji = prompt("Un emoji ?", "💻");
  const { error } = await supabaseClient.from('profiles').update({
    status_text: text,
    status_emoji: emoji || "👋",
    status_updated_at: new Date().toISOString()
  }).eq('id', currentUser.id);

  if (error) alert("Erreur : " + error.message);
  else {
    userProfile.status_text = text;
    userProfile.status_emoji = emoji || "👋";
    updateUIProfile();
  }
}

function updateUIProfile() {
  const initials = userProfile.username ? userProfile.username.substring(0, 2).toUpperCase() : "??";
  document.querySelectorAll('#user-display, #profile-name').forEach(el => el.innerText = userProfile.username);
  if (document.getElementById('profile-email')) document.getElementById('profile-email').innerText = "@" + userProfile.username;

  const textDisplay = document.getElementById('status-text-display');
  const emojiDisplay = document.getElementById('status-emoji-display');
  if (textDisplay && emojiDisplay) {
    textDisplay.innerText = userProfile.status_text || "Ajouter un statut...";
    emojiDisplay.innerText = userProfile.status_emoji || "👋";
  }

  const avatarElements = ['current-user-avatar-small', 'profile-avatar-big'];
  avatarElements.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (userProfile.avatar_url) {
      el.innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover rounded-full">`;
      el.innerText = "";
    } else {
      el.innerHTML = "";
      el.innerText = initials;
    }
  });
}

function openEditModal() {
  document.getElementById('edit-profile-modal').classList.remove('hidden');
  document.getElementById('edit-username').value = userProfile.username;
  document.getElementById('edit-bio').value = userProfile.bio;
  const preview = document.getElementById('edit-avatar-preview');
  if (userProfile.avatar_url) preview.src = userProfile.avatar_url;
  else preview.src = "https://ui-avatars.com/api/?name=" + userProfile.username + "&background=random";
  selectedAvatarFile = null;
}

function closeEditModal() { document.getElementById('edit-profile-modal').classList.add('hidden'); }

function handleAvatarPreview(input) {
  if (input.files && input.files[0]) {
    selectedAvatarFile = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) { document.getElementById('edit-avatar-preview').src = e.target.result; }
    reader.readAsDataURL(input.files[0]);
  }
}

async function saveProfile() {
  const newUsername = document.getElementById('edit-username').value;
  const newBio = document.getElementById('edit-bio').value;
  const btn = document.querySelector('#edit-profile-modal button:last-child');
  if (!newUsername.trim()) return alert("Pseudo requis");
  btn.innerText = "Sauvegarde..."; btn.disabled = true;
  try {
    let finalAvatarUrl = userProfile.avatar_url;
    if (selectedAvatarFile) {
      const fileExt = selectedAvatarFile.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, selectedAvatarFile);
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
      finalAvatarUrl = data.publicUrl;
    }
    const { error } = await supabaseClient.from('profiles').update({
      username: newUsername,
      bio: newBio,
      avatar_url: finalAvatarUrl
    }).eq('id', currentUser.id);

    if (error) throw error;

    userProfile.username = newUsername;
    userProfile.bio = newBio;
    userProfile.avatar_url = finalAvatarUrl;

    updateUIProfile();
    closeEditModal();
    alert("Profil mis à jour !");
  } catch (error) {
    alert("Erreur : " + error.message);
  } finally {
    btn.innerText = "Enregistrer";
    btn.disabled = false;
  }
}

// ==========================================
// 5. GESTION DES AMIS
// ==========================================
async function getFriendIds() {
  const { data } = await supabaseClient
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

  const friendIds = new Set([currentUser.id]);
  if (data) data.forEach(f => { friendIds.add(f.requester_id === currentUser.id ? f.receiver_id : f.requester_id); });
  return Array.from(friendIds);
}

async function switchProfileTab(tabName) {
  const btnFriends = document.getElementById('tab-friends');
  const btnRequests = document.getElementById('tab-requests');
  const container = document.getElementById('profile-social-list');
  if (!btnFriends || !btnRequests || !container) return;

  if (tabName === 'friends') {
    btnFriends.className = "pb-2 text-sm font-bold text-purple-400 border-b-2 border-purple-400";
    btnRequests.className = "pb-2 text-sm font-bold text-gray-500 hover:text-white";
    await fetchMyFriendsList(container);
  } else {
    btnRequests.className = "pb-2 text-sm font-bold text-purple-400 border-b-2 border-purple-400";
    btnFriends.className = "pb-2 text-sm font-bold text-gray-500 hover:text-white";
    await fetchMyRequestsList(container);
  }
}

async function fetchMyFriendsList(container) {
  container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 italic">Chargement...</div>';
  const friendIds = await getFriendIds();
  const otherFriendIds = friendIds.filter(id => id !== currentUser.id);

  if (otherFriendIds.length === 0) {
    container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Pas encore d\'amis.</div>';
    return;
  }
  const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', otherFriendIds);
  container.innerHTML = '';
  if (profiles) profiles.forEach(p => {
    const avatarHtml = p.avatar_url
      ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
      : `<div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">${p.username.substring(0, 2).toUpperCase()}</div>`;

    container.insertAdjacentHTML('beforeend',
      `<div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-2xl border border-white/5 mb-2">
        <div class="flex items-center gap-3">
          ${avatarHtml}
          <div class="text-left">
            <p class="text-sm font-bold text-white">${p.username}</p>
            <p class="text-[10px] text-gray-500 truncate w-24">${p.status_text || 'En ligne'}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="openDirectChat('${p.id}', '${p.username}')" class="p-2 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600"><i data-lucide="message-circle" class="w-4 h-4"></i></button>
          <button onclick="removeFriend('${p.id}')" class="p-2 bg-red-600/10 text-red-400 rounded-xl hover:bg-red-600"><i data-lucide="user-minus" class="w-4 h-4"></i></button>
        </div>
      </div>`
    );
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
  const countEl = document.getElementById('stats-friends-count');
  if (countEl) countEl.innerText = otherFriendIds.length;
}

async function fetchMyRequestsList(container) {
  container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 italic">Chargement...</div>';
  const { data: requests } = await supabaseClient.from('friendships')
    .select('*')
    .eq('receiver_id', currentUser.id)
    .eq('status', 'pending');

  if (!requests || requests.length === 0) {
    container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Aucune demande.</div>';
    document.getElementById('profile-req-badge').classList.add('hidden');
    return;
  }

  document.getElementById('profile-req-badge').innerText = requests.length;
  document.getElementById('profile-req-badge').classList.remove('hidden');

  const requesterIds = requests.map(r => r.requester_id);
  const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', requesterIds);

  container.innerHTML = '';
  if (profiles) requests.forEach(req => {
    const p = profiles.find(prof => prof.id === req.requester_id);
    if (!p) return;

    const avatarHtml = p.avatar_url
      ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
      : `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs">${p.username.substring(0, 2).toUpperCase()}</div>`;

    container.insertAdjacentHTML('beforeend',
      `<div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-white/5 mb-2">
        <div class="flex items-center gap-3">${avatarHtml}<p class="text-sm font-bold text-white">${p.username}</p></div>
        <div class="flex gap-2">
          <button onclick="handleFriendRequest('${req.id}', true)" class="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg">Accepter</button>
          <button onclick="handleFriendRequest('${req.id}', false)" class="px-4 py-1.5 bg-red-600/20 text-red-400 text-xs font-bold rounded-lg">Refuser</button>
        </div>
      </div>`
    );
  });
}

async function removeFriend(friendId) {
  if (!confirm("Retirer cet ami ?")) return;
  await supabaseClient.from('friendships').delete().or(
    `and(requester_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${currentUser.id})`
  );
  switchProfileTab('friends');
  updateFriendCount(currentUser.id);
}

// ==========================================
// 6. CHAT & MESSAGERIE
// ==========================================
function openDirectChat(userId, username) {
  startChat({ id: userId, username: username });
  if (window.innerWidth < 768) {
    document.getElementById('conversations-sidebar').classList.add('hidden');
    document.getElementById('chat-detail').classList.remove('hidden');
    document.getElementById('chat-detail').classList.add('flex');
  }
}

// ... (ton code chat inchangé)
// ⚠️ NOTE : tu as fait référence à sendReelComment(), toggleReelAmen(), etc. non présents ici.
// Garde tes fonctions existantes si elles sont plus bas dans ton vrai fichier.

async function loadConversations() {
  const container = document.getElementById('messages-list');
  if (!container) return;

  const { data: messages } = await supabaseClient
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .not('receiver_id', 'is', null)
    .order('created_at', { ascending: false });

  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center mt-4 text-xs italic">Aucune discussion.</div>';
    return;
  }

  const uniqueConversations = {};
  for (const msg of messages) {
    const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
    if (!otherUserId || uniqueConversations[otherUserId]) continue;
    uniqueConversations[otherUserId] = {
      userId: otherUserId,
      lastMessage: msg.content,
      time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
  const conversationArray = Object.values(uniqueConversations);

  if (conversationArray.length > 0) {
    const ids = conversationArray.map(c => c.userId);
    const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url').in('id', ids);

    container.innerHTML = conversationArray.map(conv => {
      const p = profiles.find(x => x.id === conv.userId);
      const name = p ? p.username : "Ami";
      const avatarDisplay = p && p.avatar_url
        ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
        : `<div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${name.substring(0, 2).toUpperCase()}</div>`;
      return `
        <div onclick="openDirectChat('${conv.userId}', '${name.replace(/'/g, "\\'")}')" class="p-3 hover:bg-white/5 rounded-2xl cursor-pointer flex items-center space-x-3 border-b border-white/5 transition-colors">
          <div class="relative">
            ${avatarDisplay}
            <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline mb-0.5">
              <h4 class="font-bold text-sm text-white truncate">${name}</h4>
              <span class="text-[10px] text-gray-500">${conv.time}</span>
            </div>
            <p class="text-xs text-gray-400 truncate">${conv.lastMessage}</p>
          </div>
        </div>`;
    }).join('');
  }
}

function startChat(targetProfile) {
  activeChatUser = targetProfile;
  switchView('messages');

  document.getElementById('chat-with-name').innerHTML = `${targetProfile.username}`;
  const headerAvatar = document.getElementById('chat-header-avatar');
  const headerInitials = document.getElementById('chat-header-initials');

  supabaseClient.from('profiles').select('*').eq('id', targetProfile.id).single().then(({ data }) => {
    if (data && data.avatar_url) {
      headerAvatar.src = data.avatar_url;
      headerAvatar.classList.remove('hidden');
      headerInitials.classList.add('hidden');
    } else {
      headerAvatar.classList.add('hidden');
      headerInitials.classList.remove('hidden');
      headerInitials.innerText = targetProfile.username.substring(0, 2).toUpperCase();
    }
  });

  const input = document.getElementById('chat-input');
  if (input) { input.disabled = false; input.focus(); }
  fetchMessages();
}

function resetChat() {
  activeChatUser = null;
  document.getElementById('chat-with-name').innerText = "Sélectionnez un ami";
  const container = document.getElementById('chat-history');
  if (container) container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-600 italic text-sm"><p>Cliquez sur une discussion</p></div>`;
  const input = document.getElementById('chat-input');
  if (input) { input.value = ""; input.disabled = true; input.placeholder = "Sélectionnez un ami d'abord"; }
}

async function fetchMessages() {
  const container = document.getElementById('chat-history');
  if (!container || !activeChatUser) return;

  const { data } = await supabaseClient.from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });

  container.innerHTML = '';

  if (data && data.length > 0) {
    let lastSenderId = null;

    data.forEach(msg => {
      const isMe = msg.sender_id === currentUser.id;
      const isSameSender = lastSenderId === msg.sender_id;
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const bubbleClass = isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm';
      const marginClass = isSameSender ? 'mt-1' : 'mt-4';

      container.insertAdjacentHTML('beforeend', `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'} ${marginClass} group">
          <div class="max-w-[75%]">
            <div class="${bubbleClass} px-4 py-2 rounded-2xl text-sm shadow-sm relative">
              ${msg.content}
              <span class="text-[9px] opacity-60 block text-right mt-1 w-full ${isMe ? 'text-purple-200' : 'text-gray-400'}">${time}</span>
            </div>
          </div>
        </div>
      `);
      lastSenderId = msg.sender_id;
    });
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  } else {
    container.innerHTML = '<div class="text-center text-gray-600 text-xs mt-10 italic">Dites bonjour ! 👋</div>';
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!activeChatUser || !input || !input.value.trim()) return;
  const { error } = await supabaseClient.from('messages').insert([{
    content: input.value,
    sender_id: currentUser.id,
    sender_email: currentUser.email,
    sender_name: userProfile.username,
    receiver_id: activeChatUser.id
  }]);
  if (!error) { input.value = ''; fetchMessages(); loadConversations(); }
}

// ==========================================
// 8. GESTION DES POSTS
// ==========================================
function handleImageSelect(input) {
  if (input.files && input.files[0]) {
    selectedImageFile = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('image-preview').src = e.target.result;
      document.getElementById('image-preview-container').classList.remove('hidden');
    }
    reader.readAsDataURL(input.files[0]);
  }
}

function removeImage() {
  selectedImageFile = null;
  document.getElementById('post-image-file').value = "";
  document.getElementById('image-preview-container').classList.add('hidden');
}

async function publishPost() {
  const input = document.getElementById('new-post-input');
  const btn = document.getElementById('btn-publish');
  if (!input.value.trim() && !selectedImageFile) return alert("Le post est vide !");
  btn.innerHTML = 'Envoi...'; btn.disabled = true;
  try {
    let imageUrl = null;
    if (selectedImageFile) {
      const fileExt = selectedImageFile.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabaseClient.storage.from('post-images').upload(fileName, selectedImageFile);
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);
      imageUrl = data.publicUrl;
    }
    await supabaseClient.from('posts').insert([{
      user_id: currentUser.id,
      content: input.value,
      user_name: userProfile.username,
      image_url: imageUrl,
      avatar_initials: userProfile.username.substring(0, 2).toUpperCase()
    }]);
    input.value = '';
    removeImage();
    fetchPosts();
  } catch (error) {
    alert("Erreur : " + error.message);
  } finally {
    btn.innerHTML = 'Publier';
    btn.disabled = false;
  }
}

// ... fetchPosts inchangé (tu l’as collé, je n’y touche pas)

async function deletePost(id) {
  if (!confirm("Supprimer ce post ?")) return;
  try {
    const { data: post } = await supabaseClient.from('posts').select('image_url').eq('id', id).single();

    // ✅ Suppression storage : corrige le vrai chemin
    if (post && post.image_url) {
      // ex: https://.../storage/v1/object/public/post-images/<path>
      const marker = '/post-images/';
      const idx = post.image_url.indexOf(marker);
      if (idx !== -1) {
        const pathInBucket = post.image_url.substring(idx + marker.length); // ex: userId/xxx.png OR verses/...
        await supabaseClient.storage.from('post-images').remove([pathInBucket]);
      }
    }

    const { error } = await supabaseClient.from('posts').delete().eq('id', id).eq('user_id', currentUser.id);
    if (!error) {
      document.getElementById(`post-${id}`).remove();
    } else {
      throw error;
    }
  } catch (e) {
    alert("Erreur suppression : " + e.message);
  }
}

// ==========================================
// 12. GESTION DES STORIES
// ==========================================
// (inchangé)


// ==========================================
// 13. CRÉATEUR DE VERSETS (CANVAS)
// ==========================================

let currentTextAlign = 'center';
let currentBgType = 'color';
let currentBgValue = '#1f2937';
let uploadedBgImage = null;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('verse-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    setTimeout(drawCanvas, 500);
  }
});

// ✅ une seule version
function openVerseEditor() {
  document.getElementById('verse-editor-modal').classList.remove('hidden');
  drawCanvas();
}
function closeVerseEditor() {
  document.getElementById('verse-editor-modal').classList.add('hidden');
}

// ✅ une seule version
function setBackground(type, value) {
  currentBgType = type;
  currentBgValue = value;
  if (type === 'color') uploadedBgImage = null; // important
  drawCanvas();
}

// ✅ une seule version
function handleBgUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedBgImage = new Image();
      uploadedBgImage.onload = function () {
        currentBgType = 'image';
        currentBgValue = null;
        drawCanvas();
      };
      uploadedBgImage.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ✅ garde uniquement la version "STYLE CANVA"
function drawCanvas() {
  canvas = canvas || document.getElementById('verse-canvas');
  if (!canvas) return;
  ctx = ctx || canvas.getContext('2d');

  const text = document.getElementById('verse-text-input').value;

  const color = document.getElementById('text-color-picker').value;
  const fontSize = parseInt(document.getElementById('font-size-picker').value);
  const fontFamily = document.getElementById('font-family-picker').value;
  const lineHeightMultiplier = parseFloat(document.getElementById('line-height-slider').value);

  const strokeColor = document.getElementById('stroke-color-picker').value;
  const strokeWidth = parseFloat(document.getElementById('stroke-width-slider').value);

  const overlayOpacity = document.getElementById('overlay-slider').value;
  const blurAmount = document.getElementById('blur-slider').value;
  const grayscaleAmount = document.getElementById('grayscale-slider').value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.filter = `blur(${blurAmount}px) grayscale(${grayscaleAmount}%)`;

  if (currentBgType === 'color') {
    ctx.fillStyle = currentBgValue || '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (currentBgType === 'image' && uploadedBgImage) {
    const scale = Math.max(canvas.width / uploadedBgImage.width, canvas.height / uploadedBgImage.height);
    const x = (canvas.width / 2) - (uploadedBgImage.width / 2) * scale;
    const y = (canvas.height / 2) - (uploadedBgImage.height / 2) * scale;
    ctx.drawImage(uploadedBgImage, x, y, uploadedBgImage.width * scale, uploadedBgImage.height * scale);
  }

  ctx.filter = 'none';

  ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (text) {
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = currentTextAlign;
    ctx.textBaseline = 'middle';

    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
    }

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const maxWidth = canvas.width - 60;
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      let testLine = currentLine + ' ' + words[i];
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const lineHeight = fontSize * lineHeightMultiplier;
    const totalHeight = lines.length * lineHeight;
    let startY = (canvas.height - totalHeight) / 2 + (lineHeight / 2);

    let startX = canvas.width / 2;
    if (currentTextAlign === 'left') startX = 30;
    if (currentTextAlign === 'right') startX = canvas.width - 30;

    lines.forEach((line, i) => {
      let yPos = startY + (i * lineHeight);
      if (strokeWidth > 0) ctx.strokeText(line, startX, yPos);
      ctx.fillText(line, startX, yPos);
    });
  }

  ctx.shadowColor = "transparent";
}

// ==========================================
// REELS (inchangé)
// ==========================================
async function fetchReels() {
  const container = document.getElementById('reels-container');
  if (!container) return;

  container.innerHTML = '<div class="col-span-full text-center text-gray-500 mt-10 animate-pulse">Chargement des versets...</div>';

  const { data: reels, error } = await supabaseClient
    .from('reels')
    .select('*, profiles:user_id(username, avatar_url)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  container.innerHTML = '';

  if (reels && reels.length > 0) {
    reels.forEach(reel => {
      const isImage = reel.video_url.includes('.png') || reel.video_url.includes('.jpg') || reel.video_url.includes('verses/');

      let contentHtml = '';

      if (isImage) {
        contentHtml = `<img src="${reel.video_url}" class="w-full h-auto object-cover rounded-2xl shadow-lg border border-white/5" loading="lazy">`;
      } else {
        let videoId = reel.video_url.split('v=')[1] || reel.video_url.split('/').pop();
        const ampersandPosition = videoId.indexOf('&');
        if (ampersandPosition !== -1) videoId = videoId.substring(0, ampersandPosition);
        contentHtml = `<iframe class="w-full aspect-[9/16] rounded-2xl shadow-lg border border-white/5" src="https://www.youtube.com/embed/${videoId}?controls=0&rel=0" frameborder="0" allowfullscreen></iframe>`;
      }

      container.insertAdjacentHTML('beforeend', `
        <div class="bg-transparent break-inside-avoid mb-6 animate-fade-in group">
          ${contentHtml}
          <div class="px-1 py-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-[9px] text-white font-bold shadow-md">
                  ${reel.profiles?.username?.[0] || '?'}
                </div>
                <span class="text-xs font-bold text-gray-300">${reel.profiles?.username || 'Anonyme'}</span>
              </div>
              <button onclick="toggleReelAmen('${reel.id}')" class="text-gray-500 hover:text-pink-500 transition-colors flex items-center gap-1.5 text-xs group-hover:opacity-100 opacity-70">
                <i data-lucide="heart" class="w-4 h-4 transition-transform active:scale-125"></i>
              </button>
            </div>
            ${reel.caption ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2 pl-7">${reel.caption}</p>` : ''}
          </div>
        </div>
      `);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    container.innerHTML = '<div class="col-span-full text-center text-gray-600 mt-10">Aucun verset pour le moment.</div>';
  }
}

async function publishVerseCard() {
  const canvasEl = document.getElementById('verse-canvas');
  const btn = document.getElementById('btn-publish-verse');

  const originalText = btn.innerHTML;
  btn.innerHTML = 'Publication...';
  btn.disabled = true;

  canvasEl.toBlob(async (blob) => {
    try {
      const fileName = `verses/${currentUser.id}_${Date.now()}.png`;
      const { error: uploadError } = await supabaseClient.storage.from('post-images').upload(fileName, blob);
      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);

      const { error: dbError } = await supabaseClient.from('reels').insert([{
        user_id: currentUser.id,
        video_url: data.publicUrl,
        caption: document.getElementById('verse-text-input').value || "Verset du jour"
      }]);

      if (dbError) throw dbError;

      alert("Carte verset publiée avec succès !");
      closeVerseEditor();
      switchView('reels');

    } catch (error) {
      console.error(error);
      alert("Erreur lors de la publication : " + error.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}
