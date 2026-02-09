const { URLSearchParams } = require("url");
const crypto = require("crypto");

const PAID_STATUS_ID = 142; // <-- если у тебя другой статус "Оплачено", поменяй

function parseAmoForm(body) {
  const params = new URLSearchParams(body);
  return {
    lead_id: Number(params.get("leads[status][0][id]") || 0),
    status_id: Number(params.get("leads[status][0][status_id]") || 0),
    subdomain: params.get("account[subdomain]") || null,
  };
}

function sha256(value) {
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
    throw new Error(`amoCRM ${res.status}: ${text}`);
  }
  return res.json();
}

function getFieldByCode(fields, code) {
  if (!Array.isArray(fields)) return null;
  const f = fields.find(x => x.field_code === code);
  return f?.values?.[0]?.value ?? null;
}

async function sendPurchaseToMeta(payload) {
  const url = `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_ACCESS_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [payload] }),
  });
  return res.json();
}

exports.handler = async (event) => {
  try {
    const parsed = parseAmoForm(event.body || "");
    console.log("PARSED:", parsed);

    // реагируем только на нужный статус
    if (!parsed.lead_id || !parsed.subdomain || parsed.status_id !== PAID_STATUS_ID) {
      return { statusCode: 200, body: "IGNORED" };
    }

    // 1) Получаем сделку + контакты
    const lead = await amoGet(
      parsed.subdomain,
      `/api/v4/leads/${parsed.lead_id}?with=contacts`
    );

    const price = Number(lead.price || 0);
    const contactId = lead._embedded?.contacts?.[0]?.id ?? null;

    console.log("LEAD PRICE:", price);
    console.log("CONTACT ID:", contactId);

    if (!contactId || price <= 0) {
      console.log("NO CONTACT OR PRICE");
      return { statusCode: 200, body: "NO_DATA" };
    }

    // 2) UTM из полей сделки
    const lfields = lead.custom_fields_values || [];
    const utm_source   = getFieldByCode(lfields, "UTM_SOURCE");
    const utm_medium   = getFieldByCode(lfields, "UTM_MEDIUM");
    const utm_campaign = getFieldByCode(lfields, "UTM_CAMPAIGN"); // campaign.id
    const utm_content  = getFieldByCode(lfields, "UTM_CONTENT");  // ad.id
    const utm_term     = getFieldByCode(lfields, "UTM_TERM");     // adset.id
    const utm_id       = getFieldByCode(lfields, "UTM_ID");
    const fbclid       = getFieldByCode(lfields, "FBCLID");

    console.log("UTM:", { utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, fbclid });

    // 3) Контакт → email/phone
    const contact = await amoGet(parsed.subdomain, `/api/v4/contacts/${contactId}`);
    const cfields = contact.custom_fields_values || [];
    const email = getFieldByCode(cfields, "EMAIL");
    const phone = getFieldByCode(cfields, "PHONE");

    const em_hash = sha256(email);
    const ph_hash = sha256(phone);

    console.log("EMAIL HASH:", em_hash);
    console.log("PHONE HASH:", ph_hash);

    // 4) Формируем Purchase для Meta
    const purchase = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `amo_${parsed.lead_id}`, // дедуп
      action_source: "system_generated",
      user_data: {
        em: em_hash ? [em_hash] : [],
        ph: ph_hash ? [ph_hash] : [],
      },
      custom_data: {
        value: price,
        currency: "KZT",
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        utm_id,
      },
    };

    // 5) Отправка в Meta
    const metaResp = await sendPurchaseToMeta(purchase);
    console.log("META RESPONSE:", metaResp);

    return { statusCode: 200, body: "PURCHASE_SENT" };
  } catch (e) {
    console.log("ERROR:", e.message);
    return { statusCode: 200, body: "ERROR" };
  }
};
