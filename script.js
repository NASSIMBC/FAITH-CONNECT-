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
            id: currentUser.id, email: currentUser.email, username: namePart, bio: "Nouveau membre", status_text: "Nouveau ici !", status_emoji: "👋"
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
    // 1. Cacher toutes les vues et reset les styles
    ['home', 'reels', 'bible', 'messages', 'profile', 'public-profile'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) {
            el.classList.add('hidden');
            el.classList.remove('animate-view'); // Reset l'animation
        }
        const btn = document.getElementById('nav-' + v);
        if(btn) { 
            btn.classList.remove('text-purple-400', 'scale-110'); // Reset l'effet de zoom
            btn.classList.add('text-gray-500'); 
        }
    });

    // 2. Afficher la nouvelle vue avec Animation
    const target = document.getElementById('view-' + viewName);
    if(target) {
        target.classList.remove('hidden');
        void target.offsetWidth; // Force le navigateur à relancer l'animation
        target.classList.add('animate-view');
    }
    
    // 3. Activer le bouton du menu
    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) { 
        activeBtn.classList.remove('text-gray-500'); 
        activeBtn.classList.add('text-purple-400', 'scale-110', 'transition-transform', 'duration-200'); 
    }

    // Logiques spécifiques inchangées
    const reelsContainer = document.getElementById('reels-container');
    if (viewName === 'reels') {
        fetchReels(); 
    } else {
        if(reelsContainer) reelsContainer.innerHTML = '';
    }

    if (viewName === 'bible') {
        showTestament('NT'); 
    }

    if (viewName === 'messages') {
        const badge = document.getElementById('msg-badge');
        if(badge) badge.classList.add('hidden');
        if(!activeChatUser) resetChat();
    }
    if (viewName === 'profile') switchProfileTab('friends'); 
    if(viewName !== 'messages' && viewName !== 'public-profile') activeChatUser = null;
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
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. BIBLE (VERSION FINALE : GETBIBLE.NET)
// ==========================================

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

let currentBookId = 43; 
let currentBookName = "Jean";
let currentChapter = 1;

function showTestament(type) {
    const atBtn = document.getElementById('btn-at');
    const ntBtn = document.getElementById('btn-nt');
    if(!atBtn || !ntBtn) return;

    if(type === 'AT') {
        atBtn.className = "flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg";
        ntBtn.className = "flex-1 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors";
    } else {
        ntBtn.className = "flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg";
        atBtn.className = "flex-1 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors";
    }

    const container = document.getElementById('bible-books-list');
    if(container) {
        container.innerHTML = bibleStructure[type].map(book => `
            <button onclick="loadBibleChapter(${book.id}, '${book.name}', 1)" class="p-3 bg-gray-800 border border-white/5 rounded-xl hover:bg-gray-700 transition-all text-left group active:scale-95">
                <span class="font-bold text-white group-hover:text-purple-400 text-sm transition-colors">${book.name}</span>
            </button>
        `).join('');
    }
}

async function loadBibleChapter(id, name, chapter) {
    const reader = document.getElementById('bible-reader');
    const content = document.getElementById('reader-content');
    const title = document.getElementById('reader-title');
    
    if(!reader) return;
    reader.classList.remove('hidden');
    
    currentBookId = id;
    currentBookName = name;
    currentChapter = chapter;

    title.innerText = `${name} ${chapter}`;
    
    content.innerHTML = `
        <div class="flex flex-col h-full items-center justify-center space-y-4">
            <div class="w-8 h-8 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
            <p class="text-xs text-gray-500 animate-pulse">Chargement...</p>
        </div>`;

    try {
        const response = await fetch(`https://api.getbible.net/v2/ls1910/${id}/${chapter}.json`);
        
        if (!response.ok) throw new Error("Chapitre introuvable");

        const data = await response.json();

        if (data.verses && data.verses.length > 0) {
            let formattedText = data.verses.map(v => 
                `<p class="mb-3 leading-relaxed text-gray-200 text-justify">
                    <sup class="text-purple-400 text-[10px] font-bold mr-2 select-none">${v.verse}</sup>${v.text}
                </p>`
            ).join('');

            const prevBtn = chapter > 1 
                ? `<button onclick="loadBibleChapter(${id}, '${name}', ${chapter - 1})" class="flex-1 bg-gray-800 py-3 rounded-xl text-xs font-bold text-gray-300 hover:bg-gray-700 transition-colors">← Précédent</button>` 
                : `<div class="flex-1"></div>`;
            
            const nextBtn = `<button onclick="loadBibleChapter(${id}, '${name}', ${chapter + 1})" class="flex-1 bg-purple-600 py-3 rounded-xl text-xs font-bold text-white shadow-lg hover:bg-purple-500 transition-colors">Suivant →</button>`;

            content.innerHTML = `
                <div class="font-serif text-sm px-2 pt-2 pb-20 animate-fade-in">
                    ${formattedText}
                    <div class="flex justify-between gap-4 mt-8 border-t border-white/10 pt-6">
                        ${prevBtn}
                        ${nextBtn}
                    </div>
                </div>
            `;
            content.scrollTop = 0;

        } else {
            content.innerHTML = `
                <div class="text-center text-gray-400 mt-20">
                    <p class="mb-4">Fin du livre de ${name}.</p>
                    <button onclick="closeBibleReader()" class="bg-gray-800 px-6 py-2 rounded-full text-xs text-white border border-white/10 hover:bg-gray-700">Fermer la lecture</button>
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
}

// ==========================================
// 5. FAITH AI (HYBRIDE & ROBUSTE)
// ==========================================

async function askFaithAI() {
    const input = document.getElementById('ai-bible-input');
    const area = document.getElementById('ai-response-area');
    const question = input.value.trim();
    const API_KEY = 'AIzaSyBjbQeVvpGOoSsGsGL8JHWzExczCwHbSnk'; 

    if(!question) return;
    
    area.classList.remove('hidden');
    area.innerHTML = `<div class="flex items-center gap-2 text-purple-300 text-xs animate-pulse">Faith AI réfléchit...</div>`;
    input.value = '';

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Tu es Faith AI, assistant chrétien. Réponds courtement avec un verset biblique (Louis Segond). Question: "${question}"`
                    }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error("Erreur Google");

        const aiReply = data.candidates[0].content.parts[0].text.replace(/\*/g, "");
        area.innerHTML = `<div class="bg-gray-800/50 border-l-4 border-purple-500 pl-3 py-2 rounded-r-lg shadow-lg"><p class="text-[10px] text-gray-500 mb-1">QUESTION : "${question}"</p><p class="text-white text-sm font-serif leading-relaxed text-justify">${aiReply}</p></div>`;

    } catch (error) {
        console.warn("Passage mode secours");
        const fallback = getFallbackResponse(question);
        area.innerHTML = `<div class="bg-gray-800/50 border-l-4 border-blue-500 pl-3 py-2 rounded-r-lg shadow-lg"><p class="text-[10px] text-gray-500 mb-1">QUESTION : "${question}"</p><p class="text-white text-sm font-serif leading-relaxed italic">"${fallback}"</p></div>`;
    }
}

