const form = document.getElementById('registerForm');
const popup = document.getElementById('popup-message');

function showPopup(message, isError = false) {
  popup.textContent = message;
  popup.className = isError ? 'error' : '';
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 4000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => data[key] = value);

  try {
    const response = await fetch('/submit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (response.ok) {
      showPopup('Request submitted successfully!');
      form.reset();
    } else {
      const text = await response.text();
      showPopup('Error: ' + text, true);
    }
  } catch (error) {
    showPopup('Network error, please try again.', true);
  }
});
