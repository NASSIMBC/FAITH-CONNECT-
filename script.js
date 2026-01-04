// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uduajuxobmywmkjnawjn.supabase.co';
// NOTE : Assurez-vous qu'il s'agit bien de la clé "anon" (publique) et non "service_role".
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdWFqdXhvYm15d21ram5hd2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjUyMTUsImV4cCI6MjA4MzA0MTIxNX0.Vn1DpT9l9N7sVb3kVUPRqr141hGvM74vkZULJe59YUU';

// Initialisation du client (changement de nom pour éviter le conflit avec la librairie globale)
// Assurez-vous d'avoir importé supabase-js via CDN ou npm avant ce script.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. GESTION UTILISATEUR (AUTH)
// ==========================================
let currentUser = null;

// Vérifier au démarrage si l'utilisateur est déjà connecté
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        loginSuccess(session.user);
    } else {
        // Afficher la page de login si pas connecté
        const loginPage = document.getElementById('login-page');
        if (loginPage) {
            loginPage.classList.remove('hidden');
            loginPage.classList.remove('opacity-0');
        }
    }
}

// Configuration de l'utilisateur connecté
function loginSuccess(user) {
    // On crée un pseudo basé sur le début de l'email
    const namePart = user.email.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    
    currentUser = {
        email: user.email,
        name: formattedName,
        initials: formattedName.substring(0, 2).toUpperCase()
    };

    // Mise à jour de l'interface Profil
    updateUIProfile();
    
    // Transition fluide : Cacher Login -> Afficher App
    const loginPage = document.getElementById('login-page');
    if (loginPage) {
        loginPage.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        
        setTimeout(() => {
            loginPage.classList.add('hidden');
            const mainApp = document.getElementById('main-app');
            if (mainApp) mainApp.classList.remove('hidden');
            
            // Charger les données de l'app
            loadAppData();
        }, 500);
    } else {
        // Si pas de page login (développement), on charge direct
        loadAppData();
    }
}

function updateUIProfile() {
    // Mise à jour des initiales dans le header
    const initialsDiv = document.getElementById('user-initials');
    if(initialsDiv) initialsDiv.innerText = currentUser.initials;
    
    // Mise à jour du nom complet
    const userDisplay = document.getElementById('user-display');
    if(userDisplay) userDisplay.innerText = currentUser.name;
    
    // Mise à jour de l'avatar zone de saisie
    const smallAvatar = document.getElementById('current-user-avatar-small');
    if(smallAvatar) smallAvatar.innerText = currentUser.initials; 
}

// Inscription
async function handleSignUp() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if(!email || !password) return alert("Veuillez remplir email et mot de passe !");

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        alert("Erreur : " + error.message);
    } else {
        alert("Inscription réussie ! Vérifiez vos emails pour confirmer, ou connectez-vous.");
    }
}

// Connexion
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Erreur de connexion : " + error.message);
    } else {
        loginSuccess(data.user);
    }
}

// Déconnexion
async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// ==========================================
// 3. LOGIQUE DU RESEAU SOCIAL
// ==========================================

function loadAppData() {
    fetchPosts();          // Charger les messages de la base de données
    subscribeToRealtime(); // Écouter les nouveaux messages
    
    // Charger les éléments visuels (Fonctions placeholders ajoutées plus bas pour éviter les erreurs)
    renderStories();
    renderPrayers();
    renderMessagesList();
    renderReels();
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    // Verset du jour
    const verses = [
        {txt: "Car Dieu a tant aimé le monde...", ref: "Jean 3:16"}, 
        {txt: "L'Éternel est mon berger...", ref: "Psaume 23:1"}, 
        {txt: "Je puis tout par celui qui me fortifie...", ref: "Phil 4:13"}
    ];
    const randV = verses[Math.floor(Math.random()*verses.length)];
    const vContainer = document.getElementById('verse-container');
    if(vContainer) {
        vContainer.innerHTML = `
            <p class="mb-1">✨ Verset du jour</p>
            <p class="italic text-white">"${randV.txt}"</p>
            <p class="text-xs text-right text-purple-400 mt-1">- ${randV.ref}</p>
        `;
    }
}