function getFallbackResponse(text) {
    const t = text.toLowerCase();
    if (t.includes("peur") || t.includes("crainte")) return "Ne crains rien, car je suis avec toi. (Ésaïe 41:10)";
    if (t.includes("triste")) return "L'Éternel est près de ceux qui ont le cœur brisé. (Psaumes 34:18)";
    if (t.includes("amour")) return "L'amour est patient, il est plein de bonté. (1 Corinthiens 13)";
    return "Confie-toi en l'Éternel de tout ton cœur. (Proverbes 3:5)";
}
// ==========================================
// 5. PROFIL
// ==========================================

async function updateMyStatus() {
    const text = prompt("Ton humeur actuelle ?");
    if (text === null) return; 
    const emoji = prompt("Un emoji ?", "💻");
    const { error } = await supabaseClient.from('profiles').update({ status_text: text, status_emoji: emoji || "👋", status_updated_at: new Date().toISOString() }).eq('id', currentUser.id);
    if (error) alert("Erreur : " + error.message);
    else { userProfile.status_text = text; userProfile.status_emoji = emoji || "👋"; updateUIProfile(); }
}

function updateUIProfile() {
    const initials = userProfile.username ? userProfile.username.substring(0, 2).toUpperCase() : "??";
    document.querySelectorAll('#user-display, #profile-name').forEach(el => el.innerText = userProfile.username);
    if(document.getElementById('profile-email')) document.getElementById('profile-email').innerText = "@" + userProfile.username;
    const textDisplay = document.getElementById('status-text-display');
    const emojiDisplay = document.getElementById('status-emoji-display');
    if (textDisplay && emojiDisplay) {
        textDisplay.innerText = userProfile.status_text || "Ajouter un statut...";
        emojiDisplay.innerText = userProfile.status_emoji || "👋";
    }
    const avatarElements = ['current-user-avatar-small', 'profile-avatar-big'];
    avatarElements.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if (userProfile.avatar_url) {
            el.innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover rounded-full">`;
            el.innerText = ""; 
        } else {
            el.innerHTML = ""; el.innerText = initials;
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
        reader.onload = function(e) { document.getElementById('edit-avatar-preview').src = e.target.result; }
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
        const { error } = await supabaseClient.from('profiles').update({ username: newUsername, bio: newBio, avatar_url: finalAvatarUrl }).eq('id', currentUser.id);
        if (error) throw error;
        userProfile.username = newUsername; userProfile.bio = newBio; userProfile.avatar_url = finalAvatarUrl;
        updateUIProfile(); closeEditModal(); alert("Profil mis à jour !");
    } catch (error) { alert("Erreur : " + error.message); } finally { btn.innerText = "Enregistrer"; btn.disabled = false; }
}

// ==========================================
// 5. GESTION DES AMIS
// ==========================================

async function getFriendIds() {
    const { data } = await supabaseClient.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    const friendIds = new Set([currentUser.id]); 
    if (data) data.forEach(f => { friendIds.add(f.requester_id === currentUser.id ? f.receiver_id : f.requester_id); });
    return Array.from(friendIds);
}

