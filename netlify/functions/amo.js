const { URLSearchParams } = require("url");

function parseAmoForm(body) {
  const params = new URLSearchParams(body);

  return {
    lead_id: Number(params.get("leads[status][0][id]") || 0),
    status_id: Number(params.get("leads[status][0][status_id]") || 0),
    subdomain: params.get("account[subdomain]") || null,
  };
}

async function getLeadPrice(subdomain, leadId) {
  const url = `https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.AMO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`amoCRM error ${res.status}: ${text}`);
  }

  const lead = await res.json();
  return lead.price ?? null;
}

exports.handler = async (event) => {
  const parsed = parseAmoForm(event.body || "");
  console.log("PARSED:", parsed);

  if (!parsed.lead_id || !parsed.subdomain) {
    return { statusCode: 200, body: "NO_LEAD" };
  }

  try {
    const price = await getLeadPrice(parsed.subdomain, parsed.lead_id);
    console.log("LEAD PRICE:", price);
    return { statusCode: 200, body: "OK" };
  } catch (e) {
    console.log("ERROR:", e.message);
    return { statusCode: 200, body: "ERROR" };
  }
};
