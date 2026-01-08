// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let currentUser = null;
let userProfile = null;
let activeChatUser = null; // Peut être un utilisateur ou un groupe
let jitsiApi = null;
let currentPublicProfileId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', checkSession);

// ==========================================
// 2. AUTHENTIFICATION & SESSION
// ==========================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadAppData();
        setupRealtime();
    } else {
        document.getElementById('login-page').classList.remove('hidden');
    }
}

async function loadUserProfile() {
    let { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (!data) {
        // Création du profil s'il n'existe pas
        const newProfile = { id: currentUser.id, email: currentUser.email, username: currentUser.email.split('@')[0], bio: "Nouveau membre" };
        await supabaseClient.from('profiles').insert([newProfile]);
        userProfile = newProfile;
    } else {
        userProfile = data;
    }
    updateUIProfile();
    // Mettre à jour le statut "En ligne"
    await supabaseClient.from('profiles').update({ status_updated_at: new Date() }).eq('id', currentUser.id);
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert(error.message); else location.reload();
}

async function handleSignUp() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) alert(error.message); else alert("Compte créé ! Connectez-vous.");
}

async function logout() { 
    await supabaseClient.auth.signOut(); 
    location.reload(); 
}

// ==========================================
// 3. NAVIGATION & UI
// ==========================================
function switchView(viewName) {
    // Cacher toutes les vues
    ['home', 'reels', 'bible', 'messages', 'profile', 'public-profile'].forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById('nav-' + v);
        if(btn) { btn.classList.remove('text-purple-400', 'scale-110'); btn.classList.add('text-gray-500'); }
    });
    
    // Afficher la vue cible
    const target = document.getElementById('view-' + viewName);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('animate-view');
    }
    
    // Activer le bouton
    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) { activeBtn.classList.remove('text-gray-500'); activeBtn.classList.add('text-purple-400', 'scale-110'); }

    // Chargements spécifiques
    if (viewName === 'reels') fetchReels();
    if (viewName === 'profile') { fetchMyGoals(); fetchMyFriends(); }
    if (viewName === 'home') fetchPosts();
}

async function loadAppData() {
    await Promise.all([fetchPosts(), renderStoriesList(), fetchMyGoals()]);
    lucide.createIcons();
}

function updateUIProfile() {
    document.querySelectorAll('#user-display, #profile-name').forEach(el => el.innerText = userProfile.username);
    document.getElementById('profile-email').innerText = "@" + userProfile.username;
    if(userProfile.avatar_url) {
        document.getElementById('profile-avatar-big').innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
        document.getElementById('current-user-avatar-small').innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
    }
}

// ==========================================
// 4. RECHERCHE & PROFILS PUBLICS (Amélioré)
// ==========================================
let searchTimeout = null;
function searchUsers(query) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const list = document.getElementById('search-results');
        if (query.length < 2) { list.classList.add('hidden'); return; }
        
        // Recherche dans les profils
        const { data } = await supabaseClient.from('profiles').select('id, username, avatar_url').ilike('username', `%${query}%`).limit(5);
        
        list.innerHTML = '';
        list.classList.remove('hidden');
        
        if(data && data.length > 0) {
            data.forEach(u => {
                if(u.id === currentUser.id) return;
                const avatar = u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username;
                list.insertAdjacentHTML('beforeend', `
                    <div onclick="openPublicProfile('${u.id}')" class="p-3 hover:bg-white/5 flex items-center gap-3 cursor-pointer border-b border-white/5">
                        <img src="${avatar}" class="w-8 h-8 rounded-full object-cover">
                        <span class="font-bold text-sm text-white">${u.username}</span>
                    </div>
                `);
            });
        } else {
            list.innerHTML = '<div class="p-3 text-xs text-gray-500 text-center">Aucun résultat</div>';
        }
    }, 300);
}