async function switchProfileTab(tabName) {
    const btnFriends = document.getElementById('tab-friends');
    const btnRequests = document.getElementById('tab-requests');
    const container = document.getElementById('profile-social-list');
    if(!btnFriends || !btnRequests || !container) return;
    if(tabName === 'friends') {
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
    if(otherFriendIds.length === 0) { container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Pas encore d\'amis.</div>'; return; }
    const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', otherFriendIds);
    container.innerHTML = '';
    if(profiles) profiles.forEach(p => {
        const avatarHtml = p.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">${p.username.substring(0,2).toUpperCase()}</div>`;
        container.insertAdjacentHTML('beforeend', `<div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-2xl border border-white/5 mb-2"><div class="flex items-center gap-3">${avatarHtml}<div class="text-left"><p class="text-sm font-bold text-white">${p.username}</p><p class="text-[10px] text-gray-500 truncate w-24">${p.status_text || 'En ligne'}</p></div></div><div class="flex gap-2"><button onclick="openDirectChat('${p.id}', '${p.username}')" class="p-2 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600"><i data-lucide="message-circle" class="w-4 h-4"></i></button><button onclick="removeFriend('${p.id}')" class="p-2 bg-red-600/10 text-red-400 rounded-xl hover:bg-red-600"><i data-lucide="user-minus" class="w-4 h-4"></i></button></div></div>`);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    const countEl = document.getElementById('stats-friends-count');
    if(countEl) countEl.innerText = otherFriendIds.length;
}

async function fetchMyRequestsList(container) {
    container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 italic">Chargement...</div>';
    const { data: requests } = await supabaseClient.from('friendships').select('*').eq('receiver_id', currentUser.id).eq('status', 'pending');
    if(!requests || requests.length === 0) { container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Aucune demande.</div>'; document.getElementById('profile-req-badge').classList.add('hidden'); return; }
    document.getElementById('profile-req-badge').innerText = requests.length;
    document.getElementById('profile-req-badge').classList.remove('hidden');
    const requesterIds = requests.map(r => r.requester_id);
    const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', requesterIds);
    container.innerHTML = '';
    if(profiles) requests.forEach(req => {
        const p = profiles.find(prof => prof.id === req.requester_id);
        if(!p) return;
        const avatarHtml = p.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs">${p.username.substring(0,2).toUpperCase()}</div>`;
        container.insertAdjacentHTML('beforeend', `<div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-white/5 mb-2"><div class="flex items-center gap-3">${avatarHtml}<p class="text-sm font-bold text-white">${p.username}</p></div><div class="flex gap-2"><button onclick="handleFriendRequest('${req.id}', true)" class="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg">Accepter</button><button onclick="handleFriendRequest('${req.id}', false)" class="px-4 py-1.5 bg-red-600/20 text-red-400 text-xs font-bold rounded-lg">Refuser</button></div></div>`);
    });
}

async function removeFriend(friendId) {
    if(!confirm("Retirer cet ami ?")) return;
    await supabaseClient.from('friendships').delete().or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);
    switchProfileTab('friends'); updateFriendCount(currentUser.id);
}

// ==========================================
// 6. CHAT & MESSAGERIE
// ==========================================

function openDirectChat(userId, username) {
    startChat({ id: userId, username: username });
    if(window.innerWidth < 768) {
        document.getElementById('conversations-sidebar').classList.add('hidden');
        document.getElementById('chat-detail').classList.remove('hidden');
        document.getElementById('chat-detail').classList.add('flex');
    }
}

async function loadConversations() {
    const container = document.getElementById('messages-list');
    if(!container) return;
    const { data: messages } = await supabaseClient.from('messages').select('*').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).not('receiver_id', 'is', null).order('created_at', { ascending: false });
    if (!messages || messages.length === 0) { container.innerHTML = '<div class="text-gray-500 text-center mt-4 text-xs italic">Aucune discussion.</div>'; return; }
    
    // Grouper par utilisateur
    const uniqueConversations = {};
    for (const msg of messages) {
        const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!otherUserId || uniqueConversations[otherUserId]) continue;
        uniqueConversations[otherUserId] = { userId: otherUserId, lastMessage: msg.content, time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
    }
    const conversationArray = Object.values(uniqueConversations);
    
    if(conversationArray.length > 0) {
        const ids = conversationArray.map(c => c.userId);
        const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url').in('id', ids);
        container.innerHTML = conversationArray.map(conv => {
            const p = profiles.find(x => x.id === conv.userId);
            const name = p ? p.username : "Ami";
            const avatarDisplay = p && p.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${name.substring(0,2).toUpperCase()}</div>`;
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
    activeChatUser = targetProfile; switchView('messages');
    
    document.getElementById('chat-with-name').innerHTML = `${targetProfile.username}`;
    const headerAvatar = document.getElementById('chat-header-avatar');
    const headerInitials = document.getElementById('chat-header-initials');
    
    supabaseClient.from('profiles').select('*').eq('id', targetProfile.id).single().then(({data}) => {
         if(data && data.avatar_url) {
             headerAvatar.src = data.avatar_url;
             headerAvatar.classList.remove('hidden');
             headerInitials.classList.add('hidden');
         } else {
             headerAvatar.classList.add('hidden');
             headerInitials.classList.remove('hidden');
             headerInitials.innerText = targetProfile.username.substring(0,2).toUpperCase();
         }
    });

    const input = document.getElementById('chat-input');
    if(input) { input.disabled = false; input.focus(); }
    fetchMessages(); 
}

function resetChat() {
    activeChatUser = null;
    document.getElementById('chat-with-name').innerText = "Sélectionnez un ami";
    const container = document.getElementById('chat-history');
    if(container) container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-600 italic text-sm"><p>Cliquez sur une discussion</p></div>`;
    const input = document.getElementById('chat-input');
    if(input) { input.value = ""; input.disabled = true; input.placeholder = "Sélectionnez un ami d'abord"; }
}

async function fetchMessages() {
    const container = document.getElementById('chat-history');
    if(!container || !activeChatUser) return;

    // Récupération des messages
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    container.innerHTML = '';
    
    if(data && data.length > 0) {
        let lastSenderId = null;
        
        data.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const isSameSender = lastSenderId === msg.sender_id;
            const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // DESIGN BULLE :
            // rounded-tr-sm = coin haut droit pointu pour moi
            // rounded-tl-sm = coin haut gauche pointu pour l'autre
            const bubbleClass = isMe 
                ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm' 
                : 'bg-gray-800 text-gray-200 rounded-2xl rounded-tl-sm border border-white/5';
            
            const marginClass = isSameSender ? 'mt-1' : 'mt-4';

            // CORRECTION TAILLE : "max-w-[85%] md:max-w-md" empêche la bulle de devenir géante sur PC
            container.insertAdjacentHTML('beforeend', `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} ${marginClass} group animate-fade-in">
                    <div class="max-w-[85%] md:max-w-md"> 
                        <div class="${bubbleClass} px-4 py-2 text-sm shadow-md relative break-words">
                            ${msg.content}
                            <div class="text-[9px] opacity-60 text-right mt-1 gap-1 flex justify-end items-center">
                                ${time}
                                ${isMe ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `);
            lastSenderId = msg.sender_id;
        });
        
        // Scroll automatique en bas
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
        
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else { 
        // Message vide sympa
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50 space-y-2">
                <div class="p-4 bg-gray-800 rounded-full">
                    <i data-lucide="hand" class="w-8 h-8"></i>
                </div>
                <p class="text-sm">Dites bonjour à ${activeChatUser.username} !</p>
            </div>`; 
            if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!activeChatUser || !input || !input.value.trim()) return;
    const { error } = await supabaseClient.from('messages').insert([{ content: input.value, sender_id: currentUser.id, sender_email: currentUser.email, sender_name: userProfile.username, receiver_id: activeChatUser.id }]);
    if(!error) { input.value = ''; fetchMessages(); loadConversations(); }
}

// ==========================================
// 8. GESTION DES POSTS (DESIGN PREMIUM)
// ==========================================

function handleImageSelect(input) {
    if (input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('image-preview').src = e.target.result; document.getElementById('image-preview-container').classList.remove('hidden'); }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeImage() { selectedImageFile = null; document.getElementById('post-image-file').value = ""; document.getElementById('image-preview-container').classList.add('hidden'); }

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
        await supabaseClient.from('posts').insert([{ user_id: currentUser.id, content: input.value, user_name: userProfile.username, image_url: imageUrl, avatar_initials: userProfile.username.substring(0,2).toUpperCase() }]);
        input.value = ''; removeImage(); fetchPosts();
    } catch (error) { alert("Erreur : " + error.message); } finally { btn.innerHTML = 'Publier'; btn.disabled = false; }
}

async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if(!container) return;
    try {
        const friendIds = await getFriendIds();
        const { data: posts, error: postError } = await supabaseClient.from('posts').select('*, profiles:user_id(avatar_url)').in('user_id', friendIds).order('created_at', { ascending: false });
        if (postError) throw postError;
        const { data: allLikes } = await supabaseClient.from('likes').select('post_id, user_id');
        
        container.innerHTML = ''; 
        if (!posts || posts.length === 0) {
            container.innerHTML = `<div class="text-center py-10 px-4 animate-view"><p class="text-gray-500 italic">Aucune publication... 🍃</p></div>`;
            return;
        }
        posts.forEach(post => {
            const isMyPost = post.user_id === currentUser.id;
            const date = new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const userAvatarUrl = post.profiles && post.profiles.avatar_url;
            const avatarHtml = userAvatarUrl ? `<img src="${userAvatarUrl}" class="w-9 h-9 rounded-full object-cover border-2 border-purple-500/20 shadow-lg">` : `<div class="w-9 h-9 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-lg">${post.avatar_initials || "??"}</div>`;
            const postLikes = allLikes ? allLikes.filter(l => l.post_id === post.id) : [];
            const isAmened = postLikes.some(l => l.user_id === currentUser.id);
            const amenColor = isAmened ? 'text-pink-500 font-bold' : 'text-gray-400 hover:text-pink-400';
            const amenIconClass = isAmened ? 'fill-pink-500 text-pink-500' : 'text-gray-400';

            // DESIGN PREMIUM (NEON & GLOW)
            container.insertAdjacentHTML('beforeend', `
                <div class="premium-card rounded-2xl p-4 mb-5 animate-view" id="post-${post.id}">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-3">${avatarHtml}<div><h3 class="font-bold text-white text-sm tracking-wide">${post.user_name}</h3><p class="text-[10px] text-gray-500">${date}</p></div></div>
                        ${isMyPost ? `<button onclick="deletePost('${post.id}')" class="text-gray-600 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                    </div>
                    <p class="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-light">${post.content}</p>
                    ${post.image_url ? `<div class="mt-3 rounded-xl overflow-hidden border border-white/5 shadow-2xl"><img src="${post.image_url}" class="w-full max-h-96 object-cover"></div>` : ''}
                    <div class="border-t border-white/5 mt-4 pt-3 flex justify-between text-gray-400">
                        <div class="flex gap-5">
                            <button onclick="toggleAmen('${post.id}')" class="${amenColor} flex items-center gap-1.5 text-xs transition-colors"><i data-lucide="heart" class="w-4 h-4 ${amenIconClass}"></i> ${postLikes.length > 0 ? postLikes.length : ''} Amen</button>
                            <button onclick="toggleComments('${post.id}')" class="hover:text-purple-400 flex items-center gap-1.5 text-xs transition-colors"><i data-lucide="message-square" class="w-4 h-4"></i> Commenter</button>
                        </div>
                    </div>
                    <div id="comments-section-${post.id}" class="hidden mt-3 pt-3 bg-black/40 rounded-lg p-3 border border-white/5">
                        <div id="comments-list-${post.id}" class="space-y-2 mb-3 max-h-40 overflow-y-auto scrollbar-hide"></div>
                        <div class="flex gap-2">
                            <input type="text" id="input-comment-${post.id}" placeholder="Votre commentaire..." class="flex-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 transition-colors">
                            <button onclick="sendComment('${post.id}')" class="text-purple-400 font-bold text-xs hover:text-purple-300">Envoyer</button>
                        </div>
                    </div>
                </div>`);
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) { console.error("Erreur fetchPosts:", err); }
}

async function deletePost(id) {
    if(!confirm("Supprimer ce post ?")) return;
    try {
        const { data: post } = await supabaseClient.from('posts').select('image_url').eq('id', id).single();
        if (post && post.image_url) {
            const fileName = post.image_url.split('/').pop();
            await supabaseClient.storage.from('post-images').remove([`${currentUser.id}/${fileName}`]);
        }
        const { error } = await supabaseClient.from('posts').delete().eq('id', id).eq('user_id', currentUser.id);
        if(!error) { 
            document.getElementById(`post-${id}`).remove(); 
        } else { throw error; }
    } catch (e) {
        alert("Erreur suppression : " + e.message);
    }
}

async function toggleAmen(postId) {
    const { data } = await supabaseClient.from('likes').select('*').match({ post_id: postId, user_id: currentUser.id });
    if (data && data.length > 0) { await supabaseClient.from('likes').delete().match({ post_id: postId, user_id: currentUser.id }); } 
    else { await supabaseClient.from('likes').insert({ post_id: postId, user_id: currentUser.id }); }
    fetchPosts();
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    const list = document.getElementById(`comments-list-${postId}`);
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
        const { data: comments } = await supabaseClient.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
        list.innerHTML = (comments && comments.length > 0) ? comments.map(c => `<div class="text-[11px] text-gray-300"><span class="font-bold text-purple-400">${c.user_name}:</span> ${c.content}</div>`).join('') : '<div class="text-[10px] text-gray-500 italic">Soyez le premier à commenter !</div>';
    }
}

async function sendComment(postId) {
    const input = document.getElementById(`input-comment-${postId}`);
    const content = input.value.trim(); if(!content) return;
    const { error } = await supabaseClient.from('comments').insert([{ post_id: postId, user_id: currentUser.id, user_name: userProfile.username, content: content }]);
    if(!error) { input.value = ''; const section = document.getElementById(`comments-section-${postId}`); section.classList.add('hidden'); toggleComments(postId); } 
    else { alert("Erreur : " + error.message); }
}

// ==========================================
// 9. ENTRAIDE & ÉVÉNEMENTS & NOTIFS
// ==========================================

async function fetchHelpRequests() {
    const container = document.getElementById('help-list');
    if(!container) return;
    const { data: requests } = await supabaseClient.from('help_requests').select('*').order('created_at', { ascending: false }).limit(3);
    if(requests && requests.length > 0) {
        container.innerHTML = requests.map(req => `
            <div class="bg-gray-900/50 p-3 rounded-xl border border-white/5 flex gap-3 items-center">
                <div class="bg-blue-900/30 p-2.5 rounded-full h-fit flex-shrink-0"><i data-lucide="hand-heart" class="w-4 h-4 text-blue-400"></i></div>
                <div class="flex-1">
                    <h4 class="text-xs font-bold text-white">${req.title}</h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">${req.description} - <span class="text-blue-300">@${req.user_name}</span></p>
                </div>
                ${req.user_id !== currentUser.id ? `<button onclick="openDirectChat('${req.user_id}', '${req.user_name}')" class="p-2 bg-blue-600/20 rounded-lg text-blue-400 hover:bg-blue-600/30"><i data-lucide="message-circle" class="w-4 h-4"></i></button>` : ''}
            </div>
        `).join('');
    } else { container.innerHTML = '<div class="text-center text-[10px] text-gray-500 py-2">Aucune demande.</div>'; }
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function askForHelp() {
    const title = prompt("Titre de votre demande (ex: Déménagement)");
    if(!title) return;
    const desc = prompt("Description courte");
    await supabaseClient.from('help_requests').insert([{ user_id: currentUser.id, user_name: userProfile.username, title: title, description: desc || "" }]);
    fetchHelpRequests();
}

async function fetchEvents() {
    const events = [
        { id: 1, title: "Soirée Louange", date: "12 FÉV", location: "Église Centrale", icon: "music", color: "purple" },
        { id: 2, title: "Maraude", date: "15 FÉV", location: "Gare du Nord", icon: "heart", color: "pink" },
        { id: 3, title: "Étude Biblique", date: "20 FÉV", location: "En ligne", icon: "video", color: "blue" }
    ];
    const container = document.getElementById('events-list');
    if(!container) return;
    
    container.innerHTML = events.map(evt => `
        <div class="min-w-[150px] bg-gray-800 rounded-2xl p-3 border border-white/5 relative overflow-hidden group shrink-0">
            <div class="absolute top-0 right-0 p-2 bg-${evt.color}-600 rounded-bl-xl text-[10px] font-bold text-white shadow-lg">${evt.date}</div>
            <div class="mt-7">
                <h4 class="font-bold text-white text-sm leading-tight">${evt.title}</h4>
                <p class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><i data-lucide="${evt.icon}" class="w-3 h-3"></i> ${evt.location}</p>
                <button onclick="alert('Inscrit !')" class="mt-3 w-full py-1.5 bg-white/5 hover:bg-${evt.color}-600/20 rounded-lg text-[10px] text-${evt.color}-300 font-bold transition-colors border border-white/5">Participer</button>
            </div>
        </div>
    `).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchPrayers() {
    const container = document.getElementById('prayers-list'); if(!container) return;
    const { data: prayers } = await supabaseClient.from('prayers').select('*').order('created_at', { ascending: false });
    container.innerHTML = (prayers && prayers.length > 0) ? prayers.map(p => `<div class="bg-gray-900/60 p-3 rounded-xl border border-pink-500/10 flex justify-between items-center mb-2"><div class="flex-1"><p class="text-[10px] font-bold text-pink-400 mb-0.5">${p.user_name}</p><p class="text-xs italic">"${p.content}"</p></div><button onclick="prayFor('${p.id}', ${p.count})" class="ml-3 flex flex-col items-center"><div class="bg-gray-800 p-2 rounded-full border border-gray-600 hover:border-pink-500 transition-all text-sm">🙏</div><span class="text-[9px] font-bold mt-1">${p.count}</span></button></div>`).join('') : '<div class="text-center text-[10px] text-gray-500 py-4 italic">Soyez le premier ! 🙏</div>';
}

async function addPrayer() {
    const input = document.getElementById('prayer-input'); if (!input || !input.value.trim()) return;
    await supabaseClient.from('prayers').insert([{ user_id: currentUser.id, user_name: userProfile.username, content: input.value, count: 0 }]);
    input.value = ''; fetchPrayers();
}

async function prayFor(id, current) { await supabaseClient.from('prayers').update({ count: (current || 0) + 1 }).eq('id', id); fetchPrayers(); }

function subscribeToRealtime() {
    supabaseClient.channel('global-updates').on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
        if (payload.table === 'messages') { fetchMessages(); loadConversations(); }
        if (payload.table === 'posts') fetchPosts();
        if (payload.table === 'friendships') { fetchNotifications(); updateFriendCount(currentUser.id); }
        if (payload.table === 'likes' && payload.eventType === 'INSERT') {
            const { data: post } = await supabaseClient.from('posts').select('user_id').eq('id', payload.new.post_id).single();
            if (post && post.user_id === currentUser.id && payload.new.user_id !== currentUser.id) {
                showNotification("Bénédiction", "Quelqu'un a dit Amen à votre publication ! ✨");
            }
            fetchPosts(); 
        }
    }).subscribe();
}

async function updateFriendCount(userId) {
    const { count: c1 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'accepted');
    const { count: c2 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'accepted');
    const el = document.getElementById('stats-friends-count'); if(el) el.innerText = (c1 || 0) + (c2 || 0);
}

function showNotification(senderName, message) {
    const container = document.getElementById('notification-container');
    const audio = document.getElementById('notif-sound');
    if(audio) audio.play().catch(() => {});
    const notif = document.createElement('div');
    notif.className = "bg-gray-800 border-l-4 border-purple-500 text-white p-3 rounded-xl shadow-2xl mb-2 animate-fade-in";
    notif.innerHTML = `<h4 class="font-bold text-xs text-purple-400">${senderName}</h4><p class="text-xs text-gray-300 truncate">${message}</p>`;
    container.appendChild(notif); 
    setTimeout(() => notif.remove(), 4000);
}

async function fetchNotifications() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    const { data: requests } = await supabaseClient.from('friendships').select('*').eq('receiver_id', currentUser.id).eq('status', 'pending');
    if (requests && requests.length > 0) {
        badge.classList.remove('hidden');
        const ids = requests.map(r => r.requester_id);
        const { data: profiles } = await supabaseClient.from('profiles').select('id, username').in('id', ids);
        if(list) list.innerHTML = requests.map(req => {
            const p = profiles.find(x => x.id === req.requester_id);
            return `<div class="p-3 border-b border-white/5 flex items-center justify-between"><span class="text-xs font-bold text-white">${p ? p.username : 'Ami'}</span><div class="flex gap-2"><button onclick="handleFriendRequest('${req.id}', true)" class="text-green-400"><i data-lucide="check" class="w-4 h-4"></i></button></div></div>`;
        }).join('');
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else { badge.classList.add('hidden'); if(list) list.innerHTML = '<div class="p-4 text-center text-xs text-gray-500">🍃</div>'; }
}

async function handleFriendRequest(id, accepted) {
    if (accepted) await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabaseClient.from('friendships').delete().eq('id', id);
    fetchNotifications(); updateFriendCount(currentUser.id); switchProfileTab('requests');
}

async function addFriend(targetId) {
    const { error } = await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: targetId, status: 'pending' }]);
    if (!error) alert("Demande envoyée !");
}

