const showToast = (message, duration = 5000) => {
  const toast = document.createElement('div');

  toast.textContent = message;
  toast.className = 'toast';

  const container = document.getElementById('toastContainer');

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';

    setTimeout(() => container.removeChild(toast), 300);
  }, duration);
};

export {
  showToast,
};
