// Firebase configuration - CDN compatible
const firebaseConfig = {
            apiKey: "AIzaSyC5MLrT34n4wsJaPPmAYNCT8h_qQDPQ5jU",
            authDomain: "phototester555.firebaseapp.com",
            projectId: "phototester555",
            storageBucket: "phototester555.firebasestorage.app",
            messagingSenderId: "953997763616",
            appId: "1:953997763616:web:4ac177ad8e79c5f38b8845",
            measurementId: "G-6VS0G0NQ7K"
};

// Initialize Firebase - v8 syntax
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log('User restored:', user.email);
    // Proceed to load dashboard features
    loadDashboardFeatures();
  } else {
    console.log('No user, redirecting to login');
    window.location.href = '/index.html';
  }
});
/*  Add this at the very beginning of your admin-script.js file, right after Firebase initialization
document.addEventListener('DOMContentLoaded', () => {
    // Catch all image errors
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG') {
            console.log('🐛 Image failed to load:');
            console.log('- URL:', e.target.src);
            console.log('- Element:', e.target);
            console.log('- Parent:', e.target.parentElement);
            console.log('- Stack trace:', new Error().stack);
            
            // Prevent the error from cascading
            e.preventDefault();
            e.stopPropagation();
            
            // Replace with placeholder immediately
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIzMCIgeT0iMzYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMjQiPjwvdGV4dD48L3N2Zz4=';
            e.target.onerror = null; // Prevent further errors
        }
    }, true);
});
*/

// ---- Firestore-safe sanitizers & wrappers ----
// Remove all undefined values (deep), also cleans arrays.
// If you prefer dropping undefined keys entirely instead of writing null,
// change the last return to `undefined` and the wrappers will drop them.
// Path helpers

// ============================================
// CANONICAL PROVIDER DATA SCHEMA & NORMALIZER
// ============================================

/**
 * Normalizes provider data to ensure consistent field structure
 * Call this EVERY time you read provider data from Firestore
 */
function normalizeProviderData(rawData, docId) {
    // Identity - single source of truth
    const identity = rawData.identity || {};
    
    return {
        // Core ID fields
        id: docId || rawData.id || null,
        providerId: rawData.providerId || docId || null,
        
        // Identity fields (CANONICAL)
        fullName: identity.fullName || rawData.fullName || rawData.name || 
                  `${rawData.firstName || ''} ${rawData.lastName || ''}`.trim() || 'Unnamed Provider',
        email: identity.email || rawData.email || null,
        phone: identity.phone || rawData.phone || null,
        city: identity.city || rawData.city || rawData.cityOfOperation || null,
        
        // Status fields (CANONICAL - always strings)
        approvalStatus: String(rawData.approvalStatus || rawData.status || 'pending').toLowerCase(),
        status: String(rawData.status || rawData.approvalStatus || 'pending').toLowerCase(),
        
        // Service types (CANONICAL - always array)
        serviceTypes: Array.isArray(rawData.serviceTypes) ? rawData.serviceTypes : 
                      rawData.serviceTypes ? [rawData.serviceTypes] : [],
        
        // Profile data
        profile: rawData.profile || {},
        
        // Tier system
        tier: rawData.tier || null,
        tierAssignedDate: rawData.tierAssignedDate || null,
        tierAssignedBy: rawData.tierAssignedBy || null,
        
        // Timestamps
        createdAt: rawData.createdAt || null,
        updatedAt: rawData.updatedAt || null,
        statusChanged: rawData.statusChanged || null,
        
        // Nested objects (preserved)
        identity: identity,
        kyc: rawData.kyc || {},
        work: rawData.work || {},
        media: rawData.media || {},
        payout: rawData.payout || {},
        
        // Metadata
        isProfileCompleted: rawData.isProfileCompleted || false,
        comments: rawData.comments || null,
        
        // Preserve everything else for backwards compatibility
        ...rawData
    };
}

