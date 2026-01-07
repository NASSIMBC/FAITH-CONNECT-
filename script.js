// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. VARIABLES GLOBALES & INITIALISATION
// ==========================================
let currentUser = null;
let userProfile = null;
let activeChatUser = null; 
let selectedImageFile = null;      
let selectedAvatarFile = null;     
let currentStoryTimer = null;

document.addEventListener('DOMContentLoaded', checkSession);

// Gestion de la touche Entrée pour Chat et Commentaires
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        // Pour le Chat
        if (document.activeElement.id === 'chat-input') {
            e.preventDefault();
            sendChatMessage();
        }
        // Pour les Commentaires
        if (document.activeElement.id.startsWith('input-comment-')) {
            e.preventDefault();
            const postId = document.activeElement.id.replace('input-comment-', '');
            sendComment(postId);
        }
    }
});

// ==========================================
// 3. AUTHENTIFICATION & PROFIL
// ==========================================

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
            status_text: "En ligne", 
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

async function logout() { 
    await supabaseClient.auth.signOut(); 
    location.reload(); 
}

function updateUIProfile() {
    const initials = userProfile.username ? userProfile.username.substring(0, 2).toUpperCase() : "??";
    
    // Mettre à jour tous les endroits où le nom apparaît
    document.querySelectorAll('#profile-name, #public-username').forEach(el => el.innerText = userProfile.username);
    
    const emailEl = document.getElementById('profile-email');
    if(emailEl) emailEl.innerText = "@" + userProfile.username;
    
    const textDisplay = document.getElementById('status-text-display');
    const emojiDisplay = document.getElementById('status-emoji-display');
    if (textDisplay && emojiDisplay) {
        textDisplay.innerText = userProfile.status_text || "Mon statut...";
        emojiDisplay.innerText = userProfile.status_emoji || "👋";
    }

    // Gestion de l'avatar principal
    const avatarContainer = document.getElementById('profile-avatar-big');
    if(avatarContainer) {
        if (userProfile.avatar_url) {
            avatarContainer.innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
        } else {
            avatarContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white text-3xl font-bold">${initials}</div>`;
        }
    }

    // Gestion du petit avatar (input post)
    const smallAvatar = document.getElementById('current-user-avatar-small');
    if(smallAvatar) {
        if(userProfile.avatar_url) {
            smallAvatar.innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
        } else {
            smallAvatar.innerText = initials;
        }
    }
}

async function updateMyStatus() {
    const text = prompt("Ton humeur actuelle ?");
    if (text === null) return; 
    const emoji = prompt("Un emoji ?", "😊");
    const { error } = await supabaseClient.from('profiles').update({ 
        status_text: text, 
        status_emoji: emoji || "👋" 
    }).eq('id', currentUser.id);
    
    if (error) alert("Erreur : " + error.message);
    else { 
        userProfile.status_text = text; 
        userProfile.status_emoji = emoji || "👋"; 
        updateUIProfile(); 
    }
}

// --- MODAL EDITION PROFIL ---
function openEditModal() { 
    document.getElementById('edit-profile-modal').classList.remove('hidden'); 
    document.getElementById('edit-username').value = userProfile.username; 
    document.getElementById('edit-bio').value = userProfile.bio; 
    const preview = document.getElementById('edit-avatar-preview');
    if (userProfile.avatar_url) preview.src = userProfile.avatar_url;
    else preview.src = `https://ui-avatars.com/api/?name=${userProfile.username}&background=random`;
    selectedAvatarFile = null;
}

function closeEditModal() { document.getElementById('edit-profile-modal').classList.add('hidden'); }

