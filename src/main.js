import './style.css';
import './responsive.css';
import { photosData } from './photos-data.js';
import JSZip from 'jszip';

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let currentPhotos = [...photosData];
let currentFilter = 'all';
let currentCols = 3;
let activeLightboxIndex = 0;
let activeVaultIndex = 0;
let isSlideshowPlaying = false;
let slideshowTimer = null;
let selectedVaultIds = new Set();
let isAmbientPlaying = false;
let audioContext = null;
let ambientInterval = null;

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const masonryGrid = document.getElementById('masonryGrid');
const emptyGallery = document.getElementById('emptyGallery');
const categoryFilters = document.getElementById('categoryFilters');
const columnToggles = document.getElementById('columnToggles');
const heroSlides = document.getElementById('heroSlides');
const toastContainer = document.getElementById('toastContainer');

// Lightbox Elements
const lightboxModal = document.getElementById('lightboxModal');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');
const lbCloseBtn = document.getElementById('lbCloseBtn');
const lbPrevBtn = document.getElementById('lbPrevBtn');
const lbNextBtn = document.getElementById('lbNextBtn');
const lbImage = document.getElementById('lbImage');
const lbTitle = document.getElementById('lbTitle');
const lbCategory = document.getElementById('lbCategory');
const lbCounter = document.getElementById('lbCounter');
const lbDownloadBtn = document.getElementById('lbDownloadBtn');
const lbFilmstrip = document.getElementById('lbFilmstrip');

// Archive Vault Modal Elements
const archiveModal = document.getElementById('archiveModal');
const archiveModalBackdrop = document.getElementById('archiveModalBackdrop');
const vaultCloseBtn = document.getElementById('vaultCloseBtn');
const openArchiveCard = document.getElementById('openArchiveCard');
const openArchiveModalBtn = document.getElementById('openArchiveModalBtn');
const openArchiveFromHero = document.getElementById('openArchiveFromHero');
const footerOpenArchive = document.getElementById('footerOpenArchive');
const vaultModeBook = document.getElementById('vaultModeBook');
const vaultModeGrid = document.getElementById('vaultModeGrid');
const vaultAlbumView = document.getElementById('vaultAlbumView');
const vaultGridView = document.getElementById('vaultGridView');
const vaultAlbumImg = document.getElementById('vaultAlbumImg');
const vaultIndexLabel = document.getElementById('vaultIndexLabel');
const vaultCategoryLabel = document.getElementById('vaultCategoryLabel');
const vaultTitleLabel = document.getElementById('vaultTitleLabel');
const vaultDimsLabel = document.getElementById('vaultDimsLabel');
const vaultDownloadCurrentBtn = document.getElementById('vaultDownloadCurrentBtn');
const vaultSlideshowToggle = document.getElementById('vaultSlideshowToggle');
const vaultPrevBtn = document.getElementById('vaultPrevBtn');
const vaultNextBtn = document.getElementById('vaultNextBtn');
const vaultFilmstrip = document.getElementById('vaultFilmstrip');
const vaultMatrixGrid = document.getElementById('vaultMatrixGrid');
const selectAllVaultBtn = document.getElementById('selectAllVaultBtn');
const clearVaultSelectionBtn = document.getElementById('clearVaultSelectionBtn');
const downloadSelectedVaultBtn = document.getElementById('downloadSelectedVaultBtn');
const selectedCountLabel = document.getElementById('selectedCount');
const vaultDownloadZipBtn = document.getElementById('vaultDownloadZipBtn');
const downloadAllZipBtn = document.getElementById('downloadAllZipBtn');
const footerDownloadZip = document.getElementById('footerDownloadZip');
const zipProgressBanner = document.getElementById('zipProgressBanner');
const zipProgressBar = document.getElementById('zipProgressBar');
const zipStatusText = document.getElementById('zipStatusText');
const zipPercentText = document.getElementById('zipPercentText');

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, icon = '✦') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================================================
// HIGH-RESOLUTION DIRECT DOWNLOAD TRIGGER
// ==========================================================================
async function triggerDownload(photoPath, filename, e) {
  if (e) e.stopPropagation();
  showToast(`Preparing download for ${filename}...`, '⬇');

  try {
    const response = await fetch(photoPath);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Ethan_Julianne_Wedding_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast(`Downloaded ${filename} successfully!`, '✓');
  } catch (err) {
    console.error('Direct download error:', err);
    // Fallback standard link
    const link = document.createElement('a');
    link.href = photoPath;
    link.download = filename;
    link.target = '_blank';
    link.click();
  }
}

