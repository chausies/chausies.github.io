// ==UserScript==
// @name         4Chat
// @namespace    Violent Monkey Script
// @version      1.0.0
// @description  Live scroll, "Best of" filtering, and thread zoom controls.
// @match        *://boards.4chan.org/*/thread/*
// @match        *://boards.4channel.org/*/thread/*
// @updateURL    https://raw.githubusercontent.com/chausies/chausies.github.io/refs/heads/main/4chat/4chat.meta.js
// @downloadURL  https://raw.githubusercontent.com/chausies/chausies.github.io/refs/heads/main/4chat/4chat.user.js
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // ==========================================
  // CONFIGURATION & STATE
  // ==========================================

  // Core algorithm parameters (editable via the settings UI)
  const CONFIG = {
    targetPostsPerSec: 2,
    minInterval: 4,
    maxInterval: 30,
    bestOfWindowSize: 300,
    bestOfSecPerPost: 10,
    bestOfAbsoluteK: 20
  };

  // Tooltip descriptions for the settings modal
  const CONFIG_META = {
    targetPostsPerSec: "Desired thread velocity (posts/sec) to trigger a live update.",
    minInterval: "Minimum wait time (seconds) between automatic thread updates.",
    maxInterval: "Maximum wait time (seconds) between automatic thread updates.",
    bestOfWindowSize: "(Live ON) Number of recent posts evaluated in the Markov chain.",
    bestOfSecPerPost: "(Live ON) Pacing variable (s): Shows 1 'Best' post every 's' seconds.",
    bestOfAbsoluteK: "(Live OFF) Absolute quantity (k) of top posts to show from the entire thread."
  };

  // User preferences for which floating UI elements to display
  const VISIBILITY = {
    liveBtn: true,
    bestOfBtn: true,
    dynamicLabel: true,
    zoomLabel: true,
    settingsBtn: true
  };

  // Volatile application state
  const state = {
    isLive: false,
    isBestOf: false,
    isFrozen: false,          // NEW: Tracks if Best Of is in the "Held" handoff state
    tickerId: null,           // Holds the setInterval ID for the live update loop
    timeRemaining: 0,         // Countdown to next thread update
    totalKnownPosts: 0,       // Tracks total posts to calculate delta when new posts arrive
    newPostsSinceUpdate: 0,   // Accumulates for the velocity math formula
    zoomLevel: 1.0,           // Session-specific zoom multiplier
    lastCalculatedK: CONFIG.bestOfAbsoluteK // Tracks dynamic K to hand off smoothly to Held mode
  };

  // DOM elements for the floating UI
  const ui = {
    container: document.createElement('div'),
    liveBtn: document.createElement('button'),
    bestOfBtn: document.createElement('button'),
    dynamicLabel: document.createElement('span'),
    zoomLabel: document.createElement('span'),
    settingsBtn: document.createElement('button'),
    modal: document.createElement('div'),
    zoomStyle: document.createElement('style')
  };

  // ==========================================
  // UI INITIALIZATION & UPDATES
  // ==========================================

  /**
   * Bootstraps the floating UI, injects CSS, and binds base event listeners.
   */
  function initUI() {
    const style = document.createElement('style');
    // NOTE: The .fcl-hidden class is scoped precisely to `.thread > .postContainer`.
    // This allows extensions like 4chan X to clone the node to the <body> for hover previews
    // without inadvertently hiding the preview box.
    style.textContent = `
      #fcl-container { position: fixed; top: 15px; left: 15px; z-index: 999999; display: flex; gap: 8px; align-items: center; font-family: arial, sans-serif; }
      .fcl-btn { padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
      .fcl-label { background: #333; color: #fff; padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: ns-resize; box-shadow: 0 2px 5px rgba(0,0,0,0.2); user-select: none; }
      #fcl-modal { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border: 1px solid #ccc; padding: 20px; z-index: 1000000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border-radius: 6px; font-family: arial, sans-serif; color: #000; min-width: 350px; }
      #fcl-modal h3, #fcl-modal h4 { margin-top: 0; }
      .fcl-form-group { margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
      .fcl-form-group input[type="number"] { width: 60px; padding: 4px; }
      .fcl-tooltip { cursor: help; color: #555; font-size: 0.9em; margin-left: 5px; }
      #fcl-modal-close { margin-top: 15px; width: 100%; padding: 8px; cursor: pointer; font-weight: bold; }
      .thread > .postContainer.fcl-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
    document.head.appendChild(ui.zoomStyle);

    ui.container.id = 'fcl-container';

    ui.liveBtn.className = 'fcl-btn';
    ui.liveBtn.addEventListener('click', toggleLiveMode);

    ui.bestOfBtn.className = 'fcl-btn';
    ui.bestOfBtn.addEventListener('click', toggleBestOfMode);

    ui.dynamicLabel.className = 'fcl-label';
    ui.dynamicLabel.title = 'Scroll to change';
    ui.dynamicLabel.addEventListener('wheel', handleDynamicScroll);

    ui.zoomLabel.className = 'fcl-label';
    ui.zoomLabel.title = 'Scroll to change zoom';
    ui.zoomLabel.innerText = 'Zoom (1.0x)';
    ui.zoomLabel.addEventListener('wheel', handleZoomScroll);

    ui.settingsBtn.className = 'fcl-btn';
    ui.settingsBtn.innerText = '⚙️';
    ui.settingsBtn.style.backgroundColor = '#ddd';
    ui.settingsBtn.style.border = '1px solid #aaa';
    ui.settingsBtn.addEventListener('click', openSettingsModal);

    ui.container.append(ui.liveBtn, ui.bestOfBtn, ui.dynamicLabel, ui.zoomLabel, ui.settingsBtn);
    document.body.appendChild(ui.container);

    buildSettingsModal();
    updateVisuals();
  }

  // ==========================================
  // ZOOM LOGIC
  // ==========================================

  /**
   * Updates CSS font sizes dynamically based on the current zoom level multiplier.
   * Only scales text blocks, leaving structural containers intact.
   */
  function applyZoomStyles() {
    const pct = Math.round(state.zoomLevel * 100);
    ui.zoomStyle.textContent = `
      .postContainer .postMessage,
      .postContainer .nameBlock,
      .postContainer .subject,
      .postContainer .fileText,
      .postContainer .summary {
        font-size: ${pct}% !important;
      }
    `;
    updateImageDimensions();
  }

  /**
   * Safely resizes thumbnails based on the zoom level. 
   * Modifies inline dimensions rather than using CSS `transform` or `zoom` 
   * to ensure compatibility with 4chan X's coordinate-based hover preview math.
   */
  function updateImageDimensions() {
    const images = document.querySelectorAll('.fileThumb img');
    images.forEach(img => {
      // Ignore expanded images to avoid shrinking them; thumbnails typically end in 's'
      if (!img.src.match(/s\.(jpg|png|gif|webp)$/i)) return;

      // Store the original base dimensions the first time we see an image
      if (!img.dataset.fclBaseWidth) {
        const w = img.style.width || img.getAttribute('width');
        const h = img.style.height || img.getAttribute('height');

        if (w && h) {
          img.dataset.fclBaseWidth = parseInt(w, 10);
          img.dataset.fclBaseHeight = parseInt(h, 10);
        } else {
          return;
        }
      }

      const baseW = parseInt(img.dataset.fclBaseWidth, 10);
      const baseH = parseInt(img.dataset.fclBaseHeight, 10);

      img.style.width = Math.round(baseW * state.zoomLevel) + 'px';
      img.style.height = Math.round(baseH * state.zoomLevel) + 'px';
    });
  }

  /**
   * Handles scroll-wheel events on the zoom label to increment/decrement zoom.
   */
  function handleZoomScroll(e) {
    e.preventDefault();
    state.zoomLevel += (e.deltaY < 0) ? 0.1 : -0.1;
    // Clamp zoom between 0.3x and 3.0x, rounding to avoid floating point errors
    state.zoomLevel = Math.max(0.3, Math.min(3.0, Math.round(state.zoomLevel * 10) / 10));

    ui.zoomLabel.innerText = `Zoom (${state.zoomLevel.toFixed(1)}x)`;
    applyZoomStyles();
  }

  // ==========================================
  // SETTINGS & STATE UI
  // ==========================================

  /**
   * Handles scroll-wheel events on the dynamic parameter label (s/post or Top k).
   */
  function handleDynamicScroll(e) {
    e.preventDefault();
    if (state.isLive) {
      if (e.deltaY < 0) CONFIG.bestOfSecPerPost++;
      else CONFIG.bestOfSecPerPost = Math.max(1, CONFIG.bestOfSecPerPost - 1);
    } else if (state.isFrozen) {
      // Allow user to manually tweak the held 'K' value while paused
      if (e.deltaY < 0) state.lastCalculatedK++;
      else state.lastCalculatedK = Math.max(1, state.lastCalculatedK - 1);
    } else {
      if (e.deltaY < 0) CONFIG.bestOfAbsoluteK++;
      else CONFIG.bestOfAbsoluteK = Math.max(1, CONFIG.bestOfAbsoluteK - 1);
    }
    updateVisuals();
    if (state.isBestOf) applyBestOfFilter();
  }

  function buildSettingsModal() {
    ui.modal.id = 'fcl-modal';
    document.body.appendChild(ui.modal);
  }

  /**
   * Hydrates and displays the settings modal with current configuration values.
   */
  function openSettingsModal() {
    ui.modal.innerHTML = `
      <h3>4Chat Settings</h3>

      <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #ccc;">
        <h4 style="margin-bottom: 10px;">Show UI Elements</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 0.9em;">
          <label><input type="checkbox" id="fcl-vis-liveBtn" ${VISIBILITY.liveBtn ? 'checked' : ''}> Live</label>
          <label><input type="checkbox" id="fcl-vis-bestOfBtn" ${VISIBILITY.bestOfBtn ? 'checked' : ''}> Best Of</label>
          <label><input type="checkbox" id="fcl-vis-dynamicLabel" ${VISIBILITY.dynamicLabel ? 'checked' : ''}> Variables (s/k)</label>
          <label><input type="checkbox" id="fcl-vis-zoomLabel" ${VISIBILITY.zoomLabel ? 'checked' : ''}> Zoom</label>
          <label><input type="checkbox" id="fcl-vis-settingsBtn" ${VISIBILITY.settingsBtn ? 'checked' : ''}> Settings</label>
        </div>
      </div>

      <h4 style="margin-bottom: 10px;">Parameters</h4>
      ${Object.keys(CONFIG).map(key => `
        <div class="fcl-form-group">
          <label title="${CONFIG_META[key] || ''}">${key} <span class="fcl-tooltip" title="${CONFIG_META[key] || ''}">(?)</span></label>
          <input type="number" id="fcl-input-${key}" value="${CONFIG[key]}">
        </div>
      `).join('')}
      <button id="fcl-modal-close">Save & Close</button>
    `;
    ui.modal.style.display = 'block';

    document.getElementById('fcl-modal-close').addEventListener('click', () => {
      // Persist UI visibility checkboxes
      Object.keys(VISIBILITY).forEach(key => {
        const checkbox = document.getElementById(`fcl-vis-${key}`);
        if (checkbox) VISIBILITY[key] = checkbox.checked;
      });

      // Persist algorithmic configuration parameters
      Object.keys(CONFIG).forEach(key => {
        const val = parseInt(document.getElementById(`fcl-input-${key}`).value, 10);
        if (!isNaN(val)) CONFIG[key] = val;
      });

      ui.modal.style.display = 'none';
      updateVisuals();
      if (state.isBestOf) applyBestOfFilter();
    });
  }

  /**
   * Syncs the floating button text, colors, and visibility states 
   * with the underlying application state.
   */
  function updateVisuals() {
    // 1. Live Mode Button
    if (state.isLive) {
      ui.liveBtn.innerText = `🟢 Live: ON (${state.timeRemaining}s)`;
      ui.liveBtn.style.backgroundColor = '#c0f0c0';
      ui.liveBtn.style.border = '1px solid #008000';
    } else {
      ui.liveBtn.innerText = '🔴 Live: OFF';
      ui.liveBtn.style.backgroundColor = '#f0c0c0';
      ui.liveBtn.style.border = '1px solid #800000';
    }

    // 2. Best Of Mode Button & Dynamic Label
    if (state.isBestOf) {
      ui.bestOfBtn.innerText = '⭐ Best Of: ON';
      ui.bestOfBtn.style.backgroundColor = '#fff0c0';
      ui.bestOfBtn.style.border = '1px solid #b8860b';
      
      // Update the label appropriately based on the 3 potential modes
      if (state.isLive) {
        ui.dynamicLabel.innerText = `${CONFIG.bestOfSecPerPost}s/post`;
      } else if (state.isFrozen) {
        ui.dynamicLabel.innerText = `Top ${state.lastCalculatedK} (Held)`;
      } else {
        ui.dynamicLabel.innerText = `Top ${CONFIG.bestOfAbsoluteK}`;
      }
    } else {
      ui.bestOfBtn.innerText = '☆ Best Of: OFF';
      ui.bestOfBtn.style.backgroundColor = '#eee';
      ui.bestOfBtn.style.border = '1px solid #aaa';
    }

    // 3. Apply Visibility Toggles
    ui.liveBtn.style.display = VISIBILITY.liveBtn ? 'block' : 'none';
    ui.bestOfBtn.style.display = VISIBILITY.bestOfBtn ? 'block' : 'none';
    ui.dynamicLabel.style.display = (state.isBestOf && VISIBILITY.dynamicLabel) ? 'block' : 'none';
    ui.zoomLabel.style.display = VISIBILITY.zoomLabel ? 'block' : 'none';
    ui.settingsBtn.style.display = VISIBILITY.settingsBtn ? 'block' : 'none';
  }

  // ==========================================
  // MARKOV CHAIN "BEST OF" LOGIC
  // ==========================================

  /**
   * Runs a PageRank (Power Iteration) algorithm on an array of posts.
   * Constructs an undirected graph where posts are nodes and replies (>> links) are edges.
   * Identifies the most "central" or engaging posts in the network.
   */
  function calculateStationaryProbabilities(posts, damping = 0.95, iterations = 20) {
    const N = posts.length;
    if (N === 0) return [];

    // Map post IDs to their matrix indices for quick lookup
    const idToIndex = new Map();
    posts.forEach((p, i) => {
      const idMatch = p.id.match(/\d+/);
      if (idMatch) idToIndex.set(idMatch[0], i);
    });

    // 1. Build Adjacency Matrix based on quotelinks
    const adj = Array.from({ length: N }, () => new Float32Array(N));
    posts.forEach((p, i) => {
      const quotes = p.querySelectorAll('.quotelink');
      quotes.forEach(q => {
        const targetMatch = q.getAttribute('href')?.match(/\d+/);
        if (targetMatch && idToIndex.has(targetMatch[0])) {
          const j = idToIndex.get(targetMatch[0]);
          adj[i][j] = 1;
          adj[j][i] = 1; // Undirected graph
        }
      });
    });

    // 2. Build Markov Transition Matrix (normalize rows)
    const M = Array.from({ length: N }, () => new Float32Array(N));
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) sum += adj[i][j];
      for (let j = 0; j < N; j++) {
        // If node has links, divide uniformly. Else, random jump to all (1/N)
        M[i][j] = sum > 0 ? (adj[i][j] / sum) : (1 / N);
      }
    }

    // 3. Power Iteration to find the stationary vector
    let v = new Float32Array(N).fill(1 / N);
    let next_v = new Float32Array(N);
    const randomJumpProb = (1 - damping) / N;

    for (let iter = 0; iter < iterations; iter++) {
      for (let j = 0; j < N; j++) {
        let dotProduct = 0;
        for (let i = 0; i < N; i++) {
          dotProduct += v[i] * M[i][j];
        }
        next_v[j] = (damping * dotProduct) + randomJumpProb;
      }
      // Swap vectors for the next iteration
      let temp = v;
      v = next_v;
      next_v = temp;
    }

    return Array.from(v); // Return the final PageRank scores
  }

  /**
   * Orchestrates the Best Of filtering based on whether Live mode is active.
   * Branches into Velocity, Held, or Archive modes.
   */
  function applyBestOfFilter() {
    const allPosts = Array.from(document.querySelectorAll('.postContainer'));
    if (allPosts.length === 0) return;

    // Reset visibility if Best Of is turned off
    if (!state.isBestOf) {
      allPosts.forEach(p => p.classList.remove('fcl-hidden'));
      return;
    }

    let windowPosts, K;

    if (state.isLive) {
      // MODE 1: Velocity Filter (Live ON)
      state.isFrozen = false; // Ensure we unfreeze if Live is turned back on
      const N = Math.min(CONFIG.bestOfWindowSize, allPosts.length);
      windowPosts = allPosts.slice(-N);
      
      // Ensure all older posts outside the window remain visible
      allPosts.slice(0, -N).forEach(p => p.classList.remove('fcl-hidden'));

      // Calculate time span of the window to determine K based on `bestOfSecPerPost`
      const getUtc = (post) => parseInt(post.querySelector('.dateTime')?.getAttribute('data-utc') || '0', 10);
      const tFirst = getUtc(windowPosts[0]);
      const tLast = getUtc(windowPosts[windowPosts.length - 1]);
      const windowSeconds = Math.max(1, tLast - tFirst);

      const targetK = Math.round(windowSeconds / CONFIG.bestOfSecPerPost);
      K = Math.max(1, Math.min(N, targetK));
      state.lastCalculatedK = K; // Track this so we can seamlessly hand off to Held mode
      
    } else if (state.isFrozen) {
      // MODE 2: Held/Frozen Filter (Live OFF, Best Of held)
      // Maintains the exact same window size sliding constraint and static K
      // to ensure you don't lose your place while reading.
      const N = Math.min(CONFIG.bestOfWindowSize, allPosts.length);
      windowPosts = allPosts.slice(-N);
      
      allPosts.slice(0, -N).forEach(p => p.classList.remove('fcl-hidden'));
      K = Math.max(1, Math.min(N, state.lastCalculatedK));
      
    } else {
      // MODE 3: Archive Filter (Live OFF, Best Of freshly toggled)
      // Evaluate the entire thread top-to-bottom and show the absolute top K posts
      windowPosts = allPosts;
      K = Math.max(1, Math.min(allPosts.length, CONFIG.bestOfAbsoluteK));
    }

    // Rank the posts and isolate the indices of the top K
    const ranks = calculateStationaryProbabilities(windowPosts);
    const indices = windowPosts.map((_, i) => i);
    indices.sort((a, b) => ranks[b] - ranks[a]);
    const topIndices = new Set(indices.slice(0, K));

    // Toggle the hidden class based on inclusion in the top K set
    windowPosts.forEach((p, i) => {
      p.classList.toggle('fcl-hidden', !topIndices.has(i));
    });
  }

  // ==========================================
  // LIVE MODE LOOP & OBSERVERS
  // ==========================================

  /**
   * Scrolls the page so the last non-hidden post aligns with the bottom of the screen.
   */
  function scrollToLastVisiblePost() {
    if (!state.isLive) return;
    const posts = Array.from(document.querySelectorAll('.postContainer')).filter(p => !p.classList.contains('fcl-hidden'));
    if (posts.length > 0) posts[posts.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function toggleBestOfMode() {
    state.isBestOf = !state.isBestOf;
    
    // Clear the frozen state when turning Best Of completely off, 
    // so next time it turns on (while Live is off) it triggers a fresh Archive mode
    if (!state.isBestOf) {
      state.isFrozen = false;
    }
    
    applyBestOfFilter();
    updateVisuals();
    if (state.isLive) scrollToLastVisiblePost();
  }

  /**
   * Looks for the standard thread update button (vanilla or 4chan X) and clicks it natively.
   */
  function triggerThreadUpdate() {
    const updateBtn = Array.from(document.querySelectorAll('a')).find(
      a => a.textContent.trim() === 'Update' || a.textContent.trim() === 'Update Thread'
    );
    if (updateBtn) updateBtn.click();
  }

  /**
   * Executes every second while Live mode is active.
   * Handles the countdown and dynamically adjusts the next interval based on thread velocity.
   */
  function handleTick() {
    if (!state.isLive) return;
    state.timeRemaining--;

    if (state.timeRemaining <= 0) {
      triggerThreadUpdate();
      
      // Calculate next wait time (t = newPosts / targetPostsPerSec)
      const calculatedT = Math.round(state.newPostsSinceUpdate / CONFIG.targetPostsPerSec);
      
      // Clamp the resulting time between minInterval and maxInterval
      state.timeRemaining = Math.max(CONFIG.minInterval, Math.min(CONFIG.maxInterval, calculatedT));
      state.newPostsSinceUpdate = 0;
    }
    updateVisuals();
  }

  function toggleLiveMode() {
    state.isLive = !state.isLive;

    if (state.isLive) {
      // Setup state for new Live session
      state.totalKnownPosts = document.querySelectorAll('.postContainer').length;
      state.newPostsSinceUpdate = 0;
      state.timeRemaining = CONFIG.minInterval;
      state.isFrozen = false;

      updateVisuals();
      if (state.isBestOf) applyBestOfFilter();
      scrollToLastVisiblePost();
      
      // Start the 1-second ticker loop
      state.tickerId = setInterval(handleTick, 1000);
    } else {
      // Teardown Live session
      if (state.tickerId) clearInterval(state.tickerId);

      // Freeze Best Of state so user doesn't lose their place while reading
      if (state.isBestOf) {
        state.isFrozen = true;
      }

      updateVisuals();
      if (state.isBestOf) applyBestOfFilter();
    }
  }

  /**
   * Watches the main thread container for newly injected post nodes.
   * Allows the script to react to updates from 4chan X or vanilla auto-updates.
   */
  function observeThread() {
    const threadContainer = document.querySelector('.thread');
    if (!threadContainer) return;

    const observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);

      if (hasAddedNodes) {
        // If the user has zoomed, ensure new thumbnails are scaled correctly
        if (state.zoomLevel !== 1.0) {
          updateImageDimensions();
        }

        // Ignore processing if neither feature is active
        if (!state.isLive && !state.isBestOf) return;

        const currentTotalPosts = document.querySelectorAll('.postContainer').length;
        const diff = currentTotalPosts - state.totalKnownPosts;

        if (diff > 0) {
          state.totalKnownPosts = currentTotalPosts;
          
          if (state.isLive) state.newPostsSinceUpdate += diff;
          
          // Re-rank posts to accommodate the new arrivals
          if (state.isBestOf) applyBestOfFilter();
          
          // Give the browser 100ms to render heights/images before scrolling
          if (state.isLive) setTimeout(scrollToLastVisiblePost, 100);
        }
      }
    });

    observer.observe(threadContainer, { childList: true, subtree: true });
  }

  // --- Bootstrap ---
  initUI();
  observeThread();

})();
