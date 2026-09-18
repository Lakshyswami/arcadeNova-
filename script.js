/* =========================================================
   ZUVO — MUSIC LIBRARY
   SCRIPT.JS — PART 1/3
========================================================= */

"use strict";


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


/* =========================================================
   ELEMENTS
========================================================= */

const audio = $("#audioPlayer");
const fileInput = $("#audioFileInput");

const searchPanel = $("#searchPanel");
const searchInput = $("#searchInput");
const clearSearchButton = $("#clearSearchButton");

const songCount = $("#songCount");
const favoriteCount = $("#favoriteCount");
const playlistCount = $("#playlistCount");

const recentSongsList = $("#recentSongsList");
const libraryEmptyState = $("#libraryEmptyState");

const playlistGrid = $("#playlistGrid");
const playlistEmptyState = $("#playlistEmptyState");
const createPlaylistButton = $("#createPlaylistButton");

const favoriteSongsList = $("#favoriteSongsList");
const favoriteEmptyState = $("#favoriteEmptyState");

const miniPlayer = $("#miniPlayer");
const miniCover = $("#miniCover");
const miniSongTitle = $("#miniSongTitle");
const miniSongArtist = $("#miniSongArtist");
const miniFavoriteButton = $("#miniFavoriteButton");
const miniPlayButton = $("#miniPlayButton");
const openFullPlayerButton = $("#openFullPlayerButton");

const fullPlayer = $("#fullPlayer");
const closeFullPlayerButton = $("#closeFullPlayerButton");
const playerMoreButton = $("#playerMoreButton");

const playerArtwork = $("#playerArtwork");
const playerSongTitle = $("#playerSongTitle");
const playerSongArtist = $("#playerSongArtist");
const playerFavoriteButton = $("#playerFavoriteButton");

const seekBar = $("#seekBar");
const currentTimeElement = $("#currentTime");
const durationElement = $("#duration");

const shuffleButton = $("#shuffleButton");
const previousButton = $("#previousButton");
const mainPlayButton = $("#mainPlayButton");
const nextButton = $("#nextButton");
const repeatButton = $("#repeatButton");
const repeatOneIndicator = $("#repeatOneIndicator");

const volumeBar = $("#volumeBar");

const playlistModal = $("#playlistModal");
const playlistForm = $("#playlistForm");
const playlistNameInput = $("#playlistNameInput");

const addToPlaylistModal = $("#addToPlaylistModal");
const playlistPicker = $("#playlistPicker");

const confirmModal = $("#confirmModal");
const confirmClearButton = $("#confirmClearButton");
const clearLibraryButton = $("#clearLibraryButton");

const toast = $("#toast");
const toastMessage = $("#toastMessage");

const loadingScreen = $("#loadingScreen");

const storageBarFill = $("#storageBarFill");
const storageUsed = $("#storageUsed");
const storageSongCount = $("#storageSongCount");

const autoplaySetting = $("#autoplaySetting");
const rememberPositionSetting = $("#rememberPositionSetting");
const reduceMotionSetting = $("#reduceMotionSetting");

const appVersion = $("#appVersion");


/* =========================================================
   INDEXEDDB
========================================================= */

const DB_NAME = "zuvoMusicDB";
const DB_VERSION = 1;

const STORE_SONGS = "songs";
const STORE_PLAYLISTS = "playlists";
const STORE_SETTINGS = "settings";

let db = null;


/* =========================================================
   APP STATE
========================================================= */

const state = {

    songs: [],

    playlists: [],

    currentSongId: null,

    currentIndex: -1,

    queue: [],

    shuffle: false,

    repeat: "off",

    isPlaying: false,

    searchQuery: "",

    objectUrl: null,

    settings: {
        autoplay: true,
        rememberPosition: true,
        reduceMotion: false,
        volume: 1
    }

};


/* =========================================================
   GENERAL HELPERS
========================================================= */

function createId() {

    if (
        window.crypto &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "0:00";
    }

    const minutes =
        Math.floor(seconds / 60);

    const secs =
        Math.floor(seconds % 60);

    return (
        `${minutes}:` +
        `${String(secs).padStart(2, "0")}`
    );
}


function formatBytes(bytes) {

    if (!bytes) {
        return "0 MB";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    let size = bytes;
    let index = 0;

    while (
        size >= 1024 &&
        index < units.length - 1
    ) {
        size /= 1024;
        index++;
    }

    return (
        `${size.toFixed(
            index === 0 ? 0 : 1
        )} ${units[index]}`
    );
}


function getSongById(id) {

    return (
        state.songs.find(
            song => song.id === id
        ) || null
    );
}


function getPlaylistById(id) {

    return (
        state.playlists.find(
            playlist =>
                playlist.id === id
        ) || null
    );
}


/* =========================================================
   DEFAULT COVER
========================================================= */

function defaultCover(title = "Zuvo") {

    const letters =
        String(title)
            .slice(0, 2)
            .toUpperCase();

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="600"
            height="600"
            viewBox="0 0 600 600"
        >

            <defs>

                <linearGradient
                    id="zuvoGradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                >
                    <stop
                        offset="0%"
                        stop-color="#376fc5"
                    />

                    <stop
                        offset="100%"
                        stop-color="#081321"
                    />
                </linearGradient>

            </defs>

            <rect
                width="600"
                height="600"
                rx="80"
                fill="url(#zuvoGradient)"
            />

            <circle
                cx="300"
                cy="300"
                r="155"
                fill="rgba(255,255,255,.08)"
            />

            <text
                x="300"
                y="335"
                text-anchor="middle"
                font-family="Arial"
                font-size="110"
                font-weight="700"
                fill="white"
            >
                ${escapeHTML(letters)}
            </text>

        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}


/* =========================================================
   FILENAME PARSER
========================================================= */

function parseFilename(filename) {

    let name =
        filename
            .replace(/\.[^/.]+$/, "")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    let artist =
        "Unknown Artist";

    if (name.includes(" - ")) {

        const parts =
            name.split(" - ");

        artist =
            parts.shift().trim();

        name =
            parts.join(" - ").trim();
    }

    return {
        title: name || "Unknown Song",
        artist
    };
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

    if (!toast || !toastMessage) {
        return;
    }

    toastMessage.textContent =
        message;

    toast.classList.add(
        "active"
    );

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "active"
            );

        }, 2200);
}


/* =========================================================
   DATABASE OPEN
========================================================= */

function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            if (!("indexedDB" in window)) {

                reject(
                    new Error(
                        "IndexedDB is not supported."
                    )
                );

                return;
            }

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const database =
                        event.target.result;


                    if (
                        !database.objectStoreNames
                            .contains(STORE_SONGS)
                    ) {

                        const songsStore =
                            database.createObjectStore(
                                STORE_SONGS,
                                {
                                    keyPath: "id"
                                }
                            );

                        songsStore.createIndex(
                            "signature",
                            "signature",
                            {
                                unique: true
                            }
                        );
                    }


                    if (
                        !database.objectStoreNames
                            .contains(STORE_PLAYLISTS)
                    ) {

                        database.createObjectStore(
                            STORE_PLAYLISTS,
                            {
                                keyPath: "id"
                            }
                        );
                    }


                    if (
                        !database.objectStoreNames
                            .contains(STORE_SETTINGS)
                    ) {

                        database.createObjectStore(
                            STORE_SETTINGS,
                            {
                                keyPath: "key"
                            }
                        );
                    }
                };


            request.onsuccess =
                () => {

                    db =
                        request.result;

                    db.onversionchange =
                        () => {
                            db.close();
                        };

                    resolve(db);
                };


            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };

        }
    );
}


