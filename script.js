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
        if (document.activeElement.id === 'chat-input') { e.preventDefault(); sendChatMessage(); }
        if (document.activeElement.id.startsWith('input-comment-')) { e.preventDefault(); sendComment(document.activeElement.id.replace('input-comment-', '')); }
        if (document.activeElement.id === 'reel-comment-input') { e.preventDefault(); sendReelComment(); }
        if (document.activeElement.id === 'ai-bible-input') { e.preventDefault(); askFaithAI(); } // Pour l'IA
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
            id: currentUser.id, email: currentUser.email, username: namePart, bio: "Nouveau membre", status_text: "En ligne", status_emoji: "👋"
        };
        await supabaseClient.from('profiles').insert([newProfile]);
        userProfile = newProfile;
    } else { userProfile = data; }
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
// 3. NAVIGATION & UI (MODIFIÉ POUR BIBLE)
// ==========================================

function switchView(viewName) {
    // Liste mise à jour : 'live' est remplacé par 'bible'
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
    if (viewName === 'reels') fetchReels(); 
    else if(reelsContainer) reelsContainer.innerHTML = '';

    // GESTION BIBLE (NOUVEAU)
    if (viewName === 'bible') showTestament('NT'); // Charge le Nouveau Testament par défaut

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
    // Styles des boutons
    const activeClass = "flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-colors";
    const inactiveClass = "flex-1 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors";
    
    document.getElementById('btn-at').className = type === 'AT' ? activeClass : inactiveClass;
    document.getElementById('btn-nt').className = type === 'NT' ? activeClass : inactiveClass;

    const container = document.getElementById('bible-books-list');
    container.innerHTML = bibleBooks[type].map(book => `
        <button onclick="openChapter('${book}', 1)" class="p-4 bg-gray-800 border border-white/5 rounded-xl hover:bg-gray-700 transition-colors text-left group">
            <span class="font-bold text-white group-hover:text-purple-400 text-sm">${book}</span>
            <div class="text-[10px] text-gray-500 mt-1">Lire le livre →</div>
        </button>
    `).join('');
}

function openChapter(book, chapter) {
    const reader = document.getElementById('bible-reader');
    reader.classList.remove('hidden');
    document.getElementById('reader-title').innerText = `${book}`;
    
    const contentDiv = document.getElementById('reader-content');
    contentDiv.innerHTML = '<div class="flex h-full items-center justify-center"><div class="w-8 h-8 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div></div>';
    
    // Simulation de chargement API (Tu pourras connecter une API Bible réelle ici)
    setTimeout(() => {
        contentDiv.innerHTML = `
            <div class="space-y-4 font-serif">
                <h4 class="font-bold text-center mb-6 text-gray-400 border-b border-white/10 pb-2">Chapitre ${chapter}</h4>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">1</sup> Au commencement, Dieu créa les cieux et la terre.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">2</sup> La terre était informe et vide: il y avait des ténèbres à la surface de l'abîme, et l'esprit de Dieu se mouvait au-dessus des eaux.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">3</sup> Dieu dit: Que la lumière soit! Et la lumière fut.</p>
                <p><sup class="text-purple-400 text-xs font-bold mr-1">4</sup> Dieu vit que la lumière était bonne; et Dieu sépara la lumière d'avec les ténèbres.</p>
                <div class="text-center py-8">
                    <button class="bg-purple-600/20 text-purple-300 px-4 py-2 rounded-full text-xs font-bold">Chapitre Suivant ></button>
                </div>
            </div>
        `;
    }, 600);
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
    area.innerHTML = '<div class="flex items-center gap-2 text-purple-300"><div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div> Faith AI réfléchit...</div>';
    input.value = '';

    // Simulation de l'IA (Mockup)
    // Ici tu pourrais appeler OpenAI ou une autre API
    setTimeout(() => {
        const responses = [
            "La Bible enseigne que l'amour est patient et plein de bonté. (1 Corinthiens 13)",
            "Jésus a dit : 'Je suis le chemin, la vérité, et la vie.' C'est un pilier de la foi chrétienne.",
            "N'ayez peur de rien, mais en toute chose faites connaître vos besoins à Dieu par des prières. (Philippiens 4:6)",
            "Le Christ nous invite à aimer notre prochain comme nous-mêmes. C'est le second plus grand commandement."
        ];
        const randomResp = responses[Math.floor(Math.random() * responses.length)];
        
        area.innerHTML = `
            <div class="border-l-2 border-purple-500 pl-2">
                <p class="text-[10px] text-gray-500 mb-1">Votre question : "${question}"</p>
                <p class="text-white font-medium">${randomResp}</p>
            </div>
        `;
    }, 1500);
}

