export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Méthode non autorisée."
      });
    }

    // Vidéo de test
    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    // 1. Récupérer le dernier token TikTok
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

    if (!supabaseResponse.ok || !tokens.length) {
      return res.status(500).json({
        success: false,
        message: "Token TikTok introuvable",
        details: tokens
      });
    }

    const token = tokens[0];

    // 2. Télécharger la vidéo
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        message: "Impossible de récupérer la vidéo",
        status: videoResponse.status
      });
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const videoSize = videoBuffer.length;

    // 3. Initialiser le Direct Post
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
            title: "Curio — Les premières balles de golf sur la Lune",
            privacy_level: "SELF_ONLY",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
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

    // 4. Envoyer la vidéo à TikTok
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoSize),
        "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`
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

    // 5. Attendre puis vérifier le statut plusieurs fois
    const statusResults = [];

    for (let attempt = 1; attempt <= 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Content-Type": "application/json; charset=UTF-8"
          },
          body: JSON.stringify({
            publish_id: publishId
          })
        }
      );

      const statusData = await statusResponse.json();

      statusResults.push({
        attempt,
        http_status: statusResponse.status,
        response: statusData
      });

      const status = statusData?.data?.status;

      if (
        status === "PUBLISH_COMPLETE" ||
        status === "FAILED"
      ) {
        break;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Vidéo envoyée à TikTok.",
      video_size: videoSize,
      publish_id: publishId,
      upload_http_status: uploadResponse.status,
      status_checks: statusResults
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
}
