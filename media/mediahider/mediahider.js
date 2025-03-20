$(document).ready(function() {
    const $popularMediaSection = $('#popularMedia');
    const $toggleButton = $('#togglePopularMedia');

    function setCookie(name, value, days) {
        document.cookie = name + "=" + value + ";" + ";path=/";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookiesArray = decodedCookie.split(';');
        for (let i = 0; i < cookiesArray.length; i++) {
            let cookie = cookiesArray[i].trim();
            if (cookie.indexOf(nameEQ) === 0) {
                return cookie.substring(nameEQ.length, cookie.length);
            }
        }
        return null;
    }

    const isHidden = getCookie('popularMediaHidden') === 'true';

    $popularMediaSection.toggle(!isHidden);
    $toggleButton.text(isHidden ? 'Show Trending Media' : 'Hide Trending Media');

    $toggleButton.on('click', function() {
        const isCurrentlyHidden = $popularMediaSection.is(':hidden');
        $popularMediaSection.toggle(isCurrentlyHidden);
        $toggleButton.text(isCurrentlyHidden ? 'Hide Trending Media' : 'Show Trending Media');
        setCookie('popularMediaHidden', isCurrentlyHidden, 30);
    });

    $(window).on('beforeunload', function() {
        const isCurrentlyHidden = $popularMediaSection.is(':hidden');
        setCookie('popularMediaHidden', isCurrentlyHidden, 30);
    });
});