async function openPublicProfile(targetId) {
    if (targetId === currentUser.id) { switchView('profile'); return; }
    currentPublicProfileId = targetId;

    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', targetId).single();
    if (!profile) return alert("Profil introuvable");

    document.getElementById('view-public-profile').classList.remove('hidden');
    document.getElementById('search-results').classList.add('hidden'); 
    document.getElementById('search-input').value = '';

    // Remplissage UI
    document.getElementById('public-username').innerText = profile.username;
    document.getElementById('public-bio').innerText = profile.bio || "Pas de bio.";
    const avatarImg = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username;
    document.getElementById('public-avatar').innerHTML = `<img src="${avatarImg}" class="w-full h-full object-cover">`;

    // Gestion de la Story sur le profil public
    checkUserStory(targetId);

    // Vérifier l'amitié pour afficher les bons boutons
    checkFriendshipStatus(targetId);

    // Charger les posts
    fetchUserPublicPosts(targetId);
}

async function checkFriendshipStatus(targetId) {
    const container = document.getElementById('public-actions');
    container.innerHTML = '<div class="animate-spin w-4 h-4 border-2 border-white rounded-full"></div>';

    // Vérifier blocage
    const { data: blocked } = await supabaseClient.from('blocked_users').select('*').eq('blocker_id', currentUser.id).eq('blocked_id', targetId).maybeSingle();
    if(blocked) {
        container.innerHTML = `<button onclick="unblockUser('${targetId}')" class="px-6 py-2 bg-red-600 rounded-full font-bold text-sm">Débloquer</button>`;
        return;
    }

    const { data } = await supabaseClient.from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUser.id})`)
        .maybeSingle();

    let html = '';
    if (!data) {
        html = `<button onclick="sendFriendRequest('${targetId}')" class="px-6 py-2 bg-purple-600 rounded-full font-bold text-sm text-white shadow-lg">Ajouter</button>`;
    } else if (data.status === 'accepted') {
        const username = document.getElementById('public-username').innerText;
        html = `
            <button onclick="openDirectChat('${targetId}', '${username}')" class="px-6 py-2 bg-gray-700 rounded-full font-bold text-sm border border-white/20">Message</button>
        `;
    } else if (data.requester_id === currentUser.id) {
        html = `<button class="px-6 py-2 bg-gray-600 rounded-full font-bold text-sm opacity-50 cursor-not-allowed">Envoyée</button>`;
    } else {
        html = `<button onclick="acceptFriendRequest('${data.id}')" class="px-6 py-2 bg-green-600 rounded-full font-bold text-sm">Accepter</button>`;
    }
    container.innerHTML = html;
}

async function sendFriendRequest(targetId) {
    await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: targetId, status: 'pending' }]);
    checkFriendshipStatus(targetId);
}

// Charger les posts du profil public
async function fetchUserPublicPosts(userId) {
    const grid = document.getElementById('public-posts-grid');
    grid.innerHTML = '';
    
    // On récupère les posts normaux
    const { data: posts } = await supabaseClient.from('posts').select('image_url').eq('user_id', userId).not('image_url', 'is', null).limit(9);
    // On récupère les versets
    const { data: verses } = await supabaseClient.from('reels').select('video_url').eq('user_id', userId).limit(9);
    
    // Mélange simple
    const all = [...(posts || []).map(p=>p.image_url), ...(verses || []).map(v=>v.video_url)];
    
    all.forEach(url => {
        grid.insertAdjacentHTML('beforeend', `<div class="aspect-square bg-gray-800 rounded-lg overflow-hidden"><img src="${url}" class="w-full h-full object-cover"></div>`);
    });
}

// ==========================================
// 5. MESSAGERIE PRO (Appels, Images, Groupes)
// ==========================================
function closeChat() {
    document.getElementById('chat-detail').classList.add('hidden');
    document.getElementById('conversations-sidebar').classList.remove('hidden'); // Afficher liste sur mobile
    activeChatUser = null;
    if(jitsiApi) endVideoCall();
}

function openDirectChat(uid, uname) {
    activeChatUser = { id: uid, username: uname };
    document.getElementById('chat-with-name').innerText = uname;
    document.getElementById('chat-detail').classList.remove('hidden');
    document.getElementById('conversations-sidebar').classList.add('hidden'); // Cacher liste sur mobile
    
    // Vérification "En Ligne"
    checkUserOnlineStatus(uid);
    fetchMessages();
}

async function checkUserOnlineStatus(userId) {
    const statusDot = document.getElementById('chat-online-status');
    const statusText = document.getElementById('chat-status-text');
    
    // On regarde si status_updated_at < 5 min
    const { data } = await supabaseClient.from('profiles').select('status_updated_at').eq('id', userId).single();
    
    if(data && data.status_updated_at) {
        const lastSeen = new Date(data.status_updated_at);
        const now = new Date();
        const diffMinutes = (now - lastSeen) / 60000;
        
        if(diffMinutes < 5) {
            statusDot.classList.remove('hidden');
            statusText.innerText = "En ligne";
            statusText.classList.add('text-green-400');
        } else {
            statusDot.classList.add('hidden');
            statusText.innerText = "Hors ligne";
            statusText.classList.remove('text-green-400');
        }
    }
}

async function sendChatImage(input) {
    if (!input.files || !input.files[0] || !activeChatUser) return;
    const file = input.files[0];
    // On utilise le bucket post-images par simplicité
    const fileName = `chat/${currentUser.id}/${Date.now()}`;
    
    const btn = input.parentElement;
    btn.innerHTML = '<div class="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent"></div>';

    const { data } = await supabaseClient.storage.from('post-images').upload(fileName, file);
    const { data: urlData } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);
    
    await supabaseClient.from('messages').insert([{ 
        content: `[IMAGE]${urlData.publicUrl}`, 
        sender_id: currentUser.id, 
        receiver_id: activeChatUser.id 
    }]);
    
    // Reset l'icône
    btn.innerHTML = '<i data-lucide="image" class="w-5 h-5"></i><input type="file" id="chat-image-input" accept="image/*" hidden onchange="sendChatImage(this)">';
    lucide.createIcons();
    fetchMessages();
}

async function fetchMessages() {
    const list = document.getElementById('chat-history');
    if(!activeChatUser) return;
    
    const { data } = await supabaseClient.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
        
    list.innerHTML = '';
    if(data) {
        data.forEach(m => {
            const isMe = m.sender_id === currentUser.id;
            let contentHtml = m.content;
            
            if (m.content.startsWith('[IMAGE]')) {
                const url = m.content.replace('[IMAGE]', '');
                contentHtml = `<img src="${url}" class="rounded-lg max-w-[200px] border border-white/10 cursor-pointer" onclick="window.open('${url}')">`;
            }

            list.insertAdjacentHTML('beforeend', `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="${isMe ? 'bg-purple-600' : 'bg-gray-700'} px-4 py-2 rounded-xl text-sm max-w-[85%] break-words shadow-sm">
                        ${contentHtml}
                        <span class="text-[9px] opacity-50 block text-right mt-1">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            `);
        });
        list.scrollTop = list.scrollHeight;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    await supabaseClient.from('messages').insert([{ content: input.value, sender_id: currentUser.id, receiver_id: activeChatUser.id }]);
    input.value = '';
    fetchMessages();
}

// Appels Vidéo (Jitsi)
function startVideoCall() {
    if(!activeChatUser) return;
    const roomName = `faith-connect-call-${[currentUser.id, activeChatUser.id].sort().join('')}`;
    
    document.getElementById('video-call-container').classList.remove('hidden');
    document.getElementById('chat-history').classList.add('hidden'); // Cacher les messages pendant l'appel
    
    const domain = 'meet.jit.si';
    const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: document.querySelector('#jitsi-meet-frame'),
        userInfo: { displayName: userProfile.username },
        configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false },
        interfaceConfigOverwrite: { 
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'tileview'],
            SHOW_JITSI_WATERMARK: false 
        }
    };
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
    
    // Auto envoi message
    supabaseClient.from('messages').insert([{ content: "📞 Appel vidéo démarré", sender_id: currentUser.id, receiver_id: activeChatUser.id }]);
}

function endVideoCall() {
    if(jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
    document.getElementById('video-call-container').classList.add('hidden');
    document.getElementById('chat-history').classList.remove('hidden');
}

// Création de groupe
async function createGroup() {
    const name = document.getElementById('group-name-input').value;
    if(!name) return;
    await supabaseClient.from('chat_groups').insert([{ name: name, admin_id: currentUser.id }]);
    document.getElementById('create-group-modal').classList.add('hidden');
    alert("Groupe créé ! (Fonctionnalité en cours de déploiement)");
}

// Création de Page
async function createPage() {
    const name = document.getElementById('page-name-input').value;
    if(!name) return;
    await supabaseClient.from('pages').insert([{ name: name, owner_id: currentUser.id }]);
    document.getElementById('create-page-modal').classList.add('hidden');
    alert(`Page "${name}" créée avec succès !`);
}

// Chargement des conversations (Liste)
async function fetchConversations() {
    const list = document.getElementById('messages-list');
    if(!list) return;
    // ... Logique similaire à avant mais plus propre ...
    const { data: messages } = await supabaseClient.from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

    if(!messages || messages.length === 0) {
        list.innerHTML = '<div class="text-gray-500 text-center text-xs mt-4">Aucune discussion.</div>';
        return;
    }

    const uniqueConvs = {};
    messages.forEach(m => {
        const otherId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
        if(otherId && !uniqueConvs[otherId]) {
            uniqueConvs[otherId] = {
                id: otherId,
                lastMessage: m.content.startsWith('[IMAGE]') ? '📷 Image' : m.content,
                time: new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            };
        }
    });

    const convArray = Object.values(uniqueConvs);
    if(convArray.length > 0) {
        const ids = convArray.map(c => c.id);
        const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url').in('id', ids);
        
        list.innerHTML = convArray.map(c => {
            const p = profiles.find(pr => pr.id === c.id);
            const name = p ? p.username : "Utilisateur";
            const avatar = p && p.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-xs text-white">${name[0]}</div>`;
            return `
            <div onclick="openDirectChat('${c.id}', '${name}')" class="p-3 hover:bg-white/5 rounded-xl cursor-pointer flex items-center gap-3">
                ${avatar}
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between"><h4 class="font-bold text-sm text-white truncate">${name}</h4><span class="text-[9px] text-gray-500">${c.time}</span></div>
                    <p class="text-xs text-gray-400 truncate">${c.lastMessage}</p>
                </div>
            </div>`;
        }).join('');
    }
}

