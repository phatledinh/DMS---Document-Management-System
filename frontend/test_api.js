import axios from 'axios';

async function testApi() {
  try {
    console.log("Logging in...");
    const loginRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
      email: 'admin@dms.com',
      password: 'admin'
    });
    
    const token = loginRes.data.data.accessToken;
    console.log("Got token:", token);
    
    console.log("Calling /documents...");
    const docsRes = await axios.get('http://localhost:8080/api/v1/documents', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("Success! Status:", docsRes.status);
  } catch (err) {
    console.error("Error:", err.response ? err.response.status : err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

testApi();