function toggleNotifDropdown() { document.getElementById('notif-dropdown').classList.toggle('hidden'); }

// ==========================================
// 12. GESTION DES STORIES
// ==========================================

function triggerAddStory() { document.getElementById('btn-add-story-input').click(); }

async function uploadStory(input) {
    if (!input.files || !input.files[0]) return;
    try {
        const file = input.files[0]; const fileName = `${currentUser.id}/${Date.now()}`;
        const { error: uploadError } = await supabaseClient.storage.from('story-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabaseClient.storage.from('story-images').getPublicUrl(fileName);
        await supabaseClient.from('stories').insert([{ user_id: currentUser.id, image_url: data.publicUrl }]);
        renderStoriesList();
    } catch (error) { alert("Erreur : " + error.message); }
}

async function renderStoriesList() {
    const container = document.getElementById('stories-container'); if (!container) return;
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours() - 24);
    const { data: stories } = await supabaseClient.from('stories').select('*, profiles(username, avatar_url)').gt('created_at', yesterday.toISOString()).order('created_at', { ascending: false });
    let html = `<div onclick="triggerAddStory()" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-14 h-14 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center relative"><i data-lucide="plus" class="w-5 h-5 text-gray-400"></i></div><span class="text-[9px] text-gray-300">Ma Story</span></div>`;
    if (stories) stories.forEach(s => {
        if (!s.profiles) return;
        const storyData = encodeURIComponent(JSON.stringify(s));
        const avatarContent = s.profiles.avatar_url ? `<img src="${s.profiles.avatar_url}" class="w-full h-full object-cover rounded-full">` : `<div class="w-full h-full rounded-full bg-gray-700 flex items-center justify-center font-bold text-white text-[10px]">${s.profiles.username[0].toUpperCase()}</div>`;
        html += `<div onclick="openStoryViewer('${storyData}')" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-[2px]"><div class="w-full h-full rounded-full bg-gray-900 border-2 border-gray-900 overflow-hidden">${avatarContent}</div></div><span class="text-[9px] text-gray-300 truncate w-14 text-center">${s.profiles.username}</span></div>`;
    });
    container.innerHTML = html; if (typeof lucide !== 'undefined') lucide.createIcons();
}

