# Circus Buzzer

Real-time circus-themed buzzer quiz game for parties, built with **Express** and **Socket.io**.

## Pages

- `/` — player / buzzer screen (`public/index.html`)
- `/host.html` — host control screen (`public/host.html`)

## Run locally

```bash
npm install
npm start          # or: node server.js
```

The server listens on `process.env.PORT || 7717`. Open http://localhost:7717/.

## Deploy to the server

The project lives on the server in `~/circus-buzzer-v2`. To deploy the latest
`main`, run on the server:

```bash
cd ~/circus-buzzer-v2
./deploy.sh
```

`deploy.sh` pulls the latest code, installs dependencies, stops the old
`node server.js` process, starts a fresh one via `nohup` in the background, and
prints `buzzer.log` so you can confirm the line
`Circus quiz server running on port 7717`.