/* =========================================================
   DATABASE HELPERS
========================================================= */

function dbGetAll(storeName) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    "readonly"
                );

            const request =
                transaction
                    .objectStore(storeName)
                    .getAll();

            request.onsuccess =
                () => {

                    resolve(
                        request.result || []
                    );
                };

            request.onerror =
                () => {

                    reject(
                        request.error
                    );
                };
        }
    );
}


function dbGet(storeName, key) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    "readonly"
                );

            const request =
                transaction
                    .objectStore(storeName)
                    .get(key);

            request.onsuccess =
                () => {
                    resolve(
                        request.result
                    );
                };

            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };
        }
    );
}


function dbPut(storeName, value) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    "readwrite"
                );

            const request =
                transaction
                    .objectStore(storeName)
                    .put(value);

            request.onsuccess =
                () => {
                    resolve(
                        request.result
                    );
                };

            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };
        }
    );
}


function dbDelete(storeName, key) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    "readwrite"
                );

            const request =
                transaction
                    .objectStore(storeName)
                    .delete(key);

            request.onsuccess =
                () => resolve();

            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };
        }
    );
}


function dbClear(storeName) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    storeName,
                    "readwrite"
                );

            const request =
                transaction
                    .objectStore(storeName)
                    .clear();

            request.onsuccess =
                () => resolve();

            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };
        }
    );
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

    state.songs =
        await dbGetAll(
            STORE_SONGS
        );

    state.playlists =
        await dbGetAll(
            STORE_PLAYLISTS
        );

    const savedSettings =
        await dbGetAll(
            STORE_SETTINGS
        );

    savedSettings.forEach(
        item => {

            if (
                Object.prototype.hasOwnProperty.call(
                    state.settings,
                    item.key
                )
            ) {

                state.settings[item.key] =
                    item.value;
            }
        }
    );


    state.songs.sort(
        (a, b) =>
            (b.addedAt || 0) -
            (a.addedAt || 0)
    );
}


/* =========================================================
   SETTINGS
========================================================= */

async function saveSetting(
    key,
    value
) {

    state.settings[key] =
        value;

    try {

        await dbPut(
            STORE_SETTINGS,
            {
                key,
                value
            }
        );

    } catch (error) {

        console.error(
            "Setting save error:",
            error
        );
    }
}


function applySettings() {

    if (autoplaySetting) {

        autoplaySetting.checked =
            Boolean(
                state.settings.autoplay
            );
    }

    if (rememberPositionSetting) {

        rememberPositionSetting.checked =
            Boolean(
                state.settings.rememberPosition
            );
    }

    if (reduceMotionSetting) {

        reduceMotionSetting.checked =
            Boolean(
                state.settings.reduceMotion
            );
    }


    document.documentElement
        .classList.toggle(
            "reduce-motion",
            Boolean(
                state.settings.reduceMotion
            )
        );


    if (audio) {

        audio.volume =
            Number.isFinite(
                state.settings.volume
            )
                ? state.settings.volume
                : 1;
    }


    if (volumeBar) {

        volumeBar.value =
            String(
                audio?.volume ?? 1
            );
    }
}


/* =========================================================
   FILE SIGNATURE
========================================================= */

function getFileSignature(file) {

    return [
        file.name,
        file.size,
        file.type,
        file.lastModified
    ].join("::");
}


/* =========================================================
   AUDIO DURATION
========================================================= */

function getAudioDuration(file) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(file);

            const tempAudio =
                document.createElement(
                    "audio"
                );

            tempAudio.preload =
                "metadata";


            tempAudio.onloadedmetadata =
                () => {

                    const duration =
                        tempAudio.duration;

                    URL.revokeObjectURL(
                        url
                    );

                    resolve(
                        duration
                    );
                };


            tempAudio.onerror =
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(
                        new Error(
                            "Audio metadata error"
                        )
                    );
                };


            tempAudio.src = url;
        }
    );
}


/* =========================================================
   IMPORT MUSIC
========================================================= */

