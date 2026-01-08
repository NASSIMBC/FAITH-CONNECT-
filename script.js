// ============================
// 1. CONFIGURATION APPWRITE
// ============================
const client = new Appwrite.Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1') // ton endpoint Appwrite
    .setProject('695fc25c0015900d7334');         // ton projectId Appwrite

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const storage = new Appwrite.Storage(client);

const DB_ID = '695fcf8000003dcafb64';
const COLL_PROFILES = 'profiles';
const BUCKET_ID = 'faith-storage';

// ============================
// 2. AUTHENTIFICATION
// ============================

let currentUser = null;
let userProfile = null;

// Quand la page charge
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// Vérifier la session
async function checkSession() {
    try {
        currentUser = await account.get();
        await loadUserProfile();
        showApp();
    } catch (err) {
        showLoginPage();
    }
}

// Afficher page principale
function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
}

// Afficher page login
function showLoginPage() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

// ============================
// 3. CREER UN COMPTE
// ============================
async function signup() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const username = document.getElementById('signup-username').value.trim();

    if (!email || !password || !username) return alert("Tous les champs sont requis !");

    try {
        // Créer le compte Appwrite
        const user = await account.create(
            Appwrite.ID.unique(),
            email,
            password,
            username
        );

        // Créer le profil dans la base
        userProfile = await databases.createDocument(DB_ID, COLL_PROFILES, user.$id, {
            username: username,
            bio: "Nouveau membre",
            status_text: "Nouveau ici !",
            status_emoji: "👋",
            avatar_url: ""
        });

        // Créer la session automatiquement après signup
        await account.createEmailSession(email, password);
        currentUser = await account.get();
        showApp();
        updateUIProfile();

    } catch (err) {
        console.error("Erreur signup:", err);
        alert("Impossible de créer le compte : " + err.message);
    }
}

// ============================
// 4. CONNEXION
// ============================
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) return alert("Email et mot de passe requis !");

    try {
        await account.createEmailSession(email, password);
        currentUser = await account.get();
        await loadUserProfile();
        showApp();
        updateUIProfile();
    } catch (err) {
        console.error("Erreur login:", err);
        alert("Impossible de se connecter : " + err.message);
    }
}

// ============================
// 5. CHARGER LE PROFIL
// ============================
async function loadUserProfile() {
    try {
        userProfile = await databases.getDocument(DB_ID, COLL_PROFILES, currentUser.$id);
    } catch {
        const username = currentUser.name || "Utilisateur";
        userProfile = await databases.createDocument(DB_ID, COLL_PROFILES, currentUser.$id, {
            username,
            bio: "Nouveau membre",
            status_text: "Nouveau ici !",
            status_emoji: "👋",
            avatar_url: ""
        });
    }
    updateUIProfile();
}

// ============================
// 6. AFFICHAGE PROFIL
// ============================
function updateUIProfile() {
    if(!userProfile) return;
    document.getElementById('user-display').innerText = userProfile.username;
    document.getElementById('status-text-display').innerText = userProfile.status_text || "Ajouter un statut...";
    document.getElementById('status-emoji-display').innerText = userProfile.status_emoji || "👋";
}

// ============================
// 7. DECONNEXION
// ============================
async function logout() {
    try {
        await account.deleteSession('current');
        currentUser = null;
        userProfile = null;
        showLoginPage();
    } catch (err) {
        console.error("Erreur logout:", err);
        alert("Impossible de se déconnecter");
    }
}

// ============================
// UTILISATION DANS HTML
// ============================
// Boutons HTML :
// <button onclick="signup()">Créer un compte</button>
// <button onclick="login()">Se connecter</button>
// <button onclick="logout()">Déconnexion</button>
