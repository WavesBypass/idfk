window.onload = async () => {
  const container = document.getElementById('requests');
  const res = await fetch('/forms');
  const data = await res.json();

  if (data.length === 0) {
    container.innerHTML = "<p>No pending requests.</p>";
    return;
  }

  data.forEach(req => {
    const div = document.createElement('div');
    div.className = 'request';
    div.innerHTML = `
      <p><strong>Username:</strong> ${req.username}</p>
      <p><strong>Age:</strong> ${req.age}</p>
      <p><strong>Discord:</strong> ${req.discord}</p>
      <p><strong>Reason:</strong> ${req.reason}</p>
      <form method="POST" action="/approve/${req.id}"><button type="submit">Approve</button></form>
      <form method="POST" action="/deny/${req.id}"><button type="submit">Deny</button></form>
      <hr/>
    `;
    container.appendChild(div);
  });
};
