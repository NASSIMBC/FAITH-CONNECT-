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
            const { error } = await sb.auth.signUp({ email, password });
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
        },

        modals: {
            editProfile: {
                open() { alert("Modal édition profil (à implémenter)"); }
            }
        },

        toggleNotifs() { alert("Centre de notifications à venir !"); }
    },

    // --- FONCTIONNALITÉS MÉTIERS ---
    Features: {
        initAll() {
            this.Feed.loadDailyVerse();
            this.Feed.loadPosts();
            this.Bible.init();
            this.Prayers.load();
            this.Events.loadWidget();
            if (window.innerWidth > 768) App.Features.Chat.loadList(); // Preload msg on desktop
        },

        // 1. FEED & POSTS
        Feed: {
            async loadDailyVerse() {
                // Logique simplifiée avec versets statiques pour la démo
                const verses = [
                    { t: "L'Éternel est mon berger: je ne manquerai de rien.", r: "Psaumes 23:1" },
                    { t: "Je puis tout par celui qui me fortifie.", r: "Philippiens 4:13" },
                    { t: "Car rien n'est impossible à Dieu.", r: "Luc 1:37" }
                ];
                const today = new Date().getDay(); // Change tous les jours
                const verse = verses[today % verses.length];

                const txt = document.getElementById('daily-verse-text');
                const ref = document.getElementById('daily-verse-ref');
                if (txt) txt.innerText = `"${verse.t}"`;
                if (ref) ref.innerText = verse.r;
            },

            async loadPosts() {
                const container = document.getElementById('feed-container');
                if (!container) return;

                const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false }).limit(10);

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
                    ${post.image_url ? `<img src="${post.image_url}" class="w-full rounded-2xl mb-4 border border-white/5">` : ''}
                    <div class="flex gap-4 border-t border-white/5 pt-3">
                        <button class="flex items-center gap-2 text-xs text-gray-400 hover:text-pink-400 transition"><i data-lucide="heart" class="w-4 h-4"></i> Amen</button>
                        <button class="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-400 transition"><i data-lucide="message-circle" class="w-4 h-4"></i> Commenter</button>
                    </div>
                </article>
                `;
            },

            openCreator() { alert("Ouvre le modal créateur !"); }
        },

        // 2. BIBLE READER
        Bible: { // Simplifié pour version 2.0
            currentBook: 43, // Jean
            currentChap: 1,
            books: ["Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains"], // Liste courte pour démo

            init() {
                const nav = document.getElementById('bible-books-nav');
                if (!nav) return;
                nav.innerHTML = this.books.map((b, i) =>
                    `<button onclick="App.Features.Bible.load(${40 + i}, 1, '${b}')" class="whitespace-nowrap px-4 py-2 bg-white/5 rounded-full text-xs hover:bg-primary hover:text-white transition">${b}</button>`
                ).join('');
                this.load(43, 1, "Jean");
            },

            async load(bookId, chap, bookName) {
                this.currentBook = bookId;
                this.currentChap = chap;
                const container = document.getElementById('bible-content');
                const title = document.getElementById('bible-current-ref');

                if (title) title.innerText = `${bookName} ${chap}`;
                if (container) container.innerHTML = `<div class="text-center animate-pulse">Chargement de la Parole...</div>`;

                try {
                    const res = await fetch(`https://bolls.life/get-chapter/LSG/${bookId}/${chap}/`);
                    const data = await res.json();
                    if (data) {
                        container.innerHTML = data.map(v =>
                            `<span class="bible-verse-num">${v.verse}</span>${v.text} `
                        ).join('');
                    }
                } catch (e) {
                    container.innerHTML = "Erreur de chargement. Vérifiez votre connexion.";
                }
            },

            prevChap() { if (this.currentChap > 1) this.load(this.currentBook, this.currentChap - 1, "Livre"); },
            nextChap() { this.load(this.currentBook, this.currentChap + 1, "Livre"); }
        },

        // 3. PRAYERS
        Prayers: {
            async load() {
                const container = document.getElementById('widget-prayers-list');
                const { data } = await sb.from('prayers').select('*').order('created_at', { ascending: false }).limit(5);
                if (data && container) {
                    container.innerHTML = data.map(p => `
                        <div class="flex justify-between items-start border-b border-white/5 pb-2 last:border-0">
                            <div>
                                <p class="text-[10px] text-primary font-bold">${p.user_name}</p>
                                <p class="text-xs text-gray-300 italic">"${p.content}"</p>
                            </div>
                            <span class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500">🙏 ${p.count}</span>
                        </div>
                    `).join('');
                }
            },
            async add() {
                const input = document.getElementById('widget-prayer-input');
                if (!input.value) return;
                await sb.from('prayers').insert([{ user_id: App.state.user.id, user_name: App.state.profile.username, content: input.value, count: 0 }]);
                input.value = "";
                this.load();
            }
        },

        // 4. EVENTS (Mock)
        Events: {
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

        // 5. CHAT (Placeholder Architecture)
        Chat: {
            loadList() {
                // To be implemented fully
                const c = document.getElementById('conversations-list');
                if (c) c.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">Connectez-vous avec des amis pour commencer à discuter.</div>`;
            },
            send() { alert("Envoi de message..."); }
        }
    }
};

// Start App when DOM Ready
document.addEventListener('DOMContentLoaded', App.init);