function get(obj, path, fallback = undefined) {
  if (!obj) return fallback;
  try {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const toString = (v) => (v == null ? '' : String(v));

// Request-Changes Canonical Fields
const RC_CANONICAL_FIELDS = [
  // Identity
  { id: 'identity.fullName', label: 'Full legal name' },
  { id: 'identity.phone', label: 'Phone (E.164)' },
  { id: 'identity.email', label: 'Email' },
  { id: 'identity.city', label: 'City' },
  // KYC
  { id: 'kyc.idFilesUrls', label: 'Government ID uploads' },
  // Profile
  { id: 'profile.experience', label: 'Experience (years)' },
  { id: 'profile.primaryDomain', label: 'Primary domain' },
  { id: 'profile.specialisations', label: 'Specialisation tags' },
  { id: 'profile.mediaSpecialization', label: 'Media focus' },
  { id: 'profile.mediaSubSkills', label: 'Media styles/specialties' },
  { id: 'profile.techSpecialization', label: 'Tech focus' },
  { id: 'profile.techStack', label: 'Tech stack' },
  { id: 'profile.toolsSkills', label: 'Tools & skills' },
  { id: 'profile.equipment', label: 'Equipment list' },
  // Work
  { id: 'work.portfolio', label: 'Portfolio / Work showcase' },
  { id: 'work.cvUrl', label: 'CV / Résumé' },
  { id: 'work.links', label: 'Top work links' },
  { id: 'work.mediaPortfolioUrl', label: 'Media portfolio URL (legacy)' },
  { id: 'work.techPortfolioUrl', label: 'Tech portfolio URL (legacy)' },
  // Payout India
  { id: 'payout.india.acctName', label: 'IN: Account holder name' },
  { id: 'payout.india.bankName', label: 'IN: Bank name' },
  { id: 'payout.india.acctNumber', label: 'IN: Account number' },
  { id: 'payout.india.ifsc', label: 'IN: IFSC' },
  { id: 'payout.india.pan', label: 'IN: PAN' },
  // Payout International
  { id: 'payout.international.intlAcctName', label: 'INTL: Account holder name' },
  { id: 'payout.international.iban', label: 'INTL: IBAN' },
  { id: 'payout.international.swift', label: 'INTL: SWIFT/BIC' },
  { id: 'payout.international.routing', label: 'US: Routing/ABA' },
  { id: 'payout.international.intlAcctNumber', label: 'INTL: Account number' },
  { id: 'payout.international.altPayoutType', label: 'Alt payout method' },
  { id: 'payout.international.altPayoutId', label: 'Alt payout account' }
];

// Map ID → label
const RC_LABEL = Object.fromEntries(RC_CANONICAL_FIELDS.map(f => [f.id, f.label]));

// Grouped field catalog
function rcGetGroupedFieldCatalog() {
  const groups = [
    { title: 'Identity & Contact', fields: ['identity.fullName', 'identity.phone', 'identity.email', 'identity.city'] },
    { title: 'KYC & Verification', fields: ['kyc.idFilesUrls'] },
    { title: 'Profile & Skills', fields: ['profile.experience', 'profile.primaryDomain', 'profile.specialisations', 'profile.mediaSpecialization', 'profile.mediaSubSkills', 'profile.techSpecialization', 'profile.techStack', 'profile.toolsSkills', 'profile.equipment'] },
    { title: 'Work Evidence & Portfolio', fields: ['work.portfolio', 'work.cvUrl', 'work.links', 'work.mediaPortfolioUrl', 'work.techPortfolioUrl'] },
    { title: 'Payout (India)', fields: ['payout.india.acctName', 'payout.india.bankName', 'payout.india.acctNumber', 'payout.india.ifsc', 'payout.india.pan'] },
    { title: 'Payout (International)', fields: ['payout.international.intlAcctName', 'payout.international.iban', 'payout.international.swift', 'payout.international.routing', 'payout.international.intlAcctNumber', 'payout.international.altPayoutType', 'payout.international.altPayoutId'] }
  ];
  
  return groups.map(g => ({
    title: g.title,
    items: g.fields.filter(id => RC_LABEL[id]).map(id => ({ id, label: RC_LABEL[id] }))
  }));
}

// Safe read helper
function rcRead(obj, path) {
  if (!obj || !path) return null;
  try {
    const val = path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
    return val !== undefined ? val : null;
  } catch { return null; }
}
// ========== END HELPER FUNCTIONS ==========
// ============================================
// FIRESTORE DATA SANITIZATION - PRODUCTION GRADE
// ============================================

/**
 * Recursively removes undefined values and converts them to null
 * Also handles nested arrays and objects
 */
function stripUndefinedDeep(input) {
    // Handle null explicitly
    if (input === null) return null;
    
    // Handle undefined - convert to null (Firestore compatible)
    if (input === undefined) return null;
    
    // Handle arrays
    if (Array.isArray(input)) {
        return input
            .map(item => stripUndefinedDeep(item))
            .filter(item => item !== null && item !== undefined);
    }
    
    // Handle objects
    if (input && typeof input === 'object' && input.constructor === Object) {
        const cleaned = {};
        for (const [key, value] of Object.entries(input)) {
            const cleanedValue = stripUndefinedDeep(value);
            // Only add key if value is not undefined
            if (cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
            }
        }
        return cleaned;
    }
    
    // Handle primitives (string, number, boolean)
    return input;
}

/**
 * Safe Firestore .set() wrapper with automatic sanitization
 */
async function safeSet(docRef, data, options = {}) {
    try {
        const sanitized = stripUndefinedDeep(data);
        console.log('🔒 Safe SET:', docRef.path, { originalKeys: Object.keys(data).length, sanitizedKeys: Object.keys(sanitized).length });
        return await docRef.set(sanitized, options);
    } catch (error) {
        console.error('❌ Safe SET failed:', docRef.path, error);
        throw error;
    }
}

/**
 * Safe Firestore .update() wrapper with automatic sanitization
 */
async function safeUpdate(docRef, data) {
    try {
        const sanitized = stripUndefinedDeep(data);
        // Remove empty objects from updates
        const filtered = Object.entries(sanitized)
            .filter(([_, value]) => {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    return Object.keys(value).length > 0;
                }
                return true;
            })
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
        
        if (Object.keys(filtered).length === 0) {
            console.warn('⚠️ Safe UPDATE skipped (no valid fields):', docRef.path);
            return;
        }
        
        console.log('🔒 Safe UPDATE:', docRef.path, { fields: Object.keys(filtered) });
        return await docRef.update(filtered);
    } catch (error) {
        console.error('❌ Safe UPDATE failed:', docRef.path, error);
        throw error;
    }
}

/**
 * Safe Firestore .add() wrapper with automatic sanitization
 */
async function safeAdd(collectionRef, data) {
    try {
        const sanitized = stripUndefinedDeep(data);
        console.log('🔒 Safe ADD:', collectionRef.path, { keys: Object.keys(sanitized).length });
        return await collectionRef.add(sanitized);
    } catch (error) {
        console.error('❌ Safe ADD failed:', collectionRef.path, error);
        throw error;
    }
}


class AdminDashboard {
    constructor() {
      // ===== Existing: Providers =====
      this.providers = [];
      this.currentFilter = 'all';
      this.currentProvider = null;
      this.searchTerm = '';
      this.selectedTier = null;
      this.tierSelectionAction = null;
      this.currentAdmin = null;
  
      // ===== Existing: Enquiries =====
      this.enquiries = [];
      this.currentEnquiryFilter = 'all';
      this.enquirySearchTerm = '';
      this.currentEnquiry = null;
      this.newEnquiryCount = 0;
  
      // ===== Existing: Push notifications =====
      this.notifications = [];
      this.selectedTarget = 'all-users';
  
      // ===== Tabs (now ready for more sections) =====
      // 'providers' | 'enquiries' | 'push' | 'service-reviews' | 'cancellations'
      this.currentTab = localStorage.getItem('admin_active_tab') || 'providers';
  
      // ===== NEW: Service Reviews =====
      this.serviceReviews = [];              // hydrated list
      this.serviceReviewFilter = 'pending';  // pending | approved | denied | all
      this.serviceReviewSearch = '';
      this.currentServiceReview = null;
      this._srvUnsub = null;                 // for realtime listener (optional)
  
      // ===== NEW: Booking Cancellations =====
      this.cancellations = [];
      this.cancellationStatus = 'pending';   // pending | approved | denied | all
      this.cancellationRole = 'all';         // all | customer | provider
      this.cancellationSearch = '';
      this.currentCancellation = null;
      this._cancelUnsub = null;              // for realtime listener (optional)

      // NEW: Featured Providers
      this.featuredProviders = []; // Current week's featured providers
      this.availableProviders = []; // All approved providers for selection
      this.currentWeek = this.getCurrentWeekData(); // Week start/end dates
      this.selectedSlot = null; // Currently selected slot (1, 2, 3)
      this.featuredProviderFilter = 'all'; // all | media | tech
      this.featuredProviderSearch = ''; // Search term
      this.featuredUnsub = null; // Firestore listener unsubscribe
      // Request Changes properties
        this.feedbackFilter = 'open';
  this.unsubProv = null;
  this.unsubReq = null;
  this.liveProv = null;
  this.lastReqs = [];
  this.rcRenderTimeout = null;  
      
      this.init();
    }
    // Change request helper methods
defaultDueDate(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

isOverdue(ts) {
  if (!ts) return false;
  const d = ts instanceof Date ? ts : (ts.toDate?.() || new Date(ts));
  return Date.now() > d.getTime();
}

formatDueDate(ts) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : (ts.toDate?.() || new Date(ts));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Load feedback requests
async loadFeedbackRequests(providerId) {
  const snap = await db.collection('providers')
    .doc(providerId)
    .collection('feedback_requests')
    .orderBy('requestedAt', 'desc')
    .limit(10)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Helper methods for value comparison
getOldValue(request, fieldPath) {
  if (request.oldValues && Object.prototype.hasOwnProperty.call(request.oldValues, fieldPath)) {
    return request.oldValues[fieldPath];
  }
  return undefined;
}

getCurrentValue(provider, fieldPath) {
  return rcRead(provider, fieldPath);
}

hasValueChanged(oldVal, newVal) {
  if (oldVal == null || oldVal === undefined) {
    return newVal != null && newVal !== undefined && newVal !== '';
  }
  if (newVal == null || newVal === undefined) {
    return oldVal != null && oldVal !== undefined && oldVal !== '';
  }
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  }
  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  }
  return String(oldVal).trim() !== String(newVal).trim();
}

formatFieldValue(value) {
  if (value == null || value === undefined) {
    return `<em class="empty-value">not provided</em>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `<em class="empty-value">empty list</em>`;
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return `<code class="object-value">object</code>`;
  }
  const str = String(value).trim();
  if (!str) return `<em class="empty-value">empty</em>`;
  if (str.length > 100) {
    return str.substring(0, 100) + ` <span class="truncated">...</span>`;
  }
  return str;
}
    init() {
      console.log('Initializing Admin Console...');
      this.checkAuthAndInit?.(); // your existing auth bootstrap
  
      // These no-op if the section isn't present on the page.
      this.initServiceReviewsSection?.();
      this.initCancellationsSection?.();
      // Initialize Featured Providers section if present
      this.initFeaturedProvidersSection?.();
    }   
  
  // ======================================================================
// SERVICE REVIEWS (admin)
// Containers supported on the page:
//   List:   #service-review-list  (preferred) OR #list (fallback)
//   Filter: .service-review-filters .btn[data-filter]  (data-filter=pending|approved|denied|all)
//   Search: #service-review-search   and #service-review-clear  (optional)
// Each card action:  [data-approve]  [data-deny]
// ======================================================================// === SERVICE REVIEWS (matches dashboard.html selectors) ===
    // ============== SERVICE REVIEWS: bootstrap ==============
    initServiceReviewsSection() {
        // list element on this page
        this._srvListEl = document.getElementById('service-review-list') || document.getElementById('list');
        if (!this._srvListEl) return; // page not showing this section
    
        // start realtime wiring
        this._wireServiceReviews();
    }
    
    // Attach snapshot; if force=true, unsubscribe and rewire
    // Attach snapshot; if force=true, unsubscribe and rewire
    _wireServiceReviews(force=false) {
        const db = firebase.firestore();
        if (force && this._srvUnsub) { try { this._srvUnsub(); } catch(_){} this._srvUnsub = null; }
        if (this._srvUnsub) return;
    
        const q = db.collection('servicereviewrequests');
this._srvUnsub = q.onSnapshot(async snap => {
  const base = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
        // hydrate service doc
        const withSvc = await Promise.all(base.map(async r => {
            let svc = null;
            if (r.serviceId) {
            const s = await db.collection('services').doc(r.serviceId).get();
            if (s.exists) svc = { id: s.id, ...s.data() };
            }
            return { ...r, __svc: svc };
        }));
    
        // gather ids
        const providerIds = withSvc.map(r => r.providerId || r.__svc?.userId || r.__svc?.providerId).filter(Boolean);
        const userIds     = withSvc.map(r => r.userId || r.customerId || r.__svc?.customerId).filter(Boolean);
    
        // fetch parties
        const [providersById, usersById] = await Promise.all([
            this._fetchProvidersByIds(providerIds),
            this._fetchUsersByIds(userIds)
        ]);
    
        // merge readable fields for UI (non-destructive)
        this.serviceReviews = withSvc.map(r => {
            const svc = r.__svc || {};
            const provId = r.providerId || svc.providerId || svc.userId || null;
            const usrId  = r.userId || r.customerId || svc.customerId || null;
    
            const prov = (provId && providersById[provId]) ? providersById[provId] : {};
            const usr  = (usrId && usersById[usrId]) ? usersById[usrId] : {};
    
            const providerName  = r.providerName || prov.fullName || prov.identity?.fullName || [prov.firstName, prov.lastName].filter(Boolean).join(' ') || prov.nameOnId || r.providerEmail || prov.email || '—';
            const providerEmail = r.providerEmail || prov.email || '—';
            const providerPhone = r.providerPhone || prov.phone || '—';
    
            const customerName  = r.customerName || r.userName || usr.fullName || [usr.firstName, usr.lastName].filter(Boolean).join(' ') || usr.name || r.userEmail || usr.email || '—';
            const customerEmail = r.customerEmail || r.userEmail || usr.email || '—';
            const customerPhone = r.customerPhone || r.userPhone || usr.phone || '—';
    
            return {
            ...r,
            __party: {
                providerId: provId,
                providerName, providerEmail, providerPhone,
                userId: usrId,
                customerName, customerEmail, customerPhone
            },
            __keywords: this._extractKeywords(r, svc) 
            };
        });
    
        this.renderServiceReviews();
        this.updateServiceReviewStats();
        }, err => {
        console.error('Service reviews listener error', err);
        this.toast('Error loading service review requests. Check your connection.', 'danger');
        });
    }
    
    // Update the little 3 counters + top tab badge
    updateServiceReviewStats() {
        const all = this.serviceReviews;
        const cPending  = all.filter(r => (r.status||'pending') === 'pending').length;
        const cApproved = all.filter(r => (r.status||'pending') === 'approved').length;
        const cDenied   = all.filter(r => (r.status||'pending') === 'denied').length;
    
        const byId = id => document.getElementById(id);
        byId('srv-count-pending') && (byId('srv-count-pending').textContent = cPending);
        byId('srv-count-approved') && (byId('srv-count-approved').textContent = cApproved);
        byId('srv-count-denied') && (byId('srv-count-denied').textContent = cDenied);
    
        // tab badge shows only pending
        const badge = byId('srv-badge');
        if (badge) {
        if (cPending > 0) { badge.textContent = cPending; badge.style.display = 'inline-block'; }
        else { badge.style.display = 'none'; }
        }
    }
    
    




    // Pretty helpers
    _money(n) { return '₹' + (Number(n||0).toFixed(2)); }
    _esc(s='') { return s.toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    _nl2br(s=''){ return s.replace(/\n/g,'<br>'); }
    _time(v){ try{ return (v?.toDate ? v.toDate() : new Date(v)).toLocaleString(); }catch{ return String(v||'-'); } }
    _statusBadge(st){
        const s = (st||'').toLowerCase();
        if (s === 'approved') return `<span class="badge text-bg-success">Approved</span>`;
        if (s === 'denied')   return `<span class="badge text-bg-danger">Denied</span>`;
        return `<span class="badge text-bg-warning text-dark">Pending</span>`;
    }

    // --- tiny helpers for images/media (place near _money/_esc/_time etc.) ---
    _img(url, alt = '') {
        if (!url) return '';
        // referrerpolicy helps some Storage links; loading=lazy keeps list snappy
        return `<img src="${this._esc(url)}" alt="${this._esc(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
    }

/* ---------- MEDIA & FIELDS EXTRACTORS (REPLACE/ADD) ---------- */
    _mediaFromRequest(r = {}, svc = r.__svc || {}) {
        // cover image (priority: req.imageUrls[0] > req.coverUrl > svc.imageUrls[0] > svc.coverUrl)
        const cover =
        (Array.isArray(r.imageUrls) && r.imageUrls[0]) ||
        r.coverUrl ||
        (Array.isArray(svc.imageUrls) && svc.imageUrls[0]) ||
        svc.coverUrl ||
        (svc.media && svc.media.coverUrl) ||
        null;
    
        // gallery: accept many possible fields
        const galleryCandidates = [
        r.gallery, r.galleryUrls, r.portfolio, r.portfolioUrls, r.images,
        svc.gallery, svc.galleryUrls, svc.portfolio, svc.images
        ];
        let gallery = [];
        for (const g of galleryCandidates) {
        if (Array.isArray(g) && g.length) { gallery = g.filter(Boolean); break; }
        }
    
        // videos: accept field or array on both sides
        const videoOne = r.videoUrl || svc.videoUrl || (r.media && r.media.videoUrl) || (svc.media && svc.media.videoUrl);
        const videosArr = [
        ...(Array.isArray(r.videos) ? r.videos : []),
        ...(Array.isArray(svc.videos) ? svc.videos : [])
        ].filter(Boolean);
        const videos = videosArr.length ? videosArr : (videoOne ? [videoOne] : []);
    
        return { cover, gallery, videos };
    }
    
    /* price from many fields (req + svc) */
    _getServiceBasePrice(r = {}) {
        const svc = r.__svc || {};
        const cands = [
        r.previewPrice, r.basePrice, r.price,
        (Array.isArray(r.variants) && r.variants[0]?.price),
        svc.previewPrice, svc.price,
        (Array.isArray(svc.variants) && svc.variants[0]?.price)
        ];
        for (const c of cands) {
        const n = Number(c);
        if (!Number.isNaN(n) && n > 0) return n;
        }
        return 0;
    }
    
    /* normalize keywords/tags from multiple sources */
    _extractKeywords(r = {}, svc = r.__svc || {}) {
        const buckets = [
        r.keywords, r.tags, r.searchTags,
        svc.keywords, svc.tags, svc.searchTags
        ];
        for (const b of buckets) {
        if (Array.isArray(b) && b.length) return b.map(x => String(x)).filter(Boolean);
        if (typeof b === 'string' && b.trim()) {
            return b.split(/[;,#]/g).map(s => s.trim()).filter(Boolean);
        }
        }
        return [];
    }
    // --- PARTY HYDRATION HELPERS (add once) ---
    async _fetchProvidersByIds(ids = []) {
        const uniq = [...new Set(ids.filter(Boolean))];
        if (!uniq.length) return {};
        const db = firebase.firestore();
        const out = {};
        const byDoc = await Promise.all(
        uniq.map(async id => {
            // try providers/<id>
            const direct = await db.collection('providers').doc(id).get();
            if (direct.exists) { out[id] = { id, ...direct.data() }; return; }
            // fallback providerId == id
            const q = await db.collection('providers').where('providerId', '==', id).limit(1).get();
            if (!q.empty) { out[id] = { id: q.docs[0].id, ...q.docs[0].data() }; }
        })
        );
        return out;
    }
    
    async _fetchUsersByIds(ids = []) {
        const uniq = [...new Set(ids.filter(Boolean))];
        if (!uniq.length) return {};
        const db = firebase.firestore();
        const out = {};
        await Promise.all(
        uniq.map(async id => {
            // support either users/<uid> or customers/<uid>
            const try1 = await db.collection('users').doc(id).get();
            if (try1.exists) { out[id] = { id, ...try1.data() }; return; }
            const try2 = await db.collection('customers').doc(id).get();
            if (try2.exists) { out[id] = { id, ...try2.data() }; }
        })
        );
        return out;
    }

    
// ============== SERVICE REVIEWS: renderer (UI matches cancellation cards) ==============
    renderServiceReviews() {
        const listEl = this._srvListEl;
        if (!listEl) return;
    
        // filter (unchanged)
        let rows = (this.serviceReviewFilter === 'all')
        ? (this.serviceReviews || [])
        : (this.serviceReviews || []).filter(r => (r.status || 'pending') === this.serviceReviewFilter);
    
        // search (unchanged)
        const q = (this.serviceReviewSearch || '').toLowerCase().trim();
        if (q) {
        rows = rows.filter(r => {
            const svc = r.__svc || {};
            const P   = r.__party || {};
            const hay = [
            svc.title, svc.tagline, svc.category, svc.city,
            r.title, r.tagline, r.category, r.city,
            r.providerName, P.providerName, P.providerEmail, P.providerPhone, r.providerEmail, r.providerId,
            P.customerName, P.customerEmail, P.customerPhone, r.userId, r.customerId, r.userEmail,
            r.serviceId, r.id
            ].map(x => (x || '').toString().toLowerCase()).join(' ');
            return hay.includes(q);
        });
        }
    
        // empty state
        listEl.innerHTML = '';
        if (!rows.length) {
        listEl.innerHTML = `<div class="empty-state"><p>No service review requests.</p></div>`;
        this.updateServiceReviewStats?.();
        return;
        }
    
        rows.forEach(r => {
        const svc      = r.__svc || {};
        const P        = r.__party || {};
        const status   = (r.status || 'pending').toLowerCase();
        const submitted= this._time(r.submittedAt);
        const title    = svc.title ?? r.title ?? '(No title)';
        const category = (svc.category ?? r.category ?? '') || '-';
        const city     = (svc.city ?? r.city ?? '') || '-';
    
        const pricePreview = this._getServiceBasePrice?.(r) || 0;
        const media        = this._mediaFromRequest ? this._mediaFromRequest(r, svc) : { cover: '', gallery: [], videos: [] };
        const cover        = media.cover || '';
        const gallery      = Array.isArray(media.gallery) ? media.gallery : [];
        const videos       = Array.isArray(media.videos) ? media.videos : [];
        const keywords     = Array.isArray(r.__keywords) ? r.__keywords : [];
    
        // ---- CARD SHELL (same skeleton as cancellations) ----
        const card = document.createElement('div');
        card.className = 'admin-card enquiry-card mb-3';
    
        card.innerHTML = `
            <div class="card-row">
            <div class="card-col main">
                <div class="title-row">
                ${cover ? `div class="sr-thumb"><img src="${this.esc(cover)}" alt="Cover" onerror="this.style.display='none'; this.onerror=null; this.parentElement.innerHTML='<div class=\\'image-placeholder\\'>📷</div>';"></div>` : ''}
                <h3 class="name">${this._esc(title)}</h3>
                <span class="pill ${status}">${status.toUpperCase()}</span>
                </div>
    
                <div class="sub">
                <span class="mini-label">Provider:</span> ${this._esc(P.providerName || '—')}
                • <span class="mini-label">Category:</span> ${this._esc(category)}
                • <span class="mini-label">City:</span> ${this._esc(city)}
                </div>
    
                <div class="meta">
                <span class="mini-label">Submitted:</span> ${this._esc(submitted || '—')}
                ${pricePreview ? ` • <span class="mini-label">From</span> ${this._money(pricePreview)}` : ''}
                ${r.id ? ` • <span class="mini-label">Request:</span> ${this._esc((r.id || '').slice(0,8))}…` : ''}
                </div>
    
                <!-- slide-down details -->
                <div class="sr-details" style="display:none;">
                <div class="row g-3">
                    <div class="col-12 col-lg-8">
                    ${cover ? `
                        <div class="mb-2">
                        <div class="mini-label">Cover</div>
                        <div class="ratio ratio-16x9 rounded overflow-hidden border">
                            ${this._img ? this._img(cover, 'Cover') : `<img src="${this._esc(cover)}" style="width:100%;height:100%;object-fit:cover">`}
                        </div>
                        </div>` : ''}
    
                    ${(svc.description || r.description) ? `
                        <div class="mb-2">
                        <div class="mini-label">Description</div>
                        <div class="detail-box">${this._nl2br(this._esc(svc.description || r.description || ''))}</div>
                        </div>` : ''}
    
                    ${keywords.length ? `
                        <div class="mb-2">
                        <div class="mini-label">Keywords</div>
                        <div class="d-flex flex-wrap gap-2">
                            ${keywords.map(k => `<span class="badge-tag">${this._esc(k)}</span>`).join('')}
                        </div>
                        </div>` : ''}
    
                    ${gallery.length ? `
                        <div class="mb-2">
                        <div class="mini-label mb-1">Portfolio Gallery</div>
                        <div class="d-flex flex-wrap gap-2">
                            ${gallery.map(u => `
                            <a href="${this._esc(u)}" target="_blank" class="img-thumb">
                                <img src="${this._esc(u)}" alt="gallery" style="width:100%;height:100%;object-fit:cover">
                            </a>`).join('')}
                        </div>
                        </div>` : ''}
    
                    ${videos.length ? `
                        <div class="mb-2">
                        <div class="mini-label">Videos</div>
                        <ul class="list-unstyled mb-0">
                            ${videos.map((v,i) => `
                            <li class="mb-1">• <a href="${this._esc(v)}" target="_blank" rel="noopener">Video ${i+1}</a></li>
                            `).join('')}
                        </ul>
                        </div>` : ''}
                    </div>
    
                    <div class="col-12 col-lg-4">
                    <div class="mb-2">
                        <div class="mini-label">Status</div>
                        <div class="value">${this._statusBadge ? this._statusBadge(status) : `<span class="pill ${status}">${status.toUpperCase()}</span>`}</div>
                    </div>
    
                    <div class="mb-2">
                        <div class="mini-label">Provider</div>
                        <div class="value fw-semibold">${this._esc(P.providerName || '—')}</div>
                        <div class="sub">${this._esc(P.providerEmail || '—')}${P.providerPhone ? ' • ' + this._esc(P.providerPhone) : ''}</div>
                    </div>
    
                    <div class="mb-2">
                        <label class="mini-label mb-1">Message to provider (optional)</label>
                        <textarea class="form-control" rows="2" placeholder="Explain changes or reason…" data-note></textarea>
                    </div>
    
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn outline danger" data-deny>Deny</button>
                        <button class="btn solid success" data-approve>Approve</button>
                    </div>
                    </div>
                </div>
                </div>
            </div>
    
            <!-- Actions column to match cancellations -->
            <div class="card-col actions">
                <button class="btn view" data-view>View Details</button>
                <button class="btn outline danger" data-deny> Deny</button>
                <button class="btn solid success" data-approve>Approve</button>
            </div>
            </div>
        `;
    
        // toggle details (View/Hide) — both top action and side action open the same details
        const detailsEl = card.querySelector('.sr-details');
        const topViewBtn = card.querySelector('.card-col.actions [data-view]');
        const inlineViewBtn = card.querySelector('.sr-summary [data-toggle]'); // if present
    
        const toggleDetails = () => {
            const open = detailsEl.style.display !== 'none';
            detailsEl.style.display = open ? 'none' : 'block';
            if (topViewBtn) topViewBtn.textContent = open ? 'View Details' : 'Hide Details';
        };
        topViewBtn?.addEventListener('click', toggleDetails);
        inlineViewBtn?.addEventListener('click', toggleDetails);
    
        // approve / deny
        const noteEl     = card.querySelector('[data-note]');
        const btnApprove = card.querySelectorAll('[data-approve]');
        const btnDeny    = card.querySelectorAll('[data-deny]');
    
        btnApprove.forEach(btn => btn.addEventListener('click', () => {
            this.decideServiceReview(r, 'approved', (noteEl?.value || '').trim());
        }));
        btnDeny.forEach(btn => btn.addEventListener('click', () => {
            const msg = (noteEl?.value || '').trim() || prompt('Enter a short message for the provider (why denied):', '');
            if (msg === null) return;
            if (!msg.trim()) { this.toast('Please provide a short message when denying.', 'danger'); return; }
            this.decideServiceReview(r, 'denied', msg.trim());
        }));
    
        listEl.appendChild(card);
        });
    
        this.updateServiceReviewStats?.();
    }



    // ============== SERVICE REVIEWS: approve/deny ==============
    async decideServiceReview(it, decision, adminNote) {
    const db = firebase.firestore();
    const FieldVal = firebase.firestore.FieldValue;
    const auth = firebase.auth();

    try {
        // 1) mark the request - USE SET INSTEAD OF UPDATE
        await db.collection('servicereviewrequests').doc(it.id).set({
            status    : decision,
            decidedAt : FieldVal.serverTimestamp(),
            adminNote : adminNote || null,
            serviceId : it.serviceId || null,
            providerId: it.providerId || null,
            submittedAt: it.submittedAt || FieldVal.serverTimestamp()
        }, { merge: true }); 

            // 2) reflect on the service
            if (it.serviceId) {
            const sRef  = db.collection('services').doc(it.serviceId);
            const sSnap = await sRef.get();
            const prev  = sSnap.exists ? sSnap.data() : {};

            const updates = {
                review: {
                ...(prev.review || {}),
                status    : (decision === 'approved') ? 'approved' : 'denied',
                adminNote : adminNote || null,
                decidedAt : FieldVal.serverTimestamp()
                },
                flags: {
                ...(prev.flags || {}),
                adminApproved : (decision === 'approved')
                }
            };

            if (decision === 'approved') {
                updates.published   = true;
                updates.publishedAt = FieldVal.serverTimestamp();
                
                // Apply proposed changes from edit requests
                if (it.proposedData) {
                    const p = it.proposedData;
                    if (p.title       !== undefined) updates.title       = p.title;
                    if (p.tagline     !== undefined) updates.tagline     = p.tagline;
                    if (p.description !== undefined) updates.description = p.description;
                    if (p.highlights  !== undefined) updates.highlights  = p.highlights;
                    if (p.city        !== undefined) updates.city        = p.city;
                    if (p.pricing     !== undefined) updates.pricing     = p.pricing;
                    if (p.tags        !== undefined) updates.tags        = p.tags;
                    if (p.media) {
                        if (p.media.coverUrl  !== undefined) {
                            updates['media.coverUrl']  = p.media.coverUrl;
                            updates.coverUrl = p.media.coverUrl;
                            updates.coverImageUrl = p.media.coverUrl;
                            updates.imageUrl = p.media.coverUrl;
                            updates.serviceImageUrl = p.media.coverUrl;
                        }
                        if (p.media.gallery   !== undefined) {
                            updates['media.gallery']   = p.media.gallery;
                            updates.gallery = p.media.gallery;
                            updates.imageUrls = p.media.gallery;
                            updates.images = p.media.gallery;
                        }
                        if (p.media.promoUrl  !== undefined) {
                            updates['media.promoUrl']  = p.media.promoUrl;
                            updates.videoUrl = p.media.promoUrl;
                            updates.promoUrl = p.media.promoUrl;
                        }
                    }
                }
            } else {
                // keep it unpublished if denied
                updates.published = false;
            }

            await sRef.set(updates, { merge: true });

            // 3) audit log
            // inside decideServiceReview(), after await sRef.set(...):
            await db.collection('admin_service_review_logs').add({
            requestId : it.id,
            serviceId : it.serviceId || it.__svc?.id || null,
            decision  : decision,
            adminNote : adminNote || null,
            adminUid  : firebase.auth().currentUser?.uid || null,
            decidedAt : FieldVal.serverTimestamp(),

            // extra context
            providerId   : it.__party?.providerId || it.providerId || it.__svc?.providerId || null,
            providerName : it.__party?.providerName || it.providerName || null,
            userId       : it.__party?.userId || it.userId || it.customerId || null,
            userName     : it.__party?.customerName || it.userName || it.customerName || null,

            // media & fields snapshot
            amountBase   : this._getServiceBasePrice(it),
            description  : it.description || it.__svc?.description || null,
            keywords     : it.__keywords || [],
            cover        : this._mediaFromRequest(it).cover || null,
            gallery      : this._mediaFromRequest(it).gallery || [],
            videos       : this._mediaFromRequest(it).videos || []
            });
            }

            this.toast(
            decision === 'approved' ? 'Service approved & published' : 'Denied with message sent to provider',
            'success'
            );
        } catch (e) {
            console.error('Service decide error', e);
            this.toast('Failed to update service request.', 'danger');
        }
    }




    // ----- shared helpers as regular methods -----
    toast(msg, variant = 'primary') {
        const container = document.getElementById('toasts') || document.body;
        const el = document.createElement('div');
        el.className = `toast align-items-center text-bg-${variant} border-0 show`;
        el.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${this.esc(msg)}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }
    
    esc(s = '') {
        return s.toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    nl2br(s = '') { return s.replace(/\n/g, '<br>'); }
    money(n) { return '₹' + (Number(n || 0).toFixed(2)); }
    timeTxt(v) {
        try { return (v?.toDate ? v.toDate() : new Date(v)).toLocaleString(); }
        catch { return String(v || '-'); }
    }
    statusBadge(st) {
        const s = (st || '').toLowerCase();
        if (s === 'approved') return `<span class="badge text-bg-success">Approved</span>`;
        if (s === 'denied')   return `<span class="badge text-bg-danger">Denied</span>`;
        return `<span class="badge text-bg-warning text-dark">Pending</span>`;
    }







        /* ===================== HELPERS ===================== */
    moneyINR(n) { return '₹' + (Number(n || 0).toFixed(2)); }
    _getWhen(v) { try { return (v?.toDate ? v.toDate() : new Date(v)); } catch { return null; } }

    /** Treat “customer” and “user” as the same. Always returns 'customer' | 'provider' */
    _getCancellationRole(r) {
    const raw = (r.cancellationBy || r.role || r.requestedBy || r.by || r.byType || r.initiatedBy || '')
        .toString().toLowerCase();

    if (raw.includes('prov') || raw.includes('vend') || raw === 'provider') return 'provider';
    if (raw.includes('user') || raw.includes('cust') || raw === 'customer' || raw === 'user') return 'customer';

    // Heuristics when field is absent
    if (r.providerId && !r.userId) return 'provider';
    if (r.userId && !r.providerId) return 'customer';
    return 'customer';
    }

    /** Try many fields (and nested) to get the base booking amount */
    _getBookingAmount(r) {
    const cands = [
        r.bookingAmount, r.amount, r.total, r.price, r.finalAmount,
        r.quote?.total, r.quote?.grandTotal,
        r.payment?.amount, r.payment?.finalAmount, r.paymentAmount,
        r.pricing?.total, r.pricing?.grandTotal,
        r.feeTotal
    ];
    for (const c of cands) {
        const n = Number(c);
        if (!Number.isNaN(n) && n > 0) return n;
    }
    return 0;
    }

    /** Normalize all fields for clean UI */
/** Normalize all fields for clean UI */
    _normCancel(r) {
        const whenDt = this._getWhen(r.when) || this._getWhen(r.submittedAt) || this._getWhen(r.createdAt);
        const submittedTxt = whenDt ? whenDt.toLocaleString() : '—';
    
        // CUSTOMER (treat “user” as customer)
        const customerName  = r.customerName || r.userName || r.name || r.fullName || r.user?.name || '—';
        const customerEmail = r.customerEmail || r.userEmail || r.email || r.user?.email || '—';
        const customerPhone = r.customerPhone || r.userPhone || r.phone || r.user?.phone || '';
    
        // PROVIDER (different projects label this differently)
        const providerName  = r.providerName || r.vendorName || r.businessName || r.shopName || r.sellerName || r.provider?.name || '—';
        const providerEmail = r.providerEmail || r.vendorEmail || r.businessEmail || r.sellerEmail || r.provider?.email || '—';
        const providerPhone = r.providerPhone || r.vendorPhone || r.businessPhone || r.sellerPhone || r.provider?.phone || '';
    
        // SERVICE / BOOKING
        const serviceTitle  = r.serviceTitle || r.serviceName || r.title || '—';
        const bookingId     = r.bookingId || r.orderId || r.id || '—';
        const reason        = r.reason || r.message || r.note || '—';
        const status        = (r.status || 'pending').toLowerCase();
    
        // who initiated
        const who = this._getCancellationRole(r);
    
        // Amount (robust)
        const base = this._getBookingAmount(r);
    
        // prev status for denial revert (from request or nested booking.cancelRequest)
        const prevStatus =
        r.prevStatus ||
        r.cancelRequest?.prevStatus ||
        r.bookingPrevStatus ||
        r.prevBookingStatus ||
        'ongoing';
    
        return {
            submittedTxt, customerName, customerEmail, customerPhone,
            providerName, providerEmail, providerPhone,
            serviceTitle, bookingId, reason, status, who,
            base, prevStatus,
            // NEW: who’s display name for the chip
            whoName: r.cancelledByName || r.whoName ||
                     (who === 'provider' ? providerName : customerName),
            // NEW: show attachments if present
            evidenceUrls: Array.isArray(r.evidenceUrls) ? r.evidenceUrls
                         : (Array.isArray(r.cancelRequest?.evidenceUrls) ? r.cancelRequest.evidenceUrls : [])
          };
    }

/* ===================== INIT / SNAPSHOT ===================== */
    initCancellationsSection() {
        this._cancelListEl = document.getElementById('cancellations-list');
        if (!this._cancelListEl) return;

        // defaults
        this.cancellationStatus = this.cancellationStatus || 'pending'; // pending|approved|denied|all
        this.cancellationRole   = this.cancellationRole   || 'all';     // all|customer|provider
        this.cancellationSearch = this.cancellationSearch || '';

        // status chips
        document.querySelectorAll('.cancel-filter-tab,.cancellation-filter-tab')?.forEach(btn => {
            btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cancel-filter-tab,.cancellation-filter-tab').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            this.cancellationStatus = e.currentTarget.dataset.status || 'pending';
            this.renderCancellations();
            });
        });

        // role radios (All / Customer / Provider)
        document.querySelectorAll('input[name="cancellation-role"]')?.forEach(r => {
            r.addEventListener('change', (e) => {
            this.cancellationRole = e.target.value; // 'all' | 'customer' | 'provider'
            this.renderCancellations();
            });
        });

        // search
        document.getElementById('search-cancellations')?.addEventListener('input', (e) => {
            this.cancellationSearch = (e.target.value || '').trim().toLowerCase();
            this.renderCancellations();
        });

        // refresh
        document.getElementById('refresh-cancellations-btn')?.addEventListener('click', () => {
            this._wireCancellations(true);
        });

        this._wireCancellations();
    }

    _wireCancellations(force = false) {
        if (force && this._cancelUnsub) { try { this._cancelUnsub(); } catch(_){} this._cancelUnsub = null; }
        if (this._cancelUnsub) return;

        const db = firebase.firestore();
        let qRef = db.collection('cancellation_requests').orderBy('when', 'desc');

        this._cancelUnsub = qRef.onSnapshot(
            (snap) => {
            this.cancellations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderCancellations();
            },
            (err) => {
            console.warn('orderBy `when` failed, retrying with `submittedAt`', err);
            db.collection('cancellation_requests').orderBy('submittedAt','desc').onSnapshot(
                (snap2) => {
                this.cancellations = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                this.renderCancellations();
                },
                (err2) => {
                console.error('Cancellation listener error:', err2);
                this.toast('Error loading cancellations.', 'danger');
                this.renderCancellations();
                }
            );
            }
        );
        }

/* ===================== RENDERER ===================== */
    renderCancellations() {
        const list = document.getElementById('cancellations-list');
        if (!list) return;
    
        const all = Array.isArray(this.cancellations) ? this.cancellations : [];
    
        // stats
        const cPending  = all.filter(x => (x.status || 'pending') === 'pending').length;
        const cApproved = all.filter(x => x.status === 'approved').length;
        const cDenied   = all.filter(x => x.status === 'denied').length;
        const byId = id => document.getElementById(id);
        byId('cancel-total')    && (byId('cancel-total').textContent    = all.length);
        byId('cancel-pending')  && (byId('cancel-pending').textContent  = cPending);
        byId('cancel-approved') && (byId('cancel-approved').textContent = cApproved);
        byId('cancel-denied')   && (byId('cancel-denied').textContent   = cDenied);
        const badge = byId('cancel-badge');
        if (badge) { badge.style.display = cPending ? 'inline-block' : 'none'; badge.textContent = cPending; }
    
        // filters
        const statusWanted = (this.cancellationStatus || 'pending').toLowerCase();
        let rows = statusWanted === 'all'
        ? all.slice()
        : all.filter(r => (r.status || 'pending').toLowerCase() === statusWanted);
    
        if (this.cancellationRole && this.cancellationRole !== 'all') {
        rows = rows.filter(r => this._getCancellationRole(r) === this.cancellationRole);
        }
    
        // search
        const q = (this.cancellationSearch || '').toLowerCase();
        if (q) {
        rows = rows.filter(r => {
            const n = this._normCancel(r);
            const hay = [
            n.bookingId, n.serviceTitle, n.reason, n.customerName, n.customerEmail, n.customerPhone,
            n.providerName, n.providerEmail, n.providerPhone, n.whoName
            ].map(x => (x || '').toString().toLowerCase()).join(' ');
            return hay.includes(q);
        });
        }
    
        // render
        list.innerHTML = '';
        if (!rows.length) {
        list.innerHTML = `<div class="empty-state"><p>No cancellation requests found.</p></div>`;
        return;
        }
    
        rows.forEach(r => {
        const n = this._normCancel(r);
        const amountTxt = this.moneyINR(n.base);
    
        const card = document.createElement('div');
        card.className = 'admin-card cancel-card';
    
        const evidenceHTML = (n.evidenceUrls && n.evidenceUrls.length)
            ? `<div class="evidence-thumbs">
                ${n.evidenceUrls.slice(0,6).map(u => `
                    <a href="${this.esc(u)}" target="_blank" rel="noopener" class="evidence-thumb">
                    <img src="${this.esc(u)}" alt="evidence" onerror="this.style.opacity=0.3;">
                    </a>`).join('')}
            </div>`
            : '';
    
        card.innerHTML = `
            <div class="card-row">
            <div class="card-col main">
                <div class="title-row">
                <h3 class="name">${this.esc(n.serviceTitle)}</h3>
                <span class="pill ${n.status}">${n.status.toUpperCase()}</span>
                </div>
    
                <div class="meta-top">
                <span>Booking <strong>#${this.esc(n.bookingId)}</strong></span>
                <span> • Amount <strong>${amountTxt}</strong></span>
                <span> • Submitted <strong>${this.esc(n.submittedTxt)}</strong></span>
                </div>
    
                <div class="two-col">
                <div class="person-block">
                    <div class="label">Customer</div>
                    <div class="person-name">${this.esc(n.customerName)}</div>
                    <div class="contact-line">
                    <span>${this.esc(n.customerEmail)}</span>
                    ${n.customerPhone ? `<span> • ${this.esc(n.customerPhone)}</span>` : ''}
                    </div>
                </div>
                <div class="person-block">
                    <div class="label">Provider</div>
                    <div class="person-name">${this.esc(n.providerName)}</div>
                    <div class="contact-line">
                    <span>${this.esc(n.providerEmail)}</span>
                    ${n.providerPhone ? `<span> • ${this.esc(n.providerPhone)}</span>` : ''}
                    </div>
                </div>
                </div>
    
                <div class="reason-row">
                <div class="mini-label">Cancelled By</div>
                <div class="chips">
                    <span class="chip who">${this.esc(n.who.toUpperCase())}</span>
                    <span class="chip who-name">${this.esc(n.whoName)}</span>
                </div>
                </div>
    
                <div class="reason-box">
                <div class="mini-label">Reason</div>
                <div class="detail-box">${this.esc(n.reason)}</div>
                </div>
    
                ${evidenceHTML}
            </div>
    
            <div class="card-col actions">
                <button type="button" class="btn view" data-view>View Details</button>
                <button type="button" class="btn outline danger" data-deny>Deny</button>
                <button type="button" class="btn solid success" data-approve>Approve</button>
            </div>
            </div>
        `;
    
        card.querySelector('[data-view]')?.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.openCancellationModal(r);
          });
        card.querySelector('[data-approve]')?.addEventListener('click', () => this._decideFromCard(r, 'approved'));
        card.querySelector('[data-deny]')?.addEventListener('click', () => this._decideFromCard(r, 'denied'));
    
        list.appendChild(card);
        });
    }
/* ===================== MODAL + REFUND CALCULATOR ===================== */
    async openCancellationModal(r) {
        const modal = document.getElementById('cancellation-modal');
        if (!modal) return;
    
        // Normalize for text fields (your _normCancel is fine for labels)
        const n = this._normCancel(r);
    
        // 1) Figure out a base amount.
        //    Try the cancellation record first; if 0, fetch the booking doc.
        let base = this._getBookingAmount(r);
        if (!base && r.bookingId) {
        try {
            const db = firebase.firestore();
            const snap = await db.collection('bookings').doc(r.bookingId).get();
            if (snap.exists) {
            const b = snap.data();
    
            // re-try amount from booking doc
            base = this._getBookingAmount(b);
    
            // OPTIONAL: enrich the UI when missing from request
            if (!n.serviceTitle || n.serviceTitle === '—') {
                const svcTitle = b.serviceTitle || b.serviceName || b.title;
                if (svcTitle) document.getElementById('cancel-det-service').textContent = svcTitle;
            }
            if (!n.customerName || n.customerName === '—') {
                const cName = b.customerName || b.userName || b.name || b.fullName;
                if (cName) document.getElementById('cancel-det-customer').textContent = cName;
            }
            if (!n.providerName || n.providerName === '—') {
                const pName = b.providerName || b.vendorName || b.businessName || b.shopName;
                if (pName) document.getElementById('cancel-det-provider').textContent = pName;
            }
            }
        } catch (e) {
            console.warn('Could not hydrate booking amount from bookings/<id>:', e);
        }
        }
    
        // 2) Fill modal text fields
        document.getElementById('cancel-det-booking').textContent         = n.bookingId;
        document.getElementById('cancel-det-service').textContent         = n.serviceTitle;
        document.getElementById('cancel-det-submitted').textContent       = n.submittedTxt;
    
        document.getElementById('cancel-det-customer').textContent        = n.customerName;
        document.getElementById('cancel-det-email').textContent           = n.customerEmail;
        document.getElementById('cancel-det-phone').textContent           = n.customerPhone || '—';
    
        document.getElementById('cancel-det-provider').textContent        = n.providerName;
        document.getElementById('cancel-det-provider-email').textContent  = n.providerEmail;
        document.getElementById('cancel-det-provider-phone').textContent  = n.providerPhone || '—';
    
        document.getElementById('cancel-det-by').textContent              = n.who.toUpperCase();
        document.getElementById('cancel-det-reason').textContent          = n.reason;
    
        // 3) Refund calculator wiring (dynamic)
        const baseEl = document.getElementById('refund-base');
        const amtEl  = document.getElementById('refund-amount');
        const pInp   = document.getElementById('refund-percent');
        const pRange = document.getElementById('refund-range');
    
        baseEl.textContent = this.moneyINR(base);
    
        const syncRefundUI = () => {
        let p = Math.max(0, Math.min(100, Number(pInp.value || 0)));
        pInp.value   = String(p);
        pRange.value = String(p);
        const refund = (base * p) / 100;
        amtEl.textContent = this.moneyINR(refund);
        };
        pInp.oninput   = syncRefundUI;
        pRange.oninput = (e) => { pInp.value = e.target.value; syncRefundUI(); };
        syncRefundUI();
    
        // 4) Actions (approve/deny) keep your existing decideCancellation flow
        const approve = () => {
        const note = (document.getElementById('cancel-admin-note').value || '').trim();
        const pct  = Math.max(0, Math.min(100, Number(pInp.value || 0)));
        this.decideCancellation(r, 'approved', note, pct);
        modal.classList.remove('show');
        };
        const deny = () => {
        const note = (document.getElementById('cancel-admin-note').value || '').trim();
        this.decideCancellation(r, 'denied', note, 0);
        modal.classList.remove('show');
        };
    
        document.getElementById('cancel-btn-approve').onclick = approve;
        document.getElementById('cancel-btn-deny').onclick    = deny;
        document.getElementById('cancel-modal-close').onclick = () => modal.classList.remove('show');
    
        if (!modal._wireBackdrop) {
        modal._wireBackdrop = true;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
        }
    
        // 5) Finally open the modal
        modal.classList.add('show');
    }

    /* ===================== DECISION WRITE ===================== */
/* ===================== DECISION WRITE (booking update included) ===================== */
    async decideCancellation(it, decision, adminNote, refundPercent) {
        try {
        const db = firebase.firestore();
        const FieldVal = firebase.firestore.FieldValue;
        const user = firebase.auth().currentUser;
        const adminUid  = user?.uid || null;
        const adminName = user?.displayName || user?.email || 'Unknown';
    
        const reqRef = db.collection('cancellation_requests').doc(it.id);
    
        // 1) Read the booking to get prevStatus (fallback to 'ongoing')
        let bookingRef = null, bookingSnap = null, prevStatus = 'ongoing';
        if (it.bookingId) {
            bookingRef = db.collection('bookings').doc(it.bookingId);
            bookingSnap = await bookingRef.get();
            if (bookingSnap.exists) {
            const b = bookingSnap.data();
            prevStatus =
                b?.cancelRequest?.prevStatus ||
                b?.prevStatus ||
                it.prevStatus ||
                'ongoing';
            }
        }
    
        // 2) Update the cancellation request doc
        await reqRef.update({
            status: decision,                      // 'approved' | 'denied'
            decidedAt: FieldVal.serverTimestamp(),
            adminNote: adminNote || null,
            refundPercent: Number(refundPercent || 0),
            adminUid, adminName
        });
    
        // 3) Update booking based on decision
        if (bookingRef) {
            if (decision === 'approved') {
            // Approved → set booking cancelled
            await bookingRef.update({
                status: 'cancelled',
                cancelRequest: {
                ...(bookingSnap?.data()?.cancelRequest || {}),
                status: 'approved',
                decidedAt: FieldVal.serverTimestamp(),
                adminNote: adminNote || null,
                refundPercent: Number(refundPercent || 0),
                decidedBy: { uid: adminUid, name: adminName }
                }
            });
            } else if (decision === 'denied') {
            // Denied → revert to previous status & mark denied
            await bookingRef.update({
                status: prevStatus,
                cancelRequest: {
                ...(bookingSnap?.data()?.cancelRequest || {}),
                status: 'denied',
                decidedAt: FieldVal.serverTimestamp(),
                adminNote: adminNote || null,
                decidedBy: { uid: adminUid, name: adminName }
                },
                // optional UX message for provider/customer UIs to show
                systemMessage: 'Cancellation denied'
            });
            }
        }
    
        // 4) Log decision (audit)
        await db.collection('admin_cancellation_logs').add({
            requestId: it.id,
            bookingId: it.bookingId || null,
            decision,
            refundPercent: Number(refundPercent || 0),
            adminNote: adminNote || null,
            adminUid, adminName,
            decidedAt: FieldVal.serverTimestamp()
        });
    
        // 5) Toast + re-render
        this.toast(decision === 'approved' ? 'Cancellation approved' : 'Cancellation denied', 'success');
        } catch (e) {
        console.error('decideCancellation error', e);
        this.toast('Failed to update cancellation request.', 'danger');
        }
    }





    
    // Enhanced authentication check
    async checkAuthAndInit() {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                console.log('No user logged in, redirecting to login');
                window.location.href = 'index.html';
                return;
            }

            // Verify admin status
            const adminData = await this.verifyAdminAccess(user);
            if (!adminData) {
                console.log('User is not an admin, signing out and redirecting');
                await firebase.auth().signOut();
                window.location.href = 'index.html';
                return;
            }

            // Store admin info
            this.currentAdmin = {
                uid: user.uid,
                email: user.email,
                ...adminData
            };

            console.log('Admin authenticated successfully:', this.currentAdmin);

            // Update UI with admin info
            this.updateAdminWelcome();

            // Initialize dashboard
            this.initEventListeners();
            
            // Load all data
            await Promise.all([
                this.loadProvidersFromFirebase(),
                this.loadEnquiriesFromFirebase(),
                this.loadNotificationsFromFirebase()
            ]);
            
            // Initialize dashboard with saved tab state
            this.initializeTabState();
            this.loadDashboard();
        });
    }



    async verifyAdminAccess(user) {
        try {
            const adminDoc = await db.collection('admin_users').doc(user.uid).get();
            
            if (!adminDoc.exists) {
                console.log('User not found in admin_users collection');
                return null;
            }

            const adminData = adminDoc.data();
            
            if (!adminData.isActive) {
                console.log('Admin account is inactive');
                return null;
            }

            return adminData;

        } catch (error) {
            console.error('Error verifying admin access:', error);
            return null;
        }
    }

    updateAdminWelcome() {
        const welcomeElement = document.querySelector('.admin-welcome');
        if (welcomeElement && this.currentAdmin) {
            welcomeElement.textContent = `Welcome, ${this.currentAdmin.name || this.currentAdmin.email}`;
        }
    }

    // ===== Initialize tab state (now supports 5 tabs) =====
    initializeTabState() {
        const tabIds = [
        'providers-tab',
        'enquiries-tab',
        'notifications-tab',
        'service-reviews-tab',
        'cancellations-tab',
        'featured-providers-tab'
        ];
        const tabs = tabIds
        .map(id => document.getElementById(id))
        .filter(Boolean);
    
        // Clear all active states
        tabs.forEach(tab => tab.classList.remove('active'));
    
        // Figure out which tab should be active
        const validTabs = ['providers','enquiries','notifications','service-reviews','cancellations','featured-providers'];
        if (!validTabs.includes(this.currentTab)) this.currentTab = 'providers';
    
        // Mark active
        const activeTabEl = document.getElementById(`${this.currentTab}-tab`);
        activeTabEl?.classList.add('active');
    
        // Show the right section
        switch (this.currentTab) {
        case 'enquiries':        this.showEnquirySection();        break;
        case 'notifications':    this.showNotificationSection();   break;
        case 'service-reviews':  this.showServiceReviewsSection(); break;
        case 'cancellations':    this.showCancellationsSection();  break;
        case 'featured-providers':this.showFeaturedProvidersSection(); break;
        default:                 this.showProviderSection();       break;
        }
    
        // Keep your existing badges
        this.updateEnquiryBadge?.();
        this.updateServiceReviewsBadge?.();  // optional if you implement
        this.updateCancellationsBadge?.();   // optional if you implement
    }
    
    // ===== Tab switching methods =====
    switchToProviders() {
        this.currentTab = 'providers';
        localStorage.setItem('admin_active_tab', this.currentTab);
    
        // Clear cross-tab search/filter state as you see fit
        this.enquirySearchTerm = '';
        this.currentEnquiryFilter = 'all';
    
        // Activate tab UI
        ['providers','enquiries','notifications','service-reviews','cancellations']
        .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
        document.getElementById('providers-tab')?.classList.add('active');
    
        this.showProviderSection();
        this.updateStats?.();
        this.renderProviders?.();
    
        this.logAdminAction?.('switch_to_providers', null, { timestamp: new Date() });
    }
    
    switchToEnquiries() {
        this.currentTab = 'enquiries';
        localStorage.setItem('admin_active_tab', this.currentTab);
    
        this.searchTerm = '';
        this.currentFilter = 'all';
    
        ['providers','enquiries','notifications','service-reviews','cancellations']
        .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
        document.getElementById('enquiries-tab')?.classList.add('active');
    
        this.showEnquirySection();
        this.updateStats?.();
        this.renderEnquiries?.();
    
        this.logAdminAction?.('switch_to_enquiries', null, { timestamp: new Date() });
    }
    
    switchToNotifications() {
        this.currentTab = 'notifications';
        localStorage.setItem('admin_active_tab', this.currentTab);
    
        this.searchTerm = '';
        this.currentFilter = 'all';
        this.enquirySearchTerm = '';
        this.currentEnquiryFilter = 'all';
    
        ['providers','enquiries','notifications','service-reviews','cancellations']
        .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
        document.getElementById('notifications-tab')?.classList.add('active');
    
        this.showNotificationSection();
        this.updateStats?.();
        this.renderNotificationHistory?.();
    
        this.logAdminAction?.('switch_to_notifications', null, { timestamp: new Date() });
    }
    
    // NEW  
    switchToServiceReviews() {
        this.currentTab = 'service-reviews';
        localStorage.setItem('admin_active_tab', this.currentTab);
    
        ['providers','enquiries','notifications','service-reviews','cancellations']
        .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
        document.getElementById('service-reviews-tab')?.classList.add('active');
    
        this.showServiceReviewsSection();
        this.renderServiceReviews?.();   // implement in your renderer
    
        this.logAdminAction?.('switch_to_service_reviews', null, { timestamp: new Date() });
    }
    
    // NEW
    switchToCancellations() {
        this.currentTab = 'cancellations';
        localStorage.setItem('admin_active_tab', this.currentTab);
    
        ['providers','enquiries','notifications','service-reviews','cancellations']
        .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
        document.getElementById('cancellations-tab')?.classList.add('active');
    
        this.showCancellationsSection();
        this.renderCancellations?.();    // implement in your renderer
    
        this.logAdminAction?.('switch_to_cancellations', null, { timestamp: new Date() });
    }
    



    // ===== Section display helpers =====
    showProviderSection() {
        this.showOnlySection('provider-section');
        this.showOnlyStats('provider-stats');
    }
    showEnquirySection() {
        this.showOnlySection('enquiry-section');
        this.showOnlyStats('enquiry-stats');
    }
    showNotificationSection() {
        this.showOnlySection('notification-section');
        this.showOnlyStats('notification-stats');
    }
    // NEW
    showServiceReviewsSection() {
        this.showOnlySection('service-review-section');
        this.showOnlyStats('service-review-stats');
    }
    // NEW
    showCancellationsSection() {
        this.showOnlySection('cancellations-section');
        this.showOnlyStats('cancellation-stats');
    }
    
    // Private helpers to reduce repetition
    showOnlySection(idToShow) {
        const ids = [
        'provider-section',
        'enquiry-section',
        'notification-section',
        'service-review-section',
        'cancellations-section',
        'featured-providers-section'
        ];
        ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (id === idToShow) ? 'block' : 'none';
        });
    }
    showOnlyStats(idToShow) {
        const ids = [
        'provider-stats',
        'enquiry-stats',
        'notification-stats',
        'service-review-stats',
        'cancellation-stats',
        'featured-providers-section'
        ];
        ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (id === idToShow) ? 'grid' : 'none';
        });
    }










    // NEW: Load notifications from Firebase
    async loadNotificationsFromFirebase() {
        try {
            console.log('Loading notifications from Firebase...');
            
            // Query admin_notifications collection
            const querySnapshot = await db.collection("admin_notifications")
                .orderBy("sentAt", "desc")
                .limit(50) // Load last 50 notifications
                .get();
            
            this.notifications = [];
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                
                const notification = {
                    id: doc.id,
                    title: data.title || '',
                    message: data.message || '',
                    topic: data.topic || 'all-users',
                    sentBy: data.sentBy || '',
                    sentByName: data.sentByName || 'Admin',
                    sentAt: data.sentAt?.toDate() || new Date(),
                    recipientCount: data.recipientCount || 0,
                    status: data.status || 'sent'
                };
                
                this.notifications.push(notification);
            });
            
            console.log(`Successfully loaded ${this.notifications.length} notifications from Firebase`);
            
        } catch (error) {
            console.error('Error loading notifications from Firebase:', error);
            this.notifications = [];
        }
    }

    // NEW: Send push notification
    async sendPushNotification() {
        const title = document.getElementById('notification-title').value.trim();
        const message = document.getElementById('notification-message').value.trim();
        const target = this.selectedTarget;

        if (!title || !message) {
            alert('Please fill in both title and message.');
            return;
        }

        try {
            // Create notification document
            const notificationData = {
                title: title,
                message: message,
                topic: target,
                sentBy: this.currentAdmin.uid,
                sentByName: this.currentAdmin.name || this.currentAdmin.email,
                sentAt: firebase.firestore.FieldValue.serverTimestamp(),
                recipientCount: this.getEstimatedRecipientCount(target),
                status: 'sending'
            };

            // Add to Firestore first
            const docRef = await db.collection('admin_notifications').add(notificationData);
            
            // Send via Firebase Cloud Messaging
            const success = await this.sendToFirebaseTopic(target, title, message);
            
            if (success) {
                // Update status to sent
                await db.collection('admin_notifications').doc(docRef.id).update({
                    status: 'sent'
                });

                // Log admin action
                await this.logAdminAction('send_push_notification', docRef.id, {
                    title: title,
                    message: message,
                    target: target,
                    recipientCount: notificationData.recipientCount,
                    timestamp: new Date()
                });

                // Update local notifications array
                const newNotification = {
                    id: docRef.id,
                    ...notificationData,
                    sentAt: new Date(),
                    status: 'sent'
                };
                this.notifications.unshift(newNotification);

                // Clear form
                this.clearNotificationForm();
                
                // Update UI
                this.updateStats();
                this.renderNotificationHistory();
                
                this.showSuccessMessage(`Notification sent successfully to ${this.getTargetDisplayName(target)}!`);
            } else {
                // Update status to failed
                await db.collection('admin_notifications').doc(docRef.id).update({
                    status: 'failed'
                });
                
                throw new Error('Failed to send notification via Firebase Cloud Messaging');
            }

        } catch (error) {
            console.error('Error sending push notification:', error);
            alert('Error sending notification. Please try again.');
        }
    }

    // Replace the existing sendToFirebaseTopic method with this
    async sendToFirebaseTopic(topic, title, message) {
        try {
            console.log('📞 Calling Firebase Cloud Function for push notification...');
            console.log('📊 Request data:', { topic, title, message });

            // Get the callable function
            const functions = firebase.functions();
            const sendPushNotification = functions.httpsCallable('sendPushNotification');
            
            // Call the function with notification data
            const result = await sendPushNotification({
                topic: topic,
                title: title,
                message: message
            });

            console.log('✅ Cloud Function Response:', result.data);
            
            if (result.data.success) {
                console.log(`🎉 Notification sent successfully! Message ID: ${result.data.messageId}`);
                return true;
            } else {
                console.error('❌ Cloud Function returned unsuccessful response');
                return false;
            }

        } catch (error) {
            console.error('❌ Error calling sendPushNotification function:', error);
            
            // Handle specific error types with user-friendly messages
            let errorMessage = 'Failed to send notification. ';
            
            switch (error.code) {
                case 'unauthenticated':
                    errorMessage += 'Please log out and log back in.';
                    break;
                case 'permission-denied':
                    errorMessage += 'Admin access required.';
                    break;
                case 'invalid-argument':
                    errorMessage += 'Invalid notification data provided.';
                    break;
                case 'internal':
                    errorMessage += 'Server error occurred. Please try again.';
                    break;
                default:
                    errorMessage += error.message || 'Unknown error occurred.';
            }
            
            alert(errorMessage);
            return false;
        }
    }

    // NEW: Get estimated recipient count
    getEstimatedRecipientCount(target) {
        switch (target) {
            case 'providers':
                return this.providers.filter(p => p.approvalStatus === 'approved').length;
            case 'customers':
                // Estimate based on enquiries (rough approximation)
                return Math.max(this.enquiries.length * 2, 50);
            case 'all-users':
                return this.providers.filter(p => p.approvalStatus === 'approved').length + Math.max(this.enquiries.length * 2, 50);
            default:
                return 0;
        }
    }

    // NEW: Get target display name
    getTargetDisplayName(target) {
        const names = {
            'all-users': 'All Users',
            'customers': 'Customers',
            'providers': 'Providers'
        };
        return names[target] || target;
    }

    // NEW: Show notification confirmation modal
    showNotificationConfirmModal() {
        const title = document.getElementById('notification-title').value.trim();
        const message = document.getElementById('notification-message').value.trim();
        const target = this.selectedTarget;

        if (!title || !message) {
            alert('Please fill in both title and message.');
            return;
        }

        // Update confirmation modal
        document.getElementById('confirm-target').textContent = this.getTargetDisplayName(target);
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        // Show modal
        document.getElementById('notification-confirm-modal').style.display = 'flex';
    }

    // NEW: Clear notification form
    clearNotificationForm() {
        document.getElementById('notification-title').value = '';
        document.getElementById('notification-message').value = '';
        this.updateCharCounters();
        this.updateSendButton();
    }

    // NEW: Update character counters
    updateCharCounters() {
        const titleInput = document.getElementById('notification-title');
        const messageInput = document.getElementById('notification-message');
        const titleCounter = document.getElementById('title-counter');
        const messageCounter = document.getElementById('message-counter');

        titleCounter.textContent = titleInput.value.length;
        messageCounter.textContent = messageInput.value.length;
    }

    // NEW: Update send button state
    updateSendButton() {
        const titleInput = document.getElementById('notification-title');
        const messageInput = document.getElementById('notification-message');
        const sendButton = document.getElementById('send-notification-btn');

        const hasTitle = titleInput.value.trim().length > 0;
        const hasMessage = messageInput.value.trim().length > 0;

        sendButton.disabled = !(hasTitle && hasMessage);
    }

    // NEW: Handle target selection
    handleTargetSelection(target) {
        this.selectedTarget = target;

        // Update UI
        document.querySelectorAll('.target-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-target="${target}"]`).classList.add('active');
    }

    // NEW: Create notification history item
    createNotificationHistoryItem(notification) {
        const item = document.createElement('div');
        item.className = 'history-item';

        const timeAgo = this.getTimeAgo(notification.sentAt);
        const statusClass = notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'error' : 'pending';
        
        item.innerHTML = `
            <div class="history-header">
                <div class="history-info">
                    <h4 class="history-title">${notification.title}</h4>
                    <p class="history-message">${notification.message}</p>
                </div>
                <div class="history-meta">
                    <span class="history-status ${statusClass}">${notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}</span>
                    <span class="history-time">${timeAgo}</span>
                </div>
            </div>
            <div class="history-details">
                <div class="history-detail">
                    <span class="detail-label">Target:</span>
                    <span class="detail-value">${this.getTargetDisplayName(notification.topic)}</span>
                </div>
                <div class="history-detail">
                    <span class="detail-label">Sent by:</span>
                    <span class="detail-value">${notification.sentByName}</span>
                </div>
                <div class="history-detail">
                    <span class="detail-label">Recipients:</span>
                    <span class="detail-value">~${notification.recipientCount} users</span>
                </div>
            </div>
        `;

        return item;
    }

    // NEW: Render notification history
    renderNotificationHistory() {
        const container = document.getElementById('notifications-history-container');
        const loadingState = document.getElementById('notifications-history-loading');
        const emptyState = document.getElementById('notifications-history-empty');

        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        container.innerHTML = '';

        // Filter notifications based on history filter
        const filter = document.getElementById('history-filter').value;
        let filteredNotifications = this.notifications;

        if (filter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            filteredNotifications = this.notifications.filter(notification => {
                const sentDate = notification.sentAt;
                
                switch (filter) {
                    case 'today':
                        return sentDate >= today;
                    case 'week':
                        return sentDate >= weekAgo;
                    case 'month':
                        return sentDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        if (filteredNotifications.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        filteredNotifications.forEach(notification => {
            const historyItem = this.createNotificationHistoryItem(notification);
            container.appendChild(historyItem);
        });
    }

    // NEW: Refresh notifications
    async refreshNotifications() {
        await this.loadNotificationsFromFirebase();
        this.updateStats();
        this.renderNotificationHistory();
        this.showSuccessMessage('Notification history refreshed successfully!');
    }

    // Load enquiries from Firebase (EXISTING - UNCHANGED)
   async loadEnquiriesFromFirebase() {
  const loadingState = document.getElementById('enquiries-loading-state');
  if (loadingState) loadingState.style.display = 'block';
  try {
    const snap = await db.collection("enquiries").get(); // no orderBy
    this.enquiries = [];
    let newCount = 0;

    const parse = this.parseTimestamp?.bind(this) || (x => x?.toDate?.() || (typeof x==='number'?new Date(x): (typeof x==='string'?new Date(x): null)));

    snap.forEach(doc => {
      const data = doc.data() || {};
      const createdAt = parse(data.createdAt) || parse(data.updatedAt) || new Date(0);
      const updatedAt = parse(data.updatedAt) || createdAt;

      const enquiry = {
        id: doc.id,
        packageId: data.packageId || '',
        packageName: data.packageName || 'Unknown Package',
        selectedTier: data.selectedTier || 'silver',
        tierPrice: data.tierPrice || 0,
        customerName: data.customerName || 'Unknown Customer',
        customerPhone: data.customerPhone || '',
        customerEmail: data.customerEmail || '',
        userId: data.userId || '',
        status: data.status || 'new',
        assignedAdmin: data.assignedAdmin || null,
        contactedAt: parse(data.contactedAt),
        createdAt, updatedAt,
        source: data.source || 'unknown'
      };

      if (enquiry.status === 'new') newCount++;
      this.enquiries.push(enquiry);
    });

    // local sort newest first
    this.enquiries.sort((a,b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));

    const prev = this.newEnquiryCount;
    this.newEnquiryCount = newCount;
    if (newCount > prev && prev > 0) this.animateEnquiryBadge?.();

    this.renderEnquiries?.();
  } catch (e) {
    console.error('Error loading enquiries from Firebase:', e);
    this.enquiries = [];
  } finally {
    if (loadingState) loadingState.style.display = 'none';
  }
}

    // Helper method to handle different timestamp formats (EXISTING - UNCHANGED)
    parseTimestamp(timestamp) {
        if (!timestamp) return null;
        
        // If it's already a JavaScript Date
        if (timestamp instanceof Date) {
            return timestamp;
        }
        
        // If it's a Firebase Timestamp (has toDate method)
        if (timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        
        // If it's a string, try to parse it
        if (typeof timestamp === 'string') {
            const parsed = new Date(timestamp);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        
        // If it's a number (Unix timestamp in milliseconds)
        if (typeof timestamp === 'number') {
            return new Date(timestamp);
        }
        
        // If it's a Firestore Timestamp object (but not recognized above)
        if (timestamp && timestamp.seconds) {
            return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
        }
        
        console.warn('Unknown timestamp format:', timestamp);
        return null;
    }

    // Update enquiry notification badge (EXISTING - UNCHANGED)
    updateEnquiryBadge() {
        const badge = document.getElementById('enquiry-badge');
        if (this.newEnquiryCount > 0) {
            badge.textContent = this.newEnquiryCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Animate badge when new enquiries arrive (EXISTING - UNCHANGED)
    animateEnquiryBadge() {
        const badge = document.getElementById('enquiry-badge');
        badge.classList.add('badge-pulse');
        setTimeout(() => {
            badge.classList.remove('badge-pulse');
        }, 2000);
    }

    // Create enquiry card (EXISTING - UNCHANGED)
    createEnquiryCard(enquiry) {
        const card = document.createElement('div');
        card.className = 'enquiry-card';
        card.onclick = () => this.showEnquiryModal(enquiry);
        
        const statusClass = `status-${enquiry.status}`;
        const statusText = this.getStatusDisplayText(enquiry.status);
        
        // Format price in Indian format
        const formattedPrice = this.formatIndianPrice(enquiry.tierPrice);
        
        // Create tier badge
        const tierBadge = this.createTierBadge(enquiry.selectedTier);
        
        // Calculate time ago
        const timeAgo = this.getTimeAgo(enquiry.createdAt);
        
        // Get admin name if assigned
        const assignedAdminText = enquiry.assignedAdmin 
            ? (enquiry.assignedAdmin === this.currentAdmin.uid ? 'You' : 'Admin')
            : 'Unassigned';
        
        card.innerHTML = `
            <div class="enquiry-header">
                <div class="enquiry-info">
                    <h3>${enquiry.customerName}</h3>
                    <div class="enquiry-email">${enquiry.customerEmail}</div>
                    <div class="enquiry-phone">${enquiry.customerPhone}</div>
                </div>
                <div class="enquiry-badges">
                    <div class="enquiry-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            </div>
            
            <div class="enquiry-details">
                <div class="detail-item">
                    <span class="detail-label">Package:</span>
                    <span class="detail-value">${enquiry.packageName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tier:</span>
                    <span class="detail-value">${tierBadge}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Price:</span>
                    <span class="detail-value">${formattedPrice}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Assigned:</span>
                    <span class="detail-value">${assignedAdminText}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Submitted:</span>
                    <span class="detail-value">${timeAgo}</span>
                </div>
            </div>
            
            <div class="enquiry-actions">
                <button class="action-btn view-btn" onclick="event.stopPropagation(); adminDashboard.showEnquiryModal(adminDashboard.enquiries.find(e => e.id === '${enquiry.id}'))">
                    View Details
                </button>
                ${enquiry.status === 'new' ? `
                    <button class="action-btn contacted-btn" onclick="event.stopPropagation(); adminDashboard.quickMarkContacted('${enquiry.id}')">
                        Mark Contacted
                    </button>
                ` : ''}
            </div>
        `;
        
        return card;
    }

    // Show enquiry details modal (EXISTING - UNCHANGED)
    showEnquiryModal(enquiry) {
        this.currentEnquiry = enquiry;
        
        const modal = document.getElementById('enquiry-modal');
        const detailsContainer = document.getElementById('enquiry-details');
        
        // Format price
        const formattedPrice = this.formatIndianPrice(enquiry.tierPrice);
        
        // Create tier badge
        const tierBadge = this.createTierBadge(enquiry.selectedTier, true);
        
        // Format dates
        const submittedDate = enquiry.createdAt.toLocaleDateString() + ' ' + enquiry.createdAt.toLocaleTimeString();
        const updatedDate = enquiry.updatedAt.toLocaleDateString() + ' ' + enquiry.updatedAt.toLocaleTimeString();
        
        // Contacted info
        const contactedInfo = enquiry.contactedAt ? `
            <div class="detail-item">
                <span class="detail-label">Contacted At:</span>
                <span class="detail-value">${enquiry.contactedAt.toLocaleDateString()} ${enquiry.contactedAt.toLocaleTimeString()}</span>
            </div>
        ` : '';
        
        // Assigned admin info
        const assignedAdminInfo = enquiry.assignedAdmin ? `
            <div class="detail-item">
                <span class="detail-label">Assigned Admin:</span>
                <span class="detail-value">${enquiry.assignedAdmin === this.currentAdmin.uid ? 'You' : 'Admin'}</span>
            </div>
        ` : '';
        
        detailsContainer.innerHTML = `
            <div class="enquiry-details-content">
                <div class="detail-section">
                    <h4>Customer Information</h4>
                    <div class="detail-item">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${enquiry.customerName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${enquiry.customerEmail}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${enquiry.customerPhone}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Service Information</h4>
                    <div class="detail-item">
                        <span class="detail-label">Package:</span>
                        <span class="detail-value">${enquiry.packageName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Selected Tier:</span>
                        <span class="detail-value">${tierBadge}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Price:</span>
                        <span class="detail-value">${formattedPrice}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Package ID:</span>
                        <span class="detail-value">${enquiry.packageId}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Status & Tracking</h4>
                    <div class="detail-item">
                        <span class="detail-label">Current Status:</span>
                        <span class="detail-value enquiry-status status-${enquiry.status}">
                            ${this.getStatusDisplayText(enquiry.status)}
                        </span>
                    </div>
                    ${assignedAdminInfo}
                    ${contactedInfo}
                    <div class="detail-item">
                        <span class="detail-label">Submitted:</span>
                        <span class="detail-value">${submittedDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Updated:</span>
                        <span class="detail-value">${updatedDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Source:</span>
                        <span class="detail-value">${enquiry.source}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Update Status</h4>
                    <div class="status-update-section">
                        <label for="enquiry-status-select">Change Status:</label>
                        <select id="enquiry-status-select" class="status-select">
                            <option value="new" ${enquiry.status === 'new' ? 'selected' : ''}>New</option>
                            <option value="contacted" ${enquiry.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                            <option value="quoted" ${enquiry.status === 'quoted' ? 'selected' : ''}>Quoted</option>
                            <option value="converted" ${enquiry.status === 'converted' ? 'selected' : ''}>Converted</option>
                            <option value="closed" ${enquiry.status === 'closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    }


            // ────────── NEW: FEATURED PROVIDERS MANAGEMENT ──────────────────────────────────────
        initFeaturedProvidersSection() {
            // Check if featured providers section exists
            this.featuredSlotsEl = document.getElementById('featured-slots');
            if (!this.featuredSlotsEl) return; // Section not present on page

            console.log('🌟 Initializing Featured Providers section...');
            
            // Initialize week navigation
            this.updateWeekDisplay();
            this.initWeekNavigation();
            
            // Initialize provider search and filtering
            this.initProviderSearch();
            
            // Wire Firestore listeners
            this.wireFeaturedProviders();
            
            // Load available providers
            this.loadAvailableProviders();
        }

        // Week management functions
        getCurrentWeekData() {
            const now = new Date();
            const monday = new Date(now.setDate(now.getDate() - now.getDay() + 1));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            return {
                start: monday,
                end: sunday,
                id: `week-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
            };
        }

        updateWeekDisplay() {
            const titleEl = document.getElementById('current-week-title');
            const statusEl = document.getElementById('current-week-status');
            
            if (titleEl) {
                const startStr = this.currentWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const endStr = this.currentWeek.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                titleEl.textContent = `Week of ${startStr} - ${endStr}`;
            }
            
            if (statusEl) {
                const count = this.featuredProviders.length;
                statusEl.textContent = `${count}/3 providers selected`;
                statusEl.className = `week-status ${count === 3 ? 'complete' : count > 0 ? 'partial' : ''}`;
            }
        }

        initWeekNavigation() {
            // Previous week button
            document.getElementById('prev-week-btn')?.addEventListener('click', () => {
                this.navigateWeek(-1);
            });
            
            // Next week button  
            document.getElementById('next-week-btn')?.addEventListener('click', () => {
                this.navigateWeek(1);
            });
            
            // Copy previous week
            document.getElementById('copy-previous-week-btn')?.addEventListener('click', () => {
                this.copyPreviousWeek();
            });
            
            // Clear all selections
            document.getElementById('clear-week-btn')?.addEventListener('click', () => {
                this.clearWeekSelections();
            });
            
            // Save changes
            document.getElementById('save-featured-btn')?.addEventListener('click', () => {
                this.saveFeaturedProviders();
            });
        }

        navigateWeek(direction) {
            // Move current week by direction (-1 for previous, +1 for next)
            this.currentWeek.start.setDate(this.currentWeek.start.getDate() + (direction * 7));
            this.currentWeek.end.setDate(this.currentWeek.end.getDate() + (direction * 7));
            this.currentWeek.id = `week-${this.currentWeek.start.getFullYear()}-${String(this.currentWeek.start.getMonth() + 1).padStart(2, '0')}-${String(this.currentWeek.start.getDate()).padStart(2, '0')}`;
            
            this.updateWeekDisplay();
            this.loadFeaturedProvidersForWeek();
        }

        // Provider search and filtering
        initProviderSearch() {
            // Category filter tabs
            document.querySelectorAll('.filter-tab')?.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.featuredProviderFilter = e.currentTarget.dataset.category || 'all';
                    this.renderAvailableProviders();
                });
            });
            
            // Search input
            document.getElementById('search-featured-providers')?.addEventListener('input', (e) => {
                this.featuredProviderSearch = e.target.value.toLowerCase().trim();
                this.renderAvailableProviders();
            });
            
            // Refresh providers
            document.getElementById('refresh-providers')?.addEventListener('click', async () => {
  await this.loadProvidersFromFirebase(); // no orderBy version
  this.updateStats?.();
});
            
            // Slot click handlers
            document.querySelectorAll('.featured-slot').forEach(slot => {
                slot.addEventListener('click', (e) => {
                    if (e.target.closest('.clear-slot-btn')) return; // Don't select if clicking clear button
                    
                    const slotNumber = parseInt(slot.dataset.slot);
                    this.selectSlot(slotNumber);
                });
            });
        }

        // Firestore integration
        async wireFeaturedProviders(force = false) {
            if (force && this.featuredUnsub) {
                try { this.featuredUnsub(); } catch {}
                this.featuredUnsub = null;
            }
            
            if (this.featuredUnsub) return;
            
            const db = firebase.firestore();
            const docRef = db.collection('featuredProviders').doc(this.currentWeek.id);
            
            this.featuredUnsub = docRef.onSnapshot(async (doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    this.featuredProviders = data.providers || [];
                } else {
                    this.featuredProviders = [];
                }
                
                this.renderFeaturedSlots();
                this.updateWeekDisplay();
                this.updateFeaturedStats();
            }, (err) => {
                console.error('Featured providers listener error:', err);
            });
        }

        async loadAvailableProviders() {
    try {
        console.log('📋 Loading available providers...');
        
        const db = firebase.firestore();
        const snapshot = await db.collection('providers')
            .where('status', '==', 'approved') // Use 'status' not 'approvalStatus'
            .get();
        
        console.log(`📊 Approved providers query returned: ${snapshot.size} providers`);
        
        this.availableProviders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Basic validation - must have name
            if (data.fullName || (data.firstName && data.lastName)) {
                this.availableProviders.push({
                    id: doc.id,
                    ...data,
                    docId: doc.id
                });
            }
        });
        
        console.log(`✅ Loaded ${this.availableProviders.length} approved providers for featured selection`);
        this.renderAvailableProviders();
        
    } catch (error) {
        console.error('❌ Error loading available providers:', error);
        this.toast('Error loading providers. Please try again.', 'danger');
    }
}



        async loadFeaturedProvidersForWeek() {
            try {
                const db = firebase.firestore();
                const doc = await db.collection('featuredProviders').doc(this.currentWeek.id).get();
                
                if (doc.exists) {
                    const data = doc.data();
                    this.featuredProviders = data.providers || [];
                } else {
                    this.featuredProviders = [];
                }
                
                this.renderFeaturedSlots();
                this.updateWeekDisplay();
                this.updateFeaturedStats();
                
            } catch (error) {
                console.error('Error loading featured providers for week:', error);
                this.toast('Error loading featured providers.', 'danger');
            }
        }

        // UI Rendering
        renderFeaturedSlots() {
            for (let slot = 1; slot <= 3; slot++) {
                const slotEl = document.querySelector(`.featured-slot[data-slot="${slot}"]`);
                if (!slotEl) continue;
                
                const contentEl = slotEl.querySelector('.slot-content');
                const clearBtn = slotEl.querySelector('.clear-slot-btn');
                
                const provider = this.featuredProviders.find(p => p.priority === slot);
                
                if (provider) {
    // Show provider in slot
    contentEl.className = 'slot-content filled';
    
    const name = provider.name || provider.fullName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
    const category = provider.category || [provider.profile?.primaryDomain, provider.profile?.mediaSpecialization].filter(Boolean).join(', ') || 'Service Provider';
    const location = provider.location || provider.identity?.city || provider.city || 'Location not specified';
    
    contentEl.innerHTML = `
        <div class="featured-provider-card">
            ${provider.profileImage ? 
                `<img src="${this.esc(provider.profileImage)}" alt="${this.esc(name)}" class="featured-avatar">` : 
                `<div class="featured-avatar placeholder">👤</div>`
            }
            <div class="featured-info">
                <h4>${this.esc(name)}</h4>
                <div class="featured-category">${this.esc(category)}</div>
                <div class="featured-location">📍 ${this.esc(location)}</div>
                ${provider.rating ? `<div class="provider-rating">⭐ ${provider.rating}</div>` : ''}
            </div>
        </div>
    `;
    clearBtn.style.display = 'block';
    clearBtn.onclick = () => this.removeFromSlot(slot);
}
                
                else {
                    // Show empty slot
                    contentEl.className = 'slot-content empty';
                    contentEl.innerHTML = `
                        <div class="empty-slot">
                            <span class="empty-icon">+</span>
                            <span class="empty-text">Select Provider</span>
                        </div>
                    `;
                    clearBtn.style.display = 'none';
                }
            }
            
            // Update counter
            const counterEl = document.getElementById('featured-count');
            if (counterEl) {
                counterEl.textContent = this.featuredProviders.length;
            }
        }

        renderAvailableProviders() {
    console.log('🎨 Starting renderAvailableProviders...');
    console.log(`📊 this.availableProviders.length: ${this.availableProviders.length}`);
    
    const container = document.getElementById('available-providers-container');
    const loadingEl = document.getElementById('available-providers-loading');
    const emptyEl = document.getElementById('available-providers-empty');
    
    console.log('🔍 DOM elements check:');
    console.log('- container:', container);
    console.log('- loadingEl:', loadingEl);
    console.log('- emptyEl:', emptyEl);
    
    if (!container) {
        console.error('❌ available-providers-container not found!');
        return;
    }
    
    // Filter providers
    let filtered = this.availableProviders.slice();
    console.log(`🔍 Starting with ${filtered.length} providers before filtering`);
    
    // Category filter
    if (this.featuredProviderFilter !== 'all') {
        const beforeFilter = filtered.length;
        filtered = filtered.filter(provider => {
            const category = (provider.category || '').toLowerCase();
            const serviceTypes = (provider.serviceTypes || []).join(' ').toLowerCase();
            
            if (this.featuredProviderFilter === 'media') {
                return category.includes('photo') || category.includes('video') || category.includes('drone') ||
                       serviceTypes.includes('photo') || serviceTypes.includes('video') || serviceTypes.includes('drone');
            } else if (this.featuredProviderFilter === 'tech') {
                return category.includes('web') || category.includes('digital') || category.includes('ui') || category.includes('ux') ||
                       serviceTypes.includes('web') || serviceTypes.includes('digital') || serviceTypes.includes('ui');
            }
            return true;
        });
        console.log(`🔍 Category filter (${this.featuredProviderFilter}): ${beforeFilter} → ${filtered.length}`);
    }
    
    // Search filter
    if (this.featuredProviderSearch) {
        const beforeSearch = filtered.length;
        filtered = filtered.filter(provider => {
            const searchStr = [
                provider.name || '',
                provider.firstName || '',
                provider.lastName || '',
                provider.email || '',
                provider.cityOfOperation || '',
                provider.category || '',
                (provider.serviceTypes || []).join(' ')
            ].join(' ').toLowerCase();
            
            return searchStr.includes(this.featuredProviderSearch);
        });
        console.log(`🔍 Search filter ("${this.featuredProviderSearch}"): ${beforeSearch} → ${filtered.length}`);
    }
    
    // Remove already selected providers
    const selectedIds = this.featuredProviders.map(p => p.providerId);
    const beforeSelected = filtered.length;
    filtered = filtered.filter(provider => !selectedIds.includes(provider.id));
    console.log(`🔍 Remove selected filter: ${beforeSelected} → ${filtered.length}`);
    console.log('🔍 Selected IDs to exclude:', selectedIds);
    
    // Render
    container.innerHTML = '';
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    
    console.log(`🎨 About to render ${filtered.length} provider cards`);
    
    if (filtered.length === 0) {
        console.log('📭 No providers to show - displaying empty state');
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    
    filtered.forEach((provider, index) => {
        console.log(`🎨 Rendering provider ${index + 1}:`, {
            name: provider.name,
            id: provider.id,
            category: provider.category
        });
        
        const card = this.createAvailableProviderCard(provider);
        container.appendChild(card);
    });
    
    console.log(`✅ Rendered ${filtered.length} provider cards to container`);
    console.log('🔍 Container innerHTML length:', container.innerHTML.length);
}

        createAvailableProviderCard(provider) {
    const card = document.createElement('div');
    card.className = 'available-provider-card';
    
    // Correct field mapping based on your provider document structure
    const name = provider.fullName || 
                 provider.identity?.fullName ||
                 `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 
                 provider.email?.split('@')[0] || 
                 'Unknown Provider';
    
    const rating = provider.rating || provider.averageRating || 0;
    
    // Build category from profile data
    const primaryDomain = provider.profile?.primaryDomain || '';
    const mediaSpec = provider.profile?.mediaSpecialization || '';
    const techSpec = provider.profile?.techSpecialization || '';
    const specialisations = provider.profile?.specialisations || '';
    
    const category = [primaryDomain, mediaSpec, techSpec, specialisations]
                    .filter(item => item && item.trim())
                    .join(', ') || 
                    provider.tier || 
                    'Service Provider';
    
    // Location from identity or fallback
    const location = provider.identity?.city || 
                    provider.city || 
                    provider.country || 
                    'Location not specified';
    
    console.log(`🎨 Creating card for provider:`, {
        id: provider.id,
        fullName: provider.fullName,
        computedName: name,
        primaryDomain: primaryDomain,
        mediaSpec: mediaSpec,
        computedCategory: category,
        city: provider.identity?.city,
        computedLocation: location
    });
    
    card.innerHTML = `
        <div class="featured-provider-card">
            ${provider.profileImage ? 
                `<img src="${this.esc(provider.profileImage)}" 
                     alt="${this.esc(name)}" 
                     class="featured-avatar"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSIzMCIgeT0iMzYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMjQiPjU8L3RleHQ+PC9zdmc+'; this.onerror=null;">` : 
                `<div class="featured-avatar placeholder">👤</div>`
            }
            <div class="featured-info">
                <h4>${this.esc(name)}</h4>
                <div class="featured-category">${this.esc(category)}</div>
                <div class="featured-location">📍 ${this.esc(location)}</div>
                ${rating > 0 ? `<div class="provider-rating">⭐ ${rating.toFixed(1)}</div>` : ''}
                ${provider.tier ? `<div class="provider-tier">${this.esc(provider.tier)}</div>` : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        this.showProviderPreviewModal(provider);
    });
    
    return card;
}



        // Provider selection and management
        selectSlot(slotNumber) {
            this.selectedSlot = slotNumber;
            
            // Update UI to show selected slot
            document.querySelectorAll('.featured-slot').forEach(slot => {
                slot.classList.remove('selected');
            });
            
            const selectedSlot = document.querySelector(`.featured-slot[data-slot="${slotNumber}"]`);
            if (selectedSlot) {
                selectedSlot.classList.add('selected');
            }
            
            this.toast(`Position ${slotNumber} selected. Click a provider to add them.`, 'info');
        }

        removeFromSlot(slotNumber) {
            this.featuredProviders = this.featuredProviders.filter(p => p.priority !== slotNumber);
            this.renderFeaturedSlots();
            this.renderAvailableProviders(); // Re-render to show removed provider as available
            this.updateWeekDisplay();
            this.toast(`Removed provider from position ${slotNumber}`, 'success');
        }

        showProviderPreviewModal(provider) {
            const modal = document.getElementById('featured-provider-modal');
            const detailsContainer = document.getElementById('featured-provider-details');
            
            if (!modal || !detailsContainer) return;
            
            const rating = provider.rating || provider.averageRating || 0;
            const category = provider.category || (provider.serviceTypes || []).join(', ') || 'Service Provider';
            const location = provider.location || provider.cityOfOperation || 'Location not specified';
            
            detailsContainer.innerHTML = `
                <div class="provider-preview">
                    <div class="provider-header">
                        ${provider.profileImage ? 
                            `<img src="${this.esc(provider.profileImage)}" alt="${this.esc(provider.name)}" class="provider-avatar">` : 
                            `<div class="provider-avatar placeholder">👤</div>`
                        }
                        <div class="provider-info">
                            <h3>${this.esc(provider.name || `${provider.firstName} ${provider.lastName}`.trim())}</h3>
                            <p class="provider-category">${this.esc(category)}</p>
                            <p class="provider-location">📍 ${this.esc(location)}</p>
                            ${rating > 0 ? `<div class="provider-rating">⭐ ${rating}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="provider-details">
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${this.esc(provider.email)}</span>
                        </div>
                        ${provider.phone ? `
                            <div class="detail-row">
                                <span class="detail-label">Phone:</span>
                                <span class="detail-value">${this.esc(provider.phone)}</span>
                            </div>
                        ` : ''}
                        ${provider.experience ? `
                            <div class="detail-row">
                                <span class="detail-label">Experience:</span>
                                <span class="detail-value">${this.esc(provider.experience)}</span>
                            </div>
                        ` : ''}
                        ${(provider.serviceTypes || []).length > 0 ? `
                            <div class="detail-row">
                                <span class="detail-label">Services:</span>
                                <span class="detail-value">${provider.serviceTypes.map(s => `<span class="service-tag">${this.esc(s)}</span>`).join('')}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Update select button
            const selectBtn = document.getElementById('select-provider-btn');
            if (selectBtn) {
                selectBtn.onclick = () => {
                    this.addProviderToFeatured(provider);
                    modal.style.display = 'none';
                };
                
                // Disable if no slot selected or all slots full
                const canAdd = this.selectedSlot && this.featuredProviders.length < 3;
                selectBtn.disabled = !canAdd;
                selectBtn.querySelector('.btn-text').textContent = canAdd ? 
                    `Add to Position ${this.selectedSlot}` : 
                    (this.featuredProviders.length >= 3 ? 'All Positions Filled' : 'Select Position First');
            }
            
            modal.style.display = 'flex';
        }

        addProviderToFeatured(provider) {
            if (!this.selectedSlot || this.selectedSlot < 1 || this.selectedSlot > 3) {
                this.toast('Please select a position first', 'warning');
                return;
            }
            
            if (this.featuredProviders.find(p => p.priority === this.selectedSlot)) {
                // Replace existing provider in this slot
                this.featuredProviders = this.featuredProviders.filter(p => p.priority !== this.selectedSlot);
            }
            
            const featuredProvider = {
                providerId: provider.id,
                name: provider.name || `${provider.firstName} ${provider.lastName}`.trim(),
                profileImage: provider.profileImage || null,
                category: provider.category || (provider.serviceTypes || []).join(', ') || 'Service Provider',
                location: provider.location || provider.cityOfOperation || 'Location not specified',
                rating: provider.rating || provider.averageRating || 0,
                priority: this.selectedSlot
            };
            
            this.featuredProviders.push(featuredProvider);
            
            // Sort by priority
            this.featuredProviders.sort((a, b) => a.priority - b.priority);
            
            this.renderFeaturedSlots();
            this.renderAvailableProviders();
            this.updateWeekDisplay();
            
            this.toast(`${featuredProvider.name} added to position ${this.selectedSlot}!`, 'success');
            
            // Clear selection
            this.selectedSlot = null;
            document.querySelectorAll('.featured-slot').forEach(slot => {
                slot.classList.remove('selected');
            });
        }

        // Save and management functions
        async saveFeaturedProviders() {
            if (this.featuredProviders.length === 0) {
                this.toast('Please select at least one provider before saving', 'warning');
                return;
            }
            
            try {
                const db = firebase.firestore();
                const docData = {
                    weekStart: firebase.firestore.Timestamp.fromDate(this.currentWeek.start),
                    weekEnd: firebase.firestore.Timestamp.fromDate(this.currentWeek.end),
                    providers: this.featuredProviders,
                    updatedBy: this.currentAdmin?.uid || 'unknown',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'active'
                };
                
                await db.collection('featuredProviders').doc(this.currentWeek.id).set(docData);
                
                // Log admin action
                await this.logAdminAction?.('save-featured-providers', this.currentWeek.id, {
                    weekId: this.currentWeek.id,
                    providerCount: this.featuredProviders.length,
                    providers: this.featuredProviders.map(p => ({ id: p.providerId, name: p.name, priority: p.priority }))
                });
                
                this.toast(`Featured providers saved for week of ${this.currentWeek.start.toLocaleDateString()}!`, 'success');
                
            } catch (error) {
                console.error('Error saving featured providers:', error);
                this.toast('Error saving featured providers. Please try again.', 'danger');
            }
        }

        async copyPreviousWeek() {
            try {
                // Calculate previous week
                const prevWeek = new Date(this.currentWeek.start);
                prevWeek.setDate(prevWeek.getDate() - 7);
                const prevWeekId = `week-${prevWeek.getFullYear()}-${String(prevWeek.getMonth() + 1).padStart(2, '0')}-${String(prevWeek.getDate()).padStart(2, '0')}`;
                
                const db = firebase.firestore();
                const prevDoc = await db.collection('featuredProviders').doc(prevWeekId).get();
                
                if (!prevDoc.exists) {
                    this.toast('No featured providers found for previous week', 'warning');
                    return;
                }
                
                const prevData = prevDoc.data();
                this.featuredProviders = prevData.providers || [];
                
                this.renderFeaturedSlots();
                this.renderAvailableProviders();
                this.updateWeekDisplay();
                
                this.toast('Copied providers from previous week. Remember to save!', 'info');
                
            } catch (error) {
                console.error('Error copying previous week:', error);
                this.toast('Error copying from previous week', 'danger');
            }
        }

        clearWeekSelections() {
            if (this.featuredProviders.length === 0) {
                this.toast('No providers selected to clear', 'info');
                return;
            }
            
            if (confirm(`Clear all ${this.featuredProviders.length} selected providers for this week?`)) {
                this.featuredProviders = [];
                this.renderFeaturedSlots();
                this.renderAvailableProviders();
                this.updateWeekDisplay();
                this.toast('All selections cleared', 'success');
            }
        }

        // Stats and display updates
        updateFeaturedStats() {
            // Update current week stat
            const currentEl = document.getElementById('featured-current');
            if (currentEl) {
                currentEl.textContent = this.featuredProviders.length;
            }
            
            // You can extend this to show more stats from Firestore
            // like total weeks managed, scheduled weeks, etc.
        }

        // Section display methods (add to existing section methods)
        showFeaturedProvidersSection() {
            this.showOnlySection('featured-providers-section');
            this.showOnlyStats('featured-stats');
        }

        // Add to tab switching methods
        switchToFeaturedProviders() {
            this.currentTab = 'featured-providers';
            localStorage.setItem('adminactivetab', this.currentTab);
            
            // Clear other section states
            this.searchTerm = '';
            this.currentFilter = 'all';
            this.enquirySearchTerm = '';
            this.currentEnquiryFilter = 'all';
            
            // Update tab UI
            ['providers', 'enquiries', 'notifications', 'service-reviews', 'cancellations', 'featured-providers']
                .forEach(t => document.getElementById(`${t}-tab`)?.classList.remove('active'));
            document.getElementById('featured-providers-tab')?.classList.add('active');
            
            this.showFeaturedProvidersSection();
            this.loadFeaturedProvidersForWeek();
            this.renderAvailableProviders();
            
            this.logAdminAction?.('switch-to-featured-providers', null, { timestamp: new Date() });
        }

    // Update enquiry status (EXISTING - UNCHANGED)
    async updateEnquiryStatus() {
        const newStatus = document.getElementById('enquiry-status-select').value;
        const enquiry = this.currentEnquiry;
        
        if (newStatus === enquiry.status) {
            this.showSuccessMessage('Status is already set to ' + this.getStatusDisplayText(newStatus));
            return;
        }
        
        try {
            const updateData = {
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Auto-assign admin if not already assigned
            if (!enquiry.assignedAdmin) {
                updateData.assignedAdmin = this.currentAdmin.uid;
            }
            
            // Set contacted timestamp if moving to contacted status
            if (newStatus === 'contacted' && enquiry.status !== 'contacted') {
                updateData.contactedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            // Update in Firebase
            await db.collection("enquiries").doc(enquiry.id).update(updateData);
            
            // Log admin action
            await this.logAdminAction(
                'update_enquiry_status',
                enquiry.id,
                {
                    customerName: enquiry.customerName,
                    customerEmail: enquiry.customerEmail,
                    packageName: enquiry.packageName,
                    previousStatus: enquiry.status,
                    newStatus: newStatus,
                    timestamp: new Date()
                }
            );
            
            console.log('Enquiry status updated successfully');
            
            // Update local data
            const enquiryIndex = this.enquiries.findIndex(e => e.id === enquiry.id);
            if (enquiryIndex !== -1) {
                this.enquiries[enquiryIndex].status = newStatus;
                this.enquiries[enquiryIndex].updatedAt = new Date();
                
                if (!this.enquiries[enquiryIndex].assignedAdmin) {
                    this.enquiries[enquiryIndex].assignedAdmin = this.currentAdmin.uid;
                }
                
                if (newStatus === 'contacted' && enquiry.status !== 'contacted') {
                    this.enquiries[enquiryIndex].contactedAt = new Date();
                }
            }
            
            // Update new enquiry count
            this.newEnquiryCount = this.enquiries.filter(e => e.status === 'new').length;
            this.updateEnquiryBadge();
            
            // Close modal and refresh UI
            this.closeModal('enquiry-modal');
            this.updateStats();
            this.renderEnquiries();
            
            this.showSuccessMessage(`Enquiry status updated to ${this.getStatusDisplayText(newStatus)} successfully!`);
            
        } catch (error) {
            console.error('Error updating enquiry status:', error);
            alert('Error updating enquiry status. Please try again.');
        }
    }

    // Quick mark as contacted (EXISTING - UNCHANGED)
    async quickMarkContacted(enquiryId) {
        const enquiry = this.enquiries.find(e => e.id === enquiryId);
        if (!enquiry) return;
        
        try {
            const updateData = {
                status: 'contacted',
                contactedAt: firebase.firestore.FieldValue.serverTimestamp(),
                assignedAdmin: this.currentAdmin.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection("enquiries").doc(enquiryId).update(updateData);
            
            // Log admin action
            await this.logAdminAction(
                'quick_mark_contacted',
                enquiryId,
                {
                    customerName: enquiry.customerName,
                    customerEmail: enquiry.customerEmail,
                    packageName: enquiry.packageName,
                    timestamp: new Date()
                }
            );
            
            // Update local data
            const enquiryIndex = this.enquiries.findIndex(e => e.id === enquiryId);
            if (enquiryIndex !== -1) {
                this.enquiries[enquiryIndex].status = 'contacted';
                this.enquiries[enquiryIndex].contactedAt = new Date();
                this.enquiries[enquiryIndex].assignedAdmin = this.currentAdmin.uid;
                this.enquiries[enquiryIndex].updatedAt = new Date();
            }
            
            // Update counts and UI
            this.newEnquiryCount = this.enquiries.filter(e => e.status === 'new').length;
            this.updateEnquiryBadge();
            this.updateStats();
            this.renderEnquiries();
            
            this.showSuccessMessage('Enquiry marked as contacted successfully!');
            
        } catch (error) {
            console.error('Error marking enquiry as contacted:', error);
            alert('Error updating enquiry. Please try again.');
        }
    }

    // Render enquiries (EXISTING - UNCHANGED)
    renderEnquiries() {
        const container = document.getElementById('enquiries-container');
        const loadingState = document.getElementById('enquiries-loading-state');
        const emptyState = document.getElementById('enquiries-empty-state');
        
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Filter enquiries
        let filteredEnquiries = this.enquiries;
        
        if (this.currentEnquiryFilter !== 'all') {
            filteredEnquiries = filteredEnquiries.filter(e => e.status === this.currentEnquiryFilter);
        }
        
        if (this.enquirySearchTerm) {
            filteredEnquiries = filteredEnquiries.filter(e => 
                e.customerName.toLowerCase().includes(this.enquirySearchTerm) ||
                e.customerEmail.toLowerCase().includes(this.enquirySearchTerm) ||
                e.packageName.toLowerCase().includes(this.enquirySearchTerm)
            );
        }
        
        if (filteredEnquiries.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        
        filteredEnquiries.forEach(enquiry => {
            const enquiryCard = this.createEnquiryCard(enquiry);
            container.appendChild(enquiryCard);
        });
    }

    // Utility methods for enquiries (EXISTING - UNCHANGED)
    getStatusDisplayText(status) {
        const statusMap = {
            'new': 'New',
            'contacted': 'Contacted',
            'quoted': 'Quoted',
            'converted': 'Converted',
            'closed': 'Closed'
        };
        return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    }

    formatIndianPrice(price) {
        const numPrice = parseInt(price) || 0;
        return '₹' + numPrice.toLocaleString('en-IN');
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString();
    }

    // Enhanced logout with audit logging
    async handleLogout() {
        try {
            if (this.currentAdmin) {
                // Log logout action
                await this.logAdminAction('logout', null, {
                    timestamp: new Date()
                });
            }

            // Sign out from Firebase
            await firebase.auth().signOut();
            
            // Clear saved tab state
            localStorage.removeItem('admin_active_tab');
            
            // Redirect to login
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Error during logout:', error);
            // Force redirect anyway
            window.location.href = 'index.html';
        }
    }

    // Enhanced admin action logging
    async logAdminAction(action, targetId, details) {
        try {
            if (!this.currentAdmin) return;

            const logEntry = {
                adminUid: this.currentAdmin.uid,
                adminEmail: this.currentAdmin.email,
                adminName: this.currentAdmin.name,
                adminRole: this.currentAdmin.role,
                action: action,
                targetId: targetId,
                details: details,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            };

            await db.collection('admin_audit_logs').add(logEntry);
            console.log('Admin action logged:', action, targetId);

        } catch (error) {
            console.error('Error logging admin action:', error);
        }
    }
    
    // Load providers from Firebase - v8 syntax (EXISTING - UNCHANGED)
    // Single source of truth loader (no orderBy, local sort)
async loadProvidersFromFirebase() {
    const loadingState = document.getElementById('providers-loading-state');
    if (loadingState) loadingState.style.display = 'block';
    
    try {
        const qs = await db.collection('providers').get();
        this.providers = [];
        
        // Helper to parse timestamps
        const parseTs = (ts) => {
            if (!ts) return null;
            if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
            if (typeof ts?.toDate === 'function') return ts.toDate();
            if (typeof ts === 'number') return new Date(ts);
            if (typeof ts === 'string') {
                const cleaned = ts.replace(/\s+at\s+/i, ' ');
                const d = new Date(cleaned);
                if (!isNaN(d.getTime())) return d;
                const d2 = new Date(ts);
                return isNaN(d2.getTime()) ? null : d2;
            }
            if (typeof ts === 'object') {
                if (ts.seconds != null) return new Date((ts.seconds * 1000) + ((ts.nanoseconds || 0) / 1e6));
                if (ts._seconds != null) return new Date((ts._seconds * 1000) + ((ts._nanoseconds || 0) / 1e6));
            }
            return null;
        };
        
        qs.forEach(docSnap => {
            const data = docSnap.data();
            
            // Parse timestamps
            const createdAt = parseTs(data.createdAt) || parseTs(data.updatedAt) || new Date(0);
            const updatedAt = parseTs(data.updatedAt) || createdAt;
            const statusChanged = parseTs(data.statusChanged);
            const tierAssignedDate = parseTs(data.tierAssignedDate);
            
            // Extract name - your form saves firstName, lastName, fullName at root
            const fullName = data.fullName || 
                            (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : '') ||
                            data.identity?.fullName || 
                            data.username || 'Unknown Provider';
            
            // Extract identity fields - your form saves them at root AND in identity map
            const email = data.email || data.identity?.email || 'No email';
            const phone = data.phone || data.identity?.phone || '';
            const phoneCode = data.phoneCode || '+91';
            
            // Extract location - saved at root in your form
            const country = data.country || data.identity?.country || 'Not specified';
            const city = data.city || data.identity?.city || 'Not specified';
            
            // Gender from identity map
            const gender = data.identity?.gender || data.gender || '';
            
            // Username at root
            const username = data.username || email.split('@')[0] || 'N/A';
            
            // Extract nameOnId from identity map
            const nameOnId = data.identity?.nameOnId || data.fullName || '';
            
            // Profile data - saved in profile map
            const experience = data.profile?.experience || 'Not specified';
            const primaryDomain = data.profile?.primaryDomain || '';
            
            // Specialisations - saved as comma-separated string in profile
            const specialisationsStr = data.profile?.specialisations || '';
            const specialisations = specialisationsStr ? specialisationsStr.split(',').map(s => s.trim()) : [];
            
            // Key skills - saved as comma-separated string
            const keySkillsStr = data.profile?.keySkills || '';
            const keySkills = keySkillsStr ? keySkillsStr.split(',').map(s => s.trim()) : [];
            
            // Media-specific fields
            const mediaSpecialization = data.profile?.mediaSpecialization || '';
            const equipment = data.media?.equipment || [];
            
            // Tech-specific fields
            const techSpecialization = data.profile?.techSpecialization || '';
            const projectTypes = data.profile?.projectTypes || '';
            
            // Combine for display as "service types"
            const serviceTypes = [...specialisations, ...keySkills].filter(Boolean);
            
            // Work/Portfolio data - saved in work map
            const portfolio = data.work?.portfolio || '';
            const cvUrl = data.work?.cvUrl || '';
            const workLinks = data.work?.links || [];
            
            // KYC data - saved in kyc map
            const idFilesUrls = data.kyc?.idFilesUrls || [];
            
            // Payout data - saved in payout map with india/international submaps
            const payoutCountry = data.payoutCountry || '';
            const payoutIndia = data.payout?.india || {};
            const payoutIntl = data.payout?.international || {};
            
            // Onboarding status - saved in onboarding map
            const isProfileCompleted = data.onboarding?.completed || false;
            const onboardingStatus = data.onboarding?.status || 'draft';
            const onboardingStep = data.onboarding?.step || 0;
            
            // Status mapping - your form saves as "status" with values like "approved", "waiting"
            const statusRaw = data.status || 'waiting';
            let approvalStatus = statusRaw;
            
            // Map status for UI display
            if (statusRaw === 'waiting') approvalStatus = 'pending';
            if (statusRaw === 'approved') approvalStatus = 'approved';
            if (statusRaw === 'rejected') approvalStatus = 'rejected';
            
            // Tier information
            const tier = data.tier || null;
            const tierAssignedBy = data.tierAssignedBy || null;
            
            // Role
            const role = data.role || 'provider';
            
            const provider = {
                id: docSnap.id,
                
                // Display fields
                name: fullName,
                fullName: fullName,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: email,
                phone: phone,
                phoneCode: phoneCode,
                username: username,
                
                // Identity
                nameOnId: nameOnId,
                gender: gender,
                
                // Location
                country: country,
                city: city,
                cityOfOperation: city, // For backward compatibility
                
                // Profile/Professional info
                experience: experience,
                primaryDomain: primaryDomain,
                specialisations: specialisations,
                keySkills: keySkills,
                // serviceTypes: serviceTypes, // Combined for display
                
                // Domain-specific
                mediaSpecialization: mediaSpecialization,
                equipment: equipment,
                techSpecialization: techSpecialization,
                projectTypes: projectTypes,
                
                // Work evidence
                portfolio: portfolio,
                cvUrl: cvUrl,
                workLinks: workLinks,
                mediaPortfolioUrl: portfolio,
                techPortfolioUrl: portfolio,
                
                // KYC
                idFilesUrls: idFilesUrls,
                
                // Payout
                payoutCountry: payoutCountry,
                payoutIndia: payoutIndia,
                payoutIntl: payoutIntl,
                payout: data.payout || {},
                
                // Profile completion
                isProfileCompleted: isProfileCompleted,
                onboardingStatus: onboardingStatus,
                onboardingStep: onboardingStep,
                
                // CRITICAL: Ensure approvalStatus is always a string
    approvalStatus: approvalStatus || 'pending',
    originalStatus: statusRaw || 'waiting',
    status: statusRaw || 'waiting',
    
    // Ensure serviceTypes is always an array
    serviceTypes: serviceTypes || [],
                
                // Tier
                tier: tier,
                tierAssignedDate: tierAssignedDate,
                tierAssignedBy: tierAssignedBy,
                
                // Timestamps
                createdAt: createdAt,
                updatedAt: updatedAt,
                statusChanged: statusChanged,
                
                // Role
                role: role,
                providerId: data.providerId || docSnap.id,
                
                // Comments/Notes
                comments: data.comments || '',
                
                // Store all nested objects for detail view
                identity: data.identity || {},
                profile: data.profile || {},
                media: data.media || {},
                work: data.work || {},
                kyc: data.kyc || {},
                onboarding: data.onboarding || {},
                statusHistory: data.statusHistory || [],
                
                // Legal
                ageConfirm: data.ageConfirm || false,
                dataConsent: data.dataConsent || false,
                tosAgree: data.tosAgree || false,
                finalDeclaration: data.finalDeclaration || false,
                
                // For backwards compatibility
                approvalDate: statusChanged,
                approvedBy: tierAssignedBy || 'admin',
                approvalNotes: data.comments || ''
            };
            
            this.providers.push(provider);
        });
        
        // Sort: newest first
        this.providers.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
        
        this.renderProviders?.();
        
    } catch (err) {
        console.error('Error loading providers:', err);
        alert('Error loading provider data. Please try again.');
        this.providers = [];
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}


    
    // Map Firebase status to UI display (EXISTING - UNCHANGED)
    mapStatusForUI(firebaseStatus, data = {}) {
        const rawStatus = String(firebaseStatus || '').toLowerCase();
        const onboarding = data.onboarding || {};

        if (
            rawStatus === 'in_progress' ||
            rawStatus === 'onboarding_required' ||
            rawStatus === 'draft' ||
            rawStatus === 'incomplete' ||
            rawStatus === 'unsubmitted'
        ) {
            return 'in_progress';
        }

        if (onboarding.completed === false || data.onboardingCompleted === false) {
            if (rawStatus !== 'approved' && rawStatus !== 'rejected' && rawStatus !== 'needs_changes') {
                return 'in_progress';
            }
        }

        switch(rawStatus) {
            case 'waiting':
            case 'processing':
            case 'pending':
                return 'pending';
            case 'needs_changes':
            case 'retry':
                return 'needs_changes';
            case 'approved':
                return 'approved';
            case 'rejected':
                return 'rejected';
            default:
                return 'pending';
        }
    }
    
    // Map UI action to Firebase status (EXISTING - UNCHANGED)
    mapActionToFirebaseStatus(action) {
        if (action === 'approve') return 'approved';
        if (action === 'reject') return 'rejected';
        if (action === 'reset') return 'waiting';
        return 'waiting';
    }
    
    // Create tier badge HTML (EXISTING - UNCHANGED)
    createTierBadge(tier, includeIcon = false) {
        if (!tier) return '';
        
        const tierClass = `tier-badge tier-${tier.toLowerCase()}`;
        const tierIcon = includeIcon ? this.getTierIcon(tier) : '';
        
        return `<span class="${tierClass}">${tierIcon}${tier}</span>`;
    }
    
    // Get tier icon (EXISTING - UNCHANGED)
    getTierIcon(tier) {
        const icons = {
            'Silver': '🥈 ',
            'Gold': '🥇 ',
            'Platinum': '💎 '
        };
        return icons[tier] || '';
    }
    
    // Show tier selection modal (EXISTING - UNCHANGED)
    showTierSelectionModal(provider, action) {
        this.currentProvider = provider;
        this.tierSelectionAction = action;
        this.selectedTier = null;
        
        const modal = document.getElementById('tier-selection-modal');
        const title = document.getElementById('tier-modal-title');
        const message = document.getElementById('tier-modal-message');
        const confirmBtn = document.getElementById('confirm-tier-btn');
        
        if (action === 'approve') {
            title.textContent = 'Select Provider Tier';
            message.textContent = `Choose the appropriate tier for ${provider.name}:`;
            confirmBtn.textContent = 'Approve with Selected Tier';
        } else if (action === 'change-tier') {
            title.textContent = 'Change Provider Tier';
            message.textContent = `Select new tier for ${provider.name}:`;
            confirmBtn.textContent = 'Update Tier';
        }
        
        // Reset tier selection
        document.querySelectorAll('.tier-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.getElementById('selected-tier-info').style.display = 'none';
        confirmBtn.disabled = true;
        
        modal.style.display = 'flex';
    }
    
    // Handle tier selection (EXISTING - UNCHANGED)
    handleTierSelection(tier) {
        this.selectedTier = tier;
        
        // Update UI
        document.querySelectorAll('.tier-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-tier="${tier}"]`).classList.add('selected');
        
        // Show selected tier info
        const tierInfo = document.getElementById('selected-tier-info');
        const tierDisplay = document.getElementById('selected-tier-display');
        tierDisplay.innerHTML = this.createTierBadge(tier, true);
        tierInfo.style.display = 'block';
        
        // Enable confirm button
        document.getElementById('confirm-tier-btn').disabled = false;
    }
    
    // Confirm tier selection (EXISTING - UNCHANGED)
    confirmTierSelection() {
        if (!this.selectedTier) return;
        
        this.closeModal('tier-selection-modal');
        
        if (this.tierSelectionAction === 'approve') {
            this.showConfirmModal('approve', this.currentProvider);
        } else if (this.tierSelectionAction === 'change-tier') {
            this.updateProviderTier(this.currentProvider.id, this.selectedTier);
        }
    }
    
    // Update provider tier (EXISTING - UNCHANGED)
    async updateProviderTier(providerId, newTier) {
        try {
            const provider = this.providers.find(p => p.id === providerId);
            
            const updateData = {
                tier: newTier,
                tierAssignedDate: firebase.firestore.FieldValue.serverTimestamp(),
                tierAssignedBy: this.currentAdmin.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection("providers").doc(providerId).update(updateData);
            
            // Log tier change action
            await this.logAdminAction(
                'change_tier',
                providerId,
                {
                    providerName: provider.name,
                    providerEmail: provider.email,
                    previousTier: provider.tier,
                    newTier: newTier,
                    timestamp: new Date()
                }
            );
            
            // Update local data
            const providerIndex = this.providers.findIndex(p => p.id === providerId);
            if (providerIndex !== -1) {
                this.providers[providerIndex].tier = newTier;
                this.providers[providerIndex].tierAssignedDate = new Date();
                this.providers[providerIndex].tierAssignedBy = this.currentAdmin.uid;
            }
            
            // Refresh UI
            this.updateStats();
            this.renderProviders();
            this.showSuccessMessage(`Provider tier updated to ${newTier} successfully!`);
            
            // Close provider modal
            this.closeModal('provider-modal');
            
        } catch (error) {
            console.error('Error updating provider tier:', error);
            alert('Error updating provider tier. Please try again.');
        }
    }
    
    // Update provider status with enhanced logging (EXISTING - UNCHANGED)
    async handleProviderAction() {
        const comments = document.getElementById('admin-notes').value.trim();
        const provider = this.currentProvider;
        const action = this.currentAction;
        
        if (action === 'reject' && !comments) {
            alert('Please provide a reason for rejection.');
            return;
        }
        
        if (action === 'approve' && !this.selectedTier) {
            alert('Please select a tier for approval.');
            return;
        }
        
        try {
            console.log(`${action} provider:`, provider.id, 'Comments:', comments, 'Tier:', this.selectedTier);
            
            const newFirebaseStatus = this.mapActionToFirebaseStatus(action);
            
            // Prepare update data - v8 syntax
            const updateData = {
                status: newFirebaseStatus,
                statusChanged: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Handle tier assignment for approvals
            if (action === 'approve' && this.selectedTier) {
                updateData.tier = this.selectedTier;
                updateData.tierAssignedDate = firebase.firestore.FieldValue.serverTimestamp();
                updateData.tierAssignedBy = this.currentAdmin.uid;
            }
            
            // Reset tier for reset action
            if (action === 'reset') {
                updateData.tier = null;
                updateData.tierAssignedDate = null;
                updateData.tierAssignedBy = null;
            }
            
            // Add comments if provided
            if (comments) {
                updateData.comments = comments;
            }
            
            // Update in Firebase - v8 syntax
            await db.collection("providers").doc(provider.id).update(updateData);
            
            // Log admin action with detailed info
            await this.logAdminAction(
                `${action}_provider`,
                provider.id,
                {
                    providerName: provider.name,
                    providerEmail: provider.email,
                    previousStatus: provider.originalStatus,
                    newStatus: newFirebaseStatus,
                    tier: this.selectedTier,
                    comments: comments,
                    timestamp: new Date()
                }
            );
            
            console.log('Provider status updated successfully in Firebase');
            
            // Update local data for immediate UI update
            const providerIndex = this.providers.findIndex(p => p.id === provider.id);
            if (providerIndex !== -1) {
                if (action === 'reset') {
                    this.providers[providerIndex].approvalStatus = 'pending';
                    this.providers[providerIndex].originalStatus = 'waiting';
                    this.providers[providerIndex].tier = null;
                    this.providers[providerIndex].tierAssignedDate = null;
                    this.providers[providerIndex].tierAssignedBy = null;
                } else {
                    this.providers[providerIndex].approvalStatus = action === 'approve' ? 'approved' : 'rejected';
                    this.providers[providerIndex].originalStatus = newFirebaseStatus;
                    
                    if (action === 'approve' && this.selectedTier) {
                        this.providers[providerIndex].tier = this.selectedTier;
                        this.providers[providerIndex].tierAssignedDate = new Date();
                        this.providers[providerIndex].tierAssignedBy = this.currentAdmin.uid;
                    }
                }
                this.providers[providerIndex].statusChanged = new Date();
                this.providers[providerIndex].comments = comments;
                this.providers[providerIndex].approvalDate = new Date();
                this.providers[providerIndex].approvalNotes = comments;
            }
            
            // Close modals and refresh UI
            this.closeModal('confirm-modal');
            this.closeModal('provider-modal');
            this.updateStats();
            this.renderProviders();
            
            let actionText;
            if (action === 'approve') {
                actionText = `approved with ${this.selectedTier} tier`;
            } else if (action === 'reset') {
                actionText = 'reset to pending';
            } else {
                actionText = 'rejected';
            }
            
            this.showSuccessMessage(`Provider ${actionText} successfully!`);
            
            // Reset selected tier
            this.selectedTier = null;
            
        } catch (error) {
            console.error('Error updating provider status:', error);
            alert('Error updating provider status. Please try again.');
        }
    }
    
    // Create provider card (EXISTING - UNCHANGED)
   createProviderCard(provider) {
    const card = document.createElement('div');
    card.className = 'provider-card';
    
    // DEFENSIVE CHECK: Ensure approvalStatus is a string
    const approvalStatus = provider.approvalStatus || provider.status || 'pending';
    const statusClass = `status-${approvalStatus}`;
    const statusText = typeof approvalStatus === 'string' 
        ? approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)
        : 'Pending';
    
    // Safely handle serviceTypes
    const serviceTypes = Array.isArray(provider.serviceTypes) ? provider.serviceTypes : [];
    const servicesDisplay = serviceTypes.length > 0 
        ? serviceTypes.slice(0, 2).join(', ') + (serviceTypes.length > 2 ? '...' : '')
        : 'No services listed';
    
    // Safely handle other fields
    const profileStatus = provider.isProfileCompleted ? 'Complete' : 'Incomplete';
    const tierBadge = provider.tier ? this.createTierBadge(provider.tier) : '';
    const cityOfOperation = provider.cityOfOperation || provider.city || 'Not specified';
    const experience = provider.experience || 'Not specified';
    const username = provider.username || 'N/A';
    const email = provider.email || 'No email';
    const name = provider.name || provider.fullName || 'Unknown Provider';
    
    // Safely format date
    let appliedDate = 'N/A';
    try {
        if (provider.createdAt && typeof provider.createdAt.toLocaleDateString === 'function') {
            appliedDate = provider.createdAt.toLocaleDateString();
        }
    } catch (e) {
        console.warn('Error formatting date:', e);
    }
    
    card.innerHTML = `
        <div class="provider-header">
            <div class="provider-info">
                <h3>${name}</h3>
                <div class="provider-email">${email}</div>
            </div>
            <div class="provider-badges">
                <div class="provider-status ${statusClass}">${statusText}</div>
                ${tierBadge}
            </div>
        </div>
        <div class="provider-details">
            <div class="detail-item">
                <span class="detail-label">Username</span>
                <span class="detail-value">${username}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">City</span>
                <span class="detail-value">${cityOfOperation}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Experience</span>
                <span class="detail-value">${experience}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Services</span>
                <span class="detail-value">${servicesDisplay}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Profile</span>
                <span class="detail-value">${profileStatus}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Applied</span>
                <span class="detail-value">${appliedDate}</span>
            </div>
        </div>
        <div class="provider-actions">
            ${approvalStatus === 'pending' ? `
                <button class="action-btn approve-btn" data-action="quick-approve" data-provider-id="${provider.id}">Quick Approve / Assign Tier</button>
                <button class="action-btn reject-btn" data-action="quick-reject" data-provider-id="${provider.id}">Quick Reject</button>
            ` : ''}
            <button class="action-btn warn-btn" data-action="request-changes" data-provider-id="${provider.id}">Request Changes</button>
            <button class="action-btn view-btn" data-action="view-details" data-provider-id="${provider.id}">View Details</button>
            ${approvalStatus !== 'pending' ? `
                <button class="action-btn reset-btn" data-action="reset" data-provider-id="${provider.id}">Reset to Pending</button>
            ` : ''}
        </div>
    `;
    
    // Add event listeners to buttons using event delegation
    const actionsDiv = card.querySelector('.provider-actions');
    actionsDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const providerId = button.dataset.providerId;
        const targetProvider = this.providers.find(p => p.id === providerId);
        
        if (!targetProvider) return;
        
        switch(action) {
            case 'quick-approve':
                this.quickApprove(providerId);
                break;
            case 'quick-reject':
                this.quickReject(providerId);
                break;
            case 'request-changes':
                this.openRequestChanges(providerId);
                break;
            case 'view-details':
                this.showProviderModal(targetProvider);
                break;
            case 'reset':
                this.quickReset(providerId);
                break;
        }
    });
    
    // Make the rest of the card clickable to view details
    card.addEventListener('click', () => {
        this.showProviderModal(provider);
    });
    
    return card;
}


    
    // Show detailed provider modal (EXISTING - UNCHANGED)
    showProviderModal(provider) {
  this.currentProvider = provider;
  const modal = document.getElementById('provider-modal');
  const detailsContainer = document.getElementById('provider-details');
  
  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#') return '';
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.startsWith('//')) {
      return 'https:' + trimmed;
    }
    if (/^(mailto|tel):/i.test(trimmed)) {
      return trimmed;
    }
    return 'https://' + trimmed;
  }

  // Helper functions
  const formatArray = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : `<em>Not provided</em>`;
  const formatUrl = (url, text = 'View') => {
    const validUrl = normalizeUrl(url);
    return validUrl ? `<a href="${validUrl}" target="_blank" rel="noopener noreferrer">${text} ↗</a>` : `<em>Not provided</em>`;
  };
  const formatBoolean = (value) => value ? 'Yes' : 'No';
  const formatValue = (value) => value ? value : `<em>Not provided</em>`;
  
  // Build file links display
  const idFilesDisplay = (provider.idFilesUrls && provider.idFilesUrls.length > 0) 
    ? provider.idFilesUrls.map((url, index) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">ID Document ${index + 1} ↗</a>`).join('<br>')
    : `<em>No ID files uploaded</em>`;
    
  const cvDisplay = provider.cvUrl 
    ? `<a href="${normalizeUrl(provider.cvUrl)}" target="_blank" rel="noopener noreferrer">Download CV ↗</a>`
    : `<em>No CV uploaded</em>`;
    
  const workLinksDisplay = (provider.workLinks && provider.workLinks.length > 0)
    ? provider.workLinks.map((url, index) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener noreferrer">Work Sample ${index + 1} ↗</a>`).join('<br>')
    : `<em>No work samples provided</em>`;
  
  // Payout information
  let payoutDisplay = `<em>No payout information</em>`;
  if (provider.payout && provider.payoutCountry) {
    if (provider.payoutCountry === 'IN' && provider.payout.india) {
      const india = provider.payout.india;
      payoutDisplay = `<strong>India Banking:</strong><br>
        Account Holder: ${formatValue(india.acctName)}<br>
        Bank: ${formatValue(india.bankName)}<br>
        Account: ${india.acctNumber ? '****' + india.acctNumber.slice(-4) : 'Not provided'}<br>
        IFSC: ${formatValue(india.ifsc)}<br>
        PAN: ${formatValue(india.pan)}<br>
        ${india.upi ? 'UPI: ' + india.upi + '<br>' : ''}
        ${india.gstin ? 'GSTIN: ' + india.gstin + '<br>' : ''}
        ${india.bankProofUrl ? `<a href="${normalizeUrl(india.bankProofUrl)}" target="_blank" rel="noopener noreferrer">Bank Proof ↗</a>` : ''}`;
    } else if (provider.payout.international) {
      const intl = provider.payout.international;
      payoutDisplay = `<strong>International Banking:</strong><br>
        Account Holder: ${formatValue(intl.intlAcctName)}<br>
        IBAN: ${intl.iban ? intl.iban.substring(0, 8) + '...' : 'Not provided'}<br>
        SWIFT: ${formatValue(intl.swift)}<br>
        ${intl.routing ? 'Routing: ' + intl.routing + '<br>' : ''}
        ${intl.altPayoutType ? 'Alternative: ' + intl.altPayoutType + ' - ' + intl.altPayoutId + '<br>' : ''}`;
    }
  }
  
  // Status change info
  const statusInfo = provider.statusChanged ? `
    <div class="detail-item">
      <span class="detail-label">Status Changed:</span>
      <span class="detail-value">${provider.statusChanged.toLocaleDateString()} ${provider.statusChanged.toLocaleTimeString()}</span>
    </div>
    ${provider.comments ? `<div class="detail-item">
      <span class="detail-label">Admin Comments:</span>
      <span class="detail-value">${provider.comments}</span>
    </div>` : ''}
  ` : '';
  
  // Tier information
  const tierInfo = provider.tier ? `
    <div class="detail-item tier-info">
      <span class="detail-label">Provider Tier:</span>
      <span class="detail-value">${this.createTierBadge(provider.tier, true)}</span>
    </div>
    ${provider.tierAssignedDate ? `<div class="detail-item">
      <span class="detail-label">Tier Assigned:</span>
      <span class="detail-value">Assigned by ${this.getAdminName(provider.tierAssignedBy)} on ${provider.tierAssignedDate.toLocaleDateString()}</span>
    </div>` : ''}
  ` : (provider.approvalStatus === 'approved' ? `
    <div class="detail-item tier-info">
      <span class="detail-label">Provider Tier:</span>
      <span class="detail-value"><em>No tier assigned</em></span>
    </div>
  ` : '');
  
  // COMPREHENSIVE PROVIDER DETAILS
  detailsContainer.innerHTML = `
    <div class="provider-details-comprehensive">
      <!-- STEP 1: Identity & Contact -->
      <div class="detail-section">
        <h4>Identity & Contact Information</h4>
        <div class="detail-item">
          <span class="detail-label">Full Legal Name:</span>
          <span class="detail-value">${formatValue(provider.fullName)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Name on ID:</span>
          <span class="detail-value">${formatValue(provider.nameOnId)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Gender:</span>
          <span class="detail-value">${formatValue(provider.gender)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${formatValue(provider.email)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Phone:</span>
          <span class="detail-value">${formatValue(provider.phone)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Country:</span>
          <span class="detail-value">${formatValue(provider.country)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">City:</span>
          <span class="detail-value">${formatValue(provider.city)}</span>
        </div>
      </div>
      
      <!-- STEP 2: KYC & Profile -->
      <div class="detail-section">
        <h4>KYC & Verification</h4>
        <div class="detail-item">
          <span class="detail-label">Government ID Files:</span>
          <div class="detail-value">${idFilesDisplay}</div>
        </div>
        <div class="detail-item">
          <span class="detail-label">Experience:</span>
          <span class="detail-value">${formatValue(provider.experience)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Primary Domain:</span>
          <span class="detail-value">${formatValue(provider.primaryDomain)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Specialization Tags:</span>
          <span class="detail-value">${formatValue(provider.specialisations)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tools & Skills:</span>
          <span class="detail-value">${formatValue(provider.toolsSkills)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Package Collaboration:</span>
          <span class="detail-value">${get(provider, 'profile.openToCollaboration', false) ? '<span style="color:#22c55e;font-weight:600;">✓ Yes, Open</span>' : '<span style="opacity:.6;">No</span>'}</span>
        </div>
      </div>
      
      ${provider.primaryDomain === 'media' ? `
      <div class="detail-section">
        <h4>Media Expertise</h4>
        <div class="detail-item">
          <span class="detail-label">Media Specialization:</span>
          <span class="detail-value">${formatValue(provider.mediaSpecialization)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Media Sub-Skills:</span>
          <span class="detail-value">${formatValue(provider.mediaSubSkills)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Equipment:</span>
          <span class="detail-value">${formatValue(provider.equipment)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Media Work Types:</span>
          <span class="detail-value">${formatArray(provider.mediaWorkTypes)}</span>
        </div>
      </div>
      ` : ''}
      
      ${provider.primaryDomain === 'tech' ? `
      <div class="detail-section">
        <h4>Tech Expertise</h4>
        <div class="detail-item">
          <span class="detail-label">Tech Specialization:</span>
          <span class="detail-value">${formatValue(provider.techSpecialization)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tech Stack:</span>
          <span class="detail-value">${formatValue(provider.techStack)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Project Types:</span>
          <span class="detail-value">${formatValue(provider.projectTypes)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tech Project Types:</span>
          <span class="detail-value">${formatArray(provider.techProjectTypes)}</span>
        </div>
      </div>
      ` : ''}
      
      <!-- STEP 3: Work Evidence -->
      <div class="detail-section">
        <h4>Work Evidence & Portfolio</h4>
        <div class="detail-item">
          <span class="detail-label">Portfolio URL:</span>
          <span class="detail-value">${formatUrl(provider.portfolio || provider.mediaPortfolioUrl || provider.techPortfolioUrl, 'View Portfolio')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">CV/Resume:</span>
          <div class="detail-value">${cvDisplay}</div>
        </div>
        <div class="detail-item">
          <span class="detail-label">Work Sample Links:</span>
          <div class="detail-value">${workLinksDisplay}</div>
        </div>
      </div>
      
      <!-- STEP 4: Payout -->
      <div class="detail-section">
        <h4>Payout Information</h4>
        <div class="detail-item">
          <span class="detail-label">Payout Country:</span>
          <span class="detail-value">${formatValue(provider.payoutCountry)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Banking Details:</span>
          <div class="detail-value">${payoutDisplay}</div>
        </div>
      </div>
      
     
      
      <!-- System Information -->
      <div class="detail-section">
        <h4>System Information</h4>
        <div class="detail-item">
          <span class="detail-label">Registration Date:</span>
          <span class="detail-value">${provider.createdAt.toLocaleDateString()} ${provider.createdAt.toLocaleTimeString()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Last Updated:</span>
          <span class="detail-value">${provider.updatedAt.toLocaleDateString()} ${provider.updatedAt.toLocaleTimeString()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Current Status:</span>
          <span class="detail-value provider-status status-${provider.approvalStatus}">${provider.approvalStatus.charAt(0).toUpperCase() + provider.approvalStatus.slice(1)}</span>
        </div>
        ${tierInfo}
        ${statusInfo}
      </div>
      
      <!-- CHANGE REQUEST SECTION -->
      <div class="detail-section">
        <h4>Change Requests</h4>
        <div id="provider-feedback-filter"></div>
        <div id="provider-feedback-list"></div>
        <div id="provider-feedback-empty" style="display:none;">
          <em>No change requests for this provider</em>
        </div>
      </div>
    </div>
  `;
  
  // Show/hide action buttons based on status
  // Show/hide action buttons based on status
 // Show/hide action buttons based on status
const approveBtn = document.getElementById('approve-btn');
const rejectBtn = document.getElementById('reject-btn');
const resetBtn = document.getElementById('reset-btn');
const changeTierBtn = document.getElementById('change-tier-btn');
const requestChangesBtn = document.getElementById('request-changes-btn');
if (requestChangesBtn) {
    requestChangesBtn.style.display = 'inline-block';
    requestChangesBtn.onclick = () => this.openRequestChanges(provider.id);
}
 // ADD THIS

if (provider.approvalStatus === 'pending') {
  approveBtn.style.display = 'block';
  rejectBtn.style.display = 'block';
  resetBtn.style.display = 'none';
  changeTierBtn.style.display = 'none';
  if (requestChangesBtn) requestChangesBtn.style.display = 'inline-block'; // ADD THIS
} else {
  approveBtn.style.display = 'none';
  rejectBtn.style.display = 'none';
  resetBtn.style.display = 'block';
  changeTierBtn.style.display = provider.approvalStatus === 'approved' ? 'block' : 'none';
  if (requestChangesBtn) requestChangesBtn.style.display = 'inline-block'; // ADD THIS
}

  
  modal.style.display = 'flex';
  
  // Load and render Change Requests
  this.loadAndRenderChangeRequests(provider);
}
  // ============================================
  // CHANGE REQUEST METHODS - ADD THESE AFTER showProviderModal
  // ============================================
  
  // Helper methods for dates and values
  defaultDueDate(days = 3) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  isOverdue(ts) {
    if (!ts) return false;
    const d = ts instanceof Date ? ts : (ts.toDate?.() || new Date(ts));
    return Date.now() > d.getTime();
  }

  formatDueDate(ts) {
    if (!ts) return '';
    const d = ts instanceof Date ? ts : (ts.toDate?.() || new Date(ts));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  // Load feedback requests
  async loadFeedbackRequests(providerId) {
    const snap = await db.collection('providers')
      .doc(providerId)
      .collection('feedback_requests')
      .orderBy('requestedAt', 'desc')
      .limit(10)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Value comparison helpers
  getOldValue(request, fieldPath) {
    if (request.oldValues && Object.prototype.hasOwnProperty.call(request.oldValues, fieldPath)) {
      return request.oldValues[fieldPath];
    }
    return undefined;
  }

  getCurrentValue(provider, fieldPath) {
    return rcRead(provider, fieldPath);
  }

  hasValueChanged(oldVal, newVal) {
    if (oldVal == null || oldVal === undefined) {
      return newVal != null && newVal !== undefined && newVal !== '';
    }
    if (newVal == null || newVal === undefined) {
      return oldVal != null && oldVal !== undefined && oldVal !== '';
    }
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    }
    if (typeof oldVal === 'object' && typeof newVal === 'object') {
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    }
    return String(oldVal).trim() !== String(newVal).trim();
  }

  formatFieldValue(value) {
    if (value == null || value === undefined) {
      return `<em class="empty-value">not provided</em>`;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return `<em class="empty-value">empty list</em>`;
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return `<code class="object-value">object</code>`;
    }
    const str = String(value).trim();
    if (!str) return `<em class="empty-value">empty</em>`;
    if (str.length > 100) {
      return str.substring(0, 100) + ` <span class="truncated">...</span>`;
    }
    return str;
  }

  // Load and render change requests in provider modal
  async loadAndRenderChangeRequests(provider) {
    try {
      const requests = await this.loadFeedbackRequests(provider.id);
      await this.renderFeedbackList(provider, requests);
      this.setupLiveUpdates(provider);
    } catch (error) {
      console.error('Error loading change requests:', error);
      const empty = document.getElementById('provider-feedback-empty');
      const list = document.getElementById('provider-feedback-list');
      if (empty && list) {
        list.innerHTML = '';
        empty.style.display = 'block';
      }
    }
  }

  // Setup live Firebase listeners
  setupLiveUpdates(provider) {
    // Clean up existing listeners
    if (this.unsubProv) this.unsubProv();
    if (this.unsubReq) this.unsubReq();
    
    this.liveProv = provider;
    
    // Live provider snapshot
    this.unsubProv = db.collection('providers').doc(provider.id)
      .onSnapshot(doc => {
        this.liveProv = doc.exists() ? { id: provider.id, ...doc.data() } : { id: provider.id };
        this.queueRCRender(this.liveProv, this.lastReqs);
      });
    
    // Live change-requests list
    this.unsubReq = db.collection('providers').doc(provider.id)
      .collection('feedback_requests')
      .orderBy('requestedAt', 'desc')
      .limit(10)
      .onSnapshot(qs => {
        this.lastReqs = qs.docs.map(d => ({ id: d.id, ...d.data() }));
        this.queueRCRender(this.liveProv || provider, this.lastReqs);
      });
  }

  // Debounced render queue
  queueRCRender(provider, requests) {
    if (this.rcRenderTimeout) clearTimeout(this.rcRenderTimeout);
    this.rcRenderTimeout = setTimeout(() => {
      this.renderFeedbackList(provider, requests);
    }, 100);
  }

  // Render feedback list with cards
  async renderFeedbackList(provider, requests) {
    const list = document.getElementById('provider-feedback-list');
    const empty = document.getElementById('provider-feedback-empty');
    
    // Refresh provider data
    try {
      const liveSnap = await db.collection('providers').doc(provider.id).get();
      if (liveSnap.exists()) {
        provider = { ...provider, ...liveSnap.data() };
      }
    } catch (e) {
      console.warn('Could not refresh provider snapshot for diffs:', e);
    }
    
    // Filter setup
    const filterHost = document.getElementById('provider-feedback-filter');
    if (filterHost && !filterHost.dataset.bound) {
      filterHost.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
          ${['open', 'verified', 'closed', 'blocking', 'all'].map(f => 
            `<button type="button" class="rc-filter-btn" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`
          ).join('')}
        </div>
      `;
      filterHost.dataset.bound = '1';
      filterHost.addEventListener('click', (e) => {
        const btn = e.target.closest('.rc-filter-btn');
        if (!btn) return;
        this.feedbackFilter = btn.getAttribute('data-filter');
        filterHost.querySelectorAll('.rc-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderFeedbackList(provider, requests);
      });
    }
    
    if (!list) return;
    
    // Apply filtering
    const filter = this.feedbackFilter || 'open';
    let rows = Array.isArray(requests) ? requests.slice() : [];
    
    if (filter !== 'all') {
      rows = rows.filter(r => {
        if (filter === 'blocking') return !!r.blocking && (r.status === 'open' || r.status === 'verified');
        if (filter === 'open') return r.status === 'open' || r.status === 'submitted';
        return r.status === filter;
      });
    }
    
    if (!rows.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    
    if (empty) empty.style.display = 'none';
    
    // CARD RENDERING
    list.innerHTML = rows.map(r => {
      const items = r.items || [];
      const total = items.length;
      const verifiedCount = items.filter(it => it.status === 'verified').length;
      const pct = total ? Math.round((verifiedCount / total) * 100) : 0;
      const due = r.dueBy ? (r.dueBy.toDate?.() || new Date(r.dueBy)) : null;
      const isOverdue = due ? this.isOverdue(due) : false;
      const dueLabel = this.formatDueDate(due);
      
      return `
        <div class="feedback-request-card ${r.status} ${isOverdue ? 'overdue' : ''}" data-request-id="${r.id}">
          <div class="request-header">
            <div class="request-meta">
              <div class="request-status-row">
                ${r.blocking ? '<div class="blocking-indicator">⚠ BLOCKING</div>' : ''}
                <div class="status-chip status-${r.status} ${isOverdue ? 'overdue' : ''}">${r.status.toUpperCase()}</div>
                ${due ? `<div class="due-chip ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⏰ OVERDUE: ' : '📅 '}${dueLabel}</div>` : ''}
              </div>
              <div class="request-timestamp">Requested: ${(r.requestedAt?.toDate?.() || new Date(r.requestedAt)).toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="progress-section">
            <div class="progress-stats">
              <span class="progress-label">${verifiedCount}/${total} verified</span>
              <span class="progress-percent">${pct}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${pct}%"></div>
            </div>
          </div>
          
          <div class="request-message">
            <div class="message-content">${String(r.message || '').replace(/\n/g, '<br>')}</div>
          </div>
          
          <div class="fields-section">
            <div class="fields-header">
              <h4>Changes Required (${total})</h4>
            </div>
            <div class="fields-list">
              ${items.map(it => {
                const path = it.id;
                const oldVal = this.getOldValue(r, path);
                const newVal = this.getCurrentValue(provider, path);
                const changed = this.hasValueChanged(oldVal, newVal);
                const isVerified = it.status === 'verified';
                
                return `
                  <div class="field-item ${isVerified ? 'verified' : 'pending'} ${changed ? 'changed' : 'unchanged'}">
                    <div class="field-header">
                      ${!isVerified ? `<input type="checkbox" class="rc-verify-checkbox" data-request="${r.id}" data-field="${path}">` : ''}
                      <div class="field-info">
                        <div class="field-name">${RC_LABEL[path] || it.label || path}</div>
                        <div class="field-status-chip ${isVerified ? 'verified' : 'pending'}">${it.status}</div>
                      </div>
                    </div>
                    <div class="value-comparison">
                      <div class="value-row old-value ${changed ? 'changed' : ''}">
                        <span class="value-label">Original:</span>
                        <span class="value-content">${this.formatFieldValue(oldVal)}</span>
                      </div>
                      <div class="value-row new-value ${changed ? 'changed' : ''}">
                        <span class="value-label">Updated:</span>
                        <span class="value-content">${this.formatFieldValue(newVal)}</span>
                        ${changed ? '<span class="change-indicator">✓ Updated</span>' : '<span class="no-change-indicator">⚠ No change yet</span>'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <div class="action-bar">
            <div class="action-group primary">
              ${r.status !== 'verified' ? `
                <button class="action-btn primary verify-all" data-verify-request="${r.id}">
                  <span class="btn-text">Verify All</span>
                </button>
              ` : ''}
              ${items.some(it => it.status !== 'verified') ? `
                <button class="action-btn secondary verify-selected" data-verify-select="${r.id}">
                  <span class="btn-text">Verify Selected</span>
                </button>
              ` : ''}
            </div>
            <div class="action-group secondary">
              ${r.status !== 'closed' ? `
                <button class="action-btn danger close-request" data-close-request="${r.id}">
                  <span class="btn-text">Close Request</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Event listeners
    this.attachFeedbackListeners(list);
  }

  // Attach event listeners to feedback cards
  attachFeedbackListeners(list) {
    // Verify All buttons
    list.querySelectorAll('.verify-all').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const requestId = e.currentTarget.getAttribute('data-verify-request');
        await this.verifyChangeRequest(this.currentProvider.id, requestId, true);
      });
    });
    
    // Verify Selected buttons
    list.querySelectorAll('.verify-selected').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reqId = e.currentTarget.getAttribute('data-verify-select');
        const checked = Array.from(list.querySelectorAll(`.rc-verify-checkbox[data-request="${reqId}"]:checked`))
          .map(el => el.getAttribute('data-field'));
        if (!checked.length) {
          alert('Select at least one field to verify');
          return;
        }
        await this.verifyChangeRequest(this.currentProvider.id, reqId, false, checked);
      });
    });
    
    // Close Request buttons
    list.querySelectorAll('.close-request').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const requestId = e.currentTarget.getAttribute('data-close-request');
        await this.closeChangeRequest(this.currentProvider.id, requestId);
      });
    });
  }

  // Verify change request
  async verifyChangeRequest(providerId, requestId, all = false, ids = []) {
    const provRef = db.collection('providers').doc(providerId);
    const reqRef = provRef.collection('feedback_requests').doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists()) return;
    
    const req = snap.data();
    const provSnapNow = await provRef.get();
    const provNow = provSnapNow.data() || {};
    
    const newValues = {};
    (req.fields || (req.items || []).map(x => x.id) || []).forEach(p => {
      const val = rcRead(provNow, p);
      newValues[p] = val !== undefined ? val : null;
    });
    
    const items = (req.items || []).map(it => {
      if (all || ids.includes(it.id)) {
        return { ...it, status: 'verified' };
      }
      return it;
    });
    
    const allVerified = items.every(it => it.status === 'verified');
    const nextStatus = allVerified ? 'verified' : 'open';
    
    await reqRef.update({
      items,
      newValues,
      status: nextStatus,
      verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      verifiedBy: this.currentAdmin.uid,
      verifiedByName: this.currentAdmin.name || this.currentAdmin.email
    });
    
    const providerUpdates = {
      lastFeedback: { ...req, items, status: nextStatus },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (allVerified) {
      providerUpdates.hasOpenBlockingFeedback = false;
      providerUpdates.pendingFeedbackCount = 0;
      providerUpdates.status = 'waiting';
      providerUpdates.statusChanged = firebase.firestore.FieldValue.serverTimestamp();
    }
    
    await provRef.update(providerUpdates);
    await this.loadProvidersFromFirebase();
    this.renderProviders();
    
    if (this.currentProvider && this.currentProvider.id === providerId) {
      this.showProviderModal(this.providers.find(p => p.id === providerId));
    }
    
    this.showSuccessMessage(allVerified ? 'All items verified!' : 'Selected items verified.');
  }

  // Close change request
  async closeChangeRequest(providerId, requestId) {
    const provRef = db.collection('providers').doc(providerId);
    const reqRef = provRef.collection('feedback_requests').doc(requestId);
    const snap = await reqRef.get();
    if (!snap.exists()) return;
    
    const req = snap.data();
    await reqRef.update({ status: 'closed' });
    
    if (req.blocking) {
      await provRef.update({ hasOpenBlockingFeedback: false });
    }
    
    await this.loadProvidersFromFirebase();
    this.renderProviders();
    
    if (this.currentProvider && this.currentProvider.id === providerId) {
      this.showProviderModal(this.providers.find(p => p.id === providerId));
    }
    
    this.showSuccessMessage('Request closed.');
  }

  // Open Request Changes modal
  openRequestChanges(providerId) {
      console.log(`Requesting changes for provider: ${providerId}`);
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return;
    
    this.currentProvider = provider;
    
    const msgEl = document.getElementById('rc-message');
    const dueEl = document.getElementById('rc-due-date');
    const blockEl = document.getElementById('rc-blocking');
    
    if (msgEl) msgEl.value = '';
    if (blockEl) blockEl.checked = true;
    
    const def = this.defaultDueDate(3);
    if (dueEl) dueEl.valueAsDate = def;
    
    this.renderGroupedRCFields();
    
    document.getElementById('request-changes-modal').style.display = 'flex';
  }

  // Render grouped RC fields
  renderGroupedRCFields() {
    const mount = document.getElementById('rc-fields-list');
    if (!mount) return;
    
    const groups = rcGetGroupedFieldCatalog();
    
    mount.innerHTML = `
      <div id="rc-field-filter" style="margin-bottom:8px">
        <input id="rc-field-search" placeholder="Search fields..." style="width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:8px">
      </div>
      ${groups.map((g, gi) => `
        <details class="rc-group" open>
          <summary style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <strong>${g.title}</strong>
            <span style="margin-left:auto;display:flex;gap:8px">
              <button type="button" class="rc-group-select" data-gi="${gi}">Select All</button>
              <button type="button" class="rc-group-clear" data-gi="${gi}">Clear</button>
            </span>
          </summary>
          <div class="rc-group-grid" style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px">
            ${g.items.map(it => `
              <label class="rc-field-row" style="display:flex;gap:8px;align-items:center;border:1px solid #ccc;padding:8px;border-radius:8px">
                <input class="rc-field" type="checkbox" value="${it.id}" data-label="${it.label}">
                <span>${it.label}</span>
              </label>
            `).join('')}
          </div>
        </details>
      `).join('')}
    `;
    
    mount.querySelectorAll('.rc-group-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gi = e.currentTarget.getAttribute('data-gi');
        mount.querySelectorAll(`details.rc-group:nth-of-type(${Number(gi)+1}) .rc-field`).forEach(cb => cb.checked = true);
      });
    });
    
    mount.querySelectorAll('.rc-group-clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gi = e.currentTarget.getAttribute('data-gi');
        mount.querySelectorAll(`details.rc-group:nth-of-type(${Number(gi)+1}) .rc-field`).forEach(cb => cb.checked = false);
      });
    });
    
    const search = mount.querySelector('#rc-field-search');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      mount.querySelectorAll('.rc-field-row').forEach(row => {
        const label = row.textContent.toLowerCase();
        row.style.display = label.includes(q) ? 'flex' : 'none';
      });
    });
  }

  // Send request changes
  async sendRequestChanges() {
    const provider = this.currentProvider;
    if (!provider) return;
    
    const msg = document.getElementById('rc-message')?.value.trim();
    if (!msg) {
      alert('Enter a message');
      return;
    }
    
    const blocking = !!document.getElementById('rc-blocking')?.checked;
    const dueEl = document.getElementById('rc-due-date');
    const dueBy = dueEl && dueEl.value ? new Date(dueEl.value + 'T23:59:59') : null;
    
    const fieldEls = Array.from(document.querySelectorAll('#rc-fields-list .rc-field:checked'));
    if (fieldEls.length === 0) {
      alert('Select at least one field');
      return;
    }
    
    const items = fieldEls.map(el => ({
      id: el.value,
      label: RC_LABEL[el.value] || el.dataset.label || el.value,
      status: 'open'
    }));
    
    try {
      const provSnapForOld = await db.collection('providers').doc(provider.id).get();
      const provDataForOld = provSnapForOld.data() || {};
      
      const oldValues = {};
      items.forEach(it => {
        const oldVal = rcRead(provDataForOld, it.id);
        oldValues[it.id] = oldVal !== undefined ? oldVal : null;
      });
      
      const provRef = db.collection('providers').doc(provider.id);
      const reqRef = provRef.collection('feedback_requests').doc();
      
      const reqData = {
        message: msg,
        fields: items.map(i => i.id),
        items,
        blocking,
        dueBy: dueBy ? firebase.firestore.Timestamp.fromDate(dueBy) : null,
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
        requestedBy: this.currentAdmin.uid,
        requestedByName: this.currentAdmin.name || this.currentAdmin.email,
        status: 'open',
        oldValues
      };
      
      await reqRef.set(reqData);
      
      await provRef.update({
        status: 'needs_changes',
        statusChanged: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastFeedback: {
          message: msg,
          fields: items.map(i => i.id),
          items: items,
          dueBy: reqData.dueBy,
          requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
          requestedBy: this.currentAdmin.uid,
          requestedByName: this.currentAdmin.name || this.currentAdmin.email,
          blocking
        },
        pendingFeedbackCount: firebase.firestore.FieldValue.increment(items.length),
        ...(blocking ? { hasOpenBlockingFeedback: true } : {})
      });
      
      document.getElementById('rc-message').value = '';
      document.getElementById('rc-due-date').value = '';
      document.getElementById('rc-blocking').checked = false;
      document.querySelectorAll('#rc-fields-list .rc-field').forEach(cb => cb.checked = false);
      
      this.showSuccessMessage('Change request sent.');
      
      const updated = await this.loadFeedbackRequests(provider.id);
      this.renderFeedbackList(provider, updated);
    } catch (e) {
      console.error('Error requesting changes:', e);
      alert('Could not send change request. Please try again.');
    }
  }

    
    // Get admin name for display (EXISTING - UNCHANGED)
    getAdminName(adminUid) {
        if (this.currentAdmin && this.currentAdmin.uid === adminUid) {
            return this.currentAdmin.name || 'Admin';
        }
        return 'Admin';
    }
    
    // Show confirmation modal (EXISTING - UNCHANGED)
    showConfirmModal(action, provider) {
        this.currentAction = action;
        
        const modal = document.getElementById('confirm-modal');
        const title = document.getElementById('confirm-title');
        const message = document.getElementById('confirm-message');
        const notesTextarea = document.getElementById('admin-notes');
        const tierDisplay = document.getElementById('confirm-tier-display');
        const tierBadge = document.getElementById('confirm-tier-badge');
        
        if (action === 'approve') {
            title.textContent = 'Approve Provider';
            message.textContent = `Are you sure you want to approve ${provider.name}? They will gain full access to the Pro X platform.`;
            notesTextarea.placeholder = 'Optional approval notes (e.g., "Great portfolio", "Pilot provider", etc.)...';
            
            // Show selected tier
            if (this.selectedTier) {
                tierBadge.innerHTML = this.createTierBadge(this.selectedTier, true);
                tierDisplay.style.display = 'block';
            } else {
                tierDisplay.style.display = 'none';
            }
        } else if (action === 'reject') {
            title.textContent = 'Reject Provider';
            message.textContent = `Are you sure you want to reject ${provider.name}? Please provide a reason in the comments below.`;
            notesTextarea.placeholder = 'Required: Reason for rejection (e.g., "Incomplete portfolio", "Does not meet criteria")...';
            tierDisplay.style.display = 'none';
        } else if (action === 'reset') {
            title.textContent = 'Reset to Pending';
            message.textContent = `Are you sure you want to reset ${provider.name} back to pending status? This will remove their tier assignment and require re-review.`;
            notesTextarea.placeholder = 'Optional: Reason for reset (e.g., "Need additional review", "Status correction", etc.)...';
            tierDisplay.style.display = 'none';
        }
        
        notesTextarea.value = '';
        modal.style.display = 'flex';
    }
    
    // Quick action functions (EXISTING - UNCHANGED)
    quickApprove(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (provider) {
            this.showTierSelectionModal(provider, 'approve');
        }
    }
    
    quickReject(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (provider) {
            this.currentProvider = provider;
            this.showConfirmModal('reject', provider);
        }
    }
    
    quickReset(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (provider) {
            this.currentProvider = provider;
            this.showConfirmModal('reset', provider);
        }
    }
    
    // Change tier for approved provider (EXISTING - UNCHANGED)
    changeTier(providerId) {
        const provider = this.providers.find(p => p.id === providerId);
        if (provider) {
            this.showTierSelectionModal(provider, 'change-tier');
        }
    }
    
    // ENHANCED: Update stats for all three tabs
    updateStats() {
        if (this.currentTab === 'providers') {
            const stats = {
                total: this.providers.length,
                pending: this.providers.filter(p => p.approvalStatus === 'pending').length,
                approved: this.providers.filter(p => p.approvalStatus === 'approved').length,
                rejected: this.providers.filter(p => p.approvalStatus === 'rejected').length
            };
            
            document.getElementById('total-providers').textContent = stats.total;
            document.getElementById('pending-providers').textContent = stats.pending;
            document.getElementById('approved-providers').textContent = stats.approved;
            document.getElementById('rejected-providers').textContent = stats.rejected;
        } else if (this.currentTab === 'enquiries') {
            const stats = {
                total: this.enquiries.length,
                new: this.enquiries.filter(e => e.status === 'new').length,
                contacted: this.enquiries.filter(e => e.status === 'contacted').length,
                converted: this.enquiries.filter(e => e.status === 'converted').length
            };
            
            document.getElementById('total-enquiries').textContent = stats.total;
            document.getElementById('new-enquiries').textContent = stats.new;
            document.getElementById('contacted-enquiries').textContent = stats.contacted;
            document.getElementById('converted-enquiries').textContent = stats.converted;
        } else if (this.currentTab === 'notifications') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const stats = {
                total: this.notifications.length,
                today: this.notifications.filter(n => n.sentAt >= today).length,
                customers: this.notifications.filter(n => n.topic === 'customers').length,
                providers: this.notifications.filter(n => n.topic === 'providers').length
            };
            
            document.getElementById('total-notifications').textContent = stats.total;
            document.getElementById('notifications-today').textContent = stats.today;
            document.getElementById('customer-notifications').textContent = stats.customers;
            document.getElementById('provider-notifications').textContent = stats.providers;
        }
    }

    // Render providers (EXISTING - UNCHANGED)
    renderProviders() {
        const container = document.getElementById('providers-container');
        const loadingState = document.getElementById('providers-loading-state');
        const emptyState = document.getElementById('providers-empty-state');
        
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        container.innerHTML = '';
        
        // Filter providers
        let filteredProviders = this.providers;
        
        if (this.currentFilter !== 'all') {
            filteredProviders = filteredProviders.filter(p => p.approvalStatus === this.currentFilter);
        }
        
        if (this.searchTerm) {
            filteredProviders = filteredProviders.filter(p => 
                p.name.toLowerCase().includes(this.searchTerm) ||
                p.email.toLowerCase().includes(this.searchTerm) ||
                p.username.toLowerCase().includes(this.searchTerm) ||
                p.cityOfOperation.toLowerCase().includes(this.searchTerm)
            );
        }
        
        if (filteredProviders.length === 0) {
            emptyState.style.display = 'block';
            return;
        }
        
        filteredProviders.forEach(provider => {
            const providerCard = this.createProviderCard(provider);
            container.appendChild(providerCard);
        });
    }

