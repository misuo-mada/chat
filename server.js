const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// ✅ 無制限チャットルーム（制限なし）
const unlimitedRooms = {
  "全体討論_RoomA": [],
  "全体討論_RoomB": []
};

// ✅ 2人制チャットルーム
const limitedRooms = {
  "RoomA_密談": [],
  "RoomB_密談": [],
  "RoomC_密談": []
};

function broadcastRoomList() {
  const allRooms = { ...unlimitedRooms, ...limitedRooms };
  io.emit('roomList', Object.entries(allRooms).map(([name, users]) => ({
    name,
    count: users.length
  })));
}

io.on('connection', (socket) => {
  broadcastRoomList();

  socket.on('joinRoom', ({ roomId, username }) => {
    const allRooms = { ...unlimitedRooms, ...limitedRooms };

    if (!allRooms[roomId]) return;

    const isLimited = roomId.startsWith('Room');
    const roomArray = isLimited ? limitedRooms : unlimitedRooms;

    if (!roomArray[roomId]) roomArray[roomId] = [];

    if (isLimited && roomArray[roomId].length >= 2) {
      socket.emit('roomFull');
      return;
    }

    socket.join(roomId);
    roomArray[roomId].push({ id: socket.id, name: username });

    broadcastRoomList();

    io.to(roomId).emit('roomUsers', roomArray[roomId]);
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
      if (roomArray[roomId]) {
        roomArray[roomId] = roomArray[roomId].filter(user => user.id !== socket.id);
        io.to(roomId).emit('roomUsers', roomArray[roomId]);
        io.to(roomId).emit('message', {
          id: Date.now(),
          name: 'システム',
          text: `${username} が退出しました`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        if (roomArray[roomId].length === 0) {
          roomArray[roomId] = [];
        }

        broadcastRoomList();
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`✅ サーバー起動中: http://localhost:${PORT}`);
});
