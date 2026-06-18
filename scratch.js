fetch('http://localhost:3000/api/round1/projects/1')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error("Error:", err.message));
