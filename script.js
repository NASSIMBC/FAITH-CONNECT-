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
let selectedImageFile = null;     // Pour les posts
let selectedAvatarFile = null;    // NOUVEAU : Pour la photo de profil

document.addEventListener('DOMContentLoaded', checkSession);

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
    ['home', 'reels', 'live', 'messages', 'profile', 'public-profile'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById('nav-' + v);
        if(btn) { btn.classList.remove('text-purple-400'); btn.classList.add('text-gray-500'); }
    });

    const target = document.getElementById('view-' + viewName);
    if(target) target.classList.remove('hidden');
    
    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) { activeBtn.classList.remove('text-gray-500'); activeBtn.classList.add('text-purple-400'); }

    if (viewName === 'live') fetchLiveMessages();
    if (viewName === 'messages') {
        document.getElementById('msg-badge').classList.add('hidden');
        if(!activeChatUser) resetChat();
    }
    if (viewName === 'profile') {
        switchProfileTab('friends'); 
    }
    if(viewName !== 'messages' && viewName !== 'public-profile') activeChatUser = null;
}

async function loadAppData() {
    fetchPosts();
    renderStoriesList();
    resetChat();
    loadConversations(); 
    fetchNotifications(); 
    fetchPrayers(); 
    subscribeToRealtime();
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. PROFIL (Affichage & Modification)
// ==========================================

async function updateMyStatus() {
    const text = prompt("Ton humeur actuelle ?");
    if (text === null) return; 
    const emoji = prompt("Un emoji ?", "💻");
    const { error } = await supabaseClient.from('profiles').update({ status_text: text, status_emoji: emoji || "👋", status_updated_at: new Date().toISOString() }).eq('id', currentUser.id);
    if (error) alert("Erreur : " + error.message);
    else { userProfile.status_text = text; userProfile.status_emoji = emoji || "👋"; updateUIProfile(); }
}

// --- Mise à jour visuelle du profil (Image ou Initiales) ---
function updateUIProfile() {
    const initials = userProfile.username ? userProfile.username.substring(0, 2).toUpperCase() : "??";
    
    // 1. Textes
    document.querySelectorAll('#user-display, #profile-name').forEach(el => el.innerText = userProfile.username);
    if(document.getElementById('profile-email')) document.getElementById('profile-email').innerText = "@" + userProfile.username;
    
    const textDisplay = document.getElementById('status-text-display');
    const emojiDisplay = document.getElementById('status-emoji-display');
    if (textDisplay && emojiDisplay) {
        textDisplay.innerText = userProfile.status_text || "Ajouter un statut...";
        emojiDisplay.innerText = userProfile.status_emoji || "👋";
    }

    // 2. Avatars (Le gros changement est ici)
    const avatarElements = ['current-user-avatar-small', 'profile-avatar-big'];
    
    avatarElements.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;

        // Si l'utilisateur a une URL d'avatar enregistrée
        if (userProfile.avatar_url) {
            el.innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover rounded-full">`;
            el.innerText = ""; // On enlève les initiales
            // Optionnel : on peut enlever le fond de couleur par défaut s'il gêne
            // el.classList.remove('bg-gradient-to-tr', 'from-purple-500', 'to-blue-500'); 
        } else {
            // Sinon on garde les initiales
            el.innerHTML = ""; // On vide l'image
            el.innerText = initials;
        }
    });
}

function openEditModal() { 
    document.getElementById('edit-profile-modal').classList.remove('hidden'); 
    document.getElementById('edit-username').value = userProfile.username; 
    document.getElementById('edit-bio').value = userProfile.bio; 
    
    // Reset de la preview
    const preview = document.getElementById('edit-avatar-preview');
    if (userProfile.avatar_url) {
        preview.src = userProfile.avatar_url;
    } else {
        // Une image par défaut si pas d'avatar
        preview.src = "https://ui-avatars.com/api/?name=" + userProfile.username + "&background=random";
    }
    selectedAvatarFile = null;
}

