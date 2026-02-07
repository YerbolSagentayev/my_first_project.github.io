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

function getFieldValueByCode(customFields, code) {
  if (!Array.isArray(customFields)) return null;
  const f = customFields.find((x) => x.field_code === code);
  return f?.values?.[0]?.value ?? null;
}

function getLeadFieldValue(lead, code) {
  const fields = lead.custom_fields_values || [];
  return getFieldValueByCode(fields, code);
}

exports.handler = async (event) => {
  try {
    const parsed = parseAmoForm(event.body || "");
    console.log("PARSED:", parsed);

    if (!parsed.lead_id || !parsed.subdomain) {
      return { statusCode: 200, body: "NO_LEAD" };
    }

    // 1) Получаем сделку + контакты
    const lead = await amoGet(
      parsed.subdomain,
      `/api/v4/leads/${parsed.lead_id}?with=contacts`
    );

    const price = lead.price ?? null;
    const contactId = lead._embedded?.contacts?.[0]?.id ?? null;

    console.log("LEAD PRICE:", price);
    console.log("CONTACT ID:", contactId);

    // 2) Достаём UTM (как у тебя в amoCRM: field_code = UTM_*)
    const utm_source = getLeadFieldValue(lead, "UTM_SOURCE");
    const utm_medium = getLeadFieldValue(lead, "UTM_MEDIUM");
    const utm_campaign = getLeadFieldValue(lead, "UTM_CAMPAIGN");
    const utm_content = getLeadFieldValue(lead, "UTM_CONTENT"); // ad.id
    const utm_term = getLeadFieldValue(lead, "UTM_TERM"); // adset.id
    const utm_id = getLeadFieldValue(lead, "UTM_ID");
    const fbclid = getLeadFieldValue(lead, "FBCLID");
    const referer = getLeadFieldValue(lead, "REFERER");
    const utm_referrer = getLeadFieldValue(lead, "UTM_REFERRER");

    console.log("UTM EXTRACTED:", {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      utm_id,
      fbclid,
      referer,
      utm_referrer,
    });

    if (!contactId) {
      console.log("NO CONTACT LINKED");
      return { statusCode: 200, body: "OK_NO_CONTACT" };
    }

    // 3) Получаем контакт и хэшим email/phone
    const contact = await amoGet(
      parsed.subdomain,
      `/api/v4/contacts/${contactId}`
    );

    const cfields = contact.custom_fields_values || [];
    const email = getFieldValueByCode(cfields, "EMAIL");
    const phone = getFieldValueByCode(cfields, "PHONE");

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
