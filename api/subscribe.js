export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { email, source } = req.body || {};
    if (!email || !String(email).includes("@")) return res.status(400).send("Invalid email");

    const BREVO_KEY = process.env.BREVO_API_KEY;
    const LIST_ID = Number(process.env.BREVO_LIST_ID);

    if (!BREVO_KEY || !LIST_ID) return res.status(500).send("Missing Brevo env vars");

    const payload = {
      email,
      attributes: { SOURCE: source || "geolean" },
      listIds: [LIST_ID],
      updateEnabled: true,
    };

    const r = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": BREVO_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).send(t);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
}