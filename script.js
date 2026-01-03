// --- ÉTAT DE L'APPLICATION (DONNÉES) ---
let currentUser = { name: "Invité", email: "", initials: "IN" };

let posts = [
    { id: 1, user: 'Marie Laurent', time: '2h', content: '🙏 Merci Seigneur pour cette belle journée! #Blessed', likes: 42, likedByMe: false, comments: 8, avatar: 'ML' },
    { id: 2, user: 'Paul Dubois', time: '5h', content: 'Groupe de prière ce soir à 19h. Tous sont bienvenus! ✨', likes: 67, likedByMe: false, comments: 15, avatar: 'PD', isLive: true },
    { id: 3, user: 'Sarah Martin', time: '1j', content: 'Réflexion du jour: "La foi rend toutes choses possibles"', likes: 89, likedByMe: true, comments: 23, avatar: 'SM' }
];

const conversations = [
    { id: 1, user: 'Pasteur Jean', lastMsg: 'Dieu vous bénisse', history: [{sender: 'Pasteur Jean', text: 'Bonjour, comment allez-vous ?'}, {sender: 'me', text: 'Très bien merci !'}] },
    { id: 2, user: 'Groupe Jeunes', lastMsg: 'Réunion samedi', history: [{sender: 'Paul', text: 'Qui vient samedi ?'}] },
    { id: 3, user: 'Chorale', lastMsg: 'Répétition à 18h', history: [{sender: 'Marie', text: 'N\'oubliez pas vos partitions'}] }
];

let currentChatId = null;

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if(typeof lucide !== 'undefined') lucide.createIcons();
    const verses = [
        {txt: "Car Dieu a tant aimé le monde...", ref: "Jean 3:16"}, 
        {txt: "L'Éternel est mon berger...", ref: "Psaume 23:1"}, 
        {txt: "Je puis tout par celui qui me fortifie...", ref: "Phil 4:13"}
    ];
    const randV = verses[Math.floor(Math.random()*verses.length)];
    document.getElementById('verse-container').innerHTML = `
        <p class="mb-1">✨ Verset du jour</p>
        <p class="italic text-white">"${randV.txt}"</p>
        <p class="text-xs text-right text-purple-400 mt-1">- ${randV.ref}</p>
    `;
});

// --- GESTION DU LOGIN (Nouveau : Email + MDP) ---
function handleLogin() {
    const emailInput = document.getElementById('login-email').value;
    const passwordInput = document.getElementById('login-password').value;

    if (emailInput.trim() !== "" && passwordInput.trim() !== "") {
        // Extraction du nom depuis l'email (ex: achour@mail.com -> Achour)
        const namePart = emailInput.split('@')[0];
        // Met la première lettre en majuscule
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        currentUser.name = formattedName;
        currentUser.email = emailInput;
        currentUser.initials = formattedName.substring(0, 2).toUpperCase();
        
        // Mise à jour de l'interface
        updateUI();
        
        // Transition fluide
        const loginPage = document.getElementById('login-page');
        loginPage.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        
        setTimeout(() => {
            loginPage.classList.add('hidden');
            const mainApp = document.getElementById('main-app');
            mainApp.classList.remove('hidden');
            
            // Initialisation des données
            renderPosts();
            renderStories();
            renderMessagesList();
            renderReels();
            renderPrayers();
            lucide.createIcons();
        }, 500);

    } else {
        alert("Veuillez entrer un email et un mot de passe !");
    }
}

function logout() {
    location.reload(); // Recharge la page pour revenir au login
}

function updateUI() {
    document.getElementById('user-display').innerText = `Bonjour, ${currentUser.name}`;
    document.getElementById('profile-name').innerText = currentUser.name;
    document.getElementById('profile-email').innerText = currentUser.email;
    document.getElementById('profile-avatar-big').innerText = currentUser.initials;
    document.getElementById('current-user-avatar-small').innerText = currentUser.initials;
}

