/**
 * Pro X Admin - Native Mobile App JavaScript (mobile-app.js)
 * Provides native app navigation: Bottom Navigation Bar, Slide-Out Drawer,
 * Header Back button, Drawer Search, Master-Detail handling, and Touch Polish.
 */

(function () {
  'use strict';

  // Current page detection
  const currentPath = window.location.pathname;
  const currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'dashboard.html';

  // Do not show full app navigation on login page
  if (currentPage === 'index.html' || currentPage === '') {
    return;
  }

  // Define full list of all admin modules grouped into categories
  const APP_PAGES = [
    {
      group: 'Overview & Analytics',
      items: [
        { file: 'dashboard.html', title: 'Dashboard', icon: '📊' },
        { file: 'financial-overview.html', title: 'Financial Overview', icon: '📈' },
        { file: 'admin_history.html', title: 'Admin History Logs', icon: '📜' }
      ]
    },
    {
      group: 'Providers & Users',
      items: [
        { file: 'Provider-Management.html', title: 'Provider Management', icon: '👥' },
        { file: 'master-provider.html', title: 'Master Provider Directory', icon: '🔍' },
        { file: 'master-user.html', title: 'Master User Directory', icon: '👤' },
        { file: 'featured-providers.html', title: 'Featured Providers', icon: '⭐' },
        { file: 'subscription-management.html', title: 'Subscription Management', icon: '💳' }
      ]
    },
    {
      group: 'Operations & Bookings',
      items: [
        { file: 'bookings-collection.html', title: 'Bookings Collection', icon: '📅' },
        { file: 'Service-request.html', title: 'Service Requests Review', icon: '🛠️' },
        { file: 'progress-monitor.html', title: 'Progress & SLA Monitor', icon: '⏱️' },
        { file: 'provider-replacement.html', title: 'Provider Replacement', icon: '🔄' },
        { file: 'cancellation-requests.html', title: 'Cancellation Requests', icon: '❌' }
      ]
    },
    {
      group: 'Finance & Payouts',
      items: [
        { file: 'payout.html', title: 'Payouts & Commissions', icon: '💰' },
        { file: 'financial-overview.html', title: 'Financial Overview', icon: '📈' }
      ]
    },
    {
      group: 'System & Communications',
      items: [
        { file: 'push-notifications.html', title: 'Push Notifications', icon: '🔔' },
        { file: 'promo-codes.html', title: 'Promo Codes', icon: '🏷️' },
        { file: 'support-tickets.html', title: 'Support Tickets', icon: '🎫' },
        { file: 'Enquires.html', title: 'Enquiry Management', icon: '✉️' },
        { file: 'admin-deletion-requests.html', title: 'Account Deletion Requests', icon: '🗑️' }
      ]
    }
  ];

  // Helper: SVG Icons for Bottom Navigation Bar
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
    providers: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    bookings: '<svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>',
    payout: '<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>'
  };

  /**
   * Initializes the native mobile navigation shell
   */
  function initMobileAppShell() {
    createBottomNav();
    createDrawer();
    enhanceHeader();
    enhanceTables();
    handleMasterDetail();
    enhanceProviderManagement();
  }

  /**
   * 6. Dedicated optimizations for Provider-Management.html
   */
  function enhanceProviderManagement() {
    if (!currentPage.toLowerCase().includes('provider-management')) return;

    // A. Ensure Subscriptions tab button exists in tab-nav
    const tabNav = document.querySelector('.tab-nav');
    if (tabNav && !document.getElementById('tab-subscriptions-btn')) {
      const subBtn = document.createElement('button');
      subBtn.type = 'button';
      subBtn.className = 'tab-btn';
      subBtn.id = 'tab-subscriptions-btn';
      subBtn.innerHTML = '⭐ Tier Upgrades & Subscriptions';
      subBtn.addEventListener('click', () => {
        if (typeof window.switchTab === 'function') {
          window.switchTab('subscriptions');
        }
      });
      tabNav.appendChild(subBtn);
    }

    // B. Wire interactive stat cards to filterProviders
    const statCards = document.querySelectorAll('#provider-stats .stat-card');
    if (statCards.length >= 6) {
      const filters = ['all', 'pending', 'in_progress', 'approved', 'needs_changes', 'rejected'];
      statCards.forEach((card, idx) => {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('title', 'Tap to filter');
        card.addEventListener('click', () => {
          if (window.dashboard && typeof window.dashboard.filterProviders === 'function') {
            window.dashboard.filterProviders(filters[idx]);
          }
          statCards.forEach(c => c.classList.remove('stat-card-active'));
          card.classList.add('stat-card-active');
        });
      });
    }

    // C. Make entire table row tap-friendly on mobile
    const tbody = document.getElementById('providers-table-body');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;
        const row = e.target.closest('tr');
        if (!row) return;
        if (e.target.closest('button') || e.target.closest('a')) return;
        const viewBtn = row.querySelector('.action-btn, button');
        if (viewBtn) {
          viewBtn.click();
        }
      });
    }

    // D. Sticky action bar enhancer for Provider Detail Modal
    const provModal = document.getElementById('provider-modal');
    if (provModal) {
      const observer = new MutationObserver(() => {
        if (provModal.style.display === 'flex' || provModal.classList.contains('open')) {
          const actionBtns = provModal.querySelectorAll('.action-btn.success, .action-btn.danger, .request-changes-btn');
          if (actionBtns.length > 0) {
            const container = actionBtns[0].parentElement;
            if (container && !container.classList.contains('provider-modal-actions-bar')) {
              container.classList.add('provider-modal-actions-bar');
            }
          }
        }
      });
      observer.observe(provModal, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  /**
   * 1. Creates Fixed Native Bottom Navigation Bar
   */
  function createBottomNav() {
    if (document.querySelector('.mobile-app-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'mobile-app-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile Bottom Navigation');

    const isDashboard = currentPage === 'dashboard.html';
    const isProviders = currentPage.toLowerCase().includes('provider');
    const isBookings = currentPage.toLowerCase().includes('booking') || currentPage.toLowerCase().includes('service-request');
    const isPayout = currentPage.toLowerCase().includes('payout') || currentPage.toLowerCase().includes('financial');

    nav.innerHTML = `
      <a href="dashboard.html" class="mobile-app-nav-item ${isDashboard ? 'active' : ''}">
        ${ICONS.dashboard}
        <span>Overview</span>
      </a>
      <a href="Provider-Management.html" class="mobile-app-nav-item ${!isDashboard && isProviders ? 'active' : ''}">
        ${ICONS.providers}
        <span>Providers</span>
      </a>
      <a href="bookings-collection.html" class="mobile-app-nav-item ${isBookings ? 'active' : ''}">
        ${ICONS.bookings}
        <span>Bookings</span>
      </a>
      <a href="payout.html" class="mobile-app-nav-item ${isPayout ? 'active' : ''}">
        ${ICONS.payout}
        <span>Payouts</span>
      </a>
      <button type="button" class="mobile-app-nav-item" id="mobile-app-open-drawer-btn">
        ${ICONS.menu}
        <span>All Menu</span>
      </button>
    `;

    document.body.appendChild(nav);

    // Event listener to open drawer
    document.getElementById('mobile-app-open-drawer-btn').addEventListener('click', openDrawer);
  }

  /**
   * 2. Creates Slide-Out Drawer & Backdrop
   */
  function createDrawer() {
    if (document.querySelector('.mobile-app-drawer')) return;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-app-drawer-backdrop';
    backdrop.id = 'mobile-app-drawer-backdrop';
    document.body.appendChild(backdrop);

    // Drawer
    const drawer = document.createElement('aside');
    drawer.className = 'mobile-app-drawer';
    drawer.id = 'mobile-app-drawer';

    let menuSectionsHtml = '';
    APP_PAGES.forEach((group) => {
      let itemsHtml = '';
      group.items.forEach((item) => {
        const isActive = currentPage.toLowerCase() === item.file.toLowerCase();
        itemsHtml += `
          <a href="${item.file}" class="mobile-app-drawer-link ${isActive ? 'active' : ''}" data-title="${item.title.toLowerCase()}">
            <span class="icon">${item.icon}</span>
            <span>${item.title}</span>
          </a>
        `;
      });
      menuSectionsHtml += `
        <div class="mobile-app-nav-group">
          <div class="mobile-app-nav-group-title">${group.group}</div>
          ${itemsHtml}
        </div>
      `;
    });

    drawer.innerHTML = `
      <div class="mobile-app-drawer-header">
        <div class="mobile-app-drawer-brand">
          <div class="brand-badge">PX</div>
          <div>
            <div class="brand-title">Pro X Admin</div>
            <div class="brand-sub">Management Portal</div>
          </div>
        </div>
        <button class="mobile-app-drawer-close" id="mobile-app-drawer-close-btn" aria-label="Close Menu">✕</button>
      </div>

      <div class="mobile-app-drawer-search">
        <input type="text" id="mobile-app-drawer-search-input" placeholder="Search pages..." autocomplete="off">
      </div>

      <div class="mobile-app-drawer-body" id="mobile-app-drawer-body">
        ${menuSectionsHtml}
      </div>

      <div class="mobile-app-drawer-footer">
        <button type="button" class="mobile-app-drawer-logout" id="mobile-app-logout-btn">
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    `;

    document.body.appendChild(drawer);

    // Wire close triggers
    backdrop.addEventListener('click', closeDrawer);
    document.getElementById('mobile-app-drawer-close-btn').addEventListener('click', closeDrawer);

    // Wire live drawer search
    const searchInput = document.getElementById('mobile-app-drawer-search-input');
    searchInput.addEventListener('input', function (e) {
      const q = e.target.value.toLowerCase().trim();
      const links = drawer.querySelectorAll('.mobile-app-drawer-link');
      const groups = drawer.querySelectorAll('.mobile-app-nav-group');

      links.forEach((link) => {
        const title = link.getAttribute('data-title') || '';
        if (title.includes(q)) {
          link.style.display = 'flex';
        } else {
          link.style.display = 'none';
        }
      });

      // Hide empty groups
      groups.forEach((grp) => {
        const visibleLinks = grp.querySelectorAll('.mobile-app-drawer-link[style*="display: flex"], .mobile-app-drawer-link:not([style*="display: none"])');
        grp.style.display = visibleLinks.length > 0 ? 'block' : 'none';
      });
    });

    // Wire Logout Button
    document.getElementById('mobile-app-logout-btn').addEventListener('click', handleLogoutClick);

    // ESC key closes drawer
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  function openDrawer() {
    const drawer = document.getElementById('mobile-app-drawer');
    const backdrop = document.getElementById('mobile-app-drawer-backdrop');
    if (drawer && backdrop) {
      drawer.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById('mobile-app-drawer');
    const backdrop = document.getElementById('mobile-app-drawer-backdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function handleLogoutClick() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
      }).catch(() => {
        window.location.href = 'index.html';
      });
    } else {
      window.location.href = 'index.html';
    }
  }

  /**
   * 3. Enhances Page Header with Back button and Hamburger Menu
   */
  function enhanceHeader() {
    const header = document.querySelector('.header, .page-header, .admin-header, .header-card, .topbar');
    if (!header) return;

    // A. Add Hamburger Menu Button to Header if not present
    if (!header.querySelector('.mobile-app-menu-btn')) {
      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'mobile-app-menu-btn';
      menuBtn.setAttribute('aria-label', 'Open Menu');
      menuBtn.innerHTML = ICONS.menu;
      menuBtn.addEventListener('click', openDrawer);

      // Place in right actions if available, or prepend/append
      const headerRight = header.querySelector('.header-right, .header-actions, .topbar-right, .theme-toggle-container');
      if (headerRight) {
        headerRight.appendChild(menuBtn);
      } else {
        header.appendChild(menuBtn);
      }
    }

    // B. Add Back Button on non-dashboard pages if none exists
    if (currentPage !== 'dashboard.html') {
      const existingBack = header.querySelector('.back-btn, .back-link, a[href="dashboard.html"]');
      if (!existingBack) {
        const backBtn = document.createElement('a');
        backBtn.href = 'dashboard.html';
        backBtn.className = 'mobile-app-back-btn';
        backBtn.setAttribute('aria-label', 'Back to Dashboard');
        backBtn.innerHTML = ICONS.back;

        const headerLeft = header.querySelector('.header-left, .header-inner, .header-content, .topbar-left, .header-info');
        if (headerLeft) {
          headerLeft.insertBefore(backBtn, headerLeft.firstChild);
        } else {
          header.insertBefore(backBtn, header.firstChild);
        }
      }
    }
  }

  /**
   * 4. Wrap any table in a touch-friendly overflow container
   */
  function enhanceTables() {
    const tables = document.querySelectorAll('table');
    tables.forEach((table) => {
      const parent = table.parentElement;
      if (
        !parent.classList.contains('table-responsive') &&
        !parent.classList.contains('table-scroll') &&
        !parent.classList.contains('table-section') &&
        !parent.classList.contains('requests-table-wrapper')
      ) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        parent.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });
  }

  /**
   * 5. Master-Detail Handling for master-provider.html & master-user.html
   */
  function handleMasterDetail() {
    if (currentPage !== 'master-provider.html' && currentPage !== 'master-user.html') return;

    const detailArea = document.getElementById('detail-area');
    const sidebar = document.querySelector('.sidebar');
    if (!detailArea || !sidebar) return;

    // Add back button to detail area
    if (!detailArea.querySelector('.mobile-back-to-master-btn')) {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'mobile-back-to-master-btn';
      backBtn.innerHTML = '← Back to List';
      backBtn.addEventListener('click', function () {
        document.body.classList.remove('mobile-detail-active');
        detailArea.style.display = 'none';
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'block';
      });
      detailArea.insertBefore(backBtn, detailArea.firstChild);
    }

    // Monitor when detail is opened
    const observer = new MutationObserver(function () {
      if (window.innerWidth <= 768) {
        if (detailArea.style.display === 'block') {
          document.body.classList.add('mobile-detail-active');
        } else {
          document.body.classList.remove('mobile-detail-active');
        }
      }
    });

    observer.observe(detailArea, { attributes: true, attributeFilter: ['style'] });
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileAppShell);
  } else {
    initMobileAppShell();
  }
})();
