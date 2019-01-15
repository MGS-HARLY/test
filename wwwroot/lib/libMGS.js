/*****************************/
/*** LibMGS.js version 0.1 ***/
/*****************************/

/****************************************** RESTE MINIMUM A FAIRE
 * Ajouter des �v�nements aux graphes FS
 * Faire le keepAlive !
 * Gestion de la significativit� / Application de colorisation / style sp�cifique (fait en partie)
 * R�cup�ration des scores pour l'export PPT
*/


/** variables obligatoires */
var INFOS = null;
var DATAS = null;
var DATAS_dimensions = null;


var conservationOptions = {}; // variable objet qui contient toutes les options � conserver
var timeout_redimensionnement = null; // Variable permettant la r�-initialisation du timeout
var redimensionnementGraphes = []; // variable tableau qui contient tous les graphes � recharger en redimensionnant

/** �v�nement au d�marrage du dashboard. */
FusionCharts.ready(function () {
    
    window.addEventListener("resize", function () {
        clearTimeout(timeout_redimensionnement);
        timeout_redimensionnement = setTimeout(function () {
            var keys = Object.keys(FusionCharts.items);
            for (var i = 0; i < keys.length; i++)
                if (/*redimensionnementGraphes.length == 0 || */redimensionnementGraphes.indexOf(keys[i]) > -1)
                    FusionCharts.items[keys[i]].render();
        }, 300);
    });
    initialisationDashboard();

});


/**
 * Remplissage automatique d'un s�lecteur
 * @param {string} idSel S�lecteur � remplir
 * @param {string} dimension Dimension � lire
 * @param {boolean} inverse Inverser l'ordre (pour les vagues par exemple)
 */
function remplirSelecteur(idSel, dimension, inverse = false) {
    var selecteur = document.getElementById(idSel);

    if (!inverse)
        for (var i = 0; i < INFOS[dimension].length; i++) {
            var opt = document.createElement('option');
            opt.textContent = INFOS[dimension][i].n;
            opt.value = INFOS[dimension][i].i;
            selecteur.appendChild(opt);
        }

    if (inverse)
        for (var i = INFOS[dimension].length - 1; i >= 0; i--) {
            var opt = document.createElement('option');
            opt.textContent = INFOS[dimension][i].n;
            opt.value = INFOS[dimension][i].i;
            selecteur.appendChild(opt);
        }
}

/**
 * Permet de cr�er l'objet de graphique dans la librairie de Fusioncharts (retourne optionnellement l'objet FusionCharts)
 * @param {object} modeleJSON Mod�le de graphe avec donn�es vides
 * @param {string} conteneurRendu Conteneur de rendu du graphe
 * @param {string} idFS Conteneur de rendu du graphe
 * @param {boolean} affichageAuto Bool�en qui d�termine si le graphe s'affiche
 * @returns {object}
 */
function creerGraphe(modeleJSON, conteneurRendu, idFS, affichageAuto = false, ids_filtres = null, options = {}) {

    if ((typeof (idFS)).toLowerCase() != "string") throw new Error("L'ID pour FusionCharts doit �tre du type 'string'");
    if (affichageAuto && ids_filtres == null) throw new Error("Impossible d'afficher le graphe si aucune donn�e n'est pr�sente.");

    var modeleJSON_edited = Object.assign({}, modeleJSON);
    modeleJSON_edited.renderAt = conteneurRendu;
    modeleJSON_edited.id = idFS;

    if (options.conserverOptions == null || options.conserverOptions)
        conservationOptions[idFS] = options; // Conservation des options

    options.typeGraphe = modeleJSON_edited.type;

    if (affichageAuto)
        remplirDonnees(modeleJSON_edited.dataSource, ids_filtres, options);

    var tmpObjFS = new FusionCharts(modeleJSON_edited);
    tmpObjFS.setTransparent(true);
    if (affichageAuto)
        tmpObjFS.render();

    return tmpObjFS;
}

/**
 * Mise � jour du graphe concern�
 * @param {string} idFS ID Fusioncharts du graphe concern�
 * @param {Array<int>} ids_filtres Filtres concern�s
 * @param {boolean} nouveauRendu On refait l'animation du graphe (par d�faut � vrai)
 * @param {object} options Filtres concern�s
 */
function miseajourGraphe(idFS, ids_filtres, nouveauRendu = true, options = {}) {

    // Utilisation des options sauvegard�es
    var bReprendreOptions = true;
    if (options.reprendreOptions != null)
        bReprendreOptions = options.reprendreOptions;

    var bConserverOptions = true;
    if (options.conserverOptions != null)
        bConserverOptions = options.conserverOptions;

    var bInitOptions = false;
    if (options.initOptions != null)
        bInitOptions = options.initOptions;

    // On d�sactive la conservation des options si la cl� 'initOptions' est � true ET que la cl� 'conservationOptions' n'est pas renseign�e.
    if (options.conserverOptions == null && bInitOptions)
        bConserverOptions = false;

    if (bConserverOptions && bInitOptions) throw new Error("Impossible d'utiliser 'conserverOptions' ET 'initOptions' � la fois.");

    var tmpOptions = {};
    if (bReprendreOptions) {

        if (conservationOptions[idFS] != null)
            tmpOptions = conservationOptions[idFS]; // On r�cup�re les options sauvegard�es

        tmpOptions = mettreAjourObjet(tmpOptions, options);

        options = tmpOptions;
    }
    
    if (bConserverOptions)
        conservationOptions[idFS] = options; // On sauvegarde les options
    else if (bInitOptions) conservationOptions[idFS] = {}; // On r�initialise les options
    
    // Mise � jour des graphes
    var tmpObjFS = FusionCharts(idFS);
    options.typeGraphe = tmpObjFS.options.chartType;

    if (nouveauRendu) {
        remplirDonnees(tmpObjFS.getJSONData(), ids_filtres, options);
        tmpObjFS.render();
    } else {
        var modeleJSON_dataSource = Object.assign(tmpObjFS.getJSONData());
        remplirDonnees(modeleJSON_dataSource, ids_filtres, options);
        tmpObjFS.setJSONData(modeleJSON_dataSource);
    }
}

/**
 * Fonction de filtrage des �l�ments dans une dimension
 * @param {Array<Number>} ids_filtres Liste des IDs
 * @param {object} options options de filtrage
 */
