import os from 'os'
const ifaces = os.networkInterfaces()
for (const [name, addrs] of Object.entries(ifaces)) {
  for (const a of addrs) {
    if (a.family === 'IPv4' && !a.internal) console.log(`${name}: ${a.address}`)
  }
}
