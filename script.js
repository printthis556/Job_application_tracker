 // Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Job Application Tracker loaded!');
    init();
});

// Authentication helpers and UI control
function getCurrentUser() {
    try {
        const s = localStorage.getItem('loggedInUser') || sessionStorage.getItem('loggedInUser');
        return s ? JSON.parse(s) : null;
    } catch (e) {
        return null;
    }
}

function saveUser(user, stayLoggedIn) {
    const json = JSON.stringify(user);
    if (stayLoggedIn) {
        localStorage.setItem('loggedInUser', json);
        sessionStorage.removeItem('loggedInUser');
    } else {
        sessionStorage.setItem('loggedInUser', json);
        localStorage.removeItem('loggedInUser');
    }
}

function clearUser() {
    localStorage.removeItem('loggedInUser');
    sessionStorage.removeItem('loggedInUser');
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
}

function storageKeyForJobs() {
    const user = getCurrentUser();
    if (user && user.email) return `jobApplications_${encodeURIComponent(user.email)}`;
    return 'jobApplications';
}

// Firebase integration flags / helpers
let firebaseEnabled = false;
let firestoreDb = null;
let firebaseAuth = null;

function initFirebaseIfConfigured() {
    try {
        if (window.firebase && window.firebaseConfig) {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
            // Initialize auth immediately (we can use it even if Firestore isn't set up)
            firebaseAuth = firebase.auth();

            // Defer enabling Firestore until we verify the project has a database.
            // If the quick check fails, we fall back to localStorage-only mode to
            // avoid repeated "database does not exist" errors in the console.
            try {
                firestoreDb = firebase.firestore();
                // Lightweight availability check: try to read a small query. If the
                // project's Firestore/Datastore isn't configured this will fail and
                // we'll remain in local-only mode.
                firestoreDb.collection('__init_check__').limit(1).get()
                    .then(() => {
                        firebaseEnabled = true;
                        console.info('Firestore available: using cloud storage.');
                    })
                    .catch(err => {
                        console.warn('Firestore not available; falling back to local storage.', err);
                        firebaseEnabled = false;
                    });
            } catch (e) {
                console.warn('Firestore initialization failed; falling back to local storage.', e);
                firebaseEnabled = false;
            }

            // Listen to auth state changes (we still handle auth even when Firestore is unavailable)
            firebaseAuth.onAuthStateChanged(user => {
                if (user) {
                    // prefer Firebase displayName if available
                    const name = user.displayName || deriveNameFromEmail(user.email);
                    saveUser({ email: user.email, uid: user.uid, name }, true);
                    const displayEl = document.getElementById('user-email-display');
                    if (displayEl) {
                        displayEl.textContent = name;
                        displayEl.title = user.email;
                    }
                    const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${name}`; greet.style.display = 'block'; }
                    document.getElementById('signout-btn').style.display = 'inline-block';
                    const editBtn = document.getElementById('edit-name-btn'); if (editBtn) editBtn.style.display = 'inline-block';
                    showApp();
                    loadJobs();
                } else {
                    clearUser();
                    showLogin();
                }
            });
        }
    } catch (e) {
        console.warn('Firebase not configured or failed to initialize', e);
        firebaseEnabled = false;
    }
}

function deriveNameFromEmail(email) {
    if (!email) return '';
    const local = email.split('@')[0];
    // replace dots/underscores/hyphens with spaces and capitalize words
    return local.replace(/[._-]+/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function getDisplayName(user) {
    if (!user) return '';
    if (user.name) return user.name;
    if (user.displayName) return user.displayName;
    if (user.email) return deriveNameFromEmail(user.email);
    return '';
}

// Basic client-side auth (local demo). For cross-device syncing, integrate a backend (see README).
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value || '';
    const stay = document.getElementById('stay-logged-in').checked;

    if (!email || !password) {
        showNotification('Please provide email and password.');
        return;
    }

    if (firebaseEnabled && firebaseAuth) {
        firebaseAuth.signInWithEmailAndPassword(email, password)
            .then(cred => {
                const user = cred.user;
                const name = user.displayName || deriveNameFromEmail(user.email);
                saveUser({ email: user.email, uid: user.uid, name }, stay);
                const displayEl = document.getElementById('user-email-display');
                if (displayEl) {
                    displayEl.textContent = name;
                    displayEl.title = user.email;
                }
                const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${name}`; greet.style.display = 'block'; }
                document.getElementById('signout-btn').style.display = 'inline-block';
                const editBtn = document.getElementById('edit-name-btn'); if (editBtn) editBtn.style.display = 'inline-block';
                showApp();
                setupEventListeners();
                setupRatingStars();
                loadJobs();
            })
            .catch(err => {
                console.error('Firebase sign-in error', err);
                showNotification('Sign in failed. ' + (err.message || ''));
            });
        return;
    }

    // Load saved users map (local demo)
    const usersJson = localStorage.getItem('users') || '{}';
    const users = JSON.parse(usersJson);

    if (!users[email] || users[email].password !== password) {
        showNotification('Account not found or wrong password. Use Create account to register.');
        return;
    }

    // Successful login (local demo)
    // Use saved name if present or derive from email
    const savedName = users[email].name || deriveNameFromEmail(email);
    saveUser({ email, name: savedName }, stay);
    const displayEl = document.getElementById('user-email-display');
    if (displayEl) {
        displayEl.textContent = savedName;
        displayEl.title = email;
    }
    const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${savedName}`; greet.style.display = 'block'; }
    document.getElementById('signout-btn').style.display = 'inline-block';
    const editBtn = document.getElementById('edit-name-btn'); if (editBtn) editBtn.style.display = 'inline-block';
    showApp();
    // Initialize app now that user is authenticated
    setupEventListeners();
    setupRatingStars();
    loadJobs();
}

function showRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

function hideRegisterForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
}

function handleRegisterSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value || '';
    const confirm = document.getElementById('register-confirm').value || '';

    if (!email || !password) {
        showNotification('Please enter email and password to register.');
        return;
    }

    if (password !== confirm) {
        showNotification('Passwords do not match.');
        return;
    }

    const fullName = (document.getElementById('register-name') && document.getElementById('register-name').value.trim()) || '';

    if (firebaseEnabled && firebaseAuth) {
        firebaseAuth.createUserWithEmailAndPassword(email, password)
            .then(cred => {
                // If the user provided a name, update their profile
                if (fullName && cred.user && cred.user.updateProfile) {
                    cred.user.updateProfile({ displayName: fullName }).catch(() => {});
                }
                showNotification('Account created and signed in.');
                hideRegisterForm();
            })
            .catch(err => {
                console.error('Firebase create user error', err);
                showNotification('Register failed. ' + (err.message || ''));
            });
        return;
    }

    const usersJson = localStorage.getItem('users') || '{}';
    const users = JSON.parse(usersJson);
    if (users[email]) {
        showNotification('Account already exists. Please sign in.');
        return;
    }

    users[email] = { password, name: fullName };
    localStorage.setItem('users', JSON.stringify(users));
    showNotification('Account created. You can now sign in.');
    hideRegisterForm();
}

function handleSignOut() {
    if (firebaseEnabled && firebaseAuth) {
        firebaseAuth.signOut().then(() => {
            clearUser();
            document.getElementById('user-email-display').textContent = '';
            const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = ''; greet.style.display = 'none'; }
            document.getElementById('signout-btn').style.display = 'none';
            const editBtn = document.getElementById('edit-name-btn');
            if (editBtn) editBtn.style.display = 'none';
            showLogin();
        }).catch(err => {
            console.error('Error signing out', err);
            showNotification('Error signing out.');
        });
        return;
    }

    clearUser();
    const displayEl = document.getElementById('user-email-display');
    if (displayEl) displayEl.textContent = '';
    const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = ''; greet.style.display = 'none'; }
    document.getElementById('signout-btn').style.display = 'none';
    const editBtn = document.getElementById('edit-name-btn');
    if (editBtn) editBtn.style.display = 'none';
    showLogin();
}

// Prompt and save a new display name for the current user
function handleEditDisplayName() {
    const user = getCurrentUser();
    if (!user || !user.email) {
        showNotification('Not signed in.');
        return;
    }
    const current = getDisplayName(user) || '';
    const newName = prompt('Edit display name (leave blank to use email-derived name):', current);
    if (newName === null) return; // cancelled
    const trimmed = newName.trim();
    if (trimmed === current) return;

    const stay = !!localStorage.getItem('loggedInUser');

    if (firebaseEnabled && firebaseAuth && firebaseAuth.currentUser) {
        firebaseAuth.currentUser.updateProfile({ displayName: trimmed }).then(() => {
            saveUser({ email: user.email, uid: user.uid, name: trimmed }, stay);
            const displayEl = document.getElementById('user-email-display');
            if (displayEl) {
                displayEl.textContent = trimmed || deriveNameFromEmail(user.email);
                displayEl.title = user.email;
            }
            const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${trimmed}`; greet.style.display = 'block'; }
            showNotification('Display name updated.');
        }).catch(err => {
            console.error('Error updating display name', err);
            showNotification('Failed to update display name.');
        });
        return;
    }

    const usersJson = localStorage.getItem('users') || '{}';
    const users = JSON.parse(usersJson);
    if (users[user.email]) {
        users[user.email].name = trimmed;
        localStorage.setItem('users', JSON.stringify(users));
    }

    saveUser({ email: user.email, uid: user.uid, name: trimmed }, stay);
    const displayEl = document.getElementById('user-email-display');
    if (displayEl) {
        displayEl.textContent = trimmed || deriveNameFromEmail(user.email);
        displayEl.title = user.email;
    }
    const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${trimmed}`; greet.style.display = 'block'; }
    showNotification('Display name updated.');
}

// Initialize function
function init() {
    // Wire up login form and register controls
    const loginForm = document.getElementById('login-form');
    const registerBtn = document.getElementById('register-btn');
    const registerForm = document.getElementById('register-form');
    const registerCancel = document.getElementById('register-cancel');
    const signoutBtn = document.getElementById('signout-btn');
    const editNameBtn = document.getElementById('edit-name-btn');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerBtn) registerBtn.addEventListener('click', showRegisterForm);
    if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
    if (registerCancel) registerCancel.addEventListener('click', hideRegisterForm);
    if (signoutBtn) signoutBtn.addEventListener('click', handleSignOut);
    if (editNameBtn) editNameBtn.addEventListener('click', handleEditDisplayName);

    // Show-password toggle for the login form
    const showPwd = document.getElementById('show-password');
    if (showPwd) showPwd.addEventListener('change', function() {
        const pwd = document.getElementById('login-password');
        if (!pwd) return;
        pwd.type = this.checked ? 'text' : 'password';
    });

    // Try to initialize Firebase (if firebase-config.js exists and SDKs loaded)
    initFirebaseIfConfigured();

    // Always wire up the app event listeners and rating stars so the add-job
    // form works even if the user isn't signed in (local demo use-case).
    setupEventListeners();
    setupRatingStars();

    const user = getCurrentUser();
    if (user && (user.email || user.name)) {
        const displayEl = document.getElementById('user-email-display');
        const name = getDisplayName(user) || user.email || '';
        if (displayEl) {
            displayEl.textContent = name;
            if (user.email) displayEl.title = user.email;
        }
        const greet = document.getElementById('user-greeting'); if (greet) { greet.textContent = `Welcome, ${name}`; greet.style.display = 'block'; }
        document.getElementById('signout-btn').style.display = 'inline-block';
        const editBtn = document.getElementById('edit-name-btn'); if (editBtn) editBtn.style.display = 'inline-block';
        showApp();
        loadJobs();
    } else {
        showLogin();
    }
}

// Toggle helper (can be reused elsewhere)
function togglePasswordInput(inputId, show) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = show ? 'text' : 'password';
}

// Setup event listeners
function setupEventListeners() {
    const jobForm = document.getElementById('job-form');
    const clearAllBtn = document.getElementById('clear-all-btn');
    
    if (jobForm) {
        jobForm.addEventListener('submit', handleAddJob);
    }
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }

    // Modal buttons (wired via JS to avoid inline handlers)
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) modalClose.addEventListener('click', closeEditModal);

    const modalCancel = document.getElementById('modal-cancel-btn');
    if (modalCancel) modalCancel.addEventListener('click', closeEditModal);

    const modalSave = document.getElementById('modal-save-btn');
    if (modalSave) modalSave.addEventListener('click', saveEditedJob);
}

// Handle adding a new job
async function handleAddJob(e) {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(e.target);
    const newJob = {
        id: Date.now(),
        jobName: formData.get('jobName'),
        position: formData.get('position'),
        pay: formData.get('pay') || 'Not listed',
        location: formData.get('location'),
        dateApplied: formData.get('dateApplied'),
        contactName: formData.get('contactName') || 'N/A',
        additionalContacts: (formData.get('additionalContacts') || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean),
        source: formData.get('source'),
        status: formData.get('status'),
        followUpDate: formData.get('followUpDate') || 'N/A',
        notes: formData.get('notes') || 'No notes',
        likelihoodRating: parseInt(formData.get('likelihoodRating')) || 0,
        jobUrl: normalizeUrl(formData.get('jobUrl') || '')
    };
    
    if (firebaseEnabled) {
        const user = getCurrentUser();
        if (!user || !user.uid) {
            showNotification('Please sign in to save to the cloud.');
            return;
        }
        const col = firestoreDb.collection('users').doc(user.uid).collection('jobApplications');
        await col.doc(String(newJob.id)).set(newJob);
    } else {
        // Get existing jobs
        let jobs = getJobsFromStorage();
        // Add new job
        jobs.push(newJob);
        // Save to localStorage
        saveJobsToStorage(jobs);
    }
    
    // Reset form
    e.target.reset();
    
    // Reset rating display
    resetRatingDisplay('add-rating-input');
    
    // Reload jobs display
    loadJobs();
    
    // Show confirmation
    showNotification('Job application added successfully!');
}

// Handle deleting a job
async function handleDeleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job application?')) return;
    if (firebaseEnabled) {
        try {
            const user = getCurrentUser();
            if (!user || !user.uid) {
                showNotification('Not signed in.');
                return;
            }
            const ref = firestoreDb.collection('users').doc(user.uid).collection('jobApplications').doc(String(jobId));
            await ref.delete();
            loadJobs();
            showNotification('Job application deleted.');
        } catch (e) {
            console.error('Error deleting from Firestore', e);
            showNotification('Error deleting application.');
        }
    } else {
        let jobs = getJobsFromStorage();
        jobs = jobs.filter(job => job.id !== jobId);
        saveJobsToStorage(jobs);
        loadJobs();
        showNotification('Job application deleted.');
    }
}

// Handle clearing all jobs
async function handleClearAll() {
    if (!confirm('Are you sure you want to delete all job applications? This cannot be undone.')) return;
    if (firebaseEnabled) {
        try {
            const user = getCurrentUser();
            if (!user || !user.uid) {
                showNotification('Not signed in.');
                return;
            }
            const col = firestoreDb.collection('users').doc(user.uid).collection('jobApplications');
            const snapshot = await col.get();
            const batch = firestoreDb.batch();
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            loadJobs();
            showNotification('All job applications cleared.');
        } catch (e) {
            console.error('Error clearing Firestore', e);
            showNotification('Error clearing applications.');
        }
    } else {
        saveJobsToStorage([]);
        loadJobs();
        showNotification('All job applications cleared.');
    }
}

// Load and display jobs
function loadJobs() {
    if (firebaseEnabled) {
        loadJobsFromFirestore();
        return;
    }
    let jobs = getJobsFromStorage();
    const jobsContainer = document.getElementById('jobs-container');
    const jobCount = document.getElementById('job-count');
    
    // Sort jobs based on current sort method
    jobs = sortJobs(jobs, currentSortMethod);
    
    // Update job count
    jobCount.textContent = `Total Applications: ${jobs.length}`;
    
    // Clear container
    jobsContainer.innerHTML = '';
    
    if (jobs.length === 0) {
        jobsContainer.innerHTML = '<p class="empty-message">No job applications yet. Add one to get started!</p>';
        return;
    }
    
    // Display each job
    jobs.forEach(job => {
        const jobCard = createJobCard(job);
        jobsContainer.appendChild(jobCard);
    });
    
    // Setup rating stars after loading jobs
    setupRatingStars();
}

// Sort jobs based on method
function sortJobs(jobs, method) {
    const jobsCopy = [...jobs];
    
    if (method === 'likelihood') {
        // Sort by likelihood (highest first), then move rejected to bottom
        return jobsCopy.sort((a, b) => {
            // Rejected jobs go to the bottom
            if (a.status === 'Rejected' && b.status !== 'Rejected') return 1;
            if (a.status !== 'Rejected' && b.status === 'Rejected') return -1;
            
            // Both rejected, sort by date
            if (a.status === 'Rejected' && b.status === 'Rejected') {
                return new Date(b.dateApplied) - new Date(a.dateApplied);
            }
            
            // Sort by likelihood (highest first)
            if (b.likelihoodRating !== a.likelihoodRating) {
                return b.likelihoodRating - a.likelihoodRating;
            }
            
            // If likelihood is the same, sort by date
            return new Date(b.dateApplied) - new Date(a.dateApplied);
        });
    } else if (method === 'date') {
        // Sort by date (newest first), rejected jobs at bottom
        return jobsCopy.sort((a, b) => {
            // Rejected jobs go to the bottom
            if (a.status === 'Rejected' && b.status !== 'Rejected') return 1;
            if (a.status !== 'Rejected' && b.status === 'Rejected') return -1;
            
            // Sort by date (newest first)
            return new Date(b.dateApplied) - new Date(a.dateApplied);
        });
    } else if (method === 'status') {
        // Sort by status (Applied, Recruiter, Interview, Rejected at bottom)
        const statusOrder = { 'Interview': 0, 'Recruiter': 1, 'Applied': 2, 'Rejected': 3 };
        return jobsCopy.sort((a, b) => {
            const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
            if (statusDiff !== 0) return statusDiff;
            
            // If same status, sort by likelihood
            if (b.likelihoodRating !== a.likelihoodRating) {
                return b.likelihoodRating - a.likelihoodRating;
            }
            
            // If same likelihood, sort by date
            return new Date(b.dateApplied) - new Date(a.dateApplied);
        });
    }
    
    return jobsCopy;
}

// Handle sort method change
function handleSortChange() {
    const sortSelect = document.getElementById('sort-select');
    currentSortMethod = sortSelect.value;
    loadJobs();
}

// Create a job card element
function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';
    
    const statusClass = `status-${job.status.toLowerCase().replace(' ', '-')}`;
    
    // Create star rating display
    let starDisplay = '';
    if (job.likelihoodRating && job.likelihoodRating > 0) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += i <= job.likelihoodRating ? '★' : '☆';
        }
        starDisplay = `<div class="rating-display"><span class="stars">${stars}</span> <span>${job.likelihoodRating}/5</span></div>`;
    }
    
    // Build contacts display (primary + additional)
    const contacts = [];
    if (job.contactName) contacts.push(escapeHtml(job.contactName));
    if (Array.isArray(job.additionalContacts) && job.additionalContacts.length) {
        contacts.push(...job.additionalContacts.map(c => escapeHtml(c)));
    }
    const contactsHtml = contacts.length ? contacts.join(', ') : 'N/A';

    card.innerHTML = `
        <div class="job-header">
            <div>
                <h3 class="job-title">${escapeHtml(job.jobName)}</h3>
                <p class="job-subtitle">${escapeHtml(job.position)}</p>
            </div>
            <div class="job-actions">
                <span class="status-badge ${statusClass}">${job.status}</span>
                <button class="btn btn-primary btn-small edit-btn" data-job-id="${job.id}">Edit</button>
                <button class="btn btn-danger btn-small delete-btn" data-job-id="${job.id}">Delete</button>
            </div>
        </div>
        
        ${starDisplay}
        
        <div class="job-content">
            <div class="job-detail">
                <span class="job-detail-label">Location / Remote</span>
                <span class="job-detail-value">${escapeHtml(job.location)}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Pay</span>
                <span class="job-detail-value">${escapeHtml(job.pay)}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Date Applied</span>
                <span class="job-detail-value">${formatDate(job.dateApplied)}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Contacts</span>
                <span class="job-detail-value">${contactsHtml}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Source</span>
                <span class="job-detail-value">${escapeHtml(job.source)}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Website</span>
                <span class="job-detail-value">${job.jobUrl ? `<a href="${escapeHtml(job.jobUrl)}" target="_blank" rel="noopener">Open Link</a>` : 'N/A'}</span>
            </div>
            <div class="job-detail">
                <span class="job-detail-label">Follow Up Date</span>
                <span class="job-detail-value">${job.followUpDate !== 'N/A' ? formatDate(job.followUpDate) : 'N/A'}</span>
            </div>
        </div>
        
        ${job.notes !== 'No notes' ? `
            <div class="job-notes">
                <div class="job-notes-label">Notes</div>
                <div class="job-notes-value">${escapeHtml(job.notes)}</div>
            </div>
        ` : ''}
    `;
    
    // Attach event listeners instead of using inline handlers (CSP-safe)
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            openEditModal(job.id);
        });
    }

    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            handleDeleteJob(job.id);
        });
    }

    return card;
}

// Get jobs from localStorage
function getJobsFromStorage() {
    try {
        const key = storageKeyForJobs();
        const jobs = localStorage.getItem(key);
        return jobs ? JSON.parse(jobs) : [];
    } catch (error) {
        console.error('Error reading from storage:', error);
        showNotification('Error loading your saved applications. Storage may be full.');
        return [];
    }
}

// Save jobs to localStorage
function saveJobsToStorage(jobs) {
    // If Firebase is enabled and user is authenticated, save to Firestore instead
    const user = getCurrentUser();
    if (firebaseEnabled && user && user.uid) {
        saveJobsToFirestore(jobs).catch(err => console.error('Error saving to Firestore:', err));
        return;
    }
    try {
        const key = storageKeyForJobs();
        const dataString = JSON.stringify(jobs);
        // Check storage size (rough estimate)
        if (dataString.length > 5000000) {
            showNotification('Warning: Your data is taking up a lot of storage space.');
        }
        localStorage.setItem(key, dataString);
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            showNotification('Storage limit exceeded. Please delete some old applications.');
        } else {
            console.error('Error saving to storage:', error);
            showNotification('Error saving your application. Please try again.');
        }
    }
}

// Firestore-backed functions
async function loadJobsFromFirestore() {
    try {
        const user = getCurrentUser();
        if (!user || !user.uid) {
            showNotification('Not signed in for Firestore reads.');
            return;
        }
        const jobsContainer = document.getElementById('jobs-container');
        const jobCount = document.getElementById('job-count');

        const col = firestoreDb.collection('users').doc(user.uid).collection('jobApplications');
        const snapshot = await col.get();
        const jobs = snapshot.docs.map(d => d.data()).sort((a,b) => 0);

        // Sort using existing sort function
        const sorted = sortJobs(jobs, currentSortMethod);

        jobCount.textContent = `Total Applications: ${sorted.length}`;
        jobsContainer.innerHTML = '';
        if (sorted.length === 0) {
            jobsContainer.innerHTML = '<p class="empty-message">No job applications yet. Add one to get started!</p>';
            return;
        }
        sorted.forEach(job => {
            const jobCard = createJobCard(job);
            jobsContainer.appendChild(jobCard);
        });
        setupRatingStars();
    } catch (e) {
        console.error('Error reading from Firestore', e);
        showNotification('Error loading data from backend.');
    }
}

async function saveJobsToFirestore(jobs) {
    try {
        const user = getCurrentUser();
        if (!user || !user.uid) throw new Error('Not signed in');
        const col = firestoreDb.collection('users').doc(user.uid).collection('jobApplications');

        // Get existing docs to compute deletions
        const existing = await col.get();
        const batch = firestoreDb.batch();

        const keepIds = new Set(jobs.map(j => String(j.id)));

        // Set/overwrite docs for each job
        jobs.forEach(job => {
            const docRef = col.doc(String(job.id));
            batch.set(docRef, job);
        });

        // Delete docs not in current list
        existing.docs.forEach(d => {
            if (!keepIds.has(d.id)) batch.delete(d.ref);
        });

        await batch.commit();
    } catch (e) {
        console.error('Error saving to Firestore', e);
        throw e;
    }
}

// Format date to readable format
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    text = text == null ? '' : String(text);
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Normalize URL (add protocol if missing)
function normalizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    try {
        // If URL has protocol, return as-is
        const parsed = new URL(url, 'https://example.com');
        if (!/^https?:\/\//i.test(url)) {
            return 'https://' + url;
        }
        return url;
    } catch (e) {
        // If invalid, still try to prefix
        if (!/^https?:\/\//i.test(url)) return 'https://' + url;
        return url;
    }
}

// Show notification message
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #667eea;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal functions
let currentEditingJobId = null;
let currentSortMethod = 'likelihood';

function openEditModal(jobId) {
    currentEditingJobId = jobId;
    if (firebaseEnabled) {
        (async () => {
            try {
                const user = getCurrentUser();
                if (!user || !user.uid) {
                    showNotification('Not signed in.');
                    return;
                }
                const doc = await firestoreDb.collection('users').doc(user.uid).collection('jobApplications').doc(String(jobId)).get();
                const job = doc.exists ? doc.data() : null;
                if (!job) {
                    showNotification('Job not found.');
                    return;
                }

                const editStatusEl = document.getElementById('edit-status');
                if (editStatusEl) {
                    // Prefer exact value match; fall back to matching option text (legacy data might store label)
                    const hasValue = Array.from(editStatusEl.options).some(opt => opt.value === job.status);
                    if (hasValue) {
                        editStatusEl.value = job.status;
                    } else {
                        const match = Array.from(editStatusEl.options).find(opt => opt.textContent.trim() === job.status);
                        editStatusEl.value = match ? match.value : '';
                    }
                }
                document.getElementById('edit-notes').value = job.notes === 'No notes' ? '' : job.notes;
                document.getElementById('edit-likelihood').value = job.likelihoodRating || 0;
                document.getElementById('edit-url').value = job.jobUrl || '';
                document.getElementById('edit-phone').value = job.contactPhone || '';
                if (document.getElementById('edit-contact-name')) {
                    document.getElementById('edit-contact-name').value = job.contactName && job.contactName !== 'N/A' ? job.contactName : '';
                }
                if (document.getElementById('edit-additional-contacts')) {
                    document.getElementById('edit-additional-contacts').value = Array.isArray(job.additionalContacts) ? job.additionalContacts.join('\n') : '';
                }
                setRatingDisplay('edit-rating-input', job.likelihoodRating || 0);
                const modal = document.getElementById('edit-modal');
                modal.classList.add('show');
            } catch (e) {
                console.error('Error fetching job for edit', e);
                showNotification('Error loading job for editing.');
            }
        })();
    } else {
        const jobs = getJobsFromStorage();
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            showNotification('Job not found.');
            return;
        }

        // Populate modal fields
        const editStatusElLocal = document.getElementById('edit-status');
        if (editStatusElLocal) {
            const hasValue = Array.from(editStatusElLocal.options).some(opt => opt.value === job.status);
            if (hasValue) {
                editStatusElLocal.value = job.status;
            } else {
                const match = Array.from(editStatusElLocal.options).find(opt => opt.textContent.trim() === job.status);
                editStatusElLocal.value = match ? match.value : '';
            }
        }
        document.getElementById('edit-notes').value = job.notes === 'No notes' ? '' : job.notes;
        document.getElementById('edit-likelihood').value = job.likelihoodRating || 0;
        document.getElementById('edit-url').value = job.jobUrl || '';
        document.getElementById('edit-phone').value = job.contactPhone || '';
        if (document.getElementById('edit-contact-name')) {
            document.getElementById('edit-contact-name').value = job.contactName && job.contactName !== 'N/A' ? job.contactName : '';
        }
        if (document.getElementById('edit-additional-contacts')) {
            document.getElementById('edit-additional-contacts').value = Array.isArray(job.additionalContacts) ? job.additionalContacts.join('\n') : '';
        }

        // Set rating display
        setRatingDisplay('edit-rating-input', job.likelihoodRating || 0);

        // Show modal
        const modal = document.getElementById('edit-modal');
        modal.classList.add('show');
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('show');
    currentEditingJobId = null;
}

async function saveEditedJob() {
    if (currentEditingJobId === null) return;

    const status = document.getElementById('edit-status').value;
    const notes = document.getElementById('edit-notes').value || 'No notes';
    const rating = parseInt(document.getElementById('edit-likelihood').value) || 0;
    const url = normalizeUrl(document.getElementById('edit-url').value || '');
    const phone = document.getElementById('edit-phone').value || '';
    const primaryContact = document.getElementById('edit-contact-name') ? document.getElementById('edit-contact-name').value || '' : '';
    const additional = document.getElementById('edit-additional-contacts') ? (document.getElementById('edit-additional-contacts').value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

    if (!status) {
        showNotification('Please select a status.');
        return;
    }

    if (firebaseEnabled) {
        try {
            const user = getCurrentUser();
            if (!user || !user.uid) {
                showNotification('Not signed in.');
                return;
            }
            const col = firestoreDb.collection('users').doc(user.uid).collection('jobApplications');
            const docRef = col.doc(String(currentEditingJobId));
            const doc = await docRef.get();
            if (!doc.exists) {
                showNotification('Job not found.');
                return;
            }
            const job = doc.data();
            job.status = status;
            job.notes = notes;
            job.likelihoodRating = rating;
            job.jobUrl = url;
            job.contactPhone = phone;
            job.contactName = primaryContact || job.contactName || 'N/A';
            job.additionalContacts = additional;

            await docRef.set(job);
            closeEditModal();
            loadJobs();
            showNotification('Job updated successfully!');
        } catch (e) {
            console.error('Error updating Firestore job', e);
            showNotification('Error updating job.');
        }
    } else {
        let jobs = getJobsFromStorage();
        const jobIndex = jobs.findIndex(j => j.id === currentEditingJobId);

        if (jobIndex === -1) {
            showNotification('Job not found.');
            return;
        }

        // Update job
        jobs[jobIndex].status = status;
        jobs[jobIndex].notes = notes;
        jobs[jobIndex].likelihoodRating = rating;
        jobs[jobIndex].jobUrl = url;
        jobs[jobIndex].contactPhone = phone;
        // Update primary and additional contacts
        jobs[jobIndex].contactName = primaryContact || jobs[jobIndex].contactName || 'N/A';
        jobs[jobIndex].additionalContacts = additional;

        // Save to storage
        saveJobsToStorage(jobs);

        // Close modal
        closeEditModal();

        // Reload jobs
        loadJobs();

        showNotification('Job updated successfully!');
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeEditModal();
    }
});

// Rating star interaction functions
function setRatingDisplay(containerId, rating) {
    const container = document.getElementById(containerId);
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function resetRatingDisplay(containerId) {
    const container = document.getElementById(containerId);
    const stars = container.querySelectorAll('.star');
    stars.forEach(star => {
        star.classList.remove('active');
    });
}

// Setup rating star interactions
function setupRatingStars() {
    // Add job form rating
    const addRatingContainer = document.getElementById('add-rating-input');
    if (addRatingContainer) {
        const addStars = addRatingContainer.querySelectorAll('.star');
        const addRatingInput = document.getElementById('likelihood-rating');
        
        addStars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-value'));
                addRatingInput.value = rating;
                setRatingDisplay('add-rating-input', rating);
            });
            
            star.addEventListener('mouseover', function() {
                const rating = parseInt(this.getAttribute('data-value'));
                setRatingDisplay('add-rating-input', rating);
            });
        });
        
        addRatingContainer.addEventListener('mouseout', function() {
            const rating = parseInt(addRatingInput.value);
            setRatingDisplay('add-rating-input', rating);
        });
    }
    
    // Edit modal rating
    const editRatingContainer = document.getElementById('edit-rating-input');
    if (editRatingContainer) {
        const editStars = editRatingContainer.querySelectorAll('.star');
        const editRatingInput = document.getElementById('edit-likelihood');
        
        editStars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-value'));
                editRatingInput.value = rating;
                setRatingDisplay('edit-rating-input', rating);
            });
            
            star.addEventListener('mouseover', function() {
                const rating = parseInt(this.getAttribute('data-value'));
                setRatingDisplay('edit-rating-input', rating);
            });
        });
        
        editRatingContainer.addEventListener('mouseout', function() {
            const rating = parseInt(editRatingInput.value);
            setRatingDisplay('edit-rating-input', rating);
        });
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
