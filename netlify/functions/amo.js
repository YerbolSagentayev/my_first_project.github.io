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
  const lead = await getLeadWithContacts(parsed.subdomain, parsed.lead_id);
  const price = lead.price;
  const contactId = lead._embedded?.contacts?.[0]?.id;

  console.log("LEAD PRICE:", price);
  console.log("CONTACT ID:", contactId);

  if (!contactId) {
    console.log("NO CONTACT LINKED");
    return { statusCode: 200, body: "OK" };
  }

  const contact = await getContact(parsed.subdomain, contactId);
  const fields = contact.custom_fields_values || [];

  const email = getFieldValue(fields, "EMAIL");
  const phone = getFieldValue(fields, "PHONE");

  console.log("EMAIL:", email);
  console.log("PHONE:", phone);

  return { statusCode: 200, body: "OK" };
} catch (e) {
  console.log("ERROR:", e.message);
  return { statusCode: 200, body: "ERROR" };
}


async function getLeadWithContacts(subdomain, leadId) {
  const url = `https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}?with=contacts`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AMO_ACCESS_TOKEN}` }
  });
  if (!res.ok) throw new Error("Lead fetch failed");
  return res.json();
}

async function getContact(subdomain, contactId) {
  const url = `https://${subdomain}.amocrm.ru/api/v4/contacts/${contactId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AMO_ACCESS_TOKEN}` }
  });
  if (!res.ok) throw new Error("Contact fetch failed");
  return res.json();
}

function getFieldValue(fields, code) {
  if (!Array.isArray(fields)) return null;
  const field = fields.find(f => f.field_code === code);
  return field?.values?.[0]?.value ?? null;
}