function handleAvatarPreview(input) {
    if (input.files && input.files[0]) {
        selectedAvatarFile = input.files[0];
        const reader = new FileReader();
        reader.onload = e => document.getElementById('edit-avatar-preview').src = e.target.result;
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveProfile() {
    const newUsername = document.getElementById('edit-username').value;
    const newBio = document.getElementById('edit-bio').value;
    
    if (!newUsername.trim()) return alert("Pseudo requis");
    
    try {
        let finalAvatarUrl = userProfile.avatar_url; 
        if (selectedAvatarFile) {
            const fileName = `${currentUser.id}/${Date.now()}`;
            const { error } = await supabaseClient.storage.from('avatars').upload(fileName, selectedAvatarFile);
            if(error) throw error;
            const { data } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            finalAvatarUrl = data.publicUrl;
        }
        
        await supabaseClient.from('profiles').update({ 
            username: newUsername, 
            bio: newBio, 
            avatar_url: finalAvatarUrl 
        }).eq('id', currentUser.id);
        
        userProfile.username = newUsername; 
        userProfile.bio = newBio; 
        userProfile.avatar_url = finalAvatarUrl;
        
        updateUIProfile(); 
        closeEditModal();
        alert("Profil mis à jour !");
    } catch (e) { 
        alert("Erreur: " + e.message); 
    }
}

// ==========================================
// 4. NAVIGATION & CHARGEMENT
// ==========================================

function switchView(viewName) {
    const views = ['home', 'reels', 'live', 'messages', 'profile', 'public-profile'];
    
    // Cacher toutes les vues et désactiver les boutons
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
        const btn = document.getElementById('nav-' + v);
        if(btn) btn.classList.replace('text-purple-400', 'text-gray-500');
    });

    // Afficher la vue cible et activer son bouton
    const target = document.getElementById('view-' + viewName);
    if(target) target.classList.remove('hidden');
    
    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) activeBtn.classList.replace('text-gray-500', 'text-purple-400');

    // Actions spécifiques par vue
    if (viewName === 'live') fetchLiveMessages();
    if (viewName === 'reels') fetchReels();
    if (viewName === 'profile') switchProfileTab('friends'); 
    
    if (viewName === 'messages') {
        document.getElementById('msg-badge').classList.add('hidden');
        if(!activeChatUser) resetChat();
    } else {
        // Si on quitte les messages, on désélectionne l'utilisateur actif sauf si on va sur son profil public
        if(viewName !== 'public-profile') activeChatUser = null;
    }
}