async function importFiles(files) {

    if (!files || !files.length) {
        return;
    }

    const existing =
        new Set(
            state.songs.map(
                song => song.signature
            )
        );


    let added = 0;
    let skipped = 0;


    for (const file of files) {

        const validAudio =
            file.type.startsWith(
                "audio/"
            ) ||
            /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i
                .test(file.name);


        if (!validAudio) {

            skipped++;

            continue;
        }


        const signature =
            getFileSignature(file);


        if (existing.has(signature)) {

            skipped++;

            continue;
        }


        const parsed =
            parseFilename(
                file.name
            );


        const song = {
    id: createId(),

    title: parsed.title,

    artist: parsed.artist,

    album: "",

    duration: duration || 0,

    size: file.size,

    type: file.type || "audio/mpeg",

    fileName: file.name,

    addedAt: Date.now(),

    favorite: false,

    cover: defaultCover(parsed.title),

    blob: file
};
/* =========================================================
   ZUVO — MUSIC LIBRARY
   SCRIPT.JS — PART 2/3
========================================================= */


/* =========================================================
   RENDER HELPERS
========================================================= */

function updateStats() {
    if (songCount) {
        songCount.textContent = state.songs.length;
    }

    if (favoriteCount) {
        favoriteCount.textContent =
            state.songs.filter(song => song.favorite).length;
    }

    if (playlistCount) {
        playlistCount.textContent = state.playlists.length;
    }

    if (storageSongCount) {
        storageSongCount.textContent = state.songs.length;
    }
}


function favoriteIcon(active = false) {
    return `
        <svg viewBox="0 0 24 24"
             width="20"
             height="20"
             fill="${active ? "currentColor" : "none"}"
             stroke="currentColor"
             stroke-width="1.8"
             stroke-linecap="round"
             stroke-linejoin="round"
             aria-hidden="true">
            <path d="M20.8 8.7c0 5.1-8.8 10.3-8.8 10.3S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>
        </svg>
    `;
}


function playlistIcon() {
    return `
        <svg viewBox="0 0 24 24"
             width="20"
             height="20"
             fill="none"
             stroke="currentColor"
             stroke-width="1.8"
             stroke-linecap="round"
             stroke-linejoin="round"
             aria-hidden="true">
            <path d="M4 6h16"/>
            <path d="M4 12h16"/>
            <path d="M4 18h10"/>
            <path d="M18 15v6"/>
            <path d="M15 18h6"/>
        </svg>
    `;
}


function moreIcon() {
    return `
        <svg viewBox="0 0 24 24"
             width="20"
             height="20"
             fill="currentColor"
             aria-hidden="true">
            <circle cx="5" cy="12" r="1.7"/>
            <circle cx="12" cy="12" r="1.7"/>
            <circle cx="19" cy="12" r="1.7"/>
        </svg>
    `;
}


/* =========================================================
   SONG HTML
========================================================= */

function songHTML(song) {
    const isCurrent = state.currentSongId === song.id;

    return `
        <article class="song-item ${isCurrent ? "active" : ""}"
                 data-song-id="${song.id}">

            <button
                class="song-cover-button"
                type="button"
                data-action="play"
                data-song-id="${song.id}"
                aria-label="Play ${escapeHTML(song.title)}">

                <img
                    class="song-cover"
                    src="${song.cover}"
                    alt=""
                    loading="lazy">

                <span class="song-play-overlay">
                    <svg viewBox="0 0 24 24"
                         width="18"
                         height="18"
                         fill="currentColor"
                         aria-hidden="true">
                        <path d="M8 5.2v13.6L19 12 8 5.2Z"/>
                    </svg>
                </span>
            </button>

            <button
                class="song-info"
                type="button"
                data-action="play"
                data-song-id="${song.id}">

                <strong class="song-title">
                    ${escapeHTML(song.title)}
                </strong>

                <span class="song-artist">
                    ${escapeHTML(song.artist || "Unknown artist")}
                </span>
            </button>

            <span class="song-duration">
                ${formatTime(song.duration)}
            </span>

            <button
                class="song-action favorite-action ${song.favorite ? "active" : ""}"
                type="button"
                data-action="favorite"
                data-song-id="${song.id}"
                aria-label="${song.favorite ? "Remove from favorites" : "Add to favorites"}">

                ${favoriteIcon(song.favorite)}
            </button>

            <button
                class="song-action more-action"
                type="button"
                data-action="more"
                data-song-id="${song.id}"
                aria-label="More options">

                ${moreIcon()}
            </button>
        </article>
    `;
}


/* =========================================================
   FILTERING
========================================================= */

function getFilteredSongs(songs = state.songs) {
    const query = state.searchQuery.trim().toLowerCase();

    if (!query) {
        return [...songs];
    }

    return songs.filter(song => {
        const title = String(song.title || "").toLowerCase();
        const artist = String(song.artist || "").toLowerCase();
        const album = String(song.album || "").toLowerCase();
        const fileName = String(song.fileName || "").toLowerCase();

        return (
            title.includes(query) ||
            artist.includes(query) ||
            album.includes(query) ||
            fileName.includes(query)
        );
    });
}


/* =========================================================
   RECENT SONGS
========================================================= */

function renderRecentSongs() {
    if (!recentSongsList) return;

    const songs = getFilteredSongs()
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .slice(0, 12);

    recentSongsList.innerHTML = "";

    if (!songs.length) {
        if (libraryEmptyState) {
            libraryEmptyState.hidden = state.songs.length !== 0;
        }

        return;
    }

    if (libraryEmptyState) {
        libraryEmptyState.hidden = true;
    }

    recentSongsList.innerHTML = songs
        .map(songHTML)
        .join("");
}


/* =========================================================
   FAVORITES
========================================================= */

function renderFavorites() {
    if (!favoriteSongsList) return;

    const favorites = getFilteredSongs(
        state.songs.filter(song => song.favorite)
    );

    favoriteSongsList.innerHTML = "";

    if (!favorites.length) {
        if (favoriteEmptyState) {
            favoriteEmptyState.hidden = false;
        }

        return;
    }

    if (favoriteEmptyState) {
        favoriteEmptyState.hidden = true;
    }

    favoriteSongsList.innerHTML = favorites
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .map(songHTML)
        .join("");
}


/* =========================================================
   PLAYLISTS
========================================================= */

function renderPlaylists() {
    if (!playlistGrid) return;

    playlistGrid.innerHTML = "";

    if (!state.playlists.length) {
        if (playlistEmptyState) {
            playlistEmptyState.hidden = false;
        }

        return;
    }

    if (playlistEmptyState) {
        playlistEmptyState.hidden = true;
    }

    playlistGrid.innerHTML = state.playlists
        .map(playlist => {
            const songs = playlist.songIds
                .map(id => getSongById(id))
                .filter(Boolean);

            const firstSong = songs[0];

            const cover = firstSong
                ? firstSong.cover
                : defaultCover(playlist.name);

            return `
                <article
                    class="playlist-card"
                    data-playlist-id="${playlist.id}">

                    <button
                        class="playlist-cover-button"
                        type="button"
                        data-action="open-playlist"
                        data-playlist-id="${playlist.id}"
                        aria-label="Open ${escapeHTML(playlist.name)}">

                        <img
                            class="playlist-cover"
                            src="${cover}"
                            alt=""
                            loading="lazy">

                        <span class="playlist-play-overlay">
                            <svg viewBox="0 0 24 24"
                                 width="22"
                                 height="22"
                                 fill="currentColor"
                                 aria-hidden="true">
                                <path d="M8 5.2v13.6L19 12 8 5.2Z"/>
                            </svg>
                        </span>
                    </button>

                    <div class="playlist-card-content">
                        <h3>
                            ${escapeHTML(playlist.name)}
                        </h3>

                        <p>
                            ${songs.length}
                            ${songs.length === 1 ? "song" : "songs"}
                        </p>
                    </div>

                    <button
                        class="playlist-more-button"
                        type="button"
                        data-action="playlist-more"
                        data-playlist-id="${playlist.id}"
                        aria-label="Playlist options">

                        ${moreIcon()}
                    </button>
                </article>
            `;
        })
        .join("");
}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {
    updateStats();
    renderRecentSongs();
    renderFavorites();
    renderPlaylists();
    updatePlayerUI();
}


/* =========================================================
   OBJECT URL MANAGEMENT
========================================================= */

function revokeCurrentObjectUrl() {
    if (state.objectUrl) {
        URL.revokeObjectURL(state.objectUrl);
        state.objectUrl = null;
    }
}


function createSongObjectUrl(song) {
    revokeCurrentObjectUrl();

    if (!song || !song.blob) {
        return null;
    }

    state.objectUrl = URL.createObjectURL(song.blob);

    return state.objectUrl;
}


/* =========================================================
   QUEUE
========================================================= */

function buildQueue(songs = state.songs) {
    const filtered = getFilteredSongs(songs);

    if (state.shuffle) {
        return [...filtered].sort(() => Math.random() - 0.5);
    }

    return filtered;
}


function rebuildQueue(startSongId = null) {
    state.queue = buildQueue();

    if (startSongId) {
        const index = state.queue.findIndex(
            song => song.id === startSongId
        );

        state.currentIndex = index;
    } else {
        state.currentIndex = -1;
    }
}


/* =========================================================
   PLAY SONG
========================================================= */

async function playSongById(songId, autoplay = true) {
    const song = getSongById(songId);

    if (!song) {
        showToast("Song not found.");
        return;
    }

    if (!state.queue.length ||
        !state.queue.some(item => item.id === songId)) {
        rebuildQueue(songId);
    }

    const queueIndex = state.queue.findIndex(
        item => item.id === songId
    );

    if (queueIndex !== -1) {
        state.currentIndex = queueIndex;
    }

    state.currentSongId = song.id;

    const objectUrl = createSongObjectUrl(song);

    if (!objectUrl) {
        showToast("This audio file is unavailable.");
        return;
    }

    audio.src = objectUrl;
    audio.load();

    audio.onloadedmetadata = async () => {
        if (
            state.settings.rememberPosition &&
            typeof song.position === "number" &&
            song.position > 0 &&
            song.position < audio.duration
        ) {
            try {
                audio.currentTime = song.position;
            } catch (_) {}
        }

        updatePlayerUI();
    };

    if (autoplay) {
        try {
            await audio.play();

            state.isPlaying = true;
        } catch (error) {
            state.isPlaying = false;

            showToast("Tap play to start the song.");
        }
    } else {
        state.isPlaying = false;
    }

    updatePlayerUI();
    renderAll();

    if ("mediaSession" in navigator) {
        try {
            navigator.mediaSession.metadata =
                new MediaMetadata({
                    title: song.title || "Unknown title",
                    artist: song.artist || "Unknown artist",
                    album: song.album || "Zuvo",
                    artwork: song.cover
                        ? [
                            {
                                src: song.cover,
                                sizes: "512x512",
                                type: "image/svg+xml"
                            }
                        ]
                        : []
                });
        } catch (_) {}
    }
}


/* =========================================================
   PLAY / PAUSE
========================================================= */

async function togglePlay() {
    if (!state.currentSongId) {
        const firstSong =
            state.queue[0] ||
            getFilteredSongs()[0] ||
            state.songs[0];

        if (!firstSong) {
            showToast("Add music to start listening.");
            return;
        }

        await playSongById(firstSong.id, true);
        return;
    }

    if (audio.paused) {
        try {
            await audio.play();

            state.isPlaying = true;
        } catch (_) {
            state.isPlaying = false;
        }
    } else {
        audio.pause();
        state.isPlaying = false;
    }

    updatePlayerUI();
}


/* =========================================================
   NEXT SONG
========================================================= */

async function nextSong() {
    if (!state.queue.length) {
        rebuildQueue(state.currentSongId);
    }

    if (!state.queue.length) return;

    let nextIndex;

    if (state.repeat === "one") {
        audio.currentTime = 0;

        try {
            await audio.play();
            state.isPlaying = true;
        } catch (_) {}

        updatePlayerUI();
        return;
    }

    if (state.shuffle) {
        if (state.queue.length === 1) {
            nextIndex = 0;
        } else {
            do {
                nextIndex =
                    Math.floor(
                        Math.random() * state.queue.length
                    );
            } while (
                state.queue[nextIndex].id === state.currentSongId
            );
        }
    } else {
        nextIndex = state.currentIndex + 1;

        if (nextIndex >= state.queue.length) {
            if (state.repeat === "all") {
                nextIndex = 0;
            } else {
                audio.pause();
                audio.currentTime = 0;
                state.isPlaying = false;

                updatePlayerUI();
                return;
            }
        }
    }

    const nextSongItem = state.queue[nextIndex];

    if (nextSongItem) {
        await playSongById(nextSongItem.id, true);
    }
}


/* =========================================================
   PREVIOUS SONG
========================================================= */

async function previousSong() {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    if (!state.queue.length) {
        rebuildQueue(state.currentSongId);
    }

    if (!state.queue.length) return;

    let previousIndex = state.currentIndex - 1;

    if (previousIndex < 0) {
        if (state.repeat === "all") {
            previousIndex = state.queue.length - 1;
        } else {
            previousIndex = 0;
        }
    }

    const previousSongItem = state.queue[previousIndex];

    if (previousSongItem) {
        await playSongById(previousSongItem.id, true);
    }
}


/* =========================================================
   AUDIO ENDED
========================================================= */

function handleAudioEnded() {
    if (state.repeat === "one") {
        audio.currentTime = 0;

        audio.play()
            .then(() => {
                state.isPlaying = true;
                updatePlayerUI();
            })
            .catch(() => {
                state.isPlaying = false;
                updatePlayerUI();
            });

        return;
    }

    nextSong();
}


/* =========================================================
   FAVORITES
========================================================= */

async function toggleFavorite(songId) {
    const song = getSongById(songId);

    if (!song) return;

    song.favorite = !song.favorite;

    await dbPut(STORE_SONGS, song);

    renderAll();

    showToast(
        song.favorite
            ? "Added to favorites."
            : "Removed from favorites."
    );
}


/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayButtons() {
    const playIcon = `
        <svg viewBox="0 0 24 24"
             width="22"
             height="22"
             fill="currentColor"
             aria-hidden="true">
            <path d="M8 5.2v13.6L19 12 8 5.2Z"/>
        </svg>
    `;

    const pauseIcon = `
        <svg viewBox="0 0 24 24"
             width="22"
             height="22"
             fill="currentColor"
             aria-hidden="true">
            <path d="M7 5h4v14H7zM13 5h4v14h-4z"/>
        </svg>
    `;

    const icon = state.isPlaying ? pauseIcon : playIcon;

    if (miniPlayButton) {
        miniPlayButton.innerHTML = icon;
        miniPlayButton.setAttribute(
            "aria-label",
            state.isPlaying ? "Pause" : "Play"
        );
    }

    if (mainPlayButton) {
        mainPlayButton.innerHTML = icon;
        mainPlayButton.setAttribute(
            "aria-label",
            state.isPlaying ? "Pause" : "Play"
        );
    }
}


function updateFavoriteButtons() {
    const currentSong = getSongById(state.currentSongId);

    if (miniFavoriteButton) {
        miniFavoriteButton.innerHTML =
            favoriteIcon(Boolean(currentSong?.favorite));

        miniFavoriteButton.classList.toggle(
            "active",
            Boolean(currentSong?.favorite)
        );
    }

    if (playerFavoriteButton) {
        playerFavoriteButton.innerHTML =
            favoriteIcon(Boolean(currentSong?.favorite));

        playerFavoriteButton.classList.toggle(
            "active",
            Boolean(currentSong?.favorite)
        );
    }
}


function updatePlayerUI() {
    const song = getSongById(state.currentSongId);

    if (!song) {
        if (miniPlayer) {
            miniPlayer.classList.remove("active");
        }

        return;
    }

    if (miniPlayer) {
        miniPlayer.classList.add("active");
    }

    if (miniCover) {
        miniCover.src = song.cover;
    }

    if (miniSongTitle) {
        miniSongTitle.textContent = song.title;
    }

    if (miniSongArtist) {
        miniSongArtist.textContent =
            song.artist || "Unknown artist";
    }

    if (playerArtwork) {
        playerArtwork.src = song.cover;
    }

    if (playerSongTitle) {
        playerSongTitle.textContent = song.title;
    }

    if (playerSongArtist) {
        playerSongArtist.textContent =
            song.artist || "Unknown artist";
    }

    updatePlayButtons();
    updateFavoriteButtons();

    if (shuffleButton) {
        shuffleButton.classList.toggle(
            "active",
            state.shuffle
        );
    }

    if (repeatButton) {
        repeatButton.classList.toggle(
            "active",
            state.repeat !== "off"
        );
    }

    if (repeatOneIndicator) {
        repeatOneIndicator.hidden =
            state.repeat !== "one";
    }

    updateProgressUI();
}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgressUI() {
    if (!audio) return;

    const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : 0;

    const current = Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0;

    if (currentTimeElement) {
        currentTimeElement.textContent = formatTime(current);
    }

    if (durationElement) {
        durationElement.textContent = formatTime(duration);
    }

    if (seekBar) {
        seekBar.max = duration || 0;
        seekBar.value = current;

        const percentage = duration > 0
            ? (current / duration) * 100
            : 0;

        seekBar.style.setProperty(
            "--progress",
            `${percentage}%`
        );
    }
}


/* =========================================================
   SEEK
========================================================= */

function seekAudio() {
    if (!audio || !seekBar) return;

    const value = Number(seekBar.value);

    if (
        Number.isFinite(value) &&
        Number.isFinite(audio.duration)
    ) {
        audio.currentTime = value;
        updateProgressUI();
    }
}


/* =========================================================
   SHUFFLE
========================================================= */

function toggleShuffle() {
    state.shuffle = !state.shuffle;

    const currentId = state.currentSongId;

    rebuildQueue(currentId);

    if (currentId) {
        const index = state.queue.findIndex(
            song => song.id === currentId
        );

        if (index !== -1) {
            state.currentIndex = index;
        }
    }

    if (shuffleButton) {
        shuffleButton.classList.toggle(
            "active",
            state.shuffle
        );
    }

    showToast(
        state.shuffle
            ? "Shuffle enabled."
            : "Shuffle disabled."
    );
}


/* =========================================================
   REPEAT
========================================================= */

function toggleRepeat() {
    if (state.repeat === "off") {
        state.repeat = "all";
    } else if (state.repeat === "all") {
        state.repeat = "one";
    } else {
        state.repeat = "off";
    }

    if (repeatButton) {
        repeatButton.classList.toggle(
            "active",
            state.repeat !== "off"
        );
    }

    if (repeatOneIndicator) {
        repeatOneIndicator.hidden =
            state.repeat !== "one";
    }

    const messages = {
        off: "Repeat disabled.",
        all: "Repeat all enabled.",
        one: "Repeat one enabled."
    };

    showToast(messages[state.repeat]);
}


/* =========================================================
   VOLUME
========================================================= */

function setVolume(value) {
    const volume = Math.min(
        1,
        Math.max(0, Number(value))
    );

    audio.volume = volume;

    state.settings.volume = volume;

    if (volume > 0) {
        audio.muted = false;
    }

    if (volume === 0) {
        audio.muted = true;
    }

    if (volumeBar) {
        volumeBar.value = volume;
    }

    saveSetting("volume", volume);
}


/* =========================================================
   SAVE PLAYBACK POSITION
========================================================= */

async function saveCurrentPosition() {
    if (!state.settings.rememberPosition) return;

    const song = getSongById(state.currentSongId);

    if (!song) return;

    if (!Number.isFinite(audio.currentTime)) return;

    song.position = audio.currentTime;

    await dbPut(STORE_SONGS, song);
}


/* =========================================================
   SEARCH
========================================================= */

function openSearch() {
    if (!searchPanel) return;

    searchPanel.classList.add("active");

    if (searchInput) {
        setTimeout(() => {
            searchInput.focus();
        }, 50);
    }
}


function closeSearch() {
    if (!searchPanel) return;

    searchPanel.classList.remove("active");
}


function performSearch(value) {
    state.searchQuery = String(value || "").trim();

    renderRecentSongs();
    renderFavorites();
}


function clearSearch() {
    state.searchQuery = "";

    if (searchInput) {
        searchInput.value = "";
    }

    renderRecentSongs();
    renderFavorites();
}


/* =========================================================
   NAVIGATION
========================================================= */

function navigateTo(sectionName) {
    const sections = {
        home: document.getElementById("homeSection"),
        playlists: document.getElementById("playlistsSection"),
        favorites: document.getElementById("favoritesSection"),
        settings: document.getElementById("settingsSection")
    };

    Object.entries(sections).forEach(
        ([name, section]) => {
            if (!section) return;

            section.classList.toggle(
                "active",
                name === sectionName
            );
        }
    );

    $$(".bottom-nav-button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.nav === sectionName
        );
    });

    window.scrollTo({
        top: 0,
        behavior: state.settings.reduceMotion
            ? "auto"
            : "smooth"
    });
}


