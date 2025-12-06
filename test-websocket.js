const io = require('socket.io-client');

// 连接到服务器
const socket = io('http://localhost:3012', {
  transports: ['websocket'],
  auth: {
    token: 'test-token'
  }
});

// 监听连接事件
socket.on('connect', () => {
  console.log('已连接到服务器，Socket ID:', socket.id);
  
  // 等待几秒钟然后断开连接
  setTimeout(() => {
    console.log('断开连接');
    socket.disconnect();
  }, 3000);
});

// 监听连接错误
socket.on('connect_error', (error) => {
  console.log('连接错误:', error.message);
});

// 监听断开连接
socket.on('disconnect', (reason) => {
  console.log('断开连接，原因:', reason);
});