// ==========================================================================
// GALLERY RENDERING & MASONRY
// ==========================================================================
function renderGallery() {
  masonryGrid.innerHTML = '';

  if (currentPhotos.length === 0) {
    emptyGallery.style.display = 'block';
    masonryGrid.style.display = 'none';
    return;
  }

  emptyGallery.style.display = 'none';
  masonryGrid.style.display = 'block';

  currentPhotos.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.setAttribute('data-id', photo.id);
    card.setAttribute('data-index', index);

    card.innerHTML = `
      <div class="photo-img-wrap">
        <img 
          src="${photo.path}" 
          alt="${photo.title}" 
          class="photo-img" 
          loading="lazy" 
          width="${photo.width}" 
          height="${photo.height}"
        />
        <div class="photo-overlay">
          <div class="overlay-top">
            <span class="card-category-tag">${photo.category}</span>
            <div class="overlay-quick-actions">
              <button class="card-btn zoom-btn" title="View Fullscreen" aria-label="Fullscreen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </button>
            </div>
          </div>
          <div class="overlay-bottom">
            <div class="card-info">
              <h3 class="card-title">${photo.title}</h3>
              <p class="card-specs">${photo.width} × ${photo.height} • Ultra HD</p>
            </div>
            <button class="card-download-btn" title="Download High-Res Original">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Click card to open lightbox
    card.addEventListener('click', () => openLightbox(index));

    // Download button
    const dlBtn = card.querySelector('.card-download-btn');
    dlBtn.addEventListener('click', (e) => triggerDownload(photo.path, photo.filename, e));

    masonryGrid.appendChild(card);
  });
}

function applyFilter(category) {
  currentFilter = category;

  // Update active chip
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-category') === category);
  });

  if (category === 'all') {
    currentPhotos = [...photosData];
  } else {
    currentPhotos = photosData.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  renderGallery();
}

// Reset filter button
document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
  applyFilter('all');
});

// Category Filter Clicks
categoryFilters.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  const category = chip.getAttribute('data-category');
  applyFilter(category);
});

// Column Count Switchers
columnToggles.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  const cols = parseInt(btn.getAttribute('data-cols'), 10);
  currentCols = cols;

  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  masonryGrid.classList.remove('cols-2', 'cols-3', 'cols-4');
  masonryGrid.classList.add(`cols-${cols}`);
});

// ==========================================================================
// LIGHTBOX MODAL
// ==========================================================================
function openLightbox(index) {
  activeLightboxIndex = index;
  updateLightboxContent();
  renderLightboxFilmstrip();
  lightboxModal.classList.add('active');
  lightboxModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightboxModal.classList.remove('active');
  lightboxModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function updateLightboxContent() {
  const photo = currentPhotos[activeLightboxIndex];
  if (!photo) return;

  lbImage.style.opacity = '0.3';
  lbImage.src = photo.path;
  lbImage.onload = () => {
    lbImage.style.opacity = '1';
  };

  lbTitle.textContent = photo.title;
  lbCategory.textContent = photo.category;
  lbCounter.textContent = `${activeLightboxIndex + 1} / ${currentPhotos.length}`;

  lbDownloadBtn.onclick = (e) => triggerDownload(photo.path, photo.filename, e);

  // Scroll active thumb into view
  const activeThumb = lbFilmstrip.children[activeLightboxIndex];
  if (activeThumb) {
    document.querySelectorAll('.lb-thumb').forEach(t => t.classList.remove('active'));
    activeThumb.classList.add('active');
    activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function renderLightboxFilmstrip() {
  lbFilmstrip.innerHTML = '';
  currentPhotos.forEach((photo, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `lb-thumb ${idx === activeLightboxIndex ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${photo.path}" alt="${photo.title}" loading="lazy" />`;
    thumb.addEventListener('click', () => {
      activeLightboxIndex = idx;
      updateLightboxContent();
    });
    lbFilmstrip.appendChild(thumb);
  });
}

