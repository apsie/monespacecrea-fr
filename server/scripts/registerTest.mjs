import fetch from 'node-fetch'

const url = 'http://localhost:4000/api/register'
const body = { name: 'CLI Test', email: `cliuser_${Date.now()}@example.com`, password: 'secret123' }

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  console.log('status:', res.status)
  console.log('response:', data)
} catch (e) {
  console.error('fetch error', e)
}
