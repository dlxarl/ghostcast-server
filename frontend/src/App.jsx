import React, { useState, useRef, useEffect } from 'react';
import './App.css';

import bgImage from './assets/bg.png';
import logoImage from './assets/logo-white.png';
import maximizeIcon from './assets/maximize.svg';
import minimizeIcon from './assets/minimize.svg';
import showIcon from './assets/show.svg';
import hideIcon from './assets/hide.svg';
import screenshotIcon from './assets/screenshot.svg';
import sendIcon from './assets/send.svg';

const MessageItem = ({ text }) => {
  const [expanded, setExpanded] = useState(false);

  const isSystem = text.startsWith("System:");
  const lines = text.split('\n');
  const isLong = lines.length > 5;

  const displayedText = (!expanded && isLong)
    ? lines.slice(0, 5).join('\n') + '...'
    : text;

  return (
    <div className={`message-item ${isSystem ? 'system-msg' : ''}`}>
      <pre className="message-content">
        {displayedText}
      </pre>

      {isLong && (
        <button className="toggle-msg-btn" onClick={() => setExpanded(!expanded)}>
          <img src={expanded ? hideIcon : showIcon} alt="toggle" />
          <span>{expanded ? "Hide" : "Show more"}</span>
        </button>
      )}
    </div>
  );
};

const App = () => {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);

  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);

  const ws = useRef(null);
  const imgRef = useRef(null);
  const messagesEndRef = useRef(null);
  const streamContainerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleFs = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const connectToRoom = () => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    let wsUrl = `${protocol}://${host}/ws/room/${roomId}/`;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
        wsUrl = `ws://127.0.0.1:8000/ws/room/${roomId}/`;
    }

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsInRoom(true);
      setMessages(prev => [...prev, "System: Connected to room " + roomId]);
    };

    ws.current.onclose = () => {
      setIsInRoom(false);
      setMessages([]);
      alert("Disconnected from server");
    };

    ws.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        const url = URL.createObjectURL(event.data);
        if (imgRef.current) {
          if (imgRef.current.src) URL.revokeObjectURL(imgRef.current.src);
          imgRef.current.src = url;
        }
      } else {
        setMessages((prev) => [...prev, event.data]);
      }
    };
  };

  const sendMessage = (e) => {
    if (e && e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (!e || e.type === 'click') {
      send();
    }

    function send() {
      if (ws.current && chatInput.trim()) {
        ws.current.send(chatInput);
        setChatInput('');
      }
    }
  };

  const takeScreenshot = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `ghostcast_${Date.now()}.png`;
    link.click();
  };

  const toggleFullscreen = async () => {
    if (isFakeFullscreen) {
      setIsFakeFullscreen(false);
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    try {
      if (streamContainerRef.current.requestFullscreen) {
        await streamContainerRef.current.requestFullscreen();
      } else if (streamContainerRef.current.webkitRequestFullscreen) {
        await streamContainerRef.current.webkitRequestFullscreen();
      } else {
        throw new Error();
      }
    } catch (err) {
      setIsFakeFullscreen(true);
    }
  };

  const isAnyFullscreen = isNativeFullscreen || isFakeFullscreen;

  if (!isInRoom) {
    return (
      <div className="app-container" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="overlay"></div>
        <div className="login-card">
          <img src={logoImage} alt="GhostCast" className="logo" />
          <div className="input-group">
            <input
              type="text" className="custom-input" placeholder="Cast code"
              value={roomId} onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connectToRoom()}
            />
          </div>
          <button className="connect-btn" onClick={connectToRoom}>Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Room: {roomId}</span>
          <button className="disconnect-btn" onClick={() => window.location.reload()}>Exit</button>
        </div>

        <div className="messages-list">
          {messages.map((msg, index) => (
            <MessageItem key={index} text={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper">
            <textarea
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={sendMessage}
                placeholder="Message..."
                rows={1}
            />
            <button className="send-msg-btn" onClick={sendMessage}>
                <img src={sendIcon} alt="Send" />
            </button>
          </div>
        </div>
      </div>

      <div className={`stream-section ${isFakeFullscreen ? 'fake-fullscreen' : ''}`} ref={streamContainerRef}>
        <img ref={imgRef} className="stream-image" alt="Waiting for stream..." />

        <div className="stream-controls">
          <button className="stream-btn" onClick={takeScreenshot} title="Save Screenshot">
            <img src={screenshotIcon} alt="snap" className="fs-icon" />
            <span>Screenshot</span>
          </button>

          <button className="stream-btn" onClick={toggleFullscreen}>
            <img
              src={isAnyFullscreen ? minimizeIcon : maximizeIcon}
              alt="fs"
              className="fs-icon"
            />
            <span>{isAnyFullscreen ? "Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;