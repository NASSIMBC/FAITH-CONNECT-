// ==========================================
// 1. CONFIGURATION APPWRITE (Project & DB)
// (VERSION DU NOUVEAU CODE)
// ==========================================
const client = new Appwrite.Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('695fc25c0015900d7334');

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const storage = new Appwrite.Storage(client);

const DB_ID = '695fcf8000003dcafb64'; 
const COLL_PROFILES = 'profiles';
const COLL_POSTS = 'posts';
const COLL_REELS = 'reels';
const COLL_MESSAGES = 'messages';
const BUCKET_ID = 'faith-storage';

// ==========================================
// 2. AUTH & SESSION (NOUVEAU CODE)
// ==========================================
let currentUser = null;
let userProfile = null;
let activeChatUser = null;
let selectedImageFile = null;
let selectedAvatarFile = null;

document.addEventListener('DOMContentLoaded', checkSession);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement.id === 'chat-input') {
            e.preventDefault();
            sendChatMessage();
        }
        if (document.activeElement.id.startsWith('input-comment-')) {
            e.preventDefault();
            sendComment(document.activeElement.id.replace('input-comment-', ''));
        }
        if (document.activeElement.id === 'reel-comment-input') {
            e.preventDefault();
            sendReelComment();
        }
        if (document.activeElement.id === 'ai-bible-input') {
            e.preventDefault();
            askFaithAI();
        }
    }
});

async function checkSession() {
    try {
        currentUser = await account.get();
        await loadUserProfile();
        loginSuccess();
    } catch {
        document.getElementById('login-page').classList.remove('hidden');
    }
}

async function loadUserProfile() {
    try {
        userProfile = await databases.getDocument(DB_ID, COLL_PROFILES, currentUser.$id);
    } catch {
        const username = currentUser.email.split('@')[0];
        userProfile = await databases.createDocument(
            DB_ID,
            COLL_PROFILES,
            currentUser.$id,
            {
                username,
                bio: "Nouveau membre",
                status_text: "Nouveau ici !",
                status_emoji: "👋",
                avatar_url: ""
            }
        );
    }
    updateUIProfile();
}

function loginSuccess() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    loadAppData();
}

// ==========================================
// 3. NAVIGATION (NOUVEAU CODE)
// ==========================================
function switchView(viewName) {
    ['home','reels','bible','messages','profile','public-profile'].forEach(v => {
        document.getElementById('view-'+v)?.classList.add('hidden');
        document.getElementById('nav-'+v)?.classList.remove('text-purple-400','scale-110');
    });

    document.getElementById('view-'+viewName)?.classList.remove('hidden');
    document.getElementById('nav-'+viewName)?.classList.add('text-purple-400','scale-110');

    if (viewName === 'reels') fetchReels();
    if (viewName === 'bible') showTestament('NT');
    if (viewName === 'messages' && !activeChatUser) resetChat();
    if (viewName !== 'messages') activeChatUser = null;
}

function loadAppData() {
    fetchPosts();
    loadConversations(); // 🔥 conservé de l’ancien code
    lucide?.createIcons();
}
// ==========================================
// 4. BIBLE
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
// 5. FAITH AI
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
    const { data } = await supabaseClient.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    container.innerHTML = '';
    
    if(data && data.length > 0) {
        let lastSenderId = null;
        
        data.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const isSameSender = lastSenderId === msg.sender_id;
            const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const bubbleClass = isMe 
                ? 'bg-purple-600 text-white rounded-tr-sm' 
                : 'bg-gray-800 text-gray-200 rounded-tl-sm';
            
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
    } else { container.innerHTML = '<div class="text-center text-gray-600 text-xs mt-10 italic">Dites bonjour ! 👋</div>'; }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!activeChatUser || !input || !input.value.trim()) return;
    const { error } = await supabaseClient.from('messages').insert([{ content: input.value, sender_id: currentUser.id, sender_email: currentUser.email, sender_name: userProfile.username, receiver_id: activeChatUser.id }]);
    if(!error) { input.value = ''; fetchMessages(); loadConversations(); }
}

