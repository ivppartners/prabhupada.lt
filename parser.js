const Parser = (file) => {
    var extRegex = new RegExp('[^.]+$');
    var extention = file.originalname.match(extRegex);
    if(extention.length) {
        var pavadinimas = file.originalname.replace(`.${extention[0]}`, '');
    }
    
    if(!pavadinimas) throw new Error("Nėra failo pavadinimo");

    var dateRegex = /\d{8}/g;
    var dateString = pavadinimas.match(dateRegex);
    if(dateString?.length) {
        var metaiString = dateString[0].substring(0, 4);
        var menuoString = dateString[0].substring(4, 6);
        var dienaString = dateString[0].substring(6, 8);

        var likutis = pavadinimas.split(dateString[0], 2);
        if(likutis.length) {
            var saltinis = likutis[0];
            var groups = null;
            var knygaRegex = /(?<knyga>[A-Ža-ž]+[ ]+)+(?<vienas>[0-9]+)?(\.[ ]?)?(?<du>[0-9]+)?(\.[ ]?)?(?<trys>[0-9]+)?/g
            var matches = saltinis.matchAll(knygaRegex); 
            for (const match of matches) {
                groups = match.groups;
            }

            var knyga = null, giesme = null, skyrius = null, tekstas = null;
            
            if (groups) {
                knyga = groups.knyga;
                if(groups.trys) {
                    giesme = groups.vienas, skyrius = groups.du, tekstas = groups.trys;
                } else if (groups.du) {
                    skyrius = groups.vienas, tekstas = groups.du;
                } else if (groups.vienas) {
                    tekstas = groups.vienas;
                }
            } else {
                console.error("Nerado šaltinio pavadinime: " + pavadinimas);
            };
        }
        if(likutis.length === 2) {
            var vieta = likutis[1]?.trim();
        }
    }

    var record = {
        data: dateString?.length ? new Date(metaiString, menuoString - 1, dienaString) : null,
        failo_pavadinimas: file.originalname,
        giesme: giesme ? parseInt(giesme, 10) : null,
        knyga: knyga?.trim(),
        metai: metaiString ? parseInt(metaiString, 10) : null,
        pavadinimas: pavadinimas,
        skyrius: skyrius ? parseInt(skyrius, 10) : null,
        tekstas: tekstas ? parseInt(tekstas, 10) : null,
        vieta: vieta,
    }

    return record;
}

module.exports = Parser;