import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState('Disconnected');

  const ws = useRef(null);
  const imgRef = useRef(null);

  const connectToRoom = () => {
    if (!roomId) return;

    // Важливо: замініть localhost:8000 на реальний IP сервера
    ws.current = new WebSocket(`ws://localhost:8000/ws/room/${roomId}/`);

    ws.current.onopen = () => {
      setStatus('Connected');
      setIsInRoom(true);
    };

    ws.current.onclose = () => {
      setStatus('Disconnected');
      setIsInRoom(false);
    };

    ws.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        const url = URL.createObjectURL(event.data);
        if (imgRef.current) {
          if (imgRef.current.src) URL.revokeObjectURL(imgRef.current.src);
          imgRef.current.src = url;
        }
      }
      else {
        setMessages((prev) => [...prev, event.data]);
      }
    };
  };

  const sendMessage = () => {
    if (ws.current && chatInput) {
      ws.current.send(chatInput);
      setChatInput('');
    }
  };

  return (
    <div style={{
      backgroundColor: '#1a1a1a', color: '#0f0', minHeight: '100vh',
      fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <h1>TermiCast React</h1>

      {!isInRoom ? (
        <div style={{ marginTop: '20vh' }}>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <button
            onClick={connectToRoom}
            style={{ padding: '10px', marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            CONNECT
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
            <span>Room: {roomId}</span>
            <span>Status: {status}</span>
          </div>

          <div style={{
            border: '2px solid #333', backgroundColor: '#000',
            aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img ref={imgRef} style={{ width: '100%', maxHeight: '80vh' }} alt="Waiting for stream..." />
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <div style={{ height: '100px', overflowY: 'auto', marginBottom: '10px', border: '1px solid #333', padding: '5px' }}>
              {messages.map((msg, idx) => (
                <div key={idx}>&gt; {msg}</div>
              ))}
            </div>
            <div style={{ display: 'flex' }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message to streamer..."
                style={{ flex: 1, padding: '10px', background: '#000', color: '#0f0', border: '1px solid #333' }}
              />
              <button onClick={sendMessage} style={{ padding: '10px 20px', cursor: 'pointer' }}>SEND</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;