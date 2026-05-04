(function () {
  const cfg = window.DataPulse || {};
  const apiBase = cfg.apiBase || 'http://localhost:3000';
  const apiKey = cfg.apiKey || 'dev_key';

  const style = document.createElement('style');
  style.textContent = `
    #dp-widget{position:fixed;bottom:24px;right:24px;background:#fff;padding:20px;
    border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.12);display:none;
    width:280px;font-family:sans-serif;z-index:9999}
    #dp-widget h4{margin:0 0 12px;font-size:14px;color:#111}
    #dp-widget input{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;
    font-size:13px;margin-bottom:8px;box-sizing:border-box}
    #dp-submit{background:#111;color:#fff;border:none;padding:8px 16px;
    border-radius:6px;cursor:pointer;font-size:13px;width:100%}
    #dp-msg{font-size:12px;color:#22c55e;margin-top:8px;display:none}
  `;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'dp-widget';
  widget.innerHTML = `
    <h4>📊 Send a Metric</h4>
    <input id="dp-metric" placeholder="Metric name (e.g. active_users)"/>
    <input id="dp-value" type="number" placeholder="Value (e.g. 342)"/>
    <input id="dp-source" placeholder="Source (e.g. mixpanel)"/>
    <button id="dp-submit">Send Metric</button>
    <p id="dp-msg">✅ Metric sent!</p>
  `;
  document.body.appendChild(widget);

  document.getElementById('dp-submit').addEventListener('click', async () => {
    const metric = document.getElementById('dp-metric').value;
    const value = parseFloat(document.getElementById('dp-value').value);
    const source = document.getElementById('dp-source').value || 'widget';
    if (!metric || isNaN(value)) return alert('Enter metric name and numeric value.');
    try {
      await fetch(`${apiBase}/api/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ metric, value, source })
      });
      const msg = document.getElementById('dp-msg');
      msg.style.display = 'block';
      setTimeout(() => {
        msg.style.display = 'none';
        document.getElementById('dp-widget').style.display = 'none';
      }, 2000);
    } catch (err) { alert('Failed: ' + err.message); }
  });

  window.showDataPulse = () => {
    document.getElementById('dp-widget').style.display = 'block';
  };
})();

