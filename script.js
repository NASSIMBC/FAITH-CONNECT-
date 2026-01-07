// ==========================================
// CONFIGURATION SUPABASE
// ==========================================
// Remplace ces valeurs par celles de ton tableau de bord Supabase
const SUPABASE_URL = 'https://TON_PROJET.supabase.co';
const SUPABASE_KEY = 'TA_CLE_PUBLIQUE_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables d'état global
let currentUser = null;
let currentChatUserId = null;

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier si l'utilisateur est déjà connecté
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        currentUser = session.user;
        initApp();
    } else {
        showLogin();
    }
    
    // Initialiser les icônes
    lucide.createIcons();
});

// ==========================================
// GESTION DE L'AUTHENTIFICATION
// ==========================================

async function handleSignUp() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Veuillez remplir tous les champs.");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        alert("Erreur : " + error.message);
    } else {
        // Création automatique du profil
        await supabase.from('profiles').insert([{ 
            id: data.user.id, 
            username: email.split('@')[0], 
            avatar_url: null 
        }]);
        alert("Compte créé ! Vérifiez votre email ou connectez-vous.");
    }
    setLoading(false);
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Erreur de connexion : " + error.message);
    } else {
        currentUser = data.user;
        initApp();
    }
    setLoading(false);
}

async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
}

function initApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    loadProfile();
    fetchPosts();
    fetchPrayers();
    fetchStories();
    
    // Configurer le temps réel pour les messages (facultatif pour le début)
    // setupRealtime(); 
}

function setLoading(isLoading) {
    const btns = document.querySelectorAll('button');
    btns.forEach(btn => {
        if(isLoading) btn.classList.add('loading');
        else btn.classList.remove('loading');
    });
}

// ==========================================
// NAVIGATION & VUES
// ==========================================

function switchView(viewName) {
    // Cacher toutes les vues
    const views = ['home', 'reels', 'live', 'messages', 'profile', 'public-profile'];
    views.forEach(v => document.getElementById(`view-${v}`).classList.add('hidden'));

    // Afficher la vue demandée
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    // Mettre à jour la barre de navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-purple-400', 'text-gray-500');
        btn.classList.add('text-gray-500');
    });
    
    // Mettre en surbrillance l'icône active (sauf pour profil public)
    if(viewName !== 'public-profile') {
        const activeBtn = document.getElementById(`nav-${viewName}`);
        if(activeBtn) {
            activeBtn.classList.remove('text-gray-500');
            activeBtn.classList.add('text-purple-400');
        }
    }
    
    // Chargements spécifiques
    if (viewName === 'reels') fetchReels();
    if (viewName === 'messages') loadConversations();
    
    // Réinitialiser le scroll
    window.scrollTo(0, 0);
}

// ==========================================
// LOGIQUE FLUX / POSTS
// ==========================================

async function fetchPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = '<div class="text-center py-4 text-gray-500 loading">Chargement...</div>';

    const { data: posts, error } = await supabase
        .from('posts')
        .select(`
            *,
            profiles (username, avatar_url)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    container.innerHTML = '';
    posts.forEach(post => {
        const date = new Date(post.created_at).toLocaleDateString();
        const avatar = post.profiles.avatar_url || 'https://via.placeholder.com/40';
        
        const html = `
            <div class="bg-gray-800/50 rounded-2xl p-4 border border-white/5 shadow-sm">
                <div class="flex items-center gap-3 mb-3">
                    <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border border-white/10" onclick="viewUserProfile('${post.user_id}')">
                    <div>
                        <h4 class="font-bold text-sm text-white">${post.profiles.username}</h4>
                        <span class="text-[10px] text-gray-400">${date}</span>
                    </div>
                </div>
                <p class="text-sm text-gray-200 mb-3 leading-relaxed">${post.content}</p>
                ${post.image_url ? `<img src="${post.image_url}" class="w-full rounded-xl mb-3 border border-white/5">` : ''}
                <div class="flex items-center gap-6 text-gray-400">
                    <button class="flex items-center gap-1 hover:text-pink-500 transition-colors"><i data-lucide="heart" class="w-4 h-4"></i> <span class="text-xs">J'aime</span></button>
                    <button class="flex items-center gap-1 hover:text-purple-400 transition-colors"><i data-lucide="message-circle" class="w-4 h-4"></i> <span class="text-xs">Amen</span></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
    lucide.createIcons();
}