// ==========================================
// 8. GESTION DES POSTS
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
// 13. GESTION DES REELS (HYBRIDE : APPWRITE + SUPABASE)
// ==========================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Upload vers Appwrite (Stockage)
async function uploadReelFile(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const maxSize = 500 * 1024 * 1024; // 500MB (Grace à Appwrite)

    if (file.size > maxSize) {
        alert("Fichier trop lourd.");
        return;
    }

    const btn = document.querySelector('#view-reels button');
    const originalIcon = btn.innerHTML;
    btn.innerHTML = `<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
    btn.disabled = true;

    try {
        console.log("Upload vers Appwrite...");
        
        // 1. Upload vers Appwrite
        const promise = storage.createFile(
            APPWRITE_BUCKET_ID,
            Appwrite.ID.unique(),
            file
        );

        const response = await promise;
        
        // 2. Génération du lien de lecture
        const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/${APPWRITE_BUCKET_ID}/files/${response.$id}/view?project=${client.config.project}`;

        // 3. Sauvegarde dans Supabase (Base de données)
        const { error: dbError } = await supabaseClient.from('reels').insert([{ 
            user_id: currentUser.id, 
            video_url: fileUrl, 
            caption: "Nouveau Reel ✨" 
        }]);

        if (dbError) throw dbError;

        alert("Reel publié !");
        fetchReels();

    } catch (error) {
        console.error(error);
        alert("Erreur upload : " + error.message);
    } finally {
        btn.innerHTML = originalIcon;
        btn.disabled = false;
        input.value = "";
    }
}

