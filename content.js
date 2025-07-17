(() => {
  console.log('Overlay script starting...');

  const DB_NAME = 'OverlayImageDatabase';
  const DB_VERSION = 1;
  const STORE_NAME = 'images';
  let db;
  let thumbnailCache = {};

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => reject('Error opening DB');
      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
    });
  }

  function saveImageToDB(image) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(image);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getImageFromDB(id) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject('DB not open');
        return;
      }
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteImageFromDB(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  const OVERLAY_ID = 'overlay-container';
  const SHADOW_HOST_ID = 'overlay-shadow-host';
  const CONTROLS_ID = 'overlay-controls';
  const storageKey = `overlayState:${window.location.origin}`;

  let isLoaded = false;
  let state = {
    images: [],
    activeImageId: null,
    settings: {
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
    pointerEvents: 'none',
    overflowX: 'hidden'
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
    const activeImage = state.images.find(img => img.id === state.activeImageId);

    if (activeImage) {
      overlayImage.style.left = `${activeImage.settings.x}px`;
      overlayImage.style.top = `${activeImage.settings.y}px`;
      overlayImage.style.opacity = activeImage.settings.opacity;
      overlayImage.style.transform = `scale(${activeImage.settings.scale})`;
      overlayImage.style.filter = `invert(${activeImage.settings.invert})`;
      overlayImage.style.display = state.settings.hidden ? 'none' : 'block';
    } else {
      overlayImage.style.display = 'none';
    }
    
    overlayContainer.style.pointerEvents = (!state.activeImageId || state.settings.hidden || state.settings.locked) ? 'none' : 'auto';
    overlayContainer.style.cursor = (!state.activeImageId || state.settings.hidden || state.settings.locked) ? 'default' : 'move';
    DOMElements.lockBtn.textContent = state.settings.locked ? '🔒' : '🔓';
    DOMElements.hideBtn.style.opacity = state.settings.hidden ? '0.5' : '1';
  }

  function updateControlsUI() {
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    const imageControls = [
      DOMElements.xPos, DOMElements.yPos, DOMElements.scaleRange, DOMElements.scaleNumber,
      DOMElements.opacityRange, DOMElements.opacityNumber, DOMElements.invertRange, DOMElements.invertNumber
    ];

    if (activeImage) {
      DOMElements.xPos.value = Math.round(activeImage.settings.x);
      DOMElements.yPos.value = Math.round(activeImage.settings.y);
      DOMElements.scaleRange.value = activeImage.settings.scale;
      DOMElements.scaleNumber.value = activeImage.settings.scale;
      DOMElements.opacityRange.value = activeImage.settings.opacity;
      DOMElements.opacityNumber.value = activeImage.settings.opacity;
      DOMElements.invertRange.value = activeImage.settings.invert;
      DOMElements.invertNumber.value = activeImage.settings.invert;
      imageControls.forEach(c => c.disabled = false);
    } else {
      DOMElements.xPos.value = '';
      DOMElements.yPos.value = '';
      DOMElements.scaleRange.value = 0;
      DOMElements.scaleNumber.value = '';
      DOMElements.opacityRange.value = 0;
      DOMElements.opacityNumber.value = '';
      DOMElements.invertRange.value = 0;
      DOMElements.invertNumber.value = '';
      imageControls.forEach(c => c.disabled = true);
    }

    controls.style.top = `${state.panel.top}px`;
    controls.style.right = `${state.panel.right}px`;
    controls.classList.toggle('minimized', state.panel.minimized);
    DOMElements.minBtn.textContent = state.panel.minimized ? '➕' : '➖';
  }

  function renderImageList() {
    DOMElements.imageList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.images.forEach(img => {
      const item = document.createElement('div');
      item.className = 'image-list-item';
      item.dataset.id = img.id;
      if (img.id === state.activeImageId) {
        item.classList.add('active');
      }
      
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'image-list-item-thumb';

      const thumb = document.createElement('img');
      thumb.alt = 'thumb';
      thumb.style.visibility = 'hidden';
      thumbWrapper.appendChild(thumb);
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = img.name;
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-img-btn';
      deleteBtn.title = 'Remove image';
      deleteBtn.innerHTML = '&times;';
      
      item.appendChild(thumbWrapper);
      item.appendChild(nameSpan);
      item.appendChild(deleteBtn);

      if (thumbnailCache[img.id]) {
        thumb.src = thumbnailCache[img.id];
        thumb.style.visibility = 'visible';
      } else {
        getImageFromDB(img.id).then(imageRecord => {
          if (imageRecord) {
            const blob = new Blob([imageRecord.data], { type: imageRecord.mimeType });
            const url = URL.createObjectURL(blob);
            thumbnailCache[img.id] = url;
            thumb.src = url;
            thumb.style.visibility = 'visible';
          }
        }).catch(console.error);
      }

      item.addEventListener('click', () => {
        if (state.activeImageId === img.id) return;

        const previousActiveId = state.activeImageId;
        state.activeImageId = img.id;
        console.log('Image list item clicked. New activeImageId:', img.id);

        if (previousActiveId) {
          const previousActiveItem = DOMElements.imageList.querySelector(`[data-id='${previousActiveId}']`);
          if (previousActiveItem) previousActiveItem.classList.remove('active');
        }
        item.classList.add('active');

        getImageFromDB(img.id).then(imageRecord => {
          if(imageRecord) {
            if (overlayImage.src && overlayImage.src.startsWith('blob:')) {
              URL.revokeObjectURL(overlayImage.src);
            }
            const blob = new Blob([imageRecord.data], { type: imageRecord.mimeType });
            overlayImage.src = URL.createObjectURL(blob);
          }
        }).catch(console.error);

        updateOverlayStyle();
        updateControlsUI();
        saveState();
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Deleting image:', img.id);

        deleteImageFromDB(img.id).then(() => {
          if (thumbnailCache[img.id]) {
            URL.revokeObjectURL(thumbnailCache[img.id]);
            delete thumbnailCache[img.id];
          }
          const wasActive = state.activeImageId === img.id;
          state.images = state.images.filter(i => i.id !== img.id);
          
          if (wasActive) {
            if (overlayImage.src && overlayImage.src.startsWith('blob:')) {
              URL.revokeObjectURL(overlayImage.src);
            }
            if (state.images.length > 0) {
              state.activeImageId = state.images[0].id;
              console.log('Active image deleted. New active image:', state.activeImageId);
              getImageFromDB(state.activeImageId).then(imageRecord => {
                if (imageRecord) {
                  const blob = new Blob([imageRecord.data], { type: imageRecord.mimeType });
                  overlayImage.src = URL.createObjectURL(blob);
                }
              }).catch(console.error);
            } else {
              state.activeImageId = null;
              overlayImage.src = '';
              console.log('Last image deleted.');
            }
            updateOverlayStyle();
            updateControlsUI();
          }
          renderImageList();
          saveState();
        }).catch(console.error);
      });
      fragment.appendChild(item);
    });
    DOMElements.imageList.appendChild(fragment);
  }

  function saveState() {
    console.log('saveState called. isLoaded:', isLoaded);
    if (!isLoaded) return;
    console.log('Saving state:', JSON.parse(JSON.stringify(state)));
    chrome.storage.local.set({ [storageKey]: state });
  }

  function loadStateAndInitialize() {
    console.log('loadStateAndInitialize called.');
    chrome.storage.local.get(storageKey, (result) => {
      console.log('Loaded from storage:', result);
      if (result[storageKey]) {
        const loadedState = result[storageKey];
        console.log('Found state for this origin:', loadedState);
        
        if (loadedState.settings && loadedState.settings.hasOwnProperty('x')) {
          console.log('Migrating old state format');
          const imageSettings = {
            x: loadedState.settings.x,
            y: loadedState.settings.y,
            opacity: loadedState.settings.opacity,
            scale: loadedState.settings.scale,
            invert: loadedState.settings.invert
          };
          (loadedState.images || []).forEach(img => {
            img.settings = { ...imageSettings };
          });
          delete loadedState.settings.x;
          delete loadedState.settings.y;
          delete loadedState.settings.opacity;
          delete loadedState.settings.scale;
          delete loadedState.settings.invert;
        }

        state.settings = { ...state.settings, ...loadedState.settings };
        state.panel = { ...state.panel, ...loadedState.panel };
        state.images = loadedState.images || [];
        state.activeImageId = loadedState.activeImageId || null;
      } else {
        console.log('No state found for this origin.');
      }
      
      if (state.activeImageId) {
        const activeImage = state.images.find(img => img.id === state.activeImageId);
        if (activeImage) {
          getImageFromDB(state.activeImageId).then(imageRecord => {
            if (imageRecord) {
              if (overlayImage.src && overlayImage.src.startsWith('blob:')) {
                URL.revokeObjectURL(overlayImage.src);
              }
              const blob = new Blob([imageRecord.data], { type: imageRecord.mimeType });
              overlayImage.src = URL.createObjectURL(blob);
            }
          }).catch(console.error);
        }
      }

      updateOverlayStyle();
      updateControlsUI();
      renderImageList();
      isLoaded = true;
      console.log('Initialization complete. isLoaded set to true.');
    });
  }

  DOMElements.xPos.addEventListener('input', (e) => {
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (activeImage) {
      activeImage.settings.x = parseFloat(e.target.value);
      updateOverlayStyle();
      saveState();
    }
  });
  DOMElements.yPos.addEventListener('input', (e) => {
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (activeImage) {
      activeImage.settings.y = parseFloat(e.target.value);
      updateOverlayStyle();
      saveState();
    }
  });
  
  const setupSyncedInputs = (setting, rangeEl, numberEl) => {
    const handler = (e) => {
      const activeImage = state.images.find(img => img.id === state.activeImageId);
      if (activeImage) {
        const value = parseFloat(e.target.value) || 0;
        activeImage.settings[setting] = value;
        rangeEl.value = value;
        numberEl.value = value;
        updateOverlayStyle();
        saveState();
      }
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
        const newImageRecord = {
          id: Date.now().toString(),
          name: file.name,
          mimeType: file.type,
          data: event.target.result // ArrayBuffer
        };

        console.log('Adding new image:', {id: newImageRecord.id, name: newImageRecord.name});
        saveImageToDB(newImageRecord).then(() => {
          const newImageState = {
            id: newImageRecord.id,
            name: newImageRecord.name,
            settings: { x: 0, y: window.scrollY, scale: 0.5, opacity: 0.5, invert: 0 }
          };
          state.images.push(newImageState);
          state.activeImageId = newImageRecord.id;

          if (overlayImage.src && overlayImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(overlayImage.src);
          }
          const blob = new Blob([newImageRecord.data], { type: newImageRecord.mimeType });
          overlayImage.src = URL.createObjectURL(blob);

          updateOverlayStyle();
          updateControlsUI();
          renderImageList();
          saveState();
        }).catch(console.error);
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    }
  });

  overlayContainer.addEventListener('mousedown', (e) => {
    if (state.settings.locked) return;
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (!activeImage) return;
    
    e.preventDefault();
    const startX = e.pageX - activeImage.settings.x;
    const startY = e.pageY - activeImage.settings.y;

    function onMouseMove(moveEvent) {
      activeImage.settings.x = moveEvent.pageX - startX;
      activeImage.settings.y = moveEvent.pageY - startY;
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

  overlayContainer.addEventListener('touchstart', (e) => {
    if (state.settings.locked) return;
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (!activeImage) return;

    if (e.touches.length !== 1) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const startX = touch.pageX - activeImage.settings.x;
    const startY = touch.pageY - activeImage.settings.y;

    function onTouchMove(moveEvent) {
      if (moveEvent.touches.length !== 1) return;
      const touch = moveEvent.touches[0];
      activeImage.settings.x = touch.pageX - startX;
      activeImage.settings.y = touch.pageY - startY;
      updateOverlayStyle();
      updateControlsUI();
    }

    function onTouchEnd() {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      saveState();
    }

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }, { passive: false });

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

  DOMElements.controlsHeader.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = controls.getBoundingClientRect();
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startRight = window.innerWidth - rect.right;
    const startTop = rect.top;

    function onTouchMove(moveEvent) {
      if (moveEvent.touches.length !== 1) return;
      const touch = moveEvent.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      state.panel.top = startTop + dy;
      state.panel.right = startRight - dx;

      if (state.panel.top < 0) state.panel.top = 0;
      if (state.panel.right < 0) state.panel.right = 0;
      if (state.panel.top > window.innerHeight - controls.offsetHeight) state.panel.top = window.innerHeight - controls.offsetHeight;
      if (state.panel.right > window.innerWidth - controls.offsetWidth) state.panel.right = window.innerWidth - controls.offsetWidth;

      controls.style.top = `${state.panel.top}px`;
      controls.style.right = `${state.panel.right}px`;
    }

    function onTouchEnd() {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      saveState();
    }
    
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (!state.activeImageId || state.settings.locked) return;

    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (!activeImage) return;

    let moved = false;
    switch (e.key) {
      case 'ArrowUp':
        activeImage.settings.y--;
        moved = true;
        break;
      case 'ArrowDown':
        activeImage.settings.y++;
        moved = true;
        break;
      case 'ArrowLeft':
        activeImage.settings.x--;
        moved = true;
        break;
      case 'ArrowRight':
        activeImage.settings.x++;
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

  openDB().then(() => {
    loadStateAndInitialize();
  }).catch(console.error);

})();
