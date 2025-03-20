// mediaplayer.js

let selectedProvider = 'vidlink';
let isFetching = false;
let currentRequestId = null;
let debounceTimeout = null;

async function getApiKey() {
    try {
        const response = await fetch('apis/config.json');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json().then(config => config.apiKey);
    } catch (error) {
        console.error('Failed to fetch API key:', error);
        return null;
    }
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch data from ${url}:`, error);
        throw error;
    }
}

function promptUserForLanguage(languages) {
    return new Promise((resolve) => {
        // Create modal elements
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content bg-gray-900 rounded-lg p-6';

        const modalTitle = document.createElement('h2');
        modalTitle.className = 'text-xl font-bold mb-4 text-white';
        modalTitle.innerText = 'Select a Language';

        const languageList = document.createElement('ul');
        languageList.className = 'language-list';

        languages.forEach(language => {
            const listItem = document.createElement('li');
            listItem.className = 'language-item cursor-pointer hover:bg-gray-700 p-2 rounded text-white';
            listItem.innerText = language;
            listItem.addEventListener('click', () => {
                // Remove modal
                document.body.removeChild(modalOverlay);
                resolve(language);
            });
            languageList.appendChild(listItem);
        });

        // Append elements
        modalContent.appendChild(modalTitle);
        modalContent.appendChild(languageList);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    });
}

async function getMovieEmbedUrl(mediaId, provider, apiKey, language = null) {
    const primaryColor = '#FFFFFF';
    const secondaryColor = '#FFFFFF';
    const iconColor = '#FFFFFF';

    switch (provider) {
        case 'vidsrc':
            return `https://vidsrc.cc/v2/embed/movie/${mediaId}?autoPlay=true`;
        case 'vidsrc2':
            return `https://vidsrc2.to/embed/movie/${mediaId}`;
        case 'filmxy':
            try {
                if (!language) {
                    throw new Error('Language is required for filmxy provider');
                }

                const languageCode = language.toLowerCase();
                const url = `https://cinescrape.com/global/${languageCode}/${mediaId}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                const m3u8Link = data.streamData.data.link;
                if (!m3u8Link) throw new Error('No m3u8 link found');
                return m3u8Link;
            } catch (error) {
                console.error('Error fetching video from filmxy:', error);
                throw error;
            }

        case 'vidsrcxyz':
            return `https://vidsrc.xyz/embed/movie/${mediaId}`;
        case 'flicky':
                return `https://flicky.host/embed/movie/?id=${mediaId} `;
        case 'embedsoap':
            return `https://www.embedsoap.com/embed/movie/?id=${mediaId}`;
        case 'autoembed':
            return `https://player.autoembed.cc/embed/movie/${mediaId}`;
        case 'smashystream':
            return `https://player.smashy.stream/movie/${mediaId}`;
        case 'anime':
            return `https://anime.autoembed.cc/embed/${mediaId}-episode-1`;
        case '2animesub':
            return `https://2anime.xyz/embed/${mediaId}-episode-1`;
        case '2embed':
            return `https://www.2embed.cc/embed/${mediaId}`;
        case 'nontonGo':
            return `https://www.NontonGo.win/embed/movie/${mediaId}`;
        case 'AdminHiHi':
            const movieSlug = mediaId.replace(/\s+/g, '-');
            return `https://embed.anicdn.top/v/${movieSlug}-dub/1.html`;
        case 'vidlink':
            return `https://vidlink.pro/movie/${mediaId}?primaryColor=${primaryColor}&secondaryColor=${secondaryColor}&iconColor=${iconColor}&autoplay=false`;
        case 'vidlinkdub':
            return `https://vidlink.pro/movie/${mediaId}?player=jw&multiLang=true&primaryColor=${primaryColor}&secondaryColor=${secondaryColor}&iconColor=${iconColor}`;
        case 'vidsrcnl':
            return `https://player.vidsrc.nl/embed/movie/${mediaId}`;
        case 'vidsrc.rip':
            return `https://vidsrc.rip/embed/movie/${mediaId}`;
        case 'vidbinge':
            return `https://vidbinge.dev/embed/movie/${mediaId}`;
        case 'moviesapi':
            return `https://moviesapi.club/movie/${mediaId}`;
        case 'moviee':
            return `https://moviee.tv/embed/movie/${mediaId}`;
        case 'multiembed':
            return `https://multiembed.mov/?video_id=${mediaId}&tmdb=1`;
        case 'embedsu':
            return `https://embed.su/embed/movie/${mediaId}`;
        case 'multiembedvip':
            return `https://multiembed.mov/directstream.php?video_id=${mediaId}&tmdb=1`;
        case 'vidsrcicu':
            return `https://vidsrc.icu/embed/movie/${mediaId}`;
        case 'cinescrape':
            try {
                const randomDelay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
                await new Promise(resolve => setTimeout(resolve, randomDelay));

                const response = await fetch(`https://scraper.cinescrape.com/movie/${mediaId}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const responseData = await response.json();

                const requestId = responseData.requestId;
                const data = responseData.data;

                // Save requestId for later use
                currentRequestId = requestId;

                // Find the source with 2160p or 1080p quality
                const movieSource = data.find(source => source.quality === '2160p' || source.quality === '1080p');

                if (movieSource && movieSource.metadata && movieSource.metadata.baseUrl) {
                    let streamUrl = movieSource.metadata.baseUrl + '.mpd';

                    // Ensure HTTPS
                    const urlObj = new URL(streamUrl);
                    urlObj.protocol = 'https:';
                    streamUrl = urlObj.toString();

                    return streamUrl;
                } else {
                    throw new Error('No suitable 2160p or 1080p stream link found');
                }
            } catch (error) {
                console.error('Error fetching video from Cinescrape:', error);
                throw error;
            }

            case 'trailer':
                try {
                    const trailerUrl = await fetchTrailer(mediaId, 'movie', apiKey);
                    if (!trailerUrl) throw new Error('Trailer not found');
                    return trailerUrl;
                } catch (error) {
                    console.error('Error fetching trailer for movie:', error);
                    throw error;
                }
    
            default:
                throw new Error('Provider not recognized.');
        }
    }

    async function getTvEmbedUrl(mediaId, seasonId, episodeId, provider, apiKey) {
        const primaryColor = '#FFFFFF';
        const secondaryColor = '#FFFFFF';
        const iconColor = '#ffffff';
    
        switch (provider) {
            case 'vidsrc':
                return `https://vidsrc.cc/v2/embed/tv/${mediaId}/${seasonId}/${episodeId}?autoPlay=true&autoNext=true`;
            case 'vidsrc':
                return `https://vidsrc.cc/v2/embed/tv/${mediaId}/${seasonId}/${episodeId}?autoPlay=true&autoNext=true`;  
            case 'vidsrcpro':
                return `https://vidsrc.pro/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'flicky':
                return `https://flicky.host/embed/tv/?id=${mediaId}/${seasonId}/${episodeId} `;
            case 'flickyanime':
                    return `https://flicky.host/embed/anime/?id=${mediaId}/${seasonId}/${episodeId} `;
            case 'vidsrcxyz':
                return `https://vidsrc.xyz/embed/tv/${mediaId}?season=${seasonId}&episode=${episodeId}`;
            case 'embedsoap':
                return `https://www.embedsoap.com/embed/tv/?id=${mediaId}&s=${seasonId}&e=${episodeId}`;
            case 'autoembed':
                return `https://player.autoembed.cc/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'smashystream':
                return `https://player.smashy.stream/tv/${mediaId}?s=${seasonId}&e=${episodeId}`;
            case 'anime':
                return `https://anime.autoembed.cc/embed/${media.name.replace(/\s+/g, '-').toLowerCase()}-episode-${episodeId}`;
            case 'nontonGo':
                return `https://www.NontonGo.win/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'nontonGoAlt':
                return `https://www.NontonGo.win/embed/tv/?id=${mediaId}&s=${seasonId}&e=${episodeId}`;
            case '2animesub':
                return `https://2anime.xyz/embed/${media.name.replace(/\s+/g, '-').toLowerCase()}-episode-${episodeId}`;
            case '2embed':
                return `https://www.2embed.skin/embedtv/${mediaId}&s=${seasonId}&e=${episodeId}`;
            case 'AdminHiHi':
                const tvSlug = media.name.replace(/\s+/g, '-');
                return `https://embed.anicdn.top/v/${tvSlug}-dub/${episodeId}.html`;
            case 'moviesapi':
                return `https://moviesapi.club/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'vidlink':
                return `https://vidlink.pro/tv/${mediaId}/${seasonId}/${episodeId}?primaryColor=${primaryColor}&secondaryColor=${secondaryColor}&iconColor=${iconColor}&nextbutton=true&autoplay=false`;
            case 'vidlinkdub':
                return `https://vidlink.pro/tv/${mediaId}/${seasonId}/${episodeId}?player=jw&multiLang=true`;
            case 'vidsrcnl':
                return `https://player.vidsrc.nl/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'vidsrc.rip':
                return `https://vidsrc.rip/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'vidbinge':
                return `https://vidbinge.dev/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'moviee':
                return `https://moviee.tv/embed/tv/${mediaId}?seasion=${seasonId}&episode=${episodeId}`;
            case 'multiembed':
                return `https://multiembed.mov/?video_id=${mediaId}&tmdb=1&s=${seasonId}&e=${episodeId}`;
            case 'multiembedvip':
                return `https://multiembed.mov/directstream.php?video_id=${mediaId}&tmdb=1&s=${seasonId}&e=${episodeId}`;
            case 'vidsrcicu':
                return `https://vidsrc.icu/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'embedsu':
                return `https://embed.su/embed/tv/${mediaId}/${seasonId}/${episodeId}`;
            case 'cinescrape':
                try {
                    const randomDelay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
                    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
                    const response = await fetch(`https://scraper.cinescrape.com/tvshow/${mediaId}/${seasonId}/${episodeId}`);
                    if (!response.ok) throw new Error('Network response was not ok');
                    const data = await response.json();
    
                    if (!data || data.length === 0) throw new Error('No video data available');
    
                    // Find the best available quality
                    const qualityOrder = ['2160p', '1080p', '720p', '360p'];
                    let selectedSource = null;
    
                    for (let quality of qualityOrder) {
                        selectedSource = data.find(source => source.quality === quality);
                        if (selectedSource) break;
                    }
    
                    if (selectedSource && selectedSource.metadata && selectedSource.metadata.baseUrl) {
                        let streamUrl = selectedSource.metadata.baseUrl + '.mpd';
    
                        // Ensure HTTPS
                        const urlObj = new URL(streamUrl);
                        urlObj.protocol = 'https:';
                        streamUrl = urlObj.toString();
    
                        return streamUrl;
                    } else {
                        throw new Error('No suitable video source found');
                    }
                } catch (error) {
                    console.error('Error fetching video from Cinescrape:', error);
                    throw error;
                }
            case 'trailer':
                try {
                    const trailerUrl = await fetchTrailer(mediaId, 'tv', apiKey);
                    if (!trailerUrl) throw new Error('Trailer not found');
                    return trailerUrl;
                } catch (error) {
                    console.error('Error fetching trailer for TV show:', error);
                    throw error;
                }
    
            default:
                throw new Error('Provider not recognized.');
        }
    }    


function showLoadingScreen(time) {
    return;
}

function hideLoadingScreen() {
    return;
}

function enableOrientationLock() {
    return;
}

function disableOrientationLock() {
    return;
}
/*
document.addEventListener('DOMContentLoaded', () => {
    const orientationLockToggle = document.getElementById('orientationLockToggle');
    const orientationLockEnabled = JSON.parse(localStorage.getItem('orientationLock')) || false;
    orientationLockToggle.checked = orientationLockEnabled;

    if (orientationLockEnabled) {
        enableOrientationLock();
    }

    orientationLockToggle.addEventListener('change', (event) => {
        const isEnabled = event.target.checked;
        localStorage.setItem('orientationLock', isEnabled);

        if (isEnabled) {
            enableOrientationLock();
        } else {
            disableOrientationLock();
        }
    });
});
*/
function attemptFullscreenAndLockOrientation(element) {
    return;
}

async function fetchMediaData(mediaId, mediaType, apiKey) {
    return fetchJson(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${apiKey}`);
}

async function fetchCastData(mediaId, mediaType, apiKey) {
    return fetchJson(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/credits?api_key=${apiKey}`);
}

async function fetchTrailer(mediaId, mediaType, apiKey) {
    const data = await fetchJson(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/videos?api_key=${apiKey}`);
    const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;
}

// Debounce function
function debounce(func, wait) {
    return function (...args) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function releaseResources() {
    if (currentRequestId) {
        try {
            const response = await fetch('https://scraper.cinescrape.com/release', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requestId: currentRequestId }),
            });
            if (!response.ok) {
                console.error('Failed to release resources:', response.statusText);
            } else {
                console.log('Resources released successfully');
            }
        } catch (error) {
            console.error('Error releasing resources:', error);
        }
        currentRequestId = null;
    }
}

async function displaySelectedMedia(media, mediaType) {
    const $selectedMovie = $('#selectedMovie');
    const $mediaSection = $('#selectedMediaSection');
    const apiKey = await getApiKey();

    if (!media || !media.id) {
        $mediaSection.addClass('hidden');
        return;
    } else {
        $mediaSection.removeClass('hidden');
        document.getElementById('selectedMediaSection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    if (!apiKey) return console.error('API key is not available.');

    try {
        const [mediaData, castData] = await Promise.all([
            fetchMediaData(media.id, mediaType, apiKey),
            fetchCastData(media.id, mediaType, apiKey)
        ]);

        const genres = mediaData.genres?.map(genre => genre.name).join(', ') || 'Unknown Genre';
        const language = mediaData.original_language?.toUpperCase() || 'Unknown';
        const releaseDate = media.release_date || media.first_air_date || 'Unknown Release Date';
        const productionCompanies = mediaData.production_companies?.map(company => company.name).join(', ') || 'Unknown Production Companies';
        const budget = mediaType === 'movie' ? (mediaData.budget ? `$${mediaData.budget.toLocaleString()}` : 'Unknown') : 'N/A';
        const revenue = mediaType === 'movie' ? (mediaData.revenue ? `$${mediaData.revenue.toLocaleString()}` : 'Unknown') : 'N/A';

        const ratings = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-star text-yellow-400"></i>
                <span class="text-lg font-semibold text-white">${(mediaData.vote_average || 0).toFixed(1)}</span>
                <span class="text-sm text-gray-400">/10</span>
            </div>`;
        const popularity = `
                <div class="flex items-center space-x-2">
                    <i class="fas fa-fire text-orange-500"></i>
                    <span class="text-lg font-semibold text-white">${(mediaData.popularity || 0).toFixed(1)}</span>
                    <span class="text-sm text-gray-400">Popularity</span>
                </div>`;

        const castList = castData.cast.slice(0, 5).map(actor => `
                <div class="flex-shrink-0 w-28 mx-2 text-center">
                    <div class="w-28 h-28 mx-auto mb-2 rounded-full overflow-hidden border-2 border-purple-500 shadow-lg">
                        <img src="${actor.profile_path ? 'https://image.tmdb.org/t/p/w500' + actor.profile_path : 'path/to/placeholder-image.jpg'}" alt="${actor.name}" 
                             class="w-full h-full object-cover" onerror="this.src='path/to/placeholder-image.jpg';">
                    </div>
                    <p class="text-white font-semibold text-sm truncate">${actor.name}</p>
                    <p class="text-gray-400 text-xs truncate">${actor.character}</p>
                </div>
            `).join('');

        let runtime;

        if (mediaType === 'movie') {
            runtime = `${mediaData.runtime || 'N/A'} min`;
        } else if (mediaType === 'tv') {
            runtime = `${Math.round(mediaData.episode_run_time.reduce((a, b) => a + b, 0) / mediaData.episode_run_time.length)} min per episode`;
        }

        const template = await fetch('media/mediaTemplate.html').then(response => response.text());

        $selectedMovie.html(template
            .replace(/{{poster_path}}/g, `${media.poster_path}`)
            .replace(/{{title_or_name}}/g, media.title || media.name)
            .replace(/{{release_date_or_first_air_date}}/g, releaseDate)
            .replace(/{{overview}}/g, media.overview || 'No overview available.')
            .replace(/{{type}}/g, mediaType === 'movie' ? 'Movie' : 'TV Show')
            .replace(/{{language}}/g, `${language}`)
            .replace(/{{genres}}/g, `${genres}`)
            .replace(/{{runtime}}/g, `${runtime}`)
            .replace(/{{budget}}/g, `${budget}`)
            .replace(/{{revenue}}/g, `${revenue}`)
            .replace(/{{ratings}}/g, ratings)
            .replace(/{{popularity}}/g, popularity)
            .replace(/{{cast_list}}/g, castList)
            .replace(/{{production_companies}}/g, `${productionCompanies}`)
        );

        const $videoPlayer = $('#videoPlayer');
        const $movieInfo = $('#movieInfo');
        const $playButton = $('#playButton');
        const $closePlayerButton = $('#closePlayerButton');
        const $languageSelect = $('#languageSelect');
        const $providerSelect = $('#providerSelect');
        const $selectEpisodeButton = $('#selectEpisodeButton');
        const $episodeModal = $('#episodeModal');

        let selectedEpisode = null;
        let selectedSeason = null;
        let episodesData = [];
        let seasonsData = [];

        if (mediaType === 'tv') {
            seasonsData = mediaData.seasons.filter(season => season.season_number !== 0);
        }

        window.addEventListener('message', function (event) {
            if (event.origin !== 'https://vidlink.pro') {
                return;
            }

            if (event.data && event.data.type === 'MEDIA_DATA') {
                const mediaData = event.data.data;
                localStorage.setItem('vidLinkProgress', JSON.stringify(mediaData));
            }
        });

        async function updateVideo() {
            if (isFetching) {
                console.log('A video update is already in progress.');
                return;
            }
            isFetching = true;
            $playButton.prop('disabled', true);

            try {
                const provider = $providerSelect.length ? $providerSelect.val() : selectedProvider;
                const apiKey = await getApiKey();
                if (!apiKey) {
                    console.error('API key is not available.');
                    return;
                }

                let endpoint;

                if (provider === 'trailer') {
                    if (mediaType === 'movie') {
                        endpoint = await getMovieEmbedUrl(media.id, provider, apiKey);
                    } else if (mediaType === 'tv') {
                        endpoint = await getTvEmbedUrl(media.id, selectedSeason, selectedEpisode, provider, apiKey);
                    }
                } else if (provider === 'filmxy' && mediaType === 'movie') {
                    const languages = ['Hindi', 'English', 'Bengali', 'Tamil', 'Telugu'];
                    const selectedLanguage = await promptUserForLanguage(languages);
                    if (!selectedLanguage) {
                        alert('No language selected.');
                        return;
                    }
                    endpoint = await getMovieEmbedUrl(media.id, provider, apiKey, selectedLanguage);
                } else if (provider === 'cinescrape') {
                    if (mediaType === 'movie') {
                        showLoadingScreen(2500);
                        endpoint = await getMovieEmbedUrl(media.id, provider, apiKey);
                    } else if (mediaType === 'tv') {
                        showLoadingScreen(6000);
                        if (!selectedSeason || !selectedEpisode) {
                            alert('Please select a season and an episode.');
                            hideLoadingScreen();
                            return;
                        }
                        endpoint = await getTvEmbedUrl(media.id, selectedSeason, selectedEpisode, provider, apiKey);
                    }
                    const iframeHtml = `
                        <iframe 
                            src="/media/betaplayer.html?videoUrl=${encodeURIComponent(endpoint)}"
                            id="betaplayerIframe"
                            class="video-iframe" 
                            allowfullscreen 
                            loading="lazy"
                            style="width: 100%; height: 600px;">
                        </iframe>
                    `;
                    $videoPlayer.html(iframeHtml).removeClass('hidden');
                    $movieInfo.children().not($videoPlayer).addClass('hidden');
                    $closePlayerButton.removeClass('hidden');

                    const iframe = document.getElementById('betaplayerIframe');
                    iframe.onload = function () {
                        hideLoadingScreen();
                        releaseResources();
                    };

                    attemptFullscreenAndLockOrientation(iframe);

                    return;
                } else {
                    if (mediaType === 'movie') {
                        endpoint = await getMovieEmbedUrl(media.id, provider, apiKey);
                    } else if (mediaType === 'tv') {
                        if (!selectedSeason || !selectedEpisode) {
                            alert('Please select a season and an episode.');
                            return;
                        }
                        endpoint = await getTvEmbedUrl(media.id, selectedSeason, selectedEpisode, provider, apiKey);
                    }
                }

                if (provider === 'trailer') {
                    const iframeHtml = `
                        <iframe src="${endpoint}" id="videoIframe" class="video-iframe" allowfullscreen style="width: 100%; height: 600px;" loading="lazy"></iframe>
                    `;
                    $videoPlayer.html(iframeHtml).removeClass('hidden');
                    $movieInfo.children().not($videoPlayer).addClass('hidden');
                    $closePlayerButton.removeClass('hidden');

                    attemptFullscreenAndLockOrientation(document.getElementById('videoIframe'));
                } else if (provider === 'filmxy') {
                    const playerHtml = `
                        <video id="hlsVideoPlayer" loading="lazy" crossorigin="anonymous" preload="metadata" controls style="width: 100%; height: auto;" class="video-element">
                        </video>
                    `;
                    $videoPlayer.html(playerHtml).removeClass('hidden');
                    $movieInfo.children().not($videoPlayer).addClass('hidden');
                    $closePlayerButton.removeClass('hidden');

                    const videoElement = document.getElementById('hlsVideoPlayer');
                    if ('IntersectionObserver' in window && Hls.isSupported()) {
                        const observer = new IntersectionObserver((entries, observer) => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    const hls = new Hls({ lowLatencyMode: true, backBufferLength: 90 });
                                    hls.loadSource(endpoint);
                                    hls.attachMedia(videoElement);
                                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                        videoElement.play();
                                        attemptFullscreenAndLockOrientation(videoElement);
                                    });
                                    observer.unobserve(videoElement);
                                }
                            });
                        });
                        observer.observe(videoElement);
                    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                        videoElement.src = endpoint;
                        videoElement.addEventListener('loadedmetadata', () => {
                            videoElement.play();
                            attemptFullscreenAndLockOrientation(videoElement);
                        });
                    } else {
                        alert('Your browser does not support HLS playback.');
                    }
                } else {
                    const referrerPolicy = provider === 'vidbinge' ? 'referrerpolicy="origin-when-cross-origin"' : '';
                    const iframeHtml = `
                        <iframe 
                            src="${endpoint}" 
                            id="videoIframe"
                            class="video-iframe" 
                            allowfullscreen 
                            preload="auto"
                            loading="lazy"
                            crossorigin="anonymous"
                            ${referrerPolicy}>
                        </iframe>
                    `;
                    $videoPlayer.html(iframeHtml).removeClass('hidden');
                    $movieInfo.children().not($videoPlayer).addClass('hidden');
                    $closePlayerButton.removeClass('hidden');

                    attemptFullscreenAndLockOrientation(document.getElementById('videoIframe'));
                }
            } catch (error) {
                console.error('Error updating video:', error);
            } finally {
                $playButton.prop('disabled', false);
                isFetching = false;
            }
        }

        async function closeVideoPlayer() {
            $videoPlayer.html('').addClass('hidden');
            $movieInfo.children().removeClass('hidden');
            $closePlayerButton.addClass('hidden');
            await releaseResources();
        }

        function adjustIframeSize() {
            const $iframe = $('#dynamicIframe');
            const viewportWidth = $(window).width();
            const viewportHeight = $(window).height();
            $iframe.css({
                width: `${viewportWidth}px`,
                height: `${viewportHeight}px`
            });
        }

        $(window).on('resize', adjustIframeSize);
        adjustIframeSize();

        async function updateEpisodes(seasonNumber) {
            if (!seasonNumber) return;

            try {
                const season = await fetchJson(`https://api.themoviedb.org/3/tv/${media.id}/season/${seasonNumber}?api_key=${apiKey}`);

                const currentDate = new Date();

                const airedEpisodes = season.episodes.filter(episode => {
                    const airDate = new Date(episode.air_date);
                    return airDate <= currentDate;
                });

                if (airedEpisodes.length === 0) {
                    $('#runtime').html('No episodes have aired yet.');
                } else {
                    const totalRuntime = airedEpisodes.reduce((total, episode) => total + (episode.runtime || 0), 0);
                    const averageRuntime = totalRuntime / airedEpisodes.length || 0;

                    $('#runtime').html(`Total Runtime: ${Math.round(totalRuntime)} min (${Math.round(averageRuntime)} min per episode)`);
                }

                episodesData = airedEpisodes.map(episode => ({
                    number: episode.episode_number,
                    name: episode.name || 'Untitled',
                    airDate: new Date(episode.air_date),
                    stillPath: episode.still_path,
                    overview: episode.overview || 'No description available.',
                    runtime: episode.runtime || 0
                }));

                selectedEpisode = null;

                $('#episodeGrid').html(renderEpisodeGrid(episodesData));

                $('.episodes-grid').scrollTop(0);

                attachEpisodeDescriptionToggle();

            } catch (error) {
                console.error('Failed to fetch season details:', error);
            }
        }

        function escapeHtml(str) {
            return str.replace(/[&<>"'()]/g, function (match) {
                const escape = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                    '(': '&#40;',
                    ')': '&#41;'
                };
                return escape[match];
            });
        }

        function renderEpisodeGrid(episodes) {
            const storedData = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
            const mediaData = storedData[media.id];
            const showProgress = mediaData && mediaData.type === 'tv' ? mediaData.show_progress : {};

            return episodes.map(episode => {
                const episodeKey = `s${selectedSeason}e${episode.number}`;
                let progressPercentage = 0;
                let watchedMinutes = 0;
                let durationMinutes = 0;

                if (showProgress && showProgress[episodeKey] && showProgress[episodeKey].progress && showProgress[episodeKey].progress.duration > 0) {
                    watchedMinutes = Math.round(showProgress[episodeKey].progress.watched / 60);
                    durationMinutes = Math.round(showProgress[episodeKey].progress.duration / 60);
                    progressPercentage = (showProgress[episodeKey].progress.watched / showProgress[episodeKey].progress.duration) * 100;
                    progressPercentage = Math.min(Math.max(progressPercentage, 0), 100);
                }

                return `
        <div class="episode-item bg-gradient-to-br from-black via-gray-900 to-purple-900 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 transform hover:-translate-y-2 cursor-pointer relative group" data-episode-number="${episode.number}">
            <div class="relative">
                <img 
                    src="${episode.stillPath ? 'https://image.tmdb.org/t/p/w780' + episode.stillPath : 'https://via.placeholder.com/780x439?text=No+Image'}"
                    alt="Episode ${episode.number}"
                    class="w-full h-56 sm:h-40 object-cover transition-opacity duration-500"
                    loading="lazy"
                >
                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                <div class="absolute bottom-2 left-2">
                    <h3 class="text-purple-300 text-xs font-semibold">E${episode.number}: ${escapeHtml(episode.name)}</h3>
                </div>
                <button class="description-toggle absolute top-2 right-2 text-white bg-purple-700 bg-opacity-80 rounded-full p-1 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <!-- Heroicons Information Circle Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white hover:text-yellow-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>View Details</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
                    </svg>
                </button>
                <div class="absolute bottom-0 left-0 w-full h-2 bg-gray-800">
                    <div class="h-full bg-purple-600" style="width: ${progressPercentage}%;"></div>
                </div>
            </div>
            <div class="p-3 bg-black bg-opacity-70">
                <p class="text-purple-200 text-xs mb-2 flex items-center">
                    <!-- Heroicons Calendar Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-purple-200 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>Air Date</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7H3v12a2 2 0 002 2z" />
                    </svg>
                    ${episode.airDate ? new Date(episode.airDate).toLocaleDateString() : 'Unknown'}
                </p>
                <p class="text-purple-300 text-xs mt-1">Watched: ${watchedMinutes} min / ${durationMinutes} min</p>
            </div>
            <!-- Description content with mirror effect -->
            <div class="description-content hidden text-purple-100 text-xs bg-gradient-to-b from-purple-900 via-black to-black bg-opacity-95 p-3 rounded-lg absolute inset-0 overflow-hidden z-30 transition transform opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 duration-300 ease-in-out">
                <button class="close-description absolute top-4 right-4 text-white bg-red-600 hover:bg-red-700 p-2 rounded-full focus:outline-none">
                    <!-- Heroicons X Icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>Close</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
        
                <!-- Content container -->
                <div class="flex flex-col items-center">
                    <!-- Original content -->
                    <div class="mb-2">
                        <h3 class="text-yellow-300 text-sm font-bold">Episode ${episode.number}: ${escapeHtml(episode.name)}</h3>
                    </div>
                    <p class="leading-relaxed text-center text-xs">${escapeHtml(episode.overview)}</p>
        
                    <!-- Mirrored content -->
                    <div class="mt-4 transform scale-y-[-1] opacity-50 blur-sm">
                        <div class="text-center">
                            <h3 class="text-yellow-300 text-sm font-bold">${escapeHtml(episode.name)}</h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
            }).join('');
        }

        function renderSeasonList(seasons) {
            const storedData = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
            const mediaData = storedData[media.id];
            const showProgress = mediaData && mediaData.type === 'tv' ? mediaData.show_progress : {};

            return seasons.map(season => {
                const seasonNumber = season.season_number;
                const episodesInSeason = season.episode_count;

                let episodesWatched = 0;
                for (let key in showProgress) {
                    if (showProgress.hasOwnProperty(key)) {
                        const [s, e] = key.split('e');
                        const seasonNum = parseInt(s.substring(1), 10);

                        if (seasonNum === seasonNumber && showProgress[key].progress && showProgress[key].progress.watched > 0) {
                            episodesWatched++;
                        }
                    }
                }

                const progressPercentage = episodesInSeason > 0 ? Math.round((episodesWatched / episodesInSeason) * 100) : 0;

                return `
        <div class="season-item flex flex-col sm:flex-row items-center mb-4 cursor-pointer hover:bg-gray-800 p-3 rounded-lg transition relative group" data-season-number="${seasonNumber}">
            <div class="relative w-full sm:w-20 h-48 sm:h-28">
                <img 
                    src="${season.poster_path ? 'https://image.tmdb.org/t/p/w200' + season.poster_path : 'https://via.placeholder.com/200x300?text=No+Image'}"
                    alt="Season ${seasonNumber}" 
                    class="w-full h-full object-cover rounded-lg shadow-md transition-opacity duration-500"
                    loading="lazy"
                >
                <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
            </div>
            <div class="mt-4 sm:mt-0 sm:ml-4 flex-1 bg-black bg-opacity-70 p-3 rounded-lg">
                <h4 class="text-purple-300 text-lg font-semibold">Season ${seasonNumber}</h4>
                <p class="text-purple-200 text-sm mb-2">${season.episode_count} Episodes</p>
                <div class="w-full bg-gray-800 h-2 rounded-full">
                    <div class="bg-purple-600 h-2 rounded-full" style="width: ${progressPercentage}%;"></div>
                </div>
                <p class="text-purple-200 text-xs mt-1">${episodesWatched} / ${season.episode_count} Episodes Watched</p>
            </div>
            <!-- Heroicons Chevron Right Icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-400 absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>View Episodes</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </div>
        `;
            }).join('');
        }

        async function openEpisodeModal() {
            if (mediaType !== 'tv') {
                alert('Episode selection is only available for TV shows.');
                return;
            }

            if (seasonsData.length === 0) {
                alert('No seasons are available for this show.');
                return;
            }

            const storedData = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
            const mediaData = storedData[media.id];
            let preselectedSeason = null;
            let preselectedEpisode = null;

            if (mediaData && mediaData.type === 'tv') {
                preselectedSeason = parseInt(mediaData.last_season_watched, 10);
                preselectedEpisode = parseInt(mediaData.last_episode_watched, 10);
            }

            const modalContent = `
        <div class="modal-overlay fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
            <div class="modal-container bg-gradient-to-br from-black via-gray-900 to-purple-900 rounded-3xl shadow-2xl overflow-hidden max-w-full w-full md:max-w-6xl md:w-auto max-h-full relative">
                <button id="closeModalButton" class="absolute top-4 right-4 md:top-6 md:right-6 text-purple-300 text-2xl md:text-3xl hover:text-purple-500 focus:outline-none">&times;</button>
                <div class="flex flex-col md:flex-row h-full">
                    <div class="seasons-list md:w-1/3 w-full bg-black bg-opacity-80 overflow-y-auto custom-scrollbar max-h-screen p-4">
                        <h3 class="text-2xl font-bold text-purple-300 p-4 border-b border-purple-700">Seasons</h3>
                        <div class="p-2 space-y-3">
                            ${renderSeasonList(seasonsData)}
                        </div>
                    </div>
                    <div class="episodes-grid md:w-2/3 w-full p-4 md:p-6 overflow-y-auto custom-scrollbar max-h-screen bg-black bg-opacity-80">
                        <h2 class="text-2xl md:text-3xl font-bold text-purple-300 mb-6">Select Episode</h2>
                        <div class="mb-6">
                            <input type="text" id="episodeSearchInput" class="w-full p-3 bg-gray-800 text-purple-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="Search episodes...">
                        </div>
                        <div id="episodeGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            ${renderEpisodeGrid([])} <!-- Initially empty; episodes will be loaded based on selected season -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

            $episodeModal.html(modalContent).removeClass('hidden');

            $('#closeModalButton').on('click', function () {
                $episodeModal.addClass('hidden').html('');
            });

            $('.season-item').on('click', async function () {
                const seasonNumber = $(this).data('season-number');
                selectedSeason = seasonNumber;

                $('.season-item').removeClass('bg-gray-700');
                $(this).addClass('bg-gray-700');

                await updateEpisodes(seasonNumber);

                attachEpisodeDescriptionToggle();
            });

            if (preselectedSeason && seasonsData.some(season => season.season_number === preselectedSeason)) {
                selectedSeason = preselectedSeason;
                $(`.season-item[data-season-number="${selectedSeason}"]`).addClass('bg-gray-700');
                await updateEpisodes(selectedSeason);
            } else {
                $('.season-item').first().click();
            }

            if (preselectedEpisode) {
                const checkEpisodesLoaded = setInterval(() => {
                    if ($('#episodeGrid').children().length > 0) {
                        selectEpisode(preselectedEpisode);
                        clearInterval(checkEpisodesLoaded);
                    }
                }, 100);
            }

            $('#episodeSearchInput').on('input', debounce(function () {
                const searchTerm = $(this).val().toLowerCase();
                const filteredEpisodes = episodesData.filter(episode =>
                    episode.name.toLowerCase().includes(searchTerm) ||
                    episode.number.toString().includes(searchTerm)
                );
                $('#episodeGrid').html(renderEpisodeGrid(filteredEpisodes));

                attachEpisodeDescriptionToggle();
            }, 300));

            $('#episodeGrid').on('click', '.episode-item', function (event) {
                if ($(event.target).closest('.description-toggle').length > 0 || $(event.target).closest('.description-content').length > 0) {
                    return;
                }
                const episodeNumber = $(this).data('episode-number');
                selectEpisode(episodeNumber);
                $episodeModal.addClass('hidden').html('');
            });

            function attachEpisodeDescriptionToggle() {
                $('.description-toggle').off('click').on('click', function (event) {
                    event.stopPropagation();
                    const $descriptionContent = $(this).closest('.episode-item').find('.description-content');
                    $descriptionContent.fadeToggle();
                });

                $('.close-description').off('click').on('click', function (event) {
                    event.stopPropagation();
                    $(this).closest('.description-content').fadeOut();
                });
            }

            attachEpisodeDescriptionToggle();
        }

        function selectEpisode(episodeNumber) {
            selectedEpisode = episodeNumber;
            const episode = episodesData.find(ep => ep.number === episodeNumber);
            if (episode) {
                $selectEpisodeButton.html(`<i class="fas fa-list mr-2"></i>Selected: S${selectedSeason}E${episode.number} - ${escapeHtml(episode.name)}`);
            } else {
                $selectEpisodeButton.text(`Episode ${episodeNumber} Selected`);
            }

            const storedData = JSON.parse(localStorage.getItem('vidLinkProgress') || '{}');
            const mediaId = media.id;
            let mediaData = storedData[mediaId];

            if (!mediaData) {
                mediaData = {
                    id: media.id,
                    type: mediaType,
                    title: media.title || media.name,
                    poster_path: media.poster_path,
                    backdrop_path: media.backdrop_path,
                    progress: {},
                    last_updated: Date.now(),
                    number_of_episodes: media.number_of_episodes,
                    number_of_seasons: media.number_of_seasons,
                    last_season_watched: "",
                    last_episode_watched: "",
                    show_progress: {}
                };
                storedData[mediaId] = mediaData;
            }

            const episodeKey = `s${selectedSeason}e${selectedEpisode}`;

            mediaData.last_season_watched = selectedSeason.toString();
            mediaData.last_episode_watched = selectedEpisode.toString();

            if (!mediaData.show_progress[episodeKey]) {
                mediaData.show_progress[episodeKey] = {
                    season: selectedSeason.toString(),
                    episode: selectedEpisode.toString(),
                    progress: {
                        watched: 0,
                        duration: 0
                    },
                    last_updated: Date.now()
                };
            }

            mediaData.show_progress[episodeKey].last_updated = Date.now();

            storedData[mediaId] = mediaData;
            localStorage.setItem('vidLinkProgress', JSON.stringify(storedData));
        }

        $playButton.on('click', debounce(updateVideo, 500));
        $closePlayerButton.on('click', closeVideoPlayer);
        $languageSelect.on('change', function () {
            $providerSelect.toggleClass('hidden', $languageSelect.val() === 'fr');
            updateVideo();
        });
        $providerSelect.on('change', function () {
            selectedProvider = $(this).val();
            updateVideo();
        });
        $selectEpisodeButton.on('click', function () {
            openEpisodeModal();
        });

    } catch (error) {
        console.error('Failed to display selected media:', error);
    }
}
