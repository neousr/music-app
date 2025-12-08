"use strict";

const d = document;

const PATH = `https://neobte.github.io/music-player/audio/salsa/`;

let previousRowActive = null;

let timeoutID,
  isFirstClick = true;
let repeatState = 0,
  isRepeatAll = false;

let songList, songListCopy, songMap, numFiles, songIndex;
let isShuffle = false;
let isLocalFiles = false;

const audioPlayer = new Audio();

const inputFile = d.getElementById("input-file");
const tbody = d.getElementById("tbody");

const artistName = d.getElementById("artist-name");
const songTitle = d.getElementById("song-title");

const shuffleBtn = d.getElementById("shuffle-btn");
const repeatBtn = d.getElementById("repeat-btn");
const backwardBtn = d.getElementById("backward-btn");
const forwardBtn = d.getElementById("forward-btn");
const playPauseBtn = d.getElementById("play-pause-btn");
const [playIcon, pauseIcon] = playPauseBtn.children;

const audioCurrentTimeSlider = d.getElementById("audio-current-time-slider");
const currentTime = d.getElementById("current-time");
const duration = d.getElementById("duration");

const volumeBtn = d.getElementById("volume-btn");
const volumeSlider = d.getElementById("volume-slider");
const volumeDisplay = d.getElementById("volume-display");

let currentVolume = 1; // 1 = 100 %

// Iniciamos la solicitud al servidor
d.addEventListener("DOMContentLoaded", () => {
  init();
});

const init = () => {
  sendHttpRequest("GET", PATH + "playlist.json", null, handleResponse);
  audioCurrentTimeSlider.value = 0;
  volumeSlider.value = 100;
};

const handleResponse = (response) => {
  // songList = JSON.parse(response).slice(0, 10);
  songList = JSON.parse(response);
  songListCopy = [...songList];
  songMap = new Map(songListCopy.map((song) => [song.id, song]));
  // console.log(songMap);

  numFiles = songList.length;

  songIndex = 0;

  // ¿Podemos eliminar esta condición? No
  if (songIndex < numFiles) {
    // 1. Mostramos la lista de canciones
    displaySongs(songListCopy);
    // 2. Cargamos el índice cero por defecto
    loadSong(songIndex);
    // Siendo el índice cero, no hace falta desplazar el scroll
  }
};

d.getElementById("fileSelect").addEventListener("click", (e) => {
  if (inputFile) {
    inputFile.click();
  }
});

inputFile.addEventListener("change", (e) => {
  if (e.target.files.length === 0) return;
  isLocalFiles = true;
  const fileList = e.target.files;
  numFiles = fileList.length;
  const promises = new Array(numFiles);

  // Lógica para mostrar la duración de las canciones
  for (let i = 0; i < numFiles; i++) {
    const objectURL = URL.createObjectURL(fileList[i]);
    promises[i] = new Promise((resolve) => {
      const audio = new Audio(objectURL);
      audio.addEventListener("loadedmetadata", (e) => {
        resolve({
          id: i + 1,
          name: fileList[i].name,
          duration: audio.duration,
          url: objectURL,
          type: fileList[i].type,
          size: fileList[i].size,
        });
        // URL.revokeObjectURL(objectURL);
      });
      audio.load();
    });
  }

  songIndex = 0;

  Promise.all(promises).then((value) => {
    songList = value;
    songListCopy = [...songList];

    songMap = new Map(songListCopy.map((song) => [song.id, song]));

    // 1. Mostramos la lista de canciones
    displaySongs(songListCopy);

    // 2. Reproducimos el indice cero
    loadSong(songIndex);
    playAudio();

    // Si shuffle is true, barajamos el array
    if (isShuffle) {
      shufflePlayback(songListCopy);
    }
  });
  // Hot summer night
  // https://www1.maxcine.net/noches-de-verano-pelicula-gratis/
  // https://cuevana-4.com/peliculas/noches-de-verano
});