/* =========================================================
   FULL PLAYER
========================================================= */

function openFullPlayer() {
    if (!fullPlayer) return;

    fullPlayer.classList.add("active");
    document.body.classList.add("player-open");

    updatePlayerUI();
}


function closeFullPlayer() {
    if (!fullPlayer) return;

    fullPlayer.classList.remove("active");
    document.body.classList.remove("player-open");
}


/* =========================================================
   PLAYLIST MODAL
========================================================= */

function openPlaylistModal() {
    if (!playlistModal) return;

    playlistModal.classList.add("active");

    if (playlistNameInput) {
        playlistNameInput.value = "";

        setTimeout(() => {
            playlistNameInput.focus();
        }, 50);
    }
}


function closePlaylistModal() {
    if (!playlistModal) return;

    playlistModal.classList.remove("active");
}


/* =========================================================
   ADD TO PLAYLIST
========================================================= */

let pendingPlaylistSongId = null;


function openAddToPlaylistModal(songId) {
    const song = getSongById(songId);

    if (!song || !addToPlaylistModal) return;

    pendingPlaylistSongId = songId;

    if (playlistPicker) {
        playlistPicker.innerHTML = "";

        if (!state.playlists.length) {
            playlistPicker.innerHTML = `
                <div class="empty-mini">
                    <p>No playlists yet.</p>
                </div>
            `;
        } else {
            playlistPicker.innerHTML =
                state.playlists.map(playlist => {

                    const contains =
                        playlist.songIds.includes(songId);

                    return `
                        <button
                            type="button"
                            class="playlist-picker-item ${contains ? "selected" : ""}"
                            data-playlist-id="${playlist.id}">

                            <span class="playlist-picker-icon">
                                ${playlistIcon()}
                            </span>

                            <span class="playlist-picker-name">
                                ${escapeHTML(playlist.name)}
                            </span>

                            <span class="playlist-picker-count">
                                ${playlist.songIds.length}
                            </span>

                            <span class="playlist-picker-check">
                                <svg viewBox="0 0 24 24"
                                     width="18"
                                     height="18"
                                     fill="none"
                                     stroke="currentColor"
                                     stroke-width="2"
                                     stroke-linecap="round"
                                     stroke-linejoin="round">
                                    <path d="m5 12 4 4L19 6"/>
                                </svg>
                            </span>

                        </button>
                    `;
                }).join("");
        }
    }

    addToPlaylistModal.classList.add("active");
}


