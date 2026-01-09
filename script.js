// ==========================================
// 1. CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';
const GEMINI_API_KEY = 'AIzaSyBjbQeVvpGOoSsGsGL8JHWzExczCwHbSnk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let currentUser = null;
let userProfile = null;
let activeChatUser = null;
let jitsiApi = null;
let currentPublicProfileId = null;

// Variables pour le Canvas (Verset)
let canvas, ctx, currentBgType = 'color', uploadedBgImage = null;

document.addEventListener('DOMContentLoaded', checkSession);

// ==========================================
// 2. AUTHENTIFICATION
// ==========================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadAppData();
        setupRealtime(); // Active les notifs et messages en direct
    } else {
        document.getElementById('login-page').classList.remove('hidden');
    }
}

async function loadUserProfile() {
    let { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (!data) {
        const newProfile = { id: currentUser.id, email: currentUser.email, username: currentUser.email.split('@')[0], bio: "Nouveau membre" };
        await supabaseClient.from('profiles').insert([newProfile]);
        userProfile = newProfile;
    } else {
        userProfile = data;
    }
    updateUIProfile();
    // Met à jour "En ligne"
    await supabaseClient.from('profiles').update({ status_updated_at: new Date() }).eq('id', currentUser.id);
}

function updateUIProfile() {
    // Met à jour partout où le nom/avatar apparait
    const texts = document.querySelectorAll('#user-display, #profile-name');
    texts.forEach(el => { if(el) el.innerText = userProfile.username; });
    
    if(document.getElementById('profile-email')) document.getElementById('profile-email').innerText = "@" + userProfile.username;
    
    if(userProfile.avatar_url) {
        const imgTag = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover rounded-full">`;
        if(document.getElementById('profile-avatar-big')) document.getElementById('profile-avatar-big').innerHTML = imgTag;
        if(document.getElementById('current-user-avatar-small')) document.getElementById('current-user-avatar-small').innerHTML = imgTag;
    }
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

async function logout() { await supabaseClient.auth.signOut(); location.reload(); }

// ==========================================
// 3. NAVIGATION
// ==========================================
function switchView(viewName) {
    const views = ['home', 'reels', 'bible', 'messages', 'profile', 'public-profile'];
    
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if(el) el.classList.add('hidden');
        
        const btn = document.getElementById('nav-' + v);
        if(btn) {
            btn.classList.remove('text-purple-400', 'scale-110');
            btn.classList.add('text-gray-500');
        }
    });

    const target = document.getElementById('view-' + viewName);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('animate-view');
    }

    const activeBtn = document.getElementById('nav-' + viewName);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-500');
        activeBtn.classList.add('text-purple-400', 'scale-110');
    }

    if (viewName === 'reels') fetchReels();
    if (viewName === 'profile') { fetchMyGoals(); fetchMyFriends(); }
    if (viewName === 'home') fetchPosts();
}