// ==========================================
// 5. PROFIL (CODE EXISTANT)
// ==========================================
// ... (Le reste du code Profil, Amis, Chat reste identique, je le remets pour être complet)

async function updateMyStatus() {
    const t = prompt("Statut ?"); const e = prompt("Emoji ?");
    if(t) { await supabaseClient.from('profiles').update({ status_text: t, status_emoji: e }).eq('id', currentUser.id); userProfile.status_text = t; userProfile.status_emoji = e; updateUIProfile(); }
}
function updateUIProfile() {
    document.getElementById('user-display').innerText = userProfile.username;
    document.getElementById('profile-name').innerText = userProfile.username;
    document.getElementById('profile-email').innerText = '@'+userProfile.username;
    document.getElementById('status-text-display').innerText = userProfile.status_text || 'Statut';
    document.getElementById('status-emoji-display').innerText = userProfile.status_emoji || '👋';
    if(userProfile.avatar_url) {
        document.getElementById('profile-avatar-big').innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
        document.getElementById('current-user-avatar-small').innerHTML = `<img src="${userProfile.avatar_url}" class="w-full h-full object-cover">`;
    }
}
function openEditModal() { document.getElementById('edit-profile-modal').classList.remove('hidden'); document.getElementById('edit-username').value = userProfile.username; document.getElementById('edit-bio').value = userProfile.bio; }
function closeEditModal() { document.getElementById('edit-profile-modal').classList.add('hidden'); }
async function saveProfile() {
    const u = document.getElementById('edit-username').value; const b = document.getElementById('edit-bio').value;
    await supabaseClient.from('profiles').update({ username: u, bio: b }).eq('id', currentUser.id);
    userProfile.username = u; userProfile.bio = b; updateUIProfile(); closeEditModal();
}
function toggleNotifDropdown() { document.getElementById('notif-dropdown').classList.toggle('hidden'); }
async function fetchNotifications() {
    const { data } = await supabaseClient.from('friendships').select('*').eq('receiver_id', currentUser.id).eq('status', 'pending');
    if(data && data.length) {
        document.getElementById('notif-badge').classList.remove('hidden');
        document.getElementById('notif-list').innerHTML = data.map(r => `<div class="p-3 text-xs flex justify-between"><span>Demande d'ami</span><button onclick="handleFriendRequest('${r.id}', true)" class="text-green-400">Accepter</button></div>`).join('');
    }
}
async function handleFriendRequest(id, acc) {
    if(acc) await supabaseClient.from('friendships').update({ status: 'accepted' }).eq('id', id); else await supabaseClient.from('friendships').delete().eq('id', id);
    fetchNotifications();
}

// ==========================================
// 6. MESSAGERIE (AMÉLIORÉE)
// ==========================================
function openDirectChat(userId, username) { startChat({ id: userId, username: username }); if(window.innerWidth < 768) { document.getElementById('conversations-sidebar').classList.add('hidden'); document.getElementById('chat-detail').classList.remove('hidden'); document.getElementById('chat-detail').classList.add('flex'); } }

