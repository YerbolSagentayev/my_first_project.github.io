exports.handler = async (event) => {
  console.log('Webhook received');

  return {
    statusCode: 200,
    body: 'OK'
  };
};