// ==========================================
// 6. FIL D'ACTUALITÉ INTELLIGENT (Amis + Découverte)
// ==========================================
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if(!container) return;
    container.innerHTML = '<div class="text-center py-10"><div class="animate-spin w-8 h-8 border-4 border-purple-500 rounded-full border-t-transparent mx-auto"></div></div>';

    // 1. Récupérer les ID des amis
    const { data: friendships } = await supabaseClient.from('friendships')
        .select('*')
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .eq('status', 'accepted');
        
    const friendIds = friendships ? friendships.map(f => f.requester_id === currentUser.id ? f.receiver_id : f.requester_id) : [];
    friendIds.push(currentUser.id); // On voit ses propres posts

    // 2. Récupérer les ID des gens bloqués pour ne pas les voir
    const { data: blocked } = await supabaseClient.from('blocked_users').select('blocked_id').eq('blocker_id', currentUser.id);
    const blockedIds = blocked ? blocked.map(b => b.blocked_id) : [];

    // 3. Récupérer TOUS les posts récents (On filtre après pour l'algo mixte)
    const { data: allPosts } = await supabaseClient.from('posts')
        .select('*, profiles:user_id(avatar_url)')
        .order('created_at', { ascending: false })
        .limit(60);

    container.innerHTML = '';
    if(!allPosts || allPosts.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-10">Aucune publication. Soyez le premier !</div>';
        return;
    }

    // 4. ALGORITHME DE TRI
    let friendsPosts = [];
    let discoveryPosts = [];

    allPosts.forEach(post => {
        if (blockedIds.includes(post.user_id)) return; // Ignorer bloqués

        if (friendIds.includes(post.user_id)) {
            friendsPosts.push(post);
        } else {
            discoveryPosts.push(post);
        }
    });

    // On prend max 10 posts de découverte
    discoveryPosts = discoveryPosts.slice(0, 10);

    // On fusionne et on trie par date
    const finalFeed = [...friendsPosts, ...discoveryPosts].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    finalFeed.forEach(post => {
        const isMe = post.user_id === currentUser.id;
        const avatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.user_name}`;
        const isDiscovery = !friendIds.includes(post.user_id); // Tag pour les inconnus

        container.insertAdjacentHTML('beforeend', `
            <div class="premium-card rounded-2xl p-4 animate-view mb-4 relative">
                ${isDiscovery ? '<span class="absolute top-2 right-2 text-[9px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Suggestion</span>' : ''}
                
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="openPublicProfile('${post.user_id}')">
                        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border-2 border-purple-500/20">
                        <div>
                            <h3 class="font-bold text-sm text-white">${post.user_name}</h3>
                            <p class="text-[10px] text-gray-500">${new Date(post.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                    ${isMe ? `
                        <div class="flex gap-2">
                            <button onclick="editPost('${post.id}')" class="text-gray-500 hover:text-blue-400"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                            <button onclick="deletePost('${post.id}')" class="text-gray-500 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    ` : ''}
                </div>
                <p class="text-gray-200 text-sm mb-3 whitespace-pre-wrap">${post.content}</p>
                ${post.image_url ? `<div class="rounded-xl overflow-hidden border border-white/5 mb-3"><img src="${post.image_url}" class="w-full h-auto"></div>` : ''}
                
                <div class="flex gap-4 border-t border-white/10 pt-3">
                    <button onclick="toggleAmen('${post.id}')" class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-pink-500 transition-colors"><i data-lucide="heart" class="w-4 h-4"></i> Amen</button>
                    <button class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-400"><i data-lucide="message-square" class="w-4 h-4"></i> Commenter</button>
                    <button onclick="sharePost('${post.content}')" class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white ml-auto"><i data-lucide="share-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `);
    });
    lucide.createIcons();
}

// Création de post
let selectedImageFile = null;
function handleImageSelect(input) {
    if(input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(selectedImageFile);
    }
}
function removeImage() {
    selectedImageFile = null;
    document.getElementById('post-image-file').value = "";
    document.getElementById('image-preview-container').classList.add('hidden');
}

async function publishPost() {
    const content = document.getElementById('new-post-input').value;
    const btn = document.getElementById('btn-publish');
    
    if(!content && !selectedImageFile) return alert("Écrivez quelque chose !");
    
    btn.innerText = "..."; btn.disabled = true;
    
    try {
        let imageUrl = null;
        if (selectedImageFile) {
            const fileName = `${currentUser.id}/${Date.now()}`;
            await supabaseClient.storage.from('post-images').upload(fileName, selectedImageFile);
            const { data } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }
        
        await supabaseClient.from('posts').insert([{
            user_id: currentUser.id,
            user_name: userProfile.username,
            avatar_initials: userProfile.username[0],
            content: content,
            image_url: imageUrl
        }]);
        
        document.getElementById('new-post-input').value = "";
        removeImage();
        fetchPosts();
    } catch (e) {
        alert("Erreur: " + e.message);
    } finally {
        btn.innerText = "Publier"; btn.disabled = false;
    }
}

async function deletePost(id) {
    if(confirm("Supprimer ce post ?")) {
        await supabaseClient.from('posts').delete().eq('id', id);
        fetchPosts();
    }
}

async function editPost(id) {
    const newContent = prompt("Modifier le texte :");
    if(newContent) {
        await supabaseClient.from('posts').update({ content: newContent }).eq('id', id);
        fetchPosts();
    }
}

function sharePost(text) {
    if(navigator.share) {
        navigator.share({ title: 'Faith Connect', text: text });
    } else {
        navigator.clipboard.writeText(text);
        alert("Texte copié !");
    }
}

// ==========================================
// 7. OBJECTIFS PERSONNELS
// ==========================================
async function fetchMyGoals() {
    const list = document.getElementById('goals-list');
    const { data: goals } = await supabaseClient.from('goals').select('*').eq('user_id', currentUser.id).order('created_at');
    
    list.innerHTML = '';
    if(goals && goals.length > 0) {
        goals.forEach(g => {
            const style = g.is_completed ? 'line-through text-gray-500' : 'text-white';
            list.insertAdjacentHTML('beforeend', `
                <div class="flex items-center gap-2 p-2 bg-black/20 rounded-lg hover:bg-black/40 transition-colors">
                    <input type="checkbox" ${g.is_completed ? 'checked' : ''} onchange="toggleGoal('${g.id}', this.checked)" class="accent-purple-500 w-4 h-4 cursor-pointer">
                    <span class="text-sm ${style} flex-1">${g.content}</span>
                    <button onclick="deleteGoal('${g.id}')" class="text-red-400 hover:text-red-300 px-2">x</button>
                </div>
            `);
        });
    } else {
        list.innerHTML = '<div class="text-xs text-gray-500 italic">Aucun objectif défini.</div>';
    }
}

async function addGoal() {
    const text = prompt("Nouvel objectif spirituel (ex: Lire Psaume 23) :");
    if(text) {
        await supabaseClient.from('goals').insert([{ user_id: currentUser.id, content: text }]);
        fetchMyGoals();
    }
}

async function toggleGoal(id, status) {
    await supabaseClient.from('goals').update({ is_completed: status }).eq('id', id);
    fetchMyGoals(); // Rafraîchir pour le style barré
}

async function deleteGoal(id) {
    if(confirm("Supprimer ?")) {
        await supabaseClient.from('goals').delete().eq('id', id);
        fetchMyGoals();
    }
}

// ==========================================
// 8. SÉCURITÉ & PARAMÈTRES
// ==========================================
async function changePassword() {
    const newPass = prompt("Nouveau mot de passe (min 6 caractères) :");
    if(newPass && newPass.length >= 6) {
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if(error) alert("Erreur: " + error.message);
        else alert("Mot de passe mis à jour !");
    } else if (newPass) {
        alert("Le mot de passe est trop court.");
    }
}

async function reportUser() {
    const reason = prompt("Pourquoi signalez-vous cet utilisateur ?");
    if(reason && currentPublicProfileId) {
        await supabaseClient.from('reports').insert([{
            reporter_id: currentUser.id,
            target_id: currentPublicProfileId,
            type: 'user',
            reason: reason
        }]);
        alert("Signalement reçu. Nous allons examiner cela.");
    }
}

async function blockUser() {
    if(confirm("Voulez-vous vraiment bloquer cet utilisateur ? Vous ne verrez plus ses posts.") && currentPublicProfileId) {
        await supabaseClient.from('blocked_users').insert([{
            blocker_id: currentUser.id,
            blocked_id: currentPublicProfileId
        }]);
        alert("Utilisateur bloqué.");
        switchView('home');
    }
}

async function unblockUser(targetId) {
    await supabaseClient.from('blocked_users').delete().match({ blocker_id: currentUser.id, blocked_id: targetId });
    alert("Utilisateur débloqué.");
    openPublicProfile(targetId);
}

// ==========================================
// 9. VERSETS CRÉATIFS (Le code du Canvas que tu avais déjà)
// ==========================================
let canvas, ctx, currentBgType = 'color', uploadedBgImage = null;

function openVerseEditor() { document.getElementById('verse-editor-modal').classList.remove('hidden'); initCanvas(); }
function closeVerseEditor() { document.getElementById('verse-editor-modal').classList.add('hidden'); }

function initCanvas() {
    canvas = document.getElementById('verse-canvas');
    if(canvas) {
        ctx = canvas.getContext('2d');
        drawCanvas();
    }
}

function setBackground(type, val) {
    currentBgType = type; 
    if(type === 'color') { ctx.fillStyle = val; ctx.fillRect(0,0,600,600); drawText(); }
}

function handleBgUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedBgImage = new Image();
            uploadedBgImage.onload = function() { currentBgType = 'image'; drawCanvas(); };
            uploadedBgImage.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function drawCanvas() {
    if(!ctx) return;
    ctx.clearRect(0,0,600,600);
    if(currentBgType === 'color') { ctx.fillStyle = '#1f2937'; ctx.fillRect(0,0,600,600); }
    else if(currentBgType === 'image' && uploadedBgImage) { ctx.drawImage(uploadedBgImage, 0,0,600,600); }
    drawText();
}

function drawText() {
    const text = document.getElementById('verse-text-input').value || "Votre texte ici...";
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, text, 300, 300, 560, 50);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';
    var lines = [];
    for(var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = context.measureText(testLine);
      var testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) { lines.push(line); line = words[n] + ' '; }
      else { line = testLine; }
    }
    lines.push(line);
    let startY = y - ((lines.length - 1) * lineHeight) / 2;
    for(let k = 0; k < lines.length; k++) context.fillText(lines[k], x, startY + (k * lineHeight));
}

async function publishVerseCard() {
    const caption = document.getElementById('verse-text-input').value;
    const btn = document.getElementById('btn-publish-verse');
    btn.innerText = "Création...";
    
    canvas.toBlob(async (blob) => {
        const fileName = `${currentUser.id}/${Date.now()}.png`;
        await supabaseClient.storage.from('verse-images').upload(fileName, blob);
        const { data } = supabaseClient.storage.from('verse-images').getPublicUrl(fileName);
        await supabaseClient.from('reels').insert([{ user_id: currentUser.id, video_url: data.publicUrl, caption: caption }]);
        closeVerseEditor();
        fetchReels();
        btn.innerText = "Publier";
    });
}

async function fetchReels() {
    const container = document.getElementById('reels-container');
    const { data } = await supabaseClient.from('reels').select('*').order('created_at', { ascending: false });
    container.innerHTML = '';
    if(data) {
        data.forEach(r => {
            container.insertAdjacentHTML('beforeend', `
            <div class="bg-gray-800 rounded-xl overflow-hidden border border-white/10 relative group shadow-lg">
                <img src="${r.video_url}" class="w-full h-auto cursor-pointer" onclick="shareImage('${r.video_url}')">
                <div class="p-2 flex justify-between items-center bg-gray-900/90">
                    <p class="text-xs text-white truncate max-w-[70%]">${r.caption}</p>
                    <button onclick="shareImage('${r.video_url}')" class="text-purple-400"><i data-lucide="share-2" class="w-4 h-4"></i></button>
                </div>
            </div>`);
        });
        lucide.createIcons();
    }
}

// ==========================================
// 10. STORIES & Partage Image
// ==========================================
async function uploadStory(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const fileName = `${currentUser.id}/${Date.now()}`;
    await supabaseClient.storage.from('story-images').upload(fileName, file);
    const { data } = supabaseClient.storage.from('story-images').getPublicUrl(fileName);
    await supabaseClient.from('stories').insert([{ user_id: currentUser.id, image_url: data.publicUrl }]);
    renderStoriesList();
}

async function renderStoriesList() {
    const container = document.getElementById('stories-container');
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours() - 24);
    const { data: stories } = await supabaseClient.from('stories').select('user_id, profiles(username, avatar_url)').gt('created_at', yesterday.toISOString());
    
    const uniqueUsers = {};
    if(stories) {
        stories.forEach(s => { if(!uniqueUsers[s.user_id]) uniqueUsers[s.user_id] = s.profiles; });
    }

    let html = `<div onclick="document.getElementById('btn-add-story-input').click()" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center relative"><i data-lucide="plus" class="w-6 h-6 text-gray-400"></i></div><span class="text-[10px] text-gray-300">Ma Story</span></div>`;
    
    Object.keys(uniqueUsers).forEach(uid => {
        if(uid === currentUser.id) return;
        const u = uniqueUsers[uid];
        const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`;
        html += `<div onclick="viewUserStory('${uid}')" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-16 h-16 rounded-full story-ring p-[2px]"><img src="${avatar}" class="w-full h-full rounded-full border-2 border-gray-900 object-cover"></div><span class="text-[10px] text-gray-300 truncate w-14 text-center">${u.username}</span></div>`;
    });
    container.innerHTML = html;
    lucide.createIcons();
}

// Voir story d'un user
async function viewUserStory(targetId) {
    const uid = targetId || currentPublicProfileId;
    if(!uid) return;

    const yesterday = new Date(); yesterday.setHours(yesterday.getHours() - 24);
    const { data: stories } = await supabaseClient.from('stories').select('*').eq('user_id', uid).gt('created_at', yesterday.toISOString());
    
    if(stories && stories.length > 0) {
        const story = stories[stories.length - 1];
        document.getElementById('story-viewer-image').src = story.image_url;
        document.getElementById('story-viewer-name').innerText = "Story";
        document.getElementById('story-viewer').classList.remove('hidden');
        setTimeout(closeStoryViewer, 5000);
        const progress = document.getElementById('story-progress');
        progress.style.width = '0%';
        setTimeout(() => { progress.style.transition = 'width 5s linear'; progress.style.width = '100%'; }, 50);
    } else {
        alert("Pas de story récente.");
    }
}

function checkUserStory(userId) {
    const ring = document.getElementById('public-story-ring');
    ring.classList.add('hidden');
    // On pourrait faire un fetch ici pour vérifier si story active
}

function closeStoryViewer() { document.getElementById('story-viewer').classList.add('hidden'); }

// Partage Image (Canvas & Versets)
async function shareImage(url) {
    const btn = document.activeElement; 
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<div class="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>';
    
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], "verset-faithconnect.png", { type: "image/png" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Verset Faith Connect' });
        } else {
            throw new Error('Partage natif non supporté');
        }
    } catch (error) {
        const a = document.createElement('a');
        a.href = url;
        a.download = "verset.png"; 
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        alert("Image téléchargée !");
    } finally {
        btn.innerHTML = originalIcon;
    }
}

