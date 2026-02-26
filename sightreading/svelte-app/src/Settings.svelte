<script>
  import { onMount } from 'svelte';
  import { appSettings, AudioEngine, buildPools, initNotes, inputBuffer, hasOpenedSettings } from './logic.js';
  export let showSettings;

  let localSettings = { ...$appSettings }; // Clone to avoid live updating before save
  let isSaving = false;
  let flashInput = false;

  onMount(() => {
    if (!$hasOpenedSettings) {
      flashInput = true;
      $hasOpenedSettings = true;
      setTimeout(() => flashInput = false, 3000);
    }
  });

  // Reusable component parts
  let openInfos = {};
  function toggleInfo(id) { openInfos[id] = !openInfos[id]; }

  // Range Notes Generator
  const notesList = [];
  for (let oct = 1; oct <= 7; oct++) {
    ['c','d','e','f','g','a','b'].forEach(p => notesList.push({ val: p + oct, label: p.toUpperCase() + oct }));
  }

  async function saveSettings() {
    let hasChanges = false;
    for (let k in localSettings) {
      if (localSettings[k] !== $appSettings[k]) {
        hasChanges = true;
        break;
      }
    }

    // Early exit if nothing actually changed
    if (!hasChanges) {
      showSettings = false;
      return;
    }

    isSaving = true;
    
    // Check if Mic was toggled
    const prevInput = $appSettings.input;
    const isNowMic = localSettings.input === 'mic';

    // Update global store
    $appSettings = { ...localSettings };

    // Update URL hash
    const params = new URLSearchParams();
    for (const key in $appSettings) {
      let val = $appSettings[key];
      if (typeof val === 'boolean') val = val ? '1' : '0';
      params.set(key, val);
    }
    window.history.replaceState(null, '', '#' + params.toString());

    // Handle Audio Engine
    if (isNowMic && prevInput !== 'mic') await AudioEngine.init();
    else if (!isNowMic && prevInput === 'mic') AudioEngine.stop();

    // Reset Staff
    $inputBuffer = '';
    buildPools();
    initNotes(window.innerWidth < 768 ? 4 : 8);

    showSettings = false;
    isSaving = false;
  }
</script>