async function loadConversations() {
    const { data } = await supabaseClient.from('messages').select('*').or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`).order('created_at', {ascending:false});
    if(!data) return;
    const ids = new Set(); const convs = [];
    data.forEach(m => { const oid = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id; if(!ids.has(oid)) { ids.add(oid); convs.push({id: oid, msg: m.content, time: new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}); } });
    const { data: profs } = await supabaseClient.from('profiles').select('*').in('id', Array.from(ids));
    document.getElementById('messages-list').innerHTML = convs.map(c => {
        const p = profs.find(x => x.id === c.id);
        const av = p?.avatar_url ? `<img src="${p.avatar_url}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs">${p?.username.substring(0,2)}</div>`;
        return `<div onclick="openDirectChat('${c.id}', '${p?.username}')" class="p-3 hover:bg-white/5 border-b border-white/5 cursor-pointer flex gap-3 items-center">${av}<div class="flex-1"><div class="flex justify-between"><h4 class="font-bold text-sm">${p?.username}</h4><span class="text-[10px] text-gray-500">${c.time}</span></div><p class="text-xs text-gray-400 truncate">${c.msg}</p></div></div>`;
    }).join('');
}
function startChat(p) { 
    activeChatUser = p; switchView('messages'); 
    document.getElementById('chat-with-name').innerText = p.username;
    // Gestion Avatar Header
    const hAv = document.getElementById('chat-header-avatar'); const hIn = document.getElementById('chat-header-initials');
    supabaseClient.from('profiles').select('*').eq('id', p.id).single().then(({data})=>{
        if(data?.avatar_url) { hAv.src=data.avatar_url; hAv.classList.remove('hidden'); hIn.classList.add('hidden'); }
        else { hAv.classList.add('hidden'); hIn.classList.remove('hidden'); hIn.innerText=p.username.substring(0,2).toUpperCase(); }
    });
    document.getElementById('chat-input').disabled = false; fetchMessages(); 
}
function resetChat() { activeChatUser = null; document.getElementById('chat-with-name').innerText = "Sélectionnez un ami"; document.getElementById('chat-history').innerHTML = ""; document.getElementById('chat-input').disabled = true; }
async function fetchMessages() {
    if(!activeChatUser) return;
    const { data } = await supabaseClient.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`).order('created_at');
    const c = document.getElementById('chat-history');
    c.innerHTML = data.map(m => {
        const me = m.sender_id === currentUser.id;
        return `<div class="flex ${me ? 'justify-end' : 'justify-start'} mb-2"><div class="${me ? 'bg-purple-600 rounded-tr-sm' : 'bg-gray-800 rounded-tl-sm'} px-4 py-2 rounded-2xl text-sm max-w-[75%] shadow-sm">${m.content}<span class="block text-[9px] text-right mt-1 opacity-60">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div></div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
}
async function sendChatMessage() {
    const v = document.getElementById('chat-input').value;
    if(v && activeChatUser) { await supabaseClient.from('messages').insert({ content: v, sender_id: currentUser.id, sender_name: userProfile.username, receiver_id: activeChatUser.id }); document.getElementById('chat-input').value = ''; fetchMessages(); }
}

// ==========================================
// 7. ENTRAIDE & ÉVÉNEMENTS & POSTS
// ==========================================
async function fetchHelpRequests() {
    const c = document.getElementById('help-list'); if(!c) return;
    const { data } = await supabaseClient.from('help_requests').select('*').order('created_at', {ascending:false}).limit(3);
    c.innerHTML = data ? data.map(r => `<div class="bg-gray-900/50 p-3 rounded-xl border border-white/5 flex gap-3 items-center"><div class="bg-blue-900/30 p-2.5 rounded-full"><i data-lucide="hand-heart" class="w-4 h-4 text-blue-400"></i></div><div class="flex-1"><h4 class="text-xs font-bold">${r.title}</h4><p class="text-[10px] text-gray-400">${r.description} - @${r.user_name}</p></div></div>`).join('') : '';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
async function askForHelp() { const t = prompt("Titre ?"); const d = prompt("Détails ?"); if(t) { await supabaseClient.from('help_requests').insert({user_id:currentUser.id, user_name:userProfile.username, title:t, description:d||''}); fetchHelpRequests(); }}

async function fetchEvents() {
    const evts = [{d:"12 FÉV", t:"Louange", l:"Église", c:"purple"}, {d:"15 FÉV", t:"Maraude", l:"Gare", c:"pink"}];
    const c = document.getElementById('events-list'); if(!c) return;
    c.innerHTML = evts.map(e => `<div class="min-w-[150px] bg-gray-800 rounded-2xl p-3 border border-white/5 relative shrink-0"><div class="absolute top-0 right-0 p-2 bg-${e.c}-600 rounded-bl-xl text-[10px] font-bold shadow-lg">${e.d}</div><div class="mt-7"><h4 class="font-bold text-sm">${e.t}</h4><p class="text-[10px] text-gray-400 flex gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${e.l}</p><button class="mt-3 w-full py-1.5 bg-white/5 rounded-lg text-[10px] font-bold">Participer</button></div></div>`).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchPosts() {
    const c = document.getElementById('posts-container'); if(!c) return;
    const f = await getFriendIds();
    const { data: posts } = await supabaseClient.from('posts').select('*, profiles:user_id(avatar_url)').in('user_id', f).order('created_at', {ascending:false});
    const { data: likes } = await supabaseClient.from('likes').select('post_id, user_id');
    c.innerHTML = '';
    if(posts) posts.forEach(p => {
        const isMe = p.user_id === currentUser.id;
        const lks = likes.filter(l => l.post_id === p.id);
        const loved = lks.some(l => l.user_id === currentUser.id);
        const av = p.profiles?.avatar_url ? `<img src="${p.profiles.avatar_url}" class="w-8 h-8 rounded-full object-cover">` : `<div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold text-[10px]">${p.avatar_initials}</div>`;
        c.insertAdjacentHTML('beforeend', `<div class="bg-gray-800/30 rounded-2xl p-4 border border-white/5 mb-4"><div class="flex justify-between items-start mb-3"><div class="flex items-center gap-3">${av}<div><h3 class="font-bold text-sm">${p.user_name}</h3><p class="text-[10px] text-gray-500">${new Date(p.created_at).toLocaleTimeString()}</p></div></div>${isMe ? `<button onclick="deletePost('${p.id}')" class="text-gray-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`:''}</div><p class="text-gray-200 text-sm whitespace-pre-wrap">${p.content}</p>${p.image_url ? `<img src="${p.image_url}" class="mt-3 rounded-xl w-full">`:''}<div class="mt-3 border-t border-white/5 pt-3 flex gap-4 text-gray-500"><button onclick="toggleAmen('${p.id}')" class="flex items-center gap-1 text-xs ${loved ? 'text-pink-500':''}"><i data-lucide="heart" class="w-4 h-4 ${loved?'fill-pink-500':''}"></i> ${lks.length} Amen</button><button onclick="toggleComments('${p.id}')" class="flex items-center gap-1 text-xs"><i data-lucide="message-square" class="w-4 h-4"></i> Coms</button></div><div id="comments-section-${p.id}" class="hidden mt-3 pt-3 bg-black/20 rounded-lg p-3"><div id="comments-list-${p.id}" class="space-y-2 mb-3 max-h-40 overflow-y-auto"></div><div class="flex gap-2"><input id="input-comment-${p.id}" class="flex-1 bg-gray-900 rounded-lg px-3 py-1 text-xs text-white" placeholder="..."><button onclick="sendComment('${p.id}')" class="text-purple-400 font-bold text-xs">Envoyer</button></div></div></div>`);
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
function handleImageSelect(input) { if(input.files[0]) { selectedImageFile = input.files[0]; const r = new FileReader(); r.onload = e => { document.getElementById('image-preview').src = e.target.result; document.getElementById('image-preview-container').classList.remove('hidden'); }; r.readAsDataURL(input.files[0]); } }
function removeImage() { selectedImageFile = null; document.getElementById('image-preview-container').classList.add('hidden'); }
async function publishPost() {
    const v = document.getElementById('new-post-input').value;
    if(!v && !selectedImageFile) return;
    let url = null;
    if(selectedImageFile) { const n = `${currentUser.id}/${Date.now()}`; await supabaseClient.storage.from('post-images').upload(n, selectedImageFile); const { data } = supabaseClient.storage.from('post-images').getPublicUrl(n); url = data.publicUrl; }
    await supabaseClient.from('posts').insert({ user_id: currentUser.id, content: v, user_name: userProfile.username, image_url: url, avatar_initials: userProfile.username.substring(0,2) });
    document.getElementById('new-post-input').value = ''; removeImage(); fetchPosts();
}
async function deletePost(id) { if(confirm("Supprimer ?")) { await supabaseClient.from('posts').delete().eq('id', id); fetchPosts(); } }
async function toggleAmen(id) { const {data} = await supabaseClient.from('likes').select('*').match({post_id:id, user_id:currentUser.id}); if(data.length) await supabaseClient.from('likes').delete().match({post_id:id, user_id:currentUser.id}); else await supabaseClient.from('likes').insert({post_id:id, user_id:currentUser.id}); fetchPosts(); }
async function toggleComments(id) { document.getElementById(`comments-section-${id}`).classList.toggle('hidden'); const {data} = await supabaseClient.from('comments').select('*').eq('post_id', id).order('created_at'); document.getElementById(`comments-list-${id}`).innerHTML = data.map(c => `<div class="text-[11px]"><span class="font-bold text-purple-400">${c.user_name}:</span> ${c.content}</div>`).join(''); }
async function sendComment(id) { const v = document.getElementById(`input-comment-${id}`).value; if(v) { await supabaseClient.from('comments').insert({post_id:id, user_id:currentUser.id, user_name:userProfile.username, content:v}); toggleComments(id); } }

async function fetchPrayers() {
    const c = document.getElementById('prayers-list'); if(!c) return;
    const { data } = await supabaseClient.from('prayers').select('*').order('created_at', {ascending:false});
    c.innerHTML = data.map(p => `<div class="bg-gray-900/60 p-3 rounded-xl border border-pink-500/10 flex justify-between items-center mb-2"><div class="flex-1"><p class="text-[10px] font-bold text-pink-400">${p.user_name}</p><p class="text-xs italic">"${p.content}"</p></div><button onclick="prayFor('${p.id}', ${p.count})" class="ml-3 flex flex-col items-center"><div class="bg-gray-800 p-2 rounded-full border border-gray-600">🙏</div><span class="text-[9px] font-bold mt-1">${p.count}</span></button></div>`).join('');
}
async function addPrayer() { const v = document.getElementById('prayer-input').value; if(v) { await supabaseClient.from('prayers').insert({user_id:currentUser.id, user_name:userProfile.username, content:v, count:0}); document.getElementById('prayer-input').value=''; fetchPrayers(); } }
async function prayFor(id, c) { await supabaseClient.from('prayers').update({count:c+1}).eq('id', id); fetchPrayers(); }

function subscribeToRealtime() {
    supabaseClient.channel('global').on('postgres_changes', { event: '*', schema: 'public' }, p => {
        if(p.table === 'messages') { fetchMessages(); loadConversations(); }
        if(p.table === 'posts') fetchPosts();
        if(p.table === 'likes' && p.eventType === 'INSERT') {
            supabaseClient.from('posts').select('user_id').eq('id', p.new.post_id).single().then(({data}) => { if(data.user_id === currentUser.id && p.new.user_id !== currentUser.id) showNotification("Amen", "Quelqu'un a aimé votre post !"); });
            fetchPosts();
        }
    }).subscribe();
}

// ==========================================
// 8. REELS (Lecture Unique & Mute)
// ==========================================
function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function openAddReelModal() { document.getElementById('add-reel-modal').classList.remove('hidden'); }
function closeAddReelModal() { document.getElementById('add-reel-modal').classList.add('hidden'); }
async function saveReel() {
    const u = document.getElementById('reel-url').value; const c = document.getElementById('reel-caption').value;
    if(u) { await supabaseClient.from('reels').insert({ user_id: currentUser.id, video_url: u, caption: c }); closeAddReelModal(); fetchReels(); }
}
async function fetchReels() {
    const c = document.getElementById('reels-container');
    c.innerHTML = '<div class="flex h-full items-center justify-center"><div class="w-8 h-8 border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div></div>';
    const { data: reels } = await supabaseClient.from('reels').select('*, profiles(username, avatar_url)').order('created_at', {ascending:false});
    c.innerHTML = '';
    if(reels) {
        shuffleArray(reels).forEach(r => {
            let vid = ''; if(r.video_url.includes('shorts/')) vid = r.video_url.split('shorts/')[1].split('?')[0]; else vid = r.video_url.split('/').pop();
            const url = `https://www.youtube.com/embed/${vid}?autoplay=1&controls=0&loop=1&playlist=${vid}&rel=0&playsinline=1&iv_load_policy=3&modestbranding=1&enablejsapi=1&disablekb=1`;
            const av = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${r.profiles?.username}`;
            c.insertAdjacentHTML('beforeend', `
            <div class="reel-item relative w-full h-full flex items-center justify-center bg-black snap-start snap-always overflow-hidden">
                <div class="absolute inset-0 z-0">
                    <iframe id="reel-iframe-${r.id}" class="w-full h-full opacity-0 transition-opacity duration-500 scale-[1.35]" style="pointer-events: none;" data-src="${url}" src="" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    <div class="absolute inset-0 bg-transparent z-10 cursor-pointer" onclick="toggleReelSound('${r.id}')"></div>
                </div>
                <div class="absolute bottom-20 right-4 z-20 flex flex-col gap-6 items-center">
                    <button onclick="toggleReelAmen('${r.id}')" class="bg-black/40 backdrop-blur-md p-3 rounded-full active:scale-90"><i data-lucide="heart" class="w-7 h-7 text-white"></i></button>
                    <button onclick="openReelComments('${r.id}')" class="bg-black/40 backdrop-blur-md p-3 rounded-full active:scale-90"><i data-lucide="message-circle" class="w-7 h-7 text-white"></i></button>
                </div>
                <div class="absolute bottom-4 left-4 right-16 z-20 pointer-events-none">
                    <div class="flex items-center gap-3 mb-2"><img src="${av}" class="w-10 h-10 rounded-full border-2 border-white"><span class="text-white font-bold text-sm shadow-black">@${r.profiles?.username}</span></div>
                    <p class="text-white text-sm line-clamp-2 shadow-black">${r.caption}</p>
                </div>
            </div>`);
        });
        setupReelObserver();
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}
function setupReelObserver() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            const f = e.target.querySelector('iframe');
            if(e.isIntersecting) { if(f.src !== f.dataset.src) { f.src = f.dataset.src; f.classList.remove('opacity-0'); } }
            else { f.src = ""; f.classList.add('opacity-0'); }
        });
    }, { root: document.getElementById('reels-container'), threshold: 0.6 });
    document.querySelectorAll('.reel-item').forEach(i => obs.observe(i));
}
function toggleReelSound(id) { const f = document.getElementById(`reel-iframe-${id}`); if(f) f.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*'); }
async function toggleReelAmen(id) { await supabaseClient.from('reel_likes').insert({reel_id:id, user_id:currentUser.id}); }
async function openReelComments(id) { currentReelIdForComments = id; document.getElementById('reel-comments-modal').classList.remove('hidden'); const {data} = await supabaseClient.from('reel_comments').select('*, profiles(username)').eq('reel_id', id); document.getElementById('reel-comments-list').innerHTML = data.map(c => `<div class="flex gap-2 mb-2"><span class="font-bold text-purple-400 text-sm">${c.profiles.username}</span><span class="text-gray-300 text-sm">${c.content}</span></div>`).join(''); }