function prevLightbox() {
  if (activeLightboxIndex > 0) {
    activeLightboxIndex--;
  } else {
    activeLightboxIndex = currentPhotos.length - 1;
  }
  updateLightboxContent();
}

function nextLightbox() {
  if (activeLightboxIndex < currentPhotos.length - 1) {
    activeLightboxIndex++;
  } else {
    activeLightboxIndex = 0;
  }
  updateLightboxContent();
}

// Lightbox Listeners
lbCloseBtn.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);
lbPrevBtn.addEventListener('click', prevLightbox);
lbNextBtn.addEventListener('click', nextLightbox);
// ==========================================================================
// DEDICATED FULLSCREEN "ARCHIVE FOLDER" MODAL (HEIRLOOM KEEPSAKE VAULT)
// ==========================================================================
function openArchiveVault() {
  archiveModal.classList.add('active');
  archiveModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  activeVaultIndex = 0;
  updateVaultAlbumContent();
  renderVaultFilmstrip();
  renderVaultMatrixGrid();
}

function closeArchiveVault() {
  archiveModal.classList.remove('active');
  archiveModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  stopSlideshow();
}

function updateVaultAlbumContent() {
  const photo = photosData[activeVaultIndex];
  if (!photo) return;

  vaultAlbumImg.src = photo.path;
  vaultIndexLabel.textContent = `Plate No. ${String(activeVaultIndex + 1).padStart(2, '0')} / ${photosData.length}`;
  vaultCategoryLabel.textContent = `${photo.category} Collection`;
  vaultTitleLabel.textContent = photo.title;
  vaultDimsLabel.textContent = `${photo.width} × ${photo.height} px`;

  vaultDownloadCurrentBtn.onclick = (e) => triggerDownload(photo.path, photo.filename, e);

  // Update filmstrip active state
  document.querySelectorAll('.vault-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === activeVaultIndex);
  });
  const activeThumb = vaultFilmstrip.children[activeVaultIndex];
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function renderVaultFilmstrip() {
  vaultFilmstrip.innerHTML = '';
  photosData.forEach((photo, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `vault-thumb ${idx === activeVaultIndex ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${photo.path}" alt="${photo.title}" loading="lazy" />`;
    thumb.addEventListener('click', () => {
      activeVaultIndex = idx;
      updateVaultAlbumContent();
    });
    vaultFilmstrip.appendChild(thumb);
  });
}

function prevVaultAlbum() {
  activeVaultIndex = (activeVaultIndex - 1 + photosData.length) % photosData.length;
  updateVaultAlbumContent();
}

function nextVaultAlbum() {
  activeVaultIndex = (activeVaultIndex + 1) % photosData.length;
  updateVaultAlbumContent();
}

function toggleSlideshow() {
  if (isSlideshowPlaying) {
    stopSlideshow();
  } else {
    startSlideshow();
  }
}

function startSlideshow() {
  isSlideshowPlaying = true;
  vaultSlideshowToggle.innerHTML = '<span>⏸ Pause Slideshow</span>';
  vaultSlideshowToggle.classList.add('active');
  slideshowTimer = setInterval(nextVaultAlbum, 3500);
  showToast('Starting automated heirloom presentation...', '▶');
}

