// Firebase configuration for this project.
// Generated from the config you provided. Copy/edit as needed.
window.firebaseConfig = {
  apiKey: "AIzaSyDSx-jAooaiyYj9t6CY5BE14_Ny4bR8DjY",
  authDomain: "jobapplicationtracker-d5520.firebaseapp.com",
  projectId: "jobapplicationtracker-d5520",
  storageBucket: "jobapplicationtracker-d5520.firebasestorage.app",
  messagingSenderId: "551719106035",
  appId: "1:551719106035:web:7381bd6eb79d0f847c4e86",
  measurementId: "G-ES361EZYKG"
};

// If the compat SDKs are loaded (index.html includes them by default in this repo),
// initialize Firebase automatically. If you prefer to initialize manually from
// your app code, remove or comment out this block.
if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
  try {
    firebase.initializeApp(window.firebaseConfig);
  } catch (e) {
    console.warn('Firebase initialization failed:', e);
  }
}