let currentStoryTimer = null;
function openStoryViewer(storyDataEncoded) {
    const story = JSON.parse(decodeURIComponent(storyDataEncoded));
    const viewer = document.getElementById('story-viewer');
    document.getElementById('story-viewer-image').src = story.image_url;
    document.getElementById('story-viewer-name').innerText = story.profiles.username;
    const avatarEl = document.getElementById('story-viewer-avatar');
    if (story.profiles.avatar_url) avatarEl.src = story.profiles.avatar_url; else avatarEl.src = "https://ui-avatars.com/api/?name=" + story.profiles.username;
    document.getElementById('story-delete-btn-container').innerHTML = (story.user_id === currentUser.id) ? `<button onclick="deleteStory('${story.id}')" class="bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-xs font-bold border border-red-500/50">Supprimer</button>` : "";
    viewer.classList.remove('hidden');
    const progress = document.getElementById('story-progress');
    progress.style.transition = 'none'; progress.style.width = '0%';
    setTimeout(() => { progress.style.transition = 'width 5s linear'; progress.style.width = '100%'; }, 10);
    if (currentStoryTimer) clearTimeout(currentStoryTimer);
    currentStoryTimer = setTimeout(() => closeStoryViewer(), 5000);
}

function closeStoryViewer() { document.getElementById('story-viewer').classList.add('hidden'); if (currentStoryTimer) clearTimeout(currentStoryTimer); }
async function deleteStory(id) { if (confirm("Supprimer ?")) { await supabaseClient.from('stories').delete().eq('id', id); closeStoryViewer(); renderStoriesList(); } }

