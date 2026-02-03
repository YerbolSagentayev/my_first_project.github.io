const { URLSearchParams } = require("url");

function parseAmoForm(body) {
  const params = new URLSearchParams(body);

  return {
    lead_id: Number(params.get("leads[status][0][id]") || 0),
    status_id: Number(params.get("leads[status][0][status_id]") || 0),
    subdomain: params.get("account[subdomain]") || null,
  };
}

async function amoGet(subdomain, path) {
  const url = `https://${subdomain}.amocrm.ru${path}`;

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

  return res.json();
}

function getFieldValue(customFields, code) {
  if (!Array.isArray(customFields)) return null;
  const f = customFields.find((x) => x.field_code === code);
  return f?.values?.[0]?.value ?? null;
}

exports.handler = async (event) => {
  try {
    const parsed = parseAmoForm(event.body || "");
    console.log("PARSED:", parsed);

    if (!parsed.lead_id || !parsed.subdomain) {
      return { statusCode: 200, body: "NO_LEAD" };
    }

    // 1) Получаем сделку вместе с контактами
    const lead = await amoGet(
      parsed.subdomain,
      `/api/v4/leads/${parsed.lead_id}?with=contacts`
    );

    const price = lead.price ?? null;
    const contactId = lead._embedded?.contacts?.[0]?.id ?? null;

    console.log("LEAD PRICE:", price);
    console.log("CONTACT ID:", contactId);

    if (!contactId) {
      console.log("NO CONTACT LINKED");
      return { statusCode: 200, body: "OK_NO_CONTACT" };
    }

    // 2) Получаем контакт
    const contact = await amoGet(
      parsed.subdomain,
      `/api/v4/contacts/${contactId}`
    );

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
};