// Initialize event listeners (ENHANCED: +Service Reviews +Cancellations)
    // Initialize event listeners (ENHANCED with service reviews & cancellations)
    initEventListeners() {
        // Featured provider modal close handlers
        document.getElementById('featured-provider-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'featured-provider-modal') {
                e.target.style.display = 'none';
            }
        });

        document.querySelector('#featured-provider-modal .modal-close')?.addEventListener('click', () => {
            document.getElementById('featured-provider-modal').style.display = 'none';
        });

        document.querySelector('#featured-provider-modal .modal-cancel')?.addEventListener('click', () => {
            document.getElementById('featured-provider-modal').style.display = 'none';
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogout();
        });

        // Tab switching — now includes Service Reviews + Cancellations
        document.getElementById('providers-tab')?.addEventListener('click', () => {
        this.switchToProviders();
        });
        document.getElementById('enquiries-tab')?.addEventListener('click', () => {
        this.switchToEnquiries();
        });
        document.getElementById('notifications-tab')?.addEventListener('click', () => {
        this.switchToNotifications();
        });
        document.getElementById('service-reviews-tab')?.addEventListener('click', () => {
        this.switchToServiceReviews();
        });
        document.getElementById('cancellations-tab')?.addEventListener('click', () => {
        this.switchToCancellations();
        });
        document.getElementById('featured-providers-tab')?.addEventListener('click', () => this.switchToFeaturedProviders());
    
        // Provider filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            this.currentFilter = e.currentTarget.dataset.status;
            this.renderProviders();
        });
        });
    
        // Enquiry filter tabs
        document.querySelectorAll('.enquiry-filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.enquiry-filter-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            this.currentEnquiryFilter = e.currentTarget.dataset.status;
            this.renderEnquiries();
        });
        });
    
        // Searches
        document.getElementById('search-providers')?.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderProviders();
        });
        document.getElementById('search-enquiries')?.addEventListener('input', (e) => {
        this.enquirySearchTerm = e.target.value.toLowerCase();
        this.renderEnquiries();
        });
    
        // Refresh buttons
        document.getElementById('refresh-providers-btn')?.addEventListener('click', () => {
        this.refreshProviders?.();
        });
        document.getElementById('refresh-enquiries-btn')?.addEventListener('click', () => {
        this.refreshEnquiries?.();
        });
    
        // Service Reviews: search + refresh (matches your dashboard.html)
        document.getElementById('search-reviews')?.addEventListener('input', (e) => {
        this.serviceReviewSearch = (e.target.value || '').trim().toLowerCase();
        this.renderServiceReviews?.();
        });
        document.getElementById('refresh-reviews-btn')?.addEventListener('click', () => {
        // re-wire snapshot (optional) or just re-render
        this.renderServiceReviews?.();
        });
    
        // Service Reviews: status chips
        document.querySelectorAll('.review-filter-tab')?.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.review-filter-tab').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            this.serviceReviewFilter = e.currentTarget.dataset.status || 'pending';
            this.renderServiceReviews?.();
        });
        });
    
        // Notifications (existing)
        document.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            this.handleTargetSelection(target);
        });
        });
        document.getElementById('notification-title')?.addEventListener('input', () => {
        this.updateCharCounters?.(); this.updateSendButton?.();
        });
        document.getElementById('notification-message')?.addEventListener('input', () => {
        this.updateCharCounters?.(); this.updateSendButton?.();
        });
        document.getElementById('send-notification-btn')?.addEventListener('click', () => {
        this.showNotificationConfirmModal?.();
        });
        document.getElementById('clear-composer-btn')?.addEventListener('click', () => {
        this.clearNotificationForm?.();
        });
        document.getElementById('confirm-send-btn')?.addEventListener('click', async () => {
        document.getElementById('notification-confirm-modal').style.display = 'none';
        await this.sendPushNotification?.();
        });
        document.getElementById('cancel-send-btn')?.addEventListener('click', () => {
        this.closeModal?.('notification-confirm-modal');
        });
        document.getElementById('history-filter')?.addEventListener('change', () => {
        this.renderNotificationHistory?.();
        });
    
       // Close “any” modal (also closes the request-changes modal)