// Affichage (identique, mais charge les URLs Appwrite)
async function fetchReels() {
    const container = document.getElementById('reels-container');
    container.innerHTML = '<div class="flex items-center justify-center h-full text-white"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>';
    
    const { data: reels } = await supabaseClient.from('reels').select('*, profiles:user_id(username, avatar_url)').order('created_at', { ascending: false });
    
    container.innerHTML = '';
    
    if (reels && reels.length > 0) {
        const shuffledReels = shuffleArray([...reels]); 
        
        shuffledReels.forEach((reel, index) => {
            const avatar = reel.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + (reel.profiles?.username || 'Anonyme');
            const username = reel.profiles?.username || 'Utilisateur';

            const html = `
                <div class="reel-item relative w-full h-full bg-black snap-start snap-always flex justify-center items-center overflow-hidden">
                    <video 
                        src="${reel.video_url}" 
                        class="reel-video absolute w-full h-full object-cover"
                        loop 
                        playsinline 
                        webkit-playsinline
                        onclick="toggleVideoPlay(this)"
                    ></video>

                    <div class="play-icon absolute pointer-events-none opacity-0 transition-opacity duration-300">
                        <i data-lucide="play" class="w-16 h-16 text-white/50 fill-white"></i>
                    </div>

                    <div class="absolute bottom-24 right-4 z-20 flex flex-col gap-6 items-center">
                        <div class="relative mb-2">
                            <img src="${avatar}" class="w-10 h-10 rounded-full border-2 border-white shadow-lg object-cover">
                            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 rounded-full p-0.5 text-white w-4 h-4 flex items-center justify-center">
                                <i data-lucide="plus" class="w-3 h-3"></i>
                            </div>
                        </div>

                        <div class="flex flex-col items-center gap-1">
                            <button onclick="toggleReelAmen('${reel.id}')" class="p-2 transition-transform active:scale-75">
                                <i data-lucide="heart" class="w-8 h-8 text-white drop-shadow-md" id="reel-heart-${reel.id}"></i>
                            </button>
                            <span class="text-white text-xs font-bold shadow-black drop-shadow-md">Amen</span>
                        </div>

                        <div class="flex flex-col items-center gap-1">
                            <button onclick="openReelComments('${reel.id}')" class="p-2 transition-transform active:scale-75">
                                <i data-lucide="message-circle" class="w-8 h-8 text-white drop-shadow-md"></i>
                            </button>
                            <span class="text-white text-xs font-bold shadow-black drop-shadow-md">Coms</span>
                        </div>
                    </div>

                    <div class="absolute bottom-4 left-4 right-20 z-20 pointer-events-none text-left pb-16">
                        <h3 class="text-white font-bold text-sm mb-1 shadow-black drop-shadow-md">@${username}</h3>
                        <p class="text-white/90 text-sm line-clamp-2 shadow-black drop-shadow-md leading-tight">${reel.caption || ''}</p>
                    </div>
                    
                    <div class="absolute bottom-0 w-full h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
        
        setupReelObserver();
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        container.innerHTML = '<div class="flex h-full items-center justify-center flex-col"><p class="text-gray-500">Aucun Reel.</p><p class="text-xs text-gray-600">Soyez le premier à poster !</p></div>';
    }
}

function toggleVideoPlay(video) {
    if (video.paused) {
        video.play();
        video.nextElementSibling.classList.add('opacity-0');
    } else {
        video.pause();
        video.nextElementSibling.classList.remove('opacity-0');
    }
}

function setupReelObserver() {
    const options = { root: document.getElementById('reels-container'), threshold: 0.7 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;

            if (entry.isIntersecting) {
                video.currentTime = 0;
                video.play().catch(e => console.log("Autoplay bloqué", e));
            } else {
                video.pause();
            }
        });
    }, options);

    document.querySelectorAll('.reel-item').forEach(item => { observer.observe(item); });
}

// Amen & Commentaires (Identiques, liés à Supabase)
async function toggleReelAmen(reelId) {
    const icon = document.getElementById(`reel-heart-${reelId}`);
    if(icon.classList.contains('text-pink-500')) {
        icon.classList.remove('text-pink-500', 'fill-pink-500'); icon.classList.add('text-white');
    } else {
        icon.classList.add('text-pink-500', 'fill-pink-500'); icon.classList.remove('text-white');
    }
    await supabaseClient.from('reel_likes').insert([{ reel_id: reelId, user_id: currentUser.id }]);
}

let currentReelIdForComments = null;
async function openReelComments(reelId) {
    currentReelIdForComments = reelId;
    document.getElementById('reel-comments-modal').classList.remove('hidden');
    const list = document.getElementById('reel-comments-list');
    list.innerHTML = '<div class="text-center text-gray-500 mt-4">Chargement...</div>';
    const { data: comments } = await supabaseClient.from('reel_comments').select('*, profiles(username)').eq('reel_id', reelId).order('created_at', { ascending: true });
    list.innerHTML = '';
    if(comments && comments.length > 0) {
        comments.forEach(c => {
            list.insertAdjacentHTML('beforeend', `<div class="flex gap-2 mb-2"><span class="font-bold text-purple-400 text-sm">${c.profiles.username}</span><span class="text-gray-300 text-sm">${c.content}</span></div>`);
        });
    } else { list.innerHTML = '<div class="text-center text-gray-600 mt-10">Aucun commentaire.</div>'; }
}

async function sendReelComment() {
    const input = document.getElementById('reel-comment-input');
    const text = input.value;
    if(!text || !currentReelIdForComments) return;
    input.value = ''; 
    const list = document.getElementById('reel-comments-list');
    if(list.innerText.includes('Aucun commentaire')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', `<div class="flex gap-2 mb-2 opacity-50"><span class="font-bold text-purple-400 text-sm">Moi</span><span class="text-gray-300 text-sm">${text}</span></div>`);
    await supabaseClient.from('reel_comments').insert([{ reel_id: currentReelIdForComments, user_id: currentUser.id, content: text }]);
    openReelComments(currentReelIdForComments);
}
