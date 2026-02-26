<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    appSettings, stats, logs, activeNotes, inputBuffer, isAppPaused,
    addLog, buildPools, initNotes, handleKeyboardInput, AudioEngine,
    calculateY, getVisualAccidental, parseInput, keySigs, keySigOctaves,
    COLOR_PENDING, COLOR_CORRECT, COLOR_ERROR, registerPauseDuration
  } from './logic.js';
  import Settings from './Settings.svelte';

  let innerWidth = window.innerWidth;
  let pauseTimestamp = 0;
  
  // View states
  let showLog = false;
  let showStats = false;
  let showSettings = false;

  // Derived values for Svelte declarative rendering
  $: isNarrow = innerWidth < 768;
  $: visibleNoteCount = isNarrow ? 4 : 8;
  $: vWidth = isNarrow ? 600 : 1000;
  
  $: viewBox = $appSettings.clef === 'grand' 
    ? ($appSettings.grandMode === 'two-hand' ? `0 -20 ${vWidth} 560` : `0 20 ${vWidth} 420`)
    : `0 40 ${vWidth} 320`;

  $: bassY = $appSettings.grandMode === 'two-hand' ? 340 : 280;
  $: bracketHeight = bassY + 80 - 160;

  // Reactive Octave Indicator Y position
  $: octaveYPos = $appSettings.clef === 'grand' 
    ? ($appSettings.octave === 1 ? 110 : ($appSettings.grandMode === 'two-hand' ? 470 : 390)) 
    : ($appSettings.octave === 1 ? 110 : 280);

  // Active Key Signatures for the SVG loops
  $: activeKeyAccs = keySigs[$appSettings.key] || [];
  
  // Calculate X offsets
  let X_START = 220;
  const X_STEP = 90;
  $: {
    let xOffset = 170;
    if (activeKeyAccs.length > 0) {
      xOffset = 170 + activeKeyAccs.length * 16;
    }
    X_START = Math.max(220, xOffset + 40);
  }

  // Formatting stats
  $: elapsedSecs = Math.floor((Date.now() - $stats.startTime) / 1000); // Actually updated by interval
  $: minsDisplay = Math.floor(elapsedSecs / 60).toString().padStart(2, '0');
  $: secsDisplay = (elapsedSecs % 60).toString().padStart(2, '0');
  $: totalNotes = $stats.correct + $stats.mistakes;
  $: ratio = totalNotes === 0 ? 0 : Math.round(($stats.correct / totalNotes) * 100);
  $: npm = (elapsedSecs / 60) > 0 ? Math.round(Math.max(0, $stats.correct - $stats.mistakes) / (elapsedSecs / 60)) : 0;

  let timerInterval;
  let flashInstruction = false;

  // Syncing hash and initializing app
  onMount(() => {
    // Check URL Hash first
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      appSettings.update(s => {
        let newS = { ...s };
        for (const [key, val] of params.entries()) {
          if (key in newS) {
            if (typeof newS[key] === 'number') newS[key] = Number(val);
            else if (typeof newS[key] === 'boolean') newS[key] = (val === 'true' || val === '1');
            else newS[key] = val;
          }
        }
        return newS;
      });
    }

    addLog("Application Started.");
    buildPools();
    initNotes(visibleNoteCount);

    flashInstruction = true;

    if ($appSettings.input === 'mic') {
       AudioEngine.init().catch(e => console.error("Mic boot failed:", e));
    }

    // Refresh the stats display every second
    timerInterval = setInterval(() => {
      if (!$isAppPaused) {
        $stats = $stats; // Triggers Svelte reactivity to update `elapsedSecs`
      }
    }, 1000);

    // Keyboard listener
    window.addEventListener('keydown', handleKey);
  });

  onDestroy(() => {
    clearInterval(timerInterval);
    window.removeEventListener('keydown', handleKey);
  });

  function handleKey(e) {
    if ($appSettings.input === 'keyboard') {
      handleKeyboardInput(e.key.toLowerCase());
    }
  }

  // Checking Pause logic
  $: {
    const shouldBePaused = showSettings || showStats || showLog || !document.hasFocus();
    if (shouldBePaused && !$isAppPaused) {
      $isAppPaused = true;
      pauseTimestamp = Date.now();
    } else if (!shouldBePaused && $isAppPaused) {
      $isAppPaused = false;
      const pauseDuration = Date.now() - pauseTimestamp;
      $stats.startTime += pauseDuration;
      registerPauseDuration(pauseDuration);
    }
  }

  function handleBlur() { $isAppPaused = $isAppPaused; /* re-evaluate */ }
  function handleFocus() { $isAppPaused = $isAppPaused; }

  // SVG Helper: Ledger lines
  function getLedgerLines(y, staffTop, staffBottom) {
    let lines = [];
    if (y <= staffTop - 20) {
      for (let ly = staffTop - 20; ly >= y; ly -= 20) lines.push(ly);
    }
    if (y >= staffBottom + 20) {
      for (let ly = staffBottom + 20; ly <= y; ly += 20) lines.push(ly);
    }
    return lines;
  }