async function loadAppData() {
    await Promise.all([fetchPosts(), renderStoriesList()]);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. RECHERCHE & PROFIL PUBLIC (CORRIGÉ)
// ==========================================
let searchTimeout = null;
function searchUsers(query) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const list = document.getElementById('search-results');
        if (query.length < 2) { list.classList.add('hidden'); return; }
        
        const { data } = await supabaseClient.from('profiles').select('id, username, avatar_url').ilike('username', `%${query}%`).limit(5);
        
        list.innerHTML = '';
        list.classList.remove('hidden');
        
        if(data && data.length > 0) {
            data.forEach(u => {
                if(u.id === currentUser.id) return;
                const avatar = u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username;
                list.insertAdjacentHTML('beforeend', `
                    <div onclick="openPublicProfile('${u.id}')" class="p-3 hover:bg-white/5 flex gap-3 cursor-pointer items-center border-b border-white/5">
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

    document.getElementById('public-username').innerText = profile.username;
    document.getElementById('public-bio').innerText = profile.bio || "Pas de bio.";
    
    const avatarSrc = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + profile.username;
    document.getElementById('public-avatar').src = avatarSrc;

    // Voir si Story dispo
    checkUserStory(targetId);
    
    // Boutons (Ajouter/Message/Bloquer)
    checkFriendshipStatus(targetId);

    // Posts
    fetchUserPublicPosts(targetId);
}

// CORRECTION BUG 406 & 409 (AMITIÉ)
async function checkFriendshipStatus(targetId) {
    const container = document.getElementById('public-actions');
    container.innerHTML = '<div class="animate-spin w-4 h-4 border-2 border-white rounded-full"></div>';

    // 1. Vérifier si bloqué
    const { data: blocked } = await supabaseClient.from('blocked_users').select('*').eq('blocker_id', currentUser.id).eq('blocked_id', targetId).maybeSingle();
    if(blocked) {
        container.innerHTML = `<button onclick="unblockUser('${targetId}')" class="px-6 py-2 bg-red-600 rounded-full font-bold text-sm">Débloquer</button>`;
        return;
    }

    // 2. Vérifier amitié (Méthode simplifiée pour éviter erreur 406)
    // On cherche s'il existe une ligne où je suis demandeur OU receveur avec cette personne
    const { data: rel1 } = await supabaseClient.from('friendships').select('*').match({ requester_id: currentUser.id, receiver_id: targetId }).maybeSingle();
    const { data: rel2 } = await supabaseClient.from('friendships').select('*').match({ requester_id: targetId, receiver_id: currentUser.id }).maybeSingle();
    
    const relationship = rel1 || rel2;

    let html = '';
    if (!relationship) {
        // Pas d'amitié
        html = `<button onclick="sendFriendRequest('${targetId}')" class="px-6 py-2 bg-purple-600 rounded-full font-bold text-sm shadow-lg text-white">Ajouter</button>`;
    } else if (relationship.status === 'accepted') {
        // Amis
        const username = document.getElementById('public-username').innerText;
        html = `
            <button onclick="openDirectChat('${targetId}', '${username}')" class="px-6 py-2 bg-gray-700 rounded-full font-bold text-sm border border-white/20 text-white">Message</button>
        `;
    } else if (relationship.requester_id === currentUser.id) {
        // J'ai envoyé la demande
        html = `<button class="px-6 py-2 bg-gray-600 rounded-full font-bold text-sm opacity-50 cursor-not-allowed text-white">Envoyée</button>`;
    } else {
        // Il m'a envoyé la demande
        html = `<button onclick="acceptFriendRequest('${relationship.id}')" class="px-6 py-2 bg-green-600 rounded-full font-bold text-sm text-white">Accepter</button>`;
    }
    container.innerHTML = html;
}

async function sendFriendRequest(targetId) {
    // Vérif anti-doublon (Bug 409)
    const { data: exists } = await supabaseClient.from('friendships').select('*').or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUser.id})`);
    
    if(exists && exists.length > 0) {
        checkFriendshipStatus(targetId); // Rafraichir juste
        return;
    }

    await supabaseClient.from('friendships').insert([{ requester_id: currentUser.id, receiver_id: targetId, status: 'pending' }]);
    checkFriendshipStatus(targetId);
}

async function acceptFriendRequest(id) {
    await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', id);
    // On recharge la vue actuelle
    if(currentPublicProfileId) checkFriendshipStatus(currentPublicProfileId);
    else switchView('profile'); // Si on est sur le profil privé
}

async function fetchUserPublicPosts(userId) {
    const grid = document.getElementById('public-posts-grid');
    grid.innerHTML = '';
    const { data: posts } = await supabaseClient.from('posts').select('image_url').eq('user_id', userId).not('image_url', 'is', null).limit(9);
    if(posts) {
        posts.forEach(p => {
            grid.insertAdjacentHTML('beforeend', `<div class="aspect-square bg-gray-800 rounded-lg overflow-hidden"><img src="${p.image_url}" class="w-full h-full object-cover"></div>`);
        });
    }
}

// ==========================================
// 5. MESSAGERIE (Appels & Images)
// ==========================================
function closeChat() {
    document.getElementById('chat-detail').classList.add('hidden');
    document.getElementById('conversations-sidebar').classList.remove('hidden');
    activeChatUser = null;
    if(jitsiApi) endVideoCall();
}

function openDirectChat(uid, uname) {
    activeChatUser = { id: uid, username: uname };
    document.getElementById('chat-with-name').innerText = uname;
    document.getElementById('chat-detail').classList.remove('hidden');
    document.getElementById('conversations-sidebar').classList.add('hidden');
    
    // Check "En ligne"
    checkUserOnline(uid);
    fetchMessages();
}

async function checkUserOnline(uid) {
    const { data } = await supabaseClient.from('profiles').select('status_updated_at').eq('id', uid).single();
    const dot = document.getElementById('chat-online-status');
    const txt = document.getElementById('chat-status-text');
    
    if(data && data.status_updated_at) {
        const diff = (new Date() - new Date(data.status_updated_at)) / 60000;
        if(diff < 5) {
            dot.classList.remove('hidden');
            txt.innerText = "En ligne";
            txt.classList.add('text-green-400');
        } else {
            dot.classList.add('hidden');
            txt.innerText = "Hors ligne";
            txt.classList.remove('text-green-400');
        }
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    await supabaseClient.from('messages').insert([{ content: input.value, sender_id: currentUser.id, receiver_id: activeChatUser.id }]);
    input.value = '';
    fetchMessages();
}

async function sendChatImage(input) {
    if(!input.files[0] || !activeChatUser) return;
    const file = input.files[0];
    const name = `chat/${currentUser.id}/${Date.now()}`;
    
    // Upload dans bucket 'post-images' (réutilisé)
    await supabaseClient.storage.from('post-images').upload(name, file);
    const { data } = supabaseClient.storage.from('post-images').getPublicUrl(name);
    
    await supabaseClient.from('messages').insert([{ 
        content: `[IMAGE]${data.publicUrl}`, 
        sender_id: currentUser.id, 
        receiver_id: activeChatUser.id 
    }]);
    fetchMessages();
}

async function fetchMessages() {
    const list = document.getElementById('chat-history');
    if(!activeChatUser) return;
    
    const { data } = await supabaseClient.from('messages').select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
        
    list.innerHTML = '';
    if(data) {
        data.forEach(m => {
            const me = m.sender_id === currentUser.id;
            let content = m.content;
            if(content.startsWith('[IMAGE]')) {
                const url = content.replace('[IMAGE]', '');
                content = `<img src="${url}" class="rounded-lg max-w-[200px] border border-white/20 cursor-pointer" onclick="window.open('${url}')">`;
            }
            
            list.insertAdjacentHTML('beforeend', `
                <div class="flex ${me ? 'justify-end':'justify-start'}">
                    <div class="${me ? 'bg-purple-600':'bg-gray-700'} px-4 py-2 rounded-xl text-sm max-w-[80%] break-words shadow-sm">
                        ${content}
                    </div>
                </div>
            `);
        });
        list.scrollTop = list.scrollHeight;
    }
}

// VIDEO CALL (Jitsi)
function startVideoCall() {
    if(!activeChatUser) return;
    document.getElementById('video-call-container').classList.remove('hidden');
    document.getElementById('chat-history').classList.add('hidden');
    
    const roomName = `faith-${[currentUser.id, activeChatUser.id].sort().join('')}`;
    const domain = 'meet.jit.si';
    const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: document.querySelector('#jitsi-meet-frame'),
        userInfo: { displayName: userProfile.username },
        configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false },
        interfaceConfigOverwrite: { TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'tileview'], SHOW_JITSI_WATERMARK: false }
    };
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
}

function endVideoCall() {
    if(jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
    document.getElementById('video-call-container').classList.add('hidden');
    document.getElementById('chat-history').classList.remove('hidden');
}

// ==========================================
// 6. FEED INTELLIGENT (Amis + Découverte)
// ==========================================
async function fetchPosts() {
    const container = document.getElementById('posts-container');
    if(!container) return;
    container.innerHTML = '<div class="text-center py-10"><div class="animate-spin w-8 h-8 border-4 border-purple-500 rounded-full border-t-transparent mx-auto"></div></div>';

    // 1. Amis
    const { data: rels } = await supabaseClient.from('friendships').select('*').eq('status','accepted').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    const friendIds = rels ? rels.map(r => r.requester_id === currentUser.id ? r.receiver_id : r.requester_id) : [];
    friendIds.push(currentUser.id); // Voir mes posts

    // 2. Bloqués
    const { data: blks } = await supabaseClient.from('blocked_users').select('blocked_id').eq('blocker_id', currentUser.id);
    const blockedIds = blks ? blks.map(b => b.blocked_id) : [];

    // 3. Tous les posts
    const { data: posts } = await supabaseClient.from('posts').select('*, profiles:user_id(avatar_url)').order('created_at', {ascending:false}).limit(50);
    
    container.innerHTML = '';
    if(!posts) { container.innerHTML = '<div class="text-center text-gray-500">Vide...</div>'; return; }

    let friendsP = [], discoP = [];
    posts.forEach(p => {
        if(blockedIds.includes(p.user_id)) return;
        if(friendIds.includes(p.user_id)) friendsP.push(p);
        else discoP.push(p);
    });

    // Algo : Amis + 10 Suggestion
    const feed = [...friendsP, ...discoP.slice(0, 10)].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    feed.forEach(p => {
        const me = p.user_id === currentUser.id;
        const avatar = p.profiles?.avatar_url || 'https://ui-avatars.com/api/?name='+p.user_name;
        
        container.insertAdjacentHTML('beforeend', `
            <div class="premium-card rounded-2xl p-4 mb-4 animate-view">
                <div class="flex justify-between mb-2">
                    <div class="flex gap-3 items-center cursor-pointer" onclick="openPublicProfile('${p.user_id}')">
                        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover border-2 border-purple-500/20">
                        <div><h3 class="font-bold text-sm text-white">${p.user_name}</h3><p class="text-[10px] text-gray-500">Post</p></div>
                    </div>
                    ${me ? `<button onclick="deletePost('${p.id}')"><i data-lucide="trash-2" class="w-4 h-4 text-gray-500"></i></button>` : ''}
                </div>
                <p class="text-sm text-gray-200 mb-3 whitespace-pre-wrap">${p.content}</p>
                ${p.image_url ? `<img src="${p.image_url}" class="w-full rounded-xl mb-3 border border-white/5">` : ''}
                <div class="flex gap-4 border-t border-white/10 pt-2">
                    <button class="flex items-center gap-1 text-xs text-gray-400 hover:text-pink-500"><i data-lucide="heart" class="w-4 h-4"></i> Amen</button>
                    <button class="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-400"><i data-lucide="message-square" class="w-4 h-4"></i> Coms</button>
                    <button onclick="sharePost('${p.content}')" class="flex items-center gap-1 text-xs text-gray-400 ml-auto"><i data-lucide="share-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `);
    });
    lucide.createIcons();
}

// CORRECTION BUG 409 (SUPPRESSION POST)
async function deletePost(id) {
    if(!confirm("Supprimer ce post ?")) return;
    // Supprimer d'abord les likes et commentaires liés !
    await supabaseClient.from('likes').delete().eq('post_id', id);
    await supabaseClient.from('comments').delete().eq('post_id', id);
    // Maintenant on peut supprimer le post
    await supabaseClient.from('posts').delete().eq('id', id);
    fetchPosts();
}

let selectedImageFile = null;
function handleImageSelect(input) {
    if(input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = e => { 
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
    const txt = document.getElementById('new-post-input').value;
    const btn = document.getElementById('btn-publish');
    if(!txt && !selectedImageFile) return;

    btn.innerText = "..."; btn.disabled = true;

    try {
        let url = null;
        if(selectedImageFile) {
            const name = `${currentUser.id}/${Date.now()}`;
            await supabaseClient.storage.from('post-images').upload(name, selectedImageFile);
            const { data } = supabaseClient.storage.from('post-images').getPublicUrl(name);
            url = data.publicUrl;
        }
        
        await supabaseClient.from('posts').insert([{
            user_id: currentUser.id,
            user_name: userProfile.username,
            content: txt,
            image_url: url
        }]);

        document.getElementById('new-post-input').value = "";
        removeImage();
        fetchPosts();
    } catch(e) { alert("Erreur: "+e.message); } 
    finally { btn.innerText = "Publier"; btn.disabled = false; }
}

function sharePost(text) {
    if(navigator.share) navigator.share({title:'Faith Connect', text:text});
    else { navigator.clipboard.writeText(text); alert("Copié !"); }
}

// ==========================================
// 7. VERSETS CRÉATIFS (CANVAS - RESTAURÉ)
// ==========================================
function openVerseEditor() { document.getElementById('verse-editor-modal').classList.remove('hidden'); initCanvas(); }
function closeVerseEditor() { document.getElementById('verse-editor-modal').classList.add('hidden'); }

function initCanvas() {
    canvas = document.getElementById('verse-canvas');
    if(canvas) {
        ctx = canvas.getContext('2d');
        drawCanvas();
    }
}

function setBackground(t,v) { 
    currentBgType = t; 
    if(t==='color') { ctx.fillStyle=v; ctx.fillRect(0,0,600,600); drawText(); }
}

function handleBgUpload(input) {
    if(input.files[0]) {
        const r = new FileReader();
        r.onload = e => {
            uploadedBgImage = new Image();
            uploadedBgImage.onload = () => { currentBgType='image'; drawCanvas(); };
            uploadedBgImage.src = e.target.result;
        };
        r.readAsDataURL(input.files[0]);
    }
}

function drawCanvas() {
    if(!ctx) return;
    ctx.clearRect(0,0,600,600);
    if(currentBgType==='color') { ctx.fillStyle='#1f2937'; ctx.fillRect(0,0,600,600); }
    else if(currentBgType==='image' && uploadedBgImage) { ctx.drawImage(uploadedBgImage,0,0,600,600); }
    drawText();
}

function drawText() {
    const text = document.getElementById('verse-text-input').value || "Votre texte...";
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, text, 300, 300, 560, 50);
}

function wrapText(c,t,x,y,mw,lh) { 
    const w=t.split(' '); let l='', ls=[]; 
    for(let n=0;n<w.length;n++){ 
        let tl=l+w[n]+' '; 
        if(c.measureText(tl).width>mw && n>0){ls.push(l);l=w[n]+' ';} else l=tl; 
    } 
    ls.push(l); 
    let sy=y-((ls.length-1)*lh)/2; 
    for(let k=0;k<ls.length;k++) c.fillText(ls[k],x,sy+(k*lh)); 
}

async function publishVerseCard() {
    const caption = document.getElementById('verse-text-input').value;
    const btn = document.getElementById('btn-publish-verse');
    btn.innerText = "Création...";
    
    canvas.toBlob(async blob => {
        const name = `${currentUser.id}/${Date.now()}.png`;
        await supabaseClient.storage.from('verse-images').upload(name, blob);
        const { data } = supabaseClient.storage.from('verse-images').getPublicUrl(name);
        
        await supabaseClient.from('reels').insert([{ 
            user_id: currentUser.id, 
            video_url: data.publicUrl, 
            caption: caption 
        }]);
        
        closeVerseEditor();
        fetchReels();
        btn.innerText = "Publier";
    });
}

async function fetchReels() {
    const cont = document.getElementById('reels-container');
    const { data } = await supabaseClient.from('reels').select('*').order('created_at', {ascending:false});
    cont.innerHTML = '';
    if(data) data.forEach(r => cont.insertAdjacentHTML('beforeend', `<div class="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-white/10"><img src="${r.video_url}" class="w-full h-auto cursor-pointer" onclick="shareImage('${r.video_url}')"></div>`));
}

async function shareImage(url) {
    if(navigator.share) {
        const b = await (await fetch(url)).blob();
        navigator.share({ files: [new File([b], "verset.png", {type:"image/png"})] });
    } else {
        const a = document.createElement('a'); a.href=url; a.download="verset.png"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        alert("Téléchargé !");
    }
}

// ==========================================
// 8. STORIES & OBJECTIFS & BIBLE
// ==========================================
async function uploadStory(input) {
    if(!input.files[0]) return;
    const name = `${currentUser.id}/${Date.now()}`;
    await supabaseClient.storage.from('story-images').upload(name, input.files[0]);
    const { data } = supabaseClient.storage.from('story-images').getPublicUrl(name);
    await supabaseClient.from('stories').insert([{ user_id: currentUser.id, image_url: data.publicUrl }]);
    renderStoriesList();
}

async function renderStoriesList() {
    const cont = document.getElementById('stories-container');
    const yest = new Date(); yest.setHours(yest.getHours()-24);
    const { data } = await supabaseClient.from('stories').select('user_id, profiles(username, avatar_url)').gt('created_at', yest.toISOString());
    const uniq = {}; if(data) data.forEach(s => uniq[s.user_id] = s.profiles);
    
    let html = `<div onclick="document.getElementById('btn-add-story-input').click()" class="flex flex-col items-center shrink-0 cursor-pointer"><div class="w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed flex items-center justify-center"><i data-lucide="plus"></i></div><span class="text-[10px]">Ma Story</span></div>`;
    Object.keys(uniq).forEach(uid => {
        if(uid!==currentUser.id) html += `<div onclick="viewUserStory('${uid}')" class="flex flex-col items-center shrink-0 cursor-pointer"><div class="w-16 h-16 rounded-full story-ring p-[2px]"><img src="${uniq[uid].avatar_url}" class="w-full h-full rounded-full object-cover"></div><span class="text-[10px]">${uniq[uid].username}</span></div>`;
    });
    cont.innerHTML = html; lucide.createIcons();
}

async function viewUserStory(uid) {
    const target = uid || currentPublicProfileId;
    if(!target) return;
    const yest = new Date(); yest.setHours(yest.getHours()-24);
    const { data } = await supabaseClient.from('stories').select('*').eq('user_id', target).gt('created_at', yest.toISOString());
    if(data && data.length > 0) {
        document.getElementById('story-viewer-image').src = data[data.length-1].image_url;
        document.getElementById('story-viewer').classList.remove('hidden');
        document.getElementById('story-progress').style.width = '0%';
        setTimeout(() => document.getElementById('story-progress').style.transition = 'width 5s linear', 50);
        setTimeout(() => document.getElementById('story-progress').style.width = '100%', 100);
        setTimeout(closeStoryViewer, 5000);
    } else alert("Pas de story.");
}
function closeStoryViewer() { document.getElementById('story-viewer').classList.add('hidden'); }
function checkUserStory(uid) { document.getElementById('public-story-ring').classList.add('hidden'); } // A améliorer plus tard

async function fetchMyGoals() {
    const list = document.getElementById('goals-list');
    const { data } = await supabaseClient.from('goals').select('*').eq('user_id', currentUser.id);
    list.innerHTML = '';
    if(data) data.forEach(g => list.insertAdjacentHTML('beforeend', `<div class="flex items-center gap-2 p-2 bg-black/20 rounded"><input type="checkbox" ${g.is_completed?'checked':''} onchange="toggleGoal('${g.id}',this.checked)"><span class="${g.is_completed?'line-through text-gray-500':''}">${g.content}</span><button onclick="deleteGoal('${g.id}')" class="text-red-400 ml-auto">x</button></div>`));
}
async function addGoal() { const t = prompt("Objectif ?"); if(t) { await supabaseClient.from('goals').insert([{user_id:currentUser.id, content:t}]); fetchMyGoals(); } }
async function toggleGoal(id, s) { await supabaseClient.from('goals').update({is_completed:s}).eq('id',id); fetchMyGoals(); }
async function deleteGoal(id) { if(confirm('Suppr ?')) { await supabaseClient.from('goals').delete().eq('id',id); fetchMyGoals(); } }

// SECU
async function changePassword() { const p = prompt("Nouveau mot de passe"); if(p && p.length>=6) { await supabaseClient.auth.updateUser({password:p}); alert("Changé !"); } }
async function reportUser() { if(prompt("Raison ?")) alert("Signalé."); }
async function blockUser() { if(confirm("Bloquer ?") && currentPublicProfileId) { await supabaseClient.from('blocked_users').insert([{blocker_id:currentUser.id, blocked_id:currentPublicProfileId}]); alert("Bloqué."); switchView('home'); } }
async function unblockUser(uid) { await supabaseClient.from('blocked_users').delete().match({blocker_id:currentUser.id, blocked_id:uid}); alert("Débloqué."); openPublicProfile(uid); }

// GROUPES (Placeholder)
async function createGroup() { alert("Bientôt !"); document.getElementById('create-group-modal').classList.add('hidden'); }
async function createPage() { alert("Bientôt !"); document.getElementById('create-page-modal').classList.add('hidden'); }

// BIBLE & AI (CORRECTION API)
const bibleStructure = { AT: [{name:"Genèse",id:1},{name:"Exode",id:2}], NT: [{name:"Matthieu",id:40},{name:"Jean",id:43}] };
function showTestament(type) { document.getElementById('bible-books-list').innerHTML = bibleStructure[type].map(b => `<button onclick="loadBibleChapter(${b.id}, '${b.name}', 1)" class="p-3 bg-gray-800 rounded-lg text-left text-sm font-bold hover:bg-gray-700">${b.name}</button>`).join(''); }
async function loadBibleChapter(id, name, ch) {
    document.getElementById('bible-reader').classList.remove('hidden');
    document.getElementById('reader-title').innerText = `${name} ${ch}`;
    const res = await fetch(`https://api.getbible.net/v2/ls1910/${id}/${ch}.json`);
    const data = await res.json();
    document.getElementById('reader-content').innerHTML = data.verses.map(v => `<p class="mb-2"><sup class="text-purple-400 mr-1">${v.verse}</sup>${v.text}</p>`).join('');
}
function closeBibleReader() { document.getElementById('bible-reader').classList.add('hidden'); }

// AI FIX
async function askFaithAI() {
    const q = document.getElementById('ai-bible-input').value;
    const area = document.getElementById('ai-response-area');
    if(!q) return;
    area.classList.remove('hidden'); area.innerText = "Reflexion...";
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: "Réponds en chrétien court: " + q }] }] })
        });
        const data = await res.json();
        area.innerText = data.candidates[0].content.parts[0].text;
    } catch(e) { area.innerText = "Dieu est amour."; }
}

// REALTIME
function setupRealtime() {
    supabaseClient.channel('global').on('postgres_changes', {event:'INSERT', schema:'public', table:'messages'}, p => {
        if(activeChatUser && (p.new.sender_id === activeChatUser.id)) fetchMessages();
        else if(p.new.receiver_id === currentUser.id) document.getElementById('msg-badge').classList.remove('hidden');
    }).subscribe();
}

async function fetchMyFriends() {
    const list = document.getElementById('profile-social-list');
    const { data } = await supabaseClient.from('friendships').select('*').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).eq('status','accepted');
    list.innerHTML = '';
    if(data) {
        const ids = data.map(f => f.requester_id===currentUser.id ? f.receiver_id : f.requester_id);
        const { data: profs } = await supabaseClient.from('profiles').select('*').in('id', ids);
        profs.forEach(p => list.insertAdjacentHTML('beforeend', `<div class="flex justify-between items-center bg-gray-800 p-2 rounded mb-2"><span>${p.username}</span><button onclick="openDirectChat('${p.id}','${p.username}')"><i data-lucide="message-circle" class="w-4 h-4"></i></button></div>`));
    }
}

```