// ==========================================
// 13. NOUVEAU : CRÉATEUR DE VERSETS (CANVAS)
// ==========================================

// Variables globales pour l'éditeur
let canvas, ctx;
let currentBgType = 'color';
let currentBgValue = '#1f2937'; // Couleur par défaut (gris foncé)
let uploadedBgImage = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('verse-canvas');
    if(canvas) {
        ctx = canvas.getContext('2d');
        // On dessine une première fois au démarrage
        setTimeout(drawCanvas, 500); 
    }
});

// --- GESTION DU MODAL ---
function openVerseEditor() {
    document.getElementById('verse-editor-modal').classList.remove('hidden');
    drawCanvas(); // Redessiner à l'ouverture
}
function closeVerseEditor() {
    document.getElementById('verse-editor-modal').classList.add('hidden');
}

// --- GESTION DE L'IMAGE DE FOND ---
function setBackground(type, value) {
    currentBgType = type;
    currentBgValue = value;
    uploadedBgImage = null; // Reset si on choisit une couleur
    drawCanvas();
}

function handleBgUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedBgImage = new Image();
            uploadedBgImage.onload = function() {
                currentBgType = 'image';
                drawCanvas();
            };
            uploadedBgImage.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- FONCTION PRINCIPALE : DESSINER SUR LE CANVAS ---
