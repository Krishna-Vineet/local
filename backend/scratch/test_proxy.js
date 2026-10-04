import axios from 'axios';

async function testProxy() {
  const targetUrl = 'https://happypix-vigyan-solution.s3.ap-southeast-2.amazonaws.com/uploads/1779239216218-capture-1779239216214.png';
  const proxyUrl = `http://localhost:5000/api/proxy/logo?url=${encodeURIComponent(targetUrl)}`;

  try {
    console.log('Sending request to proxy...');
    const res = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
    console.log('Response Status:', res.status);
    console.log('Response Content-Type:', res.headers['content-type']);
    console.log('Response Length (bytes):', res.data.byteLength);
  } catch (err) {
    console.error('Proxy request failed:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', Buffer.from(err.response.data).toString());
    } else {
      console.error(err.message);
    }
  }
}

testProxy();