// --- PLACEHOLDERS POUR EVITER LES ERREURS ---
// Ces fonctions étaient appelées mais n'existaient pas dans votre code
function renderStories() { console.log("Chargement des stories..."); }
function renderPrayers() { console.log("Chargement des prières..."); }
function renderMessagesList() { console.log("Chargement des messages..."); }
function renderReels() { console.log("Chargement des réels..."); }

// --- POSTS (Base de données) ---

// A. Récupérer les messages existants
async function fetchPosts() {
    const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erreur chargement posts:", error);
    } else {
        renderPostsList(data);
    }
}

// B. Écouter le TEMPS RÉEL
function subscribeToRealtime() {
    supabaseClient.channel('public:posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
            console.log('Nouveau post !', payload.new);
            addPostToHTML(payload.new, true); // true = ajouter en haut
            
            // IMPORTANT : Recharger les icônes pour le nouvel élément
            if(typeof lucide !== 'undefined') lucide.createIcons();
        })
        .subscribe();
}

// C. Publier un message
async function publishPost() {
    if (!currentUser) {
        alert("Vous devez être connecté pour publier.");
        return;
    }

    const input = document.getElementById('new-post-input');
    const content = input.value;

    if (!content.trim()) return;

    // Envoi vers Supabase (Table 'posts')
    const { error } = await supabaseClient
        .from('posts')
        .insert([
            { 
                content: content, 
                user_name: currentUser.name, 
                avatar_initials: currentUser.initials 
            }
        ]);

    if (error) {
        alert("Erreur d'envoi : " + error.message);
    } else {
        input.value = ''; // Vider le champ si succès
    }
}

// --- AFFICHAGE DES POSTS ---

function renderPostsList(postsData) {
    const container = document.getElementById('posts-container');
    if (!container) return;
    
    container.innerHTML = ''; // Vider le container

    if (!postsData || postsData.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-10">Soyez le premier à publier !</div>';
        return;
    }

    postsData.forEach(post => addPostToHTML(post, false));
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function addPostToHTML(post, isNew) {
    const container = document.getElementById('posts-container');
    if (!container) return;
    
    // Conversion de la date Supabase en heure lisible
    const timeString = new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Correction de la structure HTML (fermeture des divs corrigée)
    const postHTML = `
        <div class="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30 transition-all hover:bg-gray-800/60 mb-4 ${isNew ? 'animate-pulse' : ''}">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-white shadow-md border border-purple-400/30 text-xs">
                        ${post.avatar_initials}
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-sm sm:text-base">${post.user_name}</h3>
                        <p class="text-xs text-gray-400 flex items-center gap-1">${timeString}</p>
                    </div>
                </div>
                <button class="text-gray-400 hover:text-white"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
            </div>
            
            <p class="text-purple-100 mb-4 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">${post.content}</p>
            
            <div class="flex items-center justify-between border-t border-purple-500/30 pt-3">
                <button class="flex items-center space-x-2 text-purple-300 hover:text-pink-400 transition-colors">
                    <i data-lucide="heart" class="w-5 h-5"></i>
                    <span class="text-sm">0</span>
                </button>
                <button class="flex items-center space-x-2 text-purple-300 hover:text-pink-400 transition-colors">
                    <i data-lucide="message-circle" class="w-5 h-5"></i>
                    <span class="text-sm">0</span>
                </button>
                <button class="flex items-center space-x-2 text-purple-300 hover:text-pink-400 transition-colors">
                    <i data-lucide="share-2" class="w-5 h-5"></i>
                    <span class="text-sm">Partager</span>
                </button>
            </div>
        </div>
    `;
    
    if (isNew) {
        container.insertAdjacentHTML('afterbegin', postHTML);
    } else {
        container.insertAdjacentHTML('beforeend', postHTML);
    }
}

// Lancement automatique au chargement de la page
document.addEventListener('DOMContentLoaded', checkSession);
