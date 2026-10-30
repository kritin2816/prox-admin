/**
 * Pro X Admin - Real-Time Push & Mobile Notification Engine (admin-alerts.js)
 * 
 * Features:
 * 1. Native Service Worker Push & Phone Lock-Screen Notifications
 * 2. Instant Alerts for NEW PROVIDERS with:
 *    - Provider Name
 *    - "Came from where": City, Country, & Referral/Discovery Source
 *    - "Review required as well": Explicit Review & KYC verification status
 * 3. Instant Alerts for NEW USERS / Customers with:
 *    - Customer Name & Location/Source
 *    - Review status (Not required for standard customers)
 * 4. Distinctive Web Audio Chime synthesizer for audible alerts on phones
 * 5. Device Vibration pattern for mobile tactile feedback
 * 6. Quick "Send Test Notification to My Phone" button for instant testing
 * 7. In-App Notification Center & Bell Icon with recent alerts history
 * 8. Automatic PWA Service Worker registration
 */

(function () {
  'use strict';

  if (window.__proxAdminAlertsInit) return;
  window.__proxAdminAlertsInit = true;

  // Configuration & State
  const STORAGE_KEY_PROVIDERS = 'prox_known_provider_ids_v1';
  const STORAGE_KEY_USERS = 'prox_known_user_ids_v1';
  const STORAGE_KEY_ALERTS = 'prox_recent_admin_alerts_v1';
  const STORAGE_KEY_SOUND = 'prox_alert_sound_enabled';

  let swRegistration = null;
  let audioCtx = null;
  let knownProviderIds = new Set();
  let knownUserIds = new Set();
  let isProvidersInitialSyncDone = false;
  let isUsersInitialSyncDone = false;
  let recentAlerts = [];
  let unreadAlertCount = 0;

  // Restore known IDs from storage
  try {
    const savedProv = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    if (savedProv) knownProviderIds = new Set(JSON.parse(savedProv));
    const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
    if (savedUsers) knownUserIds = new Set(JSON.parse(savedUsers));
    const savedAlerts = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (savedAlerts) recentAlerts = JSON.parse(savedAlerts);
  } catch (e) {
    console.warn('[AdminAlerts] Error reading localStorage:', e);
  }

  /**
   * 1. Initialize Service Worker for Phone Notifications
   */
  async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('sw.js', { scope: './' });
        console.log('[AdminAlerts] Service Worker registered with scope:', swRegistration.scope);
      } catch (err) {
        console.warn('[AdminAlerts] Service Worker registration failed:', err);
      }
    }
  }

  /**
   * 2. Web Audio API Alert Chime (Reliable, no external audio file needed)
   */
  function playAlertChime() {
    if (localStorage.getItem(STORAGE_KEY_SOUND) === 'false') return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      // Note 1: E5 (659.25 Hz)
      playTone(659.25, now, 0.14, 0.15);
      // Note 2: G#5 (830.61 Hz)
      playTone(830.61, now + 0.12, 0.14, 0.18);
      // Note 3: B5 (987.77 Hz)
      playTone(987.77, now + 0.24, 0.35, 0.22);
    } catch (err) {
      console.warn('[AdminAlerts] Audio chime playback error:', err);
    }
  }

  function playTone(freq, startTime, duration, volume) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * 3. Trigger Phone Vibration
   */
  function triggerPhoneVibration() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 300]);
      } catch (e) {}
    }
  }

  /**
   * 4. Request Phone Notification Permission
   */
  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('This device or browser does not support Web Push notifications.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      updatePermissionUI(permission);

      if (permission === 'granted') {
        // Unlock Web Audio context on user gesture
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        playAlertChime();
        triggerPhoneVibration();

        // Send a celebratory confirmation notification
        dispatchNotification({
          title: '🔔 Notifications Enabled!',
          body: 'You will now receive instant phone alerts whenever a new provider or user joins Pro X.',
          url: 'dashboard.html',
          type: 'system',
          tag: 'prox-welcome-alert'
        });

        // Hide permission banner if visible
        const banner = document.getElementById('prox-notif-perm-banner');
        if (banner) banner.style.display = 'none';

        return true;
      } else {
        alert('Notification permission was denied. Please allow notifications in your phone / browser settings.');
        return false;
      }
    } catch (err) {
      console.error('[AdminAlerts] Permission request error:', err);
      return false;
    }
  }

  /**
   * 5. Dispatch Native System Notification (Phone lock screen / shade)
   */
  async function dispatchNotification(alertData) {
    const defaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%236a3093'/><text x='50%' y='55%' font-family='sans-serif' font-weight='bold' font-size='42' fill='white' dominant-baseline='middle' text-anchor='middle'>PX</text></svg>";

    const title = alertData.title || '🔔 Pro X Alert';
    const options = {
      body: alertData.body || '',
      icon: defaultIcon,
      badge: defaultIcon,
      vibrate: [250, 100, 250, 100, 300],
      tag: alertData.tag || 'prox-alert-' + Date.now(),
      renotify: true,
      data: {
        url: alertData.url || 'dashboard.html',
        type: alertData.type,
        timestamp: Date.now()
      },
      actions: [
        { action: 'open', title: 'Open & Review' }
      ]
    };

    // 1. Play Audio & Vibrate
    playAlertChime();
    triggerPhoneVibration();

    // 2. Show Native System Notification on Phone
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if (swRegistration && swRegistration.showNotification) {
          await swRegistration.showNotification(title, options);
        } else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, options);
        } else {
          new Notification(title, options);
        }
      } catch (err) {
        console.warn('[AdminAlerts] Native notification failed, falling back:', err);
        try {
          new Notification(title, options);
        } catch (e) {}
      }
    }

    // 3. Show In-App Floating Toast Banner
    showInAppToast(alertData);

    // 4. Save to Alert History
    saveAlertToHistory(alertData);
  }

  /**
   * 6. In-App Animated Notification Toast
   */
  function showInAppToast(alertData) {
    let container = document.getElementById('prox-alert-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'prox-alert-toast-container';
      container.className = 'prox-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `prox-toast-item ${alertData.type === 'provider' ? 'toast-provider' : alertData.type === 'user' ? 'toast-user' : 'toast-system'}`;

    const icon = alertData.type === 'provider' ? '🚨' : alertData.type === 'user' ? '👤' : '🔔';
    const btnLabel = alertData.type === 'provider' ? 'Review Provider →' : alertData.type === 'user' ? 'View User →' : 'View';

    toast.innerHTML = `
      <div class="prox-toast-header">
        <span class="prox-toast-icon">${icon}</span>
        <span class="prox-toast-title">${escapeHtml(alertData.title)}</span>
        <button class="prox-toast-close" aria-label="Close">&times;</button>
      </div>
      <div class="prox-toast-body">${alertData.body.replace(/\n/g, '<br>')}</div>
      ${alertData.url ? `
        <div class="prox-toast-actions">
          <a href="${alertData.url}" class="prox-toast-btn">${btnLabel}</a>
        </div>
      ` : ''}
    `;

    // Close button
    toast.querySelector('.prox-toast-close').addEventListener('click', () => {
      toast.remove();
    });

    // Auto dismiss after 9 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'proxToastFadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 9000);

    container.appendChild(toast);
  }

  /**
   * 7. Save to Recent Alerts History
   */
  function saveAlertToHistory(alertData) {
    const item = {
      id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: alertData.title,
      body: alertData.body,
      url: alertData.url,
      type: alertData.type,
      timestamp: Date.now(),
      cameFrom: alertData.cameFrom || null,
      reviewRequired: alertData.reviewRequired !== undefined ? alertData.reviewRequired : null
    };

    recentAlerts.unshift(item);
    if (recentAlerts.length > 50) recentAlerts = recentAlerts.slice(0, 50);

    unreadAlertCount++;
    try {
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(recentAlerts));
    } catch (e) {}

    updateBadgeUI();
    renderAlertsList();
  }

  /**
   * 8. Process NEW PROVIDER document
   */
  function handleNewProvider(provider, docId) {
    const data = provider || {};

    // 1. Name
    const name = (
      data.identity?.fullName ||
      data.fullName ||
      data.name ||
      data.username ||
      'New Provider'
    ).trim();

    // 2. "Came From Where": Location & Discovery/Referral Source
    const city = data.identity?.city || data.city || '';
    const country = data.identity?.country || data.country || (city ? 'India' : '');
    const location = [city, country].filter(Boolean).join(', ') || 'Location not specified';

    const source = (
      data.howDidYouFindUs ||
      data.referralSource ||
      data.referralCode ||
      data.source ||
      data.leadSource ||
      'Direct Registration'
    );

    const cameFromText = `${location} • via ${source}`;

    // 3. Domain / Category
    const domainRaw = String(data.profile?.primaryDomain || data.primaryDomain || data.category || data.domain || '').toLowerCase();
    const domainDisplay = domainRaw === 'media' ? '📷 Media & Creative'
      : domainRaw === 'tech' ? '💻 Tech & Development'
      : (domainRaw ? domainRaw.toUpperCase() : 'Media & Creative');

    // 4. "If Review Is Required As Well"
    // In Pro X, every new provider registration starts as pending and needs admin review & KYC verification.
    const status = String(data.approvalStatus || data.status || 'pending').toLowerCase();
    const isIdVerified = Boolean(data.kyc?.idVerified || data.idVerified || (data.kyc && data.kyc.verified));

    let reviewRequired = true;
    let reviewText = '⚠️ REVIEW REQUIRED: YES (Pending Admin Approval & KYC)';

    if (status === 'approved' && isIdVerified) {
      reviewRequired = false;
      reviewText = '✅ Review: Not Required (Pre-approved & Verified)';
    } else if (status === 'approved' && !isIdVerified) {
      reviewRequired = true;
      reviewText = '⚠️ Review: KYC ID Review Needed';
    } else if (status === 'rejected') {
      reviewRequired = false;
      reviewText = '❌ Status: Rejected';
    }

    const title = `🚨 New Provider Registered: ${name}`;
    const body = `📍 Came From: ${cameFromText}\n📂 Domain: ${domainDisplay}\n${reviewText}`;
    const url = `Provider-Management.html?providerId=${docId}`;

    dispatchNotification({
      title,
      body,
      url,
      type: 'provider',
      cameFrom: cameFromText,
      reviewRequired: reviewRequired,
      tag: 'new-provider-' + docId
    });
  }

  /**
   * 9. Process NEW USER (Customer) document
   */
  function handleNewUser(user, docId) {
    const data = user || {};

    // 1. Name
    let name = 'New Customer';
    if (data.fullName && String(data.fullName).trim()) name = String(data.fullName).trim();
    else if (data.identity?.fullName && String(data.identity.fullName).trim()) name = String(data.identity.fullName).trim();
    else if (data.firstName || data.lastName) name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    else if (data.name && String(data.name).trim()) name = String(data.name).trim();
    else if (data.username && String(data.username).trim()) name = String(data.username).trim();
    else if (data.email) name = String(data.email).split('@')[0];

    // 2. Location & Source
    const city = data.city || data.location || data.identity?.city || '';
    const country = data.country || data.identity?.country || (city ? 'India' : '');
    const location = [city, country].filter(Boolean).join(', ') || 'Location not specified';

    const source = (
      data.referralSource ||
      data.howDidYouFindUs ||
      data.authProvider ||
      data.source ||
      'App Sign-up'
    );

    const cameFromText = `${location} • via ${source}`;

    // 3. Review required?
    // Standard customers don't require manual document review upon joining
    const reviewText = '✅ Review: Not Required (Customer account active)';

    const title = `👤 New Customer Joined: ${name}`;
    const body = `📍 Came From: ${cameFromText}\n${reviewText}`;
    const url = `master-user.html?userId=${docId}`;

    dispatchNotification({
      title,
      body,
      url,
      type: 'user',
      cameFrom: cameFromText,
      reviewRequired: false,
      tag: 'new-user-' + docId
    });
  }

  /**
   * 10. Start Real-Time Firestore Listeners
   */
  function startFirestoreListeners(db) {
    if (!db) return;

    console.log('[AdminAlerts] Starting real-time Firestore listeners for Providers and Users...');

    // A. PROVIDERS LISTENER
    try {
      db.collection('providers').onSnapshot((snapshot) => {
        if (!isProvidersInitialSyncDone) {
          // Initial load: collect existing IDs so we don't alert for past records
          snapshot.docs.forEach((doc) => {
            knownProviderIds.add(doc.id);
          });
          isProvidersInitialSyncDone = true;
          try {
            localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(Array.from(knownProviderIds)));
          } catch (e) {}
          console.log(`[AdminAlerts] Providers initial sync complete (${knownProviderIds.size} baseline providers)`);
          return;
        }

        // Subsequent changes: check for genuine new providers
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docId = change.doc.id;
            if (!knownProviderIds.has(docId)) {
              knownProviderIds.add(docId);
              try {
                localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(Array.from(knownProviderIds)));
              } catch (e) {}
              handleNewProvider(change.doc.data(), docId);
            }
          }
        });
      }, (err) => {
        console.warn('[AdminAlerts] Providers listener error:', err);
      });
    } catch (e) {
      console.warn('[AdminAlerts] Could not attach providers listener:', e);
    }

    // B. USERS LISTENER
    try {
      db.collection('users').onSnapshot((snapshot) => {
        if (!isUsersInitialSyncDone) {
          // Initial load: collect existing IDs
          snapshot.docs.forEach((doc) => {
            knownUserIds.add(doc.id);
          });
          isUsersInitialSyncDone = true;
          try {
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(Array.from(knownUserIds)));
          } catch (e) {}
          console.log(`[AdminAlerts] Users initial sync complete (${knownUserIds.size} baseline users)`);
          return;
        }

        // Subsequent changes: check for genuine new users
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docId = change.doc.id;
            if (!knownUserIds.has(docId)) {
              knownUserIds.add(docId);
              try {
                localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(Array.from(knownUserIds)));
              } catch (e) {}
              handleNewUser(change.doc.data(), docId);
            }
          }
        });
      }, (err) => {
        console.warn('[AdminAlerts] Users listener error:', err);
      });
    } catch (e) {
      console.warn('[AdminAlerts] Could not attach users listener:', e);
    }
  }

  /**
   * 11. Build Notification Center UI (Bell Button, Modal, Banner)
   */
  function initNotificationCenterUI() {
    injectStyles();
    createHeaderBellButton();
    createAlertsDrawer();
    checkAndShowPermissionBanner();
  }

  function injectStyles() {
    if (document.getElementById('prox-alerts-styles')) return;

    const style = document.createElement('style');
    style.id = 'prox-alerts-styles';
    style.textContent = `
      /* Header Bell Icon */
      .prox-notif-bell-btn {
        position: relative;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s ease;
        margin-right: 8px;
        flex-shrink: 0;
      }
      .prox-notif-bell-btn:hover {
        background: rgba(255, 255, 255, 0.22);
        transform: translateY(-1px);
      }
      .prox-notif-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 5px;
        border-radius: 10px;
        border: 2px solid #1e293b;
        min-width: 16px;
        text-align: center;
        display: none;
        animation: proxBadgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      @keyframes proxBadgePop {
        from { transform: scale(0); }
        to { transform: scale(1); }
      }

      /* Permission Prompt Banner */
      .prox-perm-banner {
        background: linear-gradient(135deg, #6a3093 0%, #a044ff 100%);
        color: #fff;
        padding: 12px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        box-shadow: 0 4px 14px rgba(106, 48, 147, 0.35);
        position: sticky;
        top: 0;
        z-index: 99998;
        animation: proxSlideDown 0.3s ease;
      }
      @keyframes proxSlideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      .prox-perm-banner-btn {
        background: #fff;
        color: #6a3093;
        border: none;
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.15s ease;
      }
      .prox-perm-banner-btn:active {
        transform: scale(0.95);
      }
      .prox-perm-banner-close {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
      }

      /* In-App Toast Container */
      .prox-toast-container {
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 380px;
        width: calc(100vw - 40px);
        pointer-events: none;
      }
      .prox-toast-item {
        background: #1e293b;
        color: #f8fafc;
        border-radius: 14px;
        padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.12);
        pointer-events: auto;
        animation: proxToastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        backdrop-filter: blur(12px);
      }
      .prox-toast-item.toast-provider {
        border-left: 5px solid #ef4444;
      }
      .prox-toast-item.toast-user {
        border-left: 5px solid #10b981;
      }
      .prox-toast-item.toast-system {
        border-left: 5px solid #667eea;
      }
      @keyframes proxToastIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes proxToastFadeOut {
        to { transform: translateY(10px); opacity: 0; }
      }
      .prox-toast-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .prox-toast-icon {
        font-size: 18px;
      }
      .prox-toast-title {
        font-weight: 700;
        font-size: 14px;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .prox-toast-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
      }
      .prox-toast-body {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.45;
        margin-bottom: 8px;
      }
      .prox-toast-actions {
        display: flex;
        justify-content: flex-end;
      }
      .prox-toast-btn {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 6px;
        display: inline-block;
        transition: opacity 0.2s;
      }
      .prox-toast-btn:hover {
        opacity: 0.9;
      }

      /* Slide-Out Alerts Drawer & Backdrop */
      .prox-alerts-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 999990;
      }
      .prox-alerts-backdrop.open {
        display: block;
      }
      .prox-alerts-drawer {
        position: fixed;
        top: 0;
        right: -420px;
        width: 100%;
        max-width: 400px;
        height: 100%;
        background: #0f172a;
        color: #f1f5f9;
        box-shadow: -8px 0 30px rgba(0, 0, 0, 0.5);
        z-index: 999991;
        display: flex;
        flex-direction: column;
        transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
      }
      .prox-alerts-drawer.open {
        right: 0;
      }
      .prox-alerts-head {
        padding: 18px 20px;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .prox-alerts-head h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .prox-alerts-close-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
      }
      .prox-alerts-status-box {
        padding: 14px 20px;
        background: #1e293b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .prox-status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        margin-bottom: 8px;
      }
      .prox-status-badge.active {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }
      .prox-status-badge.inactive {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
      .prox-alerts-ctrl-row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 6px;
      }
      .prox-test-btn {
        flex: 1;
        background: linear-gradient(135deg, #a044ff, #6a3093);
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: opacity 0.2s;
      }
      .prox-test-btn:hover {
        opacity: 0.9;
      }
      .prox-sound-toggle-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.15);
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        cursor: pointer;
      }
      .prox-alerts-list {
        flex: 1;
        overflow-y: auto;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .prox-alert-card {
        background: #1e293b;
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .prox-alert-card.type-provider {
        border-left: 4px solid #ef4444;
      }
      .prox-alert-card.type-user {
        border-left: 4px solid #10b981;
      }
      .prox-alert-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 4px;
      }
      .prox-alert-card-title {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
      }
      .prox-alert-card-time {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .prox-alert-card-body {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      .prox-alert-card-link {
        font-size: 11px;
        color: #60a5fa;
        text-decoration: none;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .prox-alert-card-link:hover {
        text-decoration: underline;
      }
      .prox-alerts-empty {
        text-align: center;
        padding: 40px 20px;
        color: #94a3b8;
      }
      .prox-alerts-empty-icon {
        font-size: 40px;
        margin-bottom: 8px;
        opacity: 0.5;
      }
      .prox-alerts-foot {
        padding: 12px 18px;
        background: #1e293b;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .prox-clear-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #94a3b8;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
      }
      .prox-clear-btn:hover {
        color: #fff;
        border-color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function createHeaderBellButton() {
    if (document.getElementById('prox-notif-bell-btn')) return;

    const bellBtn = document.createElement('button');
    bellBtn.type = 'button';
    bellBtn.id = 'prox-notif-bell-btn';
    bellBtn.className = 'prox-notif-bell-btn';
    bellBtn.setAttribute('aria-label', 'Phone Alerts & Notifications');
    bellBtn.setAttribute('title', 'Admin Phone Alerts');
    bellBtn.innerHTML = `
      <span>🔔</span>
      <span class="prox-notif-badge" id="prox-notif-badge">0</span>
    `;

    bellBtn.addEventListener('click', toggleAlertsDrawer);

    // Place in header actions
    const headerRight = document.querySelector(
      '.header-right, .header-actions, .topbar-right, .header .header-right, .header-content .header-actions'
    );
    if (headerRight) {
      headerRight.insertBefore(bellBtn, headerRight.firstChild);
    } else {
      const header = document.querySelector('.header, .page-header, .topbar');
      if (header) {
        header.appendChild(bellBtn);
      }
    }

    updateBadgeUI();
  }

  function createAlertsDrawer() {
    if (document.getElementById('prox-alerts-drawer')) return;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'prox-alerts-backdrop';
    backdrop.className = 'prox-alerts-backdrop';
    backdrop.addEventListener('click', closeAlertsDrawer);
    document.body.appendChild(backdrop);

    // Drawer
    const drawer = document.createElement('div');
    drawer.id = 'prox-alerts-drawer';
    drawer.className = 'prox-alerts-drawer';

    const isGranted = 'Notification' in window && Notification.permission === 'granted';
    const isSoundOn = localStorage.getItem(STORAGE_KEY_SOUND) !== 'false';

    drawer.innerHTML = `
      <div class="prox-alerts-head">
        <h3>🔔 Phone Alerts & Activity</h3>
        <button class="prox-alerts-close-btn" id="prox-alerts-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="prox-alerts-status-box">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="prox-status-badge ${isGranted ? 'active' : 'inactive'}" id="prox-drawer-status-badge">
            ${isGranted ? '● Phone Push: Active' : '● Phone Push: Not Enabled'}
          </div>
          ${!isGranted ? `
            <button type="button" class="prox-perm-banner-btn" id="prox-drawer-enable-btn" style="padding:4px 10px; font-size:11px;">
              Enable Now
            </button>
          ` : ''}
        </div>

        <div class="prox-alerts-ctrl-row">
          <button type="button" class="prox-test-btn" id="prox-drawer-test-btn">
            <span>🧪</span>
            <span>Test Phone Alert</span>
          </button>
          <button type="button" class="prox-sound-toggle-btn" id="prox-sound-toggle-btn" title="Toggle audio chime">
            ${isSoundOn ? '🔊 Sound: ON' : '🔇 Sound: OFF'}
          </button>
        </div>
      </div>

      <div class="prox-alerts-list" id="prox-alerts-list">
        <!-- Rendered dynamically -->
      </div>

      <div class="prox-alerts-foot">
        <span style="font-size:11px; color:#94a3b8;">Real-time Firestore Push</span>
        <button type="button" class="prox-clear-btn" id="prox-clear-history-btn">Clear History</button>
      </div>
    `;

    document.body.appendChild(drawer);

    // Wire buttons
    document.getElementById('prox-alerts-close-btn').addEventListener('click', closeAlertsDrawer);
    document.getElementById('prox-drawer-test-btn').addEventListener('click', sendTestAlert);

    const enableBtn = document.getElementById('prox-drawer-enable-btn');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        const ok = await requestNotificationPermission();
        if (ok) {
          enableBtn.remove();
        }
      });
    }

    const soundBtn = document.getElementById('prox-sound-toggle-btn');
    soundBtn.addEventListener('click', () => {
      const cur = localStorage.getItem(STORAGE_KEY_SOUND) !== 'false';
      const nxt = !cur;
      localStorage.setItem(STORAGE_KEY_SOUND, nxt ? 'true' : 'false');
      soundBtn.textContent = nxt ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      if (nxt) playAlertChime();
    });

    document.getElementById('prox-clear-history-btn').addEventListener('click', () => {
      recentAlerts = [];
      unreadAlertCount = 0;
      try {
        localStorage.removeItem(STORAGE_KEY_ALERTS);
      } catch (e) {}
      updateBadgeUI();
      renderAlertsList();
    });

    renderAlertsList();
  }

  function checkAndShowPermissionBanner() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (sessionStorage.getItem('prox_perm_banner_dismissed') === 'true') return;

    if (document.getElementById('prox-notif-perm-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'prox-notif-perm-banner';
    banner.className = 'prox-perm-banner';
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">📱</span>
        <span>
          <strong>Enable Phone Notifications:</strong> Get real-time alerts on your phone whenever a new provider or customer joins Pro X!
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="prox-perm-banner-btn" id="prox-banner-enable-btn">🔔 Allow Alerts</button>
        <button class="prox-perm-banner-close" id="prox-banner-close-btn" aria-label="Dismiss">&times;</button>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    document.getElementById('prox-banner-enable-btn').addEventListener('click', async () => {
      await requestNotificationPermission();
    });

    document.getElementById('prox-banner-close-btn').addEventListener('click', () => {
      banner.remove();
      sessionStorage.setItem('prox_perm_banner_dismissed', 'true');
    });
  }

  function updatePermissionUI(permission) {
    const badge = document.getElementById('prox-drawer-status-badge');
    if (badge) {
      if (permission === 'granted') {
        badge.className = 'prox-status-badge active';
        badge.textContent = '● Phone Push: Active';
      } else {
        badge.className = 'prox-status-badge inactive';
        badge.textContent = '● Phone Push: Not Enabled';
      }
    }
  }

  function toggleAlertsDrawer() {
    const drawer = document.getElementById('prox-alerts-drawer');
    const backdrop = document.getElementById('prox-alerts-backdrop');
    if (!drawer) return;

    if (drawer.classList.contains('open')) {
      closeAlertsDrawer();
    } else {
      drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
      unreadAlertCount = 0;
      updateBadgeUI();
      renderAlertsList();
    }
  }

  function closeAlertsDrawer() {
    const drawer = document.getElementById('prox-alerts-drawer');
    const backdrop = document.getElementById('prox-alerts-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  function updateBadgeUI() {
    const badge = document.getElementById('prox-notif-badge');
    if (!badge) return;
    if (unreadAlertCount > 0) {
      badge.textContent = unreadAlertCount > 9 ? '9+' : unreadAlertCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  function renderAlertsList() {
    const list = document.getElementById('prox-alerts-list');
    if (!list) return;

    if (recentAlerts.length === 0) {
      list.innerHTML = `
        <div class="prox-alerts-empty">
          <div class="prox-alerts-empty-icon">📭</div>
          <div style="font-weight:600; font-size:13px; margin-bottom:4px;">No Alerts Yet</div>
          <div style="font-size:11px; color:#64748b;">When a new provider or customer registers, an instant notification with their location and review status will appear here!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = recentAlerts.map((alert) => {
      const typeClass = alert.type === 'provider' ? 'type-provider' : alert.type === 'user' ? 'type-user' : '';
      const timeStr = formatRelativeTime(alert.timestamp);

      return `
        <div class="prox-alert-card ${typeClass}">
          <div class="prox-alert-card-top">
            <span class="prox-alert-card-title">${escapeHtml(alert.title)}</span>
            <span class="prox-alert-card-time">${timeStr}</span>
          </div>
          <div class="prox-alert-card-body">${escapeHtml(alert.body).replace(/\n/g, '<br>')}</div>
          ${alert.url ? `
            <a href="${alert.url}" class="prox-alert-card-link">
              <span>${alert.type === 'provider' ? 'Review Provider in Portal' : 'View Details'}</span>
              <span>→</span>
            </a>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * 12. Test Notification Trigger
   */
  async function sendTestAlert() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const ok = await requestNotificationPermission();
      if (!ok) return;
    }

    // Simulate sample provider alert
    dispatchNotification({
      title: '🚨 New Provider Registered: Rahul Sharma (Test)',
      body: '📍 Came From: Mumbai, India • via Instagram Ads\n💼 Domain: 📷 Media & Creative\n⚠️ REVIEW REQUIRED: YES (Pending Admin Approval & KYC)',
      url: 'Provider-Management.html',
      type: 'provider',
      cameFrom: 'Mumbai, India • via Instagram Ads',
      reviewRequired: true,
      tag: 'test-provider-alert'
    });
  }

  // Helper formatting
  function formatRelativeTime(ts) {
    if (!ts) return 'Just now';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 13. Auto-initialize on DOM ready
   */
  function init() {
    initServiceWorker();
    initNotificationCenterUI();

    // Hook into Firebase Firestore when ready
    function tryAttachFirestore() {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
          const db = firebase.firestore();
          startFirestoreListeners(db);
          return true;
        } catch (e) {
          console.warn('[AdminAlerts] Error obtaining firestore:', e);
        }
      } else if (window.db) {
        try {
          startFirestoreListeners(window.db);
          return true;
        } catch (e) {}
      }
      return false;
    }

    if (!tryAttachFirestore()) {
      // Retry every 800ms up to 10 times until Firebase is loaded
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (tryAttachFirestore() || attempts >= 10) {
          clearInterval(interval);
        }
      }, 800);
    }
  }

  // Public API
  window.ProXAdminAlerts = {
    requestPermission: requestNotificationPermission,
    sendTestAlert: sendTestAlert,
    dispatchNotification: dispatchNotification,
    toggleDrawer: toggleAlertsDrawer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