// --- LOGIQUE DU FEED (POSTS) ---
function renderPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = posts.map(post => `
        <div class="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30 transition-all hover:bg-gray-800/60">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white shadow-md border border-purple-400/30">${post.avatar}</div>
                    <div>
                        <h3 class="font-bold text-white text-sm sm:text-base">${post.user}</h3>
                        <p class="text-xs text-gray-400 flex items-center gap-1">${post.time} ${post.isLive ? '<span class="text-red-500 font-bold">• LIVE</span>' : ''}</p>
                    </div>
                </div>
                <button class="text-gray-400 hover:text-white"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
            </div>
            <p class="text-purple-100 mb-4 text-sm sm:text-base leading-relaxed">${post.content}</p>
            <div class="flex items-center justify-between border-t border-purple-500/30 pt-3">
                <button onclick="toggleLike(${post.id})" class="flex items-center space-x-2 transition-all active:scale-95 ${post.likedByMe ? 'text-pink-500' : 'text-purple-300 hover:text-pink-400'}">
                    <i data-lucide="heart" class="w-5 h-5 ${post.likedByMe ? 'fill-current' : ''} ${post.likedByMe ? 'liked-anim' : ''}"></i>
                    <span class="text-sm font-medium">${post.likes}</span>
                </button>
                <button class="flex items-center space-x-2 text-purple-300 hover:text-white transition-colors">
                    <i data-lucide="message-circle" class="w-5 h-5"></i>
                    <span class="text-sm">${post.comments}</span>
                </button>
                <button class="flex items-center space-x-2 text-purple-300 hover:text-white transition-colors">
                    <i data-lucide="share-2" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function publishPost() {
    const input = document.getElementById('new-post-input');
    const content = input.value;
    if (content.trim()) {
        const newPost = {
            id: Date.now(),
            user: currentUser.name,
            avatar: currentUser.initials,
            time: 'À l\'instant',
            content: content,
            likes: 0,
            likedByMe: false,
            comments: 0
        };
        posts.unshift(newPost);
        input.value = '';
        renderPosts();
    }
}

function toggleLike(id) {
    const post = posts.find(p => p.id === id);
    if (post) {
        post.likedByMe = !post.likedByMe;
        post.likes += post.likedByMe ? 1 : -1;
        renderPosts();
    }
}

// --- STORIES ---
function renderStories() {
    const storiesData = [
        {name: 'Marie', color: 'from-blue-400 to-purple-500'},
        {name: 'Paul', color: 'from-pink-500 to-orange-500'},
        {name: 'Luc', color: 'from-green-400 to-teal-500'},
        {name: 'Sarah', color: 'from-purple-500 to-indigo-500'}
    ];
    
    let html = `
    <div class="flex flex-col items-center min-w-[64px] cursor-pointer group">
        <div class="w-16 h-16 rounded-full border-2 border-dashed border-purple-500 flex items-center justify-center text-purple-400 text-2xl group-hover:bg-purple-500/20 transition-colors">+</div>
        <span class="text-xs text-purple-200 mt-1">Ajouter</span>
    </div>`;

    html += storiesData.map(s => `
        <div class="flex flex-col items-center min-w-[64px] cursor-pointer group">
            <div class="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr ${s.color} group-hover:scale-105 transition-transform">
                <div class="w-full h-full bg-gray-900 rounded-full flex items-center justify-center font-bold border-2 border-gray-900 text-white">${s.name.substring(0,1)}</div>
            </div>
            <span class="text-xs text-purple-200 mt-1">${s.name}</span>
        </div>
    `).join('');
    
    document.getElementById('stories-container').innerHTML = html;
}

// --- MESSAGERIE ---
function renderMessagesList() {
    const list = document.getElementById('messages-list');
    list.innerHTML = conversations.map(conv => `
        <div onclick="openChat(${conv.id})" class="p-3 bg-gray-900/50 rounded-xl hover:bg-purple-500/20 cursor-pointer flex items-center space-x-3 mb-2 border border-purple-500/10 transition-colors">
            <div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold relative">
                ${conv.user.substring(0,1)}
                <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                    <h4 class="font-bold text-white text-sm truncate">${conv.user}</h4>
                    <span class="text-[10px] text-gray-500">12:30</span>
                </div>
                <p class="text-xs text-gray-400 truncate">${conv.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

function openChat(id) {
    currentChatId = id;
    const conv = conversations.find(c => c.id === id);
    
    // UI Logic pour Mobile
    const msgList = document.getElementById('messages-list').parentElement;
    const chatDetail = document.getElementById('chat-detail');
    
    // Sur mobile, on cache la liste et on montre le chat
    if(window.innerWidth < 768) {
        msgList.classList.add('hidden');
        chatDetail.classList.remove('hidden');
        chatDetail.classList.add('flex'); // Important pour flexbox
        
        // Ajout bouton retour
        const header = chatDetail.querySelector('.border-b');
        if(!document.getElementById('back-btn')) {
            const backBtn = document.createElement('button');
            backBtn.id = 'back-btn';
            backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-6 h-6 text-white mr-2"></i>';
            backBtn.onclick = () => {
                chatDetail.classList.add('hidden');
                chatDetail.classList.remove('flex');
                msgList.classList.remove('hidden');
            };
            header.insertBefore(backBtn, header.firstChild);
            lucide.createIcons();
        }
    } else {
        // Desktop
        chatDetail.classList.remove('hidden');
        chatDetail.classList.add('flex');
    }
    
    document.getElementById('chat-with-name').innerText = conv.user;
    renderChatHistory(conv);
}

function renderChatHistory(conv) {
    const historyDiv = document.getElementById('chat-history');
    historyDiv.innerHTML = conv.history.map(msg => `
        <div class="flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} mb-3">
            <div class="px-4 py-2 rounded-2xl max-w-[75%] shadow-md ${msg.sender === 'me' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}">
                <p class="text-sm">${msg.text}</p>
            </div>
        </div>
    `).join('');
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() && currentChatId) {
        const conv = conversations.find(c => c.id === currentChatId);
        conv.history.push({ sender: 'me', text: input.value });
        conv.lastMsg = "Moi: " + input.value;
        input.value = '';
        renderChatHistory(conv);
        renderMessagesList();
    }
}

// --- REELS (Simulation de contenu) ---
function renderReels() {
    const reelsContainer = document.getElementById('reels-container');
    reelsContainer.innerHTML = [1, 2, 3].map(i => `
        <div class="bg-gray-800 rounded-2xl aspect-[9/16] relative flex items-center justify-center border border-purple-500/20 snap-center shrink-0 shadow-2xl overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-b from-gray-700 to-black opacity-80"></div>
            
            <h2 class="text-2xl font-bold text-gray-500 relative z-10 animate-pulse">Vidéo Courte #${i}</h2>
            
            <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                <div class="flex items-center space-x-2 mb-3">
                    <div class="w-8 h-8 bg-purple-500 rounded-full border border-white"></div>
                    <span class="font-bold text-sm text-white">Chrétien_${i}</span>
                    <button class="text-xs bg-white/20 px-2 py-0.5 rounded ml-2">Suivre</button>
                </div>
                <p class="text-sm text-white mb-2">Un moment de paix pour votre journée... 🙏 #Foi #Paix</p>
                <div class="flex items-center text-xs text-gray-300">
                    <i data-lucide="music" class="w-3 h-3 mr-1"></i> Son original - Louange
                </div>
            </div>
            
            <div class="absolute right-2 bottom-20 flex flex-col space-y-6 items-center z-20">
                <button class="flex flex-col items-center group">
                    <div class="p-2 bg-gray-800/50 rounded-full group-hover:bg-gray-700"><i data-lucide="heart" class="w-6 h-6 text-white group-hover:text-red-500 transition-colors"></i></div>
                    <span class="text-xs font-bold text-white mt-1">12k</span>
                </button>
                <button class="flex flex-col items-center">
                    <div class="p-2 bg-gray-800/50 rounded-full"><i data-lucide="message-circle" class="w-6 h-6 text-white"></i></div>
                    <span class="text-xs font-bold text-white mt-1">342</span>
                </button>
                <button class="flex flex-col items-center">
                     <div class="p-2 bg-gray-800/50 rounded-full"><i data-lucide="share-2" class="w-6 h-6 text-white"></i></div>
                    <span class="text-xs font-bold text-white mt-1">Partager</span>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- PRAYERS ---
function renderPrayers() {
    document.getElementById('prayers-container').innerHTML = `
        <div class="bg-gray-900/50 p-3 rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-all">
            <p class="text-sm text-purple-100 italic">"Priez pour la santé de ma mère hospitalisée..."</p>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-gray-400 font-bold">Jean P.</span>
                <button class="text-xs text-pink-400 flex items-center hover:text-pink-300">❤️ 34 soutiens</button>
            </div>
        </div>
        <div class="bg-gray-900/50 p-3 rounded-xl border border-purple-500/10 hover:border-purple-500/30 transition-all">
            <p class="text-sm text-purple-100 italic">"Pour ma réussite aux examens de fin d'année"</p>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-gray-400 font-bold">Lucie M.</span>
                <button class="text-xs text-pink-400 flex items-center hover:text-pink-300">❤️ 12 soutiens</button>
            </div>
        </div>
    `;
}

// --- NAVIGATION ---
function switchView(viewName) {
    // Liste des vues disponibles
    const views = ['home', 'reels', 'live', 'messages', 'profile'];
    
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        const btn = document.getElementById(`nav-${v}`);
        
        if (v === viewName) {
            el.classList.remove('hidden');
            // Style actif
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-purple-400');
        } else {
            el.classList.add('hidden');
            // Style inactif
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-purple-400');
        }
    });
    
    // Rafraichir les icônes si nécessaire
    lucide.createIcons();
}