document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
  btn.addEventListener('click', () => {
    this.closeModal?.('provider-modal');
    this.closeModal?.('enquiry-modal');
    this.closeModal?.('confirm-modal');
    this.closeModal?.('tier-selection-modal');
    this.closeModal?.('notification-confirm-modal');
    this.closeModal?.('request-changes-modal'); // ← include RC modal
  });
});
    
        // Provider modal actions (existing)
        document.getElementById('approve-btn')?.addEventListener('click', () => {
        this.showTierSelectionModal?.(this.currentProvider, 'approve');
        });
        document.getElementById('reject-btn')?.addEventListener('click', () => {
        this.showConfirmModal?.('reject', this.currentProvider);
        });
        document.getElementById('reset-btn')?.addEventListener('click', () => {
        this.showConfirmModal?.('reset', this.currentProvider);
        });
        document.getElementById('change-tier-btn')?.addEventListener('click', () => {
        this.changeTier?.(this.currentProvider?.id);
        });
        // Request Changes button
// Request Changes button - in initEventListeners method
// Request Changes button
const rcOpenBtn = document.getElementById('request-changes-btn');
if (rcOpenBtn) {
  rcOpenBtn.addEventListener('click', () => {
    const id = this.currentProvider ? this.currentProvider.id : null;
    if (!id) return alert('No provider selected.');
    this.openRequestChanges(id);
  });
}