let selectedImageFile = null;

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
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('post-image-file').value = "";
}

async function publishPost() {
    const content = document.getElementById('new-post-input').value;
    if (!content && !selectedImageFile) return;

    let imageUrl = null;
    const btn = document.getElementById('btn-publish');
    btn.innerHTML = '...';
    btn.disabled = true;

    // Upload Image si existe
    if (selectedImageFile) {
        const fileExt = selectedImageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, selectedImageFile);
        
        if (!uploadError) {
            const { data } = supabase.storage.from('post-images').getPublicUrl(fileName);
            imageUrl = data.publicUrl;
        }
    }

    // Insert Post
    const { error } = await supabase.from('posts').insert([{
        user_id: currentUser.id,
        content: content,
        image_url: imageUrl
    }]);

    if (!error) {
        document.getElementById('new-post-input').value = '';
        removeImage();
        fetchPosts(); // Recharger le flux
    } else {
        alert("Erreur lors de la publication.");
    }

    btn.innerHTML = '<span>Publier</span><i data-lucide="send" class="w-3 h-3"></i>';
    btn.disabled = false;
    lucide.createIcons();
}

// ==========================================
// LOGIQUE STORIES
// ==========================================

async function fetchStories() {
    // Simulation (Pour la vraie logique, il faut une table 'stories')
    const container = document.getElementById('stories-container');
    container.innerHTML = `
        <div class="flex flex-col items-center gap-1 cursor-pointer" onclick="document.getElementById('btn-add-story-input').click()">
            <div class="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center bg-gray-800">
                <i data-lucide="plus" class="w-6 h-6 text-gray-400"></i>
            </div>
            <span class="text-[10px] text-gray-400">Ma story</span>
        </div>
    `;
    
    // Récupérer les stories depuis Supabase (table 'stories')
    const { data: stories } = await supabase
        .from('stories')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

    if(stories) {
        stories.forEach(story => {
            const html = `
                <div class="flex flex-col items-center gap-1 cursor-pointer" onclick="openStoryViewer('${story.image_url}', '${story.profiles.username}', '${story.profiles.avatar_url}')">
                    <div class="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-purple-500 to-pink-500">
                        <img src="${story.profiles.avatar_url || 'https://via.placeholder.com/64'}" class="w-full h-full rounded-full object-cover border border-gray-900">
                    </div>
                    <span class="text-[10px] text-gray-300 truncate w-16 text-center">${story.profiles.username}</span>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }
    lucide.createIcons();
}

async function uploadStory(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileName = `story_${Date.now()}`;
        
        // Upload
        const { error } = await supabase.storage.from('stories').upload(fileName, file);
        if(!error) {
            const { data } = supabase.storage.from('stories').getPublicUrl(fileName);
            // Sauvegarde DB
            await supabase.from('stories').insert([{
                user_id: currentUser.id,
                image_url: data.publicUrl
            }]);
            fetchStories();
        }
    }
}

function openStoryViewer(img, name, avatar) {
    document.getElementById('story-viewer').classList.remove('hidden');
    document.getElementById('story-viewer-image').src = img;
    document.getElementById('story-viewer-name').innerText = name;
    document.getElementById('story-viewer-avatar').src = avatar || 'https://via.placeholder.com/40';
    
    // Barre de progression simple
    const progress = document.getElementById('story-progress');
    progress.style.width = '0%';
    setTimeout(() => progress.style.width = '100%', 100);
    progress.style.transition = 'width 5s linear';
}

function closeStoryViewer() {
    document.getElementById('story-viewer').classList.add('hidden');
}

// ==========================================
// LOGIQUE PRIÈRES
// ==========================================

async function fetchPrayers() {
    const list = document.getElementById('prayers-list');
    const { data: prayers } = await supabase
        .from('prayers')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(10);

    list.innerHTML = '';
    if(prayers) {
        prayers.forEach(p => {
            list.insertAdjacentHTML('beforeend', `
                <div class="bg-gray-900/50 p-3 rounded-xl border border-white/5 text-xs">
                    <span class="font-bold text-pink-400">${p.profiles.username}</span>
                    <span class="text-gray-300 ml-1">${p.content}</span>
                </div>
            `);
        });
    }
}

async function addPrayer() {
    const input = document.getElementById('prayer-input');
    if(!input.value) return;

    await supabase.from('prayers').insert([{
        user_id: currentUser.id,
        content: input.value
    }]);
    
    input.value = '';
    fetchPrayers();
}

// ==========================================
// LOGIQUE PROFILS
// ==========================================

async function loadProfile() {
    if(!currentUser) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        document.getElementById('profile-name').innerText = profile.username;
        document.getElementById('profile-email').innerText = currentUser.email;
        document.getElementById('status-text-display').innerText = profile.status || "Pas de statut";
        
        if (profile.avatar_url) {
            const img = `<img src="${profile.avatar_url}" class="w-full h-full object-cover">`;
            document.getElementById('profile-avatar-big').innerHTML = img;
            document.getElementById('current-user-avatar-small').innerHTML = img;
        }

        // Pré-remplir la modal d'édition
        document.getElementById('edit-username').value = profile.username;
        document.getElementById('edit-bio').value = profile.bio || '';
    }
}

function openEditModal() {
    document.getElementById('edit-profile-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

async function saveProfile() {
    const username = document.getElementById('edit-username').value;
    const bio = document.getElementById('edit-bio').value;
    
    // Logique avatar upload (simplifiée ici)
    let avatarUrl = null;
    const input = document.getElementById('edit-avatar-input');
    
    const updates = {
        id: currentUser.id,
        username,
        bio,
        updated_at: new Date()
    };

    if (input.files && input.files[0]) {
         const file = input.files[0];
         const fileName = `${currentUser.id}_avatar`;
         const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
         if (!error) {
             const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
             updates.avatar_url = data.publicUrl; // Ajout du cache bust si besoin
         }
    }

    const { error } = await supabase.from('profiles').upsert(updates);
    
    if(!error) {
        closeEditModal();
        loadProfile();
        alert("Profil mis à jour !");
    }
}

function handleAvatarPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('edit-avatar-preview').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// ==========================================
// REELS (Shorts/TikTok)
// ==========================================

async function fetchReels() {
    const container = document.getElementById('reels-container');
    
    const { data: reels } = await supabase.from('reels').select('*').order('created_at', {ascending: false});
    
    container.innerHTML = '';
    
    if(reels) {
        reels.forEach(reel => {
            // Conversion lien YouTube Shorts -> Embed
            let embedUrl = reel.video_url;
            if (embedUrl.includes('youtube.com/shorts/')) {
                const videoId = embedUrl.split('shorts/')[1].split('?')[0];
                embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=0&loop=1`;
            }

            const html = `
                <div class="snap-start w-full h-full relative flex items-center justify-center bg-black">
                    <iframe src="${embedUrl}" class="w-full h-full pointer-events-auto" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
                    <div class="absolute bottom-20 left-4 z-10 text-shadow">
                        <h3 class="font-bold text-white">${reel.caption || 'Reel Spirituel'}</h3>
                        <p class="text-xs text-gray-300">@Utilisateur</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    }
}

function openAddReelModal() { document.getElementById('add-reel-modal').classList.remove('hidden'); }
function closeAddReelModal() { document.getElementById('add-reel-modal').classList.add('hidden'); }

async function saveReel() {
    const url = document.getElementById('reel-url').value;
    const caption = document.getElementById('reel-caption').value;
    
    if(url) {
        await supabase.from('reels').insert([{
            user_id: currentUser.id,
            video_url: url,
            caption: caption
        }]);
        closeAddReelModal();
        fetchReels();
    }
}

// ==========================================
// RECHERCHE UTILISATEURS
// ==========================================

async function searchUsers(query) {
    const resultsDiv = document.getElementById('search-results');
    if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
    }

    const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(5);

    resultsDiv.innerHTML = '';
    if (users && users.length > 0) {
        resultsDiv.classList.remove('hidden');
        users.forEach(user => {
            resultsDiv.insertAdjacentHTML('beforeend', `
                <div class="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 border-b border-white/5" onclick="viewUserProfile('${user.id}')">
                    <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold overflow-hidden">
                        ${user.avatar_url ? `<img src="${user.avatar_url}" class="w-full h-full object-cover">` : user.username[0].toUpperCase()}
                    </div>
                    <span class="text-sm text-gray-200">${user.username}</span>
                </div>
            `);
        });
    } else {
        resultsDiv.classList.add('hidden');
    }
}

// Voir le profil public de quelqu'un
async function viewUserProfile(userId) {
    if(userId === currentUser.id) {
        switchView('profile');
        return;
    }

    switchView('public-profile');
    document.getElementById('search-results').classList.add('hidden'); // Cacher la recherche
    
    const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
    
    if(user) {
        document.getElementById('public-username').innerText = user.username;
        document.getElementById('public-bio').innerText = user.bio || "Aucune description.";
        
        const avatarEl = document.getElementById('public-avatar');
        if(user.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.avatar_url}" class="w-full h-full object-cover">`;
        } else {
            avatarEl.innerText = user.username[0];
        }

        // Configuration bouton message
        const btnMsg = document.getElementById('btn-message');
        btnMsg.onclick = () => startChat(user.id, user.username);
    }
}

