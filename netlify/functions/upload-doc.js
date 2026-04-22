const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const files = [];
    let dealId = '';

    const busboy = Busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
    });

    busboy.on('field', (name, val) => {
      if (name === 'deal_id') dealId = val;
    });

    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        files.push({
          fieldname: name,
          filename: info.filename,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    busboy.on('finish', () => resolve({ files, dealId }));
    busboy.on('error', reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    busboy.write(body);
    busboy.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { files, dealId } = await parseMultipart(event);

    if (!files.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No files provided' }) };
    }

    const urls = [];

    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `deals/${dealId}/${timestamp}_${safeName}`;

      const { data, error } = await supabase.storage
        .from('deal-documents')
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('deal-documents')
        .getPublicUrl(path);

      urls.push(publicUrl);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    };

  } catch (err) {
    console.error('upload-doc error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
