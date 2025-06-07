fetch('/forms')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('requests');
    if (!data.length) {
      container.innerHTML = "<p>No pending requests.</p>";
      return;
    }
    data.forEach(req => {
      container.innerHTML += `
        <div class="card">
          <h3>${req.username}</h3>
          <p><strong>Age:</strong> ${req.age}</p>
          <p><strong>Discord:</strong> ${req.discord}</p>
          <p><strong>Reason:</strong> ${req.reason}</p>
          <form method="POST" action="/approve/${req.id}"><button class="approve">Approve</button></form>
          <form method="POST" action="/deny/${req.id}"><button class="deny">Deny</button></form>
        </div>
      `;
    });
  })
  .catch(err => {
    document.getElementById('requests').innerHTML = "<p>Error loading requests.</p>";
    console.error(err);
  });
