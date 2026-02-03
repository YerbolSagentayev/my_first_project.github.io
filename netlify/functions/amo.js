// netlify/functions/amo.js

const { URLSearchParams } = require('url');

function parseAmoForm(body) {
  const params = new URLSearchParams(body);


  const lead_id = params.get('leads[status][0][id]');
  const status_id = params.get('leads[status][0][status_id]');
  const pipeline_id = params.get('leads[status][0][pipeline_id]');
  const old_status_id = params.get('leads[status][0][old_status_id]');
  const account_id = params.get('account[id]');
  const subdomain = params.get('account[subdomain]');

  return {
    lead_id: lead_id ? Number(lead_id) : null,
    status_id: status_id ? Number(status_id) : null,
    pipeline_id: pipeline_id ? Number(pipeline_id) : null,
    old_status_id: old_status_id ? Number(old_status_id) : null,
    account_id: account_id ? Number(account_id) : null,
    subdomain: subdomain || null
  };
}

exports.handler = async (event) => {
  console.log('RAW BODY:', event.body);

  
  let json = null;
  try {
    json = event.body ? JSON.parse(event.body) : null;
  } catch (e) {}

  
  const parsed = json ?? parseAmoForm(event.body || '');

  console.log('PARSED DATA:', parsed);

  return {
    statusCode: 200,
    body: 'RECEIVED'
  };
};
