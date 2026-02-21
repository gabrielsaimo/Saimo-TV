const samples = [
    "One Punch Man S03 Episódio 1",
    "One Punch Man S03 Episódio 12",
    "Jujutsu Kaisen S02 20",
    "Jujutsu Kaisen S02 Jujutsu.Kaisen.S02E21",
    "Jujutsu Kaisen S03 Jujutsu.Kaisen.L.S03.E01",
    "Os Cavaleiros do Zodíaco: A Saga de Hades S02 Episódio 1",
    "Os Cavaleiros do Zodíaco: A Saga de Hades S03 Os.Cavaleiros.do.Zodiaco.Saga.de.Hades.S03.E07",
    "Mashle: Magia e Músculos S02 Mashle.Magia.e.Musculos.S02.E01",
    "Game of Thrones S01E01",
    "Game of Thrones S01 E01",
    "The Walking Dead S11 E24",
    "Doctor Who S12 E05",
    "Stranger Things S04E09",
    "Chucky S03 Episodio 05",
    "A Casa do Dragão S02 Ep 01"
];

function parseEpisodeName(name) {
    // 1. Standard format: Name S01 E01 or Name S01E01 or Name S01 Ep 01
    // Also matches "A Casa do Dragão S02 Ep 01"
    let match = name.match(/(.+?)\s+S(\d+)\s*(?:E|Ep|Episódio|Episodio)\s*(\d+)$/i);
    if (match) return { seriesName: match[1].trim(), season: match[2], episode: match[3] };

    // 2. Format with dots and repeated name or standard dots: Name S01.E01 or Name S01 Name.S01E01
    // We look for S\d+ and then later E\d+ 
    // This handles "Jujutsu Kaisen S02 Jujutsu.Kaisen.S02E21" 
    // and "Mashle: Magia e Músculos S02 Mashle.Magia.e.Musculos.S02.E01"
    match = name.match(/(.+?)\s+S(\d+).*?(?:E|Ep)(\d+)/i);
    if (match) return { seriesName: match[1].trim(), season: match[2], episode: match[3] };

    // 3. Bare number: Jujutsu Kaisen S02 20
    match = name.match(/(.+?)\s+S(\d+)\s+(\d+)$/i);
    if (match) return { seriesName: match[1].trim(), season: match[2], episode: match[3] };

    return null;
}

samples.forEach(s => {
    const res = parseEpisodeName(s);
    if (res) {
        console.log(`[OK]   ${s} -> Series: "${res.seriesName}", S: ${res.season}, E: ${res.episode}`);
    } else {
        console.log(`[FAIL] ${s}`);
    }
});