function drawCanvas() {
    if(!canvas || !ctx) return;

    // 1. Nettoyer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Dessiner le fond
    if (currentBgType === 'color') {
        ctx.fillStyle = currentBgValue;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (currentBgType === 'image' && uploadedBgImage) {
        // Dessiner l'image en mode "cover" (remplit tout sans déformer)
        const ratio = Math.max(canvas.width / uploadedBgImage.width, canvas.height / uploadedBgImage.height);
        const centerShift_x = (canvas.width - uploadedBgImage.width * ratio) / 2;
        const centerShift_y = (canvas.height - uploadedBgImage.height * ratio) / 2;
        ctx.drawImage(uploadedBgImage, 0, 0, uploadedBgImage.width, uploadedBgImage.height,
                      centerShift_x, centerShift_y, uploadedBgImage.width * ratio, uploadedBgImage.height * ratio);
        
        // Ajouter un filtre sombre par dessus l'image pour lisibilité
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 3. Configurer le texte
    const text = document.getElementById('verse-text-input').value || "Votre verset ici...";
    const textColor = document.getElementById('text-color-picker').value;
    const fontSize = document.getElementById('font-size-picker').value;
    
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 4. Dessiner le texte (avec retour à la ligne automatique)
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    const maxWidth = canvas.width - 60; // Marges de 30px
    const lineHeight = fontSize * 1.2;

    wrapText(ctx, text, x, y, maxWidth, lineHeight);
    
    // 5. Petit filigrane de l'app en bas
    ctx.font = 'italic 20px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText("Faith Connect", canvas.width / 2, canvas.height - 30);
}

// Fonction utilitaire pour gérer les retours à la ligne sur Canvas
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];

    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Calculer la hauteur totale pour centrer verticalement
    let startY = y - ((lines.length - 1) * lineHeight) / 2;

    for(let k = 0; k < lines.length; k++) {
        context.fillText(lines[k], x, startY + (k * lineHeight));
    }
}

