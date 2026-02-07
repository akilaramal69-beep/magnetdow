const app = document.getElementById('app');
const statusDiv = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.querySelector('.progress-container');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const input = document.getElementById('magnet-input');
const submitBtn = document.getElementById('submit-btn');

let ws;

submitBtn.addEventListener('click', async () => {
    const magnet = input.value.trim();
    if (!magnet) return alert('Please enter a magnet link');

    submitBtn.disabled = true;
    submitBtn.innerText = 'Processing...';

    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnet })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        startTracking(data.id);
    } catch (e) {
        alert(e.message);
        submitBtn.disabled = false;
        submitBtn.innerText = 'Download';
    }
});

function startTracking(taskId) {
    statusDiv.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    input.classList.add('hidden');
    submitBtn.classList.add('hidden');

    // Connect WS
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'subscribe', taskId }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
            statusDiv.innerText = `Error: ${data.error}`;
            statusDiv.style.color = 'red';
            ws.close();
            return;
        }

        updateUI(data);

        if (data.status === 'completed') {
            ws.close();
        }
    };
}

function updateUI(task) {
    statusDiv.innerText = `Status: ${task.status.toUpperCase()}`;

    if (task.progress) {
        progressBar.style.width = `${task.progress}%`;
    }

    if (task.status === 'completed') {
        progressBar.style.width = '100%';
        downloadSection.classList.remove('hidden');
        downloadBtn.href = task.downloadUrl;
        downloadBtn.innerText = `Download ${task.fileName || 'File'}`;
        statusDiv.innerText = "Ready!";
    }
}