// ==========================================
// MESSAGERIE
// ==========================================

async function loadConversations() {
    // Note: Une requête SQL complexe est souvent nécessaire pour grouper les conversations.
    // Pour simplifier ici, on suppose une table "messages" et on charge les derniers reçus.
    const list = document.getElementById('messages-list');
    list.innerHTML = '<div class="text-xs text-gray-500 p-2">Chargement...</div>';
    
    // Récupérer les ID uniques avec qui on a discuté (Simplifié)
    const { data: msgs } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, profiles:sender_id(username)')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(20);
        
    // Filtrage JS rudimentaire pour afficher les contacts uniques
    const contacts = new Set();
    list.innerHTML = '';
    
    if(msgs) {
        msgs.forEach(msg => {
            const contactId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
            
            if(!contacts.has(contactId)) {
                contacts.add(contactId);
                // On affiche
                list.insertAdjacentHTML('beforeend', `
                    <div class="p-3 hover:bg-white/5 cursor-pointer rounded-xl mb-1" onclick="startChat('${contactId}', 'Utilisateur')">
                        <div class="font-bold text-sm text-white">Contact ID: ${contactId.substr(0,5)}...</div>
                        <div class="text-xs text-gray-400 truncate">${msg.content}</div>
                    </div>
                `);
            }
        });
    }
}