function closeEditModal() { 
    document.getElementById('edit-profile-modal').classList.add('hidden'); 
}

// --- NOUVEAU : Prévisualisation de l'avatar ---
function handleAvatarPreview(input) {
    if (input.files && input.files[0]) {
        selectedAvatarFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('edit-avatar-preview').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- MODIFIÉ : Sauvegarde avec Upload Image ---
async function saveProfile() {
    const newUsername = document.getElementById('edit-username').value;
    const newBio = document.getElementById('edit-bio').value;
    const btn = document.querySelector('#edit-profile-modal button:last-child'); // Bouton enregistrer

    if (!newUsername.trim()) return alert("Pseudo requis");

    btn.innerText = "Sauvegarde...";
    btn.disabled = true;

    try {
        let finalAvatarUrl = userProfile.avatar_url; // Par défaut, on garde l'ancienne

        // 1. Si une nouvelle image est sélectionnée, on l'upload
        if (selectedAvatarFile) {
            const fileExt = selectedAvatarFile.name.split('.').pop();
            const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

            // Upload vers le bucket 'avatars'
            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(fileName, selectedAvatarFile);

            if (uploadError) throw uploadError;

            // Récupérer l'URL publique
            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            finalAvatarUrl = data.publicUrl;
        }

        // 2. Mise à jour de la table profiles
        const { error } = await supabaseClient.from('profiles').update({ 
            username: newUsername, 
            bio: newBio,
            avatar_url: finalAvatarUrl // On ajoute l'URL
        }).eq('id', currentUser.id);

        if (error) throw error;

        // 3. Mise à jour locale pour affichage immédiat
        userProfile.username = newUsername;
        userProfile.bio = newBio;
        userProfile.avatar_url = finalAvatarUrl;
        
        updateUIProfile();
        closeEditModal();
        alert("Profil mis à jour !");

    } catch (error) {
        console.error(error);
        alert("Erreur : " + error.message);
    } finally {
        btn.innerText = "Enregistrer";
        btn.disabled = false;
    }
}

// ==========================================
// 5. GESTION DES AMIS
// ==========================================
// (Pas de changement ici, mais je garde le code pour la cohérence)

async function switchProfileTab(tabName) {
    const btnFriends = document.getElementById('tab-friends');
    const btnRequests = document.getElementById('tab-requests');
    const container = document.getElementById('profile-social-list');
    
    if(!btnFriends || !btnRequests || !container) return;

    if(tabName === 'friends') {
        btnFriends.className = "pb-2 text-sm font-bold text-purple-400 border-b-2 border-purple-400 transition-all";
        btnRequests.className = "pb-2 text-sm font-bold text-gray-500 hover:text-white transition-all relative";
        await fetchMyFriendsList(container);
    } else {
        btnRequests.className = "pb-2 text-sm font-bold text-purple-400 border-b-2 border-purple-400 transition-all relative";
        btnFriends.className = "pb-2 text-sm font-bold text-gray-500 hover:text-white transition-all";
        await fetchMyRequestsList(container);
    }
}

async function fetchMyFriendsList(container) {
    container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 italic">Chargement...</div>';
    
    const { data: friendships } = await supabaseClient.from('friendships')
        .select('*')
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .eq('status', 'accepted');

    if(!friendships || friendships.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Vous n\'avez pas encore d\'amis.</div>';
        return;
    }

    const friendIds = friendships.map(f => f.requester_id === currentUser.id ? f.receiver_id : f.requester_id);
    const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', friendIds);

    container.innerHTML = '';
    profiles.forEach(p => {
        // Affichage avatar ami (si dispo) ou initiales
        const avatarHtml = p.avatar_url 
            ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
            : `<div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">${p.username.substring(0,2).toUpperCase()}</div>`;

        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-2xl border border-white/5 animate-fade-in mb-2">
                <div class="flex items-center gap-3">
                    ${avatarHtml}
                    <div class="text-left">
                        <p class="text-sm font-bold text-white">${p.username}</p>
                        <p class="text-[10px] text-gray-500 truncate w-24">${p.status_text || 'En ligne'}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="openDirectChat('${p.id}', '${p.username}')" class="p-2 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white transition-all">
                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                    </button>
                    <button onclick="removeFriend('${p.id}')" class="p-2 bg-red-600/10 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all">
                        <i data-lucide="user-minus" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>`);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
    const countEl = document.getElementById('stats-friends-count');
    if(countEl) countEl.innerText = profiles.length;
}

async function fetchMyRequestsList(container) {
    container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4 italic">Chargement...</div>';
    
    const { data: requests } = await supabaseClient.from('friendships')
        .select('*').eq('receiver_id', currentUser.id).eq('status', 'pending');

    if(!requests || requests.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-gray-500 py-4">Aucune demande en attente.</div>';
        document.getElementById('profile-req-badge').classList.add('hidden');
        return;
    }

    document.getElementById('profile-req-badge').innerText = requests.length;
    document.getElementById('profile-req-badge').classList.remove('hidden');

    const requesterIds = requests.map(r => r.requester_id);
    const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', requesterIds);

    container.innerHTML = '';
    requests.forEach(req => {
        const p = profiles.find(prof => prof.id === req.requester_id);
        if(!p) return;
        const avatarHtml = p.avatar_url 
            ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
            : `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs">${p.username.substring(0,2).toUpperCase()}</div>`;

        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-white/5 animate-fade-in mb-2">
                <div class="flex items-center gap-3">
                    ${avatarHtml}
                    <p class="text-sm font-bold text-white">${p.username}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="handleFriendRequest('${req.id}', true)" class="px-4 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-500">Accepter</button>
                    <button onclick="handleFriendRequest('${req.id}', false)" class="px-4 py-1.5 bg-red-600/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-600 hover:text-white">Refuser</button>
                </div>
            </div>`);
    });
}

async function removeFriend(friendId) {
    if(!confirm("Retirer cet ami ?")) return;
    await supabaseClient.from('friendships').delete().or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);
    switchProfileTab('friends');
    updateFriendCount(currentUser.id);
}

// ==========================================
// 6. CHAT PRIVÉ
// ==========================================

function openDirectChat(userId, username) {
    const targetProfile = { id: userId, username: username };
    startChat(targetProfile);
    
    if(window.innerWidth < 768) {
        document.getElementById('conversations-sidebar').classList.add('hidden');
        document.getElementById('chat-detail').classList.remove('hidden');
        document.getElementById('chat-detail').classList.add('flex');
        
        const header = document.getElementById('chat-with-name').parentNode;
        if(!document.getElementById('mobile-back-btn')) {
            const btn = document.createElement('button');
            btn.id = 'mobile-back-btn';
            btn.innerHTML = '<i data-lucide="arrow-left" class="w-6 h-6 text-white mr-2"></i>';
            btn.onclick = () => {
                document.getElementById('conversations-sidebar').classList.remove('hidden');
                document.getElementById('chat-detail').classList.add('hidden');
                document.getElementById('chat-detail').classList.remove('flex');
                resetChat();
            };
            header.insertBefore(btn, header.firstChild);
            if(typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

async function loadConversations() {
    const container = document.getElementById('messages-list');
    if(!container) return;
    const { data: messages } = await supabaseClient.from('messages').select('*').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).not('receiver_id', 'is', null).order('created_at', { ascending: false });
    if (!messages || messages.length === 0) { container.innerHTML = '<div class="text-gray-500 text-center mt-4 text-xs italic px-4">Aucune discussion.</div>'; return; }
    
    const uniqueConversations = {};
    for (const msg of messages) {
        const otherUserId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (!otherUserId || uniqueConversations[otherUserId]) continue;
        uniqueConversations[otherUserId] = { userId: otherUserId, lastMessage: msg.content, time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), name: msg.sender_id === currentUser.id ? "Ami" : msg.sender_name, initials: (msg.sender_name || "A").substring(0,2).toUpperCase() };
    }
    const conversationArray = Object.values(uniqueConversations);
    const ids = conversationArray.map(c => c.userId);
    if(ids.length > 0) {
        const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url').in('id', ids);
        if(profiles) profiles.forEach(p => { 
            const c = conversationArray.find(x => x.userId === p.id); 
            if(c) { 
                c.name = p.username; 
                c.initials = p.username.substring(0,2).toUpperCase();
                c.avatar_url = p.avatar_url; // On récupère l'avatar
            }
        });
    }
    container.innerHTML = conversationArray.map(conv => {
        // Avatar chat
        const avatarDisplay = conv.avatar_url 
            ? `<img src="${conv.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
            : `<div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${conv.initials}</div>`;

        return `
        <div onclick="openDirectChat('${conv.userId}', '${conv.name.replace(/'/g, "\\'")}')" class="p-3 hover:bg-white/5 rounded-xl cursor-pointer flex items-center space-x-3 transition-colors border-b border-white/5">
            ${avatarDisplay}
            <div class="flex-1 min-w-0"><div class="flex justify-between items-baseline mb-0.5"><h4 class="font-bold text-sm text-white truncate">${conv.name}</h4><span class="text-[10px] text-gray-500">${conv.time}</span></div><p class="text-xs text-gray-400 truncate">${conv.lastMessage}</p></div>
        </div>`;
    }).join('');
}

function startChat(targetProfile) {
    activeChatUser = targetProfile;
    switchView('messages');
    document.getElementById('chat-with-name').innerHTML = `<span class="text-purple-400">@</span>${targetProfile.username}`;
    const input = document.getElementById('chat-input');
    if(input) { input.disabled = false; input.focus(); }
    fetchMessages(); 
}

function resetChat() {
    activeChatUser = null;
    const title = document.getElementById('chat-with-name');
    if(title) title.innerText = "Sélectionnez un ami";
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
        data.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            container.insertAdjacentHTML('beforeend', `<div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in mb-2"><div class="${isMe ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200'} px-4 py-2 rounded-2xl max-w-[85%] text-sm border border-white/5 shadow-sm">${msg.content}</div></div>`);
        });
        setTimeout(() => container.scrollTop = container.scrollHeight, 100);
    } else { container.innerHTML = '<div class="text-center text-gray-600 text-xs mt-10 italic">Dites bonjour ! 👋</div>'; }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!activeChatUser || !input || !input.value.trim()) return;
    const messageData = { content: input.value, sender_id: currentUser.id, sender_email: currentUser.email, sender_name: userProfile.username, receiver_id: activeChatUser.id };
    const { error } = await supabaseClient.from('messages').insert([messageData]);
    if(!error) { input.value = ''; fetchMessages(); loadConversations(); }
}