function closeAddToPlaylistModal() {
    if (!addToPlaylistModal) return;

    addToPlaylistModal.classList.remove("active");

    pendingPlaylistSongId = null;
}
/* =========================================================
   ZUVO — MUSIC LIBRARY
   SCRIPT.JS — PART 3A
========================================================= */


/* =========================================================
   CREATE PLAYLIST
========================================================= */

async function createPlaylist(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
        showToast("Enter a playlist name.");
        return;
    }

    const exists = state.playlists.some(
        playlist =>
            playlist.name.toLowerCase() ===
            cleanName.toLowerCase()
    );

    if (exists) {
        showToast("Playlist already exists.");
        return;
    }

    const playlist = {
        id: createId(),
        name: cleanName,
        songIds: [],
        createdAt: Date.now()
    };

    state.playlists.push(playlist);

    await dbPut(STORE_PLAYLISTS, playlist);

    closePlaylistModal();

    renderAll();

    showToast("Playlist created.");
}


/* =========================================================
   ADD / REMOVE SONG FROM PLAYLIST
========================================================= */

async function toggleSongInPlaylist(
    playlistId,
    songId
) {
    const playlist = getPlaylistById(playlistId);

    const song = getSongById(songId);

    if (!playlist || !song) return;

    const index = playlist.songIds.indexOf(songId);

    if (index === -1) {
        playlist.songIds.push(songId);

        showToast(
            `Added to ${playlist.name}.`
        );
    } else {
        playlist.songIds.splice(index, 1);

        showToast(
            `Removed from ${playlist.name}.`
        );
    }

    await dbPut(
        STORE_PLAYLISTS,
        playlist
    );

    renderPlaylists();

    if (pendingPlaylistSongId === songId) {
        openAddToPlaylistModal(songId);
    }
}