</script>

<svelte:window bind:innerWidth on:blur={handleBlur} on:focus={handleFocus} />

<div id="app-container">
  <button type="button" class="top-btn" title="Activity Log" on:click={() => showLog = true} style="right: 7.5rem;">📝</button>
  <button type="button" class="top-btn" title="Stats" on:click={() => showStats = true} style="right: 4.5rem;">📊</button>
  <button type="button" class="top-btn" title="Settings" on:click={() => showSettings = true} style="right: 1.5rem;">⚙️</button>

  <div class="ui-layer instructions">
    {#if $appSettings.input === 'mic'}
      Microphone Active. Use an instrument or your voice to enter notes.
    {:else}
      Enter notes with PC keyboard (a4, g#5/gs5, eb3)<br>
      <span class="mic-instruction-part" class:flash-text-gaudy={flashInstruction}>or enable the mic in Settings to use an instrument or your voice.</span>
    {/if}
  </div>

  <!-- SVELTE MAKES SVG 100% DECLARATIVE. NO MORE `appendChild` or `createSVGElement` in JS! -->
  <svg id="staff-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
    <!-- Staff Lines -->
    <g fill="none" stroke="#333" stroke-width="2">
      <!-- Treble Lines -->
      {#each Array(5) as _, i} <line x1="40" x2="960" y1={160 + i*20} y2={160 + i*20} /> {/each}
      
      <!-- Bass Lines -->
      {#if $appSettings.clef === 'grand' || $appSettings.clef === 'bass'}
        {#each Array(5) as _, i} 
          <line x1="40" x2="960" y1={($appSettings.clef === 'grand' ? bassY : 160) + i*20} y2={($appSettings.clef === 'grand' ? bassY : 160) + i*20} /> 
        {/each}
      {/if}

      <!-- Bracket -->
      {#if $appSettings.clef === 'grand'}
        <path d="M 35 160 C 10 160 10 {160 + bracketHeight/2} 0 {160 + bracketHeight/2} C 10 {160 + bracketHeight/2} 10 {160 + bracketHeight} 35 {160 + bracketHeight} C 20 {160 + bracketHeight} 20 {160 + bracketHeight/2} 10 {160 + bracketHeight/2} C 20 {160 + bracketHeight/2} 20 160 35 160 Z" fill="#333" stroke="none"/>
        <line x1="40" x2="40" y1="160" y2={160 + bracketHeight} />
      {/if}
    </g>

    <!-- Clefs -->
    <g fill="#333" class="clef-text" text-anchor="middle">
      {#if $appSettings.clef === 'grand' || $appSettings.clef === 'treble'}
        <text font-size="82" x="110" y={160 + 60}>&#119070;</text>
      {/if}
      {#if $appSettings.clef === 'grand' || $appSettings.clef === 'bass'}
        <text font-size="82" x="110" y={($appSettings.clef === 'grand' ? bassY : 160) + 20}>&#119074;</text>
      {/if}
    </g>

    <!-- Key Signatures -->
    <g font-family="sans-serif" font-size="26" fill="#333">
      <!-- Treble Key Sig -->
      {#if $appSettings.clef === 'grand' || $appSettings.clef === 'treble'}
        {#each activeKeyAccs as acc, i}
          <text x={170 + i*16} y={calculateY(acc.p, keySigOctaves['treble'][acc.a === '#' ? '#' : 'b'][acc.p], 'treble', $appSettings) + 6}>
            {acc.a === '#' ? '♯' : '♭'}
          </text>
        {/each}
      {/if}
      <!-- Bass Key Sig -->
      {#if $appSettings.clef === 'grand' || $appSettings.clef === 'bass'}
        {#each activeKeyAccs as acc, i}
          <text x={170 + i*16} y={calculateY(acc.p, keySigOctaves['bass'][acc.a === '#' ? '#' : 'b'][acc.p], 'bass', $appSettings) + 6}>
            {acc.a === '#' ? '♯' : '♭'}
          </text>
        {/each}
      {/if}
    </g>

    <!-- Octave Indicator -->
    {#if $appSettings.octave !== 0}
      <g>
        <text x="100" y={octaveYPos} font-size="20" fill="#333" font-style="italic" font-weight="bold">
          {$appSettings.octave === 1 ? '8va' : '8vb'}
        </text>
        <line x1="140" x2="960" y1={octaveYPos - 6} y2={octaveYPos - 6} stroke="#333" stroke-width="1" stroke-dasharray="5,5" />
      </g>
    {/if}

    <!-- Notes Layer -->
    <g id="notes-layer">
      {#each $activeNotes as note, idx (note.id)}
        {@const targetY = calculateY(note.data.pitch, note.data.visualOct, note.data.noteClef, $appSettings)}
        {@const targetVisAcc = getVisualAccidental(note.data.pitch, note.data.trueAcc, $appSettings)}
        {@const errData = note.errorInput ? parseInput(note.errorInput) : null}
        {@const errY = errData ? calculateY(errData.pitch, errData.oct - $appSettings.octave, note.data.noteClef, $appSettings) : 0}
        {@const errVisAcc = errData ? getVisualAccidental(errData.pitch, errData.acc, $appSettings) : ''}
        
        {@const staffTop = note.data.noteClef === 'treble' ? 160 : ($appSettings.clef === 'grand' ? bassY : 160)}
        {@const staffBottom = staffTop + 80}
        
        <!-- Parent Group handles transform -->
        <g class="note-group" style="transform: translateX({X_START + idx * X_STEP}px)">
          
          {#if note.state === 'pending' || note.state === 'correct'}
            {@const color = note.state === 'correct' ? COLOR_CORRECT : COLOR_PENDING}
            {@const isStemUp = targetY > (staffTop + 40)}
            <g fill={color} stroke={color}>
              {#each getLedgerLines(targetY, staffTop, staffBottom) as ly}
                <line x1="-22" x2="22" y1={ly} y2={ly} stroke-width="2" />
              {/each}
              <ellipse cx="0" cy={targetY} rx="14" ry="10" transform="rotate(-20 0 {targetY})" />
              <line x1={isStemUp ? 12 : -12} x2={isStemUp ? 12 : -12} y1={targetY} y2={isStemUp ? targetY - 35 : targetY + 35} stroke-width="2" />
              {#if targetVisAcc}
                <text x="-32" y={targetY + 6} font-size="26" font-family="sans-serif" stroke="none" fill={color}>
                  {targetVisAcc === '#' ? '♯' : targetVisAcc === 'b' ? '♭' : '♮'}
                </text>
              {/if}
            </g>
          {:else if note.state === 'error' && errData}
            {#if errY !== targetY}
              <!-- Target note stays pending -->
              {@const isTargetStemUp = targetY > (staffTop + 40)}
              <g fill={COLOR_PENDING} stroke={COLOR_PENDING}>
                {#each getLedgerLines(targetY, staffTop, staffBottom) as ly}
                  <line x1="-22" x2="22" y1={ly} y2={ly} stroke-width="2" />
                {/each}
                <ellipse cx="0" cy={targetY} rx="14" ry="10" transform="rotate(-20 0 {targetY})" />
                <line x1={isTargetStemUp ? 12 : -12} x2={isTargetStemUp ? 12 : -12} y1={targetY} y2={isTargetStemUp ? targetY - 35 : targetY + 35} stroke-width="2" />
                {#if targetVisAcc}
                  <text x="-32" y={targetY + 6} font-size="26" font-family="sans-serif" stroke="none" fill={COLOR_PENDING}>
                    {targetVisAcc === '#' ? '♯' : targetVisAcc === 'b' ? '♭' : '♮'}
                  </text>
                {/if}
              </g>
              <!-- Error note drawn in red -->
              {@const isErrStemUp = errY > (staffTop + 40)}
              <g fill={COLOR_ERROR} stroke={COLOR_ERROR}>
                {#each getLedgerLines(errY, staffTop, staffBottom) as ly}
                  <line x1="-22" x2="22" y1={ly} y2={ly} stroke-width="2" />
                {/each}
                <ellipse cx="0" cy={errY} rx="14" ry="10" transform="rotate(-20 0 {errY})" />
                <line x1={isErrStemUp ? 12 : -12} x2={isErrStemUp ? 12 : -12} y1={errY} y2={isErrStemUp ? errY - 35 : errY + 35} stroke-width="2" />
                {#if errVisAcc}
                  <text x="-32" y={errY + 6} font-size="26" font-family="sans-serif" stroke="none" fill={COLOR_ERROR}>
                    {errVisAcc === '#' ? '♯' : errVisAcc === 'b' ? '♭' : '♮'}
                  </text>
                {/if}
              </g>
            {:else}
              <!-- Pitch is correct, accidental is wrong -->
              {@const isStemUp = targetY > (staffTop + 40)}
              {#if errVisAcc === ''}
                <!-- Missed the required accidental -->
                <g fill={COLOR_ERROR} stroke={COLOR_ERROR}>
                  {#each getLedgerLines(targetY, staffTop, staffBottom) as ly}
                    <line x1="-22" x2="22" y1={ly} y2={ly} stroke-width="2" />
                  {/each}
                  <ellipse cx="0" cy={targetY} rx="14" ry="10" transform="rotate(-20 0 {targetY})" />
                  <line x1={isStemUp ? 12 : -12} x2={isStemUp ? 12 : -12} y1={targetY} y2={isStemUp ? targetY - 35 : targetY + 35} stroke-width="2" />
                </g>
                {#if targetVisAcc}
                  <text x="-32" y={targetY + 6} font-size="26" font-family="sans-serif" stroke="none" fill={COLOR_PENDING}>
                    {targetVisAcc === '#' ? '♯' : targetVisAcc === 'b' ? '♭' : '♮'}
                  </text>
                {/if}
              {:else}
                <!-- Typed wrong accidental -->
                <g fill={COLOR_PENDING} stroke={COLOR_PENDING}>
                  {#each getLedgerLines(targetY, staffTop, staffBottom) as ly}
                    <line x1="-22" x2="22" y1={ly} y2={ly} stroke-width="2" />
                  {/each}
                  <ellipse cx="0" cy={targetY} rx="14" ry="10" transform="rotate(-20 0 {targetY})" />
                  <line x1={isStemUp ? 12 : -12} x2={isStemUp ? 12 : -12} y1={targetY} y2={isStemUp ? targetY - 35 : targetY + 35} stroke-width="2" />
                </g>
                <text x="-32" y={targetY + 6} font-size="26" font-family="sans-serif" stroke="none" fill={COLOR_ERROR}>
                  {errVisAcc === '#' ? '♯' : errVisAcc === 'b' ? '♭' : '♮'}
                </text>
              {/if}
            {/if}
          {/if}
        </g>
      {/each}
    </g>
  </svg>

  <div class="ui-layer buffer-display">{$inputBuffer}</div>
  
  <!-- Log Overlay -->
  {#if showLog}
    <div class="overlay-container">
      <div class="panel" style="max-width: 600px;">
        <h2>Activity Log</h2>
        <div class="log-list">
          {#each $logs as log} <div>{log}</div> {/each}
        </div>
        <button class="btn" on:click={() => showLog = false}>Return to Staff</button>
      </div>
    </div>
  {/if}

  <!-- Stats Overlay -->
  {#if showStats}
    <div class="overlay-container">
      <div class="panel">
        <h2>Stats</h2>
        <div class="stats-list">
          <p>Time Elapsed: <span>{minsDisplay}:{secsDisplay}</span></p>
          <p>Correct Notes: <span class="stat-blue">{$stats.correct}</span></p>
          <p>Mistakes Made: <span class="stat-red">{$stats.mistakes}</span></p>
          <p>Accuracy: <span>{ratio}%</span></p>
          <p title="Penalized correct note rate: (Correct - Mistakes) / Minutes">
            Net Speed: <span class="stat-green">{npm} <span style="font-size: 0.8rem; font-weight: normal; color: #666;">NPM</span></span>
          </p>
        </div>
        <button class="btn btn-outline" on:click={() => { $stats = { startTime: Date.now(), correct: 0, mistakes: 0 }; pauseTimestamp = Date.now(); addLog("Stats manually reset."); }}>Reset Stats</button>
        <button class="btn" on:click={() => showStats = false}>Return to Staff</button>
      </div>
    </div>
  {/if}

  <!-- Settings Overlay handled in separate component to keep this file clean -->
  {#if showSettings}
    <Settings bind:showSettings />
  {/if}

</div>

<style>
  /* All CSS localized here. Automatically scoped by Svelte (except those marked global or structural) */
  #app-container {
    width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .top-btn {
    position: absolute; top: 1.5rem; font-size: 2rem;
    cursor: pointer; z-index: 10; transition: transform 0.2s; user-select: none;
    background: none; border: none; padding: 0; outline: none;
  }
  .top-btn:hover { transform: scale(1.1); }
  
  .overlay-container {
    display: flex; position: absolute; inset: 0; background: #fdfdfd;
    z-index: 100; flex-direction: column; align-items: center; justify-content: center; padding: 1rem;
  }
  .panel {
    background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 2rem;
    width: 100%; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-height: 90vh; overflow-y: auto;
  }
  .panel h2 { margin-top: 0; text-align: center; margin-bottom: 1.5rem; }

  .stats-list { margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee; }
  .stats-list p { margin: 0.8rem 0; font-size: 1.2rem; display: flex; justify-content: space-between; border-bottom: 1px dashed #ddd; padding-bottom: 0.4rem; }
  .stats-list p:last-child { border-bottom: none; padding-bottom: 0; }
  .stat-blue { color: #3b82f6; font-weight: bold; }
  .stat-red { color: #ef4444; font-weight: bold; }
  .stat-green { color: #10b981; font-weight: bold; }

  .log-list { margin-top: 1rem; background: #1e1e1e; color: #4ade80; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; max-height: 50vh; overflow-y: auto; text-align: left; }
  .log-list div { border-bottom: 1px solid #333; padding: 0.4rem 0; word-wrap: break-word; }
  .log-list div:last-child { border-bottom: none; }
  
  :global(.btn) {
    display: block; width: 100%; padding: 0.8rem; margin-top: 1rem; font-size: 1.1rem;
    font-weight: bold; color: white; background: #333; border: none; border-radius: 6px; cursor: pointer;
  }
  :global(.btn:hover:not(:disabled)) { background: #555; }
  :global(.btn:disabled) { background: #aaa; cursor: not-allowed; }
  :global(.btn-outline) { background: transparent; color: #333; border: 2px solid #333; margin-top: 0.5rem; }
  :global(.btn-outline:hover) { background: #eee; }

  svg { width: 100%; height: 100%; max-height: 100vh; display: block; }
  .clef-text { font-family: 'Bravura', 'Apple Symbols', 'Segoe UI Symbol', sans-serif; }
  
  .note-group { transition: transform 0.4s ease-in-out, opacity 0.4s; }
  .note-group ellipse, .note-group line, .note-group text { transition: fill 0.15s, stroke 0.15s; }

  .ui-layer { position: absolute; width: 100%; text-align: center; pointer-events: none; }
  .instructions { top: 5vh; color: #666; font-size: 1.2rem; padding: 0 1rem; line-height: 1.4; }
  .buffer-display { bottom: 8vh; font-size: 2.5rem; font-weight: bold; color: #444; min-height: 3rem; letter-spacing: 2px; text-transform: uppercase; }

  /* Gaudy Green-Red-Blue Flash Sequence */
  @keyframes gaudyGRB {
    0%, 100% { color: #666; text-shadow: none; transform: scale(1); font-weight: normal; }
    15%, 85% { color: #009900; text-shadow: 0 0 10px #009900, 0 0 15px #009900; transform: scale(1.05); font-weight: bold; }
    35% { color: #dd0000; text-shadow: 0 0 10px #dd0000, 0 0 15px #dd0000; transform: scale(1.05); font-weight: bold; }
    60% { color: #0000ff; text-shadow: 0 0 10px #0000ff, 0 0 15px #0000ff; transform: scale(1.05); font-weight: bold; }
  }
  .flash-text-gaudy {
    animation: gaudyGRB 4.0s ease-in-out 1;
    display: inline-block;
    transition: color 0.3s;
  }

  @media (max-width: 768px) {
    .instructions { font-size: 0.95rem; }
    .buffer-display { font-size: 1.8rem; bottom: 5vh; }
    .top-btn { font-size: 1.6rem; }
  }
</style>
