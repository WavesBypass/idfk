document.getElementById('formRequest').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const response = await fetch('/submit-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const popup = document.getElementById('popup');
  if (response.ok) {
    popup.innerText = 'Request submitted successfully!';
    popup.style.display = 'block';
    popup.style.color = 'lightgreen';
    e.target.reset();
  } else {
    popup.innerText = 'Error submitting request.';
    popup.style.display = 'block';
    popup.style.color = 'red';
  }

  setTimeout(() => popup.style.display = 'none', 3000);
});