/* =========================================================
   PLAYLIST SONG QUEUE
========================================================= */

function getPlaylistSongs(playlist) {
    if (!playlist) return [];

    return playlist.songIds
        .map(id => getSongById(id))
        .filter(Boolean);
}


async function openPlaylist(playlistId) {
    const playlist =
        getPlaylistById(playlistId);

    if (!playlist) return;

    const songs =
        getPlaylistSongs(playlist);

    if (!songs.length) {
        showToast("This playlist is empty.");
        return;
    }

    state.queue = [...songs];

    state.currentIndex = 0;

    await playSongById(
        songs[0].id,
        true
    );
}


/* =========================================================
   DELETE PLAYLIST
========================================================= */

async function deletePlaylist(playlistId) {
    const playlist =
        getPlaylistById(playlistId);

    if (!playlist) return;

    const confirmed =
        window.confirm(
            `Delete playlist "${playlist.name}"?`
        );

    if (!confirmed) return;

    state.playlists =
        state.playlists.filter(
            item => item.id !== playlistId
        );

    await dbDelete(
        STORE_PLAYLISTS,
        playlistId
    );

    renderAll();

    showToast("Playlist deleted.");
}


/* =========================================================
   REMOVE SONG FROM PLAYLIST
========================================================= */

async function removeSongFromPlaylist(
    playlistId,
    songId
) {
    const playlist =
        getPlaylistById(playlistId);

    if (!playlist) return;

    playlist.songIds =
        playlist.songIds.filter(
            id => id !== songId
        );

    await dbPut(
        STORE_PLAYLISTS,
        playlist
    );

    renderPlaylists();

    showToast("Song removed from playlist.");
}


/* =========================================================
   DELETE SONG
========================================================= */

async function deleteSong(songId) {
    const song = getSongById(songId);

    if (!song) return;

    const confirmed =
        window.confirm(
            `Remove "${song.title}" from your library?`
        );

    if (!confirmed) return;

    const wasCurrent =
        state.currentSongId === songId;

    state.songs =
        state.songs.filter(
            item => item.id !== songId
        );

    for (const playlist of state.playlists) {
        if (playlist.songIds.includes(songId)) {
            playlist.songIds =
                playlist.songIds.filter(
                    id => id !== songId
                );

            await dbPut(
                STORE_PLAYLISTS,
                playlist
            );
        }
    }

    await dbDelete(
        STORE_SONGS,
        songId
    );

    if (wasCurrent) {
        audio.pause();

        state.isPlaying = false;
        state.currentSongId = null;
        state.currentIndex = -1;
        state.queue = [];

        revokeCurrentObjectUrl();

        audio.removeAttribute("src");
        audio.load();
    } else {
        state.queue =
            state.queue.filter(
                item => item.id !== songId
            );

        if (
            state.currentIndex >=
            state.queue.length
        ) {
            state.currentIndex =
                state.queue.length - 1;
        }
    }

    renderAll();

    showToast("Song removed.");
}


/* =========================================================
   SONG MORE MENU
========================================================= */

function handleSongMore(songId) {
    const song = getSongById(songId);

    if (!song) return;

    const choice = window.prompt(
        `Options for "${song.title}"\n\n` +
        `1 - Add to playlist\n` +
        `2 - Delete song\n\n` +
        `Enter 1 or 2`
    );

    if (choice === "1") {
        openAddToPlaylistModal(songId);
    }

    if (choice === "2") {
        deleteSong(songId);
    }
}


/* =========================================================
   PLAYLIST MORE MENU
========================================================= */

function handlePlaylistMore(playlistId) {
    const playlist =
        getPlaylistById(playlistId);

    if (!playlist) return;

    const choice = window.prompt(
        `Options for "${playlist.name}"\n\n` +
        `1 - Play playlist\n` +
        `2 - Delete playlist\n\n` +
        `Enter 1 or 2`
    );

    if (choice === "1") {
        openPlaylist(playlistId);
    }

    if (choice === "2") {
        deletePlaylist(playlistId);
    }
}


/* =========================================================
   STORAGE INFO
========================================================= */

async function updateStorageInfo() {
    let usedBytes = 0;

    state.songs.forEach(song => {
        if (Number.isFinite(song.size)) {
            usedBytes += song.size;
        }
    });

    if (storageUsed) {
        storageUsed.textContent =
            formatBytes(usedBytes);
    }

    if (storageSongCount) {
        storageSongCount.textContent =
            state.songs.length;
    }

    if (
        storageBarFill &&
        navigator.storage &&
        navigator.storage.estimate
    ) {
        try {
            const estimate =
                await navigator.storage.estimate();

            const quota =
                Number(estimate.quota) || 0;

            if (quota > 0) {
                const percentage =
                    Math.min(
                        100,
                        (usedBytes / quota) * 100
                    );

                storageBarFill.style.width =
                    `${percentage}%`;
            }
        } catch (_) {
            storageBarFill.style.width =
                usedBytes > 0 ? "5%" : "0%";
        }
    }
}


/* =========================================================
   CLEAR LIBRARY
========================================================= */

async function clearLibrary() {
    if (!state.songs.length) {
        showToast("Library is already empty.");
        return;
    }

    if (confirmModal) {
        confirmModal.classList.add("active");
        return;
    }

    const confirmed =
        window.confirm(
            "Clear your entire music library?"
        );

    if (confirmed) {
        await performClearLibrary();
    }
}


