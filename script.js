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

    Utils: {
        sanitizeFilename(filename) {
            if (!filename) return `file_${Date.now()}`;
            return filename.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
                .replace(/[^a-z0-9.]/gi, '_') // Remplacer tout ce qui n'est pas alphanumérique par _
                .toLowerCase();
        }
    },

    // --- INITIALISATION ---
    init: async () => {
        console.log("🚀 FaithConnect v2.0 Starting...");
        App.UI.initTheme();
        await App.Auth.checkSession();
        if (App.state.user) {
            App.Features.Notifications.subscribe();
            App.Features.Notifications.updateBadges();
            App.Features.Chat.subscribe();
        }
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
            let { data } = await sb.from('profiles').select('*').eq('id', App.state.user.id).maybeSingle();
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
        },

        selectedAvatar: null,

        handleAvatarSelect(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                this.selectedAvatar = input.files[0];
                reader.onload = (e) => {
                    document.getElementById('edit-avatar-preview').src = e.target.result;
                }
                reader.readAsDataURL(input.files[0]);
            }
        },

        async saveProfile() {
            const username = document.getElementById('edit-username').value;
            const bio = document.getElementById('edit-bio').value;
            let avatarUrl = App.state.profile.avatar_url;

            if (!username) return alert("Le nom d'utilisateur est obligatoire.");

            try {
                // 1. Upload new avatar if selected
                if (this.selectedAvatar) {
                    const fileExt = this.selectedAvatar.name.split('.').pop();
                    const cleanName = App.Utils.sanitizeFilename(this.selectedAvatar.name);
                    const fileName = `avatar_${App.state.user.id}_${Date.now()}_${cleanName}`;
                    const { error: uploadError } = await sb.storage.from('avatars').upload(fileName, this.selectedAvatar, { upsert: true });

                    if (uploadError) throw new Error("Erreur upload avatar: " + uploadError.message);

                    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(fileName);
                    avatarUrl = publicUrl;
                }

                // 2. Update profiles table
                const { error: updateError } = await sb.from('profiles').update({
                    username,
                    bio,
                    avatar_url: avatarUrl
                }).eq('id', App.state.user.id);

                if (updateError) throw updateError;

                alert("Profil mis à jour ! 🙏");
                location.reload(); // Hard reload to refresh all avatars
            } catch (err) {
                console.error("Save Profile Error:", err);
                alert("Erreur lors de l'enregistrement : " + err.message);
            }
        }
    },

    // --- USER INTERFACE ---
    UI: {
        showAuth() {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
        },

        showApp() {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
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

        toggleUserMenu() {
            const menu = document.getElementById('user-menu-modal');
            if (menu) {
                const isHidden = menu.classList.contains('hidden');
                if (isHidden) {
                    menu.classList.remove('hidden');
                    // Update user info in menu
                    if (App.state.profile) {
                        document.getElementById('user-menu-avatar').src = App.state.profile.avatar_url;
                        document.getElementById('user-menu-name').innerText = App.state.profile.username;
                    }
                    // Update theme icon text
                    const isLight = document.documentElement.classList.contains('light-mode');
                    document.getElementById('user-menu-theme-icon').setAttribute('data-lucide', isLight ? 'moon' : 'sun');
                    document.getElementById('user-menu-theme-text').innerText = isLight ? 'Mode Sombre' : 'Mode Clair';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } else {
                    menu.classList.add('hidden');
                }
            }
        },

        navigateTo(viewName, targetId = null, filter = null) {
            // 1. Hide current view & handle mobile cleanup
            document.querySelectorAll('.page-view').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('view-transition'); // Reset anim
            });

            // Close sub-components & modals
            this.modals.closeAll();
            if (document.getElementById('mobile-search-overlay')) {
                document.getElementById('mobile-search-overlay').classList.add('hidden');
            }
            if (App.Features.Chat && App.Features.Chat.closeMobileChat) {
                App.Features.Chat.closeMobileChat();
            }

            // 2. Show new view
            const target = document.getElementById('view-' + viewName);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('view-transition');
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
            // Store filter in state if needed, or pass directly
            App.state.filter = filter;

            if (viewName === 'profile' && !App.state.user) {
                this.showAuth();
                return;
            }

            // Lazy Load Data
            if (viewName === 'groups') App.Features.Groups.fetchAll(filter === 'mine');
            if (viewName === 'pages') App.Features.Pages.fetchAll(filter === 'mine');
            if (viewName === 'messages' && App.state.user) App.Features.Chat.loadList();
            if (viewName === 'profile' && App.state.user) App.Features.ProfilePage.load(targetId || App.state.user.id);
            if (viewName === 'prayers' && App.state.user) App.Features.Prayers.load();
            if (viewName === 'events') App.Features.Events.load();
            if (viewName === 'marketplace') App.Features.Marketplace.load ? App.Features.Marketplace.load() : null;
            if (viewName === 'notifications') App.Features.Notifications.fetch();
            if (viewName === 'quiz') App.Features.Quiz.load();
            if (viewName === 'devotionals') App.Features.Devotionals.load();

            // Special: Detailed Group/Page
            if (viewName === 'group-detail') App.Features.Groups.loadDetail(targetId);

            if (typeof lucide !== 'undefined') lucide.createIcons();
        },

        modals: {
            closeAll() {
                document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
            },
            editProfile: {
                open() {
                    const p = App.state.profile;
                    document.getElementById('edit-username').value = p.username;
                    document.getElementById('edit-bio').value = p.bio || "";
                    document.getElementById('edit-avatar-preview').src = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`;
                    document.getElementById('modal-profile').classList.remove('hidden');
                }
            },
            faithAI: {
                open() { document.getElementById('modal-faith-ai').classList.remove('hidden'); }
            },
            creator: {
                open() { document.getElementById('modal-creator').classList.remove('hidden'); }
            },
            sell: {
                open() { App.Features.Marketplace.openSellModal(); }
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

        toggleNotifs() {
            const hasNotifs = Math.random() > 0.5;
            if (hasNotifs) {
                alert("Vous avez de nouvelles notifications ! \n- Jean a aimé votre post \n- Marie a répondu à votre prière");
            } else {
                alert("Pas de nouvelles notifications pour le moment.");
            }
        },

        toggleMobileSearch() {
            const overlay = document.getElementById('mobile-search-overlay');
            const input = document.getElementById('mobile-search-input');
            if (overlay) {
                overlay.classList.toggle('hidden');
                if (!overlay.classList.contains('hidden') && input) input.focus();
            }
        },

        toggleTheme() {
            const isLight = document.documentElement.classList.toggle('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            this.updateThemeUI();
        },

        updateThemeUI() {
            const isLight = document.documentElement.classList.contains('light-mode');
            const iconDesk = document.getElementById('theme-icon-desktop');
            const iconMob = document.getElementById('theme-icon-mobile');
            const textDesk = document.getElementById('theme-text-desktop');

            const iconName = isLight ? 'moon' : 'sun';
            const textName = isLight ? 'Mode Sombre' : 'Mode Clair';

            if (iconDesk) iconDesk.setAttribute('data-lucide', iconName);
            if (iconMob) iconMob.setAttribute('data-lucide', iconName);
            if (textDesk) textDesk.innerText = textName;

            if (typeof lucide !== 'undefined') lucide.createIcons();
        },

        // === CUSTOM MODAL SYSTEM ===
        Modal: {
            show(title, message, type = 'alert', placeholder = '') {
                return new Promise((resolve) => {
                    const modal = document.getElementById('custom-modal');
                    const titleEl = document.getElementById('custom-modal-title');
                    const msgEl = document.getElementById('custom-modal-message');
                    const inputContainer = document.getElementById('custom-modal-input-container');
                    const input = document.getElementById('custom-modal-input');
                    const btnCancel = document.getElementById('custom-modal-cancel');
                    const btnConfirm = document.getElementById('custom-modal-confirm');

                    if (!modal) {
                        console.error('Modal element not found');
                        return resolve(null);
                    }

                    // Set Content
                    titleEl.innerText = title;
                    msgEl.innerText = message;
                    input.value = '';
                    input.placeholder = placeholder;

                    // Reset View
                    inputContainer.classList.add('hidden');
                    btnCancel.classList.add('hidden');

                    // Configure Type
                    if (type === 'confirm') {
                        btnCancel.classList.remove('hidden');
                    } else if (type === 'prompt') {
                        inputContainer.classList.remove('hidden');
                        btnCancel.classList.remove('hidden');
                    }

                    // Remove old listeners to prevent stacking
                    const newConfirm = btnConfirm.cloneNode(true);
                    const newCancel = btnCancel.cloneNode(true);
                    btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
                    btnCancel.parentNode.replaceChild(newCancel, btnCancel);

                    // Event Handlers
                    const close = (val) => {
                        modal.classList.add('hidden');
                        resolve(val);
                    };

                    newConfirm.onclick = () => {
                        if (type === 'prompt') close(input.value);
                        else close(true);
                    };

                    newCancel.onclick = () => close(type === 'confirm' ? false : null);

                    // Show Modal
                    modal.classList.remove('hidden');
                    if (type === 'prompt') input.focus();
                });
            },

            async alert(message, title = 'Info') {
                return this.show(title, message, 'alert');
            },

            async confirm(message, title = 'Confirmation') {
                return this.show(title, message, 'confirm');
            },

            async prompt(message, placeholder = '', title = 'Saisie') {
                return this.show(title, message, 'prompt', placeholder);
            }
        },

        initTheme() {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.documentElement.classList.add('light-mode');
            }
            this.updateThemeUI();
        }
    },

    // --- FONCTIONNALITÉS MÉTIERS ---
    Features: {
        initAll() {
            App.Features.Stories.load();
            App.Features.Feed.loadDailyVerse();
            App.Features.Feed.loadPosts();
            App.Features.Bible.init();
            App.Features.Prayers.load();
            App.Features.Events.loadWidget();
            if (App.Features.Marketplace && App.Features.Marketplace.initSearch) App.Features.Marketplace.initSearch();
            if (App.state.user && window.innerWidth > 768) App.Features.Chat.loadList(); // Charger les contacts

            // Initialisation Groupes & Pages & Realtime
            if (App.state.view === 'groups') App.Features.Groups.fetchAll();
            if (App.state.view === 'pages') App.Features.Pages.fetchAll();
            if (App.Features.Realtime) App.Features.Realtime.init();

            // Search Listener (Chat Sidebar)
            const searchInput = document.querySelector('#msg-sidebar input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value.toLowerCase();
                    const items = document.querySelectorAll('#conversations-list > div');
                    items.forEach(item => {
                        const h4 = item.querySelector('h4');
                        if (h4) {
                            const name = h4.innerText.toLowerCase();
                            item.style.display = name.includes(val) ? 'flex' : 'none';
                        }
                    });

                    const visibleItems = Array.from(items).filter(i => i.style.display !== 'none');
                    const hintId = 'chat-search-hint';
                    let hint = document.getElementById(hintId);

                    if (visibleItems.length === 0 && val.length > 0) {
                        if (!hint) {
                            hint = document.createElement('div');
                            hint.id = hintId;
                            hint.className = 'p-4 text-center cursor-pointer hover:bg-white/5 transition';
                            hint.innerHTML = `<p class="text-xs text-gray-500 mb-2">Pas d'ami trouvé pour "${val}"</p>
                                                 <button onclick="App.Features.Finder.query('${val}')" class="text-xs text-primary font-bold">Chercher dans tout FaithConnect</button>`;
                            document.getElementById('conversations-list').appendChild(hint);
                        }
                    } else if (hint) {
                        hint.remove();
                    }
                });
            }

            // Global Search Listener (Desktop & Mobile)
            ['global-search-desktop', 'mobile-search-input'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            App.Features.Finder.query(e.target.value);
                            if (id === 'mobile-search-input') App.UI.toggleMobileSearch();
                        }
                    });
                }
            });
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

                container.innerHTML = '<div class="text-center py-20 animate-pulse text-gray-500">Chargement de la lumière...</div>';

                try {
                    if (!App.state.user) {
                        container.innerHTML = '<div class="text-center text-gray-400 py-10">Connectez-vous pour voir les publications</div>';
                        return;
                    }

                    // Récupérer la liste des amis
                    const { data: friendships } = await sb.from('friends')
                        .select('user_id, friend_id')
                        .or(`user_id.eq.${App.state.user.id},friend_id.eq.${App.state.user.id}`)
                        .eq('status', 'accepted');

                    const friendIds = friendships ? friendships.map(f =>
                        f.user_id === App.state.user.id ? f.friend_id : f.user_id
                    ) : [];

                    // Ajouter l'utilisateur lui-même
                    friendIds.push(App.state.user.id);

                    // Récupérer les posts des amis uniquement
                    const { data: posts, error } = await sb.from('posts')
                        .select('*, profiles(username, avatar_url), groups(name)')
                        .in('user_id', friendIds)
                        .order('created_at', { ascending: false })
                        .limit(50);

                    if (error) throw error;

                    if (posts && posts.length > 0) {
                        // Compter les commentaires pour chaque post
                        for (let post of posts) {
                            const { count } = await sb.from('comments')
                                .select('*', { count: 'exact', head: true })
                                .eq('post_id', post.id);
                            post.comment_count = count || 0;
                        }

                        container.innerHTML = posts.map(post => App.Features.Feed.renderPost(post)).join('');
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else {
                        container.innerHTML = `
                            <div class="text-center text-gray-500 py-10">
                                <i data-lucide="users" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
                                <p class="mb-2">Aucune publication de vos amis</p>
                                <p class="text-xs text-gray-600">Ajoutez des amis pour voir leurs publications !</p>
                            </div>
                        `;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                } catch (err) {
                    console.error("Feed Load Error:", err);
                    container.innerHTML = `<div class="text-center text-gray-400 py-10 italic">Impossible de charger les messages. ${err.message}</div>`;
                }
            },

            renderPost(post) {
                const avatar = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles?.username || 'Inconnu'}`;
                const groupInfo = post.groups ? `<span class="text-primary mx-1">➜</span> <span class="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">${post.groups.name}</span>` : '';
                const isAuthor = App.state.user && post.user_id === App.state.user.id;

                // Boutons d'action pour l'auteur
                const authorActions = isAuthor ? `
                    <div class="flex gap-2">
                        <button onclick="App.Features.Feed.editPost('${post.id}')" class="p-1.5 hover:bg-white/10 rounded-lg transition" title="Modifier">
                            <i data-lucide="edit-2" class="w-4 h-4 text-gray-400"></i>
                        </button>
                        <button onclick="App.Features.Feed.deletePost('${post.id}')" class="p-1.5 hover:bg-red-500/10 rounded-lg transition" title="Supprimer">
                            <i data-lucide="trash-2" class="w-4 h-4 text-red-400"></i>
                        </button>
                    </div>
                ` : '';

                return `
                <article class="glass-panel p-5 rounded-[24px] animate-slide-in-up" id="post-${post.id}">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3 cursor-pointer group/author" onclick="App.UI.navigateTo('profile', '${post.user_id}')">
                            <img src="${avatar}" class="w-10 h-10 rounded-full object-cover group-hover/author:ring-2 ring-primary transition-all">
                            <div>
                                <div class="flex items-center flex-wrap">
                                    <h4 class="font-bold text-sm text-white group-hover/author:text-primary transition-colors">${post.profiles?.username || 'Anonyme'}</h4>
                                    ${groupInfo}
                                </div>
                                <p class="text-[10px] text-gray-500">${new Date(post.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        ${authorActions}
                    </div>
                    <p class="text-gray-200 text-sm leading-relaxed mb-4 font-light" id="post-content-${post.id}">${post.content}</p>
                    ${post.image_url ? `<img src="${post.image_url}" class="w-full rounded-2xl mb-4 border border-white/5 bg-black/50">` : ''}
                    
                    <!-- Réactions -->
                    <div class="flex items-center gap-4 border-t border-white/5 pt-3 mb-3">
                        <button onclick="App.Features.Feed.reactToPost('${post.id}', '${post.user_id}', 'heart')" class="flex items-center gap-2 text-xs text-gray-400 hover:text-pink-400 transition group" id="react-heart-${post.id}">
                            <i data-lucide="heart" class="w-4 h-4 group-hover:fill-pink-400"></i> 
                            <span class="reaction-count">${post.reactions?.heart || 0}</span>
                        </button>
                        <button onclick="App.Features.Feed.reactToPost('${post.id}', '${post.user_id}', 'pray')" class="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-400 transition group" id="react-pray-${post.id}">
                            <i data-lucide="heart-handshake" class="w-4 h-4"></i> 
                            <span class="reaction-count">${post.reactions?.pray || 0}</span>
                        </button>
                        <button onclick="App.Features.Feed.reactToPost('${post.id}', '${post.user_id}', 'amen')" class="flex items-center gap-2 text-xs text-gray-400 hover:text-yellow-400 transition group" id="react-amen-${post.id}">
                            <i data-lucide="sparkles" class="w-4 h-4"></i> 
                            <span class="reaction-count">${post.reactions?.amen || 0}</span>
                        </button>
                        <button onclick="App.Features.Feed.toggleComments('${post.id}')" class="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition ml-auto">
                            <i data-lucide="message-circle" class="w-4 h-4"></i> 
                            <span id="comment-count-${post.id}">${post.comment_count || 0}</span>
                        </button>
                        <button onclick="App.Features.Feed.sharePost('${post.id}')" class="flex items-center gap-2 text-xs text-gray-400 hover:text-green-400 transition">
                            <i data-lucide="share-2" class="w-4 h-4"></i> Partager
                        </button>
                    </div>

                    <!-- Section Commentaires -->
                    <div id="comments-section-${post.id}" class="hidden border-t border-white/5 pt-3 mt-3">
                        <div id="comments-list-${post.id}" class="space-y-3 mb-3 max-h-60 overflow-y-auto custom-scrollbar">
                            <!-- Les commentaires seront chargés ici -->
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="comment-input-${post.id}" placeholder="Ajouter un commentaire..." 
                                   class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                                   onkeypress="if(event.key==='Enter') App.Features.Feed.addComment('${post.id}', '${post.user_id}')">
                            <button onclick="App.Features.Feed.addComment('${post.id}', '${post.user_id}')" 
                                    class="bg-primary hover:bg-primary/80 px-4 py-2 rounded-xl transition">
                                <i data-lucide="send" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </article>
                `;
            },


            // Système de réactions
            async reactToPost(postId, recipientId, reactionType) {
                const btn = document.getElementById(`react-${reactionType}-${postId}`);
                if (!btn) return;
                const countEl = btn.querySelector('.reaction-count');
                let count = parseInt(countEl.innerText) || 0;

                // Toggle visuel
                const isActive = btn.classList.contains('text-pink-400') || btn.classList.contains('text-purple-400') || btn.classList.contains('text-yellow-400');

                if (isActive) {
                    btn.classList.remove('text-pink-400', 'text-purple-400', 'text-yellow-400');
                    btn.classList.add('text-gray-400');
                    count = Math.max(0, count - 1);
                } else {
                    btn.classList.remove('text-gray-400');
                    if (reactionType === 'heart') btn.classList.add('text-pink-400');
                    else if (reactionType === 'pray') btn.classList.add('text-purple-400');
                    else if (reactionType === 'amen') btn.classList.add('text-yellow-400');
                    count++;

                    // Notification
                    if (App.state.user.id !== recipientId) {
                        App.Features.Notifications.create('like', recipientId, postId);
                    }
                }

                countEl.innerText = count;

                // Mise à jour DB
                try {
                    const { data: post } = await sb.from('posts').select('reactions').eq('id', postId).single();
                    const reactions = post?.reactions || {};
                    reactions[reactionType] = count;
                    await sb.from('posts').update({ reactions }).eq('id', postId);
                } catch (err) {
                    console.warn("Reaction update error:", err);
                }
            },

            // Toggle section commentaires
            async toggleComments(postId) {
                const section = document.getElementById(`comments-section-${postId}`);
                if (!section) return;

                if (section.classList.contains('hidden')) {
                    section.classList.remove('hidden');
                    await this.loadComments(postId);
                } else {
                    section.classList.add('hidden');
                }
            },

            // Charger les commentaires
            async loadComments(postId) {
                const container = document.getElementById(`comments-list-${postId}`);
                if (!container) return;

                container.innerHTML = '<p class="text-xs text-gray-500 text-center py-2 animate-pulse">Chargement...</p>';

                try {
                    const { data: comments } = await sb.from('comments')
                        .select('*, profiles(username, avatar_url)')
                        .eq('post_id', postId)
                        .order('created_at', { ascending: true });

                    if (comments && comments.length > 0) {
                        container.innerHTML = comments.map(c => `
                            <div class="flex gap-2 bg-white/5 p-3 rounded-xl">
                                <img src="${c.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=' + c.profiles?.username}" 
                                     class="w-8 h-8 rounded-full object-cover">
                                <div class="flex-1">
                                    <p class="text-xs font-bold text-white">${c.profiles?.username || 'Anonyme'}</p>
                                    <p class="text-xs text-gray-300 mt-1">${c.content}</p>
                                    <p class="text-[10px] text-gray-500 mt-1">${new Date(c.created_at).toLocaleDateString()}</p>
                                </div>
                                ${c.user_id === App.state.user.id ? `
                                    <button onclick="App.Features.Feed.deleteComment('${c.id}', '${postId}')" 
                                            class="text-red-400 hover:text-red-300 text-xs">
                                        <i data-lucide="x" class="w-3 h-3"></i>
                                    </button>
                                ` : ''}
                            </div>
                        `).join('');
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    } else {
                        container.innerHTML = '<p class="text-xs text-gray-500 text-center py-2">Aucun commentaire</p>';
                    }
                } catch (err) {
                    console.error("Load comments error:", err);
                    container.innerHTML = '<p class="text-xs text-red-400 text-center py-2">Erreur de chargement</p>';
                }
            },

            // Ajouter un commentaire
            async addComment(postId, recipientId) {
                const input = document.getElementById(`comment-input-${postId}`);
                if (!input || !input.value.trim()) return;

                const content = input.value.trim();
                input.value = '';

                try {
                    const { error } = await sb.from('comments').insert({
                        post_id: postId,
                        user_id: App.state.user.id,
                        content: content
                    });

                    if (error) throw error;

                    // Mise à jour du compteur
                    const countEl = document.getElementById(`comment-count-${postId}`);
                    if (countEl) {
                        countEl.innerText = parseInt(countEl.innerText || 0) + 1;
                    }

                    // Notification
                    if (App.state.user.id !== recipientId) {
                        App.Features.Notifications.create('comment', recipientId, postId, content);
                    }

                    // Recharger les commentaires
                    await this.loadComments(postId);
                } catch (err) {
                    console.error("Add comment error:", err);
                    alert("Erreur lors de l'ajout du commentaire");
                }
            },

            // Supprimer un commentaire
            async deleteComment(commentId, postId) {
                if (!confirm("Supprimer ce commentaire ?")) return;

                try {
                    await sb.from('comments').delete().eq('id', commentId);

                    // Mise à jour du compteur
                    const countEl = document.getElementById(`comment-count-${postId}`);
                    if (countEl) {
                        countEl.innerText = Math.max(0, parseInt(countEl.innerText || 0) - 1);
                    }

                    await this.loadComments(postId);
                } catch (err) {
                    console.error("Delete comment error:", err);
                }
            },

            // Partager un post
            sharePost(postId) {
                const post = document.getElementById(`post-${postId}`);
                const content = document.getElementById(`post-content-${postId}`)?.innerText || '';
                const text = `Découvrez cette publication sur FaithConnect : "${content.substring(0, 100)}..."`;

                if (navigator.share) {
                    navigator.share({
                        title: 'FaithConnect',
                        text: text,
                        url: `${window.location.origin}${window.location.pathname}?post=${postId}`
                    }).catch(console.error);
                } else {
                    navigator.clipboard.writeText(`${text}\n${window.location.origin}${window.location.pathname}?post=${postId}`)
                        .then(() => alert("Lien copié dans le presse-papier !"));
                }
            },

            // Modifier un post
            async editPost(postId) {
                const contentEl = document.getElementById(`post-content-${postId}`);
                if (!contentEl) return;

                const currentContent = contentEl.innerText;
                const newContent = prompt("Modifier votre publication :", currentContent);

                if (newContent && newContent.trim() && newContent !== currentContent) {
                    try {
                        await sb.from('posts').update({ content: newContent.trim() }).eq('id', postId);
                        contentEl.innerText = newContent.trim();
                        alert("Publication modifiée !");
                    } catch (err) {
                        console.error("Edit post error:", err);
                        alert("Erreur lors de la modification");
                    }
                }
            },

            // Supprimer un post
            async deletePost(postId) {
                if (!confirm("Supprimer définitivement cette publication ?")) return;

                try {
                    // Supprimer les commentaires associés
                    await sb.from('comments').delete().eq('post_id', postId);
                    // Supprimer le post
                    await sb.from('posts').delete().eq('id', postId);

                    // Retirer du DOM
                    const postEl = document.getElementById(`post-${postId}`);
                    if (postEl) postEl.remove();

                    alert("Publication supprimée");
                } catch (err) {
                    console.error("Delete post error:", err);
                    alert("Erreur lors de la suppression");
                }
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

                if (!App.state.user) return alert("Vous devez être connecté pour publier.");

                let imageUrl = null;
                // Upload image if exists
                if (this.selectedImage) {
                    try {
                        const cleanName = App.Utils.sanitizeFilename(this.selectedImage.name);
                        const fileName = `${Date.now()}_${cleanName}`;
                        const { error: uploadError } = await sb.storage.from('posts').upload(fileName, this.selectedImage);
                        if (uploadError) {
                            console.error("Storage Error:", uploadError);
                            return alert("Erreur lors de l'envoi de l'image. Vérifiez si le bucket 'posts' existe.");
                        }
                        const { data: { publicUrl } } = sb.storage.from('posts').getPublicUrl(fileName);
                        imageUrl = publicUrl;
                    } catch (err) {
                        console.error("Upload Catch:", err);
                        return alert("Erreur réseau lors de l'upload.");
                    }
                }

                const postData = {
                    user_id: App.state.user.id,
                    content: content,
                    image_url: imageUrl,
                    type: 'post'
                };

                const { error } = await sb.from('posts').insert([postData]);

                if (error) {
                    // Fallback: Tentative sans la colonne 'type' si elle manque encore
                    if (error.code === 'PGRST204') {
                        delete postData.type;
                        const retry = await sb.from('posts').insert([postData]);
                        if (retry.error) throw retry.error;
                    } else {
                        throw error;
                    }
                }
                App.UI.modals.closeAll();
                document.getElementById('post-input').value = "";
                this.removeImage();
                this.loadPosts(); // Reload feed
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
                if (!App.state.user) return alert("Veuillez vous connecter.");
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
                                <button onclick="App.Features.Prayers.support('${p.id}')" class="text-xs text-gray-400 hover:text-pink-400 flex items-center gap-1 transition" id="prayer-btn-${p.id}">
                                    <i data-lucide="heart" class="w-3 h-3"></i> Soutenir (<span class="prayer-count">${p.count}</span>)
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
                if (!App.state.user || !App.state.profile) return alert("Veuillez vous connecter pour publier une prière.");
                const input = document.getElementById(inputId);
                input.value = "";
                alert("Prière publiée 🙏");
                this.load();
            },

            async support(prayerId) {
                const btn = document.getElementById(`prayer-btn-${prayerId}`);
                const countEl = btn.querySelector('.prayer-count');
                let count = parseInt(countEl.innerText) + 1;
                countEl.innerText = count;

                btn.classList.add('text-pink-500');

                await sb.from('prayers').update({ count: count }).eq('id', prayerId);
            }
        },

        // 3. MARKETPLACE (Liaison Supabase complète)
        Marketplace: {
            selectedImage: null,
            currentData: [],

            async load(filter = "") {
                const container = document.getElementById('marketplace-grid');
                if (!container) return;

                container.innerHTML = '<div class="col-span-full text-center py-20 animate-pulse text-gray-500">Chargement de la boutique...</div>';

                // Tentative de chargement avec jointure
                let { data, error } = await sb.from('marketplace').select('*, profiles(id, username, avatar_url)');

                // Si la jointure échoue (manque de clé étrangère), on charge les données simples
                if (error && error.code === 'PGRST200') {
                    console.warn("Lien profiles manquant, chargement sans noms d'utilisateurs");
                    const fallback = await sb.from('marketplace').select('*');
                    data = fallback.data;
                    error = fallback.error;
                }

                if (error) {
                    console.error("Marketplace Error:", error);
                    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400">
                        <p class="mb-4">Erreur de chargement du Marketplace : ${error.message}</p>
                    </div>`;
                    return;
                }

                this.currentData = data || [];

                const filtered = this.currentData.filter(p =>
                    p.title.toLowerCase().includes(filter.toLowerCase()) ||
                    (p.profiles?.username || '').toLowerCase().includes(filter.toLowerCase()) ||
                    (p.category || '').toLowerCase().includes(filter.toLowerCase())
                );

                if (filtered.length === 0) {
                    container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">Aucun article trouvé pour "${filter}".</div>`;
                    return;
                }

                container.innerHTML = filtered.map(p => `
                    <div onclick="App.Features.Marketplace.openDetails('${p.id}')" 
                        class="glass-panel p-0 rounded-2xl overflow-hidden group cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-1 relative">
                        <div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-sm z-10 shadow-lg border border-white/10 text-primary">${p.price}€</div>
                        ${p.category ? `<div class="absolute top-2 left-2 bg-primary/80 text-white text-[8px] font-bold px-2 py-1 rounded-md backdrop-blur-sm z-10 uppercase tracking-tighter">${p.category}</div>` : ''}
                        <div class="h-40 overflow-hidden relative">
                            <img src="${p.image_url || 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=500&auto=format&fit=crop&q=60'}" 
                                 class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span class="text-[10px] text-white font-bold">Voir les détails</span>
                            </div>
                        </div>
                        <div class="p-3">
                            <h4 class="font-bold text-sm text-white truncate">${p.title}</h4>
                            <p class="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                <i data-lucide="user" class="w-3 h-3"></i> ${p.profiles?.username || 'Vendeur'}
                            </p>
                        </div>
                    </div>
                `).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            openDetails(itemId) {
                const item = this.currentData.find(i => i.id === itemId);
                if (!item) return;

                const modal = document.getElementById('modal-item-details');
                if (!modal) return;

                // Populate modal
                document.getElementById('item-detail-img').src = item.image_url || 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=500&auto=format&fit=crop&q=60';
                document.getElementById('item-detail-title').innerText = item.title;
                document.getElementById('item-detail-price').innerText = item.price + "€";
                document.getElementById('item-detail-category').innerText = item.category || 'AUTRE';
                document.getElementById('item-detail-description').innerText = item.description || "Pas de description détaillée pour cet article.";

                const sellerAvatar = document.getElementById('item-detail-seller-avatar');
                const sellerName = document.getElementById('item-detail-seller-name');

                sellerName.innerText = item.profiles?.username || 'Vendeur FaithConnect';
                sellerAvatar.src = item.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${item.profiles?.username || 'V'}`;

                // Add click navigation to seller info
                const sellerInfo = sellerName.parentElement.parentElement;
                if (sellerInfo) {
                    sellerInfo.classList.add('cursor-pointer', 'hover:bg-white/5', 'transition-colors');
                    sellerInfo.onclick = () => {
                        App.UI.navigateTo('profile', item.profiles?.id);
                        App.UI.modals.closeAll();
                    };
                }

                // Buttons
                document.getElementById('btn-contact-seller').onclick = () => this.buy(item.profiles?.id, item.profiles?.username, item.profiles?.avatar_url);
                document.getElementById('btn-buy-now').onclick = () => this.buy(item.profiles?.id, item.profiles?.username, item.profiles?.avatar_url);

                modal.classList.remove('hidden');
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
                    // Reset
                    document.getElementById('sell-title').value = '';
                    document.getElementById('sell-price').value = '';
                    document.getElementById('sell-category').value = 'autre';
                    document.getElementById('sell-description').value = '';
                    document.getElementById('sell-file').value = '';
                    document.getElementById('sell-preview-img').classList.add('hidden');
                    document.getElementById('sell-image-placeholder').classList.remove('hidden');
                    this.selectedImage = null;
                }
            },

            handleImageSelect(input) {
                if (input.files && input.files[0]) {
                    this.selectedImage = input.files[0];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        document.getElementById('sell-preview-img').src = e.target.result;
                        document.getElementById('sell-preview-img').classList.remove('hidden');
                        document.getElementById('sell-image-placeholder').classList.add('hidden');
                    };
                    reader.readAsDataURL(input.files[0]);
                }
            },

            async publish() {
                const title = document.getElementById('sell-title').value;
                const price = document.getElementById('sell-price').value;
                const category = document.getElementById('sell-category').value;
                const description = document.getElementById('sell-description').value;

                if (!title || !price) return alert("Veuillez remplir les champs obligatoires (titre et prix).");
                if (!App.state.user) return alert("Veuillez vous connecter.");

                let imageUrl = null;
                if (this.selectedImage) {
                    try {
                        const cleanName = App.Utils.sanitizeFilename(this.selectedImage.name);
                        const fileName = `${Date.now()}_${cleanName}`;
                        const { error: uploadError } = await sb.storage.from('marketplace').upload(fileName, this.selectedImage);
                        if (uploadError) {
                            console.error("Marketplace Upload Error:", uploadError);
                            return alert("Erreur image: Vérifiez le bucket 'marketplace'");
                        }
                        const { data: { publicUrl } } = sb.storage.from('marketplace').getPublicUrl(fileName);
                        imageUrl = publicUrl;
                    } catch (err) {
                        console.error(err);
                    }
                }

                const { error } = await sb.from('marketplace').insert([{
                    user_id: App.state.user.id,
                    title: title,
                    price: parseFloat(price),
                    category: category,
                    description: description,
                    image_url: imageUrl
                }]);

                if (error) {
                    alert("Erreur lors de la mise en vente: " + error.message);
                } else {
                    alert("Article mis en vente ! 🙏");
                    App.UI.modals.closeAll();
                    this.load();
                }
            },

            buy(sellerId, sellerName, sellerAvatar) {
                if (!sellerId) return alert("Vendeur introuvable.");
                App.Features.Chat.openChat(sellerId, sellerName, sellerAvatar);
                App.UI.navigateTo('messages');
                App.UI.modals.closeAll();
            }
        },

        // 4. EVENTS
        Events: {
            async load() {
                const container = document.getElementById('events-container');
                if (!container) return;

                container.innerHTML = '<div class="col-span-full text-center py-10 animate-pulse text-gray-500">Chargement des événements...</div>';

                const { data: events, error } = await sb.from('events').select('*, profiles(username, avatar_url)').order('created_at', { ascending: false });

                if (error) {
                    console.error("Events Load Error:", error);
                    container.innerHTML = `<div class="text-center py-10 text-red-400 text-xs">Erreur: ${error.message}</div>`;
                    return;
                }

                if (!events || events.length === 0) {
                    container.innerHTML = '<div class="text-center py-10 text-gray-500 text-xs">Aucun événement à venir. Soyez le premier à en proposer un !</div>';
                    return;
                }

                container.innerHTML = events.map(e => `
                    <div class="glass-panel p-0 rounded-2xl overflow-hidden flex flex-col md:flex-row hover:shadow-glow transition-all">
                        <img src="${e.image_url || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=500&auto=format&fit=crop&q=60'}" class="w-full md:w-48 h-32 object-cover">
                        <div class="p-4 flex-1 flex flex-col justify-center">
                            <h4 class="font-bold text-lg text-white mb-1">${e.title}</h4>
                            <div class="flex flex-col md:flex-row gap-2 md:gap-6 text-sm text-gray-400">
                                <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-4 h-4 text-primary"></i> ${e.date_text}</span>
                                <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-4 h-4 text-primary"></i> ${e.location}</span>
                            </div>
                            <p class="text-[10px] text-gray-500 mt-2 line-clamp-1 italic">${e.description || 'Pas de description'}</p>
                            <div class="mt-3 flex gap-2">
                                <button onclick="App.Features.Events.participate('${e.title}')" class="px-4 py-1.5 bg-primary/20 hover:bg-primary/40 text-primary text-xs font-bold rounded-lg transition">Je participe</button>
                                <button onclick="alert('Description : ${e.description ? e.description.replace(/'/g, "\\'") : 'Aucune'}')" class="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition">Détails</button>
                            </div>
                        </div>
                    </div>
                `).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
                this.loadWidget(events.slice(0, 2));
            },

            loadWidget(events = []) {
                const c = document.getElementById('widget-events-list');
                if (!c) return;

                if (events.length === 0) {
                    c.innerHTML = '<p class="text-[10px] text-gray-500 text-center">Aucun événement</p>';
                    return;
                }

                c.innerHTML = events.map(e => `
                    <div class="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                        <div class="bg-primary/20 text-primary p-2 rounded-lg"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                        <div>
                            <p class="font-bold text-xs text-white">${e.title}</p>
                            <p class="text-[10px] text-gray-400">${e.date_text} • ${e.location}</p>
                        </div>
                    </div>
                `).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            participate(eventTitle) {
                alert(`Vous êtes inscrit à : ${eventTitle} ! 🙏`);
            },

            propose() {
                if (!App.state.user) return alert("Veuillez vous connecter pour proposer un événement.");
                document.getElementById('modal-event-propose').classList.remove('hidden');
            },

            async publish() {
                const title = document.getElementById('event-title').value;
                const date_text = document.getElementById('event-date').value;
                const location = document.getElementById('event-location').value;
                const description = document.getElementById('event-description').value;
                const image_url = document.getElementById('event-image').value;

                if (!title || !date_text || !location) return alert("Le titre, la date et le lieu sont obligatoires.");

                try {
                    const { error } = await sb.from('events').insert([{
                        title,
                        date_text,
                        location,
                        description,
                        image_url: image_url || null,
                        created_by: App.state.user.id
                    }]);

                    if (error) throw error;

                    alert("Événement publié avec succès ! 🙏");
                    App.UI.modals.closeAll();
                    // Reset fields
                    ['event-title', 'event-date', 'event-location', 'event-description', 'event-image'].forEach(id => {
                        document.getElementById(id).value = '';
                    });
                    this.load();
                } catch (err) {
                    alert("Erreur: " + err.message);
                }
            }
        },

        // 5. CHAT (MESSAGERIE COMPLÈTE & RECHERCHE)
        Chat: {
            activeContactId: null,
            activeContactInfo: null,
            replyToId: null,
            searchTimeout: null,

            insertEmoji(emoji) {
                const input = document.getElementById('chat-input');
                if (input) {
                    input.value += emoji;
                    input.focus();
                }
            },

            setReply(msgId, text) {
                this.replyToId = msgId;
                const preview = document.getElementById('reply-preview');
                const previewText = document.getElementById('reply-text');
                if (preview && previewText) {
                    previewText.innerText = text;
                    preview.classList.remove('hidden');
                }
            },

            clearReply() {
                this.replyToId = null;
                const preview = document.getElementById('reply-preview');
                if (preview) preview.classList.add('hidden');
            },

            async handleMediaSelect(input) {
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    if (file.size > 5 * 1024 * 1024) return alert("Fichier trop volumineux (max 5Mo)");

                    const fileName = `${App.state.user.id}/${Date.now()}_${file.name}`;
                    const { data, error } = await sb.storage.from('chat-media').upload(fileName, file);

                    if (error) alert("Erreur upload: " + error.message);
                    else {
                        const { data: { publicUrl } } = sb.storage.from('chat-media').getPublicUrl(fileName);
                        this.send(publicUrl, 'image');
                    }
                }
            },

            async loadList() {
                if (!App.state.user) return;
                this.loadConversations();
            },

            handleSearch(query) {
                if (this.searchTimeout) clearTimeout(this.searchTimeout);
                if (!query || query.trim().length === 0) {
                    this.loadConversations();
                    return;
                }
                this.searchTimeout = setTimeout(() => this.searchGlobal(query), 300);
            },

            async searchGlobal(q) {
                const container = document.getElementById('conversations-list');
                if (!container) return;

                const { data: users } = await sb.from('profiles')
                    .select('*')
                    .ilike('username', `%${q}%`)
                    .neq('id', App.state.user.id)
                    .limit(10);

                if (users && users.length > 0) {
                    container.innerHTML = `
                        <div class="p-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold bg-white/5 mb-1">Résultats pour "${q}"</div>
                        ${users.map(u => `
                            <div onclick="App.Features.Chat.openChat('${u.id}', '${u.username}', '${u.avatar_url || ''}')" 
                                 class="p-4 flex items-center gap-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors group/u">
                                <div class="relative">
                                    <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username}" class="w-10 h-10 rounded-full object-cover bg-gray-800 group-hover/u:ring-2 ring-primary transition-all">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-sm text-white truncate font-outfit">${u.username}</h4>
                                    <p class="text-[10px] text-primary truncate">Démarrer une discussion</p>
                                </div>
                            </div>
                        `).join('')}
                    `;
                } else {
                    container.innerHTML = `<div class="p-10 text-center text-xs text-gray-500 italic">Aucun membre trouvé pour "${q}".</div>`;
                }
            },

            async loadConversations() {
                const container = document.getElementById('conversations-list');
                if (!container || !App.state.user) return;

                // 1. Fetch current friends (accepted)
                const { data: friendships } = await sb.from('friends').select('user_id, friend_id').or(`user_id.eq.${App.state.user.id},friend_id.eq.${App.state.user.id}`).eq('status', 'accepted');

                // 2. Fetch people with existing messages (even if not friends)
                const { data: recentMsgs } = await sb.from('messages').select('sender_id, receiver_id').or(`sender_id.eq.${App.state.user.id},receiver_id.eq.${App.state.user.id}`).order('created_at', { ascending: false }).limit(50);

                const partnerIds = new Set();
                if (friendships) {
                    friendships.forEach(f => partnerIds.add(f.user_id === App.state.user.id ? f.friend_id : f.user_id));
                }
                if (recentMsgs) {
                    recentMsgs.forEach(m => partnerIds.add(m.sender_id === App.state.user.id ? m.receiver_id : m.sender_id));
                }

                if (partnerIds.size > 0) {
                    const { data: profiles } = await sb.from('profiles').select('*').in('id', Array.from(partnerIds));
                    if (profiles) {
                        container.innerHTML = profiles.map(p => `
                            <div onclick="App.Features.Chat.openChat('${p.id}', '${p.username}', '${p.avatar_url || ''}')" 
                                 class="p-4 flex items-center gap-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors contact-item" id="contact-${p.id}">
                                <div class="relative">
                                    <img src="${p.avatar_url || 'https://ui-avatars.com/api/?name=' + p.username}" class="w-10 h-10 rounded-full object-cover bg-gray-800">
                                    <span class="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-[#050510]" id="status-${p.id}"></span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-sm text-white truncate">${p.username}</h4>
                                    <p class="text-[10px] text-gray-400 truncate">Messagerie</p>
                                </div>
                            </div>
                        `).join('');
                    }
                } else {
                    container.innerHTML = `<div class="p-10 text-center text-xs text-gray-500 italic">Aucune discussion. ✨</div>`;
                }
            },

            subscribe() {
                if (!App.state.user) return;
                sb.channel('realtime_messages')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'messages'
                    }, payload => {
                        const { eventType, new: newRecord, old: oldRecord } = payload;

                        if (eventType === 'INSERT') {
                            if (newRecord.receiver_id === App.state.user.id || newRecord.sender_id === App.state.user.id) {
                                if (this.activeContactId === newRecord.sender_id || this.activeContactId === newRecord.receiver_id) {
                                    if (!document.getElementById(`msg-${newRecord.id}`)) this.renderMessage(newRecord);
                                }
                                this.loadConversations();
                            }
                        } else if (eventType === 'UPDATE') {
                            if (this.activeContactId === newRecord.sender_id || this.activeContactId === newRecord.receiver_id) {
                                const el = document.getElementById(`msg-${newRecord.id}`);
                                if (el) {
                                    // Refresh only if needed, or better: just reload messages to keep everything in sync
                                    this.loadMessages(this.activeContactId);
                                }
                            }
                        } else if (eventType === 'DELETE') {
                            document.getElementById(`msg-${oldRecord.id}`)?.remove();
                            this.loadConversations();
                        }
                    })
                    .subscribe();
            },

            async openChat(userId, username, avatar) {
                if (!App.state.user) return;
                this.activeContactId = userId;

                // If we have username/avatar, update cache, otherwise try to use cache
                if (username) {
                    this.activeContactInfo = { username, avatar };
                } else if (this.activeContactInfo && userId !== this.activeContactId) {
                    // Info might be for another user
                    this.activeContactInfo = null;
                }

                const headerContent = document.getElementById('chat-header-content');
                const msgsContainer = document.getElementById('chat-messages');
                const input = document.getElementById('chat-input');

                // Show loading or previous name if cached
                const currentName = this.activeContactInfo?.username || username || "Chargement...";
                const currentAvatar = this.activeContactInfo?.avatar || avatar;

                if (window.innerWidth < 768) {
                    const msgArea = document.getElementById('msg-area');
                    msgArea.classList.remove('hidden');
                    msgArea.classList.add('flex');
                    document.getElementById('msg-sidebar').classList.add('hidden');

                    const nav = document.querySelector('.glass-nav.fixed.bottom-0');
                    const view = document.getElementById('view-messages');
                    if (nav) nav.classList.add('hidden');
                    if (view) {
                        view.classList.remove('bottom-[85px]', 'z-40');
                        view.classList.add('bottom-0', 'z-50');
                    }
                }

                // Load Customizations
                const { data: custom } = await sb.from('chat_customization')
                    .select('*')
                    .eq('user_id', App.state.user.id)
                    .eq('contact_id', userId)
                    .maybeSingle();

                const displayName = custom?.nickname || username;
                if (custom?.theme) this.applyTheme(custom.theme);

                if (headerContent) {
                    headerContent.innerHTML = `
                    <div class="flex items-center gap-3">
                        <button class="md:hidden p-1 mr-2" onclick="App.Features.Chat.closeMobileChat()"><i data-lucide="arrow-left"></i></button>
                        <img src="${(avatar && avatar !== 'null') ? avatar : 'https://ui-avatars.com/api/?name=' + username}" class="w-8 h-8 rounded-full">
                        <div class="flex flex-col">
                            <span class="font-bold text-white text-sm">${displayName}</span>
                            ${custom?.nickname ? `<span class="text-[9px] text-gray-500 italic">@${username}</span>` : '<span class="text-[9px] text-green-500">En ligne</span>'}
                        </div>
                    </div>
                    <button onclick="App.Features.Chat.toggleSettings()" class="p-2 hover:bg-white/5 rounded-full transition text-gray-400 hover:text-white">
                        <i data-lucide="settings" class="w-5 h-5"></i>
                    </button>
                `;
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                if (input) {
                    input.disabled = false;
                    input.focus();
                }

                await this.loadMessages(userId);
            },

            async loadMessages(userId) {
                const msgsContainer = document.getElementById('chat-messages');
                if (!msgsContainer) return;

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
                const container = document.getElementById('chat-messages');
                if (!container) return;

                if (container.innerHTML.includes('Aucun message')) container.innerHTML = '';

                const isMe = msg.sender_id === App.state.user.id;
                const div = document.createElement('div');
                div.id = `msg-${msg.id || Date.now()}`;
                div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} group mb-4`;

                let contentHtml = '';
                if (msg.type === 'image') {
                    contentHtml = `<img src="${msg.content}" class="rounded-xl max-w-full h-48 object-cover cursor-pointer border border-white/10 hover:opacity-90 transition" onclick="window.open('${msg.content}')">`;
                } else {
                    contentHtml = `<p class="text-sm break-words">${msg.content}</p>`;
                }

                // Reactions rendering
                let reactionsHtml = '';
                if (msg.reactions && msg.reactions.length > 0) {
                    const counts = msg.reactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                        return acc;
                    }, {});

                    reactionsHtml = `<div class="flex flex-wrap gap-1 mt-1">` + Object.entries(counts).map(([emoji, count]) => `
                    <button onclick="App.Features.Chat.toggleReaction('${msg.id}', '${emoji}')" class="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] transition">
                        <span>${emoji}</span>
                        <span class="opacity-60">${count}</span>
                    </button>
                `).join('') + `</div>`;
                }

                // Reply indicator
                let replyHtml = '';
                if (msg.parent_id) {
                    replyHtml = `
                    <div class="mb-2 text-[10px] opacity-60 border-l-2 border-primary pl-2 italic bg-white/5 p-1 rounded-r-lg max-w-full truncate">
                        Réponse au message...
                    </div>
                `;
                }

                div.innerHTML = `
                <div class="max-w-[85%] relative">
                    <div class="px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'} shadow-sm relative group/bubble">
                        ${replyHtml}
                        ${contentHtml}
                        <div class="flex items-center justify-between gap-4 mt-1">
                            <span class="text-[8px] opacity-40">${msg.is_edited ? 'Modifié' : ''}</span>
                            <span class="text-[9px] opacity-50 ms-auto text-right">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        ${reactionsHtml}

                        <!-- Context Actions (Hover) -->
                        <div class="absolute ${isMe ? '-left-12' : '-right-12'} top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all z-20">
                            <button onclick="App.Features.Chat.setReply('${msg.id}', '${msg.content?.substring(0, 30) || 'Image'}')" class="p-1.5 bg-gray-900 border border-white/10 rounded-full hover:text-primary transition" title="Répondre"><i data-lucide="corner-up-left" class="w-3 h-3"></i></button>
                            ${isMe ? `
                                <button onclick="App.Features.Chat.editMessage('${msg.id}', '${msg.content}')" class="p-1.5 bg-gray-900 border border-white/10 rounded-full hover:text-blue-400 transition" title="Modifier"><i data-lucide="edit-3" class="w-3 h-3"></i></button>
                                <button onclick="App.Features.Chat.deleteMessage('${msg.id}')" class="p-1.5 bg-gray-900 border border-white/10 rounded-full hover:text-red-400 transition" title="Supprimer"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                            ` : ''}
                            <div class="flex gap-1 bg-gray-900 border border-white/10 rounded-full p-1 mt-1 shadow-lg">
                                <button onclick="App.Features.Chat.toggleReaction('${msg.id}', '🙏')" class="hover:scale-125 transition">🙏</button>
                                <button onclick="App.Features.Chat.toggleReaction('${msg.id}', '❤️')" class="hover:scale-125 transition">❤️</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
                container.appendChild(div);
                if (typeof lucide !== 'undefined') lucide.createIcons();
                setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
            },

            async send(contentOverride = null, type = 'text') {
                if (!App.state.user) return;
                const input = document.getElementById('chat-input');
                const content = contentOverride || input.value;
                if (!content || !this.activeContactId) return;

                const { error } = await sb.from('messages').insert([{
                    sender_id: App.state.user.id,
                    receiver_id: this.activeContactId,
                    content: content,
                    type: type,
                    parent_id: this.replyToId
                }]);

                if (error) await App.UI.Modal.alert("Erreur envoi: " + error.message, "Erreur");
                else {
                    if (!contentOverride) input.value = "";
                    this.clearReply();
                    input.focus();
                    this.loadConversations();

                    // Créer une notification pour le destinataire
                    App.Features.Notifications.create('message', this.activeContactId, App.state.user.id, content.substring(0, 50));
                }
            },

            async deleteMessage(msgId) {
                if (!await App.UI.Modal.confirm("Supprimer ce message pour tout le monde ?")) return;
                const { error } = await sb.from('messages').delete().eq('id', msgId);
                if (error) await App.UI.Modal.alert("Erreur: " + error.message);
                else {
                    document.getElementById(`msg-${msgId}`)?.remove();
                }
            },

            async editMessage(msgId, oldContent) {
                const newContent = await App.UI.Modal.prompt("Modifier le message :", oldContent);
                if (!newContent || newContent === oldContent) return;

                const { error } = await sb.from('messages').update({
                    content: newContent,
                    is_edited: true
                }).eq('id', msgId);

                if (error) await App.UI.Modal.alert("Erreur: " + error.message);
                else {
                    // RT will refresh or we can manually update
                    await App.UI.Modal.alert("Message modifié.", "Succès");
                    this.openChat(this.activeContactId); // Full refresh for simplicity now
                }
            },

            async setNickname(userId, nickname) {
                const { error } = await sb.from('chat_customization').upsert({
                    user_id: App.state.user.id,
                    contact_id: userId,
                    nickname: nickname
                }, { onConflict: 'user_id,contact_id' });

                if (error) await App.UI.Modal.alert("Erreur: " + error.message);
                else await App.UI.Modal.alert("Surnom mis à jour !");
            },

            async setTheme(theme) {
                if (!this.activeContactId) return;
                const { error } = await sb.from('chat_customization').upsert({
                    user_id: App.state.user.id,
                    contact_id: this.activeContactId,
                    theme: theme
                }, { onConflict: 'user_id,contact_id' });

                if (error) await App.UI.Modal.alert("Erreur: " + error.message);
                else {
                    this.applyTheme(theme);
                }
            },

            applyTheme(theme) {
                const area = document.getElementById('msg-area');
                if (!area) return;

                // Remove existing theme classes
                area.classList.forEach(cls => {
                    if (cls.startsWith('chat-theme-')) area.classList.remove(cls);
                });

                // Add new theme class
                if (theme && theme !== 'default') {
                    area.classList.add(`chat-theme-${theme}`);
                }
            },

            toggleSettings() {
                const menu = document.getElementById('chat-settings-menu');
                if (menu) menu.classList.toggle('hidden');
            },

            async changeNickname() {
                if (!this.activeContactId) return;
                const newNick = await App.UI.Modal.prompt("Entrez un surnom pour ce contact :");
                if (newNick) {
                    await this.setNickname(this.activeContactId, newNick);
                    this.openChat(this.activeContactId); // Refresh header
                }
            },

            async toggleReaction(msgId, emoji) {
                const { data: msg } = await sb.from('messages').select('reactions').eq('id', msgId).single();
                let reactions = msg.reactions || [];

                const existingIdx = reactions.findIndex(r => r.user_id === App.state.user.id && r.emoji === emoji);
                if (existingIdx > -1) {
                    reactions.splice(existingIdx, 1);
                } else {
                    reactions.push({ user_id: App.state.user.id, emoji: emoji });
                }

                const { error } = await sb.from('messages').update({ reactions }).eq('id', msgId);
                if (error) await App.UI.Modal.alert("Erreur: " + error.message);
            }
        },

        // 5.5 OBJECTIFS SPIRITUELS (IA GENERATED)
        Objectives: {
            async loadMonthly(userId) {
                const section = document.getElementById('monthly-objectives-section');
                if (!section) return;

                const isMe = userId === App.state.user.id;
                if (!isMe) {
                    section.classList.add('hidden');
                    return;
                }
                section.classList.remove('hidden');

                const now = new Date();
                const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const dateEl = document.getElementById('objectives-date');
                if (dateEl) {
                    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                    dateEl.innerText = `${months[now.getMonth()]} ${now.getFullYear()}`;
                }

                const { data, error } = await sb.from('personal_objectives')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('month_year', monthYear)
                    .maybeSingle();

                if (error) console.error("Error loading objectives:", error);

                if (!data) {
                    await this.generateAI(userId, monthYear);
                } else {
                    this.render(data.objectives, data.id);
                }
            },

            async generateAI(userId, monthYear) {
                const list = document.getElementById('objectives-list');
                if (list) list.innerHTML = '<div class="text-center py-4 text-xs text-primary animate-pulse italic">Faith AI prépare vos défis spirituels du mois...</div>';

                const prompt = "Génère 3 objectifs spirituels courts et concrets pour un chrétien ce mois-ci. Les objectifs doivent aider à améliorer sa foi, sa prière et son partage avec les autres. Réponds UNIQUEMENT avec une liste JSON de chaînes de caractères, exemple: [\"Lire un psaume par jour\", \"Aider un voisin\", \"Prier 10 min matin\"]. Pas de texte avant ou après.";

                try {
                    const res = await fetch('https://uduajuxobmywmkjnawjn.supabase.co/functions/v1/faith-ai', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        },
                        body: JSON.stringify({ question: prompt })
                    });

                    const data = await res.json();
                    let objectivesArr = [];

                    try {
                        const cleanJson = data.answer.replace(/```json|```/g, '').trim();
                        objectivesArr = JSON.parse(cleanJson);
                    } catch (e) {
                        objectivesArr = [
                            "Méditer quotidiennement la parole",
                            "Soutenir un frère ou une sœur dans le besoin",
                            "Approfondir sa vie de prière"
                        ];
                    }

                    const objectives = objectivesArr.map(text => ({ text, completed: false }));

                    const { data: inserted, error } = await sb.from('personal_objectives').insert({
                        user_id: userId,
                        month_year: monthYear,
                        objectives: objectives
                    }).select().single();

                    if (!error && inserted) {
                        this.render(inserted.objectives, inserted.id);
                    }
                } catch (err) {
                    console.error("AI Generation failed:", err);
                    if (list) list.innerHTML = '<p class="text-center text-red-400 text-[10px]">Échec de la génération par l\'IA.</p>';
                }
            },

            render(objectives, rowId) {
                const list = document.getElementById('objectives-list');
                if (!list) return;

                const completedCount = objectives.filter(o => o.completed).length;
                const total = objectives.length;
                const progress = total > 0 ? (completedCount / total) * 100 : 0;

                const bar = document.getElementById('objectives-progress');
                const countEl = document.getElementById('objectives-count');
                if (bar) bar.style.width = `${progress}%`;
                if (countEl) countEl.innerText = `${completedCount}/${total}`;

                list.innerHTML = objectives.map((obj, idx) => `
                    <div class="objective-item ${obj.completed ? 'completed' : ''} p-3 rounded-2xl flex items-center gap-3 bg-white/5 cursor-pointer hover:bg-white/10 transition group" 
                         onclick="App.Features.Objectives.toggle(${idx}, '${rowId}')">
                        <div class="check-circle w-5 h-5 rounded-full border border-white/20 flex items-center justify-center transition-all ${obj.completed ? 'check-animate' : ''}">
                            ${obj.completed ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                        </div>
                        <span class="objective-text text-sm text-gray-200 flex-1">${obj.text}</span>
                    </div>
                `).join('');

                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            async toggle(idx, rowId) {
                const { data } = await sb.from('personal_objectives').select('objectives').eq('id', rowId).single();
                if (!data) return;

                let objectives = data.objectives;
                objectives[idx].completed = !objectives[idx].completed;

                const { error } = await sb.from('personal_objectives').update({ objectives }).eq('id', rowId);
                if (!error) this.render(objectives, rowId);
            }
        },

        // 6. NOTIFICATIONS
        Notifications: {
            async fetch() {
                const container = document.getElementById('notifications-list');
                if (!container) return;

                const { data: notifs, error } = await sb.from('notifications')
                    .select('*, actor:actor_id(username, avatar_url)')
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (error) {
                    container.innerHTML = `<p class="text-center py-10 text-gray-500">Erreur chargement.</p>`;
                    return;
                }

                if (!notifs || notifs.length === 0) {
                    container.innerHTML = `<div class="text-center py-20 text-gray-500 italic">Aucune notification pour le moment. ✨</div>`;
                    this.updateBadges(0);
                    return;
                }

                container.innerHTML = notifs.map(n => this.renderItem(n)).join('');
                this.updateBadges(notifs.filter(n => !n.is_read).length);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            renderItem(n) {
                const actorName = n.actor?.username || "Quelqu'un";
                const actorAvatar = n.actor?.avatar_url || `https://ui-avatars.com/api/?name=${actorName}`;
                let message = "";
                let icon = "bell";
                let color = "text-primary";
                let actionButtons = "";

                switch (n.type) {
                    case 'like':
                    case 'reaction':
                        message = `a réagi à votre publication.`;
                        icon = "heart";
                        color = "text-pink-400";
                        break;
                    case 'comment':
                        message = `a <b>commenté</b> votre publication.`;
                        icon = "message-circle";
                        color = "text-blue-400";
                        if (n.content) message += `<br><span class="text-[10px] italic opacity-70">"${n.content.substring(0, 50)}..."</span>`;
                        break;
                    case 'friend_request':
                        message = `vous a envoyé une <b>demande d'ami</b>.`;
                        icon = "user-plus";
                        color = "text-green-400";
                        // Ajouter boutons Accepter/Refuser
                        if (!n.is_read) {
                            actionButtons = `
                                <div class="flex gap-2 mt-2" onclick="event.stopPropagation()">
                                    <button onclick="App.Features.Friends.acceptRequest('${n.id}', '${n.actor_id}')" 
                                            class="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg transition">
                                        Accepter
                                    </button>
                                    <button onclick="App.Features.Friends.declineRequest('${n.id}')" 
                                            class="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded-lg transition">
                                        Refuser
                                    </button>
                                </div>
                            `;
                        }
                        break;
                    case 'friend_accept':
                        message = `a <b>accepté</b> votre demande d'ami ! 🎉`;
                        icon = "user-check";
                        color = "text-green-400";
                        break;
                    case 'message':
                        message = `vous a envoyé un <b>message</b>.`;
                        icon = "mail";
                        color = "text-purple-400";
                        if (n.content) message += `<br><span class="text-[10px] italic opacity-70">"${n.content.substring(0, 50)}..."</span>`;
                        break;
                    case 'group_invite':
                        message = `vous invite à rejoindre un <b>groupe</b>.`;
                        icon = "users";
                        color = "text-blue-400";
                        break;
                    case 'group_join':
                        message = `a rejoint votre <b>groupe</b>.`;
                        icon = "user-plus";
                        color = "text-blue-400";
                        break;
                    case 'event_invite':
                        message = `vous invite à un <b>événement</b>.`;
                        icon = "calendar";
                        color = "text-yellow-400";
                        break;
                    default:
                        message = `vous a envoyé une notification.`;
                }

                return `
                    <div class="glass-panel p-4 rounded-2xl ${n.is_read ? 'opacity-60' : 'notification-item unread border-l-4 border-primary'} cursor-pointer transition-all hover:bg-white/5" 
                         onclick="App.Features.Notifications.handleClick('${n.id}', '${n.type}', '${n.target_id}')">
                        <div class="flex items-start gap-4">
                            <img src="${actorAvatar}" class="w-10 h-10 rounded-full object-cover hover:ring-2 ring-primary transition-all" 
                                 onclick="event.stopPropagation(); App.UI.navigateTo('profile', '${n.actor_id}')">
                            <div class="flex-1">
                                <p class="text-xs text-white leading-snug"><b>${actorName}</b> ${message}</p>
                                <p class="text-[9px] text-gray-500 mt-1">${new Date(n.created_at).toLocaleString()}</p>
                                ${actionButtons}
                            </div>
                            <div class="${color}"><i data-lucide="${icon}" class="w-5 h-5"></i></div>
                        </div>
                    </div>
                `;
            },

            async handleClick(notifId, type, targetId) {
                await this.markAsRead(notifId);
                if (type === 'like' || type === 'comment') App.UI.navigateTo('home');
                if (type === 'friend_request') App.UI.navigateTo('profile', targetId);
                if (type === 'group_invite') App.UI.navigateTo('group-detail', targetId);
            },

            async markAsRead(id) {
                await sb.from('notifications').update({ is_read: true }).eq('id', id);
                this.fetch();
            },

            async markAllAsRead() {
                await sb.from('notifications').update({ is_read: true }).eq('user_id', App.state.user.id).eq('is_read', false);
                this.fetch();
            },

            async updateBadges(count = -1) {
                if (count === -1) {
                    const { count: unreadCount } = await sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', App.state.user.id).eq('is_read', false);
                    count = unreadCount || 0;
                }
                const dots = ['notif-badge-mobile', 'notif-badge-desktop'];
                dots.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.classList.toggle('hidden', count === 0);
                        if (count > 0) el.classList.add('notification-badge');
                    }
                });
            },

            subscribe() {
                if (!App.state.user) return;
                sb.channel('realtime_notifications')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${App.state.user.id}` }, payload => {
                        this.showToast(payload.new);
                        this.updateBadges();
                        if (App.state.view === 'notifications') this.fetch();
                    })
                    .subscribe();
            },

            async showToast(notif) {
                const container = document.getElementById('notification-toast-container');
                if (!container) return;

                const { data: actor } = await sb.from('profiles').select('username, avatar_url').eq('id', notif.actor_id).maybeSingle();

                const toast = document.createElement('div');
                toast.className = 'notification-toast';

                const actorAvatar = actor?.avatar_url || `https://ui-avatars.com/api/?name=${actor?.username || 'User'}`;
                const text = this.getToastText(notif.type, actor?.username);

                toast.innerHTML = `
                    <img src="${actorAvatar}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1">
                        <p class="text-[11px] text-white"><b>${actor?.username || 'Quelqu\'un'}</b> ${text}</p>
                    </div>
                `;

                toast.onclick = () => {
                    toast.classList.add('expiring');
                    setTimeout(() => toast.remove(), 400);
                    this.handleClick(notif.id, notif.type, notif.target_id);
                };

                container.appendChild(toast);

                setTimeout(() => {
                    toast.classList.add('expiring');
                    setTimeout(() => toast.remove(), 400);
                }, 5000);
            },

            getToastText(type, name) {
                switch (type) {
                    case 'like':
                    case 'reaction':
                        return 'a réagi à votre publication.';
                    case 'comment':
                        return 'a commenté votre publication.';
                    case 'friend_request':
                        return 'vous a envoyé une demande d\'ami.';
                    case 'friend_accept':
                        return 'a accepté votre demande d\'ami.';
                    case 'message':
                        return 'vous a envoyé un message.';
                    case 'group_invite':
                        return 'vous invite dans un groupe.';
                    case 'group_join':
                        return 'a rejoint votre groupe.';
                    case 'event_invite':
                        return 'vous invite à un événement.';
                    default:
                        return 'vous a envoyé une notification.';
                }
            },

            async handleClick(notifId, type, targetId) {
                await this.markAsRead(notifId);

                switch (type) {
                    case 'like':
                    case 'reaction':
                    case 'comment':
                        // Aller au post (ou au feed si pas d'ID spécifique)
                        App.UI.navigateTo('home');
                        break;
                    case 'friend_request':
                    case 'friend_accept':
                        // Aller au profil de la personne
                        if (targetId) App.UI.navigateTo('profile', targetId);
                        break;
                    case 'message':
                        // Ouvrir la conversation
                        if (targetId) {
                            App.UI.navigateTo('messages');
                            setTimeout(() => App.Features.Chat.openDirectChat(targetId), 300);
                        }
                        break;
                    case 'group_invite':
                    case 'group_join':
                        // Aller au groupe
                        if (targetId) App.UI.navigateTo('group-detail', targetId);
                        break;
                    case 'event_invite':
                        // Aller aux événements
                        App.UI.navigateTo('events');
                        break;
                    default:
                        App.UI.navigateTo('notifications');
                }
            },

            async create(type, recipientId, targetId = null, content = "") {
                if (!App.state.user || recipientId === App.state.user.id) return;

                try {
                    await sb.from('notifications').insert([{
                        user_id: recipientId,
                        actor_id: App.state.user.id,
                        type,
                        target_id: targetId,
                        content,
                        is_read: false
                    }]);
                } catch (err) {
                    console.error("Notification creation error:", err);
                }
            }
        },

        // 7. SEARCH & PROFILE
        Finder: {
            async query(q) {
                if (!q) return;

                App.UI.navigateTo('search');
                const queryText = document.getElementById('search-query-text');
                if (queryText) queryText.innerText = `Résultats pour "${q}"`;

                const containers = {
                    users: document.getElementById('search-users-results'),
                    posts: document.getElementById('search-posts-results'),
                    groups: document.getElementById('search-groups-results')
                };

                Object.values(containers).forEach(c => c ? c.innerHTML = '<div class="p-4 animate-pulse text-xs">...</div>' : null);

                try {
                    // 1. Search Users
                    const { data: users } = await sb.from('profiles').select('*').or(`username.ilike.%${q}%,bio.ilike.%${q}%`).limit(10);
                    containers.users.innerHTML = (users && users.length > 0) ? users.map(u => `
                        <div class="glass-panel p-3 rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-2 cursor-pointer group/u" onclick="App.UI.navigateTo('profile', '${u.id}')">
                                <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username}" class="w-10 h-10 rounded-full group-hover/u:ring-2 ring-primary transition-all">
                                <span class="text-sm font-bold text-white group-hover/u:text-primary transition-colors">${u.username}</span>
                            </div>
                            <button onclick="App.UI.navigateTo('profile', '${u.id}')" class="text-primary text-xs font-bold">Voir</button>
                        </div>
                    `).join('') : '<p class="text-gray-500 text-xs p-2">Aucun membre.</p>';

                    // 2. Search Groups & Pages
                    const { data: groups } = await sb.from('groups').select('*').ilike('name', `%${q}%`).limit(10);
                    containers.groups.innerHTML = (groups && groups.length > 0) ? groups.map(g => `
                        <div class="glass-panel p-3 rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center"><i data-lucide="${g.type === 'page' ? 'flag' : 'users'}" class="w-5 h-5 text-primary"></i></div>
                                <div>
                                    <p class="text-sm font-bold text-white">${g.name}</p>
                                    <p class="text-[8px] uppercase text-gray-500 tracking-widest">${g.type}</p>
                                </div>
                            </div>
                            <button onclick="App.UI.navigateTo('group-detail', '${g.id}')" class="text-primary text-xs font-bold">Entrer</button>
                        </div>
                    `).join('') : '<p class="text-gray-500 text-xs p-2">Aucun groupe/page.</p>';

                    // 3. Search Posts
                    const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)').ilike('content', `%${q}%`).limit(10);
                    containers.posts.innerHTML = (posts && posts.length > 0) ? posts.map(post => App.Features.Feed.renderPost(post)).join('') : '<p class="text-gray-500 text-xs p-2">Aucun post.</p>';

                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } catch (err) { console.error(err); }
            }
        },

        // 8. FRIENDS & SOCIAL
        Friends: {
            async sendRequest(targetId) {
                const id = targetId || App.Features.ProfilePage.currentTargetId;
                if (!id) return;

                try {
                    const { error } = await sb.from('friends').insert([{
                        user_id: App.state.user.id,
                        friend_id: id,
                        status: 'pending'
                    }]);

                    if (error) {
                        if (error.code === '23505') await App.UI.Modal.alert("Demande déjà envoyée !");
                        else await App.UI.Modal.alert("Erreur: " + error.message);
                    } else {
                        App.Features.Notifications.create('friend_request', id);
                        await App.UI.Modal.alert("Demande d'ami envoyée ! 🙏");
                        const btn = document.getElementById('btn-add-friend');
                        if (btn) {
                            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> En attente';
                            btn.disabled = true;
                            btn.classList.replace('btn-primary', 'bg-gray-700');
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            },

            async acceptRequest(friendshipId, requesterId) {
                try {
                    const { error } = await sb.from('friends')
                        .update({ status: 'accepted' })
                        .eq('id', friendshipId);

                    if (error) {
                        await App.UI.Modal.alert("Erreur: " + error.message);
                    } else {
                        // Créer une notification pour informer que la demande a été acceptée
                        App.Features.Notifications.create('friend_accept', requesterId, App.state.user.id);
                        await App.UI.Modal.alert("Demande d'ami acceptée ! 🎉");

                        // Recharger les notifications
                        if (App.state.view === 'notifications') {
                            App.Features.Notifications.fetch();
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            },

            async declineRequest(friendshipId) {
                try {
                    const { error } = await sb.from('friends')
                        .delete()
                        .eq('id', friendshipId);

                    if (error) {
                        await App.UI.Modal.alert("Erreur: " + error.message);
                    } else {
                        await App.UI.Modal.alert("Demande refusée");

                        // Recharger les notifications
                        if (App.state.view === 'notifications') {
                            App.Features.Notifications.fetch();
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        },

        // 9. GROUPS
        Groups: {
            currentGroup: null,

            async fetchAll(onlyMine = false) {
                App.state.lastGroupsView = 'groups';
                const container = document.getElementById('groups-container');
                if (!container) return;

                const title = onlyMine ? "Mes Groupes" : "Découvrir des Groupes";
                container.innerHTML = `<div class="col-span-full mb-4"><h3 class="text-xl font-bold text-white">${title}</h3></div>` +
                    '<div class="col-span-full text-center text-xs text-gray-500 animate-pulse">Recherche des groupes...</div>';

                let query = sb.from('groups').select('*').eq('type', 'group');
                if (onlyMine) {
                    query = query.eq('created_by', App.state.user.id);
                }

                const { data: groups } = await query;

                const gridHtml = (groups && groups.length > 0)
                    ? groups.map(g => this.renderCard(g)).join('')
                    : `<p class="col-span-full text-center py-10 text-gray-500">${onlyMine ? "Vous n'avez créé aucun groupe." : "Aucun groupe."}</p>`;

                container.innerHTML = `<div class="col-span-full mb-4 px-2"><h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="${onlyMine ? 'user' : 'users'}"></i> ${title}</h3></div>` + gridHtml;

                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            renderCard(g) {
                return `
                    <div class="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all group cursor-pointer" onclick="App.UI.navigateTo('group-detail', '${g.id}')">
                        <div class="h-24 bg-gray-800 relative">
                             <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                        </div>
                        <div class="p-4 relative -mt-6">
                            <h4 class="font-bold text-white text-lg leading-tight mb-1">${g.name}</h4>
                            <p class="text-xs text-gray-400 mb-3 line-clamp-2">${g.description || 'Pas de description'}</p>
                            <span class="text-primary text-[10px] font-bold uppercase tracking-tighter">Entrer dans le groupe</span>
                        </div>
                    </div>
                `;
            },

            async loadDetail(groupId) {
                this.currentGroup = null;
                const { data: g } = await sb.from('groups').select('*').eq('id', groupId).maybeSingle();
                if (!g) return App.UI.navigateTo('groups');
                this.currentGroup = g;

                document.getElementById('group-detail-name').innerText = g.name;
                document.getElementById('group-detail-description').innerText = g.description || 'Bienvenue dans ce groupe.';
                document.getElementById('group-detail-badge').innerText = g.type;
                document.getElementById('group-detail-icon').setAttribute('data-lucide', g.type === 'page' ? 'flag' : 'users');

                // Subscription Check
                const { data: sub } = await sb.from('group_members').select('*').eq('group_id', groupId).eq('user_id', App.state.user.id).maybeSingle();
                const btnJoin = document.getElementById('btn-group-join');
                const btnPost = document.getElementById('btn-group-post');
                const btnEdit = document.getElementById('btn-group-edit');

                const isCreator = g.created_by === App.state.user.id;

                if (sub || isCreator) {
                    btnJoin.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Membre';
                    btnJoin.className = "bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 flex-1 md:flex-none justify-center";
                    btnPost.classList.remove('hidden');
                } else {
                    btnJoin.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> Rejoindre';
                    btnJoin.className = "btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 flex-1 md:flex-none justify-center";
                    btnPost.classList.add('hidden');
                }

                if (isCreator) {
                    btnEdit.classList.remove('hidden');
                } else {
                    btnEdit.classList.add('hidden');
                }

                // Load Members & Posts
                this.loadMembers(groupId);
                this.loadPosts(groupId);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            async loadMembers(groupId) {
                const container = document.getElementById('group-detail-members-list');
                const { data: members } = await sb.from('group_members').select('profiles(username, avatar_url)').eq('group_id', groupId).limit(8);
                document.getElementById('group-detail-members-count').innerText = members ? members.length : 0;

                if (members && members.length > 0) {
                    container.innerHTML = members.map(m => `
                        <img src="${m.profiles.avatar_url || 'https://ui-avatars.com/api/?name=' + m.profiles.username}" 
                             title="${m.profiles.username}" 
                             class="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10 cursor-pointer hover:ring-primary transition-all"
                             onclick="App.UI.navigateTo('profile', '${m.profiles.id}')">
                    `).join('');
                } else {
                    container.innerHTML = '<div class="col-span-4 text-[10px] text-gray-600 italic text-center">Aucun membre.</div>';
                }
            },

            async toggleSubscription() {
                const groupId = this.currentGroup.id;
                const { data: sub } = await sb.from('group_members').select('*').eq('group_id', groupId).eq('user_id', App.state.user.id).maybeSingle();

                if (sub) {
                    if (await App.UI.Modal.confirm("Voulez-vous vraiment quitter ce groupe ?")) {
                        await sb.from('group_members').delete().eq('id', sub.id);
                        this.loadDetail(groupId);
                    }
                } else {
                    await sb.from('group_members').insert([{ group_id: groupId, user_id: App.state.user.id }]);
                    if (this.currentGroup.created_by !== App.state.user.id) {
                        App.Features.Notifications.create('group_join', this.currentGroup.created_by, groupId, `${App.state.user.username} a rejoint ${this.currentGroup.name}`);
                    }
                    this.loadDetail(groupId);
                }
            },

            async loadPosts(groupId) {
                const container = document.getElementById('group-posts-container');
                const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)').eq('group_id', groupId).order('created_at', { ascending: false });
                container.innerHTML = (posts && posts.length > 0) ? posts.map(p => App.Features.Feed.renderPost(p)).join('') : '<div class="text-center py-10 text-gray-500 italic text-sm">Aucune publication pour le moment.</div>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            async openPostModal() {
                const content = await App.UI.Modal.prompt("Votre message pour le groupe :");
                if (content) this.publishPost(content);
            },

            async publishPost(content) {
                const { error } = await sb.from('posts').insert([{
                    content,
                    user_id: App.state.user.id,
                    group_id: this.currentGroup.id
                }]);
                if (error) await App.UI.Modal.alert(error.message);
                else this.loadPosts(this.currentGroup.id);
            },

            share() {
                const link = `${window.location.origin}${window.location.pathname}?view=group-detail&id=${this.currentGroup.id}`;
                navigator.clipboard.writeText(link).then(() => App.UI.Modal.alert("Lien d'invitation copié ! 🙏"));
            },

            async editModal() {
                const newName = await App.UI.Modal.prompt("Nouveau nom du groupe :", this.currentGroup.name);
                if (!newName) return;

                const newDesc = await App.UI.Modal.prompt("Nouvelle description :", this.currentGroup.description || "");
                if (newName) this.update(newName, newDesc);
            },

            async update(name, description) {
                const { error } = await sb.from('groups').update({ name, description }).eq('id', this.currentGroup.id);
                if (error) await App.UI.Modal.alert(error.message);
                else {
                    await App.UI.Modal.alert("Groupe mis à jour ! ✨");
                    this.loadDetail(this.currentGroup.id);
                }
            },

            async createModal() {
                const name = await App.UI.Modal.prompt("Nom du groupe ou de la page :");
                if (name) this.create(name);
            },

            async create(name) {
                const { error } = await sb.from('groups').insert([{
                    name: name,
                    type: 'group',
                    description: "Groupe créé par " + App.state.profile.username,
                    created_by: App.state.user.id
                }]);

                if (error) await App.UI.Modal.alert("Erreur création : " + error.message);
                else {
                    await App.UI.Modal.alert("Groupe créé avec succès !");
                    this.fetchAll();
                }
            }
        },

        // 9. PAGES
        Pages: {
            async fetchAll(onlyMine = false) {
                App.state.lastGroupsView = 'pages';
                const container = document.getElementById('pages-container');
                if (!container) return;

                const title = onlyMine ? "Mes Pages" : "Découvrir des Pages";
                container.innerHTML = `<div class="col-span-full mb-4"><h3 class="text-xl font-bold text-white">${title}</h3></div>` +
                    '<div class="col-span-full text-center text-xs text-gray-500 animate-pulse">Recherche des pages...</div>';

                let query = sb.from('groups').select('*').eq('type', 'page');
                if (onlyMine) {
                    query = query.eq('created_by', App.state.user.id);
                }

                const { data: pages } = await query;

                const gridHtml = (pages && pages.length > 0)
                    ? pages.map(p => this.renderCard(p)).join('')
                    : `<p class="col-span-full text-center py-10 text-gray-500">${onlyMine ? "Vous n'avez créé aucune page." : "Aucune page."}</p>`;

                container.innerHTML = `<div class="col-span-full mb-4 px-2"><h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="${onlyMine ? 'flag' : 'flags'}"></i> ${title}</h3></div>` + gridHtml;

                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            renderCard(p) {
                return `
                    <div class="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all group cursor-pointer" onclick="App.UI.navigateTo('group-detail', '${p.id}')">
                        <div class="h-24 bg-blue-900/20 relative">
                             <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
                             <div class="absolute top-2 right-2 bg-blue-500/20 text-blue-400 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">Page</div>
                        </div>
                        <div class="p-4 relative -mt-6">
                            <h4 class="font-bold text-white text-lg leading-tight mb-1">${p.name}</h4>
                            <p class="text-xs text-gray-400 mb-3 line-clamp-2">${p.description || 'Pas de description'}</p>
                            <span class="text-primary text-[10px] font-bold uppercase tracking-tighter">Voir la page</span>
                        </div>
                    </div>
                `;
            },

            async createModal() {
                const name = await App.UI.Modal.prompt("Nom de votre page :");
                if (name) this.create(name);
            },

            async create(name) {
                const { error } = await sb.from('groups').insert([{
                    name: name,
                    type: 'page',
                    description: "Page certifiée créée par " + App.state.profile.username,
                    created_by: App.state.user.id
                }]);

                if (error) await App.UI.Modal.alert("Erreur création : " + error.message);
                else {
                    await App.UI.Modal.alert("Page créée avec succès !");
                    this.fetchAll();
                }
            }
        },

        // 10. REALTIME SUBSCRIPTIONS
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
            },
        },

        // 9. PROFILE PAGE LOGIC
        ProfilePage: {
            currentTargetId: null,

            async load(userId = null) {
                if (!App.state.user && !userId) return;
                const id = userId || App.state.user.id;
                this.currentTargetId = id;
                const isMe = id === App.state.user.id;

                const actions = document.getElementById('profile-actions');
                const editBtn = document.getElementById('btn-edit-profile');
                const title = document.getElementById('profile-page-name');
                const tabLabel = document.getElementById('tab-profile-posts');

                if (isMe) {
                    if (actions) actions.classList.add('hidden');
                    if (editBtn) editBtn.classList.remove('hidden');
                    if (title) title.innerText = "Mon Profil";
                    if (tabLabel) tabLabel.innerText = "Mes Posts";
                    this.renderProfileData(App.state.profile);
                    App.Features.Objectives.loadMonthly(id);
                } else {
                    if (actions) actions.classList.remove('hidden');
                    if (editBtn) editBtn.classList.add('hidden');
                    if (tabLabel) tabLabel.innerText = "Posts";

                    const { data: profile } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
                    if (profile) {
                        if (title) title.innerText = profile.username;
                        this.renderProfileData(profile);

                        // Link message button
                        const msgBtn = document.getElementById('btn-message-friend');
                        if (msgBtn) {
                            msgBtn.onclick = () => {
                                App.Features.Chat.openChat(profile.id, profile.username, profile.avatar_url);
                                App.UI.navigateTo('messages');
                            };
                        }
                    }
                    this.checkFriendship(id);
                }

                this.loadStats(id);
                this.loadPosts(id);
            },

            renderProfileData(p) {
                const avatar = document.getElementById('profile-page-avatar');
                const bio = document.getElementById('profile-page-bio');
                if (avatar) avatar.src = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`;
                if (bio) bio.innerText = p.bio || "Membre de FaithConnect";
            },

            async checkFriendship(targetId) {
                const btn = document.getElementById('btn-add-friend');
                if (!btn) return;

                const { data: friendships } = await sb.from('friends')
                    .select('*')
                    .or(`and(user_id.eq.${App.state.user.id},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${App.state.user.id})`)
                    .limit(1);

                const data = friendships?.[0];

                if (data) {
                    if (data.status === 'accepted') {
                        btn.innerHTML = '<i data-lucide="user-check" class="w-4 h-4"></i> Ami';
                        btn.disabled = true;
                        btn.className = "bg-green-600 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2";
                    } else {
                        btn.innerHTML = '<i data-lucide="clock" class="w-4 h-4"></i> En attente';
                        btn.disabled = true;
                        btn.className = "bg-gray-700 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2";
                    }
                } else {
                    btn.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> Ajouter en ami';
                    btn.disabled = false;
                    btn.className = "btn-primary px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2";
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            async loadStats(userId) {
                const id = userId || App.state.user.id;
                const { count: postsCount } = await sb.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', id);
                document.getElementById('stat-posts').innerText = postsCount || 0;

                const { count: friendsCount } = await sb.from('friends').select('*', { count: 'exact', head: true }).or(`user_id.eq.${id},friend_id.eq.${id}`).eq('status', 'accepted');
                document.getElementById('stat-friends').innerText = friendsCount || 0;
            },

            async loadPosts(userId) {
                const id = userId || App.state.user.id;
                const container = document.getElementById('profile-posts-container');
                if (!container) return;

                container.innerHTML = '<div class="text-center py-10 animate-pulse text-xs text-gray-500">Chargement des témoignages...</div>';

                const { data: posts } = await sb.from('posts').select('*, profiles(username, avatar_url)')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false });

                if (posts && posts.length > 0) {
                    container.innerHTML = posts.map(post => App.Features.Feed.renderPost(post)).join('');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                } else {
                    container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs">${id === App.state.user.id ? "Vous n'avez rien publié encore." : "Aucun post pour le moment."}</div>`;
                }
            },

            async loadFriends() {
                const container = document.getElementById('profile-friends-container');
                const id = this.currentTargetId || App.state.user.id;
                container.innerHTML = '<div class="col-span-full text-center py-10 animate-pulse text-xs text-gray-500">Chargement...</div>';

                const { data: friendships } = await sb.from('friends').select('user_id, friend_id').or(`user_id.eq.${id},friend_id.eq.${id}`).eq('status', 'accepted');

                if (friendships) {
                    const friendIds = friendships.map(f => f.user_id === id ? f.friend_id : f.user_id);
                    if (friendIds.length > 0) {
                        const { data: users } = await sb.from('profiles').select('*').in('id', friendIds);
                        if (users) {
                            container.innerHTML = users.map(u => `
                                <div class="glass-panel p-3 rounded-2xl flex flex-col items-center gap-2 group/f transition-all hover:border-primary/30 border border-transparent">
                                     <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + u.username}" 
                                          class="w-12 h-12 rounded-full object-cover cursor-pointer group-hover/f:ring-2 ring-primary transition-all"
                                          onclick="App.UI.navigateTo('profile', '${u.id}')">
                                     <span class="text-xs font-bold text-white truncate max-w-full cursor-pointer group-hover/f:text-primary transition-colors"
                                           onclick="App.UI.navigateTo('profile', '${u.id}')">${u.username}</span>
                                     <button onclick="App.UI.navigateTo('profile', '${u.id}')" 
                                             class="w-full bg-white/5 hover:bg-primary py-1.5 rounded-lg text-[10px] transition-colors font-bold uppercase tracking-tighter">Voir Profil</button>
                                </div>
                            `).join('');
                        }
                    } else {
                        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-xs">Aucun ami trouvé.</div>`;
                    }
                }
            }
        },

        // 📸 SYSTÈME DE STORIES
        Stories: {
            list: [],
            currentIndex: 0,
            timer: null,

            async load() {
                const yesterday = new Date(Date.now() - 86400000).toISOString();
                const { data, error } = await sb.from('stories')
                    .select('*, profiles(username, avatar_url)')
                    .gt('created_at', yesterday)
                    .order('created_at', { ascending: false });

                if (error) return console.error("Error loading stories:", error);
                this.list = data || [];
                this.render();
            },

            render() {
                const container = document.getElementById('stories-list');
                if (!container) return;
                container.innerHTML = this.list.map((s, i) => `
                    <div onclick="App.Features.Stories.open(${i})" class="flex flex-col items-center gap-2 cursor-pointer flex-none animate-scale-in">
                        <div class="w-16 h-16 story-ring shadow-glow">
                            <img src="${s.profiles?.avatar_url || 'https://ui-avatars.com/api/?name='+s.profiles?.username}" 
                                 class="w-full h-full rounded-full object-cover border-2 border-black bg-black">
                        </div>
                        <span class="text-[10px] font-bold text-gray-400 truncate w-16 text-center">${s.profiles?.username}</span>
                    </div>
                `).join('');
            },

            async handleUpload(input) {
                if (!input.files || !input.files[0]) return;
                const file = input.files[0];
                try {
                    App.UI.Modal.alert("Votre story est en cours d'envoi... 🙏", "FaithConnect");
                    const fileName = `story_${App.state.user.id}_${Date.now()}`;
                    const { error: upErr } = await sb.storage.from('stories').upload(fileName, file);
                    if (upErr) throw upErr;

                    const { data: { publicUrl } } = sb.storage.from('stories').getPublicUrl(fileName);
                    const { error: dbErr } = await sb.from('stories').insert({
                        user_id: App.state.user.id,
                        media_url: publicUrl
                    });
                    if (dbErr) throw dbErr;

                    await this.load();
                    App.UI.Modal.alert("Story publiée ! Elle sera visible 24h.");
                } catch (err) {
                    App.UI.Modal.alert("Erreur story: " + err.message);
                }
            },

            open(index) {
                this.currentIndex = index;
                const story = this.list[index];
                const modal = document.getElementById('modal-story-viewer');
                
                document.getElementById('story-viewer-avatar').src = story.profiles?.avatar_url || 'https://ui-avatars.com/api/?name='+story.profiles?.username;
                document.getElementById('story-viewer-name').innerText = story.profiles?.username;
                document.getElementById('story-viewer-content').src = story.media_url;
                
                modal.classList.remove('hidden');
                this.startTimer();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            startTimer() {
                clearTimeout(this.timer);
                this.renderProgress();
                this.timer = setTimeout(() => this.next(), 5000); // 5 secondes par story
            },

            renderProgress() {
                const container = document.getElementById('story-progress-container');
                container.innerHTML = this.list.map((_, i) => `
                    <div class="h-[2px] flex-1 bg-white/20 rounded-full overflow-hidden">
                        <div class="h-full bg-white transition-all duration-[5000ms] linear" 
                             style="width: ${i < this.currentIndex ? '100%' : (i === this.currentIndex ? '100%' : '0%')}"></div>
                    </div>
                `).join('');
            },

            next() {
                if (this.currentIndex < this.list.length - 1) this.open(this.currentIndex + 1);
                else this.close();
            },

            prev() {
                if (this.currentIndex > 0) this.open(this.currentIndex - 1);
            },

            close() {
                clearTimeout(this.timer);
                document.getElementById('modal-story-viewer').classList.add('hidden');
            }
        },

        // 10. QUIZ & CHALLENGES
        Quiz: {
            currentQuiz: null,
            userScore: 0,
            currentQuestionIndex: 0,
            answers: [],

            async load() {
                const loading = document.getElementById('quiz-loading');
                const start = document.getElementById('quiz-start');
                const game = document.getElementById('quiz-game');
                const result = document.getElementById('quiz-result');

                // Reset Views
                loading.classList.remove('hidden');
                start.classList.add('hidden');
                game.classList.add('hidden');
                result.classList.add('hidden');

                this.loadLeaderboard();

                // Check for this week's quiz
                const now = new Date();
                const day = now.getDay();
                const diff = now.getDate() - day + (day == 0 ? -6 : 1);
                const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];

                const { data: quiz } = await sb.from('weekly_quizzes')
                    .select('*')
                    .eq('week_start', monday)
                    .maybeSingle();

                if (quiz) {
                    this.currentQuiz = quiz;
                    this.showStart(quiz);
                } else {
                    this.generate(monday);
                }
            },

            async generate(weekStart) {
                const prompt = "Génère un quiz biblique de 5 questions (QCM). Thème aléatoire. Format JSON strict: { \"theme\": \"Titre\", \"questions\": [ { \"q\": \"Question?\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"answer\": 0 } ] }";

                try {
                    // Simulation of AI generation if function not available
                    // In real app, call Edge Function
                    const mockQuiz = {
                        theme: "Les Paraboles de Jésus",
                        questions: [
                            { q: "Qui a aidé l'homme blessé dans la parabole du bon Samaritain ?", options: ["Un prêtre", "Un lévite", "Un Samaritain", "Un soldat"], answer: 2 },
                            { q: "Qu'a perdu la femme dans la parabole de la drachme perdue ?", options: ["Une brebis", "Une pièce d'argent", "Un collier", "Une perle"], answer: 1 },
                            { q: "Dans la parabole du semeur, que représentent les oiseaux ?", options: ["Les anges", "Le diable", "Les soucis", "La richesse"], answer: 1 },
                            { q: "Quel fils a demandé sa part d'héritage ?", options: ["Le plus jeune", "L'aîné", "Le troisième", "Aucun"], answer: 0 },
                            { q: "A quoi est comparé le Royaume des Cieux ?", options: ["Une graine de moutarde", "Un grand arbre", "Une montagne", "Une rivière"], answer: 0 }
                        ]
                    };

                    setTimeout(async () => {
                        // Try insert real DB
                        const { data: newQuiz } = await sb.from('weekly_quizzes').insert({
                            week_start: weekStart,
                            theme: mockQuiz.theme,
                            questions: mockQuiz.questions
                        }).select().maybeSingle();

                        this.currentQuiz = newQuiz || { ...mockQuiz, id: 'temp' };
                        this.showStart(this.currentQuiz);
                    }, 1500);

                } catch (e) {
                    console.error(e);
                }
            },

            showStart(quiz) {
                document.getElementById('quiz-loading').classList.add('hidden');
                document.getElementById('quiz-start').classList.remove('hidden');
                document.getElementById('quiz-theme-title').innerText = quiz.theme;
            },

            start() {
                if (!this.currentQuiz) return;
                this.userScore = 0;
                this.currentQuestionIndex = 0;

                document.getElementById('quiz-start').classList.add('hidden');
                document.getElementById('quiz-game').classList.remove('hidden');
                this.renderQuestion();
            },

            renderQuestion() {
                const q = this.currentQuiz.questions[this.currentQuestionIndex];
                document.getElementById('quiz-progress').innerText = `Question ${this.currentQuestionIndex + 1}/${this.currentQuiz.questions.length}`;
                document.getElementById('quiz-question-text').innerText = q.q;

                const optsContainer = document.getElementById('quiz-options-container');
                optsContainer.innerHTML = q.options.map((opt, idx) => `
                    <button onclick="App.Features.Quiz.submitAnswer(${idx})" 
                            class="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/50 transition flex items-center gap-3 group">
                        <span class="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-xs font-bold text-gray-400 group-hover:bg-primary group-hover:text-white transition">${['A', 'B', 'C', 'D'][idx]}</span>
                        <span class="font-medium text-sm">${opt}</span>
                    </button>
                `).join('');
            },

            async submitAnswer(idx) {
                const q = this.currentQuiz.questions[this.currentQuestionIndex];
                const isCorrect = idx === q.answer;

                if (isCorrect) this.userScore += 20;
                document.getElementById('quiz-score-live').innerText = `Score: ${this.userScore}`;

                this.currentQuestionIndex++;
                if (this.currentQuestionIndex < this.currentQuiz.questions.length) {
                    this.renderQuestion();
                } else {
                    this.endGame();
                }
            },

            async endGame() {
                document.getElementById('quiz-game').classList.add('hidden');
                document.getElementById('quiz-result').classList.remove('hidden');
                document.getElementById('quiz-final-score').innerText = `${this.userScore}/100`;

                if (App.state.user && this.currentQuiz.id !== 'temp') {
                    await sb.from('quiz_scores').insert({
                        quiz_id: this.currentQuiz.id,
                        user_id: App.state.user.id,
                        score: this.userScore
                    });
                    this.loadLeaderboard();
                }
            },



            async loadLeaderboard() {
                const container = document.getElementById('quiz-leaderboard');
                if (!container || !this.currentQuiz?.id) return;

                const { data: scores } = await sb.from('quiz_scores')
                    .select('score, profiles(username, avatar_url)')
                    .eq('quiz_id', this.currentQuiz.id)
                    .order('score', { ascending: false })
                    .limit(5);

                if (scores && scores.length > 0) {
                    container.innerHTML = scores.map((s, i) => `
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                            <div class="font-black text-xl w-6 text-center ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}">#${i + 1}</div>
                            <img src="${s.profiles.avatar_url || 'https://ui-avatars.com/api/?name=' + s.profiles.username}" class="w-10 h-10 rounded-full object-cover">
                            <div class="flex-1">
                                <p class="font-bold text-sm">${s.profiles.username}</p>
                            </div>
                            <div class="font-black text-lg text-primary">${s.score}</div>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">Aucun score pour le moment.</p>';
                }
            },

                      share() {
                const text = `J'ai fait ${this.userScore}/100 au quiz FaithConnect ! 🏆`;
                if (navigator.share) navigator.share({ title: 'FaithConnect', text, url: window.location.href });
                else navigator.clipboard.writeText(text).then(() => App.UI.Modal.alert("Copié !"));
            }
        }, // <--- VIRGULE IMPORTANTE ICI (Fin du Quiz)

     // === MODULE DÉVOTIONNELS RE-CORRIGÉ ===
// On s'assure que ce bloc est bien intégré dans App.Features
        Devotionals: {
            activePlan: null,
            userProgress: null,

            async load() {
                const container = document.getElementById('devotionals-container');
                if (!container) return;
                container.innerHTML = '<div class="text-center py-20 animate-pulse text-gray-500">Chargement de la Parole...</div>';

                if (!App.state.user) return;

                try {
                    const { data: progress } = await sb.from('user_devotionals')
                        .select('*, devotional_plans(*)')
                        .eq('user_id', App.state.user.id)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (progress && progress.devotional_plans) {
                        this.userProgress = progress;
                        this.activePlan = progress.devotional_plans;
                        this.renderCurrentDay();
                    } else {
                        this.renderSelector();
                    }
                } catch (e) {
                    container.innerHTML = '<div class="text-center text-red-400">Erreur de connexion.</div>';
                }
            },

            renderSelector() {
                const themes = [
                    { id: 'anxiety', label: 'Vaincre l\'anxiété', icon: 'wind' },
                    { id: 'patience', label: 'La patience', icon: 'clock' },
                    { id: 'gratitude', label: 'La gratitude', icon: 'sun' },
                    { id: 'faith', label: 'Fortifier sa foi', icon: 'shield' }
                ];
                const container = document.getElementById('devotionals-container');
                if (!container) return;

                container.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in-up">
                        ${themes.map(t => `
                            <div onclick="App.Features.Devotionals.startNew('${t.label}')" class="glass-panel p-6 rounded-2xl cursor-pointer hover:border-primary text-center group">
                                <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition">
                                    <i data-lucide="${t.icon}" class="text-primary group-hover:text-white"></i>
                                </div>
                                <h4 class="font-bold text-white">${t.label}</h4>
                                <p class="text-[10px] text-gray-500 mt-2">Plan de 7 jours par Faith AI</p>
                            </div>
                        `).join('')}
                    </div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            },

            async startNew(theme) {
                alert("Faith AI génère votre parcours... 🙏");
                const prompt = `Plan 7 jours thème "${theme}". JSON: [{"day":1,"title":"..","verse":"..","meditation":".."}]`;
                try {
                    const res = await fetch(`${SUPABASE_URL}/functions/v1/faith-ai`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
                        body: JSON.stringify({ question: prompt })
                    });
                    const data = await res.json();
                    let jsonStr = data.answer.substring(data.answer.indexOf('['), data.answer.lastIndexOf(']') + 1);
                    const days = JSON.parse(jsonStr);

                    const { data: plan } = await sb.from('devotional_plans').insert({ theme, title: theme, days_json: days }).select().single();
                    await sb.from('user_devotionals').insert({ user_id: App.state.user.id, plan_id: plan.id, status: 'active', current_day: 1 });
                    this.load();
                } catch (e) { alert("Erreur IA : " + e.message); }
            },

            renderCurrentDay() {
                const day = this.activePlan.days_json[this.userProgress.current_day - 1];
                const progress = (this.userProgress.current_day / 7) * 100;
                document.getElementById('devotionals-container').innerHTML = `
                    <div class="glass-panel p-6 rounded-[32px] border-t-4 border-primary">
                        <div class="flex justify-between mb-4 text-[10px] font-bold text-primary">
                            <span>JOUR ${this.userProgress.current_day} / 7</span>
                            <span>${Math.round(progress)}%</span>
                        </div>
                        <h3 class="text-xl font-black mb-4 text-white">${day.title}</h3>
                        <div class="bg-white/5 p-4 rounded-xl mb-6 italic text-sm text-gray-200 border-l-4 border-primary">
                            "${day.verse}"
                        </div>
                        <p class="text-gray-300 text-sm leading-relaxed mb-8">${day.meditation}</p>
                        <button onclick="App.Features.Devotionals.completeDay()" class="btn-primary w-full py-4 rounded-xl font-bold">
                            Marquer comme terminé
                        </button>
                    </div>`;
            },

            async completeDay() {
                const next = this.userProgress.current_day + 1;
                if (next > 7) {
                    await sb.from('user_devotionals').update({ status: 'completed' }).eq('id', this.userProgress.id);
                    alert("Félicitations ! Parcours terminé. 🎉");
                } else {
                    await sb.from('user_devotionals').update({ current_day: next }).eq('id', this.userProgress.id);
                }
                this.load();
            }
        }
    } // Fin de Features
}; // Fin de App

// Lancement impératif
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
