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

    // Logique spécifique par vue
    if (viewName === 'live') fetchLiveMessages();
    if (viewName === 'messages') {
        document.getElementById('msg-badge').classList.add('hidden');
        if(!activeChatUser) resetChat();
    }
    // C'EST ICI QUE CA BLOQUAIT : J'ai vérifié que switchProfileTab existe bien plus bas
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
// 4. PROFIL (STATUT)
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
    document.querySelectorAll('#user-initials, #current-user-avatar-small, #profile-avatar-big').forEach(el => el.innerText = initials);
    if(document.getElementById('profile-email')) document.getElementById('profile-email').innerText = "@" + userProfile.username;
    
    const textDisplay = document.getElementById('status-text-display');
    const emojiDisplay = document.getElementById('status-emoji-display');
    if (textDisplay && emojiDisplay) {
        textDisplay.innerText = userProfile.status_text || "Ajouter un statut...";
        emojiDisplay.innerText = userProfile.status_emoji || "👋";
    }
}

// ==========================================
// 5. GESTION DES AMIS (CETTE SECTION ÉTAIT MANQUANTE/CASSÉE)
// ==========================================

async function switchProfileTab(tabName) {
    const btnFriends = document.getElementById('tab-friends');
    const btnRequests = document.getElementById('tab-requests');
    const container = document.getElementById('profile-social-list');
    
    // Sécurité si les éléments n'existent pas encore
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
        const initials = p.username.substring(0,2).toUpperCase();
        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-2xl border border-white/5 animate-fade-in mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">${initials}</div>
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
        container.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-white/5 animate-fade-in mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs">${p.username.substring(0,2).toUpperCase()}</div>
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

// --- MODALE MODIFIER PROFIL ---
function openEditModal() { 
    document.getElementById('edit-profile-modal').classList.remove('hidden'); 
    document.getElementById('edit-username').value = userProfile.username; 
    document.getElementById('edit-bio').value = userProfile.bio; 
}

function closeEditModal() { 
    document.getElementById('edit-profile-modal').classList.add('hidden'); 
}

async function saveProfile() {
    const newUsername = document.getElementById('edit-username').value;
    const newBio = document.getElementById('edit-bio').value;
    if (!newUsername.trim()) return alert("Pseudo requis");

    const { error } = await supabaseClient.from('profiles').update({ username: newUsername, bio: newBio }).eq('id', currentUser.id);
    if (!error) {
        userProfile.username = newUsername;
        userProfile.bio = newBio;
        updateUIProfile();
        closeEditModal();
        alert("Profil mis à jour !");
    } else {
        alert(error.message);
    }
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
        const { data: profiles } = await supabaseClient.from('profiles').select('id, username').in('id', ids);
        if(profiles) profiles.forEach(p => { const c = conversationArray.find(x => x.userId === p.id); if(c) { c.name = p.username; c.initials = p.username.substring(0,2).toUpperCase(); }});
    }
    container.innerHTML = conversationArray.map(conv => `
        <div onclick="openDirectChat('${conv.userId}', '${conv.name.replace(/'/g, "\\'")}')" class="p-3 hover:bg-white/5 rounded-xl cursor-pointer flex items-center space-x-3 transition-colors border-b border-white/5">
            <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${conv.initials}</div>
            <div class="flex-1 min-w-0"><div class="flex justify-between items-baseline mb-0.5"><h4 class="font-bold text-sm text-white truncate">${conv.name}</h4><span class="text-[10px] text-gray-500">${conv.time}</span></div><p class="text-xs text-gray-400 truncate">${conv.lastMessage}</p></div>
        </div>`).join('');
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
// 7. GESTION DU LIVE (STREAM & CHAT)
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
// 8. FONCTIONS GÉNÉRALES (RECHERCHE, POSTS, PRIÈRES)
// ==========================================

async function searchUsers(query) {
    const resultBox = document.getElementById('search-results');
    if (!query || query.length < 2) { resultBox.classList.add('hidden'); return; }
    const { data } = await supabaseClient.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(5);
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = (data && data.length > 0) ? data.map(u => `
        <div onclick="openUserProfile('${u.id}')" class="p-3 border-b border-white/5 flex justify-between items-center hover:bg-white/5 cursor-pointer">
            <div class="flex items-center gap-3"><div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold text-[10px] text-white">${u.username.substring(0,2).toUpperCase()}</div><span class="text-sm font-bold text-white">${u.username}</span></div><i data-lucide="chevron-right" class="w-4 h-4 text-gray-500"></i>
        </div>`).join('') : '<div class="p-3 text-gray-500 text-xs text-center italic">Aucun utilisateur trouvé</div>';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function openUserProfile(userId) {
    if(userId === currentUser.id) { switchView('profile'); return; }
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if(profile) {
        document.getElementById('public-username').innerText = profile.username;
        document.getElementById('public-bio').innerText = profile.bio || "Pas de bio.";
        document.getElementById('public-avatar').innerText = profile.username.substring(0,2).toUpperCase();
        document.getElementById('btn-message').onclick = () => startChat(profile);
        document.getElementById('btn-add-friend').onclick = () => addFriend(profile.id);
        switchView('public-profile');
    }
}

async function fetchPosts() {
    const { data } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('posts-container');
    if(!container) return;
    container.innerHTML = ''; 
    if (data) data.forEach(post => {
        container.insertAdjacentHTML('beforeend', `
            <div class="bg-gray-800/30 rounded-2xl p-4 border border-white/5 mb-4 animate-fade-in">
                <div class="flex items-center space-x-3 mb-3"><div class="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-lg">${post.avatar_initials || "??"}</div><div><h3 class="font-bold text-white text-sm">${post.user_name}</h3><p class="text-[10px] text-gray-500">${new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div></div><p class="text-gray-300 text-sm leading-relaxed">${post.content}</p><div class="border-t border-white/5 mt-3 pt-3 flex gap-4 text-gray-500"><button class="hover:text-pink-400 transition-colors"><i data-lucide="heart" class="w-4 h-4"></i></button></div>
            </div>`);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function publishPost() {
    const input = document.getElementById('new-post-input');
    if (!input.value.trim()) return;
    await supabaseClient.from('posts').insert([{ user_id: currentUser.id, content: input.value, user_name: userProfile.username, avatar_initials: userProfile.username.substring(0,2).toUpperCase() }]);
    input.value = ''; fetchPosts();
}

// --- PRIÈRES ---
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
// 9. SYSTÈME TEMPS RÉEL (REALTIME)
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
// 10. NOTIFICATIONS ET UTILITAIRES
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
    // CORRECTION DU BUG 409 ICI
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
