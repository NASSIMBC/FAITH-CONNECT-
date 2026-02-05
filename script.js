// ==========================================
// FAITH CONNECT 2.0 - MODULAR ARCHITECTURE
// ==========================================

const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const App = {
    state: {
        user: null,
        profile: null,
        view: 'home'
    },

    // --- INITIALISATION ---
    init: async () => {
        console.log("🚀 FaithConnect v2.0 Starting...");
        await App.Auth.checkSession();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // --- AUTHENTIFICATION ---
    Auth: {
        async checkSession() {
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                App.state.user = session.user;
                await App.Auth.loadProfile();
                App.UI.showApp();
            } else {
                App.UI.showAuth();
            }
        },

        async loadProfile() {
            let { data } = await sb.from('profiles').select('*').eq('id', App.state.user.id).single();
            if (!data) {
                // Création profil auto si inexistant
                const username = App.state.user.email.split('@')[0];
                const newProfile = { id: App.state.user.id, email: App.state.user.email, username: username, bio: "Nouveau membre" };
                await sb.from('profiles').insert([newProfile]);
                data = newProfile;
            }
            App.state.profile = data;
            App.UI.updateProfileDOM();
        },

        async login() {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
            else location.reload();
        },

        async signUp() {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const { error } = await sb.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: email.split('@')[0], // Default username
                        avatar_url: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=random`
                    }
                }
            });
            if (error) alert("Erreur: " + error.message);
            else alert("Compte créé ! Vérifiez vos emails.");
        },

        async logout() {
            await sb.auth.signOut();
            location.reload();
        }
    },

    // --- USER INTERFACE ---
    UI: {
        showAuth() {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-conatiner').classList.add('hidden');
        },

        showApp() {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-conatiner').classList.remove('hidden');
            App.Features.initAll(); // Charger les contenus
        },

        updateProfileDOM() {
            const p = App.state.profile;
            const avatar = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}&background=random`;

            // Header & Sidebar
            ['header-avatar', 'sidebar-avatar', 'feed-avatar', 'profile-page-avatar'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.src = avatar;
            });

            const nameEl = document.getElementById('sidebar-username');
            if (nameEl) nameEl.innerText = p.username;

            const pName = document.getElementById('profile-page-name');
            if (pName) pName.innerText = p.username;

            const pBio = document.getElementById('profile-page-bio');
            if (pBio) pBio.innerText = p.bio || "Pas de bio";
        },

        navigateTo(viewName) {
            // 1. Hide current view
            document.querySelectorAll('.page-view').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('view-transition'); // Reset anim
            });

            // 2. Show new view
            const target = document.getElementById('view-' + viewName);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('view-transition');
            }

            // 3. Update Nav States
            document.querySelectorAll('.nav-btn-desktop, .nav-item').forEach(el => {
                el.classList.remove('text-white', 'bg-white/10', 'active', 'text-primary');
                el.classList.add('text-gray-400');
            });

            const activeDesk = document.getElementById(`desk-nav-${viewName}`);
            if (activeDesk) {
                activeDesk.classList.add('text-white', 'bg-white/10');
                activeDesk.classList.remove('text-gray-400');
            }

            const activeMob = document.getElementById(`mob-nav-${viewName}`);
            if (activeMob) {
                activeMob.classList.add('active');
                activeMob.classList.remove('text-gray-400');
            }

            App.state.view = viewName;

            // Lazy Load Data
            if (viewName === 'groups') App.Features.Groups.fetchAll();
            if (viewName === 'messages') App.Features.Chat.loadList();
            if (viewName === 'profile') App.Features.ProfilePage.init();
            if (viewName === 'prayers') App.Features.Prayers.load();
            if (viewName === 'events') App.Features.Events.load();
            if (viewName === 'marketplace') App.Features.Marketplace.load();
        },

        modals: {
            closeAll() {
                document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
            },
            editProfile: {
                open() {
                    document.getElementById('edit-username').value = App.state.profile.username;
                    document.getElementById('edit-bio').value = App.state.profile.bio || "";
                    document.getElementById('modal-profile').classList.remove('hidden');
                }
            },
            faithAI: {
                open() { document.getElementById('modal-faith-ai').classList.remove('hidden'); }
            },
            creator: {
                open() { document.getElementById('modal-creator').classList.remove('hidden'); }
            }
        },

        switchCreatorTab(tab) {
            const btnP = document.getElementById('tab-creator-post');
            const btnV = document.getElementById('tab-creator-verse');
            const contentP = document.getElementById('creator-post-content');
            const contentV = document.getElementById('creator-verse-content');

            if (tab === 'post') {
                btnP.classList.add('border-primary', 'text-white'); btnP.classList.remove('border-transparent', 'text-gray-400');
                btnV.classList.remove('border-primary', 'text-white'); btnV.classList.add('border-transparent', 'text-gray-400');
                contentP.classList.remove('hidden');
                contentV.classList.add('hidden');
            } else {
                btnV.classList.add('border-primary', 'text-white'); btnV.classList.remove('border-transparent', 'text-gray-400');
                btnP.classList.remove('border-primary', 'text-white'); btnP.classList.add('border-transparent', 'text-gray-400');
                contentV.classList.remove('hidden');
                contentP.classList.add('hidden');
                App.Features.VerseCreator.initCanvas();
            }
        },

        switchProfileTab(tab) {
            const btnP = document.getElementById('tab-profile-posts');
            const btnF = document.getElementById('tab-profile-friends');
            const contentP = document.getElementById('profile-posts-container');
            const contentF = document.getElementById('profile-friends-container');

            if (tab === 'posts') {
                btnP.classList.add('bg-white/10', 'text-white'); btnP.classList.remove('text-gray-400');
                btnF.classList.remove('bg-white/10', 'text-white'); btnF.classList.add('text-gray-400');
                contentP.classList.remove('hidden');
                contentF.classList.add('hidden');
            } else {
                btnF.classList.add('bg-white/10', 'text-white'); btnF.classList.remove('text-gray-400');
                btnP.classList.remove('bg-white/10', 'text-white'); btnP.classList.add('text-gray-400');
                contentF.classList.remove('hidden');
                contentP.classList.add('hidden');
                App.Features.ProfilePage.loadFriends();
            }
        },

        toggleNotifs() { alert("Centre de notifications à venir !"); },

        toggleMobileSearch() {
            const overlay = document.getElementById('mobile-search-overlay');
            const input = document.getElementById('mobile-search-input');
            if (overlay) {
                overlay.classList.toggle('hidden');
                if (!overlay.classList.contains('hidden') && input) input.focus();
            }
        }
    },

    // --- FONCTIONNALITÉS MÉTIERS ---
    Features: {
        initAll() {
            this.Feed.loadDailyVerse();
            this.Feed.loadPosts();
            this.Bible.init();
            this.Prayers.load();
            this.Events.loadWidget();
            this.Marketplace.initSearch();
            if (window.innerWidth > 768) App.Features.Chat.loadList();

            // Initialisation Groupes & Realtime
            if (App.state.view === 'groups') this.Groups.fetchAll(); // Load if on groups view
            this.Realtime.init();

            // Search Listener (Chat Sidebar)
            const searchInput = document.querySelector('#msg-sidebar input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value.toLowerCase();
                    const items = document.querySelectorAll('#conversations-list > div');
                    items.forEach(item => {
                        const name = item.querySelector('h4').innerText.toLowerCase();
                        item.style.display = name.includes(val) ? 'flex' : 'none';
                    });
                });
            }
        },

        // 1. FEED & POSTS
        Feed: {
            selectedImage: null,

            async loadDailyVerse() {
                // Versets Populaires (Liste locale robuste pour éviter les erreurs API)
                const verses = [
                    { t: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique...", r: "Jean 3:16" },
                    { t: "L'Éternel est mon berger: je ne manquerai de rien.", r: "Psaumes 23:1" },
                    { t: "Je puis tout par celui qui me fortifie.", r: "Philippiens 4:13" },
                    { t: "Car rien n'est impossible à Dieu.", r: "Luc 1:37" },
                    { t: "Ne t'ai-je pas donné cet ordre : Fortifie-toi et prends courage ?", r: "Josué 1:9" },
                    { t: "Venez à moi, vous tous qui êtes fatigués et chargés...", r: "Matthieu 11:28" },
                    { t: "Si Dieu est pour nous, qui sera contre nous ?", r: "Romains 8:31" },
                    { t: "C'est par la grâce que vous êtes sauvés, par le moyen de la foi.", r: "Éphésiens 2:8" },
                    { t: "Invoque-moi, et je te répondrai.", r: "Jérémie 33:3" },
                    { t: "Lequel de vous, par ses inquiétudes, peut ajouter une coudée à la durée de sa vie?", r: "Matthieu 6:27" },
                    { t: "Confie-toi en l'Éternel de tout ton cœur.", r: "Proverbes 3:5" },
                    { t: "La paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs.", r: "Philippiens 4:7" },
                    { t: "Jésus lui dit: Je suis le chemin, la vérité, et la vie.", r: "Jean 14:6" }
                ];
                // Jour de l'année pour rotation stable
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 0);
                const diff = now - start;
                const oneDay = 1000 * 60 * 60 * 24;
                const dayOfYear = Math.floor(diff / oneDay);

                const verse = verses[dayOfYear % verses.length];

                const txt = document.getElementById('daily-verse-text');
                const ref = document.getElementById('daily-verse-ref');
                // Container pour ajouter bouton Copier/Partager si absent
                const container = document.querySelector('#daily-verse-container .relative.z-10');

                if (txt) txt.innerText = `"${verse.t}"`;
                if (ref) ref.innerText = verse.r;

                // Ajouter boutons d'action si pas déjà là
                if (container && !document.getElementById('verse-actions')) {
                    const actions = document.createElement('div');
                    actions.id = 'verse-actions';
                    actions.className = 'mt-4 flex gap-3';
                    actions.innerHTML = `
                        <button onclick="App.Features.Feed.copyVerse('${verse.t} ${verse.r}')" class="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white" title="Copier"><i data-lucide="copy" class="w-4 h-4"></i></button>
                        <button onclick="App.Features.Feed.shareVerse('${verse.t} ${verse.r}')" class="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white" title="Partager"><i data-lucide="share-2" class="w-4 h-4"></i></button>
                    `;
                    container.appendChild(actions);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            },

            copyVerse(text) {
                navigator.clipboard.writeText(text).then(() => alert("Verset copié !"));
            },

            shareVerse(text) {
                if (navigator.share) {
                    navigator.share({
                        title: 'Verset du Jour - Faith Connect',
                        text: text,
                        url: window.location.href
                    }).catch(console.error);
                } else {
                    this.copyVerse(text);
                }
            },

            async loadPosts() {
                const container = document.getElementById('feed-container');
                if (!container) return;

                const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false }).limit(20);

                if (posts && posts.length > 0) {
                    container.innerHTML = posts.map(post => App.Features.Feed.renderPost(post)).join('');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } else {
                    container.innerHTML = `<div class="text-center text-gray-500 py-10">Soyez la première lumière ici. ✨</div>`;
                }
            },

            renderPost(post) {
                const avatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles?.username || 'Inconnu'}`;
                return `
                <article class="glass-panel p-5 rounded-[24px] animate-slide-in-up">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <h4 class="font-bold text-sm text-white">${post.profiles?.username || 'Anonyme'}</h4>
                            <p class="text-[10px] text-gray-500">${new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <p class="text-gray-200 text-sm leading-relaxed mb-4 font-light">${post.content}</p>
                    ${post.image_url ? `<img src="${post.image_url}" class="w-full rounded-2xl mb-4 border border-white/5 bg-black/50">` : ''}
                    <div class="flex gap-4 border-t border-white/5 pt-3">
                        <button class="flex items-center gap-2 text-xs text-gray-400 hover:text-pink-400 transition"><i data-lucide="heart" class="w-4 h-4"></i> Amen</button>
                        <button class="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-400 transition"><i data-lucide="message-circle" class="w-4 h-4"></i> Commenter</button>
                    </div>
                </article>
                `;
            },

            openCreator() { App.UI.modals.creator.open(); },

            handleImageSelect(input) {
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        document.getElementById('preview-img').src = e.target.result;
                        document.getElementById('post-image-preview').classList.remove('hidden');
                        this.selectedImage = input.files[0];
                    };
                    reader.readAsDataURL(input.files[0]);
                }
            },

            removeImage() {
                document.getElementById('post-file').value = "";
                document.getElementById('post-image-preview').classList.add('hidden');
                this.selectedImage = null;
            },

            async publish() {
                const content = document.getElementById('post-input').value;
                if (!content && !this.selectedImage) return alert("Écrivez quelque chose ou ajoutez une image.");

                let imageUrl = null;
                // Upload image if exists
                if (this.selectedImage) {
                    const fileExt = this.selectedImage.name.split('.').pop();
                    const fileName = `${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await sb.storage.from('posts').upload(fileName, this.selectedImage);
                    if (uploadError) return alert("Erreur upload: " + uploadError.message);
                    const { data: { publicUrl } } = sb.storage.from('posts').getPublicUrl(fileName);
                    imageUrl = publicUrl;
                }

                const { error } = await sb.from('posts').insert([{
                    user_id: App.state.user.id,
                    content: content,
                    image_url: imageUrl,
                    type: 'post'
                }]);

                if (error) alert(error.message);
                else {
                    App.UI.modals.closeAll();
                    document.getElementById('post-input').value = "";
                    this.removeImage();
                    this.loadPosts(); // Reload feed
                }
            }
        },

        // 1.5 VERSE CREATOR
        VerseCreator: {
            ctx: null,
            canvas: null,
            bgImage: null,
            text: "Jésus est Seigneur",
            ref: "Romains 10:9",

            initCanvas() {
                this.canvas = document.getElementById('verse-canvas');
                this.ctx = this.canvas.getContext('2d');

                // Image de fond par défaut (Random Unsplash)
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&q=80&w=1000";
                img.onload = () => {
                    this.bgImage = img;
                    this.draw();
                }

                // Bind inputs
                document.getElementById('verse-text-input').addEventListener('input', (e) => { this.text = e.target.value; this.draw(); });
                document.getElementById('verse-ref-input').addEventListener('input', (e) => { this.ref = e.target.value; this.draw(); });
            },

            draw() {
                if (!this.ctx || !this.bgImage) return;
                const { width, height } = this.canvas;

                // Background
                this.ctx.drawImage(this.bgImage, 0, 0, width, height);

                // Overlay Dark
                this.ctx.fillStyle = "rgba(0,0,0,0.5)";
                this.ctx.fillRect(0, 0, width, height);

                // Text
                this.ctx.fillStyle = "white";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.shadowColor = "black";
                this.ctx.shadowBlur = 20;

                // Auto-wrap simple
                this.ctx.font = "bold 60px Inter"; // Taille fixe pour simplifier
                this.wrapText(this.ctx, `"${this.text}"`, width / 2, height / 2 - 50, width - 200, 80);

                this.ctx.font = "italic 40px Lora";
                this.ctx.fillText(this.ref, width / 2, height / 2 + 100);
            },

            wrapText(ctx, text, x, y, maxWidth, lineHeight) {
                var words = text.split(' ');
                var line = '';
                var lines = [];

                for (var n = 0; n < words.length; n++) {
                    var testLine = line + words[n] + ' ';
                    var metrics = ctx.measureText(testLine);
                    var testWidth = metrics.width;
                    if (testWidth > maxWidth && n > 0) {
                        lines.push(line);
                        line = words[n] + ' ';
                    } else {
                        line = testLine;
                    }
                }
                lines.push(line);

                let startY = y - ((lines.length - 1) * lineHeight) / 2;
                for (let k = 0; k < lines.length; k++) {
                    ctx.fillText(lines[k], x, startY + (k * lineHeight));
                }
            },

            setBackground() {
                const terms = ["nature", "sky", "mountains", "space", "light"];
                const term = terms[Math.floor(Math.random() * terms.length)];
                const img = new Image();
                img.crossOrigin = "anonymous";
                // Random Image
                img.src = `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1504052434569-70ad5836ab65' : '1464822759023-fed622ff2c3b'}?auto=format&fit=crop&q=80&w=1000&random=${Math.random()}`; // Hack simple pour demo
                img.onload = () => {
                    this.bgImage = img;
                    this.draw();
                }
            },

            async download() {
                if (!this.canvas) return;
                const link = document.createElement('a');
                link.download = `verset-faithconnect-${Date.now()}.png`;
                link.href = this.canvas.toDataURL();
                link.click();
            },

            async publish() {
                this.canvas.toBlob(async (blob) => {
                    const fileName = `verse_${Date.now()}.png`;
                    // FIX: Using 'posts' bucket instead of 'reels' which might not exist
                    const { error: uploadError } = await sb.storage.from('posts').upload(fileName, blob);
                    if (uploadError) return alert("Erreur upload: " + uploadError.message);

                    const { data: { publicUrl } } = sb.storage.from('posts').getPublicUrl(fileName);

                    const { error } = await sb.from('posts').insert([{ // Inserting into posts for visibility
                        user_id: App.state.user.id,
                        type: 'image',
                        image_url: publicUrl,
                        content: this.text // Use caption as content
                    }]);

                    if (error) alert(error.message);
                    else {
                        alert("Verset publié !");
                        App.UI.modals.closeAll();
                        App.Features.Feed.loadPosts(); // Refresh feed
                    }
                });
            }
        },

        // 1.8 FAITH AI (CODE UTILISATEUR RESTAURÉ)
        FaithAI: {
            async ask() {
                const input = document.getElementById('ai-question-input');
                const container = document.getElementById('ai-chat-response'); // Id adapté au nouveau design
                const question = input.value.trim();

                // Ton URL Supabase correcte
                const FUNCTION_URL = 'https://uduajuxobmywmkjnawjn.supabase.co/functions/v1/faith-ai';
                if (!question) return;

                console.log("Faith AI Request:", FUNCTION_URL);
                // Indicateur de chargement
                const loadingId = 'ai-loading-' + Date.now();
                container.innerHTML += `<div id="${loadingId}" class="flex items-center gap-2 text-purple-300 text-xs animate-pulse mt-4">Faith AI réfléchit...</div>`;
                container.scrollTop = container.scrollHeight;
                input.value = '';

                try {
                    const res = await fetch(FUNCTION_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        },
                        body: JSON.stringify({ question: question })
                    });

                    if (res.status === 401) {
                        throw new Error("Authentification refusée (401). Vérifiez la clé API.");
                    }

                    const data = await res.json();

                    // Retrait du chargement
                    const loadingEl = document.getElementById(loadingId);
                    if (loadingEl) loadingEl.remove();

                    if (data.error) throw new Error(data.error);

                    // Affichage de la réponse (Format demandé)
                    container.innerHTML += `
                    <div class="mt-4 bg-gray-800/50 border-l-4 border-purple-500 pl-3 py-4 rounded-r-lg shadow-lg animate-slide-in-up">
                        <p class="text-[10px] text-gray-500 mb-2 uppercase tracking-wide font-bold">Question : "${question}"</p>
                        <p class="text-white text-sm font-serif leading-relaxed text-justify whitespace-pre-line">${data.answer}</p>
                    </div>`;

                    if (typeof lucide !== 'undefined') lucide.createIcons();

                } catch (error) {
                    console.error("Erreur Faith AI:", error);
                    const loadingEl = document.getElementById(loadingId);
                    if (loadingEl) loadingEl.remove();
                    container.innerHTML += `<div class="mt-4 text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/20">Erreur : ${error.message}</div>`;
                }
                container.scrollTop = container.scrollHeight;
            }
        },

        // 2. BIBLE READER (FULL API)
        Bible: {
            currentVersion: 'KJV', // Switch to KJV as default (LSG seems unstable)
            currentBookId: 43, // John
            currentChapter: 1,
            booksData: [], // Cache des livres

            async init() {
                // Charger la liste des livres pour la version par défaut
                await this.fetchBooks();
            },

            async fetchBooks() {
                const nav = document.getElementById('bible-books-nav');
                if (!nav) return;

                nav.innerHTML = '<div class="text-xs text-gray-500 whitespace-nowrap px-4">Chargement de la bibliothèque...</div>';

                try {
                    // API Bolls.life
                    const res = await fetch(`https://bolls.life/get-books/${this.currentVersion}/`);
                    if (!res.ok) throw new Error('Erreur API');

                    const data = await res.json();
                    this.booksData = data; // stocker pour filtrage

                    this.renderBooks(data);

                    // Charger défaut si pas encore fait
                    if (document.getElementById('bible-content').innerHTML.includes('Sélectionnez')) {
                        // Trouver l'ID de Jean (souvent 43) ou le premier livre
                        const john = data.find(b => b.name === 'Jean' || b.name === 'John') || data[0];
                        if (john) this.load(john.bookid, 1, john.name);
                    }

                } catch (e) {
                    console.error(e);
                    nav.innerHTML = '<div class="text-xs text-red-400 px-4">Erreur chargement livres.</div>';
                }
            },

            renderBooks(books) {
                const nav = document.getElementById('bible-books-nav');
                if (!nav) return;

                nav.innerHTML = books.map((b) =>
                    `<button onclick="App.Features.Bible.load(${b.bookid}, 1, '${b.name.replace(/'/g, "\\'")}')" 
                        class="whitespace-nowrap px-4 py-2 bg-white/5 rounded-full text-xs hover:bg-primary hover:text-white transition border border-white/5 flex-shrink-0 snap-start
                        ${b.bookid === this.currentBookId ? 'bg-primary text-white ring-2 ring-purple-400/50' : ''}" id="book-btn-${b.bookid}">
                        ${b.name}
                    </button>`
                ).join('');
            },

            filterBooks(type) {
                // type: 'all', 'OT' (Old Testament < 40), 'NT' (New Testament >= 40)
                // Note: Cette logique dépend des IDs standards (1-39 AT, 40-66 NT)
                if (!this.booksData.length) return;

                let filtered = this.booksData;
                if (type === 'OT') filtered = this.booksData.filter(b => b.bookid <= 39);
                if (type === 'NT') filtered = this.booksData.filter(b => b.bookid >= 40);

                this.renderBooks(filtered);

                // Mettre à jour les styles de boutons actifs pour les filtres (visuel rapide)
                const btns = document.querySelectorAll('#view-bible button[onclick^="App.Features.Bible.filterBooks"]');
                btns.forEach(btn => {
                    if (btn.innerText.includes(type === 'all' ? 'Tous' : type === 'OT' ? 'Ancien' : 'Nouveau')) {
                        btn.classList.add('text-white', 'border-b-2', 'border-primary');
                        btn.classList.remove('text-gray-400');
                    } else {
                        btn.classList.remove('text-white', 'border-b-2', 'border-primary');
                        btn.classList.add('text-gray-400');
                    }
                });
            },

            async load(bookId, chap, bookName) {
                this.currentBookId = bookId;
                this.currentChapter = chap;
                this.currentBookName = bookName; // Sauvegarde nom

                const container = document.getElementById('bible-content');
                const title = document.getElementById('bible-current-ref');

                // Update active book style
                document.querySelectorAll('[id^="book-btn-"]').forEach(b => b.classList.remove('bg-primary', 'text-white', 'ring-2'));
                const activeBtn = document.getElementById(`book-btn-${bookId}`);
                if (activeBtn) activeBtn.classList.add('bg-primary', 'text-white', 'ring-2');

                if (title) title.innerText = `${bookName} ${chap}`;
                if (container) {
                    container.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-40 animate-pulse">
                            <i data-lucide="loader-2" class="w-8 h-8 text-primary animate-spin mb-4"></i>
                            <span class="text-xs text-gray-500">Chargement de la Parole...</span>
                        </div>`;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                try {
                    const res = await fetch(`https://bolls.life/get-chapter/${this.currentVersion}/${bookId}/${chap}/`);
                    if (!res.ok) throw new Error('Erreur Chapitre');

                    const data = await res.json();

                    if (data && data.length > 0) {
                        container.innerHTML = data.map(v =>
                            `<span class="bible-verse-num font-bold text-primary/50 mr-1 select-none text-xs" style="vertical-align: super;">${v.verse}</span><span class="hover:bg-white/5 transition rounded px-1">${v.text}</span> `
                        ).join('');
                    } else {
                        container.innerHTML = '<div class="text-center text-gray-500 py-10">Fin du livre ou chapitre introuvable.</div>';
                    }
                    // Scroll top
                    container.parentElement.scrollTop = 0;

                } catch (e) {
                    console.error(e);
                    container.innerHTML = "<div class='text-center text-red-400 py-10'>Erreur de chargement. Vérifiez votre connexion.</div>";
                }
            },

            async changeVersion(newVersion) {
                this.currentVersion = newVersion;
                // Recharger les livres (les noms peuvent changer selon la langue)
                await this.fetchBooks();
                // Recharger le chapitre courant
                // Note: On garde l'ID du livre, ça devrait correspondre entre les versions majeures
                await this.load(this.currentBookId, this.currentChapter, this.currentBookName || "Livre");
            },

            prevChap() {
                if (this.currentChapter > 1) {
                    this.load(this.currentBookId, this.currentChapter - 1, this.currentBookName);
                } else {
                    // Aller au livre précédent (chapitre max) - un peu complexe sans connaitre le max chaps, on simplifie
                    // On pourrait aller au chap 1 du livre précédent
                    if (this.currentBookId > 1) {
                        // On doit trouver le nom du livre précédent
                        const prevBook = this.booksData.find(b => b.bookid === this.currentBookId - 1);
                        if (prevBook) this.load(prevBook.bookid, 1, prevBook.name);
                    }
                }
            },

            nextChap() {
                // Pour savoir si c'est le dernier chapitre, faudrait vérifier la length du fetch précédent ou avoir les métadonnées
                // On tente simplement +1, l'API renverra vide si existe pas (et on peut gérer)
                this.load(this.currentBookId, this.currentChapter + 1, this.currentBookName);
            }
        },

        // 3. PRAYERS
        Prayers: {
            async load() {
                const widgetContainer = document.getElementById('widget-prayers-list');
                const mainContainer = document.getElementById('prayers-container');

                const { data } = await sb.from('prayers').select('*').order('created_at', { ascending: false }).limit(20);

                if (data) {
                    const html = data.map(p => `
                        <div class="glass-panel p-4 rounded-xl flex flex-col gap-2 relative group hover:border-primary/30 transition-colors">
                            <div class="flex justify-between items-start">
                                <span class="font-bold text-sm text-primary">${p.user_name}</span>
                                <span class="text-[10px] text-gray-500">${new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                            <p class="text-sm text-gray-200 italic leading-relaxed">"${p.content}"</p>
                            <div class="mt-2 flex justify-end">
                                <button class="text-xs text-gray-400 hover:text-pink-400 flex items-center gap-1 transition">
                                    <i data-lucide="heart" class="w-3 h-3"></i> Soutenir (${p.count})
                                </button>
                            </div>
                        </div>
                    `).join('');

                    if (widgetContainer) widgetContainer.innerHTML = data.slice(0, 5).map(p => `
                        <div class="flex justify-between items-start border-b border-white/5 pb-2 last:border-0">
                            <div><p class="text-[10px] text-primary font-bold">${p.user_name}</p><p class="text-xs text-gray-300 italic truncate w-40">"${p.content}"</p></div>
                            <span class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500">🙏 ${p.count}</span>
                        </div>
                    `).join('');

                    if (mainContainer) mainContainer.innerHTML = html;
                }
            },

            async add() { this._add('widget-prayer-input'); },
            async addMain() { this._add('main-prayer-input'); },

            async _add(inputId) {
                const input = document.getElementById(inputId);
                if (!input || !input.value) return;
                await sb.from('prayers').insert([{ user_id: App.state.user.id, user_name: App.state.profile.username, content: input.value, count: 0 }]);
                input.value = "";
                alert("Prière publiée 🙏");
                this.load();
            }
        },

        // 3. MARKETPLACE (Vente & Achat)
        Marketplace: {
            items: [
                { t: "T-Shirt Foi", p: "25€", img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop&q=60", s: "FaithBrand" },
                { t: "Bible Journaling", p: "30€", img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop&q=60", s: "LibrairieVie" },
                { t: "Mug Verset", p: "12€", img: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500&auto=format&fit=crop&q=60", s: "CadeauxCiel" },
                { t: "Bracelet Croix", p: "15€", img: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&auto=format&fit=crop&q=60", s: "BijouxSens" },
                { t: "Hoodie Blessed", p: "45€", img: "https://images.unsplash.com/photo-1556906781-9a412961d289?w=500&auto=format&fit=crop&q=60", s: "ModeChretienne" },
                { t: "Tableau Déco", p: "60€", img: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60", s: "ArtFoi" }
            ],

            load(filter = "") {
                const container = document.getElementById('marketplace-grid');
                if (!container) return;

                const filtered = this.items.filter(p =>
                    p.t.toLowerCase().includes(filter.toLowerCase()) ||
                    p.s.toLowerCase().includes(filter.toLowerCase())
                );

                if (filtered.length === 0) {
                    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Aucun article trouvé pour "${filter}".</div>`;
                    return;
                }

                container.innerHTML = filtered.map(p => `
                    <div class="glass-panel p-0 rounded-2xl overflow-hidden group cursor-pointer hover:border-primary/50 transition relative">
                        <div class="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm z-10">${p.p}</div>
                        <div class="h-40 overflow-hidden">
                            <img src="${p.img}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                        </div>
                        <div class="p-3">
                            <h4 class="font-bold text-sm text-white truncate">${p.t}</h4>
                            <p class="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                <i data-lucide="store" class="w-3 h-3"></i> ${p.s}
                            </p>
                            <button class="w-full mt-3 bg-white/10 hover:bg-primary text-xs font-bold py-2 rounded-lg transition-colors">Acheter</button>
                        </div>
                    </div>
                `).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            initSearch() {
                const input = document.getElementById('marketplace-search');
                if (input) {
                    input.addEventListener('input', (e) => {
                        this.load(e.target.value);
                    });
                }
            },

            openSellModal() {
                const modal = document.getElementById('modal-sell');
                if (modal) {
                    modal.classList.remove('hidden');
                    // Reset fields
                    document.getElementById('sell-title').value = '';
                    document.getElementById('sell-price').value = '';
                }
            },

            publish() {
                const title = document.getElementById('sell-title').value;
                const price = document.getElementById('sell-price').value;
                // Mock image for demo
                const img = "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=500&auto=format&fit=crop&q=60";

                if (!title || !price) return alert("Veuillez remplir les champs.");

                // Add to list
                this.items.unshift({
                    t: title,
                    p: price + "€",
                    img: img,
                    s: App.state.profile.username || "Moi"
                });

                alert("Article mis en vente !");
                App.UI.modals.closeAll();
                this.load(); // Refresh grid
            }
        },

        // 4. EVENTS
        Events: {
            load() {
                this.loadWidget(); // Keep widget sync

                const list = [
                    { t: "Culte de Louange & Adoration", d: "Dimanche 10h00", l: "Paris & Online", img: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
                    { t: "Maraude Solidaire", d: "Mardi 19h30", l: "Gare du Nord", img: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
                    { t: "Étude Biblique Zoom", d: "Jeudi 20h00", l: "Lien privé", img: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" },
                    { t: "Concert Gospel", d: "Samedi 25 Oct, 20h", l: "Salle Pleyel", img: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" }
                ];

                const mainContainer = document.getElementById('events-container');
                if (mainContainer) {
                    mainContainer.innerHTML = list.map(e => `
                        <div class="glass-panel p-0 rounded-2xl overflow-hidden flex flex-col md:flex-row hover:shadow-glow transition-all">
                            <img src="${e.img}" class="w-full md:w-48 h-32 object-cover">
                            <div class="p-4 flex-1 flex flex-col justify-center">
                                <h4 class="font-bold text-lg text-white mb-1">${e.t}</h4>
                                <div class="flex flex-col md:flex-row gap-2 md:gap-6 text-sm text-gray-400">
                                    <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-4 h-4 text-primary"></i> ${e.d}</span>
                                    <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-4 h-4 text-primary"></i> ${e.l}</span>
                                </div>
                                <div class="mt-3 flex gap-2">
                                     <button class="px-4 py-1.5 bg-primary/20 hover:bg-primary/40 text-primary text-xs font-bold rounded-lg transition">Je participe</button>
                                     <button class="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition">Détails</button>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            },

            loadWidget() {
                const list = [
                    { t: "Louange Live", d: "Dimanche 10h", l: "Paris" },
                    { t: "Maraude", d: "Mardi 20h", l: "Gare Nord" }
                ];
                const c = document.getElementById('widget-events-list');
                if (c) {
                    c.innerHTML = list.map(e => `
                        <div class="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                            <div class="bg-primary/20 text-primary p-2 rounded-lg"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                            <div>
                                <p class="font-bold text-xs text-white">${e.t}</p>
                                <p class="text-[10px] text-gray-400">${e.d} • ${e.l}</p>
                            </div>
                        </div>
                    `).join('');
                }
            }
        },

        // 5. CHAT (MESSAGERIE COMPLÈTE & RECHERCHE)
        Chat: {
            activeContactId: null,

            async loadList() {
                this.loadConversations();
            },

            async loadConversations() {
                const container = document.getElementById('conversations-list');
                if (!container) return;

                // 1. Récupérer tous les profils (Simulation d'amis pour l'instant)
                const { data: profiles } = await sb.from('profiles').select('*').neq('id', App.state.user.id).limit(50);

                if (profiles) {
                    container.innerHTML = profiles.map(p => `
                        <div onclick="App.Features.Chat.openChat('${p.id}', '${p.username}', '${p.avatar_url}')" 
                             class="p-4 flex items-center gap-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors">
                            <div class="relative">
                                <img src="${p.avatar_url || 'https://ui-avatars.com/api/?name=' + p.username}" class="w-10 h-10 rounded-full object-cover bg-gray-800">
                                <span class="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-[#050510]" id="status-${p.id}"></span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-baseline">
                                    <h4 class="font-bold text-sm text-white truncate">${p.username}</h4>
                                </div>
                                <p class="text-xs text-gray-400 truncate">Cliquez pour discuter</p>
                            </div>
                        </div>
                    `).join('');
                }
            },

            async openChat(userId, username, avatar) {
                this.activeContactId = userId;

                // UI Update
                const header = document.getElementById('chat-header');
                const msgsContainer = document.getElementById('chat-messages');
                const input = document.getElementById('chat-input');

                if (window.innerWidth < 768) {
                    const msgArea = document.getElementById('msg-area');
                    msgArea.classList.remove('hidden');
                    msgArea.classList.add('flex'); // Ensure flex layout for column direction
                    document.getElementById('msg-sidebar').classList.add('hidden');

                    // Fullscreen Mode: Hide Mobile Nav & Expand View
                    const nav = document.querySelector('.glass-nav.fixed.bottom-0'); // Mobile nav
                    const view = document.getElementById('view-messages');
                    if (nav) nav.classList.add('hidden');
                    if (view) {
                        view.classList.remove('bottom-[85px]', 'z-40');
                        view.classList.add('bottom-0', 'z-50');
                    }
                }

                if (header) header.innerHTML = `
                    <div class="flex items-center gap-3">
                        <button class="md:hidden p-1 mr-2" onclick="App.Features.Chat.closeMobileChat()"><i data-lucide="arrow-left"></i></button>
                        <img src="${avatar || 'https://ui-avatars.com/api/?name=' + username}" class="w-8 h-8 rounded-full">
                        <span class="font-bold text-white">${username}</span>
                    </div>
                `;

                if (input) {
                    input.disabled = false;
                    input.focus();
                }

                msgsContainer.innerHTML = '<div class="text-center text-xs text-gray-500 py-10">Chargement...</div>';

                const { data: messages } = await sb.from('messages')
                    .select('*')
                    .or(`and(sender_id.eq.${App.state.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${App.state.user.id})`)
                    .order('created_at', { ascending: true });

                msgsContainer.innerHTML = '';
                if (messages && messages.length > 0) {
                    messages.forEach(m => this.renderMessage(m));
                } else {
                    msgsContainer.innerHTML = '<div class="text-center text-xs text-gray-500 py-10">Aucun message. Dites bonjour ! 👋</div>';
                }
                msgsContainer.scrollTop = msgsContainer.scrollHeight;
            },

            closeMobileChat() {
                const msgArea = document.getElementById('msg-area');
                msgArea.classList.add('hidden');
                msgArea.classList.remove('flex'); // Cleanup
                document.getElementById('msg-sidebar').classList.remove('hidden');
                this.activeContactId = null;

                // Restore Mobile Nav & View Height
                if (window.innerWidth < 768) {
                    const nav = document.querySelector('.glass-nav.fixed.bottom-0'); // Mobile nav
                    const view = document.getElementById('view-messages');
                    if (nav) nav.classList.remove('hidden');
                    if (view) {
                        view.classList.remove('bottom-0', 'z-50');
                        view.classList.add('bottom-[85px]', 'z-40');
                    }
                }
            },

            renderMessage(msg) {
                // Clear "Empty" msg if exists
                if (document.getElementById('chat-messages').innerHTML.includes('Aucun message')) {
                    document.getElementById('chat-messages').innerHTML = '';
                }

                const isMe = msg.sender_id === App.state.user.id;
                const container = document.getElementById('chat-messages');

                const div = document.createElement('div');
                div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 animate-slide-in-up`;
                div.innerHTML = `
                    <div class="max-w-[75%] px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'} shadow-sm">
                        <p class="text-sm break-words">${msg.content}</p>
                        <p class="text-[9px] opacity-50 text-right mt-1">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                `;
                container.appendChild(div);
                setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50); // Delay for layout
            },

            async send() {
                const input = document.getElementById('chat-input');
                const content = input.value;
                if (!content || !this.activeContactId) return;

                const { error } = await sb.from('messages').insert([{
                    sender_id: App.state.user.id,
                    receiver_id: this.activeContactId,
                    content: content
                }]);

                if (error) alert("Erreur envoi: " + error.message);
                else {
                    input.value = "";
                    input.focus(); // Keep focus
                    this.renderMessage({
                        sender_id: App.state.user.id,
                        content: content,
                        created_at: new Date().toISOString()
                    });
                }
            }
        },

        // 6. SEARCH & PROFILE
        Search: {
            async searchUser(query) {
                // Implementer dans UI si besoin
            }
        },

        // 7. GROUPS (FIXED)
        Groups: {
            async fetchAll() {
                const container = document.getElementById('groups-container');
                if (!container) return;

                container.innerHTML = '<div class="col-span-full text-center text-xs text-gray-500 animate-pulse">Recherche des groupes...</div>';

                const { data: groups, error } = await sb.from('groups').select('*');

                if (error || !groups || groups.length === 0) {
                    container.innerHTML = `
                        <div class="col-span-full text-center py-10">
                            <p class="text-gray-400 mb-4">Aucun groupe trouvé.</p>
                            <button onclick="App.Features.Groups.createModal()" class="btn-primary px-4 py-2 rounded-xl">Créer le premier groupe</button>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = groups.map(g => `
                    <div class="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all group">
                        <div class="h-24 bg-gray-800 relative">
                             <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                        </div>
                        <div class="p-4 relative -mt-6">
                            <h4 class="font-bold text-white text-lg leading-tight mb-1">${g.name}</h4>
                            <p class="text-xs text-gray-400 mb-3 line-clamp-2">${g.description || 'Pas de description'}</p>
                            <button class="w-full bg-white/5 hover:bg-primary py-2 rounded-lg text-xs font-bold transition-colors">Voir le groupe</button>
                        </div>
                    </div>
                `).join('');
            },

            createModal() {
                const name = prompt("Nom du groupe ou de la page :");
                if (name) this.create(name);
            },

            async create(name) {
                const { error } = await sb.from('groups').insert([{
                    name: name,
                    description: "Groupe créé par " + App.state.profile.username,
                    created_by: App.state.user.id
                }]);

                if (error) alert("Erreur création : " + error.message);
                else {
                    alert("Groupe créé avec succès !");
                    this.fetchAll();
                }
            }
        },

        // 8. REALTIME SUBSCRIPTIONS
        Realtime: {
            init() {
                sb.channel('public:messages')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                        const msg = payload.new;
                        if (App.Features.Chat.activeContactId &&
                            (msg.sender_id === App.Features.Chat.activeContactId)) {
                            App.Features.Chat.renderMessage(msg);
                        }
                    })
                    .subscribe();
            }
        },
        // 9. PROFILE PAGE LOGIC
        ProfilePage: {
            async init() {
                this.loadPosts();
                this.loadStats();
            },

            async loadStats() {
                // Count posts
                const { count: postsCount } = await sb.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', App.state.user.id);
                document.getElementById('stat-posts').innerText = postsCount || 0;

                // Count friends (Simulation: all users - 1)
                const { count: usersCount } = await sb.from('profiles').select('*', { count: 'exact', head: true });
                document.getElementById('stat-friends').innerText = (usersCount - 1) || 0;
            },

            async loadPosts() {
                const container = document.getElementById('profile-posts-container');
                if (!container) return;

                const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)')
                    .eq('user_id', App.state.user.id)
                    .order('created_at', { ascending: false });

                if (posts && posts.length > 0) {
                    container.innerHTML = posts.map(post => App.Features.Feed.renderPost(post)).join('');
                } else {
                    container.innerHTML = `<div class="text-center text-gray-500 py-10">Vous n'avez rien publié encore.</div>`;
                }
            },

            async loadFriends() {
                const container = document.getElementById('profile-friends-container');
                if (container.innerHTML.trim() !== "") return; // Avoid reload

                const { data: users } = await sb.from('profiles').select('*').neq('id', App.state.user.id).limit(20);

                if (users) {
                    container.innerHTML = users.map(u => `
                        <div class="glass-panel p-3 rounded-2xl flex flex-col items-center gap-2">
                             <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username}" class="w-12 h-12 rounded-full object-cover">
                             <span class="text-xs font-bold text-white truncate max-w-full">${u.username}</span>
                             <button onclick="App.Features.Chat.openChat('${u.id}', '${u.username}', '${u.avatar_url}'); App.UI.navigateTo('messages')" 
                                     class="w-full bg-white/5 hover:bg-primary py-1.5 rounded-lg text-[10px] transition-colors">Message</button>
                        </div>
                    `).join('');
                }
            }
        }
    }
};

// Start App when DOM Ready
document.addEventListener('DOMContentLoaded', App.init);
