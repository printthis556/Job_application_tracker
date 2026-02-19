# Job_application_tracker

This is a lightweight job application tracker web app. It provides a simple login UI and two storage modes:

- Local demo auth: accounts and jobs are saved locally in `localStorage` for quick demos.
- Optional cloud sync: when you configure Firebase the app will read/write job data to Firestore under each user's account.

How storage works
- Local: demo accounts are stored under the `users` key in `localStorage`. Per-user job data is stored under `jobApplications_<email>`.
- Firestore: when Firebase is configured the app stores job documents inside `users/{uid}/jobApplications` (each job is a document; the code uses a numeric timestamp id by default).

Anonymous (guest) behavior
- The app now attempts an automatic anonymous Firebase sign-in when Firebase is available. This allows jobs to persist to Firestore without an explicit sign-in.
- If you want cross-device sync, sign in using Email/Password (or another provider) and the same data will be associated with your Firebase user.
- When a user explicitly signs out the app suppresses the immediate recreation of an anonymous session.

Firebase setup (quick)
1. Create a Firebase project at https://console.firebase.google.com/.
2. In **Authentication → Sign-in method** enable **Anonymous** and (optionally) **Email/Password**.
3. In **Build → Firestore Database** create a Firestore database (start in test mode for development).
4. Copy `firebase-config.js.example` to `firebase-config.js` and paste your project's config into `window.firebaseConfig`.
	 - `firebase-config.js` is loaded by `index.html`; the app will initialize Firebase automatically when the file is present and the SDKs are loaded.
5. Ensure the SDK scripts in `index.html` are present (they are included by default in this repo).

Security & rules
- For development you can use permissive test rules, but for production lock down Firestore rules so only authenticated users can read/write their own documents. Example rule snippet:

	{
		"rules": "service cloud.firestore { match /databases/{database}/documents { match /users/{userId}/jobApplications/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; } } }"

- If you allow anonymous auth, consider whether guest data should be short-lived or migrated when the user later upgrades to a permanent account.

Local backup / export
- Before making changes or deploying, you may want to export your current local data:
	- Open the browser console and run:

```bash
JSON.stringify(localStorage.getItem('jobApplications') || localStorage);
```

- I can add a small Export / Import UI to the app if you'd like easier backups.

Local testing and quick deploy
- To run locally (simple HTTP server):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

- To deploy to GitHub Pages: push the repository to a branch configured for Pages and enable Pages in your repo settings. `firebase-config.js` can remain in the repo (the Firebase config keys are safe to publish), but avoid committing any service account credentials.

Notes & next steps
- I added automatic anonymous sign-in and handling in `script.js`. If anonymous auth is disabled in your Firebase project the app will gracefully fall back to `localStorage`.
- Want me to: add an Export/Import UI, add README deploy instructions for Firebase Hosting, or add a migration path from anonymous guests to permanent accounts? Reply which one and I will implement it.