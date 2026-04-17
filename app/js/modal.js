// Get elements
const infoModal = document.getElementById('infoModal');
const closeBtn = document.querySelector('.modal-close');

// Open modal (exposed globally)
function openInfoModal() {
  infoModal.style.display = 'flex';
}

// Close modal
function closeInfoModal() {
  infoModal.style.display = 'none';
}

// Close when clicking the X
closeBtn.addEventListener('click', closeInfoModal);

// Close when clicking outside the image
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) closeInfoModal();
});

// Expose open function to console and other scripts
window.openInfoModal = openInfoModal;


// CREDIT MODAL

// Get elements
const creditModal = document.getElementById('creditModal');
// const closeBtn = document.querySelector('.modal-close');

// Open modal (exposed globally)
function openCreditModal() {
  creditModal.style.display = 'flex';
}

// Close modal
function closeCreditModal() {
  creditModal.style.display = 'none';
}

// Close when clicking the X
closeBtn.addEventListener('click', closeCreditModal);

// Close when clicking outside the image
creditModal.addEventListener('click', (e) => {
  if (e.target === creditModal) closeCreditModal();
});

// Expose open function to console and other scripts
window.openCreditModal = openCreditModal;