async function performClearLibrary() {
    audio.pause();

    state.isPlaying = false;
    state.currentSongId = null;
    state.currentIndex = -1;
    state.queue = [];

    revokeCurrentObjectUrl();

    audio.removeAttribute("src");
    audio.load();

    await dbClear(STORE_SONGS);

    state.songs = [];

    for (const playlist of state.playlists) {
        playlist.songIds = [];

        await dbPut(
            STORE_PLAYLISTS,
            playlist
        );
    }

    if (confirmModal) {
        confirmModal.classList.remove("active");
    }

    renderAll();

    await updateStorageInfo();

    showToast("Library cleared.");
}


/* =========================================================
   CONFIRM MODAL
========================================================= */

function closeConfirmModal() {
    if (!confirmModal) return;

    confirmModal.classList.remove("active");
}


/* =========================================================
   SETTINGS TOGGLE
========================================================= */

function updateSettingUI() {
    if (autoplaySetting) {
        autoplaySetting.classList.toggle(
            "active",
            state.settings.autoplay
        );

        autoplaySetting.setAttribute(
            "aria-pressed",
            String(state.settings.autoplay)
        );
    }

    if (rememberPositionSetting) {
        rememberPositionSetting.classList.toggle(
            "active",
            state.settings.rememberPosition
        );

        rememberPositionSetting.setAttribute(
            "aria-pressed",
            String(
                state.settings.rememberPosition
            )
        );
    }

    if (reduceMotionSetting) {
        reduceMotionSetting.classList.toggle(
            "active",
            state.settings.reduceMotion
        );

        reduceMotionSetting.setAttribute(
            "aria-pressed",
            String(
                state.settings.reduceMotion
            )
        );
    }
}


async function toggleAutoplaySetting() {
    state.settings.autoplay =
        !state.settings.autoplay;

    await saveSetting(
        "autoplay",
        state.settings.autoplay
    );

    updateSettingUI();
}


async function toggleRememberPositionSetting() {
    state.settings.rememberPosition =
        !state.settings.rememberPosition;

    await saveSetting(
        "rememberPosition",
        state.settings.rememberPosition
    );

    updateSettingUI();
}


async function toggleReduceMotionSetting() {
    state.settings.reduceMotion =
        !state.settings.reduceMotion;

    await saveSetting(
        "reduceMotion",
        state.settings.reduceMotion
    );

    applySettings();
    updateSettingUI();
}


/* =========================================================
   MEDIA SESSION
========================================================= */

function setupMediaSession() {
    if (!("mediaSession" in navigator)) {
        return;
    }

    try {
        navigator.mediaSession.setActionHandler(
            "play",
            () => togglePlay()
        );

        navigator.mediaSession.setActionHandler(
            "pause",
            () => togglePlay()
        );

        navigator.mediaSession.setActionHandler(
            "previoustrack",
            () => previousSong()
        );

        navigator.mediaSession.setActionHandler(
            "nexttrack",
            () => nextSong()
        );

        navigator.mediaSession.setActionHandler(
            "seekbackward",
            details => {
                const offset =
                    details.seekOffset || 10;

                audio.currentTime =
                    Math.max(
                        0,
                        audio.currentTime - offset
                    );
            }
        );

        navigator.mediaSession.setActionHandler(
            "seekforward",
            details => {
                const offset =
                    details.seekOffset || 10;

                audio.currentTime =
                    Math.min(
                        audio.duration || Infinity,
                        audio.currentTime + offset
                    );
            }
        );
    } catch (_) {}
}
/* =========================================================
   ZUVO — MUSIC LIBRARY
   SCRIPT.JS — PART 3B
========================================================= */


/* =========================================================
   EVENT DELEGATION — SONG LISTS
========================================================= */

function handleSongListClick(event) {
    const actionElement =
        event.target.closest("[data-action]");

    if (!actionElement) return;

    const action =
        actionElement.dataset.action;

    const songId =
        actionElement.dataset.songId;

    if (!songId) return;

    if (action === "play") {
        playSongById(songId, true);
        return;
    }

    if (action === "favorite") {
        toggleFavorite(songId);
        return;
    }

    if (action === "more") {
        handleSongMore(songId);
        return;
    }
}


/* =========================================================
   PLAYLIST CLICK HANDLER
========================================================= */

function handlePlaylistClick(event) {
    const actionElement =
        event.target.closest("[data-action]");

    if (!actionElement) return;

    const action =
        actionElement.dataset.action;

    const playlistId =
        actionElement.dataset.playlistId;

    if (!playlistId) return;

    if (action === "open-playlist") {
        openPlaylist(playlistId);
        return;
    }

    if (action === "playlist-more") {
        handlePlaylistMore(playlistId);
        return;
    }
}


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

function handleKeyboard(event) {
    const target = event.target;

    const isTyping =
        target &&
        (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
        );

    if (isTyping) return;

    if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
    }

    if (event.code === "ArrowRight") {
        if (audio.duration) {
            audio.currentTime =
                Math.min(
                    audio.duration,
                    audio.currentTime + 5
                );
        }
    }

    if (event.code === "ArrowLeft") {
        audio.currentTime =
            Math.max(
                0,
                audio.currentTime - 5
            );
    }

    if (event.code === "ArrowUp") {
        event.preventDefault();

        setVolume(
            Math.min(
                1,
                audio.volume + 0.05
            )
        );
    }

    if (event.code === "ArrowDown") {
        event.preventDefault();

        setVolume(
            Math.max(
                0,
                audio.volume - 0.05
            )
        );
    }
}


/* =========================================================
   FILE IMPORT
========================================================= */

function handleFileInput(event) {
    const files =
        Array.from(event.target.files || []);

    if (!files.length) return;

    importFiles(files)
        .then(() => {
            renderAll();
            updateStorageInfo();
        })
        .catch(error => {
            console.error(
                "Import error:",
                error
            );

            showToast(
                "Could not import the selected files."
            );
        })
        .finally(() => {
            fileInput.value = "";
        });
}


/* =========================================================
   AUDIO EVENTS
========================================================= */

function setupAudioEvents() {
    audio.addEventListener(
        "play",
        () => {
            state.isPlaying = true;

            updatePlayButtons();

            if ("mediaSession" in navigator) {
                try {
                    navigator.mediaSession.playbackState =
                        "playing";
                } catch (_) {}
            }
        }
    );


    audio.addEventListener(
        "pause",
        () => {
            state.isPlaying = false;

            updatePlayButtons();

            saveCurrentPosition();

            if ("mediaSession" in navigator) {
                try {
                    navigator.mediaSession.playbackState =
                        "paused";
                } catch (_) {}
            }
        }
    );


    audio.addEventListener(
        "timeupdate",
        () => {
            updateProgressUI();
        }
    );


    audio.addEventListener(
        "loadedmetadata",
        () => {
            updateProgressUI();
        }
    );


    audio.addEventListener(
        "durationchange",
        () => {
            updateProgressUI();
        }
    );


    audio.addEventListener(
        "ended",
        () => {
            handleAudioEnded();
        }
    );


    audio.addEventListener(
        "error",
        () => {
            state.isPlaying = false;

            updatePlayButtons();

            showToast(
                "Unable to play this audio file."
            );
        }
    );
}