// Volume slider
volumeSlider.addEventListener("input", () => {
  volumeDisplay.textContent = volumeSlider.value;
  audioPlayer.volume = volumeSlider.value / 100;
  if (volumeSlider.value === "0") {
    volumeBtn.children[0].style.display = "none";
    volumeBtn.children[1].style.display = "block";
    audioPlayer.muted = true;
    currentVolume = 0.5; // 50 %
    volumeBtn.title = "Activar sonido";
  } else {
    volumeBtn.children[1].style.display = "none";
    volumeBtn.children[0].style.display = "block";
    audioPlayer.muted = false;
    currentVolume = volumeSlider.value / 100; //  Values are between 0 y 100
    volumeBtn.title = "Silenciar";
  }
});

volumeBtn.addEventListener("click", () => {
  audioPlayer.muted = !audioPlayer.muted;
  if (audioPlayer.muted) {
    audioPlayer.volume = 0;
    volumeSlider.value = 0;
    volumeBtn.children[0].style.display = "none";
    volumeBtn.children[1].style.display = "block";
    volumeBtn.title = "Activar sonido";
  } else {
    audioPlayer.volume = currentVolume; // Values are  between 0.1 and 1, where 1 = 100 %
    volumeSlider.value = currentVolume * 100; // Values are between 0 and 100
    volumeBtn.children[1].style.display = "none";
    volumeBtn.children[0].style.display = "block";
    volumeBtn.title = "Silenciar";
  }
  volumeDisplay.textContent = volumeSlider.value;
});

// Current time slider
audioPlayer.addEventListener("loadedmetadata", () => {
  currentTime.textContent = formatTime(audioPlayer.currentTime);
  duration.textContent = formatTime(audioPlayer.duration);
  audioCurrentTimeSlider.value = audioPlayer.currentTime;
  audioCurrentTimeSlider.max = audioPlayer.duration;
});

audioPlayer.addEventListener("timeupdate", () => {
  currentTime.textContent = formatTime(audioPlayer.currentTime);
  audioCurrentTimeSlider.value = audioPlayer.currentTime;
});

audioCurrentTimeSlider.addEventListener("input", () => {
  audioPlayer.currentTime = audioCurrentTimeSlider.value;
});

// Audio ended event
audioPlayer.addEventListener("ended", (e) => {
  if (songIndex >= numFiles - 1 && !isRepeatAll) {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    playPauseBtn.title = "Reproducir";
    return;
  }
  forwardBtn.click();
  playAudio();
});

// Shuffle event
shuffleBtn.addEventListener("click", (e) => {
  if (audioPlayer.src === "") return;
  isShuffle = !isShuffle;
  if (isShuffle) {
    shufflePlayback(songListCopy);
    // Seteamos el indice a cero
    songIndex = 0;
    shuffleBtn.children[0].querySelector("circle").style.display = "block";
    shuffleBtn.title = "Desactivar orden aleatorio";
  } else {
    sequentialPlayback(songList);
    shuffleBtn.children[0].querySelector("circle").style.display = "none";
    shuffleBtn.title = "Activar orden aleatorio";
  }
});

// Play/pause event
playPauseBtn.addEventListener("click", (e) => {
  if (audioPlayer.src === "") return;
  audioPlayer.paused ? playAudio() : pauseAudio();
});

// Backward event
backwardBtn.addEventListener("click", (e) => {
  if (audioPlayer.src === "") return;
  clearTimeout(timeoutID);
  if (audioPlayer.currentTime > 0 && isFirstClick) {
    audioPlayer.currentTime = 0;
    isFirstClick = false;
    setTimeout(() => {
      isFirstClick = true;
    }, 3000);
  } else if (!isFirstClick || audioPlayer.currentTime === 0) {
    songIndex = (songIndex - 1 + numFiles) % numFiles;
    if (!audioPlayer.paused) {
      loadSong(songIndex);
      audioPlayer.play();
    } else {
      loadSong(songIndex);
    }
    isFirstClick = true;
  }
  scrollToRow();
});

