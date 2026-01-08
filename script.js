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
// 3. NAVIGATION & UI
// ==========================================

function switchView(viewName) {
    // Note: 'live' a été remplacé par 'bible' dans la liste des vues
    ['home', 'reels', 'bible', 'messages', 'profile', 'public-profile'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById('nav-' + v);
        if(btn) { btn.classList.remove('text-purple-400'); btn.classList.add('text-gray-500'); }
    });

    const target = document.getElementById('view-' + viewName);
    if(target) target.classList.remove('hidden');
    
    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) { activeBtn.classList.remove('text-gray-500'); activeBtn.classList.add('text-purple-400'); }

    // GESTION REELS
    const reelsContainer = document.getElementById('reels-container');
    if (viewName === 'reels') {
        fetchReels(); 
    } else {
        if(reelsContainer) reelsContainer.innerHTML = '';
    }

    // GESTION BIBLE (NOUVEAU)
    if (viewName === 'bible') {
        showTestament('NT'); // Charge le Nouveau Testament par défaut
    }

    if (viewName === 'messages') {
        document.getElementById('msg-badge').classList.add('hidden');
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
// 4. BIBLE & FAITH AI (NOUVELLE SECTION)
// ==========================================

const bibleBooks = {
    AT: ["Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome", "Josué", "Juges", "Ruth", "1 Samuel", "2 Samuel", "1 Rois", "2 Rois", "1 Chroniques", "2 Chroniques", "Esdras", "Néhémie", "Esther", "Job", "Psaumes", "Proverbes", "Ecclésiaste", "Cantique", "Ésaïe", "Jérémie", "Lamentations", "Ézéchiel", "Daniel", "Osée", "Joël", "Amos", "Abdias", "Jonas", "Michée", "Nahum", "Habacuc", "Sophonie", "Aggée", "Zacharie", "Malachie"],
    NT: ["Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains", "1 Corinthiens", "2 Corinthiens", "Galates", "Éphésiens", "Philippiens", "Colossiens", "1 Thessaloniciens", "2 Thessaloniciens", "1 Timothée", "2 Timothée", "Tite", "Philémon", "Hébreux", "Jacques", "1 Pierre", "2 Pierre", "1 Jean", "2 Jean", "3 Jean", "Jude", "Apocalypse"]
};

function showTestament(type) {
    const atBtn = document.getElementById('btn-at');
    const ntBtn = document.getElementById('btn-nt');
    
    // Sécurité si les éléments n'existent pas
    if(!atBtn || !ntBtn) return;

    if(type === 'AT') {
        atBtn.classList.replace('bg-gray-800', 'bg-purple-600');
        atBtn.classList.replace('text-gray-400', 'text-white');
        ntBtn.classList.replace('bg-purple-600', 'bg-gray-800');
        ntBtn.classList.replace('text-white', 'text-gray-400');
    } else {
        ntBtn.classList.replace('bg-gray-800', 'bg-purple-600');
        ntBtn.classList.replace('text-gray-400', 'text-white');
        atBtn.classList.replace('bg-purple-600', 'bg-gray-800');
        atBtn.classList.replace('text-white', 'text-gray-400');
    }

    const container = document.getElementById('bible-books-list');
    if(container) {
        container.innerHTML = bibleBooks[type].map(book => `
            <button onclick="openChapter('${book}', 1)" class="p-4 bg-gray-800 border border-white/5 rounded-xl hover:bg-gray-700 transition-colors text-left group">
                <span class="font-bold text-white group-hover:text-purple-400 text-sm">${book}</span>
                <div class="text-[10px] text-gray-500 mt-1">Lire le livre →</div>
            </button>
        `).join('');
    }
}

function openChapter(book, chapter) {
    const reader = document.getElementById('bible-reader');
    if(!reader) return;
    
    reader.classList.remove('hidden');
    document.getElementById('reader-title').innerText = `${book} - Chapitre ${chapter}`;
    
    const contentDiv = document.getElementById('reader-content');
    contentDiv.innerHTML = '<div class="flex h-full items-center justify-center"><div class="w-8 h-8 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div></div>';
    
    // Simulation de chargement (Ici on pourrait connecter une API Bible)
    setTimeout(() => {
        contentDiv.innerHTML = `
            <div class="space-y-4 font-serif">
                <h4 class="font-bold text-center mb-6 text-gray-400 border-b border-white/10 pb-2">Texte Saint</h4>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">1</sup> Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">2</sup> Elle était au commencement avec Dieu.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">3</sup> Toutes choses ont été faites par elle, et rien de ce qui a été fait n'a été fait sans elle.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">4</sup> En elle était la vie, et la vie était la lumière des hommes.</p>
                <div class="text-center py-8">
                    <button class="bg-purple-600/20 text-purple-300 px-4 py-2 rounded-full text-xs font-bold">Chapitre Suivant ></button>
                </div>
            </div>
        `;
    }, 500);
}

function closeBibleReader() {
    document.getElementById('bible-reader').classList.add('hidden');
}

// LOGIQUE FAITH AI
async function askFaithAI() {
    const input = document.getElementById('ai-bible-input');
    const area = document.getElementById('ai-response-area');
    const question = input.value.trim();
    
    if(!question) return;
    
    area.classList.remove('hidden');
    area.innerHTML = '<div class="flex items-center gap-2 text-purple-300 text-xs"><div class="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div> Faith AI recherche...</div>';
    input.value = '';

    // Simulation de réponse IA
    setTimeout(() => {
        const responses = [
            "Jésus enseigne l'amour du prochain comme soi-même. C'est le fondement de la vie chrétienne.",
            "Dans les Psaumes, nous trouvons du réconfort : 'L'Éternel est mon berger, je ne manquerai de rien.'",
            "La foi est une ferme assurance des choses qu'on espère, une démonstration de celles qu'on ne voit pas (Hébreux 11:1).",
            "Ne vous inquiétez de rien; mais en toute chose faites connaître vos besoins à Dieu par des prières."
        ];
        const randomResp = responses[Math.floor(Math.random() * responses.length)];
        
        area.innerHTML = `
            <div class="border-l-2 border-purple-500 pl-2">
                <p class="text-[10px] text-gray-500 mb-1">Votre question : "${question}"</p>
                <p class="text-white font-medium text-xs leading-relaxed">${randomResp}</p>
            </div>
        `;
    }, 1500);
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
            container.innerHTML = `<div class="text-center py-10 px-4"><p class="text-gray-500 italic">Aucune publication... 🍃</p></div>`;
            return;
        }
        posts.forEach(post => {
            const isMyPost = post.user_id === currentUser.id;
            const date = new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const userAvatarUrl = post.profiles && post.profiles.avatar_url;
            const avatarHtml = userAvatarUrl ? `<img src="${userAvatarUrl}" class="w-8 h-8 rounded-full object-cover border border-white/10 shadow-lg">` : `<div class="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-lg">${post.avatar_initials || "??"}</div>`;
            const postLikes = allLikes ? allLikes.filter(l => l.post_id === post.id) : [];
            const isAmened = postLikes.some(l => l.user_id === currentUser.id);
            const amenColor = isAmened ? 'text-pink-500 font-bold' : 'text-gray-500 hover:text-pink-400';
            const amenIconClass = isAmened ? 'fill-pink-500 text-pink-500' : 'text-gray-500';

            container.insertAdjacentHTML('beforeend', `
                <div class="bg-gray-800/30 rounded-2xl p-4 border border-white/5 mb-4 animate-fade-in" id="post-${post.id}">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-3">${avatarHtml}<div><h3 class="font-bold text-white text-sm">${post.user_name}</h3><p class="text-[10px] text-gray-500">${date}</p></div></div>
                        ${isMyPost ? `<button onclick="deletePost('${post.id}')" class="text-gray-500 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                    </div>
                    <p class="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">${post.content}</p>
                    ${post.image_url ? `<div class="mt-3 rounded-xl overflow-hidden border border-white/5"><img src="${post.image_url}" class="w-full max-h-96 object-cover"></div>` : ''}
                    <div class="border-t border-white/5 mt-3 pt-3 flex justify-between text-gray-500">
                        <div class="flex gap-4">
                            <button onclick="toggleAmen('${post.id}')" class="${amenColor} flex items-center gap-1 text-xs"><i data-lucide="heart" class="w-4 h-4 ${amenIconClass}"></i> ${postLikes.length > 0 ? postLikes.length + ' ' : ''}Amen</button>
                            <button onclick="toggleComments('${post.id}')" class="hover:text-blue-400 flex items-center gap-1 text-xs"><i data-lucide="message-square" class="w-4 h-4"></i> Commenter</button>
                        </div>
                    </div>
                    <div id="comments-section-${post.id}" class="hidden mt-3 pt-3 bg-black/20 rounded-lg p-3">
                        <div id="comments-list-${post.id}" class="space-y-2 mb-3 max-h-40 overflow-y-auto scrollbar-hide"></div>
                        <div class="flex gap-2">
                            <input type="text" id="input-comment-${post.id}" placeholder="Votre commentaire..." class="flex-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-1 text-xs text-white outline-none">
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
// 13. GESTION DES REELS (NOUVELLE SECTION)
// ==========================================

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function openAddReelModal() { document.getElementById('add-reel-modal').classList.remove('hidden'); }
function closeAddReelModal() { document.getElementById('add-reel-modal').classList.add('hidden'); }

async function saveReel() {
    const url = document.getElementById('reel-url').value.trim();
    const caption = document.getElementById('reel-caption').value.trim();
    if(!url) return alert("Veuillez mettre un lien.");
    await supabaseClient.from('reels').insert([{ user_id: currentUser.id, video_url: url, caption: caption }]);
    closeAddReelModal();
    document.getElementById('reel-url').value = '';
    document.getElementById('reel-caption').value = '';
    fetchReels(); 
}

// --- MODIFICATION POUR BLOQUER LA BARRE DE PAUSE ---
// Nous remplaçons l'action "Pause" par "Mute/Unmute" sur le clic de l'overlay
async function fetchReels() {
    const container = document.getElementById('reels-container');
    container.innerHTML = '<div class="flex items-center justify-center h-full"><div class="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>';
    
    const { data: reels } = await supabaseClient.from('reels').select('*, profiles:user_id(username, avatar_url)').order('created_at', { ascending: false });
    
    container.innerHTML = '';
    if (reels && reels.length > 0) {
        const shuffledReels = shuffleArray([...reels]); 
        shuffledReels.forEach(reel => {
            let videoId = '';
            let rawUrl = reel.video_url;
            if(rawUrl.includes('shorts/')) videoId = rawUrl.split('shorts/')[1].split('?')[0];
            else if(rawUrl.includes('v=')) videoId = rawUrl.split('v=')[1].split('&')[0];
            else videoId = rawUrl.split('/').pop();

            // Note: enablejsapi=1 est requis pour le contrôle du son
            const playUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&loop=1&playlist=${videoId}&rel=0&playsinline=1&iv_load_policy=3&modestbranding=1&enablejsapi=1&disablekb=1`;
            const avatar = reel.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + reel.profiles?.username;
            
            const html = `
                <div class="reel-item relative w-full h-full flex items-center justify-center bg-black snap-start snap-always overflow-hidden">
                    <div class="absolute inset-0 z-0">
                        <iframe 
                            id="reel-iframe-${reel.id}"
                            class="reel-iframe w-full h-full opacity-0 transition-opacity duration-500 scale-[1.35]" 
                            style="pointer-events: none;"
                            data-src="${playUrl}" 
                            src="" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowfullscreen>
                        </iframe>
                        <div class="absolute inset-0 bg-transparent z-10 cursor-pointer" onclick="toggleReelSound('${reel.id}')"></div>
                    </div>
                    <div class="absolute bottom-20 right-4 z-20 flex flex-col gap-6 items-center">
                        <div class="flex flex-col items-center gap-1">
                            <button onclick="toggleReelAmen('${reel.id}')" class="bg-black/40 backdrop-blur-md p-3 rounded-full active:scale-90 transition-transform">
                                <i data-lucide="heart" class="w-7 h-7 text-white" id="reel-heart-${reel.id}"></i>
                            </button>
                            <span class="text-white text-xs font-bold drop-shadow-md">Amen</span>
                        </div>
                        <div class="flex flex-col items-center gap-1">
                            <button onclick="openReelComments('${reel.id}')" class="bg-black/40 backdrop-blur-md p-3 rounded-full active:scale-90 transition-transform">
                                <i data-lucide="message-circle" class="w-7 h-7 text-white"></i>
                            </button>
                            <span class="text-white text-xs font-bold drop-shadow-md">Coms</span>
                        </div>
                    </div>
                    <div class="absolute bottom-4 left-4 right-16 z-20 pointer-events-none">
                        <div class="flex items-center gap-3 mb-3 pointer-events-auto">
                            <img src="${avatar}" class="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover">
                            <span class="text-white font-bold text-sm shadow-black drop-shadow-md">@${reel.profiles?.username}</span>
                        </div>
                        <p class="text-white text-sm line-clamp-2 drop-shadow-md">${reel.caption || ''}</p>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });
        
        setupReelObserver();
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Fonction pour Couper/Activer le son (remplace la Pause)
function toggleReelSound(reelId) {
    const iframe = document.getElementById(`reel-iframe-${reelId}`);
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
    }
}

function setupReelObserver() {
    const options = { root: document.getElementById('reels-container'), threshold: 0.6 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const iframe = entry.target.querySelector('iframe');
            if (entry.isIntersecting) {
                if (iframe.src !== iframe.dataset.src) {
                    iframe.src = iframe.dataset.src;
                    iframe.classList.remove('opacity-0');
                }
            } else {
                iframe.src = "";
                iframe.classList.add('opacity-0');
            }
        });
    }, options);
    document.querySelectorAll('.reel-item').forEach(item => { observer.observe(item); });
}

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
