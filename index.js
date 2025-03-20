function handleError(message, error, showAlert = true) {
    console.error(message, error);
    if (showAlert) {
        alert(message);
    }
}

async function getApiKey() {
    try {
        const response = await $.getJSON('apis/config.json');
        return response.apiKey;
    } catch (error) {
        handleError('Failed to fetch API key.', error);
        return null;
    }
}

async function fetchGenres(apiKey, mediaType) {
    try {
        const endpoint = mediaType === 'tv' ? 'genre/tv/list' : 'genre/movie/list';
        const response = await $.getJSON(`https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=en-US`);
        return response.genres;
    } catch (error) {
        handleError('An error occurred while fetching genres:', error);
        return [];
    }
}

$(document).ready(async function () {
    const $homePage = $('#homePage');
    const $welcomeBanner = $('#welcomeBanner');
    const $closeBanner = $('#closeBanner');
    const $categorySelect = $('#categorySelect');
    const $typeSelect = $('#typeSelect');
    const $popularMedia = $('#popularMedia');
    const $videoPlayerContainer = $('#videoPlayerContainer');
    const $videoPlayer = $('#videoPlayer');
    const $posterImage = $('#posterImage');
    const $searchInput = $('#searchInput');
    const $actorSearchInput = $('#actorSearchInput');
    const $companySearchInput = $('#companySearchInput'); // Company search input
    const $companySuggestions = $('#companySuggestions'); // Suggestions container for company search
    const $collectionSearchInput = $('#collectionSearchInput'); // Collection search input
    const $collectionSuggestions = $('#collectionSuggestions'); // Suggestions container for collection search
    const $franchiseSearchInput = $('#franchiseSearchInput'); // Franchise search input
    const $franchiseSuggestions = $('#franchiseSuggestions'); // Suggestions container for franchise search
    const $searchSuggestions = $('#searchSuggestions');
    const $randomButton = $('#randomButton');

    let currentMediaType = 'popular';
    let currentPage = 1;
    let totalPages = 1;
    let currentActorId = null;
    let currentCompanyId = null; // Company ID
    let currentCollectionId = null; // Collection ID
    let currentFranchiseKeywordId = null; // Franchise Keyword ID

    if ($closeBanner.length) {
        $closeBanner.on('click', () => {
            $welcomeBanner.hide();
        });
    }

    if ($homePage.length) {
        $homePage.removeClass('hidden');
    }

    const API_KEY = await getApiKey();
    if (!API_KEY) return;

    let genreMap = {};
    async function updateGenres(mediaType) {
        const genres = await fetchGenres(API_KEY, mediaType);
        genreMap = genres.reduce((map, genre) => {
            map[genre.id] = genre.name;
            return map;
        }, {});

        if ($categorySelect.length) {
            $categorySelect.html('<option value="">Select Genre</option>');
            $.each(genreMap, function (id, name) {
                $categorySelect.append(new Option(name, id));
            });
        }
    }

    await updateGenres('movie');

    if ($typeSelect.length) {
        $typeSelect.html(`
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
        `);

        $typeSelect.on('change', async function () {
            const selectedType = $(this).val();
            await updateGenres(selectedType);
            currentPage = 1; // Reset to first page
            await fetchPopularMedia(currentPage);
        });
    }

    // Event listener for actorSearchInput
    if ($actorSearchInput.length) {
        $actorSearchInput.on(
            'input',
            debounce(async function () {
                const actorName = $actorSearchInput.val().trim();
                if (actorName.length > 2) {
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(actorName)}`
                    );
                    if (response.results.length > 0) {
                        const actorId = response.results[0].id; // First actor result
                        currentActorId = actorId;
                        currentCompanyId = null; // Reset company ID
                        currentCollectionId = null; // Reset collection ID
                        currentFranchiseKeywordId = null; // Reset franchise keyword ID
                        currentMediaType = 'actor';
                        currentPage = 1;
                        await fetchMoviesAndShowsByActor(actorId, currentPage);
                    } else {
                        handleError('No actor found with that name.');
                        clearMediaDisplay();
                        totalPages = 1;
                        updatePaginationControls(currentPage, totalPages);
                    }
                } else {
                    // Input is too short; reset to popular media
                    currentActorId = null;
                    currentMediaType = 'popular';
                    currentPage = 1;
                    await fetchPopularMedia(currentPage);
                }
            }, 500)
        );
    }

    // Event listener for companySearchInput with suggestions
    if ($companySearchInput.length) {
        $companySearchInput.on(
            'input',
            debounce(async function () {
                const companyName = $companySearchInput.val().trim();
                if (companyName.length > 0) {
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/company?api_key=${API_KEY}&query=${encodeURIComponent(companyName)}`
                    );
                    if (response.results.length > 0) {
                        displayCompanySuggestions(response.results);
                    } else {
                        $companySuggestions.empty().addClass('hidden');
                    }
                } else {
                    // Input is empty; hide suggestions and reset to popular media
                    $companySuggestions.empty().addClass('hidden');
                    currentCompanyId = null;
                    currentMediaType = 'popular';
                    currentPage = 1;
                    await fetchPopularMedia(currentPage);
                }
            }, 300)
        );
    }

    // Function to display company suggestions
    function displayCompanySuggestions(companies) {
        $companySuggestions.empty().removeClass('hidden');
        companies.slice(0, 5).forEach(company => {
            const $suggestion = $('<div></div>')
                .text(company.name)
                .addClass('p-2 hover:bg-gray-700 cursor-pointer');
            $suggestion.on('click', async function () {
                $companySearchInput.val(company.name);
                $companySuggestions.empty().addClass('hidden');
                currentCompanyId = company.id;
                currentActorId = null; // Reset actor ID
                currentCollectionId = null; // Reset collection ID
                currentFranchiseKeywordId = null; // Reset franchise keyword ID
                currentMediaType = 'company';
                currentPage = 1;
                await fetchMoviesAndShowsByCompany(company.id, currentPage);
            });
            $companySuggestions.append($suggestion);
        });
    }

    // Hide company suggestions when clicking outside
    $(document).on('click', function (event) {
        if (!$(event.target).closest('#companySearchInput, #companySuggestions').length) {
            $companySuggestions.empty().addClass('hidden');
        }
    });

    // Event listener for collectionSearchInput with suggestions
    if ($collectionSearchInput.length) {
        $collectionSearchInput.on(
            'input',
            debounce(async function () {
                const collectionName = $collectionSearchInput.val().trim();
                if (collectionName.length > 0) {
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/collection?api_key=${API_KEY}&query=${encodeURIComponent(collectionName)}`
                    );
                    if (response.results.length > 0) {
                        displayCollectionSuggestions(response.results);
                    } else {
                        $collectionSuggestions.empty().addClass('hidden');
                    }
                } else {
                    // Input is empty; hide suggestions and reset to popular media
                    $collectionSuggestions.empty().addClass('hidden');
                    currentCollectionId = null;
                    currentMediaType = 'popular';
                    currentPage = 1;
                    await fetchPopularMedia(currentPage);
                }
            }, 300)
        );
    }

    // Function to display collection suggestions
    function displayCollectionSuggestions(collections) {
        $collectionSuggestions.empty().removeClass('hidden');
        collections.slice(0, 5).forEach(collection => {
            const $suggestion = $('<div></div>')
                .text(collection.name)
                .addClass('p-2 hover:bg-gray-700 cursor-pointer');
            $suggestion.on('click', async function () {
                $collectionSearchInput.val(collection.name);
                $collectionSuggestions.empty().addClass('hidden');
                currentCollectionId = collection.id;
                currentActorId = null; // Reset actor ID
                currentCompanyId = null; // Reset company ID
                currentFranchiseKeywordId = null; // Reset franchise keyword ID
                currentMediaType = 'collection';
                currentPage = 1;
                await fetchMoviesInCollection(collection.id, currentPage);
            });
            $collectionSuggestions.append($suggestion);
        });
    }

    // Hide collection suggestions when clicking outside
    $(document).on('click', function (event) {
        if (!$(event.target).closest('#collectionSearchInput, #collectionSuggestions').length) {
            $collectionSuggestions.empty().addClass('hidden');
        }
    });

    // Event listener for franchiseSearchInput with suggestions
    if ($franchiseSearchInput.length) {
        $franchiseSearchInput.on(
            'input',
            debounce(async function () {
                const franchiseName = $franchiseSearchInput.val().trim();
                if (franchiseName.length > 0) {
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/keyword?api_key=${API_KEY}&query=${encodeURIComponent(franchiseName)}`
                    );
                    if (response.results.length > 0) {
                        displayFranchiseSuggestions(response.results);
                    } else {
                        $franchiseSuggestions.empty().addClass('hidden');
                    }
                } else {
                    // Input is empty; hide suggestions and reset to popular media
                    $franchiseSuggestions.empty().addClass('hidden');
                    currentFranchiseKeywordId = null;
                    currentMediaType = 'popular';
                    currentPage = 1;
                    await fetchPopularMedia(currentPage);
                }
            }, 300)
        );
    }

    // Function to display franchise suggestions
    function displayFranchiseSuggestions(keywords) {
        $franchiseSuggestions.empty().removeClass('hidden');
        keywords.slice(0, 5).forEach(keyword => {
            const $suggestion = $('<div></div>')
                .text(keyword.name)
                .addClass('p-2 hover:bg-gray-700 cursor-pointer');
            $suggestion.on('click', async function () {
                $franchiseSearchInput.val(keyword.name);
                $franchiseSuggestions.empty().addClass('hidden');
                currentFranchiseKeywordId = keyword.id;
                currentActorId = null; // Reset actor ID
                currentCompanyId = null; // Reset company ID
                currentCollectionId = null; // Reset collection ID
                currentMediaType = 'franchise';
                currentPage = 1;
                await fetchMediaByFranchise(keyword.id, currentPage);
            });
            $franchiseSuggestions.append($suggestion);
        });
    }

    $(document).on('click', function (event) {
        if (!$(event.target).closest('#franchiseSearchInput, #franchiseSuggestions').length) {
            $franchiseSuggestions.empty().addClass('hidden');
        }
    });

    async function fetchMediaByFranchise(keywordId, page = 1) {
        currentMediaType = 'franchise';
        currentPage = page;
        const selectedType = $typeSelect.val();
        let allResults = [];
        let fetchedPages = 1;
        let totalApiPages = 1;

        try {
            do {
                const url = `https://api.themoviedb.org/3/discover/${selectedType}?api_key=${API_KEY}&with_keywords=${keywordId}&language=en-US&page=${fetchedPages}`;
                const response = await $.getJSON(url);

                if (response.total_results === 0) {
                    clearMediaDisplay();
                    handleError('No media found for this franchise.');
                    totalPages = 1;
                    updatePaginationControls(currentPage, totalPages);
                    return;
                }

                allResults = allResults.concat(response.results);
                totalApiPages = response.total_pages;
                fetchedPages++;
            } while (fetchedPages <= totalApiPages && fetchedPages <= 5);

            allResults.sort((a, b) => {
                const dateA = new Date(a.release_date || a.first_air_date);
                const dateB = new Date(b.release_date || b.first_air_date);
                return dateA - dateB;
            });

            totalPages = Math.ceil(allResults.length / 12);
            const paginatedResults = allResults.slice((currentPage - 1) * 12, currentPage * 12);

            displayPopularMedia(paginatedResults);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError('An error occurred while fetching media for the franchise.', error);
        }
    }

    // Function to fetch media by company
    async function fetchMoviesAndShowsByCompany(companyId, page = 1) {
        currentMediaType = 'company';
        currentPage = page;
        const selectedType = $typeSelect.val();
        const url = `https://api.themoviedb.org/3/discover/${selectedType}?api_key=${API_KEY}&with_companies=${companyId}&language=en-US&page=${page}`;

        try {
            const response = await $.getJSON(url);
            if (response.total_results === 0) {
                clearMediaDisplay();
                handleError('No media found for this company.');
                totalPages = 1;
                updatePaginationControls(currentPage, totalPages);
                return;
            }

            const results = response.results.slice(0, 12);
            totalPages = response.total_pages;
            displayPopularMedia(results);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError('An error occurred while fetching media for the company.', error);
        }
    }
    // Function to fetch movies in a collection with pagination
    async function fetchMoviesInCollection(collectionId, page = 1) {
        currentMediaType = 'collection';
        currentPage = page;
        const url = `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${API_KEY}&language=en-US`;
        try {
            const response = await $.getJSON(url);
            if (!response.parts || response.parts.length === 0) {
                clearMediaDisplay();
                handleError('No movies found in this collection.');
                totalPages = 1;
                updatePaginationControls(currentPage, totalPages);
                return;
            }
            const sortedMovies = response.parts.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
            totalPages = Math.ceil(sortedMovies.length / 12);
            const paginatedMovies = sortedMovies.slice((currentPage - 1) * 12, currentPage * 12);
            displayPopularMedia(paginatedMovies);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError('An error occurred while fetching movies in the collection.', error);
        }
    }
    // Function to fetch movies and shows by actor with pagination
    async function fetchMoviesAndShowsByActor(actorId, page = 1) {
        currentMediaType = 'actor';
        currentPage = page;
        const selectedType = $typeSelect.val();
        const url = `https://api.themoviedb.org/3/discover/${selectedType}?api_key=${API_KEY}&with_cast=${actorId}&language=en-US&page=${page}`;
        try {
            const response = await $.getJSON(url);
            if (response.total_results === 0) {
                clearMediaDisplay();
                handleError('No media found for this actor.');
                totalPages = 1;
                updatePaginationControls(currentPage, totalPages);
                return;
            }
            const results = response.results.slice(0, 12);
            totalPages = response.total_pages;
            displayPopularMedia(results);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError('An error occurred while fetching media for the actor.', error);
        }
    }

    // Function to fetch popular media with pagination
    async function fetchPopularMedia(page = 1) {
        currentMediaType = 'popular';
        currentPage = page;
        const selectedCategory = $categorySelect.val();
        const selectedType = $typeSelect.val();
        let url = '';
        let queryParams = `?api_key=${API_KEY}&page=${page}&language=en-US`;

        try {
            if (selectedCategory) {
                url = `https://api.themoviedb.org/3/discover/${selectedType}${queryParams}&with_genres=${selectedCategory}`;
            } else if (selectedType === 'tv') {
                url = `https://api.themoviedb.org/3/trending/tv/week${queryParams}`;
            } else {
                url = `https://api.themoviedb.org/3/trending/movie/week${queryParams}`;
            }

            const response = await $.getJSON(url);
            if (response.total_results === 0) {
                clearMediaDisplay();
                handleError('No media found.');
                totalPages = 1;
                updatePaginationControls(currentPage, totalPages);
                return;
            }

            const results = response.results.slice(0, 12);
            totalPages = response.total_pages;
            displayPopularMedia(results);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError(`An error occurred while fetching ${selectedType} media.`, error);
        }
    }

    // Function to search media with pagination
    async function search(page = 1) {
        currentMediaType = 'search';
        currentPage = page;
        const query = $searchInput.val().trim();
        const selectedCategory = $categorySelect.val();
        const selectedType = $typeSelect.val();
        const url = `https://api.themoviedb.org/3/search/${selectedType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&with_genres=${selectedCategory}&page=${page}`;

        try {
            const response = await $.getJSON(url);
            if (response.total_results === 0) {
                clearMediaDisplay();
                handleError('No results found.');
                totalPages = 1;
                updatePaginationControls(currentPage, totalPages);
                return;
            }

            const results = response.results.slice(0, 12);
            totalPages = response.total_pages;
            displayPopularMedia(results);
            updatePaginationControls(currentPage, totalPages);
        } catch (error) {
            handleError('An error occurred while searching for media.', error);
        }
    }

    async function updateMediaDisplay() {
        $popularMedia.html('<p>Loading...</p>');

        if (currentMediaType === 'franchise' && currentFranchiseKeywordId) {
            await fetchMediaByFranchise(currentFranchiseKeywordId, currentPage);
        } else if (currentMediaType === 'collection' && currentCollectionId) {
            await fetchMoviesInCollection(currentCollectionId, currentPage);
        } else if (currentMediaType === 'company' && currentCompanyId) {
            await fetchMoviesAndShowsByCompany(currentCompanyId, currentPage);
        } else if (currentMediaType === 'actor' && currentActorId) {
            await fetchMoviesAndShowsByActor(currentActorId, currentPage);
        } else if (currentMediaType === 'search') {
            await search(currentPage);
        } else {
            await fetchPopularMedia(currentPage);
        }
    }

    function updatePaginationControls(currentPage, totalPages) {
        if ($prevPageButton.length && $nextPageButton.length) {
            if (currentPage === 1) {
                $prevPageButton.prop('disabled', true);
            } else {
                $prevPageButton.prop('disabled', false);
            }

            if (currentPage === totalPages) {
                $nextPageButton.prop('disabled', true);
            } else {
                $nextPageButton.prop('disabled', false);
            }
        }
    }

    function clearMediaDisplay() {
        if ($popularMedia.length) {
            $popularMedia.empty();
        }
    }

    // Pagination Controls: Adding listeners for Next and Previous page buttons
    const $prevPageButton = $('#prevPage');
    const $nextPageButton = $('#nextPage');

    if ($prevPageButton.length && $nextPageButton.length) {
        $prevPageButton.on('click', async function () {
            if (currentPage > 1) {
                currentPage--;
                await updateMediaDisplay();
            }
        });

        $nextPageButton.on('click', async function () {
            if (currentPage < totalPages) {
                currentPage++;
                await updateMediaDisplay();
            }
        });
    }

    // Event listeners for search functionality
    if ($searchInput.length) {
        $('#searchButton').on('click', () => search());
        $searchInput.on('keydown', async function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                await search();
            }
        });

        $searchInput.on(
            'input',
            debounce(async function () {
                const query = $searchInput.val().trim();
                if (query.length > 2) {
                    const selectedCategory = $categorySelect.val();
                    const selectedType = $typeSelect.val();
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/${selectedType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&with_genres=${selectedCategory}`
                    );
                    if (response.results.length > 0) {
                        displaySearchSuggestions(response.results);
                    } else {
                        $searchSuggestions.addClass('hidden');
                    }
                } else {
                    $searchSuggestions.addClass('hidden');
                }
            }, 500)
        );
    }

    // Event listeners for category and type changes
    if ($categorySelect.length) {
        $categorySelect.on('change', async function () {
            currentPage = 1;
            await fetchPopularMedia(currentPage);
        });
    }

    if ($typeSelect.length) {
        $typeSelect.on('change', async function () {
            currentPage = 1;
            await fetchPopularMedia(currentPage);
        });
    }

    await fetchPopularMedia(currentPage);

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    async function fetchSelectedMedia(mediaId, mediaType) {
        try {
            const response = await $.getJSON(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${API_KEY}`);
            if (response) {
                const media = response;
    
                const releaseType = await getReleaseType(mediaId, mediaType);
    
                const newUrl = `${window.location.origin}${window.location.pathname}?mediaType=${encodeURIComponent(mediaType)}&mediaId=${encodeURIComponent(mediaId)}`;
                window.history.pushState({ mediaId, mediaType, title: media.title || media.name }, '', newUrl);
    
                displaySelectedMedia(media, mediaType, releaseType);
                await fetchMediaTrailer(mediaId, mediaType);
    
                if ($posterImage.length && media.poster_path) {
                    $posterImage.attr('src', `https://image.tmdb.org/t/p/w300${media.poster_path}`);
                    $posterImage.attr('alt', media.title || media.name);
                }
    
                $videoPlayerContainer.removeClass('hidden');
            } else {
                handleError('Failed to fetch media details.', new Error('API response not OK'));
                $videoPlayerContainer.addClass('hidden');
            }
        } catch (error) {
            handleError('An error occurred while fetching media details.', error);
            $videoPlayerContainer.addClass('hidden');
        }
    }
    

    const cache = new Map();

    async function getReleaseType(mediaId, mediaType, region = 'US') {
        try {
            const cacheKey = `${mediaId}_${mediaType}`;
            if (cache.has(cacheKey)) {
                return cache.get(cacheKey);
            }

            // Fetch release dates and watch providers concurrently
            const [releaseDatesResponse, watchProvidersResponse] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/release_dates?api_key=${API_KEY}`),
                fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/watch/providers?api_key=${API_KEY}`)
            ]);

            if (!releaseDatesResponse.ok) throw new Error('Failed to fetch release dates.');
            if (!watchProvidersResponse.ok) throw new Error('Failed to fetch watch providers.');

            const releaseDatesData = await releaseDatesResponse.json();
            const watchProvidersData = await watchProvidersResponse.json();

            const currentUtcDate = new Date(Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth(),
                new Date().getUTCDate()
            ));

            const releases = releaseDatesData.results.flatMap(result => result.release_dates);

            const certifications = extractCertifications(releaseDatesData, region);

            const isDigitalRelease = checkDigitalRelease(releases, currentUtcDate);
            const isInTheaters = checkTheaterRelease(releases, currentUtcDate);
            const hasFutureRelease = checkFutureRelease(releases, currentUtcDate);

            const isStreamingAvailable = checkStreamingAvailability(watchProvidersData);
            const isRentalOrPurchaseAvailable = checkRentalOrPurchaseAvailability(watchProvidersData);

            const releaseType = determineReleaseType({
                isInTheaters,
                isStreamingAvailable,
                isDigitalRelease,
                hasFutureRelease,
                isRentalOrPurchaseAvailable
            });

            const result = { releaseType, certifications };
            cache.set(cacheKey, result);

            return result;

        } catch (error) {
            console.error('Error fetching release type and certifications:', error.message);
            return {
                releaseType: "Unknown Quality",
                certifications: {}
            };
        }
    }

    function extractCertifications(releaseDatesData, region) {
        const certifications = {};

        releaseDatesData.results.forEach(result => {
            const certificationEntry = result.release_dates.find(release => release.certification);
            if (certificationEntry) {
                certifications[result.iso_3166_1] = certificationEntry.certification;
            }
        });

        return certifications[region] || 'No Certification Available'; // Return certification for specific region or a default message
    }

    function checkDigitalRelease(releases, currentUtcDate) {
        return releases.some(release =>
            [4, 6].includes(release.type) && new Date(release.release_date).getTime() <= currentUtcDate.getTime()
        );
    }

    function checkTheaterRelease(releases, currentUtcDate) {
        return releases.some(release => {
            const releaseDate = new Date(release.release_date);
            return release.type === 3 && releaseDate.getTime() <= currentUtcDate.getTime();
        });
    }