// ==========================================
// 11. REALTIME & AMIS
// ==========================================
function setupRealtime() {
    supabaseClient.channel('global')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if(activeChatUser && (payload.new.sender_id === activeChatUser.id || payload.new.receiver_id === activeChatUser.id)) {
            fetchMessages();
        } else if(payload.new.receiver_id === currentUser.id) {
            // Notification visuelle
            const badge = document.getElementById('msg-badge');
            if(badge) badge.classList.remove('hidden');
        }
    })
    .subscribe();
}

async function fetchMyFriends() {
    const list = document.getElementById('profile-social-list');
    if(!list) return;
    const { data: friendships } = await supabaseClient.from('friendships').select('*').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).eq('status', 'accepted');
    
    list.innerHTML = '';
    if(friendships && friendships.length > 0) {
        const ids = friendships.map(f => f.requester_id === currentUser.id ? f.receiver_id : f.requester_id);
        const { data: profiles } = await supabaseClient.from('profiles').select('*').in('id', ids);
        
        profiles.forEach(p => {
            const avatar = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`;
            list.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between bg-gray-800 p-3 rounded-xl mb-2">
                    <div class="flex items-center gap-3">
                        <img src="${avatar}" class="w-8 h-8 rounded-full">
                        <span class="text-sm font-bold text-white">${p.username}</span>
                    </div>
                    <button onclick="openDirectChat('${p.id}', '${p.username}')" class="text-purple-400"><i data-lucide="message-circle" class="w-5 h-5"></i></button>
                </div>
            `);
        });
    } else {
        list.innerHTML = '<div class="text-center text-xs text-gray-500">Pas encore d\'amis.</div>';
    }
    lucide.createIcons();
}