function stopSlideshow() {
  isSlideshowPlaying = false;
  if (vaultSlideshowToggle) {
    vaultSlideshowToggle.innerHTML = '<span>▶ Autoplay Slideshow</span>';
    vaultSlideshowToggle.classList.remove('active');
  }
  if (slideshowTimer) clearInterval(slideshowTimer);
}

// Vault Matrix Grid Mode
function renderVaultMatrixGrid() {
  vaultMatrixGrid.innerHTML = '';
  photosData.forEach(photo => {
    const card = document.createElement('div');
    const isSelected = selectedVaultIds.has(photo.id);
    card.className = `matrix-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('data-id', photo.id);

    card.innerHTML = `
      <input type="checkbox" class="matrix-checkbox" ${isSelected ? 'checked' : ''} aria-label="Select photo" />
      <img src="${photo.path}" alt="${photo.title}" loading="lazy" />
      <div class="matrix-card-body">
        <div class="matrix-card-title">${photo.title}</div>
        <div class="matrix-card-meta">
          <span class="matrix-dims">${photo.width}×${photo.height}</span>
          <button class="matrix-dl-btn" title="Download this file">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Save</span>
          </button>
        </div>
      </div>
    `;

    const checkbox = card.querySelector('.matrix-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedVaultIds.add(photo.id);
        card.classList.add('selected');
      } else {
        selectedVaultIds.delete(photo.id);
        card.classList.remove('selected');
      }
      updateVaultSelectedCount();
    });

    const dlBtn = card.querySelector('.matrix-dl-btn');
    dlBtn.addEventListener('click', (e) => triggerDownload(photo.path, photo.filename, e));

    card.addEventListener('click', (e) => {
      if (e.target.closest('.matrix-checkbox') || e.target.closest('.matrix-dl-btn')) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    vaultMatrixGrid.appendChild(card);
  });

  updateVaultSelectedCount();
}

function updateVaultSelectedCount() {
  selectedCountLabel.textContent = selectedVaultIds.size;
}

// Vault Mode Switches
vaultModeBook.addEventListener('click', () => {
  vaultModeBook.classList.add('active');
  vaultModeGrid.classList.remove('active');
  vaultAlbumView.style.display = 'flex';
  vaultGridView.style.display = 'none';
});

vaultModeGrid.addEventListener('click', () => {
  vaultModeGrid.classList.add('active');
  vaultModeBook.classList.remove('active');
  vaultAlbumView.style.display = 'none';
  vaultGridView.style.display = 'flex';
  stopSlideshow();
});

// Vault Navigation
vaultPrevBtn.addEventListener('click', prevVaultAlbum);
vaultNextBtn.addEventListener('click', nextVaultAlbum);
vaultSlideshowToggle.addEventListener('click', toggleSlideshow);

// Matrix selection actions
selectAllVaultBtn.addEventListener('click', () => {
  photosData.forEach(p => selectedVaultIds.add(p.id));
  renderVaultMatrixGrid();
});

clearVaultSelectionBtn.addEventListener('click', () => {
  selectedVaultIds.clear();
  renderVaultMatrixGrid();
});

downloadSelectedVaultBtn.addEventListener('click', async () => {
  if (selectedVaultIds.size === 0) {
    showToast('Please select at least one photograph to download.', 'ℹ');
    return;
  }
  const selectedPhotos = photosData.filter(p => selectedVaultIds.has(p.id));
  await downloadZipPackage(selectedPhotos, `Ethan_Julianne_Selected_Photos_${selectedPhotos.length}.zip`);
});

// Open/Close triggers
openArchiveCard.addEventListener('click', openArchiveVault);
openArchiveModalBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openArchiveVault();
});
openArchiveFromHero.addEventListener('click', openArchiveVault);
footerOpenArchive.addEventListener('click', openArchiveVault);
vaultCloseBtn.addEventListener('click', closeArchiveVault);
archiveModalBackdrop.addEventListener('click', closeArchiveVault);

// ==========================================================================
// BULK ZIP DOWNLOAD GENERATION (JSZip)
// ==========================================================================
async function downloadZipPackage(photosList, zipName = 'Ethan_Julianne_Full_Wedding_Archive.zip') {
  zipProgressBanner.style.display = 'block';
  zipProgressBar.style.width = '0%';
  zipPercentText.textContent = '0%';
  zipStatusText.textContent = `Packaging ${photosList.length} master files...`;
  showToast(`Preparing ZIP archive for ${photosList.length} photos...`, '📦');

  const zip = new JSZip();
  const folder = zip.folder('Ethan_Julianne_Wedding_Master_Collection');

  let loadedCount = 0;

  try {
    for (const photo of photosList) {
      zipStatusText.textContent = `Fetching file: ${photo.filename} (${loadedCount + 1}/${photosList.length})`;
      const response = await fetch(photo.path);
      const blob = await response.blob();
      folder.file(photo.filename, blob);

      loadedCount++;
      const percent = Math.round((loadedCount / photosList.length) * 85);
      zipProgressBar.style.width = `${percent}%`;
      zipPercentText.textContent = `${percent}%`;
    }

    zipStatusText.textContent = 'Compressing into high-resolution ZIP...';
    const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      const overallPercent = 85 + Math.round(metadata.percent * 0.15);
      zipProgressBar.style.width = `${overallPercent}%`;
      zipPercentText.textContent = `${overallPercent}%`;
    });

    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    zipStatusText.textContent = 'Archive download completed!';
    zipPercentText.textContent = '100%';
    showToast('Master ZIP Archive downloaded successfully!', '🎉');

    setTimeout(() => {
      zipProgressBanner.style.display = 'none';
    }, 4000);
  } catch (err) {
    console.error('Error generating ZIP:', err);
    zipStatusText.textContent = 'Error generating ZIP bundle. Downloading files individually.';
    showToast('Error generating bulk ZIP, trying direct downloads...', '⚠️');
  }
}

// Bulk ZIP Listeners
downloadAllZipBtn.addEventListener('click', () => downloadZipPackage(photosData));
vaultDownloadZipBtn.addEventListener('click', () => downloadZipPackage(photosData));
footerDownloadZip.addEventListener('click', () => downloadZipPackage(photosData));

// ==========================================================================
// SDE HERO VIDEO AUDIO & AMBIENT MUSIC
// ==========================================================================
// Silent, looping cinematic montage built from the wedding photos
function buildHeroMontage() {
  const picks = photosData.filter(p => p.aspect === 'landscape').slice(0, 8);
  const secs = 6;
  const cycle = picks.length * secs;
  picks.forEach((p, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    slide.style.backgroundImage = `url("${p.path}")`;
    slide.style.setProperty('--cycle', `${cycle}s`);
    slide.style.setProperty('--delay', `${i * secs - 1}s`);
    heroSlides.appendChild(slide);
  });
}
buildHeroMontage();

// ==========================================================================
// KEYBOARD ACCESSIBILITY
// ==========================================================================
window.addEventListener('keydown', (e) => {
  // If Lightbox is active
  if (lightboxModal.classList.contains('active')) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevLightbox();
    if (e.key === 'ArrowRight') nextLightbox();
  }

  // If Archive Modal is active
  if (archiveModal.classList.contains('active')) {
    if (e.key === 'Escape') closeArchiveVault();
    if (e.key === 'ArrowLeft') prevVaultAlbum();
    if (e.key === 'ArrowRight') nextVaultAlbum();
    if (e.key === ' ') {
      e.preventDefault();
      toggleSlideshow();
    }
  }
});

// Navbar background blur on scroll
window.addEventListener('scroll', () => {
  const header = document.getElementById('siteHeader');
  if (window.scrollY > 60) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
  console.log('Ethan & Julianne Luxury Wedding Gallery initialized successfully.');
});
