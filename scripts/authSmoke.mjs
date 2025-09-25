const base = 'http://localhost:4000';

async function main(){
  try {
    const health = await fetch(base + '/health');
    console.log('HEALTH status', health.status);
    const hjson = await health.json();
    console.log('HEALTH body', hjson);
  } catch(e){
    console.error('HEALTH error', e);
  }
  const email = `test_${Date.now()}@example.com`;
  try {
    const reg = await fetch(base + '/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Test User', email, password:'azerty123' }) });
    console.log('REGISTER status', reg.status);
    let rj;
    try { rj = await reg.json(); } catch(_) { rj = { raw: await reg.text() }; }
    console.log('REGISTER body', rj);
  } catch(e){
    console.error('REGISTER error', e);
  }
  try {
    const login = await fetch(base + '/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password:'azerty123' }) });
    console.log('LOGIN status', login.status);
    let lj;
    try { lj = await login.json(); } catch(_) { lj = { raw: await login.text() }; }
    console.log('LOGIN body', lj);
  } catch(e){
    console.error('LOGIN error', e);
  }
}

main();
