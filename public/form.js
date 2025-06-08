
document.getElementById('formRequest').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    username: form.username.value,
    message: form.message.value
  };

  try {
    const res = await fetch('/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      document.getElementById('popup').style.display = 'block';
      setTimeout(() => {
        document.getElementById('popup').style.display = 'none';
        form.reset();
      }, 2000);
    } else {
      alert('Submission failed.');
    }
  } catch (err) {
    console.error(err);
    alert('Error submitting form.');
  }
});