// --- PUBLICATION (Canvas -> Image -> Supabase) ---
async function publishVerseCard() {
    const btn = document.getElementById('btn-publish-verse');
    const originalText = btn.innerHTML;
    const caption = document.getElementById('verse-text-input').value.trim();

    if (!caption) return alert("Veuillez écrire un texte.");

    btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Création...';
    btn.disabled = true;

    try {
        // 1. Convertir le canvas en fichier image (Blob)
        canvas.toBlob(async (blob) => {
            if (!blob) throw new Error("Erreur de génération d'image");
            
            const fileName = `${currentUser.id}/${Date.now()}.png`;
            
            // 2. Upload vers SUPABASE Storage (Bucket 'verse-images')
            const { error: uploadError } = await supabaseClient.storage
                .from('verse-images')
                .upload(fileName, blob, { contentType: 'image/png' });

            if (uploadError) throw uploadError;

            // 3. Récupérer l'URL publique
            const { data: urlData } = supabaseClient.storage
                .from('verse-images')
                .getPublicUrl(fileName);

            // 4. Sauvegarder dans la table 'reels'
            // Note: on utilise la colonne video_url pour stocker l'image
            const { error: dbError } = await supabaseClient.from('reels').insert([{
                user_id: currentUser.id,
                video_url: urlData.publicUrl, // C'est une image maintenant
                caption: caption
            }]);

            if (dbError) throw dbError;

            // Succès !
            closeVerseEditor();
            document.getElementById('verse-text-input').value = "";
            setBackground('color', '#1f2937'); // Reset fond
            fetchReels(); // Recharger la liste
            alert("Votre carte verset est publiée ! ✨");

        }, 'image/png', 0.95); // Qualité JPEG 95%

    } catch (error) {
        console.error(error);
        alert("Erreur : " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- NOUVELLE FONCTION D'AFFICHAGE DES REELS (Mode Galerie d'Images) ---
async function fetchReels() {
    const container = document.getElementById('reels-container');
    if(!container) return;
    container.innerHTML = '<div class="col-span-full text-center pt-10 text-gray-500 animate-pulse">Chargement des inspirations...</div>';
    
    const { data: reels, error } = await supabaseClient
        .from('reels')
        .select('*, profiles:user_id(username, avatar_url)')
        .order('created_at', { ascending: false });

    container.innerHTML = '';
    
    if (reels && reels.length > 0) {
        reels.forEach(reel => {
            const avatar = reel.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + (reel.profiles?.username || '?');
            const username = reel.profiles?.username || 'Anonyme';
            // Note : reel.video_url contient maintenant l'URL de l'image générée
            
            const html = `
                <div class="bg-gray-800 rounded-2xl overflow-hidden border border-white/10 shadow-lg animate-view group">
                    <div class="relative aspect-square bg-gray-900">
                        <img src="${reel.video_url}" class="w-full h-full object-cover" loading="lazy">
                         <div class="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20"></div>
                    </div>
                    
                    <div class="p-4 bg-gray-800/90 relative">
                         <div class="absolute -top-6 left-4 flex items-center gap-2">
                             <img src="${avatar}" class="w-10 h-10 rounded-full border-2 border-gray-800 shadow-md">
                             <span class="text-sm font-bold text-white bg-gray-900/60 px-2 py-0.5 rounded-full backdrop-blur-md">${username}</span>
                        </div>

                        <div class="mt-4 pt-1">
                            <p class="text-sm text-gray-300 line-clamp-2 italic">"${reel.caption || ''}"</p>
                            
                            <div class="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                                <div class="flex gap-4">
                                    <button onclick="toggleReelAmen('${reel.id}')" class="flex items-center gap-1.5 text-gray-400 hover:text-pink-500 transition-colors text-xs">
                                        <i data-lucide="heart" class="w-5 h-5" id="reel-heart-${reel.id}"></i> Amen
                                    </button>
                                    <button onclick="openReelComments('${reel.id}')" class="flex items-center gap-1.5 text-gray-400 hover:text-purple-500 transition-colors text-xs">
                                        <i data-lucide="message-circle" class="w-5 h-5"></i> Coms
                                    </button>
                                </div>
                                <button onclick="shareImage('${reel.video_url}')" class="text-gray-400 hover:text-blue-400 transition-colors">
                                    <i data-lucide="share-2" class="w-5 h-5"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        container.innerHTML = '<div class="col-span-full text-center pt-20 text-gray-500 flex flex-col items-center gap-2"><i data-lucide="image-off" class="w-10 h-10 opacity-50"></i><p>Aucune carte verset pour le moment.<br>Soyez le premier !</p></div>';
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Petit bonus : fonction de partage native
async function shareImage(url) {
    if (navigator.share) {
        try {
            // On essaie de transformer l'URL en fichier pour un vrai partage d'image
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], "verset-faithconnect.png", { type: "image/png" });
            
            await navigator.share({
                files: [file],
                title: 'Verset Faith Connect',
                text: 'Regarde ce verset !'
            });
        } catch (err) {
            console.error("Erreur partage:", err);
            // Fallback : partage du lien
             navigator.clipboard.writeText(url).then(() => alert("Lien de l'image copié !"));
        }
    } else {
        navigator.clipboard.writeText(url).then(() => alert("Lien de l'image copié !"));
    }
}

// Note : Les fonctions toggleReelAmen et openReelComments existantes devraient toujours fonctionner sans modification.
