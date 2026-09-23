export default async function handler(req, res) {
  try {
    // Autoriser GET uniquement pour lancer le test depuis le navigateur
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Méthode non autorisée."
      });
    }

    // 1. Récupérer le dernier compte TikTok connecté
    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`
        }
      }
    );

    const tokens = await supabaseResponse.json();

    if (!supabaseResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du compte TikTok.",
        supabase: tokens
      });
    }

    if (!tokens.length) {
      return res.status(404).json({
        success: false,
        message: "Aucun compte TikTok connecté."
      });
    }

    const token = tokens[0];

    // 2. Taille de la vidéo de test
    const videoSize = 17074676;

    // 3. Initialiser le Direct Post TikTok
    // SELF_ONLY = test privé, aucune publication publique
    const tiktokResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          post_info: {
            title: "Test Curio — Golf sur la Lune",
            privacy_level: "SELF_ONLY",
            disable_comment: true,
            disable_duet: true,
            disable_stitch: true
          },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1
          }
        })
      }
    );

    const data = await tiktokResponse.json();

    // 4. Retourner l'erreur TikTok si nécessaire
    if (!tiktokResponse.ok) {
      return res.status(tiktokResponse.status).json({
        success: false,
        tiktok: data
      });
    }

    // 5. Test réussi
    return res.status(200).json({
      success: true,
      message: "Direct Post TikTok initialisé avec succès.",
      privacy_level: "SELF_ONLY",
      publish_id: data.data?.publish_id || null,
      upload_url_received: !!data.data?.upload_url
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur.",
      error: error.message
    });
  }
}
