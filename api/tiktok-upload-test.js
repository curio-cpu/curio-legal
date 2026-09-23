export default async function handler(req, res) {
  try {
    // ==================================================
    // 1. RÉCUPÉRATION DU TOKEN TIKTOK DANS SUPABASE
    // ==================================================

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      return res.status(500).json({
        success: false,
        step: "environment",
        message: "SUPABASE_URL est manquant dans Vercel"
      });
    }

    if (!supabaseKey) {
      return res.status(500).json({
        success: false,
        step: "environment",
        message: "SUPABASE_SECRET_KEY est manquant dans Vercel"
      });
    }

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/tiktok_tokens?select=open_id,access_token,refresh_token,scope,expires_at,updated_at&order=updated_at.desc&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json"
        }
      }
    );

    const supabaseText = await supabaseResponse.text();

    if (!supabaseResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "supabase",
        status: supabaseResponse.status,
        message: "Supabase refuse la lecture du token TikTok",
        details: supabaseText
      });
    }

    let tokens;

    try {
      tokens = JSON.parse(supabaseText);
    } catch {
      return res.status(500).json({
        success: false,
        step: "supabase_json",
        message: "Réponse Supabase invalide",
        details: supabaseText
      });
    }

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(404).json({
        success: false,
        step: "token",
        message: "Aucun token TikTok trouvé dans Supabase"
      });
    }

    const token = tokens[0];

    if (!token.access_token) {
      return res.status(404).json({
        success: false,
        step: "token",
        message: "Le token TikTok est absent de Supabase"
      });
    }

    const accessToken = token.access_token;

    // ==================================================
    // 2. VÉRIFICATION DU SCOPE
    // ==================================================

    const scopes = String(token.scope || "")
      .split(/[,\s]+/)
      .filter(Boolean);

    if (!scopes.includes("video.upload")) {
      return res.status(403).json({
        success: false,
        step: "scope",
        message: "Le token TikTok ne possède pas le scope video.upload",
        scopes
      });
    }

    // ==================================================
    // 3. TÉLÉCHARGEMENT DE LA VIDÉO
    // ==================================================

    const videoUrl =
      "https://raw.githubusercontent.com/curio-cpu/curio-legal/main/2026-09-22-173225235.mp4";

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return res.status(500).json({
        success: false,
        step: "video_download",
        status: videoResponse.status,
        message: "Impossible de récupérer la vidéo depuis GitHub"
      });
    }

    const videoBuffer = Buffer.from(
      await videoResponse.arrayBuffer()
    );

    const videoSize = videoBuffer.length;

    if (!videoSize) {
      return res.status(500).json({
        success: false,
        step: "video_size",
        message: "La vidéo téléchargée est vide"
      });
    }

    // ==================================================
    // 4. CONFIGURATION DES CHUNKS
    // ==================================================

    // TikTok accepte des chunks de 5 MB à 64 MB.
    // 10 MB est utilisé ici pour rester simple.
    const CHUNK_SIZE = 10 * 1024 * 1024;

    const totalChunkCount =
      Math.ceil(videoSize / CHUNK_SIZE);

    // ==================================================
    // 5. INITIALISATION DU UPLOAD TIKTOK
    // ==================================================

    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size:
              totalChunkCount === 1
                ? videoSize
                : CHUNK_SIZE,
            total_chunk_count: totalChunkCount
          }
        })
      }
    );

    const initText = await initResponse.text();

    let initData;

    try {
      initData = JSON.parse(initText);
    } catch {
      return res.status(500).json({
        success: false,
        step: "tiktok_init_json",
        message: "TikTok a retourné une réponse invalide",
        details: initText
      });
    }

    if (
      !initResponse.ok ||
      initData.error?.code !== "ok"
    ) {
      return res.status(initResponse.status || 400).json({
        success: false,
        step: "tiktok_init",
        status: initResponse.status,
        tiktok: initData
      });
    }

    const publishId = initData.data?.publish_id;
    const uploadUrl = initData.data?.upload_url;

    if (!publishId || !uploadUrl) {
      return res.status(500).json({
        success: false,
        step: "tiktok_init_response",
        message: "TikTok n'a pas fourni publish_id ou upload_url",
        tiktok: initData
      });
    }

    // ==================================================
    // 6. ENVOI DE LA VIDÉO À TIKTOK
    // ==================================================

    for (let i = 0; i < totalChunkCount; i++) {
      const start = i * CHUNK_SIZE;

      const end = Math.min(
        start + CHUNK_SIZE,
        videoSize
      );

      const chunk = videoBuffer.subarray(
        start,
        end
      );

      const uploadResponse = await fetch(
        uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(chunk.length),
            "Content-Range":
              `bytes ${start}-${end - 1}/${videoSize}`
          },
          body: chunk
        }
      );

      const uploadText =
        await uploadResponse.text();

      if (
        !uploadResponse.ok &&
        uploadResponse.status !== 201 &&
        uploadResponse.status !== 206
      ) {
        return res.status(uploadResponse.status).json({
          success: false,
          step: "tiktok_upload",
          chunk: i + 1,
          total_chunks: totalChunkCount,
          status: uploadResponse.status,
          details: uploadText
        });
      }
    }

    // ==================================================
    // 7. SUCCÈS
    // ==================================================

    return res.status(200).json({
      success: true,
      message: "Vidéo envoyée à TikTok avec succès",
      publish_id: publishId,
      video_size: videoSize,
      total_chunks: totalChunkCount,
      scope: "video.upload",
      method: "FILE_UPLOAD"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      step: "server",
      message: error?.message || "Erreur serveur inconnue"
    });
  }
}
