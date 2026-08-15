"use client";

import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { supabase } from '@/utils/supabase';

import bgImage from '@/assets/bg.png';
import logoImage from '@/assets/logo-white.png';
import maximizeIcon from '@/assets/maximize.svg';
import minimizeIcon from '@/assets/minimize.svg';
import showIcon from '@/assets/show.svg';
import hideIcon from '@/assets/hide.svg';
import sendIcon from '@/assets/send.svg';

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
          <img src={expanded ? hideIcon.src : showIcon.src} alt="toggle" />
          <span>{expanded ? "Hide" : "Show more"}</span>
        </button>
      )}
    </div>
  );
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const App = () => {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [role, setRole] = useState(null); // 'streamer' or 'viewer'
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);

  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);

  const channelRef = useRef(null);
  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const streamContainerRef = useRef(null);

  // WebRTC refs
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const myPeerIdRef = useRef(Math.random().toString(36).substring(7));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleFs = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const initStreamer = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Stop streaming if user clicks "Stop sharing" in browser UI
      stream.getVideoTracks()[0].onended = () => {
        disconnect();
      };

      joinRoom('streamer');
    } catch (err) {
      console.error("Error starting stream:", err);
      alert("Could not access screen for streaming.");
    }
  };

  const initViewer = () => {
    joinRoom('viewer');
  };

  const joinRoom = (selectedRole) => {
    if (!roomId) return;
    setRole(selectedRole);

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { ack: false },
      },
    });

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setMessages((prev) => [...prev, payload.text]);
      })
      .on('broadcast', { event: 'webrtc' }, async ({ payload }) => {
        // Handle WebRTC signaling
        if (payload.sender === myPeerIdRef.current) return; // Ignore own messages

        if (selectedRole === 'streamer') {
          handleStreamerSignaling(payload, channel);
        } else if (selectedRole === 'viewer') {
          handleViewerSignaling(payload, channel);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsInRoom(true);
          setMessages(prev => [...prev, `System: Connected to room ${roomId} as ${selectedRole}`]);
          
          if (selectedRole === 'viewer') {
            // Announce presence so streamer can send offer
            channel.send({
              type: 'broadcast',
              event: 'webrtc',
              payload: { type: 'peer-joined', sender: myPeerIdRef.current }
            });
          }
        } else if (status === 'CLOSED') {
          setIsInRoom(false);
          setMessages([]);
        } else if (status === 'CHANNEL_ERROR') {
          alert("Error connecting to room via Supabase Realtime");
          setIsInRoom(false);
        }
      });
      
    channelRef.current = channel;
  };

  const handleStreamerSignaling = async (payload, channel) => {
    const { type, sender, data } = payload;
    
    if (type === 'peer-joined') {
      // Create new peer connection for this viewer
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(sender, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc',
            payload: { type: 'ice-candidate', sender: myPeerIdRef.current, target: sender, data: event.candidate }
          });
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc',
        payload: { type: 'offer', sender: myPeerIdRef.current, target: sender, data: offer }
      });
    } else if (type === 'answer') {
      const pc = peerConnectionsRef.current.get(sender);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
    } else if (type === 'ice-candidate') {
      const pc = peerConnectionsRef.current.get(sender);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  };

  const handleViewerSignaling = async (payload, channel) => {
    const { type, sender, target, data } = payload;
    
    if (target !== myPeerIdRef.current) return; // Only process messages meant for me

    let pc = peerConnectionsRef.current.get('streamer');

    if (type === 'offer') {
      if (!pc) {
        pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionsRef.current.set('streamer', pc);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'webrtc',
              payload: { type: 'ice-candidate', sender: myPeerIdRef.current, target: sender, data: event.candidate }
            });
          }
        };

        pc.ontrack = (event) => {
          if (videoRef.current && videoRef.current.srcObject !== event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc',
        payload: { type: 'answer', sender: myPeerIdRef.current, target: sender, data: answer }
      });
    } else if (type === 'ice-candidate') {
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  };

  const disconnect = async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsInRoom(false);
    setRole(null);
    setMessages([]);
    setRoomId('');
  };

  const sendMessage = (e) => {
    if (e && e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (!e || e.type === 'click') {
      send();
    }

    function send() {
      if (channelRef.current && chatInput.trim()) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'chat',
          payload: { text: chatInput },
        });
        setChatInput('');
      }
    }
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
      <div className="app-container" style={{ backgroundImage: `url(${bgImage.src})` }}>
        <div className="overlay"></div>
        <div className="login-card">
          <img src={logoImage.src} alt="GhostCast" className="logo" />
          <div className="input-group">
            <input
              type="text" className="custom-input" placeholder="Cast code"
              value={roomId} onChange={(e) => setRoomId(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button className="connect-btn" style={{flex: 1, backgroundColor: '#00c3ff'}} onClick={initViewer}>Watch</button>
            <button className="connect-btn" style={{flex: 1}} onClick={initStreamer}>Stream</button>
          </div>
        </div>

        <div style={{position: 'absolute', bottom: '20px', color: '#888', fontSize: '12px', textAlign: 'center', width: '100%', zIndex: 2, pointerEvents: 'none'}}>
            GhostCast is an open-source project. Not affiliated with any major service | <a className="github" href="https://github.com/dlxarl/ghostcast-server">GitHub</a>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Room: {roomId} ({role})</span>
          <button className="disconnect-btn" onClick={disconnect}>Exit</button>
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
                <img src={sendIcon.src} alt="Send" />
            </button>
          </div>
        </div>
      </div>

      <div className={`stream-section ${isFakeFullscreen ? 'fake-fullscreen' : ''}`} ref={streamContainerRef}>
        <video 
            ref={videoRef} 
            className="stream-image" 
            autoPlay 
            playsInline 
            muted={role === 'streamer'} 
            style={{ objectFit: 'contain', background: '#000' }}
        />

        <div className="stream-controls">
          <button className="stream-btn" onClick={toggleFullscreen}>
            <img
              src={isAnyFullscreen ? minimizeIcon.src : maximizeIcon.src}
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