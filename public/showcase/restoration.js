const controls = document.getElementById('restoration-controls');
const practice = document.getElementById('practice');
const recording = document.getElementById('recording');
const restoration = document.getElementById('restoration');
const room = document.getElementById('room');
const result = document.getElementById('result');
const progress = document.getElementById('minutes');
const next = document.getElementById('next');

function updateExample() {
  const minutes = practice.checked ? 60 : 35;
  const finished = recording.checked ? 1 : 0;
  const open = minutes === 60 && finished === 1;

  restoration.classList.toggle('room-open', open);
  room.textContent = open ? 'The practice room' : 'The waiting room';
  result.textContent = `${minutes} of 60 minutes · Finished results ${finished} of 1${open ? ' · Practice room open' : ''}`;
  progress.value = minutes;

  if (open) next.textContent = 'Marin sets the recording beside the instrument.';
  else if (practice.checked) next.textContent = 'The practice is ready. Keep the recording to open the room.';
  else if (recording.checked) next.textContent = 'The recording is kept. Add 25 minutes of practice to open the room.';
  else next.textContent = 'The room is waiting for 25 minutes and a finished recording.';
}

controls.addEventListener('change', updateExample);
updateExample();
controls.hidden = false;