/* =========================================================
   MAIN EVENT SETUP
========================================================= */

function setupEvents() {

    /* ---------- Add Music ---------- */

    if (fileInput) {
        fileInput.addEventListener(
            "change",
            handleFileInput
        );
    }


    /* ---------- Search ---------- */

    const searchButton =
        document.querySelector(
            '[data-action="open-search"]'
        );

    if (searchButton) {
        searchButton.addEventListener(
            "click",
            openSearch
        );
    }

    if (searchInput) {
        searchInput.addEventListener(
            "input",
            event => {
                performSearch(
                    event.target.value
                );
            }
        );

        searchInput.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    clearSearch();
                    closeSearch();
                }
            }
        );
    }

    if (clearSearchButton) {
        clearSearchButton.addEventListener(
            "click",
            clearSearch
        );
    }


    /* ---------- Navigation ---------- */

    $$(".bottom-navigation [data-nav]").forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    navigateTo(
                        button.dataset.nav
                    );
                }
            );
        }
    );


    /* ---------- Recent / Favorite Lists ---------- */

    if (recentSongsList) {
        recentSongsList.addEventListener(
            "click",
            handleSongListClick
        );
    }

    if (favoriteSongsList) {
        favoriteSongsList.addEventListener(
            "click",
            handleSongListClick
        );
    }


    /* ---------- Playlists ---------- */

    if (playlistGrid) {
        playlistGrid.addEventListener(
            "click",
            handlePlaylistClick
        );
    }


    /* ---------- Create Playlist ---------- */

    if (createPlaylistButton) {
        createPlaylistButton.addEventListener(
            "click",
            openPlaylistModal
        );
    }

    if (playlistForm) {
        playlistForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                createPlaylist(
                    playlistNameInput
                        ? playlistNameInput.value
                        : ""
                );
            }
        );
    }


    /* ---------- Add To Playlist ---------- */

    if (playlistPicker) {
        playlistPicker.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-playlist-id]"
                    );

                if (!button) return;

                if (
                    pendingPlaylistSongId
                ) {
                    toggleSongInPlaylist(
                        button.dataset.playlistId,
                        pendingPlaylistSongId
                    );
                }
            }
        );
    }


    /* ---------- Mini Player ---------- */

    if (miniPlayButton) {
        miniPlayButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();
                togglePlay();
            }
        );
    }

    if (miniFavoriteButton) {
        miniFavoriteButton.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (state.currentSongId) {
                    toggleFavorite(
                        state.currentSongId
                    );
                }
            }
        );
    }

    if (openFullPlayerButton) {
        openFullPlayerButton.addEventListener(
            "click",
            openFullPlayer
        );
    }


    /* ---------- Full Player ---------- */

    if (closeFullPlayerButton) {
        closeFullPlayerButton.addEventListener(
            "click",
            closeFullPlayer
        );
    }

    if (mainPlayButton) {
        mainPlayButton.addEventListener(
            "click",
            togglePlay
        );
    }

    if (previousButton) {
        previousButton.addEventListener(
            "click",
            previousSong
        );
    }

    if (nextButton) {
        nextButton.addEventListener(
            "click",
            nextSong
        );
    }

    if (shuffleButton) {
        shuffleButton.addEventListener(
            "click",
            toggleShuffle
        );
    }

    if (repeatButton) {
        repeatButton.addEventListener(
            "click",
            toggleRepeat
        );
    }

    if (seekBar) {
        seekBar.addEventListener(
            "input",
            seekAudio
        );
    }

    if (volumeBar) {
        volumeBar.addEventListener(
            "input",
            event => {
                setVolume(
                    event.target.value
                );
            }
        );
    }

    if (playerFavoriteButton) {
        playerFavoriteButton.addEventListener(
            "click",
            () => {
                if (state.currentSongId) {
                    toggleFavorite(
                        state.currentSongId
                    );
                }
            }
        );
    }


    /* ---------- More Button ---------- */

    if (playerMoreButton) {
        playerMoreButton.addEventListener(
            "click",
            () => {
                if (!state.currentSongId) return;

                handleSongMore(
                    state.currentSongId
                );
            }
        );
    }


    /* ---------- Settings ---------- */

    if (autoplaySetting) {
        autoplaySetting.addEventListener(
            "click",
            toggleAutoplaySetting
        );
    }

    if (rememberPositionSetting) {
        rememberPositionSetting.addEventListener(
            "click",
            toggleRememberPositionSetting
        );
    }

    if (reduceMotionSetting) {
        reduceMotionSetting.addEventListener(
            "click",
            toggleReduceMotionSetting
        );
    }


    /* ---------- Clear Library ---------- */

    if (clearLibraryButton) {
        clearLibraryButton.addEventListener(
            "click",
            clearLibrary
        );
    }

    if (confirmClearButton) {
        confirmClearButton.addEventListener(
            "click",
            performClearLibrary
        );
    }


    /* ---------- Modal Close Buttons ---------- */

    $$("[data-close-modal]").forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    const modal =
                        button.closest(".modal");

                    if (modal) {
                        modal.classList.remove(
                            "active"
                        );
                    }
                }
            );
        }
    );


    /* ---------- Modal Background ---------- */

    $$(".modal").forEach(modal => {
        modal.addEventListener(
            "click",
            event => {
                if (
                    event.target === modal
                ) {
                    modal.classList.remove(
                        "active"
                    );
                }
            }
        );
    });


    /* ---------- Keyboard ---------- */

    document.addEventListener(
        "keydown",
        handleKeyboard
    );


    /* ---------- Audio ---------- */

    setupAudioEvents();


    /* ---------- Media Session ---------- */

    setupMediaSession();
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initZuvo() {

    try {
        if (loadingScreen) {
            loadingScreen.classList.add(
                "active"
            );
        }

        await openDatabase();

        await loadData();

        applySettings();

        updateSettingUI();

        if (volumeBar) {
            volumeBar.value =
                state.settings.volume;
        }

        audio.volume =
            state.settings.volume;

        rebuildQueue();

        renderAll();

        await updateStorageInfo();

        setupEvents();

        navigateTo("home");

        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.remove(
                    "active"
                );
            }, 250);
        }

    } catch (error) {

        console.error(
            "Zuvo initialization failed:",
            error
        );

        if (loadingScreen) {
            loadingScreen.classList.remove(
                "active"
            );
        }

        showToast(
            "Zuvo could not start correctly."
        );
    }
}


/* =========================================================
   PAGE VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {
        if (
            document.visibilityState ===
            "hidden"
        ) {
            saveCurrentPosition();
        }
    }
);


/* =========================================================
   BEFORE PAGE CLOSE
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {
        saveCurrentPosition();

        revokeCurrentObjectUrl();
    }
);


/* =========================================================
   START ZUVO
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initZuvo,
        { once: true }
    );

} else {

    initZuvo();

}