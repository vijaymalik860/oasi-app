async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/personnel/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        belt_number: '123',
        pay_code: 'PAY123',
        full_name: 'Test Import',
        rank: 'Constable',
        mobile_number: '1234567890'
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error(err);
  }
}

run();