<div class="overlay-container">
  <div class="panel">
    <h2>Settings</h2>
    
    <button class="btn" on:click={saveSettings} disabled={isSaving} style="margin-top: 0; margin-bottom: 1.5rem;">
      {isSaving ? "Loading Pitch Detection model..." : "Save & Reset Staff"}
    </button>
    
    <div class="setting-row" class:flash-highlight={flashInput}>
      <label for="opt-input">Input Method <button type="button" class="info-btn" class:info-btn-active={openInfos['input']} on:click={() => toggleInfo('input')}>i</button></label>
      <select id="opt-input" bind:value={localSettings.input}>
        <option value="keyboard">Keyboard Typing</option>
        <option value="mic">Mic (Instrument/Voice)</option>
      </select>
    </div>
    {#if openInfos['input']} <div class="info-blurb">Practice by typing notes on a keyboard, or use a microphone to detect pitch from a real instrument or your voice.</div> {/if}

    {#if localSettings.input === 'mic'}
      <div class="setting-row">
        <label for="opt-sens">Mic Sensitivity <button type="button" class="info-btn" class:info-btn-active={openInfos['sens']} on:click={() => toggleInfo('sens')}>i</button></label>
        <select id="opt-sens" bind:value={localSettings.micSensitivity}>
          <option value={0.75}>High (Picks up quiet/noisy notes)</option>
          <option value={0.85}>Medium (Default)</option>
          <option value={0.92}>Low (Reduces background noise)</option>
          <option value={0.96}>Very Low (Requires solid playing)</option>
        </select>
      </div>
      {#if openInfos['sens']} <div class="info-blurb">Higher sensitivity picks up quieter notes but may trigger on background noise.</div> {/if}

      <div class="setting-row">
        <label for="opt-cool">Mic Cooldown <button type="button" class="info-btn" class:info-btn-active={openInfos['cool']} on:click={() => toggleInfo('cool')}>i</button></label>
        <div style="display: flex; align-items: center; width: 55%; gap: 0.5rem;">
          <input id="opt-cool" type="range" bind:value={localSettings.micCooldown} min="50" max="2000" step="10" style="flex-grow: 1;">
          <span style="min-width: 3.5rem; text-align: right; font-size: 0.9rem;">{localSettings.micCooldown}ms</span>
        </div>
      </div>
      {#if openInfos['cool']} <div class="info-blurb">The minimum time required between detecting new notes.</div> {/if}
    {/if}

    <hr style="border: 0; border-top: 1px solid #eee; margin: 1.5rem 0;">

    <div class="setting-row">
      <label for="opt-clef">Clef <button type="button" class="info-btn" class:info-btn-active={openInfos['clef']} on:click={() => toggleInfo('clef')}>i</button></label>
      <select id="opt-clef" bind:value={localSettings.clef}>
        <option value="treble">Treble</option>
        <option value="bass">Bass</option>
        <option value="grand">Grand (Bass+Treble)</option>
      </select>
    </div>
    {#if openInfos['clef']} <div class="info-blurb">The musical staff to practice on.</div> {/if}

    {#if localSettings.clef === 'grand'}
      <div class="setting-row">
        <label for="opt-gmode">Grand Staff Mode <button type="button" class="info-btn" class:info-btn-active={openInfos['gmode']} on:click={() => toggleInfo('gmode')}>i</button></label>
        <select id="opt-gmode" bind:value={localSettings.grandMode}>
          <option value="two-hand">Two Hands (Separated)</option>
          <option value="one-hand">One Hand (Interlocked)</option>
        </select>
      </div>
      {#if openInfos['gmode']} <div class="info-blurb">Separated treats left and right hands independently.</div> {/if}
    {/if}
    
    <div class="setting-row">
      <label for="opt-key">Key Signature <button type="button" class="info-btn" class:info-btn-active={openInfos['key']} on:click={() => toggleInfo('key')}>i</button></label>
      <select id="opt-key" bind:value={localSettings.key}>
        <option value="C">C Major / A minor</option>
        <option value="G">G Major / E minor</option>
        <option value="D">D Major / B minor</option>
        <option value="A">A Major / F# minor</option>
        <option value="E">E Major / C# minor</option>
        <option value="B">B Major / G# minor</option>
        <option value="F">F Major / D minor</option>
        <option value="Bb">Bb Major / G minor</option>
        <option value="Eb">Eb Major / C minor</option>
        <option value="Ab">Ab Major / F minor</option>
        <option value="Db">Db Major / Bb minor</option>
        <option value="Gb">Gb Major / Eb minor</option>
      </select>
    </div>
    {#if openInfos['key']} <div class="info-blurb">The musical key to practice in.</div> {/if}

    <div class="setting-row">
      <label for="opt-acc">Accidentals <button type="button" class="info-btn" class:info-btn-active={openInfos['acc']} on:click={() => toggleInfo('acc')}>i</button></label>
      <select id="opt-acc" bind:value={localSettings.accidentals}>
        <option value={true}>Enabled</option>
        <option value={false}>Disabled (Diatonic to Key Only)</option>
      </select>
    </div>
    {#if openInfos['acc']} <div class="info-blurb">When enabled, the generator may include notes outside the key.</div> {/if}

    <div class="setting-row">
      <label for="opt-mode">Generation Mode <button type="button" class="info-btn" class:info-btn-active={openInfos['mode']} on:click={() => toggleInfo('mode')}>i</button></label>
      <select id="opt-mode" bind:value={localSettings.mode}>
        <option value="uniform">Uniform (Random)</option>
        <option value="chords">Chords Sequences</option>
        <option value="teaching">Teaching (Adaptive)</option>
      </select>
    </div>
    {#if openInfos['mode']} <div class="info-blurb">Uniform picks random notes. Chords generates stacked note sequences. Teaching adapts to mistakes.</div> {/if}

    {#if localSettings.mode === 'chords'}
      <div class="setting-row">
        <label for="opt-cstyle">Chord Playback <button type="button" class="info-btn" class:info-btn-active={openInfos['cstyle']} on:click={() => toggleInfo('cstyle')}>i</button></label>
        <select id="opt-cstyle" bind:value={localSettings.chordStyle}>
          <option value="arpeggio">Ascending / Descending</option>
          <option value="random">Any Order</option>
        </select>
      </div>
      {#if openInfos['cstyle']} <div class="info-blurb">Order of notes in a chord.</div> {/if}

      {#if localSettings.clef === 'grand' && localSettings.grandMode === 'two-hand'}
        <div class="setting-row">
          <label for="opt-calt">Alternate Hands <button type="button" class="info-btn" class:info-btn-active={openInfos['calt']} on:click={() => toggleInfo('calt')}>i</button></label>
          <select id="opt-calt" bind:value={localSettings.chordAlternate}>
            <option value={true}>Enabled</option>
            <option value={false}>Disabled</option>
          </select>
        </div>
        {#if openInfos['calt']} <div class="info-blurb">Forces chords to strictly alternate between left and right hand.</div> {/if}
      {/if}
    {/if}

    {#if localSettings.mode === 'teaching'}
      <div class="setting-row">
        <label for="opt-tkey">Starting Keys <button type="button" class="info-btn" class:info-btn-active={openInfos['tkey']} on:click={() => toggleInfo('tkey')}>i</button></label>
        <input id="opt-tkey" type="number" bind:value={localSettings.teachingKeys} min="1" max="20" style="width: 50%;">
      </div>
      {#if openInfos['tkey']} <div class="info-blurb">Number of initial notes the teaching algorithm will focus on.</div> {/if}

      <div class="setting-row">
        <label for="opt-tscale">Adaptation Scale <button type="button" class="info-btn" class:info-btn-active={openInfos['tscale']} on:click={() => toggleInfo('tscale')}>i</button></label>
        <input id="opt-tscale" type="number" bind:value={localSettings.teachingScale} min="5" max="100" style="width: 50%;">
      </div>
      {#if openInfos['tscale']} <div class="info-blurb">Controls how quickly the teaching algorithm introduces new notes.</div> {/if}
    {/if}

    <div class="setting-row">
      <label for="opt-trng">Treble Range <button type="button" class="info-btn" class:info-btn-active={openInfos['trng']} on:click={() => toggleInfo('trng')}>i</button></label>
      <div id="opt-trng" class="range-selects">
        <!-- aria-labels added for a11y since two selects share one visual label -->
        <select bind:value={localSettings.trebleMin} aria-label="Treble Minimum Range">
          {#each notesList as n} <option value={n.val}>{n.label}</option> {/each}
        </select>
        <select bind:value={localSettings.trebleMax} aria-label="Treble Maximum Range">
          {#each notesList as n} <option value={n.val}>{n.label}</option> {/each}
        </select>
      </div>
    </div>
    {#if openInfos['trng']} <div class="info-blurb">Lowest and highest notes on Treble clef.</div> {/if}

    <div class="setting-row">
      <label for="opt-brng">Bass Range <button type="button" class="info-btn" class:info-btn-active={openInfos['brng']} on:click={() => toggleInfo('brng')}>i</button></label>
      <div id="opt-brng" class="range-selects">
        <!-- aria-labels added for a11y since two selects share one visual label -->
        <select bind:value={localSettings.bassMin} aria-label="Bass Minimum Range">
          {#each notesList as n} <option value={n.val}>{n.label}</option> {/each}
        </select>
        <select bind:value={localSettings.bassMax} aria-label="Bass Maximum Range">
          {#each notesList as n} <option value={n.val}>{n.label}</option> {/each}
        </select>
      </div>
    </div>
    {#if openInfos['brng']} <div class="info-blurb">Lowest and highest notes on Bass clef.</div> {/if}

    <div class="setting-row">
      <label for="opt-oct">Octave <button type="button" class="info-btn" class:info-btn-active={openInfos['oct']} on:click={() => toggleInfo('oct')}>i</button></label>
      <select id="opt-oct" bind:value={localSettings.octave}>
        <option value={0}>Standard</option>
        <option value={1}>8va (Play higher)</option>
        <option value={-1}>8vb (Play lower)</option>
      </select>
    </div>
    {#if openInfos['oct']} <div class="info-blurb">Shifts the generated notes up or down an octave.</div> {/if}
    
    <div style="text-align: center; margin-top: 1.5rem;">
      <a href="https://github.com/chausies/chausies.github.io/tree/main/sightreading/README.md" target="_blank" style="color: #888; text-decoration: underline; font-size: 0.95rem;">About / Source Code</a>
    </div>
  </div>
</div>

<style>
  .overlay-container { display: flex; position: absolute; inset: 0; background: #fdfdfd; z-index: 100; flex-direction: column; align-items: center; justify-content: center; padding: 1rem; }
  .panel { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 2rem; width: 100%; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-height: 90vh; overflow-y: auto; }
  .panel h2 { margin-top: 0; text-align: center; margin-bottom: 1.5rem; }
  
  .setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .setting-row select, .setting-row input[type="range"], .setting-row input[type="number"] { padding: 0.4rem; font-size: 1rem; border-radius: 6px; border: 1px solid #ccc; max-width: 55%; }
  
  .range-selects { display: flex; gap: 0.5rem; width: 55%; }
  .range-selects select { width: 100%; max-width: none; }

  .info-btn { cursor: pointer; color: #666; font-size: 0.75rem; margin-left: 0.4rem; user-select: none; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 1.2rem; height: 1.2rem; border-radius: 50%; border: 1px solid #aaa; background: #fdfdfd; vertical-align: middle; transition: all 0.15s ease; outline: none; padding: 0; }
  .info-btn:hover { background: #eee; color: #333; border-color: #333; }
  .info-btn.info-btn-active { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; }
  
  .info-blurb { font-size: 0.85rem; color: #555; background: #f8f9fa; padding: 0.6rem 0.8rem; border-radius: 6px; margin-bottom: 1rem; border-left: 3px solid #ccc; line-height: 1.4; }

  @keyframes highlightRow {
    0%, 100% { background-color: transparent; box-shadow: 0 0 0 0 transparent; }
    20%, 80% { background-color: #dbeafe; box-shadow: 0 0 0 0.5rem #dbeafe; } 
  }
  .flash-highlight {
    animation: highlightRow 3s ease-in-out;
    border-radius: 6px;
  }
</style>
