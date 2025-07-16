(() => {
  const OVERLAY_ID = 'overlay-container';
  const SHADOW_HOST_ID = 'overlay-shadow-host';
  const CONTROLS_ID = 'overlay-controls';

  let state = {
    images: [],
    activeImageId: null,
    settings: {
      x: 0,
      y: 0,
      opacity: 0.5,
      scale: 0.5,
      invert: 1,
      locked: false,
      hidden: false,
    },
    panel: {
      minimized: false,
      top: 0,
      right: 0,
    }
  };

  if (document.getElementById(SHADOW_HOST_ID)) {
    document.getElementById(SHADOW_HOST_ID).remove();
    document.getElementById(OVERLAY_ID).remove();
    return;
  }

  const overlayContainer = document.createElement('div');
  overlayContainer.id = OVERLAY_ID;
  Object.assign(overlayContainer.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: `${document.documentElement.scrollHeight}px`,
    zIndex: '2147483646',
    pointerEvents: 'none'
  });

  const overlayImage = document.createElement('img');
  overlayImage.id = 'overlay-image';
  Object.assign(overlayImage.style, {
    position: 'absolute',
    transformOrigin: 'top left',
  });
  overlayContainer.appendChild(overlayImage);

  const shadowHost = document.createElement('div');
  shadowHost.id = SHADOW_HOST_ID;
  document.body.appendChild(shadowHost);
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  const controls = document.createElement('div');
  controls.id = CONTROLS_ID;

  document.body.appendChild(overlayContainer);
  shadowRoot.appendChild(controls);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('overlay.css');
  shadowRoot.appendChild(link);

  controls.innerHTML = `
    <div id="overlay-controls-header">
      <span>Overlay</span>
      <div>
        <button id="lockBtn" title="Lock/Unlock Image">🔒</button>
        <button id="hideBtn" title="Hide/Show Image">👁️</button>
        <button id="minBtn" title="Minimize/Restore Panel">➖</button>
      </div>
    </div>
    <div id="overlay-controls-body">
      <div class="control-group">
        <div class="input-row xy">
          <div><label>x</label><input type="number" id="xPos" step="1"></div>
          <div><label>y</label><input type="number" id="yPos" step="1"></div>
        </div>
      </div>
      <div class="control-group">
        <label>Scale</label>
        <div class="input-row">
          <div><input type="range" id="scaleRange" min="0" max="2" step="0.05"></div>
          <div><input type="number" id="scaleNumber" min="0" max="2" step="0.05"></div>
        </div>
      </div>
      <div class="control-group">
        <label>Opacity</label>
        <div class="input-row">
          <div><input type="range" id="opacityRange" min="0" max="1" step="0.05"></div>
          <div><input type="number" id="opacityNumber" min="0" max="1" step="0.05"></div>
        </div>
      </div>
      <div class="control-group">
        <label>Invert</label>
        <div class="input-row">
          <div><input type="range" id="invertRange" min="0" max="1" step="0.1"></div>
          <div><input type="number" id="invertNumber" min="0" max="1" step="0.1"></div>
        </div>
      </div>
      <div class="control-group layers">
        <label>Layers</label>
        <div id="image-list-container"></div>
        <input type="file" id="imageUpload" accept="image/*" style="display: none;">
        <button id="uploadBtn">Add Image</button>
      </div>
    </div>
  `;

  const DOMElements = {
    lockBtn: shadowRoot.getElementById('lockBtn'),
    hideBtn: shadowRoot.getElementById('hideBtn'),
    minBtn: shadowRoot.getElementById('minBtn'),
    xPos: shadowRoot.getElementById('xPos'),
    yPos: shadowRoot.getElementById('yPos'),
    scaleRange: shadowRoot.getElementById('scaleRange'),
    scaleNumber: shadowRoot.getElementById('scaleNumber'),
    opacityRange: shadowRoot.getElementById('opacityRange'),
    opacityNumber: shadowRoot.getElementById('opacityNumber'),
    invertRange: shadowRoot.getElementById('invertRange'),
    invertNumber: shadowRoot.getElementById('invertNumber'),
    imageUpload: shadowRoot.getElementById('imageUpload'),
    uploadBtn: shadowRoot.getElementById('uploadBtn'),
    imageList: shadowRoot.getElementById('image-list-container'),
    controlsHeader: shadowRoot.getElementById('overlay-controls-header'),
    controlsBody: shadowRoot.getElementById('overlay-controls-body')
  };

  function updateOverlayStyle() {
    overlayImage.style.left = `${state.settings.x}px`;
    overlayImage.style.top = `${state.settings.y}px`;
    overlayImage.style.opacity = state.settings.opacity;
    overlayImage.style.transform = `scale(${state.settings.scale})`;
    overlayImage.style.filter = `invert(${state.settings.invert})`;
    overlayImage.style.display = state.settings.hidden ? 'none' : 'block';
    
    overlayContainer.style.pointerEvents = state.settings.locked ? 'none' : 'auto';
    overlayContainer.style.cursor = state.settings.locked ? 'default' : 'move';
    DOMElements.lockBtn.textContent = state.settings.locked ? '🔒' : '🔓';
    DOMElements.hideBtn.style.opacity = state.settings.hidden ? '0.5' : '1';
  }

  function updateControlsUI() {
    DOMElements.xPos.value = Math.round(state.settings.x);
    DOMElements.yPos.value = Math.round(state.settings.y);
    DOMElements.scaleRange.value = state.settings.scale;
    DOMElements.scaleNumber.value = state.settings.scale;
    DOMElements.opacityRange.value = state.settings.opacity;
    DOMElements.opacityNumber.value = state.settings.opacity;
    DOMElements.invertRange.value = state.settings.invert;
    DOMElements.invertNumber.value = state.settings.invert;
    controls.style.top = `${state.panel.top}px`;
    controls.style.right = `${state.panel.right}px`;
    controls.classList.toggle('minimized', state.panel.minimized);
    DOMElements.minBtn.textContent = state.panel.minimized ? '➕' : '➖';
  }

  function renderImageList() {
    DOMElements.imageList.innerHTML = '';
    state.images.forEach(img => {
      const item = document.createElement('div');
      item.className = 'image-list-item';
      item.dataset.id = img.id;
      if (img.id === state.activeImageId) {
        item.classList.add('active');
      }
      item.innerHTML = `<img src="${img.dataUrl}" alt="thumb"> <span>${img.name}</span><button class="delete-img-btn" title="Remove image">×</button>`;
      item.addEventListener('click', () => {
        state.activeImageId = img.id;
        overlayImage.src = img.dataUrl;
        renderImageList();
        saveState();
      });

      item.querySelector('.delete-img-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        
        state.images = state.images.filter(i => i.id !== img.id);
        
        if (state.activeImageId === img.id) {
          if (state.images.length > 0) {
            state.activeImageId = state.images[0].id;
            overlayImage.src = state.images[0].dataUrl;
          } else {
            state.activeImageId = null;
            overlayImage.src = '';
          }
        }
        
        renderImageList();
        saveState();
      });

      DOMElements.imageList.appendChild(item);
    });
  }

  function saveState() {
    chrome.storage.local.set({ overlayState: state });
  }

  function loadStateAndInitialize() {
    chrome.storage.local.get('overlayState', (result) => {
      if (result.overlayState) {
        const loadedState = result.overlayState;
        state.settings = { ...state.settings, ...loadedState.settings };
        state.panel = { ...state.panel, ...loadedState.panel };
        state.images = loadedState.images || [];
        state.activeImageId = loadedState.activeImageId || null;
      }
      
      const activeImage = state.images.find(img => img.id === state.activeImageId);
      if (activeImage) {
        overlayImage.src = activeImage.dataUrl;
      }

      updateOverlayStyle();
      updateControlsUI();
      renderImageList();
    });
  }

  DOMElements.xPos.addEventListener('input', (e) => { state.settings.x = parseFloat(e.target.value); updateOverlayStyle(); saveState(); });
  DOMElements.yPos.addEventListener('input', (e) => { state.settings.y = parseFloat(e.target.value); updateOverlayStyle(); saveState(); });
  
  const setupSyncedInputs = (setting, rangeEl, numberEl) => {
    const handler = (e) => {
      const value = parseFloat(e.target.value) || 0;
      state.settings[setting] = value;
      rangeEl.value = value;
      numberEl.value = value;
      updateOverlayStyle();
      saveState();
    };
    rangeEl.addEventListener('input', handler);
    numberEl.addEventListener('input', handler);
  };

  setupSyncedInputs('scale', DOMElements.scaleRange, DOMElements.scaleNumber);
  setupSyncedInputs('opacity', DOMElements.opacityRange, DOMElements.opacityNumber);
  setupSyncedInputs('invert', DOMElements.invertRange, DOMElements.invertNumber);
  
  DOMElements.lockBtn.addEventListener('click', () => { state.settings.locked = !state.settings.locked; updateOverlayStyle(); saveState(); });
  DOMElements.hideBtn.addEventListener('click', () => { state.settings.hidden = !state.settings.hidden; updateOverlayStyle(); saveState(); });
  DOMElements.minBtn.addEventListener('click', () => { state.panel.minimized = !state.panel.minimized; updateControlsUI(); saveState(); });

  DOMElements.uploadBtn.addEventListener('click', () => DOMElements.imageUpload.click());
  DOMElements.imageUpload.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const newImage = {
          id: Date.now().toString(),
          name: file.name,
          dataUrl: event.target.result
        };
        state.images.push(newImage);
        state.activeImageId = newImage.id;
        overlayImage.src = newImage.dataUrl;
        renderImageList();
        saveState();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  });

  overlayContainer.addEventListener('mousedown', (e) => {
    if (state.settings.locked) return;
    
    e.preventDefault();
    const startX = e.pageX - state.settings.x;
    const startY = e.pageY - state.settings.y;

    function onMouseMove(moveEvent) {
      state.settings.x = moveEvent.pageX - startX;
      state.settings.y = moveEvent.pageY - startY;
      updateOverlayStyle();
      updateControlsUI();
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      saveState();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  DOMElements.controlsHeader.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = controls.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRight = window.innerWidth - rect.right;
    const startTop = rect.top;

    function onMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      state.panel.top = startTop + dy;
      state.panel.right = startRight - dx;

      if (state.panel.top < 0) state.panel.top = 0;
      if (state.panel.right < 0) state.panel.right = 0;
      if (state.panel.top > window.innerHeight - controls.offsetHeight) state.panel.top = window.innerHeight - controls.offsetHeight;
      if (state.panel.right > window.innerWidth - controls.offsetWidth) state.panel.right = window.innerWidth - controls.offsetWidth;

      controls.style.top = `${state.panel.top}px`;
      controls.style.right = `${state.panel.right}px`;
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      saveState();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (!state.activeImageId || state.settings.locked) return;

    let moved = false;
    switch (e.key) {
      case 'ArrowUp':
        state.settings.y--;
        moved = true;
        break;
      case 'ArrowDown':
        state.settings.y++;
        moved = true;
        break;
      case 'ArrowLeft':
        state.settings.x--;
        moved = true;
        break;
      case 'ArrowRight':
        state.settings.x++;
        moved = true;
        break;
    }

    if (moved) {
      e.preventDefault();
      updateOverlayStyle();
      updateControlsUI();
      saveState();
    }
  });

  loadStateAndInitialize();

})();
