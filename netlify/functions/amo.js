exports.handler = async (event) => {
  console.log('RAW BODY:', event.body);

  let data = {};
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    console.log('Not JSON');
  }

  console.log('PARSED DATA:', data);

  return {
    statusCode: 200,
    body: 'RECEIVED'
  };
};
