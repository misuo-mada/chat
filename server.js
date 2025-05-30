const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000; // ← 修正ポイント！

app.use(express.static(__dirname));

// 最初からルームを3つ用意
const rooms = {
  "RoomA": [],
  "RoomB": [],
  "RoomC": []
};

function broadcastRoomList() {
  io.emit('roomList', Object.entries(rooms).map(([name, users]) => ({
    name,
    count: users.length
  })));
}

io.on('connection', (socket) => {
  broadcastRoomList();

  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) rooms[roomId] = [];

    if (rooms[roomId].length >= 2) {
      socket.emit('roomFull');
      return;
    }

    socket.join(roomId);
    rooms[roomId].push({ id: socket.id, name: username });

    broadcastRoomList();

    io.to(roomId).emit('roomUsers', rooms[roomId]);
    io.to(roomId).emit('message', {
      id: Date.now(),
      name: 'システム',
      text: `${username} が入室しました`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    socket.on('chatMessage', (msg) => {
      const message = {
        id: Date.now(),
        name: username,
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      io.to(roomId).emit('message', message);
    });

    socket.on('deleteMessage', (msgId) => {
      io.to(roomId).emit('deleteMessage', msgId);
    });

    socket.on('seen', (lastMsgId) => {
      io.to(roomId).emit('readStatus', { id: socket.id, seen: lastMsgId });
    });

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
        io.to(roomId).emit('roomUsers', rooms[roomId]);
        io.to(roomId).emit('message', {
          id: Date.now(),
          name: 'システム',
          text: `${username} が退出しました`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        if (rooms[roomId].length === 0) {
          rooms[roomId] = [];
        }

        broadcastRoomList();
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`✅ サーバー起動中: http://localhost:${PORT}`);
});