async function startChat(userId, username) {
    currentChatUserId = userId;
    
    // UI Mobile
    document.getElementById('chat-detail').classList.remove('hidden');
    document.getElementById('conversations-sidebar').classList.add('hidden', 'md:block'); // Sur mobile on cache la liste
    
    document.getElementById('chat-with-name').innerText = username || "Chat";
    document.getElementById('chat-input').disabled = false;
    document.getElementById('chat-input').focus();
    
    loadChatMessages();
}

async function loadChatMessages() {
    const history = document.getElementById('chat-history');
    history.innerHTML = '';
    
    const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatUserId}),and(sender_id.eq.${currentChatUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    if(msgs) {
        msgs.forEach(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const html = `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="${isMe ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200'} rounded-2xl px-4 py-2 max-w-[70%] text-sm">
                        ${msg.content}
                    </div>
                </div>
            `;
            history.insertAdjacentHTML('beforeend', html);
        });
        history.scrollTop = history.scrollHeight;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value;
    if(!text || !currentChatUserId) return;
    
    // Affichage optimiste immédiat
    const history = document.getElementById('chat-history');
    history.insertAdjacentHTML('beforeend', `
        <div class="flex justify-end"><div class="bg-purple-600 text-white rounded-2xl px-4 py-2 max-w-[70%] text-sm opacity-50">${text}</div></div>
    `);
    history.scrollTop = history.scrollHeight;
    input.value = '';

    await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: currentChatUserId,
        content: text
    }]);
    
    loadChatMessages(); // Recharger pour confirmer
}
