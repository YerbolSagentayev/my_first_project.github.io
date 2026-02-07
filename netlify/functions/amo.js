const { URLSearchParams } = require("url");
const crypto = require("crypto");

function parseAmoForm(body) {
  const params = new URLSearchParams(body);
  return {
    lead_id: Number(params.get("leads[status][0][id]") || 0),
    status_id: Number(params.get("leads[status][0][status_id]") || 0),
    subdomain: params.get("account[subdomain]") || null,
  };
}

function hash(value) {
  if (!value) return null;
  return crypto
    .createHash("sha256")
    .update(String(value).trim().toLowerCase())
    .digest("hex");
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

    const lead = await amoGet(
      parsed.subdomain,
      `/api/v4/leads/${parsed.lead_id}?with=contacts`
    );

    console.log("LEAD PRICE:", lead.price ?? null);
    console.log("CONTACT ID:", lead._embedded?.contacts?.[0]?.id ?? null);

    // 🔎 1) То, что мы уже пробовали
    console.log("LEAD SOURCE:", lead._embedded?.source);

    // 🔎 2) Часто есть source_id (а детали источника отдельно)
    console.log("LEAD source_id:", lead.source_id);

    // 🔎 3) Посмотрим какие вообще ключи есть в _embedded
    console.log("LEAD _embedded keys:", lead._embedded ? Object.keys(lead._embedded) : null);

    // 🔎 4) Посмотрим какие поля у сделки вообще есть (вдруг UTM лежат в кастомных полях)
    const leadFields = lead.custom_fields_values || [];
    const leadFieldList = leadFields.map((f) => ({
      field_id: f.field_id,
      field_name: f.field_name,
      field_code: f.field_code,
      value: f.values?.[0]?.value ?? null,
    }));

    console.log("LEAD FIELDS (first 30):", leadFieldList.slice(0, 30));

    // Контакт и хэши оставим как раньше (на будущее)
    const contactId = lead._embedded?.contacts?.[0]?.id ?? null;
    if (!contactId) return { statusCode: 200, body: "OK_NO_CONTACT" };

    const contact = await amoGet(parsed.subdomain, `/api/v4/contacts/${contactId}`);
    const cfields = contact.custom_fields_values || [];
    const email = getFieldValue(cfields, "EMAIL");
    const phone = getFieldValue(cfields, "PHONE");

    console.log("EMAIL:", email);
    console.log("PHONE:", phone);
    console.log("EMAIL HASH:", hash(email));
    console.log("PHONE HASH:", hash(phone));

    return { statusCode: 200, body: "OK" };
  } catch (e) {
    console.log("ERROR:", e.message);
    return { statusCode: 200, body: "ERROR" };
  }
};