// ==========================================
// 7. GESTION DU LIVE
// ==========================================

async function fetchLiveMessages() {
    const container = document.getElementById('live-chat-messages');
    if(!container) return;
    const { data: messages } = await supabaseClient.from('live_messages').select('*').order('created_at', { ascending: true }).limit(50);
    container.innerHTML = '';
    if (messages && messages.length > 0) {
        messages.forEach(msg => {
            container.insertAdjacentHTML('beforeend', `<div class="animate-fade-in flex gap-2 mb-1.5 items-start"><span class="font-bold text-purple-400 shrink-0 text-xs mt-0.5">${msg.user_name}:</span><span class="text-gray-200 text-sm leading-tight">${msg.content}</span></div>`);
        });
        container.scrollTop = container.scrollHeight;
    } else {
        container.innerHTML = '<div class="text-center text-gray-600 text-xs py-10 italic">Bienvenue dans le chat du direct !</div>';
    }
}

async function sendLiveMessage() {
    const input = document.getElementById('live-chat-input');
    if (!input || !input.value.trim()) return;
    const { error } = await supabaseClient.from('live_messages').insert([{ user_name: userProfile.username, content: input.value }]);
    if(!error) input.value = '';
}

// ==========================================
// 8. GESTION DES POSTS (AVEC IMAGES & COMMENTAIRES)
// ==========================================

