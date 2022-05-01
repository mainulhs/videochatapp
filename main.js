/*
 *   Copyright (c) 2022 
 *   All rights reserved.
 */
import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const localVideo = document.getElementById('localVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC3E9bJxFTVCtBye1nizjoJW_ZQbEXH36M",
  authDomain: "videochat-ee4ba.firebaseapp.com",
  projectId: "videochat-ee4ba",
  storageBucket: "videochat-ee4ba.appspot.com",
  messagingSenderId: "1064559799825",
  appId: "1:1064559799825:web:f88c54753ca92a492f0bb0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
let local = null;
let remote = null;

// Setup media sources

webcamButton.onclick = async () => {
  local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remote = new MediaStream();

  // Push tracks from local stream to peer connection
  local.getTracks().forEach((track) => {
    pc.addTrack(track, local);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remote.addTrack(track);
    });
  };

  localVideo.srcObject = local;
  remoteVideo.srcObject = remote;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// Create an offer
callButton.onclick = async () => {

  // Reference Firestore collections for signaling
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// Answer the call with the unique ID
  answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
  const hangUpBtn = document.querySelector('hangupButton');
  hangUpBtn.addEventListener('click', function (){
    conn.close();
})
};
