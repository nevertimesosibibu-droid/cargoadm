import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDWXuNHOc5slwlE7tHn3DTaIvuFrp9jxQ4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cargo-7ae7b.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://cargo-7ae7b-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cargo-7ae7b',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:918986709072:web:588be403022d573528d955',
  storageBucket: 'cargo-7ae7b.firebasestorage.app',
  messagingSenderId: '918986709072',
  measurementId: 'G-RSBJ8E7WSE',
})

export const auth = getAuth(app)
export const database = getDatabase(app)