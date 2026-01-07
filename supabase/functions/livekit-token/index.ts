import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// On importe le kit de création de tickets LiveKit
import { AccessToken } from "npm:livekit-server-sdk";

serve(async (req) => {
  // 1. Gérer les permissions (CORS) pour que ton téléphone puisse parler au serveur
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }});
  }

  try {
    // 2. Récupérer les clés depuis les réglages sécurisés (on les mettra après)
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error("Clés LiveKit manquantes !");
    }

    // 3. Lire ce que le téléphone envoie (Nom de la salle, Pseudo)
    const { roomName, username, isHost } = await req.json();

    if (!roomName || !username) {
       throw new Error("Il manque le nom de la salle ou l'utilisateur");
    }

    // 4. Créer le Ticket (Token)
    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
      ttl: '1h', // Le ticket est valable 1 heure
    });

    // Donner les droits (Host = peut filmer / Viewer = peut juste regarder)
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: isHost,       // Seul l'hôte active la caméra
      canSubscribe: !isHost,    // Les autres regardent
      canPublishData: isHost,
    });

    // Convertir en texte chiffré
    const token = await at.toJwt();

    // 5. Renvoyer le ticket au téléphone
    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});y