// Send Request Changes button  
const rcSendBtn = document.getElementById('rc-send-btn');
if (rcSendBtn) {
  rcSendBtn.addEventListener('click', () => this.sendRequestChanges());
}
        // Enquiry modal actions (existing)
        document.getElementById('update-enquiry-status-btn')?.addEventListener('click', () => {
        this.updateEnquiryStatus?.();
        });
    
        // Tier selection (existing)
        document.querySelectorAll('.tier-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tier = e.currentTarget.dataset.tier;
            this.handleTierSelection?.(tier);
        });
        });
        document.getElementById('confirm-tier-btn')?.addEventListener('click', () => {
        this.confirmTierSelection?.();
        });
        document.getElementById('cancel-tier-btn')?.addEventListener('click', () => {
        this.closeModal?.('tier-selection-modal');
        });
    
        // Confirm modal (existing)
        document.getElementById('confirm-yes')?.addEventListener('click', () => {
        this.handleProviderAction?.();
        });
        document.getElementById('confirm-no')?.addEventListener('click', () => {
        this.closeModal?.('confirm-modal');
        });
    
        // Click-outside to close (existing)
        document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal?.(modal.id);
        });
        });
        document.getElementById('cancel-role-toggle')?.addEventListener('change', (e) => {
            const isCustomer = !e.target.checked;
            this.cancellationRole = isCustomer ? 'customer' : 'provider';
            document.getElementById('cancel-role-label').textContent = `Showing: ${isCustomer ? 'Customer' : 'Provider'}`;
            this.renderCancellations?.();
        });
        document.getElementById('cancel-approve')?.addEventListener('click', () => {
            this.handleCancellationDecision?.('approved');
        });
        document.getElementById('cancel-deny')?.addEventListener('click', () => {
            this.handleCancellationDecision?.('denied');
        });
        document.getElementById('cancel-refund-percent')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < 0 || value > 100) {
              e.target.value = '';
              alert('Please enter a refund % between 0 and 100.');
            }
        });

    }

    
    loadDashboard() {
        this.updateStats();
    
        if (this.currentTab === 'providers') {
            this.renderProviders?.();
        } else if (this.currentTab === 'enquiries') {
            this.renderEnquiries?.();
        } else if (this.currentTab === 'notifications') {
            this.renderNotificationHistory?.();
        } else if (this.currentTab === 'service-reviews') {
            this.initServiceReviewsSection?.();      // ✅ hydrate section + load reviews
            this.renderServiceReviews?.();           // ✅ render reviews
        } else if (this.currentTab === 'cancellations') {
            this.initCancellationsSection?.();       // ✅ hydrate section + load cancellations
            this.renderCancellations?.();            // ✅ render cancellations
        }
    }

    // Refresh data methods (ENHANCED)
    async refreshProviders() {
  try {
    // Show loading indicator
    const loading = document.getElementById('providers-loading-state');
    if (loading) loading.style.display = 'block';

    // Force fetch from server
    await this.loadProvidersFromFirebase({ source: 'server' });

    // Recalculate stats
    this.updateStats?.();

    // Re-render both main and approvals tables
    this.renderProviders?.();
    this.renderProviderApprovals?.();

    // Hide loading indicator
    if (loading) loading.style.display = 'none';

    this.showSuccessMessage?.('Latest provider data loaded successfully!');
  } catch (err) {
    console.error('Refresh failed:', err);
    this.showErrorMessage?.('Unable to refresh provider data. Check console.');
  }
}


    async refreshEnquiries() {
        await this.loadEnquiriesFromFirebase();
        this.updateEnquiryBadge();
        this.updateStats();
        this.renderEnquiries();
        this.showSuccessMessage('Enquiry data refreshed successfully!');
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 4000);
    }
}
// Initialize dashboard when page loads