// Forward event
forwardBtn.addEventListener("click", (e) => {
  if (audioPlayer.src === "") return;
  songIndex = (songIndex + 1) % numFiles;
  if (!audioPlayer.paused) {
    loadSong(songIndex);
    playAudio();
  } else {
    loadSong(songIndex);
  }
  scrollToRow();
});

// Repeat event
repeatBtn.addEventListener("click", (e) => {
  if (audioPlayer.src === "") return;
  repeatState = (repeatState + 1) % 3;

  if (repeatState === 0) {
    audioPlayer.loop = false;
    repeatBtn.title = "Repetir playlist";
    repeatBtn.children[1].style.display = "none";
    repeatBtn.children[0].style.display = "block";
    return;
  }

  if (repeatState === 1) {
    isRepeatAll = true;
    repeatBtn.title = "Repetir canción indefinidamente";
    repeatBtn.children[0].querySelector("circle").style.display = "block";
    return;
  }

  if (repeatState === 2) {
    isRepeatAll = false;
    audioPlayer.loop = true;
    repeatBtn.title = "Desactivar la repetición indefinida";
    repeatBtn.children[0].querySelector("circle").style.display = "none";
    repeatBtn.children[0].style.display = "none";
    repeatBtn.children[1].style.display = "block";
    return;
  }
});

const pauseAudio = () => {
  audioPlayer.pause();
  playIcon.style.display = "block";
  pauseIcon.style.display = "none";
  playPauseBtn.title = "Reproducir";
};

const playAudio = () => {
  audioPlayer.play().catch((error) => {});
  playIcon.style.display = "none";
  pauseIcon.style.display = "block";
  playPauseBtn.title = "Pausar";
};

const displaySongs = (songs) => {
  tbody.textContent = "";
  const fragment = d.createDocumentFragment();
  for (let idx = 0; idx < numFiles; idx++) {
    const tr = d.createElement("tr");
    tr.dataset.id = songs[idx].id;
    const { artistName, title } = parseName(songs[idx].name);
    tr.innerHTML = `<td><span>${idx + 1}</span></td>
                <td><h3>${artistName}</h3><h4>${title}</h4></td>
                <td><span>${formatTime(songs[idx].duration)}</span></td>`;
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);

  tbody.children[songIndex].classList.add("active");
  previousRowActive = tbody.children[songIndex];

  tbodyEventListenerClick();
};

const tbodyEventListenerClick = () => {
  tbody.addEventListener("click", (e) => {
    const tr = e.target.parentNode.parentNode;
    if (tr.tagName !== "TR") return;

    if (previousRowActive) previousRowActive.classList.remove("active");
    tr.classList.add("active");
    previousRowActive = tr;

    // Seteamos songIndex, solo cuando la reproducción es secuencial
    if (!isShuffle) songIndex = tr.rowIndex;
    // const song = songListCopy.find(song => song.id === +tr.dataset.id);
    const song = songMap.get(+tr.dataset.id);

    audioPlayer.src = isLocalFiles ? song.url : PATH + song.name;
    audioPlayer.dataset.songId = song.id;
    audioPlayer.load();
    playAudio();

    const infoSong = parseName(song.name);
    artistName.textContent = infoSong.artistName;
    songTitle.textContent = infoSong.title;
  });
};

const loadSong = (songIndex) => {
  audioPlayer.src = isLocalFiles
    ? songListCopy[songIndex].url
    : PATH + songListCopy[songIndex].name;
  audioPlayer.dataset.songId = songListCopy[songIndex].id;
  audioPlayer.preload = "auto";
  audioPlayer.load();
  const song = parseName(songListCopy[songIndex].name);
  artistName.textContent = song.artistName;
  songTitle.textContent = song.title;
};

const scrollToRow = () => {
  if (previousRowActive) previousRowActive.classList.remove("active");
  previousRowActive = tbody.querySelector(
    `tr[data-id="${songListCopy[songIndex].id}"]`
  );
  previousRowActive.classList.add("active");

  previousRowActive.scrollIntoView({ behavior: "smooth", block: "center" });
};