async function loadAppData() {
    await Promise.all([
        fetchPosts(),
        renderStoriesList(),
        loadConversations(),
        fetchNotifications(),
        fetchPrayers()
    ]);
    subscribeToRealtime();
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 5. GESTION DES POSTS (CORE FEATURE)
// ==========================================

function handleImageSelect(input) {
    if (input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('image-preview').src = e.target.result; 
            document.getElementById('image-preview-container').classList.remove('hidden'); 
        };
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
    const content = input.value;
    const btn = document.getElementById('btn-publish');

    if (!content.trim() && !selectedImageFile) return alert("Le post est vide !");
    
    btn.innerHTML = '...'; 
    btn.disabled = true;

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
            content: content, 
            user_name: userProfile.username, 
            image_url: imageUrl 
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

async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if(!container) return;
    
    try {
        const friendIds = await getFriendIds();
        
        // On récupère les posts et les profils liés
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*, profiles:user_id(avatar_url)')
            .in('user_id', friendIds)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // On récupère TOUS les likes pour faire le tri côté client (plus robuste)
        const { data: allLikes } = await supabaseClient.from('likes').select('post_id, user_id');
        
        container.innerHTML = (posts || []).map(post => {
            const isMyPost = post.user_id === currentUser.id;
            const postLikes = (allLikes || []).filter(l => l.post_id === post.id);
            const isAmened = postLikes.some(l => l.user_id === currentUser.id);
            
            // Gestion Avatar Post
            const avatarUrl = post.profiles?.avatar_url;
            const avatarHtml = avatarUrl 
                ? `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-white/10">`
                : `<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-xs">${post.user_name.substring(0,2).toUpperCase()}</div>`;

            // Classe CSS pour le coeur
            const heartClass = isAmened ? 'fill-pink-500 text-pink-500' : 'text-gray-500';
            const btnClass = isAmened ? 'text-pink-500 font-bold' : 'text-gray-500';

            return `
                <div class="bg-gray-800/30 rounded-[2rem] p-5 border border-white/5 mb-4 animate-fade-in" id="post-${post.id}">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            ${avatarHtml}
                            <div>
                                <h3 class="font-bold text-white text-sm uppercase">${post.user_name}</h3>
                                <p class="text-[10px] text-gray-500 uppercase font-bold">Il y a un instant</p>
                            </div>
                        </div>
                        ${isMyPost ? `<button onclick="deletePost('${post.id}')" class="p-2 text-gray-600 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                    </div>
                    
                    <p class="text-gray-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">${post.content}</p>
                    
                    ${post.image_url ? `<img src="${post.image_url}" class="w-full rounded-2xl border border-white/5 mb-4 object-cover max-h-96">` : ''}
                    
                    <div class="flex gap-6 border-t border-white/5 pt-4">
                        <button onclick="toggleAmen('${post.id}')" class="${btnClass} flex items-center gap-2 text-xs transition-all">
                            <i data-lucide="heart" class="w-4 h-4 ${heartClass}"></i> 
                            ${postLikes.length > 0 ? postLikes.length + ' ' : ''}AMEN
                        </button>
                        <button onclick="toggleComments('${post.id}')" class="text-gray-500 hover:text-purple-400 flex items-center gap-2 text-xs transition-all">
                            <i data-lucide="message-circle" class="w-4 h-4"></i> COMMENTER
                        </button>
                    </div>
                    
                    <div id="comments-section-${post.id}" class="hidden mt-4 pt-4 border-t border-white/5 bg-black/10 rounded-2xl p-4">
                        <div id="comments-list-${post.id}" class="space-y-3 mb-4 max-h-40 overflow-y-auto scrollbar-hide"></div>
                        <div class="flex gap-2">
                            <input type="text" id="input-comment-${post.id}" placeholder="Votre message..." class="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500">
                            <button onclick="sendComment('${post.id}')" class="text-purple-400 font-black text-xs uppercase hover:text-white transition-colors">Envoyer</button>
                        </div>
                    </div>
                </div>`;
        }).join('');
        
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { 
        console.error("Erreur Posts:", e); 
    }
}

async function deletePost(id) {
    if(!confirm("Voulez-vous vraiment supprimer ce post ?")) return;

    try {
        // 1. Nettoyage Storage (Si image)
        const { data: post } = await supabaseClient.from('posts').select('image_url').eq('id', id).single();
        if (post && post.image_url) {
            const fileName = post.image_url.split('/').pop();
            await supabaseClient.storage.from('post-images').remove([`${currentUser.id}/${fileName}`]);
        }

        // 2. Suppression BDD
        const { error } = await supabaseClient.from('posts').delete().eq('id', id).eq('user_id', currentUser.id);
        
        if(!error) { 
            const el = document.getElementById(`post-${id}`);
            if(el) el.remove();
        } else { 
            throw error; 
        }
    } catch (e) {
        alert("Erreur suppression : " + e.message);
    }
}

async function toggleAmen(postId) {
    // Vérif si déjà liké
    const { data } = await supabaseClient.from('likes').select('*').match({ post_id: postId, user_id: currentUser.id });
    
    if (data && data.length > 0) {
        // Unlike
        await supabaseClient.from('likes').delete().match({ post_id: postId, user_id: currentUser.id });
    } else {
        // Like
        await supabaseClient.from('likes').insert({ post_id: postId, user_id: currentUser.id });
    }
    fetchPosts(); // Rafraîchir pour voir le coeur changer
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    const list = document.getElementById(`comments-list-${postId}`);
    
    section.classList.toggle('hidden');
    
    if (!section.classList.contains('hidden')) {
        list.innerHTML = '<div class="text-center text-[10px] text-gray-500">Chargement...</div>';
        
        const { data: comments } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
            
        if(comments && comments.length > 0) {
            list.innerHTML = comments.map(c => `
                <div class="text-xs text-gray-300 animate-fade-in">
                    <span class="font-bold text-purple-400 uppercase mr-1">${c.user_name}:</span>
                    ${c.content}
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-[10px] text-gray-600 italic text-center">Soyez le premier à répondre.</p>';
        }
    }
}

async function sendComment(postId) {
    const input = document.getElementById(`input-comment-${postId}`);
    const content = input.value.trim();
    
    if(!content) return;
    
    // Optimistic UI : On vide l'input tout de suite
    input.value = '';
    
    const { error } = await supabaseClient.from('comments').insert([{ 
        post_id: postId, 
        user_id: currentUser.id, 
        user_name: userProfile.username, 
        content: content 
    }]);
    
    if(!error) { 
        // On force le rechargement de la section commentaire
        const section = document.getElementById(`comments-section-${postId}`);
        section.classList.add('hidden'); // Ferme
        toggleComments(postId); // Rouvre (ce qui recharge)
    } else { 
        alert("Erreur commentaire : " + error.message); 
    }
}

// ==========================================
// 6. CHAT & MESSAGERIE (CORRIGÉ)
// ==========================================

function openDirectChat(userId, username) {
    startChat({ id: userId, username: username });
    
    // Sur mobile, on change de vue
    if(window.innerWidth < 768) {
        document.getElementById('conversations-sidebar').classList.add('hidden');
        document.getElementById('chat-detail').classList.remove('hidden');
        document.getElementById('chat-detail').classList.add('flex');
    }
}

async function loadConversations() {
    const container = document.getElementById('messages-list');
    if(!container) return;
    
    const { data: messages } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
    
    if (!messages || messages.length === 0) { 
        container.innerHTML = '<div class="text-gray-500 text-center mt-10 text-xs italic">Aucune discussion.</div>'; 
        return; 
    }
    
    const uniqueIds = new Set();
    const conversationArray = [];
    
    messages.forEach(msg => {
        const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        if (otherId && !uniqueIds.has(otherId)) {
            uniqueIds.add(otherId);
            conversationArray.push({ id: otherId, lastMsg: msg.content });
        }
    });

    // Récupérer les infos des profils
    const profilesIds = conversationArray.map(c => c.id);
    const { data: profiles } = await supabaseClient.from('profiles').select('id, username, avatar_url').in('id', profilesIds);

    container.innerHTML = conversationArray.map(conv => {
        const p = profiles.find(x => x.id === conv.id) || { username: "Utilisateur inconnu" };
        const avatar = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`;
        
        // Echapper les apostrophes pour le onclick
        const safeUsername = p.username.replace(/'/g, "\\'");
        
        return `
            <div onclick="openDirectChat('${conv.id}', '${safeUsername}')" class="p-4 hover:bg-white/5 rounded-2xl cursor-pointer flex items-center gap-3 border-b border-white/5 transition-colors">
                <img src="${avatar}" class="w-12 h-12 rounded-full object-cover border border-white/10">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-sm text-white truncate uppercase">${p.username}</h4>
                    <p class="text-xs text-gray-500 truncate">${conv.lastMsg}</p>
                </div>
            </div>`;
    }).join('');
}

function startChat(targetProfile) {
    activeChatUser = targetProfile;
    switchView('messages');
    
    const title = document.getElementById('chat-with-name');
    if(title) title.innerHTML = `<span class="text-purple-400">@</span>${targetProfile.username}`;
    
    const input = document.getElementById('chat-input');
    if(input) {
        input.disabled = false;
        input.placeholder = "Écrire à " + targetProfile.username + "...";
        input.focus();
    }
    fetchMessages();
}

function resetChat() {
    activeChatUser = null;
    const title = document.getElementById('chat-with-name');
    if(title) title.innerText = "Sélectionnez un ami";
    
    const container = document.getElementById('chat-history');
    if(container) container.innerHTML = '<div class="flex flex-col items-center justify-center h-full opacity-20 italic text-sm"><i data-lucide="message-square" class="w-12 h-12 mb-2"></i><p>Choisissez un frère ou une sœur</p></div>';
    
    const input = document.getElementById('chat-input');
    if(input) { 
        input.value = ""; 
        input.disabled = true; 
        input.placeholder = "Message...";
    }
    lucide.createIcons();
}

async function fetchMessages() {
    const container = document.getElementById('chat-history');
    if(!container || !activeChatUser) return;
    
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
    
    container.innerHTML = (data || []).map(msg => {
        const isMe = msg.sender_id === currentUser.id;
        return `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3">
            <div class="${isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'} px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-xl border border-white/5">
                ${msg.content}
            </div>
        </div>`;
    }).join('');
    
    // Auto-scroll en bas
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!activeChatUser || !input.value.trim()) return;
    
    const content = input.value;
    input.value = ''; // Reset immédiat
    
    const { error } = await supabaseClient.from('messages').insert([{ 
        content, 
        sender_id: currentUser.id, 
        sender_email: currentUser.email, 
        sender_name: userProfile.username, 
        receiver_id: activeChatUser.id 
    }]);
    
    if(!error) { 
        fetchMessages(); 
        loadConversations(); 
    }
}

// ==========================================
// 7. GESTION DES REELS (YOUTUBE)
// ==========================================

function openAddReelModal() { document.getElementById('add-reel-modal').classList.remove('hidden'); }
function closeAddReelModal() { document.getElementById('add-reel-modal').classList.add('hidden'); }

async function saveReel() {
    const url = document.getElementById('reel-url').value.trim();
    const caption = document.getElementById('reel-caption').value.trim();
    
    if(!url.includes('youtube.com') && !url.includes('youtu.be')) return alert("Lien YouTube requis");

    // Extraction ID Youtube
    let videoId = "";
    if (url.includes('shorts/')) videoId = url.split('shorts/')[1].split('?')[0];
    else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
    else videoId = url.split('/').pop();

    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&rel=0&loop=1&playlist=${videoId}`;

    const { error } = await supabaseClient.from('reels').insert([{ 
        user_id: currentUser.id, 
        user_name: userProfile.username, 
        video_url: embedUrl, 
        caption 
    }]);
    
    if(!error) { 
        closeAddReelModal(); 
        document.getElementById('reel-url').value = '';
        document.getElementById('reel-caption').value = '';
        fetchReels(); 
    } else {
        alert("Erreur: " + error.message);
    }
}

async function fetchReels() {
    const container = document.getElementById('reels-container');
    if(!container) return;
    
    const { data } = await supabaseClient.from('reels').select('*').order('created_at', { ascending: false });
    
    container.innerHTML = (data || []).map(r => `
        <div class="w-full h-full snap-start relative flex-none bg-black overflow-hidden reel-video-container">
            <iframe src="${r.video_url}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            
            <div class="absolute bottom-24 left-6 right-20 pointer-events-none drop-shadow-2xl z-10">
                <p class="font-black text-white text-lg italic tracking-tighter uppercase">@${r.user_name}</p>
                <p class="text-sm text-gray-200 mt-2 line-clamp-3">${r.caption || ""}</p>
            </div>
            
            <div class="absolute bottom-32 right-6 flex flex-col gap-8 items-center z-20">
                <button class="flex flex-col items-center gap-2 group">
                    <div class="bg-white/10 backdrop-blur-xl p-4 rounded-full border border-white/20 group-active:scale-75 transition-all">
                        <i data-lucide="heart" class="w-6 h-6 text-white"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase text-white">Amen</span>
                </button>
            </div>
        </div>`).join('');
        
    lucide.createIcons();
}

// ==========================================
// 8. AUTRES FONCTIONS (Stories, Prières, Amis)
// ==========================================

async function fetchPrayers() {
    const container = document.getElementById('prayers-list'); 
    if(!container) return;
    const { data: prayers } = await supabaseClient.from('prayers').select('*').order('created_at', { ascending: false });
    container.innerHTML = (prayers && prayers.length > 0) ? prayers.map(p => `
        <div class="bg-gray-900/60 p-3 rounded-xl border border-pink-500/10 flex justify-between items-center mb-2 animate-fade-in">
            <div class="flex-1">
                <p class="text-[10px] font-bold text-pink-400 mb-0.5">${p.user_name}</p>
                <p class="text-xs text-gray-300 italic">"${p.content}"</p>
            </div>
            <button onclick="prayFor('${p.id}', ${p.count})" class="ml-3 flex flex-col items-center group">
                <div class="bg-gray-800 p-2 rounded-full border border-gray-600 hover:border-pink-500 transition-all text-sm group-active:scale-90">🙏</div>
                <span class="text-[9px] text-gray-500 font-bold mt-1">${p.count}</span>
            </button>
        </div>`).join('') : '<div class="text-center text-[10px] text-gray-500 py-4 italic">Soyez le premier ! 🙏</div>';
}

async function addPrayer() {
    const input = document.getElementById('prayer-input'); 
    if (!input || !input.value.trim()) return;
    await supabaseClient.from('prayers').insert([{ user_id: currentUser.id, user_name: userProfile.username, content: input.value, count: 0 }]);
    input.value = ''; 
    fetchPrayers();
}

async function prayFor(id, current) { 
    await supabaseClient.from('prayers').update({ count: (current || 0) + 1 }).eq('id', id); 
    fetchPrayers(); 
}

function subscribeToRealtime() {
    supabaseClient.channel('global-updates').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (payload.table === 'messages') { fetchMessages(); loadConversations(); }
        if (payload.table === 'posts') fetchPosts();
        if (payload.table === 'friendships') { fetchNotifications(); updateFriendCount(currentUser.id); }
        if (payload.table === 'likes' && payload.eventType === 'INSERT') showNotification("Bénédiction", "Amen reçu ! ✨");
    }).subscribe();
}

async function updateFriendCount(userId) {
    const { count: c1 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('requester_id', userId).eq('status', 'accepted');
    const { count: c2 } = await supabaseClient.from('friendships').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('status', 'accepted');
    const el = document.getElementById('stats-friends-count'); 
    if(el) el.innerText = (c1 || 0) + (c2 || 0);
}

function showNotification(senderName, message) {
    const container = document.getElementById('notification-container');
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
    } else { 
        badge.classList.add('hidden'); 
        if(list) list.innerHTML = '<div class="p-4 text-center text-xs text-gray-500">🍃</div>'; 
    }
}

async function handleFriendRequest(id, accepted) {
    if (accepted) await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabaseClient.from('friendships').delete().eq('id', id);
    fetchNotifications(); 
    updateFriendCount(currentUser.id); 
    switchProfileTab('requests');
}

async function addFriend(targetId) {
    const { error } = await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: targetId, status: 'pending' }]);
    if (!error) alert("Demande envoyée !");
}

