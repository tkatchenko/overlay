(() => {
  // --- A. INITIALIZATION & SETUP ---

  const OVERLAY_ID = 'pixel-perfect-overlay-container';
  const CONTROLS_ID = 'pixel-perfect-controls';

  // State to hold all our data
  let state = {
    images: [], // { id, name, dataUrl }
    activeImageId: null,
    settings: {
      x: 50,
      y: 50,
      opacity: 0.5,
      scale: 1,
      invert: 0,
      locked: false,
      hidden: false,
    },
    panel: {
      minimized: false,
      top: 20,
      right: 20,
    }
  };

  // If the controls already exist, the user is toggling the extension off.
  if (document.getElementById(CONTROLS_ID)) {
    document.getElementById(CONTROLS_ID).remove();
    document.getElementById(OVERLAY_ID).remove();
    return;
  }

  // Create main overlay and controls containers
  const overlayContainer = document.createElement('div');
  overlayContainer.id = OVERLAY_ID;

  const overlayImage = document.createElement('img');
  overlayImage.id = 'pixel-perfect-overlay-image';
  overlayContainer.appendChild(overlayImage);

  const controls = document.createElement('div');
  controls.id = CONTROLS_ID;

  document.body.appendChild(overlayContainer);
  document.body.appendChild(controls);

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('overlay.css');
  document.head.appendChild(link);

  // --- B. UI & DOM MANIPULATION ---

  // HTML for the control panel
  controls.innerHTML = `
    <div id="pixel-perfect-controls-header">
      <button id="lockBtn" title="Lock/Unlock Image">🔒</button>
      <button id="hideBtn" title="Hide/Show Image">👁️</button>
      <button id="minBtn" title="Minimize/Restore Panel">➖</button>
    </div>
    <div id="pixel-perfect-controls-body">
      <div class="control-group">
        <div class="input-row">
          <div><label>X</label><input type="number" id="xPos" step="1"></div>
          <div><label>Y</label><input type="number" id="yPos" step="1"></div>
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
      <div class="control-group">
        <label>Layers</label>
        <div id="image-list-container"></div>
        <input type="file" id="imageUpload" accept="image/*" style="display: none;">
        <button id="uploadBtn">Add Image</button>
      </div>
    </div>
  `;

  // Get references to all control elements
  const DOMElements = {
    lockBtn: document.getElementById('lockBtn'),
    hideBtn: document.getElementById('hideBtn'),
    minBtn: document.getElementById('minBtn'),
    xPos: document.getElementById('xPos'),
    yPos: document.getElementById('yPos'),
    scaleRange: document.getElementById('scaleRange'),
    scaleNumber: document.getElementById('scaleNumber'),
    opacityRange: document.getElementById('opacityRange'),
    opacityNumber: document.getElementById('opacityNumber'),
    invertRange: document.getElementById('invertRange'),
    invertNumber: document.getElementById('invertNumber'),
    imageUpload: document.getElementById('imageUpload'),
    uploadBtn: document.getElementById('uploadBtn'),
    imageList: document.getElementById('image-list-container'),
    controlsHeader: document.getElementById('pixel-perfect-controls-header'),
    controlsBody: document.getElementById('pixel-perfect-controls-body')
  };

  // --- C. CORE LOGIC & EVENT HANDLERS ---

  /** Updates the overlay image style based on the current state */
  function updateOverlayStyle() {
    overlayImage.style.left = `${state.settings.x}px`;
    overlayImage.style.top = `${state.settings.y}px`;
    overlayImage.style.opacity = state.settings.opacity;
    overlayImage.style.transform = `scale(${state.settings.scale})`;
    overlayImage.style.filter = `invert(${state.settings.invert})`;
    overlayImage.style.display = state.settings.hidden ? 'none' : 'block';
    
    overlayContainer.classList.toggle('draggable', !state.settings.locked);
    DOMElements.lockBtn.textContent = state.settings.locked ? '🔓' : '🔒';
  }

  /** Updates the control panel UI inputs based on the current state */
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
  }

  /** Renders the list of images in the control panel */
  function renderImageList() {
    DOMElements.imageList.innerHTML = '';
    state.images.forEach(img => {
      const item = document.createElement('div');
      item.className = 'image-list-item';
      item.dataset.id = img.id;
      if (img.id === state.activeImageId) {
        item.classList.add('active');
      }
      item.innerHTML = `<img src="${img.dataUrl}" alt="thumb"> <span>${img.name}</span><button class="delete-img-btn" title="Remove image">✖</button>`;
      item.addEventListener('click', () => {
        state.activeImageId = img.id;
        overlayImage.src = img.dataUrl;
        renderImageList(); // Re-render to show active state
        saveState();
      });

      item.querySelector('.delete-img-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Remove image from state
        state.images = state.images.filter(i => i.id !== img.id);
        
        // If the active image was deleted, handle it
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

  /** Saves the current state to chrome.storage */
  function saveState() {
    chrome.storage.local.set({ pixelPerfectState: state });
  }

  /** Loads state from chrome.storage and initializes the extension */
  function loadStateAndInitialize() {
    chrome.storage.local.get('pixelPerfectState', (result) => {
      if (result.pixelPerfectState) {
        // Merge saved state with default state to prevent errors on new features
        const loadedState = result.pixelPerfectState;
        state.settings = { ...state.settings, ...loadedState.settings };
        state.panel = { ...state.panel, ...loadedState.panel };
        state.images = loadedState.images || [];
        state.activeImageId = loadedState.activeImageId || null;
      }
      
      // After loading, apply everything
      const activeImage = state.images.find(img => img.id === state.activeImageId);
      if (activeImage) {
        overlayImage.src = activeImage.dataUrl;
      }

      updateOverlayStyle();
      updateControlsUI();
      renderImageList();
    });
  }

  // --- D. EVENT LISTENERS ---

  // Control panel inputs
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
  
  // Header buttons
  DOMElements.lockBtn.addEventListener('click', () => { state.settings.locked = !state.settings.locked; updateOverlayStyle(); saveState(); });
  DOMElements.hideBtn.addEventListener('click', () => { state.settings.hidden = !state.settings.hidden; updateOverlayStyle(); saveState(); });
  DOMElements.minBtn.addEventListener('click', () => { state.panel.minimized = !state.panel.minimized; controls.classList.toggle('minimized'); saveState(); });

  // Image upload
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
      e.target.value = ''; // Reset file input
    }
  });

  // Dragging logic for the overlay image
  overlayContainer.addEventListener('mousedown', (e) => {
    if (state.settings.locked) return;
    
    e.preventDefault();
    const startX = e.clientX - state.settings.x;
    const startY = e.clientY - state.settings.y;

    function onMouseMove(moveEvent) {
      state.settings.x = moveEvent.clientX - startX;
      state.settings.y = moveEvent.clientY - startY;
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

  // Dragging logic for the control panel
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

      // Boundary checks
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

  // Keyboard navigation for the overlay image
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT') return;

    // Ignore if no image is active or if it's locked
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
      e.preventDefault(); // Prevent page scrolling
      updateOverlayStyle();
      updateControlsUI();
      saveState();
    }
  });

  // --- E. START THE EXTENSION ---
  loadStateAndInitialize();

})();
