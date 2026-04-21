import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBfeZ7OU6qppx60ldw7te1u2s6-PFs07IU',
  authDomain: 'magnetix-ihtiyac-panosu.firebaseapp.com',
  projectId: 'magnetix-ihtiyac-panosu',
  storageBucket: 'magnetix-ihtiyac-panosu.firebasestorage.app',
  messagingSenderId: '138143834886',
  appId: '1:138143834886:web:7ba606bf69db23a2867487',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