function toggleNotifDropdown() { document.getElementById('notif-dropdown').classList.toggle('hidden'); }

// STORIES
function triggerAddStory() { document.getElementById('btn-add-story-input').click(); }

async function uploadStory(input) {
    if (!input.files || !input.files[0]) return;
    try {
        const file = input.files[0]; 
        const fileName = `${currentUser.id}/${Date.now()}`;
        const { error: uploadError } = await supabaseClient.storage.from('story-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabaseClient.storage.from('story-images').getPublicUrl(fileName);
        await supabaseClient.from('stories').insert([{ user_id: currentUser.id, image_url: data.publicUrl }]);
        renderStoriesList();
    } catch (error) { alert("Erreur : " + error.message); }
}

async function renderStoriesList() {
    const container = document.getElementById('stories-container'); 
    if (!container) return;
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours() - 24);
    const { data: stories } = await supabaseClient.from('stories').select('*, profiles(username, avatar_url)').gt('created_at', yesterday.toISOString()).order('created_at', { ascending: false });
    
    let html = `<div onclick="triggerAddStory()" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-14 h-14 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center relative"><i data-lucide="plus" class="w-5 h-5 text-gray-400"></i></div><span class="text-[9px] text-gray-300">Ma Story</span></div>`;
    
    if (stories) stories.forEach(s => {
        if (!s.profiles) return;
        const storyData = encodeURIComponent(JSON.stringify(s));
        const avatarContent = s.profiles.avatar_url ? `<img src="${s.profiles.avatar_url}" class="w-full h-full object-cover rounded-full">` : `<div class="w-full h-full rounded-full bg-gray-700 flex items-center justify-center font-bold text-white text-[10px]">${s.profiles.username[0].toUpperCase()}</div>`;
        html += `<div onclick="openStoryViewer('${storyData}')" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0"><div class="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-[2px]"><div class="w-full h-full rounded-full bg-gray-900 border-2 border-gray-900 overflow-hidden">${avatarContent}</div></div><span class="text-[9px] text-gray-300 truncate w-14 text-center">${s.profiles.username}</span></div>`;
    });
    
    container.innerHTML = html; 
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

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

function closeStoryViewer() { 
    document.getElementById('story-viewer').classList.add('hidden'); 
    if (currentStoryTimer) clearTimeout(currentStoryTimer); 
}

async function deleteStory(id) { 
    if (confirm("Supprimer ?")) { 
        await supabaseClient.from('stories').delete().eq('id', id); 
        closeStoryViewer(); 
        renderStoriesList(); 
    } 
}

async function searchUsers(query) {
    const resultBox = document.getElementById('search-results');
    if (!query || query.length < 2) { resultBox.classList.add('hidden'); return; }
    
    const { data } = await supabaseClient.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(5);
    
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = (data && data.length > 0) ? data.map(u => {
        const avatarHtml = u.avatar_url ? `<img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover">` : `<div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold text-[10px] text-white">${u.username.substring(0,2).toUpperCase()}</div>`;
        return `<div onclick="openUserProfile('${u.id}')" class="p-3 border-b border-white/5 flex justify-between items-center hover:bg-white/5 cursor-pointer"><div class="flex items-center gap-3">${avatarHtml}<span class="text-sm font-bold text-white">${u.username}</span></div><i data-lucide="chevron-right" class="w-4 h-4 text-gray-500"></i></div>`
    }).join('') : '<div class="p-3 text-gray-500 text-xs text-center italic">Aucun utilisateur trouvé</div>';
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function openUserProfile(userId) {
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if(profile) {
        document.getElementById('public-username').innerText = profile.username;
        document.getElementById('public-bio').innerText = profile.bio || "Pas de bio.";
        const avatarEl = document.getElementById('public-avatar');
        if(profile.avatar_url) { avatarEl.innerHTML = `<img src="${profile.avatar_url}" class="w-full h-full object-cover">`; } else { avatarEl.innerHTML = profile.username.substring(0,2).toUpperCase(); }
        document.getElementById('btn-message').onclick = () => openDirectChat(profile.id, profile.username);
        document.getElementById('btn-add-friend').onclick = () => addFriend(profile.id);
        switchView('public-profile');
    }
}

// GESTION LIVE MESSAGES
async function fetchLiveMessages() {
    const container = document.getElementById('live-chat-messages');
    if(!container) return;
    const { data: messages } = await supabaseClient.from('live_messages').select('*').order('created_at', { ascending: true }).limit(50);
    container.innerHTML = (messages && messages.length > 0) ? messages.map(msg => `<div class="flex gap-2 mb-1.5 items-start"><span class="font-bold text-purple-400 shrink-0 text-xs mt-0.5">${msg.user_name}:</span><span class="text-gray-200 text-sm leading-tight">${msg.content}</span></div>`).join('') : '<div class="text-center text-gray-600 text-xs py-10 italic">Bienvenue !</div>';
    container.scrollTop = container.scrollHeight;
}

async function sendLiveMessage() {
    const input = document.getElementById('live-chat-input');
    if (!input || !input.value.trim()) return;
    const { error } = await supabaseClient.from('live_messages').insert([{ user_name: userProfile.username, content: input.value }]);
    if(!error) input.value = '';
}
