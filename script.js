// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Job Application Tracker loaded!');
    init();
});

// Initialize function
function init() {
    setupEventListeners();
    setupRatingStars();
    loadJobs();
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
}

// Handle adding a new job
function handleAddJob(e) {
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
    
    // Get existing jobs
    let jobs = getJobsFromStorage();
    
    // Add new job
    jobs.push(newJob);
    
    // Save to localStorage
    saveJobsToStorage(jobs);
    
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
function handleDeleteJob(jobId) {
    if (confirm('Are you sure you want to delete this job application?')) {
        let jobs = getJobsFromStorage();
        jobs = jobs.filter(job => job.id !== jobId);
        saveJobsToStorage(jobs);
        loadJobs();
        showNotification('Job application deleted.');
    }
}

// Handle clearing all jobs
function handleClearAll() {
    if (confirm('Are you sure you want to delete all job applications? This cannot be undone.')) {
        saveJobsToStorage([]);
        loadJobs();
        showNotification('All job applications cleared.');
    }
}

// Load and display jobs
function loadJobs() {
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
                <button class="btn btn-primary btn-small" onclick="openEditModal(${job.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="handleDeleteJob(${job.id})">Delete</button>
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
    
    return card;
}

// Get jobs from localStorage
function getJobsFromStorage() {
    try {
        const jobs = localStorage.getItem('jobApplications');
        return jobs ? JSON.parse(jobs) : [];
    } catch (error) {
        console.error('Error reading from storage:', error);
        showNotification('Error loading your saved applications. Storage may be full.');
        return [];
    }
}

// Save jobs to localStorage
function saveJobsToStorage(jobs) {
    try {
        const dataString = JSON.stringify(jobs);
        // Check storage size (rough estimate)
        if (dataString.length > 5000000) {
            showNotification('Warning: Your data is taking up a lot of storage space.');
        }
        localStorage.setItem('jobApplications', dataString);
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            showNotification('Storage limit exceeded. Please delete some old applications.');
        } else {
            console.error('Error saving to storage:', error);
            showNotification('Error saving your application. Please try again.');
        }
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
    const jobs = getJobsFromStorage();
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
        showNotification('Job not found.');
        return;
    }
    
    currentEditingJobId = jobId;
    
    // Populate modal fields
    document.getElementById('edit-status').value = job.status;
    document.getElementById('edit-notes').value = job.notes === 'No notes' ? '' : job.notes;
    document.getElementById('edit-likelihood').value = job.likelihoodRating || 0;
    document.getElementById('edit-url').value = job.jobUrl || '';
    document.getElementById('edit-phone').value = job.contactPhone || '';
    // Populate contact fields (primary + additional)
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

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('show');
    currentEditingJobId = null;
}

function saveEditedJob() {
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
