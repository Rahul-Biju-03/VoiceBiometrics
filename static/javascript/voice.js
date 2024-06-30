import WaveSurfer from './wavesurfer.esm.js';
import RecordPlugin from './wavesurfer.record.esm.js';

let wavesurfer, record;
let scrollingWaveform = false;

const initWaveSurfer = () => {
  console.log('Initializing WaveSurfer instance...');
  if (wavesurfer) {
    wavesurfer.destroy();
  }
  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#01BAB6',
    progressColor: '#019B95',
  });
  console.log('WaveSurfer instance created.');

  record = wavesurfer.registerPlugin(RecordPlugin.create({ scrollingWaveform, renderRecordedAudio: false }));
  console.log('Record plugin registered.');

  record.on('record-end', handleRecordEnd);
  record.on('record-progress', updateProgress);

  resetControls();
};

const handleRecordEnd = (blob) => {
  console.log('Recording ended.');
  const container = document.querySelector('#recordings');
  const recordedUrl = URL.createObjectURL(blob);

  const recordedWaveSurfer = WaveSurfer.create({
    container,
    waveColor: 'rgb(200, 100, 0)',
    progressColor: 'rgb(100, 50, 0)',
    url: recordedUrl,
  });

  const playButton = createButton('Play', () => recordedWaveSurfer.playPause());
  recordedWaveSurfer.on('pause', () => (playButton.textContent = 'Play'));
  recordedWaveSurfer.on('play', () => (playButton.textContent = 'Pause'));

  const downloadLink = createDownloadLink(recordedUrl, blob.type);
  container.append(playButton, downloadLink);

  // Store the recorded blob for later submission
  document.querySelector('#submit').onclick = () => submitRecording(blob);
};

// Commented out the file upload handling mechanism
/*
const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (file && file.type === 'audio/wav') {
    const fileUrl = URL.createObjectURL(file);
    const container = document.querySelector('#recordings');

    const uploadedWaveSurfer = WaveSurfer.create({
      container,
      waveColor: 'rgb(200, 100, 0)',
      progressColor: 'rgb(100, 50, 0)',
      url: fileUrl,
    });

    const playButton = createButton('Play', () => uploadedWaveSurfer.playPause());
    uploadedWaveSurfer.on('pause', () => (playButton.textContent = 'Play'));
    uploadedWaveSurfer.on('play', () => (playButton.textContent = 'Pause'));

    const downloadLink = createDownloadLink(fileUrl, file.type);
    container.append(playButton, downloadLink);

    // Store the uploaded file for later submission
    document.querySelector('#submit').onclick = () => submitRecording(file);
  } else {
    alert('Please upload a valid WAV file.');
  }
};
*/

const createButton = (text, onClick) => {
  const button = document.createElement('button');
  button.textContent = text;
  button.onclick = onClick;
  return button;
};

const createDownloadLink = (url, type) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = `recording.${type.split(';')[0].split('/')[1] || 'webm'}`;
  link.textContent = 'Download recording';
  return link;
};

const updateProgress = (time) => {
  const formattedTime = [
    Math.floor((time % 3600000) / 60000),
    Math.floor((time % 60000) / 1000),
  ].map(v => (v < 10 ? '0' + v : v)).join(':');
  document.querySelector('#progress').textContent = formattedTime;
};

const resetControls = () => {
  const pauseButton = document.querySelector('#pause');
  const recButton = document.querySelector('#record');
  pauseButton.style.display = 'none';
  recButton.textContent = 'Record';
};

const setupMicOptions = () => {
  const micSelect = document.querySelector('#mic-select');
  RecordPlugin.getAvailableAudioDevices().then(devices => {
    console.log('Available audio devices:', devices);
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || device.deviceId;
      micSelect.appendChild(option);
    });
  }).catch(err => {
    console.error('Error fetching audio devices:', err);
  });
};

const handleRecording = () => {
  const recButton = document.querySelector('#record');
  const pauseButton = document.querySelector('#pause');
  const micSelect = document.querySelector('#mic-select');

  recButton.onclick = () => {
    if (record.isRecording() || record.isPaused()) {
      record.stopRecording();
      resetControls();
      console.log('Recording stopped.');
      return;
    }

    recButton.disabled = true;
    const deviceId = micSelect.value;
    record.startRecording({ deviceId }).then(() => {
      recButton.textContent = 'Stop';
      recButton.disabled = false;
      pauseButton.style.display = 'inline';
      console.log('Recording started.');
    }).catch(err => {
      console.error('Error starting recording:', err);
      recButton.disabled = false;
    });
  };

  pauseButton.onclick = () => {
    if (record.isPaused()) {
      record.resumeRecording();
      pauseButton.textContent = 'Pause';
      console.log('Recording resumed.');
    } else {
      record.pauseRecording();
      pauseButton.textContent = 'Resume';
      console.log('Recording paused.');
    }
  };
};

const submitRecording = (blob) => {
  const formData = new FormData();
  formData.append('file', blob, 'recording.wav');

  fetch('/voice', {
    method: 'POST',
    body: formData,
  }).then(response => {
    if (response.redirected) {
      window.location.href = response.url;
    } else {
      alert('Failed to submit recording. Please try again.');
    }
  }).catch(error => {
    console.error('Error submitting recording:', error);
    alert('Error submitting recording. Please try again.');
  });
};

// Commented out the file input event listener
// document.querySelector('#file-input').addEventListener('change', handleFileUpload);

document.addEventListener('DOMContentLoaded', () => {
  initWaveSurfer();
  setupMicOptions();
  handleRecording();
});