// Make sure the cancel modal can be closed from the X button or backdrop
document.addEventListener('click', (e) => {
    const modal = document.getElementById('cancellation-modal');
    if (!modal) return;
  
    // Close when clicking the X
    if (e.target && e.target.id === 'cancel-modal-close') {
      modal.classList.remove('show');
    }
  
    // Close when clicking the backdrop (outside the dialog)
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });

  // ==================== PROVIDER REASSIGNMENTS FUNCTIONALITY ====================

// Global variables for reassignment flow
let currentReassignmentRequest = null;
let selectedNewProvider = null;
let availableProvidersData = [];

// Load reassignment requests
async function loadReassignments() {
    const container = document.getElementById('reassignments-list');
    const emptyState = document.getElementById('reassignments-empty');
    
    if (!container) return;

    try {
        // Query bookings where user chose replacement
        const snapshot = await db.collection('bookings')
            .where('cancelRequest.userChoice', '==', 'replacement')
            .where('cancelRequest.status', '==', 'pendingadmin')
            .orderBy('cancelRequest.timestamp', 'desc')
            .get();

        if (snapshot.empty) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = '';

        snapshot.forEach(doc => {
            const booking = doc.data();
            const card = createReassignmentCard(doc.id, booking);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading reassignments:', error);
        showNotification('Error loading reassignment requests', 'error');
    }
}

// Create reassignment request card
function createReassignmentCard(bookingId, booking) {
    const card = document.createElement('div');
    card.className = 'request-card reassignment-card';
    
    const cancelledBy = booking.cancelRequest?.by || 'Unknown';
    const reason = booking.cancelRequest?.reason || 'No reason provided';
    const timestamp = booking.cancelRequest?.timestamp?.toDate?.() || new Date();
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-title">
                <h3>${booking.serviceName || 'Service'}</h3>
                <span class="badge badge-warning">Pending Reassignment</span>
            </div>
            <div class="card-meta">
                <span class="booking-id">ID: ${bookingId.substring(0, 8)}</span>
                <span class="timestamp">${formatDate(timestamp)}</span>
            </div>
        </div>
        
        <div class="card-body">
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Customer:</span>
                    <span class="value">${booking.customerName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Original Provider:</span>
                    <span class="value">${booking.providerName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Cancelled By:</span>
                    <span class="value">${cancelledBy}</span>
                </div>
                <div class="info-item">
                    <span class="label">Service Date:</span>
                    <span class="value">${booking.selectedDate || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Service Time:</span>
                    <span class="value">${booking.selectedTime || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Original Cost:</span>
                    <span class="value">₹${booking.amount || 0}</span>
                </div>
            </div>
            
            <div class="cancellation-reason">
                <strong>Cancellation Reason:</strong>
                <p>${reason}</p>
            </div>
        </div>
        
        <div class="card-footer">
            <button class="btn-primary" onclick="openProviderSelection('${bookingId}')">
                Assign New Provider
            </button>
        </div>
    `;
    
    return card;
}

// Open provider selection modal
async function openProviderSelection(bookingId) {
    try {
        // Get booking details
        const bookingDoc = await db.collection('bookings').doc(bookingId).get();
        if (!bookingDoc.exists) {
            showNotification('Booking not found', 'error');
            return;
        }

        const booking = bookingDoc.data();
        currentReassignmentRequest = { id: bookingId, ...booking };

        // Populate booking details in modal
        document.getElementById('modal-service-name').textContent = booking.serviceName || 'N/A';
        document.getElementById('modal-date-time').textContent = 
            `${booking.selectedDate || 'N/A'} at ${booking.selectedTime || 'N/A'}`;
        document.getElementById('modal-original-provider').textContent = booking.providerName || 'N/A';
        document.getElementById('modal-original-cost').textContent = `₹${booking.amount || 0}`;

        // Show modal
        document.getElementById('provider-selection-modal').style.display = 'block';

        // Load available providers
        await loadAvailableProviders(booking);

    } catch (error) {
        console.error('Error opening provider selection:', error);
        showNotification('Error loading provider selection', 'error');
    }
}

// Load available providers for the service and time slot
async function loadAvailableProviders(booking) {
    const container = document.getElementById('available-providers-list');
    const loadingState = document.getElementById('providers-loading');
    
    loadingState.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(loadingState);

    try {
        // Get all providers who offer this service
        const providersSnapshot = await db.collection('providers')
            .where('status', '==', 'approved')
            .where('services', 'array-contains', booking.serviceId || booking.serviceName)
            .get();

        if (providersSnapshot.empty) {
            loadingState.style.display = 'none';
            container.innerHTML = '<div class="empty-state"><p>No available providers found for this service</p></div>';
            return;
        }

        availableProvidersData = [];
        const providerCheckPromises = [];

        // Check availability for each provider
        for (const doc of providersSnapshot.docs) {
            const provider = { id: doc.id, ...doc.data() };
            
            // Skip the original provider
            if (provider.id === booking.providerId) continue;

            providerCheckPromises.push(checkProviderAvailability(provider, booking));
        }

        const availabilityResults = await Promise.all(providerCheckPromises);
        availableProvidersData = availabilityResults.filter(p => p !== null);

        loadingState.style.display = 'none';

        if (availableProvidersData.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No available providers found for this time slot</p></div>';
            return;
        }

        // Display available providers
        container.innerHTML = '';
        availableProvidersData.forEach(provider => {
            const providerCard = createProviderCard(provider, booking);
            container.appendChild(providerCard);
        });

    } catch (error) {
        console.error('Error loading available providers:', error);
        loadingState.style.display = 'none';
        container.innerHTML = '<div class="empty-state"><p>Error loading providers. Please try again.</p></div>';
    }
}

// Check if provider is available for the booking time
async function checkProviderAvailability(provider, booking) {
    try {
        const bookingDate = booking.selectedDate;
        const bookingTime = booking.selectedTime;

        // Check if provider has availability set for this date
        const availabilitySnapshot = await db.collection('availability')
            .where('userId', '==', provider.id)
            .where('date', '==', bookingDate)
            .where('status', '==', 'available')
            .get();

        if (availabilitySnapshot.empty) {
            return null; // Provider not available on this date
        }

        // Check for conflicting bookings
        const conflictingBookings = await db.collection('bookings')
            .where('providerId', '==', provider.id)
            .where('selectedDate', '==', bookingDate)
            .where('selectedTime', '==', bookingTime)
            .where('status', 'in', ['Pending', 'Accepted', 'Ongoing'])
            .get();

        if (!conflictingBookings.empty) {
            return null; // Provider has conflicting booking
        }

        // Provider is available
        return provider;

    } catch (error) {
        console.error('Error checking provider availability:', error);
        return null;
    }
}

// Create provider selection card
function createProviderCard(provider, booking) {
    const card = document.createElement('div');
    card.className = 'provider-card';
    
    const providerCost = calculateProviderCost(provider, booking);
    const costDifference = providerCost - (booking.amount || 0);
    const costDiffClass = costDifference > 0 ? 'cost-higher' : costDifference < 0 ? 'cost-lower' : 'cost-same';
    
    card.innerHTML = `
        <div class="provider-photo">
            <img src="${provider.profilePhoto || '/assets/images/default-avatar.png'}" 
                 alt="${provider.name}" 
                 onerror="this.src='/assets/images/default-avatar.png'">
        </div>
        <div class="provider-info">
            <h4>${provider.name || 'Provider'}</h4>
            <div class="provider-rating">
                <span class="stars">${'⭐'.repeat(Math.round(provider.rating || 0))}</span>
                <span class="rating-number">${(provider.rating || 0).toFixed(1)}</span>
            </div>
            <p class="provider-phone">${provider.phone || 'N/A'}</p>
            <div class="provider-cost">
                <span class="cost-label">Cost:</span>
                <span class="cost-value">₹${providerCost}</span>
                <span class="cost-diff ${costDiffClass}">
                    ${costDifference > 0 ? '+' : ''}₹${costDifference}
                </span>
            </div>
        </div>
        <div class="provider-actions">
            <button class="btn-primary btn-select-provider" 
                    onclick="selectProvider('${provider.id}', ${providerCost})">
                Select Provider
            </button>
        </div>
    `;
    
    return card;
}

// Calculate provider cost for the service
function calculateProviderCost(provider, booking) {
    // This is a simplified calculation. Adjust based on your actual pricing structure
    // You may need to fetch service pricing from the services collection
    
    // For now, return the original booking amount as a fallback
    // In production, you'd fetch the provider's specific pricing for this service
    return booking.amount || 0;
}

// Select a provider
function selectProvider(providerId, cost) {
    const provider = availableProvidersData.find(p => p.id === providerId);
    if (!provider) {
        showNotification('Provider not found', 'error');
        return;
    }

    selectedNewProvider = { ...provider, cost };
    
    // Close provider selection modal
    document.getElementById('provider-selection-modal').style.display = 'none';
    
    // Show cost comparison modal
    showCostComparisonModal();
}

// Show cost comparison modal
function showCostComparisonModal() {
    const originalCost = currentReassignmentRequest.amount || 0;
    const newCost = selectedNewProvider.cost;
    const difference = newCost - originalCost;

    document.getElementById('comparison-original-cost').textContent = `₹${originalCost}`;
    document.getElementById('comparison-new-cost').textContent = `₹${newCost}`;
    document.getElementById('comparison-difference').textContent = 
        `${difference > 0 ? '+' : ''}₹${difference}`;
    document.getElementById('comparison-difference').className = 
        difference > 0 ? 'cost-value cost-higher' : difference < 0 ? 'cost-value cost-lower' : 'cost-value';

    document.getElementById('comparison-provider-name').textContent = selectedNewProvider.name;
    document.getElementById('comparison-provider-rating').textContent = 
        `${(selectedNewProvider.rating || 0).toFixed(1)} ⭐`;

    document.getElementById('cost-comparison-modal').style.display = 'block';
}

// Confirm provider reassignment
async function confirmProviderReassignment() {
    if (!currentReassignmentRequest || !selectedNewProvider) {
        showNotification('Missing reassignment data', 'error');
        return;
    }

    try {
        const bookingId = currentReassignmentRequest.id;
        const originalCost = currentReassignmentRequest.amount || 0;
        const newCost = selectedNewProvider.cost;
        const costDifference = newCost - originalCost;

        // Create reassignment log
        const logData = {
            bookingId: bookingId,
            originalProviderId: currentReassignmentRequest.providerId,
            originalProviderName: currentReassignmentRequest.providerName,
            newProviderId: selectedNewProvider.id,
            newProviderName: selectedNewProvider.name,
            originalCost: originalCost,
            newCost: newCost,
            costDifference: costDifference,
            serviceId: currentReassignmentRequest.serviceId,
            serviceName: currentReassignmentRequest.serviceName,
            customerId: currentReassignmentRequest.customerId,
            customerName: currentReassignmentRequest.customerName,
            selectedDate: currentReassignmentRequest.selectedDate,
            selectedTime: currentReassignmentRequest.selectedTime,
            adminAction: 'Provider reassigned with cost override',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            cancelReason: currentReassignmentRequest.cancelRequest?.reason || 'N/A'
        };

        // Add to reassignment logs collection
        await db.collection('providerreassignmentlogs').add(logData);

        // Update booking with new provider
        await db.collection('bookings').doc(bookingId).update({
            providerId: selectedNewProvider.id,
            providerName: selectedNewProvider.name,
            providerPhone: selectedNewProvider.phone,
            providerPhoto: selectedNewProvider.profilePhoto || '',
            amount: newCost,
            'cancelRequest.status': 'resolved',
            'cancelRequest.resolvedBy': 'admin',
            'cancelRequest.resolvedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'cancelRequest.newProviderId': selectedNewProvider.id,
            status: 'Pending', // Reset to pending for new provider to accept
            reassignedByAdmin: true,
            reassignmentTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Send notification to new provider
        await sendProviderNotification(selectedNewProvider.id, bookingId);

        // Send notification to customer
        await sendCustomerNotification(currentReassignmentRequest.customerId, bookingId);

        // Close modal and refresh
        closeCostComparisonModal();
        showNotification('Provider successfully reassigned', 'success');
        
        // Reload reassignments
        await loadReassignments();

        // Reset global variables
        currentReassignmentRequest = null;
        selectedNewProvider = null;
        availableProvidersData = [];

    } catch (error) {
        console.error('Error confirming reassignment:', error);
        showNotification('Error reassigning provider. Please try again.', 'error');
    }
}

// Send notification to new provider
async function sendProviderNotification(providerId, bookingId) {
    try {
        // Add notification to provider's notifications collection
        await db.collection('notifications').add({
            userId: providerId,
            type: 'new_booking',
            bookingId: bookingId,
            title: 'New Booking Assigned',
            message: 'You have been assigned a new booking by admin',
            read: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error sending provider notification:', error);
    }
}

// Send notification to customer
async function sendCustomerNotification(customerId, bookingId) {
    try {
        await db.collection('notifications').add({
            userId: customerId,
            type: 'provider_reassigned',
            bookingId: bookingId,
            title: 'New Provider Assigned',
            message: 'A new provider has been assigned to your booking',
            read: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error sending customer notification:', error);
    }
}

// Close modals
function closeProviderSelectionModal() {
    document.getElementById('provider-selection-modal').style.display = 'none';
    currentReassignmentRequest = null;
    availableProvidersData = [];
}

function closeCostComparisonModal() {
    document.getElementById('cost-comparison-modal').style.display = 'none';
}

// ==================== CANCELLATIONS HISTORY FUNCTIONALITY ====================

let cancellationsHistoryFilter = {
    type: 'all',
    status: 'all'
};

// Load cancellations history
async function loadCancellationsHistory() {
    const container = document.getElementById('cancellations-list');
    const emptyState = document.getElementById('cancellations-empty');
    
    if (!container) return;

    try {
        // Query all cancelled bookings
        let query = db.collection('bookings')
            .where('status', '==', 'Cancelled')
            .orderBy('cancelRequest.timestamp', 'desc')
            .limit(100);

        const snapshot = await query.get();

        if (snapshot.empty) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = '';

        let filteredBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Apply filters
        if (cancellationsHistoryFilter.type !== 'all') {
            filteredBookings = filteredBookings.filter(b => 
                b.cancelRequest?.by === cancellationsHistoryFilter.type
            );
        }

        if (cancellationsHistoryFilter.status !== 'all') {
            if (cancellationsHistoryFilter.status === 'refunded') {
                filteredBookings = filteredBookings.filter(b => 
                    b.cancelRequest?.userChoice === 'refund' || !b.cancelRequest?.userChoice
                );
            } else if (cancellationsHistoryFilter.status === 'reassigned') {
                filteredBookings = filteredBookings.filter(b => 
                    b.reassignedByAdmin === true
                );
            }
        }

        if (filteredBookings.length === 0) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        filteredBookings.forEach(booking => {
            const card = createCancellationCard(booking);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading cancellations:', error);
        showNotification('Error loading cancellations history', 'error');
    }
}

// Create cancellation history card
function createCancellationCard(booking) {
    const card = document.createElement('div');
    card.className = 'request-card cancellation-card';
    
    const cancelledBy = booking.cancelRequest?.by || 'Unknown';
    const reason = booking.cancelRequest?.reason || 'No reason provided';
    const timestamp = booking.cancelRequest?.timestamp?.toDate?.() || new Date();
    const wasReassigned = booking.reassignedByAdmin === true;
    const refundAmount = booking.cancelRequest?.refundAmount || booking.amount || 0;
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-title">
                <h3>${booking.serviceName || 'Service'}</h3>
                <span class="badge ${wasReassigned ? 'badge-info' : 'badge-secondary'}">
                    ${wasReassigned ? 'Reassigned' : 'Refunded'}
                </span>
            </div>
            <div class="card-meta">
                <span class="booking-id">ID: ${booking.id.substring(0, 8)}</span>
                <span class="timestamp">${formatDate(timestamp)}</span>
            </div>
        </div>
        
        <div class="card-body">
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">Customer:</span>
                    <span class="value">${booking.customerName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Provider:</span>
                    <span class="value">${booking.providerName || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Cancelled By:</span>
                    <span class="value">${cancelledBy}</span>
                </div>
                <div class="info-item">
                    <span class="label">Service Date:</span>
                    <span class="value">${booking.selectedDate || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="label">Original Cost:</span>
                    <span class="value">₹${booking.amount || 0}</span>
                </div>
                <div class="info-item">
                    <span class="label">${wasReassigned ? 'Final Cost:' : 'Refund Amount:'}</span>
                    <span class="value">₹${wasReassigned ? booking.amount : refundAmount}</span>
                </div>
            </div>
            
            <div class="cancellation-reason">
                <strong>Reason:</strong>
                <p>${reason}</p>
            </div>
            
            ${wasReassigned ? `
                <div class="reassignment-info">
                    <strong>Reassignment Details:</strong>
                    <p>Admin reassigned to new provider on ${formatDate(booking.reassignmentTimestamp?.toDate?.() || timestamp)}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Apply cancellation filters
function applyCancellationFilters() {
    cancellationsHistoryFilter.type = document.getElementById('cancel-filter-type').value;
    cancellationsHistoryFilter.status = document.getElementById('cancel-filter-status').value;
    loadCancellationsHistory();
}

// ==================== TAB NAVIGATION UPDATES ====================

// Update the existing showTab function to include new tabs
const originalShowTab = window.showTab;
window.showTab = function(tabName) {
    // Call original showTab if it exists
    if (originalShowTab && typeof originalShowTab === 'function') {
        originalShowTab(tabName);
    }
    
    // Handle reassignments tab
    if (tabName === 'reassignments') {
        document.getElementById('reassignments-section').style.display = 'block';
        loadReassignments();
    } else {
        const reassignmentsSection = document.getElementById('reassignments-section');
        if (reassignmentsSection) {
            reassignmentsSection.style.display = 'none';
        }
    }
    
    // Handle cancellations tab
    if (tabName === 'cancellations') {
        document.getElementById('cancellations-section').style.display = 'block';
        loadCancellationsHistory();
    } else {
        const cancellationsSection = document.getElementById('cancellations-section');
        if (cancellationsSection) {
            cancellationsSection.style.display = 'none';
        }
    }
};

// ==================== INITIALIZATION ====================

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Reassignments tab button
    const reassignmentsBtn = document.getElementById('reassignments-tab-btn');
    if (reassignmentsBtn) {
        reassignmentsBtn.addEventListener('click', () => showTab('reassignments'));
    }
    
    // Cancellations tab button (if it exists, otherwise add it to HTML)
    const cancellationsBtn = document.getElementById('cancellations-tab-btn');
    if (cancellationsBtn) {
        cancellationsBtn.addEventListener('click', () => showTab('cancellations'));
    }
    
    // Filter button
    const applyFiltersBtn = document.getElementById('apply-cancel-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyCancellationFilters);
    }
    
    // Close modals on outside click
    window.onclick = function(event) {
        const providerModal = document.getElementById('provider-selection-modal');
        const costModal = document.getElementById('cost-comparison-modal');
        
        if (event.target === providerModal) {
            closeProviderSelectionModal();
        }
        if (event.target === costModal) {
            closeCostComparisonModal();
        }
    };
});

// Helper function to format dates
function formatDate(date) {
    if (!date) return 'N/A';
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper function to show notifications (if not already defined)
function showNotification(message, type = 'info') {
    // Implement your notification system here
    // This could be a toast, alert, or custom notification component
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message); // Replace with your notification system
}



let adminDashboard;

// Initialize dashboard when page loads (single, final bootstrap)
document.addEventListener('DOMContentLoaded', () => {
    const inst = new AdminDashboard();
    window.adminDashboard = inst;
  
    // ---- Robust tab click delegation (works even if earlier wiring missed) ----
    const tabsWrap = document.querySelector('.tab-buttons');
    if (tabsWrap) {
      tabsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('#providers-tab, #enquiries-tab, #notifications-tab, #service-reviews-tab, #cancellations-tab');
        if (!btn) return;
  
        switch (btn.id) {
          case 'providers-tab':             inst.switchToProviders?.(); break;
          case 'enquiries-tab':             inst.switchToEnquiries?.(); break;
          case 'notifications-tab':         inst.switchToNotifications?.(); break;
          case 'service-reviews-tab':       inst.switchToServiceReviews?.(); break;
          case 'cancellations-tab':         inst.switchToCancellations?.(); break;
          case 'reassignments-tab':         showTab('reassignments'); break;
          case 'cancellations-history-tab': showTab('cancellations-history'); break;
        }
        // Initialize reassignments and cancellations history event listeners
        const reassignmentsBtn = document.getElementById('reassignments-tab-btn');
        if (reassignmentsBtn) {
            reassignmentsBtn.addEventListener('click', () => showTab('reassignments'));
        }

        const cancellationsHistoryBtn = document.getElementById('cancellations-history-tab-btn');
        if (cancellationsHistoryBtn) {
            cancellationsHistoryBtn.addEventListener('click', () => showTab('cancellations-history'));
        }

        const applyFiltersBtn = document.getElementById('apply-cancel-history-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', applyCancellationHistoryFilters);
        }

        // Close modals on outside click
        window.onclick = function(event) {
            const providerModal = document.getElementById('provider-selection-modal');
            const costModal = document.getElementById('cost-comparison-modal');
            
            if (event.target === providerModal) {
                closeProviderSelectionModal();
            }
            if (event.target === costModal) {
                closeCostComparisonModal();
            }
        };

      });
    }
  
    // Optional: log so you can see clicks in Console
    console.log('[Admin] Dashboard ready; tab delegation active');
});