// https://introcs.cs.princeton.edu/java/14array/Deck.java.html
const shuffle = (arr) => {
  const len = arr.length;
  // console.log(`Longitud de "len" en la función shuffle: ${len}`);
  // console.log(`Longitud de "numFiles" en la función shuffle: ${numFiles}`);
  for (let i = 0; i < len; i++) {
    const r = i + parseInt(Math.random() * (len - i));
    [arr[i], arr[r]] = [arr[r], arr[i]];
  }
  return arr;
};

const sequentialPlayback = (list) => {
  // Buscamos el índice
  songIndex = list.findIndex(
    (song) => song.id == audioPlayer.dataset["songId"]
  );
  // Devolvemos el orden del array original
  songListCopy = [...list];
};

const shufflePlayback = (list) => {
  // Encuentra el elemento y lo extrae del arreglo
  const currentlyPlayingSong = list.splice(
    list.findIndex((song) => song.id == audioPlayer.dataset["songId"]),
    1
  )[0];
  // Barajamos el arreglo sin la cancion actualmente en reproduccion
  // Nota en la función shuffle:
  // Al eliminar del array la canción actualmente en reproducción, nuestro array ahora tiene un elemento menos
  // Al llamar a la función shuffle, la función debería calcular nuevamente la longitud del array, por lo que
  // No podemos utilizar la variable numFiles que almacena la longitud del array al inicio del todo
  list = shuffle(list);
  // Enviamos al principio la canción que esta actualmente en reproducción despues de la mezcla
  list.unshift(currentlyPlayingSong);
};

const removeExt = (name) => {
  return name.slice(0, -4);
};

// https://www.w3schools.com/jsref/jsref_obj_string.asp
const parseName = (name) => {
  return {
    artistName: name.slice(0, name.indexOf(" - ")),
    title: name.slice(name.indexOf(" - ") + 3, -4),
  };

  // return [name.slice(0, name.indexOf(' - ')), name.slice(name.indexOf(' - ') + 3, -4)];
};

// Format time in hh:mm:ss or mm:ss
const formatTime = (seconds, format = 0) => {
  seconds = Math.round(seconds); // 287.370158
  const hours = (seconds / 3600) | 0; // Hours calculation
  const minutes = ((seconds % 3600) / 60) | 0; // Minutes calculation
  const remainingSeconds = seconds % 60; // Whole seconds

  if (format === 0) {
    return hours > 0
      ? // Show hours:minutes:seconds format
        `${hours}:${minutes < 10 ? "0" + minutes : minutes}:${
          remainingSeconds < 10 ? "0" + remainingSeconds : remainingSeconds
        }`
      : // Show minutes:seconds format
        `${minutes < 10 ? "0" + minutes : minutes}:${
          remainingSeconds < 10 ? "0" + remainingSeconds : remainingSeconds
        }`;
  }

  return hours > 0
    ? // Show hours minutes seconds format => 10 h 8 min 47 s
      `${hours} h ${minutes} min ${remainingSeconds} s`
    : // Show minutes seconds format => 8 min 47 s
      `${minutes} min ${remainingSeconds} s`;
};

// Send request
function sendHttpRequest(method, url, data, callback) {
  const xhr = getXhr();
  xhr.onreadystatechange = processRequest;
  function getXhr() {
    if (window.XMLHttpRequest) {
      return new XMLHttpRequest();
    } else {
      return new ActiveXObject("Microsoft.XMLHTTP");
    }
  }
  function processRequest() {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200 && xhr.response != null) {
        if (callback) callback(xhr.response);
      } else {
        console.log(
          "There was a problem retrieving the data: " + xhr.statusText
        );
      }
    }
  }
  xhr.open(method, url + (/\?/.test(url) ? "&" : "?") + new Date().getTime());
  xhr.onloadstart = function (e) {
    /*openLoader();*/
  };
  xhr.onloadend = function (e) {
    /*closeLoader();*/
  };
  if (data && !(data instanceof FormData))
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.send(data);
  xhr.onerror = function (e) {
    console.log("Error: " + e + " Could not load url.");
  };
}
