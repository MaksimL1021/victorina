const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));

// ---- Game state lives on the server ----
let state = {
  phase: 'lobby', // lobby | question | finished
  qIndex: -1,
  scores: { 1: 0, 2: 0, 3: 0 },
  teamNames: { 1: 'Команда 1', 2: 'Команда 2', 3: 'Команда 3' },
  connected: { 1: false, 2: false, 3: false },
  buzzedTeam: null,   // which team is currently locked in to answer out loud
  buzzedName: null,
  excluded: []        // teams who already answered wrong on this question
};

function currentQuestion() {
  return state.qIndex >= 0 && state.qIndex < QUESTIONS.length ? QUESTIONS[state.qIndex] : null;
}

// What teams see (no correct answer leaked)
function publicState() {
  const q = currentQuestion();
  return {
    phase: state.phase,
    qIndex: state.qIndex,
    total: QUESTIONS.length,
    scores: state.scores,
    teamNames: state.teamNames,
    connected: state.connected,
    question: q ? { text: q.text, options: q.options, points: q.points, round: q.round } : null,
    buzzedTeam: state.buzzedTeam,
    buzzedName: state.buzzedName,
    excluded: state.excluded
  };
}

// What the host sees (includes correct answer)
function hostState() {
  const q = currentQuestion();
  return {
    phase: state.phase,
    qIndex: state.qIndex,
    total: QUESTIONS.length,
    scores: state.scores,
    teamNames: state.teamNames,
    connected: state.connected,
    question: q || null,
    buzzedTeam: state.buzzedTeam,
    buzzedName: state.buzzedName,
    excluded: state.excluded
  };
}

function broadcast() {
  io.to('teams').emit('state', publicState());
  io.to('host').emit('hostState', hostState());
}

io.on('connection', (socket) => {
  socket.data.role = null;
  socket.data.team = null;

  socket.emit('state', publicState());

  socket.on('host:join', () => {
    socket.data.role = 'host';
    socket.join('host');
    socket.emit('hostState', hostState());
  });

  socket.on('team:join', ({ team, name }) => {
    if (![1, 2, 3].includes(Number(team))) return;
    team = Number(team);

    if (state.connected[team]) {
      socket.emit('team:joinError', { message: 'Эта команда уже занята другим телефоном.' });
      return;
    }

    socket.data.role = 'team';
    socket.data.team = team;
    socket.join('teams');
    state.connected[team] = true;
    if (name && name.trim()) state.teamNames[team] = name.trim().slice(0, 30);
    socket.emit('team:joined', { team });
    broadcast();
  });

  socket.on('disconnect', () => {
    if (socket.data.role === 'team' && socket.data.team) {
      const team = socket.data.team;
      const stillThere = [...io.sockets.sockets.values()]
        .some(s => s.id !== socket.id && s.data.team === team);
      if (!stillThere) {
        state.connected[team] = false;
        broadcast();
      }
    }
  });

  // Host controls
  socket.on('host:start', () => {
    state.phase = 'question';
    state.qIndex = 0;
    state.buzzedTeam = null;
    state.buzzedName = null;
    state.excluded = [];
    broadcast();
  });

  socket.on('host:next', () => {
    if (state.qIndex < QUESTIONS.length - 1) {
      state.qIndex += 1;
      state.phase = 'question';
    } else {
      state.phase = 'finished';
    }
    state.buzzedTeam = null;
    state.buzzedName = null;
    state.excluded = [];
    broadcast();
  });

  // Team presses BAH -- first to reach the server wins the lock
  socket.on('team:buzz', () => {
    if (state.phase !== 'question') return;
    const team = socket.data.team;
    if (!team) return;
    if (state.buzzedTeam) return; // someone already locked in
    if (state.excluded.includes(team)) return; // already answered wrong this question

    state.buzzedTeam = team;
    state.buzzedName = state.teamNames[team];
    broadcast();
  });

  // Host judges the verbal answer of the buzzed-in team
  socket.on('host:judge', ({ correct }) => {
    const q = currentQuestion();
    if (!q || !state.buzzedTeam) return;

    if (correct) {
      state.scores[state.buzzedTeam] = (state.scores[state.buzzedTeam] || 0) + q.points;
      // stays locked showing who won the points; host then clicks "next question"
    } else {
      state.excluded.push(state.buzzedTeam);
      state.buzzedTeam = null;
      state.buzzedName = null;
      // question reopens for the remaining teams to buzz in
    }
    broadcast();
  });

  socket.on('host:resetGame', () => {
    state = {
      phase: 'lobby',
      qIndex: -1,
      scores: { 1: 0, 2: 0, 3: 0 },
      teamNames: state.teamNames,
      connected: state.connected,
      buzzedTeam: null,
      buzzedName: null,
      excluded: []
    };
    broadcast();
  });
});

const PORT = process.env.PORT || 7717;
server.listen(PORT, () => {
  console.log(`Circus quiz server running on port ${PORT}`);
});
