export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Utilise POST pour publier."
      });
    }

    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    // =====================================================
    // 1. Récupérer le token TikTok
    // =====================================================

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/tiktok_tokens?select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization:
            `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    const tokens = await supabaseResponse.json();

    if (!supabaseResponse.ok || !tokens.length) {
      return res.status(500).json({
        success: false,
        step: "TOKEN",
        message: "Token TikTok introuvable."
      });
    }

    const token = tokens[0];

    // =====================================================
    // 2. Récupérer les informations du créateur
    // =====================================================

    const creatorResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        }
      }
    );

    const creatorData = await creatorResponse.json();

    if (!creatorResponse.ok) {
      return res.status(creatorResponse.status).json({
        success: false,
        step: "CREATOR_INFO",
        tiktok: creatorData
      });
    }

    const creator = creatorData.data;

    if (!creator) {
      return res.status(500).json({
        success: false,
        step: "CREATOR_INFO",
        message: "Informations créateur introuvables."
      });
    }

    // =====================================================
    // 3. Paramètres fournis par l'utilisateur
    // =====================================================

    const title =
      typeof req.body?.title === "string" &&
      req.body.title.trim()
        ? req.body.title.trim()
        : "Curio — Les premières balles de golf sur la Lune";

    const requestedPrivacy =
      typeof req.body?.privacy_level === "string"
        ? req.body.privacy_level
        : "SELF_ONLY";

    const privacyOptions =
      creator.privacy_level_options || [];

    if (!privacyOptions.includes(requestedPrivacy)) {
      return res.status(400).json({
        success: false,
        step: "PRIVACY",
        message: "Niveau de confidentialité non autorisé.",
        requested: requestedPrivacy,
        available: privacyOptions
      });
    }

    // =====================================================
    // 4. Télécharger la vidéo
    // =====================================================

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "VIDEO_DOWNLOAD",
        message: "Impossible de récupérer la vidéo.",
        status: videoResponse.status
      });
    }

    const videoBuffer = Buffer.from(
      await videoResponse.arrayBuffer()
    );

    const videoSize = videoBuffer.length;

    if (!videoSize) {
      return res.status(400).json({
        success: false,
        step: "VIDEO",
        message: "La vidéo est vide."
      });
    }

    // =====================================================
    // 5. Initialiser Direct Post
    // =====================================================

    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          post_info: {
            title,
            privacy_level: requestedPrivacy,
            disable_duet: Boolean(creator.duet_disabled),
            disable_comment: Boolean(creator.comment_disabled),
            disable_stitch: Boolean(creator.stitch_disabled),
            is_aigc: true
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

    const initData = await initResponse.json();

    if (!initResponse.ok || !initData.data?.publish_id) {
      return res.status(initResponse.status || 500).json({
        success: false,
        step: "INIT",
        tiktok: initData
      });
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // =====================================================
    // 6. Envoyer la vidéo
    // =====================================================

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
        "Content-Range":
          `bytes 0-${videoSize - 1}/${videoSize}`
      },
      body: videoBuffer
    });

    const uploadText = await uploadResponse.text();

    if (!uploadResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "UPLOAD",
        publish_id: publishId,
        upload_http_status: uploadResponse.status,
        upload_response: uploadText
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vidéo envoyée à TikTok.",
      publish_id: publishId,
      privacy_level: requestedPrivacy,
      title,
      upload_http_status: uploadResponse.status
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur.",
      error: error.message
    });
  }
}
