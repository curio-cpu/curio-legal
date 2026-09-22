export default function handler(req, res) {
  const clientKey = (process.env.TIKTOK_CLIENT_KEY || "").trim();

  if (!clientKey) {
    return res.status(500).send("TIKTOK_CLIENT_KEY manquant");
  }

  return res.status(200).json({
    clientKeyPresent: true,
    clientKeyLength: clientKey.length,
    clientKeyLast4: clientKey.slice(-4),
    clientSecretPresent: !!process.env.TIKTOK_CLIENT_SECRET
  });
}
