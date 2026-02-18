# Job_application_tracker

This is a lightweight job application tracker web app. I added a simple login screen and per-account local storage.

- Local demo auth: accounts saved locally in `localStorage` (key `users`).
- Per-user job data stored under `jobApplications_<email>` in `localStorage`.

Cross-device sync: to view your data on multiple devices you need a backend or hosted database. A quick option is Firebase (Auth + Firestore). To integrate:

1. Create a Firebase project and enable Email/Password Authentication and Firestore.
2. Add your Firebase config to the app and replace client-side storage with Firestore reads/writes.
3. The login UI is already in `index.html` and auth helpers are in `script.js` — replace the demo auth with Firebase Auth calls and use Firestore `jobApplications_<uid>` collection.
	- Copy `firebase-config.js.example` to `firebase-config.js` and fill `window.firebaseConfig` with your project's values.
	- The app will automatically use Firebase Auth + Firestore when `firebase-config.js` and the Firebase SDKs are available (scripts are in `index.html`).

If you'd like, I can add a Firebase integration scaffold (requires your Firebase config values).