function filtrerDonnees(ids_filtres, options = null) {

    if (options == null) options = {};

    // **** D�tection des erreurs
    if (ids_filtres.length != DATAS_dimensions.length) throw new Error("Le nombre d'IDs entr�s est diff�rent du nombre de dimensions pr�vues.");
    if (options.filtreDim1 != null && (options.filtreDim1.prop == null || options.filtreDim1.vals == null)) throw new Error("Quand 'filtreDim1' est utilis�, 'prop' et 'vals' doivent �tre utilis�s.");
    if (options.filtreDim2 != null && (options.filtreDim2.prop == null || options.filtreDim2.vals == null)) throw new Error("Quand 'filtreDim2' est utilis�, 'prop' et 'vals' doivent �tre utilis�s.");

    var flgMultiDatas = false;
    var flgSingleDatas = false;
    var indexMultiDatas = -1;
    var indexSingleDatas = -1;
    for (var i = 0; i < ids_filtres.length; i++) {
        if (ids_filtres[i] == -1) { if (!flgSingleDatas) { flgSingleDatas = true; indexSingleDatas = i; } else throw new Error("Il ne peut y avoir qu'une seule s�rie (-1)"); }
        if (ids_filtres[i] == -2) { if (!flgMultiDatas) { flgMultiDatas = true; indexMultiDatas = i; } else throw new Error("Il ne peut y avoir qu'une seule multi-s�ries (-2)"); }
    }
    if (flgMultiDatas && !flgSingleDatas) throw new Error("Attention une multi-s�ries (-2) a �t� demand�e alors que la simple s�rie (-1) n'a pas �t� d�finie");
    
    var idDim2 = options.triDim1 != null && options.triDim1.idDim2 == null ? -1 : options.triDim1 != null ? options.triDim1.idDim2 : -1;
    var idDim1 = options.triDim2 != null && options.triDim2.idDim1 == null ? -1 : options.triDim2 != null ? options.triDim2.idDim1 : -1;
    if (flgMultiDatas && options.triDim1 != null && idDim2 == -1) throw new Error("Vous devez sp�cifier un ID d'�l�ment de la deuxi�me dimension pour pouvoir trier la premi�re.");
    if (flgMultiDatas && options.triDim2 != null && idDim1 == -1) throw new Error("Vous devez sp�cifier un ID d'�l�ment de la premi�re dimension pour pouvoir trier la deuxi�me.");

    if (!flgMultiDatas && options.showLastsSeries != null) throw new Error("Vous avez sp�cifi� montrer les derniers �l�ments de s�rie alors qu'il n'y a pas de s�rie.");
    if (!flgSingleDatas && options.showLasts != null) throw new Error("Vous avez sp�cifi� montrer les derniers �l�ments de cat�gorie alors qu'il n'y a pas de cat�gorie.");
    if (options.showLasts != null && options.showFirsts != null) throw new Error("'showLasts' ne peut �tre utilis� en m�me temps que 'showFirsts'");
    if (options.showLastsSeries != null && options.showFirstsSeries != null) throw new Error("'showLastsSeries' ne peut �tre utilis� en m�me temps que 'showFirstsSeries'");

    // D�tection des erreurs pour le calcul et l'affichage des significativit�s
    if (options.styles != null && options.signifs != null) {
        for (var i = 0; i < options.styles.signifs.length; i++) {
            if (options.styles.signifs[i].nomProp == null) throw new Error("La cl� 'nomProp' est obligatoire pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].contre == null) throw new Error("La cl� 'contre' est obligatoire pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].type == null) throw new Error("La cl� 'type' est obligatoire pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].elements == null) throw new Error("La cl� 'elements' est obligatoire pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].type != null && options.styles.signifs[i].type != "custom" && options.styles.signifs[i].position != null) throw new Error("La cl� 'position' est obligatoire quand la cl� 'type' n'est pas 'custom' pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].seuils != null && (options.styles.signifs[i].seuils.length * 2 + 1) != options.styles.signifs[i].elements != null) throw new Error("Le nombre d'�l�ments dit correspondre � '2 * nbSeuils + 1' pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].seuils == null && options.styles.signifs[i].elements != 3) throw new Error("Le nombre de seuil par d�faut est 1 (95%), donc le nombre d'�l�ments doit �tre de 3. (2 * nbSeuils + 1) pour la signif d'index '" + i + "'.");
            if (options.styles.signifs[i].nomProp != null && options.styles.signifs[i].nomProp == "d") throw new Error("La cl� 'nomProp' ne peut pas avoir comme valeur 'd' (qui est la valeur par d�faut d'une signif r�cup�r�e dans les donn�es)' pour la signif d'index '" + i + "'.");
        }        
    }

    // D�tection des erreurs pour les filtres par seuils
    if (options.seuils != null) {

        if (!flgMultiDatas && !flgSingleDatas)
            throw new Error("Impossible d'utiliser les seuils sur une donn�e unique.");

        for (var i = 0; i < options.seuils.length; i++) {
            
            if (options.seuils[i].variable == null)
                throw new Error("Vous n'avez pas d�fini la variable concern�e pour le seuil num�ro " + (i + 1) + " (cl� 'variable').");

            if (options.seuils[i].operateur == null)
                throw new Error("Vous n'avez pas d�fini l'op�rateur pour le seuil num�ro " + (i + 1) + " (cl� 'operateur'). Les possibilit�s sont '<', '<=', '>', '>=', '==', '!='.");
            else if ("<�<=�>�>=�==!=".indexOf(options.seuils[i].operateur) == -1) 
                throw new Error("L'op�rateur est mal d�fini pour le seuil num�ro " + (i + 1) + ". Les possibilit�s sont '<', '<=', '>', '>=', '==', '!='.");

            if (options.seuils[i].valeur == null)
                throw new Error("Vous n'avez pas d�fini la valeur de seuil � comparer pour le seuil num�ro " + (i + 1) + " (cl� 'valeur').");

            if (flgMultiDatas && options.seuils[i].supprimer != null && options.seuils[i].supprimer)
                throw new Error("Interdit de supprimer les donn�es quand c'est une multi-s�rie (seuil num�ro " + (i + 1) + ").");
        }
    }
    // **** Fin de d�tection des erreurs


    var custom_dimension_filter = {};
    var dimension1 = "";
    var dimension2 = "";

    // SI Multi-s�rie
    if (flgMultiDatas && flgSingleDatas) {
        dimension2 = DATAS_dimensions[indexMultiDatas];
        dimension1 = DATAS_dimensions[indexSingleDatas];

        custom_dimension_filter["dimension1"] = dimension1;
        custom_dimension_filter["dimension2"] = dimension2;

        custom_dimension_filter[dimension2] = [];

        var sumDim2 = [];
        for (var i = 0; i < INFOS[dimension2].length; i++) {
            //console.log(INFOS[dimension2][i].i);

            var flgPassSerie = true;
            if (options.filtreDim2 != null) {
                var flgTrouve = false;
                for (var z = 0; z < options.filtreDim2.vals.length; z++) if (INFOS[dimension2][i][options.filtreDim2.prop] == options.filtreDim2.vals[z]) flgTrouve = true;
                if (!flgTrouve) flgPassSerie = false;
            }

            if (flgPassSerie) {

                var newObjDim2 = Object.assign({}, INFOS[dimension2][i]);
                newObjDim2[dimension1] = [];

                for (var j = 0; j < INFOS[dimension1].length; j++) {

                    //console.log(INFOS[dimension1][j].i);
                    var tmpDATAS = DATAS;

                    var flgPass = true;
                    var flgFill = true;
                    for (var k = 0; k < ids_filtres.length && flgPass; k++) {
                        if (ids_filtres[k] > -1) { if (tmpDATAS[ids_filtres[k]] != null) tmpDATAS = tmpDATAS[ids_filtres[k]]; else flgFill = false; }
                        if (ids_filtres[k] == -1) { if (tmpDATAS[INFOS[dimension1][j].i] != null) tmpDATAS = tmpDATAS[INFOS[dimension1][j].i]; else flgFill = false; }
                        if (ids_filtres[k] == -2) { if (tmpDATAS[INFOS[dimension2][i].i] != null) tmpDATAS = tmpDATAS[INFOS[dimension2][i].i]; else flgFill = false; }
                        //console.log(flgPass + "-" + ids_filtres[k] + "-" + k);
                    }
                    if (options.removeZeros != null && options.removeZeros && tmpDATAS.s == 0) flgFill = false;
                    if (options.lowBaseHide != null && tmpDATAS.b < options.lowBaseHide) flgFill = false;
                    if (options.filtreDim1 != null) {
                        var flgTrouve = false;
                        for (var z = 0; z < options.filtreDim1.vals.length; z++) if (INFOS[dimension1][j][options.filtreDim1.prop] == options.filtreDim1.vals[z]) flgTrouve = true;
                        if (!flgTrouve) flgFill = false; // Pour multi-s�rie, la donn�e NE DOIT PAS �tre supprim�e au risque d'avoi des d�calages.
                    }
                    if (options.seuils != null) {
                        for (var k = 0; k < options.seuils.length; k++) {
                            switch (options.seuils[k].operateur) {
                                case "<": {
                                    if (tmpDATAS[options.seuils[k].variable] >= options.seuils[k].valeur)
                                        flgFill = false;
                                }
                                case "<=": {
                                    if (tmpDATAS[options.seuils[k].variable] > options.seuils[k].valeur)
                                        flgFill = false;
                                }
                                case ">": {
                                    if (tmpDATAS[options.seuils[k].variable] <= options.seuils[k].valeur)
                                        flgFill = false;
                                }
                                case ">=": {
                                    if (tmpDATAS[options.seuils[k].variable] < options.seuils[k].valeur)
                                        flgFill = false;
                                }
                                case "==": {
                                    if (tmpDATAS[options.seuils[k].variable] != options.seuils[k].valeur)
                                        flgFill = false;
                                }
                                case "!=": {
                                    if (tmpDATAS[options.seuils[k].variable] == options.seuils[k].valeur)
                                        flgFill = false;
                                }
                            }
                        }
                    }
                    var bSignifs = false;
                    if (options.styles != null && options.styles.signifs != null)
                        bSignifs = true;

                    if (flgPass) {

                        var newObjDim1 = Object.assign({}, INFOS[dimension1][j]);

                        // Calcul de la signif
                        if (bSignifs)
                            for (var z = 0; z < options.styles.signifs.length; z++) {

                                // R�cup�ration du score et de la base
                                ids_filtres_signif = Array.from(ids_filtres);
                                ids_filtres_signif[indexMultiDatas] = newObjDim2.i;
                                ids_filtres_signif[indexSingleDatas] = newObjDim1.i;
                                for (var y = 0; y < options.styles.signifs[z].contre.length; y++) {
                                    var contre = options.styles.signifs[z].contre[y];
                                    ids_filtres_signif[DATAS_dimensions.indexOf(contre.dim)] = contre.i;
                                }

                                var tmpDATAS_signif = obtenirDonnee(ids_filtres_signif);

                                // D�finition des seuils
                                if (options.styles.signifs[z].seuils != null) seuils = options.styles.signifs[z].seuils;
                                else seuils = [95];

                                // Obtention de la diff significative
                                tmpDATAS[options.styles.signifs[z].nomProp] = obtSignif(tmpDATAS.s, tmpDATAS_signif.s, tmpDATAS.b, tmpDATAS_signif.b, tmpDATAS.e, tmpDATAS_signif.e, seuils);
                            }

                        var data_keys = Object.keys(tmpDATAS);
                        for (var z = 0; z < data_keys.length; z++) {
                            if (flgFill) newObjDim1[data_keys[z]] = tmpDATAS[data_keys[z]];
                            else newObjDim1[data_keys[z]] = -1;

                            if (INFOS[dimension1][j].i == idDim1) {
                                if (flgFill) newObjDim2[data_keys[z]] = tmpDATAS[data_keys[z]];
                                else newObjDim2[data_keys[z]] = -1;
                            }
                        }

                        if (custom_dimension_filter[dimension2].length == 0)
                            sumDim2.push(0)
                        
                        if (flgFill)
                            sumDim2[j] += tmpDATAS["s"];

                        newObjDim2[dimension1].push(newObjDim1);
                    }
                    else {
                        if (INFOS[dimension1][j].i == idDim1)
                            newObjDim2[data_keys[z]] = -1;
                    }

                }

                custom_dimension_filter[dimension2].push(newObjDim2);
            }

        }

        // Suppression des categories vides
        for (var j = INFOS[dimension1].length - 1; j >= 0; j--) {
            if (sumDim2[j] == 0) {
                for (var i = 0; i < custom_dimension_filter[dimension2].length; i++) {
                    custom_dimension_filter[dimension2][i][dimension1].splice(j, 1);
                }
            }
        }

    }

    // SI simple-s�rie
    if (!flgMultiDatas && flgSingleDatas) {

        
        dimension1 = DATAS_dimensions[indexSingleDatas];
        custom_dimension_filter["dimension1"] = dimension1;

        custom_dimension_filter[dimension1] = [];
        for (var j = 0; j < INFOS[dimension1].length; j++) {

            //console.log(INFOS[dimension1][j].i);
            var tmpDATAS = DATAS;

            var flgPass = true;
            var flgFill = true;
            for (var k = 0; k < ids_filtres.length && flgPass; k++) {
                if (ids_filtres[k] > -1) { if (tmpDATAS[ids_filtres[k]] != null) tmpDATAS = tmpDATAS[ids_filtres[k]]; else flgFill = false; }
                if (ids_filtres[k] == -1) { if (tmpDATAS[INFOS[dimension1][j].i] != null) tmpDATAS = tmpDATAS[INFOS[dimension1][j].i]; else flgFill = false; }
                //console.log(flgPass + "-" + ids_filtres[k] + "-" + k);
            }
            if (options.removeZeros != null && options.removeZeros && tmpDATAS.s == 0) flgFill = false;
            if (options.lowBaseHide != null && tmpDATAS.b < options.lowBaseHide) flgFill = false;
            if (options.filtreDim1 != null) {
                var flgTrouve = false;
                for (var z = 0; z < options.filtreDim1.vals.length; z++) if (INFOS[dimension1][j][options.filtreDim1.prop] == options.filtreDim1.vals[z]) flgTrouve = true;
                if (!flgTrouve) flgPass = false;
            }
            if (options.seuils != null) {
                for (var k = 0; k < options.seuils.length; k++) {

                    var bSupprimer = false;
                    if (options.seuils[k].supprimer != null)
                        bSupprimer = options.seuils[k].supprimer;
                    
                    switch (options.seuils[k].operateur) {
                        case "<": {
                            if (tmpDATAS[options.seuils[k].variable] >= options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                            break;
                        }
                        case "<=": {
                            if (tmpDATAS[options.seuils[k].variable] > options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                            break;
                        }
                        case ">": {
                            if (tmpDATAS[options.seuils[k].variable] <= options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                            break;
                        }
                        case ">=": {
                            if (tmpDATAS[options.seuils[k].variable] < options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                            break;
                        }
                        case "==": {
                            if (tmpDATAS[options.seuils[k].variable] != options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                        }
                        case "!=": {
                            if (tmpDATAS[options.seuils[k].variable] == options.seuils[k].valeur) {
                                if (bSupprimer)
                                    flgPass = false;
                                else flgFill = false;
                            }
                            break;
                        }
                    }
                }
            }
            var bSignifs = false;
            if (options.styles != null && options.styles.signifs != null)
                bSignifs = true;
                

            if (flgPass) {

                var newObjDim1 = Object.assign({}, INFOS[dimension1][j]);

                // Calcul de la signif
                if (bSignifs)
                    for (var z = 0; z < options.styles.signifs.length; z++) {

                        // R�cup�ration du score et de la base
                        ids_filtres_signif = Array.from(ids_filtres);
                        ids_filtres_signif[indexSingleDatas] = newObjDim1.i;
                        for (var y = 0; y < options.styles.signifs[z].contre.length; y++) {
                            var contre = options.styles.signifs[z].contre[y];
                            ids_filtres_signif[DATAS_dimensions.indexOf(contre.dim)] = contre.i;
                        }

                        var tmpDATAS_signif = obtenirDonnee(ids_filtres_signif);

                        // D�finition des seuils
                        if (options.styles.signifs[z].seuils != null) seuils = options.styles.signifs[z].seuils;
                        else seuils = [95];

                        // Obtention de la diff significative
                        tmpDATAS[options.styles.signifs[z].nomProp] = obtSignif(tmpDATAS.s, tmpDATAS_signif.s, tmpDATAS.b, tmpDATAS_signif.b, tmpDATAS.e, tmpDATAS_signif.e, seuils);
                    }


                var data_keys = Object.keys(tmpDATAS);
                for (var z = 0; z < data_keys.length; z++) {
                    if (flgFill) newObjDim1[data_keys[z]] = tmpDATAS[data_keys[z]];
                    else newObjDim1[data_keys[z]] = -1;
                }

                custom_dimension_filter[dimension1].push(newObjDim1);
            }

        }
    }

    // SI simple
    if (!flgMultiDatas && !flgSingleDatas) {

        custom_dimension_filter["donnee"] = {};

        for (var k = 0; k < ids_filtres.length; k++)
            custom_dimension_filter["donnee"][DATAS_dimensions[k]] = obtElementParProp(INFOS[DATAS_dimensions[k]], 'i', ids_filtres[k]);

        var tmpDATAS = DATAS;
        var valeurRef = (options.valeurRef != null ? options.valeurRef : 100);

        var flgPass = true;
        var flgFill = true;
        for (var k = 0; k < ids_filtres.length && flgPass; k++) {
            if (ids_filtres[k] > -1) { if (tmpDATAS[ids_filtres[k]] != null) tmpDATAS = tmpDATAS[ids_filtres[k]]; else flgPass = false; }
            //console.log(flgPass + "-" + ids_filtres[k] + "-" + k);
        }
        if (options.removeZeros != null && options.removeZeros && tmpDATAS.s == 0) flgPass = false;
        if (options.lowBaseHide != null && tmpDATAS.b < options.lowBaseHide) flgPass = false;

        var bSignifs = false;
        if (options.styles != null && options.styles.signifs != null)
            bSignifs = true;

        if (flgPass) {

            // Calcul de la signif
            if (bSignifs)
                for (var z = 0; z < options.styles.signifs.length; z++) {

                    // R�cup�ration du score et de la base
                    ids_filtres_signif = Array.from(ids_filtres);
                    for (var y = 0; y < options.styles.signifs[z].contre.length; y++) {
                        var contre = options.styles.signifs[z].contre[y];
                        ids_filtres_signif[DATAS_dimensions.indexOf(contre.dim)] = contre.i;
                    }

                    var tmpDATAS_signif = obtenirDonnee(ids_filtres_signif);

                    // D�finition des seuils
                    if (options.styles.signifs[z].seuils != null) seuils = options.styles.signifs[z].seuils;
                    else seuils = [95];

                    // Obtention de la diff significative
                    tmpDATAS[options.styles.signifs[z].nomProp] = obtSignif(tmpDATAS.s, tmpDATAS_signif.s, tmpDATAS.b, tmpDATAS_signif.b, tmpDATAS.e, tmpDATAS_signif.e, seuils);
                }

            var data_keys = Object.keys(tmpDATAS);
            for (var z = 0; z < data_keys.length; z++) {
                if (flgFill) custom_dimension_filter["donnee"][data_keys[z]] = tmpDATAS[data_keys[z]];
                else custom_dimension_filter["donnee"][data_keys[z]] = -1;
            }

            custom_dimension_filter["donnee"]["valeurRef"] = valeurRef;
        }
    }

    // Proc�dure de tri du tableau de donn�es final
    if (options.triDim1 != null || options.triDim2 != null) {

        // Si tri sur deuxi�me dimension
        if (flgMultiDatas && flgSingleDatas) {

            if (options.triDim2 != null) {
                var sens2 = options.triDim2.sens != null ? options.triDim2.sens : "asc";
                var prop2 = options.triDim2.prop != null ? options.triDim2.prop : "i";

                if (Object.keys(custom_dimension_filter[dimension2][0]).indexOf(prop2) == -1) throw new Error("La propri�t� '" + prop2.toString() + "' sp�cifi�e n'existe pas pour la deuxi�me dimension.");

                trierTableau(custom_dimension_filter[dimension2], sens2, prop2);
            }

            // Tri sur la premi�re dimension en suppl�ment si existant
            if (options.triDim1 != null) {

                var sens1 = options.triDim1.sens != null ? options.triDim1.sens : "asc";
                var prop1 = options.triDim1.prop != null ? options.triDim1.prop : "i";

                var dim2indice = obtIndiceParProp(custom_dimension_filter[dimension2], 'i', idDim2);
                var ordreDim1 = trierTableau(custom_dimension_filter[dimension2][dim2indice][dimension1], sens1, prop1);

                for (var i = 0; i < custom_dimension_filter[dimension2].length; i++)
                    if (i != dim2indice)
                        trierTableau(custom_dimension_filter[dimension2][i][dimension1], null, null, ordreDim1)
                
            }
        }

        // Si tri sur premi�re dimension mais pas la deuxi�me
        if (!flgMultiDatas && flgSingleDatas && options.triDim1 != null) {
            
            var sens1 = options.triDim1.sens != null ? options.triDim1.sens : "asc";
            var prop1 = options.triDim1.prop != null ? options.triDim1.prop : "i";

            if (custom_dimension_filter[dimension1].length > 0 && Object.keys(custom_dimension_filter[dimension1][0]).indexOf(prop1) == -1)
                throw new Error("La propri�t� '" + prop1.toString() + "' sp�cifi�e n'existe pas pour la premi�re dimension.");
            
            trierTableau(custom_dimension_filter[dimension1], sens1, prop1);
        }

    }

    // Filtrage sur les Bottoms
    if (options.showLastsSeries != null || options.showLasts != null) {

        // Si filtrage sur deuxi�me dimension
        if (flgMultiDatas && flgSingleDatas) {

            if (options.showLastsSeries != null) {
                for (var i = custom_dimension_filter[dimension2].length - options.showLastsSeries - 1; i >= 0; i--)
                    custom_dimension_filter[dimension2].splice(i, 1);
            }

            if (options.showLasts != null) 
                for (var i = 0; i < custom_dimension_filter[dimension2].length; i++)
                    for (var j = custom_dimension_filter[dimension2][i][dimension1].length - options.showLasts - 1; j >= 0; j--)
                        custom_dimension_filter[dimension2][i][dimension1].splice(j, 1);
            

        }

        // Si filtrage sur premi�re dimension mais pas la deuxi�me
        if (!flgMultiDatas && flgSingleDatas && options.showLasts != null) {

            for (var i = custom_dimension_filter[dimension1].length - options.showLasts - 1; i >= 0; i--)
                custom_dimension_filter[dimension1].splice(i, 1);

        }

    }

    // Filtrage sur les Top
    if (options.showFirstsSeries != null || options.showFirsts != null) {

        // Si filtrage sur deuxi�me dimension
        if (flgMultiDatas && flgSingleDatas) {

            if (options.showFirstsSeries != null)
                for (var i = custom_dimension_filter[dimension2].length - 1; i >= options.showFirstsSeries; i--)
                    custom_dimension_filter[dimension2].splice(i, 1);

            if (options.showFirsts != null) 
                for (var i = 0; i < custom_dimension_filter[dimension2].length; i++)
                    for (var j = custom_dimension_filter[dimension2][i][dimension1].length - 1; j >= options.showFirsts; j--)
                        custom_dimension_filter[dimension2][i][dimension1].splice(j, 1);
            

        }

        // Si filtrage sur premi�re dimension mais pas la deuxi�me
        if (!flgMultiDatas && flgSingleDatas && options.showFirsts != null) {

            for (var i = custom_dimension_filter[dimension1].length - 1; i >= options.showFirsts; i--)
                custom_dimension_filter[dimension1].splice(i, 1);

        }

    }

    
    return custom_dimension_filter;
}

/**
 * Remplir les donn�es d'un graphe. Retourne optionnellement une copie de l'objet de niveau 'dataSource' (pratique pour un 'console.log')
 * @param {object} objJSON Objet JSON � mettre au niveau 'dataSource'
 * @param {Array<int>} ids_filtres Filtres concern�s
 * @returns {object}
 */
function remplirDonnees(objJSON, ids_filtres, options = null) {

    // On filtre les donn�es selon les IDs entr�s en param�tre, mais peut aussi prendre une liste filtr�e directement
    var donneesFiltrees = {};
    if (ids_filtres.length != null)
        donneesFiltrees = filtrerDonnees(ids_filtres, options)
    else donneesFiltrees = ids_filtres;

    if (options == null) options = {};

    var bSignifs = false;
    if (options.styles != null && options.styles.signifs != null) {
        bSignifs = true;
        if (objJSON.annotations == null) { objJSON.annotations = {}; }
        if (objJSON.annotations.groups == null) { objJSON.annotations.groups = []; }

        // Supression des annotations de signifs
        for (var z = objJSON.annotations.groups.length - 1; z >= 0; z--)
            if (objJSON.annotations.groups[z].id.indexOf("signifs_") > -1)
                objJSON.annotations.groups.splice(z, 1);
    }

    // SI Multi-s�rie
    if (donneesFiltrees.dimension2 != null && donneesFiltrees.dimension1 != null) {
        
        objJSON.dataset = [];
        objJSON.categories[0].category = [];

        var dimension2 = donneesFiltrees.dimension2;
        var dimension1 = donneesFiltrees.dimension1;

        var libSeries = options.libSeries != null ? options.libSeries : true;
        var libCategories = options.libCategories != null ? options.libCategories : true;

        for (var i = 0; i < donneesFiltrees[dimension2].length; i++) {

            var indexSignif = -1;
            if (bSignifs) { // Cr�ation d'un groupe de significativit� pour la s�rie (ce qui peut �tre utile pour faire des op�ration sur une s�rie en particulier)
                objJSON.annotations.groups.push({ "id": "signifs_serie_" + i, "showBelow": "0", "items": [] });
                indexSignif = objJSON.annotations.groups.length - 1;
            }

            objJSON.dataset.push({ "seriesname": (libSeries ? donneesFiltrees[dimension2][i].n : ""), "data": [] });

            var subObjDim1 = donneesFiltrees[dimension2][i];
            for (var j = 0; j < subObjDim1[dimension1].length; j++) {

                // Ecriture des donn�es
                if (i == 0)
                    objJSON.categories[0].category.push({ "label": (libCategories ? subObjDim1[dimension1][j].n : "") });

                if (subObjDim1[dimension1][j].s > -1) {
                    objJSON.dataset[i].data.push({ "value": subObjDim1[dimension1][j].s });

                    if (bSignifs) // Cr�ation de l'annotation de signif
                        for (var z = 0; z < options.styles.signifs.length; z++)
                            objJSON.annotations.groups[indexSignif].items.push(creerAnnotation("signif", "signif_" + z + "_serie_" + i + "_categorie_" + j, options.typeGraphe, options.styles.signifs[z], subObjDim1[dimension1][j], i, j));
                }
                else objJSON.dataset[i].data.push({ "value": "" });

            }
        }
    }
    
    // SI Simple-s�rie
    if (donneesFiltrees.dimension2 == null && donneesFiltrees.dimension1 != null) {
        objJSON.data = [];
        var dimension1 = donneesFiltrees.dimension1;

        var indexSignif = -1;
        if (bSignifs) { // Cr�ation d'un groupe de significativit�
            objJSON.annotations.groups.push({ "id": "signifs_serie_0", "showBelow": "0", "items": [] });
            indexSignif = objJSON.annotations.groups.length - 1;
        }

        for (var j = 0; j < donneesFiltrees[dimension1].length; j++) {


            if (donneesFiltrees[dimension1][j]["s"] > -1) {

                if (bSignifs) { // Cr�ation de l'annotation de signif
                    for (var z = 0; z < options.styles.signifs.length; z++)
                        if (options.styles.signifs[z].type != "custom")
                            objJSON.annotations.groups[indexSignif].items.push(creerAnnotation("signif", "signif_" + z + "_categorie_" + j, options.typeGraphe, options.styles.signifs[z], donneesFiltrees[dimension1][j], 0, j));
                        else {
                            var elementAnn = options.styles.signifs[z].elements[donneesFiltrees[dimension1][j][options.styles.signifs[z].nomProp] - 1];
                            if (elementAnn.x != null && elementAnn.y != null) {
                                elementAnn.x = elementAnn.x.replace("�indexSerie�", "0").replace("�indexCat�", j);
                                elementAnn.y = elementAnn.y.replace("�indexSerie�", "0").replace("�indexCat�", j);
                                if (elementAnn.tox != null && elementAnn.toy != null) {
                                    elementAnn.tox = elementAnn.tox.replace("�indexSerie�", "0").replace("�indexCat�", j);
                                    elementAnn.toy = elementAnn.toy.replace("�indexSerie�", "0").replace("�indexCat�", j);
                                }
                                objJSON.annotations.groups[indexSignif].items.push(elementAnn);
                            }
                        }
                }
                        

                objJSON.data.push({ "value": donneesFiltrees[dimension1][j].s, "label": donneesFiltrees[dimension1][j].n });
            }
            else objJSON.data.push({ "value": "", "label": donneesFiltrees[dimension1][j].n });

        }
    }
    
    // SI Simple
    if (donneesFiltrees.dimension2 == null && donneesFiltrees.dimension1 == null) {
        
        objJSON.data = [];
        var indexSignif = -1;
        if (bSignifs) { // Cr�ation d'un groupe de significativit�
            objJSON.annotations.groups.push({ "id": "signifs_serie_0", "showBelow": "0", "items": [] });
            indexSignif = objJSON.annotations.groups.length - 1;
        }

        if (donneesFiltrees["donnee"].s > -1) {

            var indexCat = -1;
            if (options.rotationAntiHoraire) {
                indexCat = 0;
                objJSON.data.push({ "value": donneesFiltrees["donnee"].s, "label": "" });
                objJSON.data.push({ "value": donneesFiltrees["donnee"].valeurRef - donneesFiltrees["donnee"].s, "label": "" });
            } else {
                indexCat = 1;
                objJSON.data.push({ "value": donneesFiltrees["donnee"].valeurRef - donneesFiltrees["donnee"].s, "label": "" });
                objJSON.data.push({ "value": donneesFiltrees["donnee"].s, "label": "" });
            }

            if (bSignifs) // Cr�ation de l'annotation de signif
                for (var z = 0; z < options.styles.signifs.length; z++)
                    objJSON.annotations.groups[indexSignif].items.push(creerAnnotation("signif", "signif_" + z + "_categorie_" + indexCat, options.typeGraphe, options.styles.signifs[z], donneesFiltrees["donnee"], indexSignif, indexCat));

        }
        
    }


    // Application du changement de style au graphe
    if (options.styles != null && options.styles.chart != null) {
        var keys = Object.keys(options.styles.chart);
        for (var i = 0; i < keys.length; i++)
            objJSON.chart[keys[i]] = options.styles.chart[keys[i]];
    }

    return Object.assign({}, objJSON);
}

/**
 * Fonction de cr�ation d'une annotation avec mise en forme automatique
 * @param {string} typeAnn type de visualisation auto
 * @param {string} idAnn ID pour identifier l'annotation
 * @param {string} typeGraphe type de graphe
 * @param {any} options options importantes pour le bon affichage des �l�ments
 * @param {number} valeur valeur de la significativit�
 * @param {number} indexSerie index de la s�rie
 * @param {number} indexCategorie index de la cat�gorie
 */
function creerAnnotation(typeAnn, idAnn, typeGraphe, options, valeur, indexSerie, indexCategorie) {

    typeAnn = typeAnn.toLowerCase();
    typeGraphe = typeGraphe.toLowerCase();
    
    var resultat = { "id": idAnn };

    var decalageX = 0;
    if (options.decalageX != null) 
        decalageX = options.decalageX;

    var decalageY = 0;
    if (options.decalageY != null)
        decalageY = options.decalageY;

    
    if (options.scale != null) {
        resultat.Xscale = options.scale.toString();
        resultat.Yscale = options.scale.toString();
    }
    
    resultat.type = options.type;

    if (options.type == "image") {
        resultat.url = options.elements[valeur[options.nomProp] - 1];
    }

    if (options.type == "image" || options.type == "text") {
        resultat.align = "center";
        resultat.valign = "middle";
    }

    if (options.position == "centre") {
        resultat.x = "$canvasCenterX ";
        resultat.y = "$canvasCenterY ";
    }

    if (options.position.indexOf("score") > -1) {
        resultat.x = "$dataset." + indexSerie + ".set." + indexCategorie + ".x ";
        resultat.y = "$dataset." + indexSerie + ".set." + indexCategorie + ".y ";
        if (options.position.indexOf("_droite") > -1) resultat.x = "$dataset." + indexSerie + ".set." + indexCategorie + ".endx ";
        if (options.position.indexOf("_gauche") > -1) resultat.x = "$dataset." + indexSerie + ".set." + indexCategorie + ".startx ";
        if (options.position.indexOf("_haut") > -1) resultat.y = "$dataset." + indexSerie + ".set." + indexCategorie + ".starty ";
        if (options.position.indexOf("_bas") > -1) resultat.y = "$dataset." + indexSerie + ".set." + indexCategorie + ".endy ";
    }

    if (options.position.indexOf("label") > -1) {
        resultat.x = "$xaxis.label." + indexCategorie + ".x ";
        resultat.y = "$xaxis.label." + indexCategorie + ".y ";
        if (options.position.indexOf("_droite") > -1) resultat.x = "$xaxis.label." + indexCategorie + ".endx ";
        if (options.position.indexOf("_gauche") > -1) resultat.x = "$xaxis.label." + indexCategorie + ".startx ";
        if (options.position.indexOf("_haut") > -1) resultat.y = "$xaxis.label." + indexCategorie + ".starty ";
        if (options.position.indexOf("_bas") > -1) resultat.y = "$xaxis.label." + indexCategorie + ".endy ";
    }

    if (resultat.x != null) resultat.x = resultat.x + forceSigne(decalageX, -1, true);
    if (resultat.y != null) resultat.y = resultat.y + forceSigne(decalageY, -1, true);
    if (resultat.tox != null) resultat.tox = resultat.tox + forceSigne(decalageX, -1, true);
    if (resultat.toy != null) resultat.toy = resultat.toy + forceSigne(decalageY, -1, true);

    console.log(resultat);
    return resultat;

}

/**
 * Permet de remplir automatiquement le tableaux de donn�es "DATAS" avec de fausses donn�es
 * @param {Array<string>} listes_dimensions Tableau des listes d'�l�ments souhait�s pour remplir l'objet de donn�es. Le nombre de tableaux donne le nombre de dimensions pour l'objet final. L'ordre des listes est important.
 * @param {number} valeurMin Valeur minimum � int�grer. (Par d�faut 0)
 * @param {number} valeurMax Valeur maximum � int�grer. (Par d�faut 100)
 * @param {number} baseMin Base minimum � int�grer. (Par d�faut 100)
 * @param {number} baseMax Base maximum � int�grer. (Par d�faut 1000)
 * @param {number} decimal Nombre de d�cimales � int�grer (Par d�faut le maximum de d�cimales)
 * @param {number} niveauxSignif Nombre de niveaux de significativit� � prendre en compte.
 * @returns {object}
 */
function donneesAleatoires(valeurMin = 0, valeurMax = 100, baseMin = 100, baseMax = 1000, decimales = -1, niveauxSignif = -1) {

    
    var listes = [];
    if (DATAS_dimensions != null && DATAS_dimensions.length > 0) {
        for (var i = 0; i < DATAS_dimensions.length; i++) {
            listes.push(INFOS[DATAS_dimensions[i]]);
        }
    } else throw new Error("Le tableau dimensionnel n'existe pas ou ne contient aucun �l�ment.");

    // Fonction r�cursive interne (peut traiter un nombre de dimensions variable)
    var donneesAleatoires_Recursif = function (listes, valeurMin = 0, valeurMax = 100, baseMin = 100, baseMax = 600, decimales = -1, niveauxSignif = -1, index, tmpDATAS) {
        if (tmpDATAS == null) tmpDATAS = {};
        if (index < listes.length) {
            for (var i = 0; i < listes[index].length; i++) {
                tmpDATAS[listes[index][i].i] = {};
                if (index < listes.length - 1)
                    donneesAleatoires_Recursif(listes, valeurMin, valeurMax, baseMin, baseMax, decimales, niveauxSignif, index + 1, tmpDATAS[listes[index][i].i]);
                else {
                    tmpDATAS[listes[index][i].i]["s"] = alea(valeurMin, valeurMax, decimales);
                    tmpDATAS[listes[index][i].i]["b"] = alea(baseMin, baseMax, 0);
                    if (niveauxSignif > 1)
                        tmpDATAS[listes[index][i].i]["d"] = alea(1, 5, 0);
                }
            }
        }
        return tmpDATAS;
    }

    // Traitement
    return donneesAleatoires_Recursif(listes, valeurMin, valeurMax, baseMin, baseMax, decimales, niveauxSignif, 0);
}

/**
 * Permet de g�n�rer un nombre al�atoire.
 * @param {number} valeurMin Valeur minimum pour la g�n�ration du nombre al�atoire. (Par d�faut 0)
 * @param {number} valeurMax Valeur minimum pour la g�n�ration du nombre al�atoire. (Par d�faut 100)
 * @param {number} decimales nombre de d�cimales maximum pour la g�n�ration du nombre al�atoire. (Par d�faut le maximum de d�cimales)
 * @returns {number}
 */
function alea(valeurMin = 0, valeurMax = 100, decimales = -1) {
    if (valeurMin >= valeurMax) throw new Error("La valeur minimum ne peut �tre sup�rieure ou �gale � la valeur maximum.");
    return arrondi(valeurMin + Math.random() * (valeurMax - valeurMin), decimales);
}

/**
 * Permet d'arrondir un nombre � la d�cimale souhait�e
 * @param {number} nombre Nombre � arrondir.
 * @param {number} decimales Nombre de d�cimales � arrondir. (Par d�faut 0)
 * @returns {number}
 */
function arrondi(nombre, decimales = 0) {
    if (decimales < -1) throw new Error("Le nombre de d�cimales ne peut �tre inf�rieur � -1.");

    var neg = nombre < 0;
    if (decimales == -1)
        return nombre;
    else {
        var nombre_abs = Math.round(Math.abs(nombre) * Math.pow(10, decimales)) / Math.pow(10, decimales);
        if (neg) return -nombre_abs
        else return nombre_abs;
    }
}

/** 
 * Permet de forcer l'affichage du signe relatif du nombre pass� en param�tre
 * @param {number} nombre Nombre � signer
 * @param {number} decimales Arrondi possible
 * @param {boolean} forceZero Permet de forcer le signe '+' sur le z�ro
 * @returns {string}
 */
function forceSigne(nombre, decimales = -1, forceZero = false) {
    var nombreArr = arrondi(nombre, decimales);
    if (forceZero)
        return (nombreArr >= 0 ? "+" : "") + nombreArr.toString();
    else return(nombreArr > 0 ? "+" : "") + nombreArr.toString();
}

/**
 * Permet de trier un tableau
 * @param {any} arr Tableau � trier
 * @param {any} sens Sens de tri: 'ASC' ou 'DESC'
 * @param {any} prop Propri�t� de v�rification de la valeur de tri
 */
function trierTableau(arr, sens, prop, ordreDefini) {


    var original_arr = Object.assign([], arr);

    if (ordreDefini != null) {
        arr.sort(function (elemA, elemB) {
            if (ordreDefini[original_arr.indexOf(elemA)] < ordreDefini[original_arr.indexOf(elemB)]) { return -1; }
            if (ordreDefini[original_arr.indexOf(elemA)] > ordreDefini[original_arr.indexOf(elemB)]) { return 1; }
            return 0;
        });
    } else {
        if (prop != null) {
            if (sens.toLowerCase() == "asc")
                arr.sort(function (elemA, elemB) {
                    if (elemA[prop] < elemB[prop]) { return -1; }
                    if (elemA[prop] > elemB[prop]) { return 1; }
                    return 0;
                });
            if (sens.toLowerCase() == "desc") {
                arr.sort(function (elemA, elemB) {
                    if (elemA[prop] < elemB[prop]) { return 1; }
                    if (elemA[prop] > elemB[prop]) { return -1; }
                    return 0;
                });
            }
        }
        else {
            if (sens.toLowerCase() == "asc")
                arr.sort(function (elemA, elemB) {
                    if (elemA < elemB) { return -1; }
                    if (elemA > elemB) { return 1; }
                    return 0;
                });
            if (sens.toLowerCase() == "desc")
                arr.sort(function (elemA, elemB) {
                    if (elemA < elemB) { return 1; }
                    if (elemA > elemB) { return -1; }
                    return 0;
                });
        }

        var ordreIndices = [];
        for (var zz = 0; zz < original_arr.length; zz++)
            ordreIndices.push(arr.indexOf(original_arr[zz]));

        return ordreIndices
    }
}

/**
 * Fonction permettant de rechercher l'indice du premier �l�ment parmi une liste selon la propri�t� et la valeur indiqu�e.
 * @param {Array<any>} tableau Tableau � parcourir.
 * @param {string} prop Propri�t� � v�rifier (mettre 'null' si c'est un tableau de valeurs et non d'objets)
 * @param {any} valeur Valeur � comparer.
 * @returns {number}
 */
function obtIndiceParProp(tableau, prop, valeur) {

    if (prop != null) {
        for (var i = 0; i < tableau.length; i++)
            if (tableau[i][prop] != null && tableau[i][prop] == valeur)
                return i;
    }
    else {
        for (var i = 0; i < tableau.length; i++)
            if (tableau[i] == valeur)
                return i;
    }

}

/**
* Fonction permettant de recharcher le premier �l�ment parmi une liste selon la propri�t� et la valeur indiqu�e.
 * @param {Array<any>} tableau Tableau � parcourir.
 * @param {string} prop Propri�t� � v�rifier (mettre 'null' si c'est un tableau de valeurs et non d'objets)
 * @param {any} valeur Valeur � comparer.
 * @returns {any}
 */
function obtElementParProp(tableau, prop, valeur) {

    if (prop != null) {
        for (var i = 0; i < tableau.length; i++)
            if (tableau[i][prop] != null && tableau[i][prop] == valeur)
                return tableau[i];
    }
    else {
        for (var i = 0; i < tableau.length; i++)
            if (tableau[i] == valeur)
                return tableau[i];
    }

}

/**
* Fonction permettant de recharcher le premier �l�ment parmi une liste selon la propri�t� et la valeur indiqu�e.
 * @param {Array<any>} tableau Tableau � parcourir.
 * @param {Array<string>} props Tableau de propri�t� � v�rifier (mettre 'null' si c'est un tableau de valeurs et non d'objets)
 * @param {Array<any>} valeurs Valeur � comparer.
 * @param {srting} logique Logique 'ET' ou 'OU' ou 'DESORDRE'
 * @returns {any}
 */
function obtElementParProps(tableau, props, valeurs, logique = "ET", ordre = true) {

    if (props != null) {

        if (ordre) {

            for (var i = 0; i < tableau.length; i++) {
                var count = 0;
                for (var j = 0; j < props.length; j++)
                    if (tableau[i][props[j]] != null && tableau[i][props[j]] == valeurs[j])
                        count++;

                if ((count == props.length && logique == "ET") || (count > 1 && logique == "OU"))
                    return tableau[i];
            }

        } else {
            
            for (var i = 0; i < tableau.length; i++) {
                
                var valeursRestantes = Array.from(valeurs);
                var indicePropFaits = [];
                for (var j = 0; j < props.length; j++)
                    if (indicePropFaits.indexOf(j) == -1)
                        for (var k = valeursRestantes.length; k >= 0; k--)
                            if (valeursRestantes[k] == tableau[i][props[j]]) {
                                valeursRestantes.splice(k, 1);
                                indicePropFaits.push(j);
                                break;
                            }

                //console.log(tableau[i]);
                //console.log(valeursRestantes.length);
                if ((valeursRestantes.length == 0 && logique == "ET") || (valeursRestantes.length < valeurs.length && logique == "OU"))
                    return tableau[i];
            }
        }
    }
    else {
        for (var i = 0; i < tableau.length; i++)
            if (tableau[i] == valeurs[0])
                return tableau[i];
    }

}

/**
 * Permet de savoir si la donn�e sp�cifi�e est nulle.
 * @param {any} obj
 * @param {any} params
 */
function EstNul_objetEnCascade(obj, params) {

    var tmpJSON = obj;
    if (tmpJSON != null)
        for (var i = 0; i < params.length; i++) {
            tmpJSON = tmpJSON[params[i]];
            if (tmpJSON == null) break;
        }
    
    return (tmpJSON == null);

}

var angleActuel = {};
var intervalActuel = {};
/**
 * Permet de faire une rotation continue du doughnut
 * @param {string} grapheId Id du graphe concern�
 * @param {number} vitesse Vitesse de rotation de 1 � 4
 * @param {boolean} animation Animation
 */
function rotationContinue(grapheId, vitesse = 1, animation = true) {

    // On v�rifie si une animation est pr�sente au d�marrage du graphe
    var decalageDemarrage = 0;
    if (animation && FusionCharts(grapheId).args.dataSource.chart.animation != null && Number(FusionCharts(grapheId).args.dataSource.chart.animation) > 0) {
        decalageDemarrage = 1000;
        if (FusionCharts(grapheId).args.dataSource.chart.animationDuration != null) {
            decalageDemarrage = Number(FusionCharts(grapheId).args.dataSource.chart.animationDuration);
        }
    }
    
    angleActuel[grapheId] = FusionCharts(grapheId).args.dataSource.chart.startingAngle != null ? FusionCharts(grapheId).args.dataSource.chart.startingAngle : 0;

    var nbMillisecondesParDegre = 40;

    var additionneurDegre = 1;
    if (vitesse == 1) additionneurDegre = 1;
    if (vitesse == 2) additionneurDegre = 2;
    if (vitesse == 3) additionneurDegre = 3;
    if (vitesse == 4) additionneurDegre = 4;

    clearInterval(intervalActuel[grapheId]);
    setTimeout(function () {
        intervalActuel[grapheId] = setInterval(function () {
            FusionCharts(grapheId).startingAngle(angleActuel[grapheId] += additionneurDegre);
        }, nbMillisecondesParDegre);
    }, decalageDemarrage);
}

/**
 * Permet de calculer la diff�rence significative d'un score en particulier
 * @param {Number} score1 Score/Moyenne � comparer
 * @param {Number} score2 Score/Moyenne compar�
 * @param {Number} base1 Base du score � comparer
 * @param {Number} base2 Base du score compar�
 * @param {Number} et1 Ecart-Type de la moyenne � comparer
 * @param {Number} et2 Ecart-Type de la moyenne compar�e
 * @param {Array<Number>} seuils Seuils de significativit�s possibles
 */
function obtSignif(score1 = -1, score2 = -1, base1 = -1, base2 = -1, et1 = -1, et2 = -1, seuils = [95]) {

    if (score1 == -1 || base1 == -1) throw new Error("Vous devez entrer au moins le score1 et la base1");
    if (score1 > -1 && score2 > -1 && (base1 == -1 || base2 == -1)) throw new Error("Pour la significativit�, il y a deux scores entr�s mais une seule base seulement.");
    if (score1 > -1 && score2 > -1 && ((et1 > -1 && et2 == -1) || (et2 > -1 && et1 == -1))) throw new Error("Pour la significativit�, il y a deux scores entr�s mais un seul ecart-type seulement.");
    if (base1 > -1 && base2 > -1 && (score1 == -1 || score2 == -1)) throw new Error("Pour la significativit�, il y a deux bases entr�es mais un seul score seulement.");
    if (base1 > -1 && base2 > -1 && ((et1 > -1 && et2 == -1) || (et2 > -1 && et1 == -1))) throw new Error("Pour la significativit�, il y a deux bases entr�es mais un seul ecart-type seulement.");
    if (et1 > -1 && et2 > -1 && (base1 == -1 || base2 == -1 || score1 == -1 || score2 == -1)) throw new Error("Pour la significativit�, il y a deux ecarts-types entr�s mais il manque au moins une base ou un score.");

    var seuilsPossibles = [
        { "s": 50, "c": 0.674 },
        { "s": 60, "c": 0.842 },
        { "s": 70, "c": 1.036 },
        { "s": 80, "c": 1.282 },
        { "s": 90, "c": 1.645 },
        { "s": 95, "c": 1.96 },
        { "s": 99, "c": 2.576 },
        { "s": 99.9, "c": 3.291 }
    ];

    var coeff = obtCoefSignif(score1, score2, base1, base2, et1, et2); // Calcul du coefficient

    // R�cup�ration du seuil le plus fort
    var dernierSeuil = { "s": -1, "c": -1 };
    for (var i = 0; i < seuils.length; i++)
        if (dernierSeuil.s < seuils[i]) {
            var seuil = obtElementParProp(seuilsPossibles, 's', seuils[i]);
            if (seuil == null) throw new Error("Le seuil '" + seuils[i] + "' n'est pas pr�vu par la librairie. Veuillez utiliser les seuils sivants : 50, 60, 70, 80, 90, 95, 99, 99.9");
            if (coeff > seuil.c)
                dernierSeuil.s = seuils[i];
        }

    // D�termination de la significativit�
    var signifResult = seuils.length + 1;
    if (dernierSeuil.s > -1) {
        if (score1 > score2)
            signifResult = signifResult + (seuils.indexOf(dernierSeuil.s) + 1);
        else signifResult = signifResult - (seuils.indexOf(dernierSeuil.s) + 1);
    }

    return signifResult;

}

/**
* Permet de calculer le coefficient de significativit� (T de Student)
* @param {Number} score1 Score/Moyenne � comparer
* @param {Number} score2 Score/Moyenne compar�
* @param {Number} base1 Base du score � comparer
* @param {Number} base2 Base du score compar�
* @param {Number} et1 Ecart-Type de la moyenne � comparer
* @param {Number} et2 Ecart-Type de la moyenne compar�e
*/
function obtCoefSignif(score1 = -1, score2 = -1, base1 = -1, base2 = -1, et1 = -1, et2 = -1) {

    
    var coef = -1;
    var num = -1;
    var prop = -1;

    if (score1 > -1 && score2 > -1 && base1 > 0 && base2 > 0 && et1 < 0 && et2 < 0) { // deux scores
        num = Math.abs((score1 / 100) - (score2 / 100));
        prop = ((base1 * score1 / 100) + (base2 * score2 / 100)) / (base1 + base2);
        coef = num / (Math.sqrt(prop * (1 - prop) * ((1 / base1) + (1 / base2))));
    } else if (score1 > -1 && score2 > -1 && base1 > 0 && base2 > 0 && et1 > -1 && et2 > -1) { // deux moyennes
        num = Math.abs(score1 - score2);
        prop = (Math.pow(et1, 2) / base1) + (Math.pow(et2, 2) / base2);
        coef = num / Math.sqrt(prop);
    } else if (score1 > -1 && score2 < 0 && base1 > 0 && base2 < 0 && et1 < 0 && et2 < 0) { // un score
        // A INTEGRER
    } else if (score1 > -1 && score2 < 0 && base1 > 0 && base2 < 0 && et1 > -1 && et2 < 0) { // une moyenne
        // A INTEGRER
    }

    return coef;

}

/**
 * Permet de mettre � jour intelligemment un objet en parcourant les objets et modifiant les �l�ments concern�s uniquement.
 * @param {any} oldObj Objet � mettre � jour
 * @param {any} newObj Objet avec les �l�mentsde mis � jour
 */
function mettreAjourObjet(oldObj, newObj) {

    if (typeof (newObj) == "object") {

        if (newObj.length == null) { // objet

            if (oldObj == null)
                oldObj = newObj;
            else {
                var keys = Object.keys(newObj);
                if (keys.length > 0) {
                    for (var i = 0; i < keys.length; i++) {
                        oldObj[keys[i]] = mettreAjourObjet(oldObj[keys[i]], newObj[keys[i]]);
                    }
                }
                else oldObj = newObj;
            }
        } else // tableau
            if (oldObj == null)
                oldObj = newObj;
            else
                if (oldObj.length != newObj.length || newObj.length == 0) {
                    oldObj = newObj
                } else
                    for (var i = 0; i < newObj.length; i++)
                        oldObj[i] = mettreAjourObjet(oldObj[i], newObj[i]);

    } else {
        oldObj = newObj;
    }
    
    return oldObj;
    
}

/**
 * Permet de r�cup�rer une information de donn�e pour la s�lection pass�e en param�tre
 * @param {Array<Number>} ids_filtres
 */
function obtenirDonnee(ids_filtres) {

    var tmpDATAS = DATAS;
    var flgNull = false;
    for (var k = 0; k < ids_filtres.length && !flgNull; k++) {
        if (ids_filtres[k] > 0) {
            if (tmpDATAS[ids_filtres[k]] != null) tmpDATAS = tmpDATAS[ids_filtres[k]];
            else flgNull = true;
        }
        else throw new Error("Le param�tre 'ids_filtres' ne doit contenir que des IDs valides (sup�rieurs � 0)")
    }

    if (!flgNull) return tmpDATAS;
    else return null;


}