// Check for future releases
    function checkFutureRelease(releases, currentUtcDate) {
        return releases.some(release => new Date(release.release_date).getTime() > currentUtcDate.getTime());
    }

    function checkStreamingAvailability(watchProvidersData) {
        const availableRegions = Object.keys(watchProvidersData.results || {});
        return availableRegions.some(region =>
            (watchProvidersData.results?.[region]?.flatrate || []).length > 0
        );
    }

    function checkRentalOrPurchaseAvailability(watchProvidersData) {
        const availableRegions = Object.keys(watchProvidersData.results || {});
        return availableRegions.some(region => {
            const rentProviders = watchProvidersData.results?.[region]?.rent || [];
            const buyProviders = watchProvidersData.results?.[region]?.buy || [];
            return rentProviders.length > 0 || buyProviders.length > 0;
        });
    }
    function determineReleaseType({ isInTheaters, isStreamingAvailable, isDigitalRelease, hasFutureRelease, isRentalOrPurchaseAvailable }) {
        if (isInTheaters && !isStreamingAvailable && !isDigitalRelease) {
            return "Cam";
        } else if (isStreamingAvailable || isDigitalRelease) {
            return "HD";
        } else if (hasFutureRelease && !isInTheaters) {
            return "Not Released Yet";
        } else if (isRentalOrPurchaseAvailable) {
            return "Rental/Buy Available";
        } else {
            return "Unknown Quality";
        }
    }


    let displayedMediaIds = new Set();



    async function displayPopularMedia(results) {
        $popularMedia.empty();
        displayedMediaIds.clear();

        // Ensure padding-left for proper alignment on mobile
        if (!$popularMedia.hasClass('pl-4')) {
            $popularMedia.addClass('pl-4');
        }

        const limitedResults = results.slice(0, 12);

        const mediaWithReleaseType = await Promise.all(limitedResults.map(async (media) => {
            const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
            const releaseInfo = (mediaType === 'movie' || mediaType === 'animation')
                ? await getReleaseType(media.id, mediaType)
                : { releaseType: '', certifications: {} };

            return {
                ...media,
                releaseType: releaseInfo.releaseType,
                certifications: releaseInfo.certifications
            };
        }));

        // Iterate through each media item and create corresponding media cards
        mediaWithReleaseType.forEach(media => {
            // Skip if the media has already been displayed
            if (displayedMediaIds.has(media.id)) {
                return;
            }

            // Mark the media as displayed
            displayedMediaIds.add(media.id);

            // Create a new media card using the classes from themes.css
            const $mediaCard = $('<div class="media-card flex-shrink-0"></div>');

            // Map genre IDs to genre names
            const genreNames = media.genre_ids ? media.genre_ids.map(id => genreMap[id] || 'Unknown').join(', ') : 'Genre not available';

            // Format the release date
            const formattedDate = media.release_date ? new Date(media.release_date).toLocaleDateString() :
                (media.first_air_date ? new Date(media.first_air_date).toLocaleDateString() : 'Date not available');

            // Generate rating stars based on vote average
            const ratingStars = Array.from({ length: 5 }, (_, i) => i < Math.round(media.vote_average / 2) ?
                '<i class="fas fa-star rating-stars"></i>' : '<i class="fas fa-star text-gray-400"></i>').join('');

            // Determine media type and display type
            const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
            const displayType = (mediaType === 'movie' || mediaType === 'animation') ? media.releaseType : '';

            // Get certification information if available
            const certification = (mediaType === 'movie' && media.certifications['US']) ? media.certifications['US'] : '';

            $mediaCard.html(`
           <img 
                 src="${media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : 'placeholder.jpeg'}" 
                    alt="${media.title || media.name}" 
                     class="media-image"
                     onerror="this.onerror=null; this.src='placeholder.jpeg';"
                 
             ${displayType ? `<div class="release-type">${displayType}</div>` : ''}
    <div class="media-content">
        <h3 class="media-title">${media.title || media.name}</h3>
        <p class="media-type">
            ${mediaType === 'movie' ? '<i class="fas fa-film" title="Movie"></i> Movie' :
                mediaType === 'tv' ? '<i class="fas fa-tv" title="TV Show"></i> TV Show' :
                    '<i class="fas fa-pencil-alt" title="Animation"></i> Animation'}
        </p>
        <div class="media-details">
            <p><i class="fas fa-theater-masks"></i> Genres: ${genreNames}</p>
            <div class="media-rating">
                <span class="rating-stars">${ratingStars}</span>
                <span>${media.vote_average.toFixed(1)}/10</span>
            </div>
            <p><i class="fas fa-calendar-alt"></i> Release Date: ${formattedDate}</p>
            ${certification ? `<p><i class="fas fa-certificate"></i> Certification: ${certification}</p>` : ''}
        </div>
    </div>
`);

            // Add a click event to fetch and display the selected media
            $mediaCard.on('click', function () {
                fetchSelectedMedia(media.id, mediaType);
            });

            // Append the media card to the popular media container
            $popularMedia.append($mediaCard);
        });
    }


    if ($actorSearchInput.length) {
        $actorSearchInput.on(
            'input',
            debounce(async function () {
                const actorName = $actorSearchInput.val().trim();

                if (actorName.length < 2) {
                    currentActorId = null;
                    currentMediaType = 'popular';
                    currentPage = 1;
                    displayedMediaIds.clear();
                    await fetchPopularMedia(currentPage);
                    return;
                }

                if (actorName.length > 2) {
                    const response = await $.getJSON(
                        `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(actorName)}`
                    );
                    if (response.results.length > 0) {
                        const actorId = response.results[0].id;
                        currentActorId = actorId;
                        currentMediaType = 'actor';
                        currentPage = 1;
                        displayedMediaIds.clear();
                        await fetchMoviesAndShowsByActor(actorId, currentPage);
                    } else {
                        handleError('No actor found with that name.');
                        clearMediaDisplay();
                        totalPages = 1;
                        updatePaginationControls(currentPage, totalPages);
                    }
                }
            }, 500)
        );
    }



    async function fetchMediaTrailer(mediaId, mediaType) {
        try {
            const response = await $.getJSON(`https://api.themoviedb.org/3/${mediaType}/${mediaId}/videos?api_key=${API_KEY}`);
            const trailer = response.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
            if (trailer) {
                $videoPlayer.attr('src', `https://www.youtube.com/embed/${trailer.key}`);
            } else {
                $videoPlayer.attr('src', '');
                $videoPlayerContainer.addClass('hidden');
            }
        } catch (error) {
            handleError('An error occurred while fetching media trailer.', error);
            $videoPlayerContainer.addClass('hidden');
        }
    }
    async function loadMediaFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const mediaType = urlParams.get('mediaType');
        const mediaId = urlParams.get('mediaId');
        const title = urlParams.get('title');
    
        if (mediaType && mediaId) {
            await fetchSelectedMedia(mediaPath);
        } else if (title) {
            const response = await $.getJSON(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
            const media = response.results.find(item =>
                (item.title && item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === title) ||
                (item.name && item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === title)
            );
            if (media) {
                const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
                const mediaPath = `${mediaType}/${media.id}`;
                await fetchSelectedMedia(mediaPath);
            } else {
                handleError('Media not found based on the title parameter.');
            }
        }
    }

    if ($categorySelect.length) {
        $categorySelect.on('change', function () {
            fetchPopularMedia();
        });
    }

    fetchPopularMedia();
    loadMediaFromUrlParams();
});