// --- A. Fonction pour trouver qui sont mes amis ---
async function getFriendIds() {
    const { data } = await supabaseClient
        .from('friendships')
        .select('requester_id, receiver_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    const friendIds = new Set([currentUser.id]); 

    if (data) {
        data.forEach(f => {
            friendIds.add(f.requester_id === currentUser.id ? f.receiver_id : f.requester_id);
        });
    }
    
    return Array.from(friendIds);
}

// --- B. Gestion de l'image POST (Preview) ---
function handleImageSelect(input) {
    if (input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
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

// --- C. Publication (Texte + Image) ---
async function publishPost() {
    const input = document.getElementById('new-post-input');
    const btn = document.getElementById('btn-publish');

    if (!input.value.trim() && !selectedImageFile) return alert("Le post est vide !");

    // Bouton chargement
    btn.innerHTML = 'Envoi...';
    btn.disabled = true;

    try {
        let imageUrl = null;

        // 1. Upload Image si présente
        if (selectedImageFile) {
            const fileExt = selectedImageFile.name.split('.').pop();
            const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('post-images') 
                .upload(fileName, selectedImageFile);

            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }

        // 2. Insert Post (On ajoute aussi l'avatar de l'user pour l'afficher plus tard si besoin)
        await supabaseClient.from('posts').insert([{ 
            user_id: currentUser.id, 
            content: input.value, 
            user_name: userProfile.username, 
            image_url: imageUrl,
            avatar_initials: userProfile.username.substring(0,2).toUpperCase() 
            // Note: Si tu veux que l'avatar du post se mette à jour quand l'user change de photo,
            // il faudra faire un "join" avec la table profiles. Pour l'instant on reste simple.
        }]);

        // Reset
        input.value = '';
        removeImage();
        fetchPosts();

    } catch (error) {
        console.error(error);
        alert("Erreur lors de la publication : " + error.message);
    } finally {
        btn.innerHTML = 'Publier';
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// --- D. Affichage des Posts (FILTRÉ PAR AMIS) ---
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if(!container) return;

    // 1. Récupère liste des amis
    const friendIds = await getFriendIds();

    // 2. Requête filtrée avec .in() + On récupère les infos du PROFIL pour avoir l'avatar à jour
    const { data } = await supabaseClient
        .from('posts')
        .select('*, profiles:user_id(avatar_url)') // Join avec profiles pour l'avatar
        .in('user_id', friendIds)
        .order('created_at', { ascending: false });
    
    container.innerHTML = ''; 

    // 3. Gestion cas vide
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 px-4 animate-fade-in">
                <div class="bg-gray-800/50 rounded-2xl p-6 border border-dashed border-gray-600">
                    <p class="text-gray-400 mb-2 font-medium">Votre fil d'actualité est calme... 🍃</p>
                    <p class="text-xs text-gray-500">Ajoutez des amis via la recherche 🔍 pour voir leurs bénédictions ici !</p>
                </div>
            </div>`;
        return;
    }

    // 4. Affichage
    data.forEach(post => {
        const isMyPost = post.user_id === currentUser.id;
        const date = new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Avatar du post (priorité à l'image du profil, sinon initiales)
        const userAvatarUrl = post.profiles && post.profiles.avatar_url;
        const avatarHtml = userAvatarUrl 
            ? `<img src="${userAvatarUrl}" class="w-8 h-8 rounded-full object-cover shadow-lg border border-white/10">`
            : `<div class="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-lg">${post.avatar_initials || "??"}</div>`;

        // Image du post
        const postImageHtml = post.image_url 
            ? `<div class="mt-3 rounded-xl overflow-hidden border border-white/5"><img src="${post.image_url}" class="w-full max-h-96 object-cover"></div>` 
            : '';

        const deleteBtn = isMyPost 
            ? `<button onclick="deletePost('${post.id}')" class="text-gray-500 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
            : '';

        container.insertAdjacentHTML('beforeend', `
            <div class="bg-gray-800/30 rounded-2xl p-4 border border-white/5 mb-4 animate-fade-in" id="post-${post.id}">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center space-x-3">
                        ${avatarHtml}
                        <div>
                            <h3 class="font-bold text-white text-sm">${post.user_name}</h3>
                            <p class="text-[10px] text-gray-500">${date}</p>
                        </div>
                    </div>
                    ${deleteBtn}
                </div>
                
                <p class="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">${post.content}</p>
                ${postImageHtml}
                
                <div class="border-t border-white/5 mt-3 pt-3 flex justify-between text-gray-500">
                    <div class="flex gap-4">
                        <button class="hover:text-pink-400 transition-colors flex items-center gap-1 text-xs"><i data-lucide="heart" class="w-4 h-4"></i> Amen</button>
                        <button onclick="toggleComments('${post.id}')" class="hover:text-blue-400 transition-colors flex items-center gap-1 text-xs"><i data-lucide="message-square" class="w-4 h-4"></i> Commenter</button>
                    </div>
                    <button onclick="sharePost('${post.content}')" class="hover:text-green-400 transition-colors flex items-center gap-1 text-xs"><i data-lucide="share-2" class="w-4 h-4"></i> Partager</button>
                </div>

                <div id="comments-section-${post.id}" class="hidden mt-3 pt-3 bg-black/20 rounded-lg p-3">
                    <div id="comments-list-${post.id}" class="space-y-2 mb-3"></div>
                    <div class="flex gap-2">
                        <input type="text" id="input-comment-${post.id}" placeholder="Votre commentaire..." class="flex-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-1 text-xs text-white">
                        <button onclick="sendComment('${post.id}')" class="text-purple-400 font-bold text-xs">Envoyer</button>
                    </div>
                </div>
            </div>`);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// --- E. Actions sur les Posts ---

async function deletePost(id) {
    if(!confirm("Supprimer ce post ?")) return;
    const { error } = await supabaseClient.from('posts').delete().eq('id', id);
    if(!error) document.getElementById(`post-${id}`).remove();
    else alert("Erreur: " + error.message);
}

function sharePost(text) {
    navigator.clipboard.writeText(text);
    alert("Texte copié dans le presse-papier !");
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    const list = document.getElementById(`comments-list-${postId}`);
    
    section.classList.toggle('hidden');

    if (!section.classList.contains('hidden')) {
        // Charger commentaires depuis la table 'comments'
        const { data: comments } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        list.innerHTML = '';
        if(comments && comments.length > 0) {
            comments.forEach(c => {
                list.innerHTML += `<div class="text-xs text-gray-300"><span class="font-bold text-purple-400">${c.user_name}:</span> ${c.content}</div>`;
            });
        } else {
            list.innerHTML = '<div class="text-[10px] text-gray-500 italic">Aucun commentaire.</div>';
        }
    }
}

async function sendComment(postId) {
    const input = document.getElementById(`input-comment-${postId}`);
    const content = input.value;

    if(!content.trim()) return;

    await supabaseClient.from('comments').insert([{ 
        post_id: postId, 
        user_id: currentUser.id, 
        user_name: userProfile.username,
        content: content 
    }]);
    
    input.value = '';
    
    // Astuce : On ferme et rouvre pour recharger
    document.getElementById(`comments-section-${postId}`).classList.add('hidden');
    toggleComments(postId);
}

// ==========================================
// 9. RECHERCHE & PRIÈRES
// ==========================================

async function searchUsers(query) {
    const resultBox = document.getElementById('search-results');
    if (!query || query.length < 2) { resultBox.classList.add('hidden'); return; }
    const { data } = await supabaseClient.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(5);
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = (data && data.length > 0) ? data.map(u => {
        const avatarHtml = u.avatar_url 
            ? `<img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/10">`
            : `<div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold text-[10px] text-white">${u.username.substring(0,2).toUpperCase()}</div>`;
        
        return `<div onclick="openUserProfile('${u.id}')" class="p-3 border-b border-white/5 flex justify-between items-center hover:bg-white/5 cursor-pointer">
            <div class="flex items-center gap-3">
                ${avatarHtml}
                <span class="text-sm font-bold text-white">${u.username}</span>
            </div>
            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-500"></i>
        </div>`
    }).join('') : '<div class="p-3 text-gray-500 text-xs text-center italic">Aucun utilisateur trouvé</div>';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function openUserProfile(userId) {
    if(userId === currentUser.id) { switchView('profile'); return; }
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if(profile) {
        document.getElementById('public-username').innerText = profile.username;
        document.getElementById('public-bio').innerText = profile.bio || "Pas de bio.";
        
        const avatarEl = document.getElementById('public-avatar');
        if(profile.avatar_url) {
            avatarEl.innerHTML = `<img src="${profile.avatar_url}" class="w-full h-full object-cover">`;
            avatarEl.innerText = "";
        } else {
            avatarEl.innerHTML = "";
            avatarEl.innerText = profile.username.substring(0,2).toUpperCase();
        }

        document.getElementById('btn-message').onclick = () => startChat(profile);
        document.getElementById('btn-add-friend').onclick = () => addFriend(profile.id);
        switchView('public-profile');
    }
}

async function fetchPrayers() {
    const container = document.getElementById('prayers-list');
    if(!container) return;
    const { data: prayers } = await supabaseClient.from('prayers').select('*').order('created_at', { ascending: false });
    container.innerHTML = (prayers && prayers.length > 0) ? prayers.map(p => `
        <div class="bg-gray-900/60 p-3 rounded-xl border border-pink-500/10 flex justify-between items-center mb-2"><div class="flex-1"><p class="text-[10px] font-bold text-pink-400 mb-0.5">${p.user_name}</p><p class="text-xs text-gray-300 italic">"${p.content}"</p></div><button onclick="prayFor('${p.id}', ${p.count})" class="ml-3 flex flex-col items-center group"><div class="bg-gray-800 p-2 rounded-full border border-gray-600 group-hover:border-pink-500 group-hover:bg-pink-900/30 transition-all"><span class="text-sm">🙏</span></div><span class="text-[9px] text-gray-500 font-bold mt-1 group-hover:text-pink-400">${p.count}</span></button></div>`).join('') : '<div class="text-center text-[10px] text-gray-500 py-4 italic">Soyez le premier à prier ! 🙏</div>';
}

async function addPrayer() {
    const input = document.getElementById('prayer-input');
    if (!input || !input.value.trim()) return;
    await supabaseClient.from('prayers').insert([{ user_id: currentUser.id, user_name: userProfile.username, content: input.value, count: 0 }]);
    input.value = ''; fetchPrayers();
}

async function prayFor(id, current) {
    await supabaseClient.from('prayers').update({ count: (current || 0) + 1 }).eq('id', id);
    fetchPrayers();
}

// ==========================================
// 10. SYSTÈME TEMPS RÉEL (REALTIME)
// ==========================================

function subscribeToRealtime() {
    supabaseClient.channel('global-updates').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        
        if (payload.table === 'messages') { fetchMessages(); loadConversations(); }
        
        if (payload.table === 'posts') { fetchPosts(); }
        
        if (payload.table === 'friendships') { 
            fetchNotifications(); 
            updateFriendCount(currentUser.id);
            if(payload.new.receiver_id === currentUser.id && payload.eventType === 'INSERT') showNotification("Système", "Nouvelle demande d'ami !");
        }

        if (payload.table === 'live_messages' && payload.eventType === 'INSERT') {
            const container = document.getElementById('live-chat-messages');
            if(container) {
                container.insertAdjacentHTML('beforeend', `<div class="animate-fade-in flex gap-2 mb-1.5 items-start"><span class="font-bold text-purple-400 shrink-0 text-xs mt-0.5">${payload.new.user_name}:</span><span class="text-gray-200 text-sm leading-tight">${payload.new.content}</span></div>`);
                container.scrollTop = container.scrollHeight;
            }
        }
    }).subscribe();
}

// ==========================================
// 11. NOTIFICATIONS ET UTILITAIRES
// ==========================================

async function updateFriendCount(userId) {
    const { count: c1 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'accepted');
    const { count: c2 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'accepted');
    const total = (c1 || 0) + (c2 || 0);
    const el = document.getElementById('stats-friends-count');
    if(el) el.innerText = total;
}

function showNotification(senderName, message) {
    const audio = document.getElementById('notif-sound');
    if(audio) audio.play().catch(e => {});
    const badge = document.getElementById('msg-badge');
    if(badge) badge.classList.remove('hidden');
    
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = "bg-gray-800 border-l-4 border-purple-500 text-white p-3 rounded-xl shadow-2xl flex items-center gap-3 mb-2 animate-bounce-in";
    notif.innerHTML = `<div><h4 class="font-bold text-xs text-purple-400">${senderName}</h4><p class="text-xs text-gray-300 truncate">${message}</p></div>`;
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
            return `<div class="p-3 border-b border-white/5 flex items-center justify-between"><span class="text-xs font-bold text-white">${p ? p.username : 'Ami'}</span><div class="flex gap-2"><button onclick="handleFriendRequest('${req.id}', true)" class="text-green-400"><i data-lucide="check" class="w-4 h-4"></i></button><button onclick="handleFriendRequest('${req.id}', false)" class="text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button></div></div>`;
        }).join('');
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else { 
        badge.classList.add('hidden'); 
        if(list) list.innerHTML = '<div class="p-4 text-center text-xs text-gray-500">Rien pour le moment 🍃</div>'; 
    }
}

async function handleFriendRequest(id, accepted) {
    if (accepted) await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabaseClient.from('friendships').delete().eq('id', id);
    fetchNotifications(); updateFriendCount(currentUser.id);
    const profList = document.getElementById('profile-friends-list');
    if(profList) switchProfileTab('requests');
}

async function addFriend(targetId) {
    const btn = document.getElementById('btn-add-friend');
    const { error } = await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: targetId, status: 'pending' }]);
    if (!error) { 
        btn.innerText = "Envoyé !"; btn.disabled = true; btn.className = "px-8 py-3 bg-gray-600 rounded-xl text-white font-bold text-sm cursor-default"; 
    } else if (error.code === '23505') { 
        alert("Invitation déjà envoyée !"); 
    } else {
        console.error(error);
    }
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.classList.toggle('hidden');
    if(!dropdown.classList.contains('hidden')) fetchNotifications();
}

async function addStory() {
    const text = prompt("Votre story :");
    if(text) await supabaseClient.from('stories').insert([{ user_id: currentUser.id, content_text: text }]);
    renderStoriesList();
}
async function renderStoriesList() {
    const container = document.getElementById('stories-container');
    let html = `<div onclick="addStory()" class="flex flex-col items-center space-y-1 cursor-pointer"><div class="w-14 h-14 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center hover:border-purple-500 transition-colors"><i data-lucide="plus" class="w-5 h-5 text-gray-400"></i></div><span class="text-[9px] text-gray-500">Ajouter</span></div>`;
    const { data } = await supabaseClient.from('stories').select('*, profiles(username)').order('created_at', { ascending: false });
    if(data) data.forEach(s => {
        const name = s.profiles ? s.profiles.username : "Ami";
        html += `<div onclick="alert('${s.content_text}')" class="flex flex-col items-center space-y-1 cursor-pointer"><div class="w-14 h-14 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-0.5"><div class="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-bold text-white">${name.substring(0,1).toUpperCase()}</div></div><span class="text-[9px] text-gray-400 truncate w-14 text-center">${name}</span></div>`;
    });
    container.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
