﻿//Eventually, I need to split all this code into several files and then bundle on build

var currentPage = null;

/**
 * On page load
 */
$(document).ready(function () {
    InitializeLayout();

    //The Search and Card page both derive from the same layout page
    //So they share the same JS. This ensures we only load the stuff for the appropriate page,
    //regardless of the domain.
    currentPage = GetCurrentPage();
    if (currentPage === Page.Home) {
        InitializeHomePage();
    }
    else if (currentPage === Page.Search) {
        InitializeSearchPage();
    }
    else if (currentPage === Page.Card) {
        InitializeCardPage();
    } else if (currentPage === Page.Sets) {
        InitializeSetsPage();
    }
    else if (currentPage === Page.Advanced) {
        InitializeAdvancedPage();
    }
});
//Shows the card from the grid when hovered over
//https://stackoverflow.com/a/1678194/1339826
$(document).mousemove(function (e) {
    var img = $(singleCardSearchElementIds.HoverImageClassName);
    var windowScrollY = window.scrollY;
    img.css({ 'top': windowScrollY + e.clientY, 'left': e.clientX + 20 });
});

function InitializeLayout() {
    InitializeLayouElements();
}
function InitializeHomePage() {
    /* Card search initialization */
    InitializeSearchBoxOnNonSearchPage();
}
function InitializeSearchPage() {
    /* Card set initialization */
    SetCardSets();

    /* Card search initialization */
    InitializeCardSearchElements();
    SetValuesFromQueryAndPeformCardSearch();
    InitializeCardTable();

    /* Crest initialization */
    InitializeCrestElements();

    /* Modal initialization */
    InitializeModal();
}
function InitializeCardPage() {
    /* Card search initialization */
    InitializeSearchBoxOnNonSearchPage();

    /* Perform card search */
    //SetValuesFromQueryAndPeformSingleCardSearch();
}
function InitializeSetsPage() {
    /* Sets table initialization */
    InitializeSetsTable();

    /* Populate sets table */
    PopulateSetsTable();

    /* Card search initialization */
    InitializeSearchBoxOnNonSearchPage();
}
function InitializeAdvancedPage() {
    /* Advanced search initialization */
    InitializeAdvancedSearchElements();

    /* Card search initialization */
    InitializeSearchBoxOnNonSearchPage();
}

/**
 * Layout
 * -----------------------------------------------------------------------------------------------------
 */
function InitializeLayouElements() {
    //Clear search
    $(searchElementNames.SearchInputId).on('keyup', function () {
        var clear = $(searchElementNames.ClearSearchClassName);
        if ($(this).val() === '') {
            if (!clear.hasClass('vh')) {
                clear.addClass('vh');
            }
        }
        else {
            if (clear.hasClass('vh')) {
                clear.removeClass('vh');
            }
        }
    });
    $(searchElementNames.ClearSearchClassName).on('click', function () {
        var search = $(searchElementNames.SearchInputId);
        search.val('');

        $(this).addClass('vh');
    });
}


/**
 * Search - Card Sets
 * -----------------------------------------------------------------------------------------------------
 */

//We need to complete some activities after the sets have loaded
//Since that process isn't always fast, we'll set this variable and check it
var hasSetsLoaded = false;

function SetCardSets() {
    $.ajax({
        type: "POST",
        url: "Search?handler=GetSets",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("XSRF-TOKEN",
                $('input:hidden[name="__RequestVerificationToken"]').val());
        },
        contentType: false,
        processData: false,
        success: function (response) {
            //ClearErrors(); //hide any errors from previous requests

            if (response.success) {
                var sets = response.json;
                AddSetsToDropDown(sets);
            }
            else {
                //ShowErrors(response.message, response.info);
            }

            //SetDropDownMenuButtonLoadingState('unloading');
        },
        failure: function (response) {
            alert('Catastropic error');
        }
    });
}
function AddSetsToDropDown(sets) {
    var dropDownName = '#setSelect';

    //Clear all options before adding new ones, just in case
    $(dropDownName).find('option').remove();

    //Add empty item so the user can choose to not search by set if they want
    var emptyOption = '<option value="00000000-0000-0000-0000-000000000000">All Sets</option>';
    $(dropDownName).append(emptyOption);

    for (var i = 0; i < sets.length; i++) {
        var set = sets[i];
        var img = '/images/seticons/' + set.iconFileName;

        var option = '<option value="' + set.setId + '">' + set.name + '</option>';
        $(dropDownName).append(option);
    }

    hasSetsLoaded = true;
}

const LessonTypeName = {
    CareOfMagicalCreatures: 'Care of Magical Creatures',
    Charms: 'Charms',
    Potions: 'Potions',
    Quidditch: 'Quidditch',
    Transfiguration: 'Transfiguration',
};
const ImageSizeType = {
    Small: 0,
    Medium: 1,
    Large: 2,
};

/**
 * Card Search
 * -----------------------------------------------------------------------------------------------------
 */

const queryParameterNames = {
    SetId: 'setId',
    SearchText: 'searchText',
    SortBy: 'sortBy',
    SortOrder: 'sortOrder',
    CardView: 'cardView',
    CardId: 'cardId',
    AdvancedQuery: 'adv',
};

const searchElementNames = {
    SetId: '#setSelect',
    SearchInputId: '#searchInput',
    SortCardsById: '#sortCardsBy',
    CardModalId: '#cardModal',
    SortCardsOrderId: '#sortCardsOrder',
    CardViewId: '#cardView',
    CardCountId: '#cardCount',
    SetDateClassName: '.set-date',
    ClearSearchClassName: '.clear-search',
};

const resultsContainerNames = {
    ContentContainerId: '#contentContainer',
    CardContainerId: '#cardContainer',
    CardTableId: '#cardTable',
    CardTableContainerId: '#tableContainer',
    SearchResultsContainerId: '#searchResults',
    SetInfoContainerId: '#setInfo',
    SetHeaderIconClassName: '.set-header-title-icon',
    SetHeaderTitleClassName: '.set-header-title-h1',
    SetHeaderDataClassName: '.set-header-title-data',
    NoCardsContainerId: '#noCardsContainer',
};

/* Hold cards in global variable so we can swap views with the existing cards without
 * performing another query.
 */
var cards = null;

function InitializeCardSearchElements() {
    //Search text press enter
    $(searchElementNames.SearchInputId).on('keypress', function (e) {
        if (e.which === 13) {
            SearchCards();
            e.preventDefault();
        }
    });
    //Set change
    $(searchElementNames.SetId).on('change', function () {
        SearchCards();
    });
    //Card view change - images/list
    $(searchElementNames.CardViewId).on('change', function () {
        //Will swap the containers and populate the cards if they have been populated. Or performs the search if the cards haven't been populated
        ToggleViewSearch();
    });
    //Sort by change
    $(searchElementNames.SortCardsById).on('change', function () {
        //I found an issue while testing. While not a huge problem, it made the experience weird. I wanted it so that
        //you could choose the sort option and it would perform a search. Which was perfect when you had already entered search data.
        //But it became troublesome when you hadn't entered anything, as it would just search everything. So I thought it best to make
        //it so that it would only perform the search when they chose a proper sort option (not the default empty) and there was at
        //least one search field with a valid value.
        var searchData = GetSearchData();
        if ((searchData.SetId || searchData.LessonCost || searchData.SearchText) && searchData.SortBy) {
            SearchCards();
        }
    });
    //Sort order change
    $(searchElementNames.SortCardsOrderId).on('change', function () {
        var searchData = GetSearchData();
        if ((searchData.SetId || searchData.LessonCost || searchData.SearchText)) {
            SearchCards();
        }
    });
}
var cardTable = null;
function InitializeCardTable() {
    //This uses the DTJS absolute sorting algo to force empty values to the bottom of the list when
    //sorting by asc value
    var emptyAbsoluteOrderType = $.fn.dataTable.absoluteOrder({
        value: '', position: 'bottom'
    });

    cardTable = $(resultsContainerNames.CardTableId).DataTable({
        lengthChange: false,
        searching: false,
        paging: false,
        bInfo: false,
        columnDefs: [
            {
                //Hide the card ID column
                targets: [CardTableColumnIndex.CardId, CardTableColumnIndex.ImageUrl, CardTableColumnIndex.Lesson],
                visible: false,
            },
            {
                targets: [CardTableColumnIndex.Number],
                type: 'natural-nohtml', //This allow DT to sort the column alphanumerically
            },
            {
                targets: [CardTableColumnIndex.Lesson],
                type: emptyAbsoluteOrderType,
            }
        ],
        'createdRow': function (row, data, index) {
            $('td', row).on("mouseover", function () {
                var url = data[CardTableColumnIndex.ImageUrl];
                var cardId = data[CardTableColumnIndex.CardId];
                var img = $(singleCardSearchElementIds.HoverImageClassName);

                if (img.attr('src') === url)
                    return;

                var card = GetCardFromCardId(cardId); //We don't store the card orientation in the row data. So we have to loop through the cards list
                if (card.orientation === 'Horizontal') {
                    img.addClass('hover-card-rotate');
                }

                //Removes the image source so the background loading thing appears
                img.attr('src', '');
                //Remove the display none class immediately so the loader shows before the image has fully loaded
                img.removeClass('dn');
                //The image will load, but won't show until it's fully loaded. The loader CSS will show until the image has fully loaded
                img.attr('src', url);
            });
            $('td', row).on("mouseleave", function () {
                var img = $(singleCardSearchElementIds.HoverImageClassName);
                img.addClass('dn');

                //This class is only added on horizontal cards. But it's easier to just always remove it
                img.removeClass('hover-card-rotate');
            });
        }
    });

    $(resultsContainerNames.CardTableId + ' tbody').on('click', 'tr', function () {
        var data = cardTable.row(this).data();
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.cardId === data[0]) {
                RedirectToCardPage(card);
            }
        }
    });
}

function SearchCards() {
    HideAllContainers();
    ToggleLoading();

    const searchData = GetSearchData();

    //Once the user executes a search, we want to set the values from the search to the query string so they can
    //refresh the page and/or share the link without the page needing to be refreshed
    SetQueryFromValues(searchData);

    //Toggle search result/set data
    ToggleSearchResultData();

    var fd = new FormData();
    if (searchData.SetId) {
        fd.append('setId', searchData.SetId);
    }
    if (searchData.SearchText) {
        fd.append('searchText', searchData.SearchText);
    }
    if (searchData.SortBy) {
        fd.append('sortBy', searchData.SortBy);
    }
    if (searchData.SortOrder) {
        fd.append('sortOrder', searchData.SortOrder);
    }

    $.ajax({
        type: "POST",
        url: "Search?handler=SearchCards",
        data: fd,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("XSRF-TOKEN",
                $('input:hidden[name="__RequestVerificationToken"]').val());
        },
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                ToggleLoading();
                UnHideAllContainers();

                cards = response.json;
                $(searchElementNames.CardCountId).html(cards.length + ' cards');
                AddCardsToContainer(cards);
            }

            //SetSearchLoadingState('unloading');
        },
        failure: function (response) {
            alert('Catastropic error');
        }
    });
}
function SearchAdvancedCards() {
    HideAllContainers();
    ToggleLoading();

}
function PopulateDefaultCards() {
    HideAllContainers();
    ToggleLoading();

    $.ajax({
        type: "POST",
        url: "Search?handler=GetPopularCards",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("XSRF-TOKEN",
                $('input:hidden[name="__RequestVerificationToken"]').val());
        },
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                ToggleLoading();
                UnHideAllContainers();

                cards = response.json;
                AddCardsToContainer(cards);
            }
        },
        failure: function (response) {
            alert('Catastropic error');
        }
    });
}
//Adds cards to selected container if the cards have already been searched
//Searches cards and adds them otherwise
function ToggleViewSearch() {
    if (cards !== null) {
        //Normally we'd only get the searchdata and update the query values while searching
        //But in the case where the card data already exists, we want to update the query data because
        //we won't perform a search.
        const searchData = GetSearchData();
        SetQueryFromValues(searchData);

        AddCardsToContainer(cards);
    }
    else {
        SearchCards();
    }
}
function ToggleViewContainers() {
    //Hide the no cards message
    var noCards = $(resultsContainerNames.NoCardsContainerId);
    if (!noCards.hasClass('dn')) {
        noCards.addClass('dn');
    }

    var cardView = $(searchElementNames.CardViewId).val();
    if (cardView === 'images') {
        $(resultsContainerNames.CardTableContainerId).removeClass('db');
        $(resultsContainerNames.CardTableContainerId).addClass('dn');

        $(resultsContainerNames.CardContainerId).removeClass('dn');
        $(resultsContainerNames.CardContainerId).addClass('flex');
    } else if (cardView === 'listview') {
        $(resultsContainerNames.CardContainerId).removeClass('flex');
        $(resultsContainerNames.CardContainerId).addClass('dn');

        $(resultsContainerNames.CardTableContainerId).removeClass('dn');
        $(resultsContainerNames.CardTableContainerId).addClass('db');
    }
}
//Toggles between the search results and set data based on query params
function ToggleSearchResultData() {
    var setId = getParameterByName(queryParameterNames.SetId);
    var searchText = getParameterByName(queryParameterNames.SearchText);
    $(resultsContainerNames.SearchResultsContainerId).removeClass('dn');
    $(resultsContainerNames.SetInfoContainerId).removeClass('dn');

    //Only display the set data when only the set has been chosen. This will apply for when the user chooses a set
    //on the search page or if they choose a set from the set page
    if (setId && !searchText) {
        $(resultsContainerNames.SearchResultsContainerId).addClass('dn');

        var fd = new FormData();
        fd.append('setId', setId);

        $.ajax({
            type: "POST",
            url: "Search?handler=GetSetBySetId",
            data: fd,
            beforeSend: function (xhr) {
                xhr.setRequestHeader("XSRF-TOKEN",
                    $('input:hidden[name="__RequestVerificationToken"]').val());
            },
            contentType: false,
            processData: false,
            success: function (response) {
                if (response.success) {
                    var set = response.json;

                    $(resultsContainerNames.SetHeaderIconClassName).attr('data', '/images/seticons/' + set.iconFileName);
                    $(resultsContainerNames.SetHeaderTitleClassName).html(set.name);
                    var setData = set.totalCards + ' cards • Released ' + set.releaseDate;
                    $(resultsContainerNames.SetHeaderDataClassName).html(setData);
                }
            },
            failure: function (response) {
                alert('Catastropic error');
            }
        });
    }
    else {
        $(resultsContainerNames.SetInfoContainerId).addClass('dn');
    }
}

//Makes the current selected container visible and then adds the cards to that container
function AddCardsToContainer(cards) {
    if (cards.length <= 0) {
        $(resultsContainerNames.NoCardsContainerId).removeClass('dn');
    }
    else {
        ToggleViewContainers();
    }

    var cardView = $(searchElementNames.CardViewId).val();
    if (cardView === 'images') {
        AddCardsToDeck(cards);
    } else if (cardView === 'listview') {
        AddCardsToTable(cards);
    }
}
function AddCardsToDeck(cards) {
    //Clear existing cards
    $(resultsContainerNames.CardContainerId).html('');

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];

        var smallImage = GetImageFromCardImages(card, ImageSizeType.Small);

        var hoverFunctions = 'onmouseover="RotateCardHorizontally(this);" onmouseleave="RotateCardVertically(this);"';
        var hoverCss = card.orientation === 'Horizontal' ? hoverFunctions : '';

        var cardUrl = GetCardPageUrl(card);
        var cardHtml = `
                        <a ` + hoverCss + ` href="` + cardUrl + `" class="card-image w-25-ns pa1 w-50">
                            <img class="card-image tc" id="` + card.cardId + `" data-cardname="` + card.detail.name + `" src="` + smallImage.url + `" />
                        </a>
                    `;

        //Get all of the previous items in the card deck so we can add the new one
        var cardDeckHtml = $(resultsContainerNames.CardContainerId).html();
        cardDeckHtml += cardHtml;
        $(resultsContainerNames.CardContainerId).html(cardDeckHtml);

        //When I first loaded the images, they would pop into view and it would look very jarring. All of the images load asnchorsouly, so it's nice not having to wait
        //for all the cards to load. But I wanted to animate it to look nicer. I do this by hiding the image element as it's created. That allows the image to load before
        //it's shown. Then this will remove that class that hides it and animate a fade in from animate.css. The 'each' part is required and forces the load event to
        //fire when the image is loaded from cache. Which happens automatically by the browser.
        $('.card-image').on('load', function () {
            $(this).removeClass('d-none');
            $(this).addClass('animated fadeIn');
        }).on('error', function () {
        }).each(function () {
            if (this.complete) {
                $(this).trigger('load');
            } else if (this.error) {
                $(this).trigger('error');
            }
        });
    }
}
const CardTableColumnIndex = {
    CardId: 0,
    Set: 1,
    Number: 2,
    Name: 3,
    Cost: 4,
    Type: 5,
    Rarity: 6,
    Artist: 7,
    ImageUrl: 8,
    Lesson: 9,
};
function AddCardsToTable(cards) {
    //Remove all cards prior to adding any new ones from search
    cardTable.clear().draw();

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];

        var cardIdColumn = card.cardId;
        var costValue = card.lessonCost === null ? '' : card.lessonCost;
        var setColumn = GetSetIconImageElement(card.cardSet.iconFileName);
        var cardNumberColumn = card.cardNumber;
        var cardNameColumn = '<b>' + card.detail.name + '</b>';
        var smallImage = GetImageFromCardImages(card, ImageSizeType.Small);
        var cardImageUrlColumn = smallImage.url;
        var lessonTypeColumn = '';

        var costColumn = null;
        if (card.lessonType === null) {
            costColumn = costValue;
        }
        else if (card.lessonType !== null && costValue !== '') {
            //Set lesson type image if the card has a lesson type
            var imgElement = GetLessonImageElementFromLessonType(card.lessonType.name);
            costColumn = '<label class="card-table-cell-lesson-label">' + costValue + '</label>' + imgElement;

            //Set lesson type value here so we don't have to do double condition checks
            lessonTypeColumn = card.lessonType.name;
        }

        var typeColumn = card.cardType.name;

        var rarityColumn = null;
        if (card.rarity.imageName === null) {
            rarityColumn = card.rarity.symbol;
        }
        else {
            var rarityImage = GetRarityImageElement(card.rarity.imageName);
            rarityColumn = card.rarity.symbol + rarityImage;
        }

        var artistColumn = card.detail.illustrator;

        //Add row to table. Passing in a comma separated list for each column will add the columns in that order.
        //The second column is hidden by the column definitions when the table was instantiated
        var rowNode = cardTable.row.add([
            cardIdColumn, setColumn, cardNumberColumn, cardNameColumn, costColumn, typeColumn, rarityColumn, artistColumn, cardImageUrlColumn, lessonTypeColumn
        ]);
    }

    ApplySortToCardTable();

    //The design calls for changing the color of the font and can really only be done after the fact. DT.js
    //overwrites style changes when made as part of the column html.
    cardTable.rows().every(function (index, element) {
        var row = $(this.node());
        var cardId = cardTable.cell(index, CardTableColumnIndex.CardId).data();

        for (var i = 0; i < cards.length; i++) {
            var c = cards[i];
            if (c.cardId === cardId) {
                if (c.lessonType !== null) {
                    var lessonColorClass = GetLessonColorClass(c);
                    //The ID column gets hidden, which screws up the index. So we have to do -1 here so we can
                    //maintain the const usage when changes occur
                    row.find('td').eq(CardTableColumnIndex.Cost - 1).addClass(lessonColorClass);
                }
            }
        }
    });
}
const SortBy = {
    SetNumber: 'sn',
    Name: 'name',
    Cost: 'cost',
    Type: 'type',
    Rarity: 'rarity',
    Artist: 'artist',
    Lesson: 'lesson',
};
const SortOrder = {
    Ascending: 'asc',
    Descending: 'desc',
};
//Sort values come from the server, but datatables overrides that.
function ApplySortToCardTable() {
    var sortBy = $(searchElementNames.SortCardsById).val();
    var sortOrder = $(searchElementNames.SortCardsOrderId).val();

    if (sortBy === SortBy.SetNumber) {
        cardTable.order([CardTableColumnIndex.Set, sortOrder], [CardTableColumnIndex.Number, sortOrder]).draw();
    } else if (sortBy === SortBy.Name) {
        cardTable.order([CardTableColumnIndex.Name, sortOrder]).draw();
    } else if (sortBy === SortBy.Cost) {
        cardTable.order([CardTableColumnIndex.Cost, sortOrder]).draw();
    } else if (sortBy === SortBy.Type) {
        cardTable.order([CardTableColumnIndex.Type, sortOrder]).draw();
    } else if (sortBy === SortBy.Rarity) {
        cardTable.order([CardTableColumnIndex.Rarity, sortOrder]).draw();
    } else if (sortBy === SortBy.Artist) {
        cardTable.order([CardTableColumnIndex.Artist, sortOrder]).draw();
    } else if (sortBy === SortBy.Lesson) {
        cardTable.order([CardTableColumnIndex.Lesson, sortOrder], [CardTableColumnIndex.Name, sortOrder]).draw();
    }
}

function GetLessonImageElementFromLessonType(lessonType) {
    if (lessonType === LessonTypeName.CareOfMagicalCreatures) {
        return '<img class="card-table-cell-lesson-image" src="/images/lessons/care-of-magical-creatures.svg" />';
    }
    else if (lessonType === LessonTypeName.Charms) {
        return '<img class="card-table-cell-lesson-image" src="/images/lessons/charms.svg" />';
    }
    else if (lessonType === LessonTypeName.Potions) {
        return '<img class="card-table-cell-lesson-image" src="/images/lessons/potions.svg" />';
    }
    else if (lessonType === LessonTypeName.Quidditch) {
        return '<img class="card-table-cell-lesson-image" src="/images/lessons/quidditch.svg" />';
    }
    else if (lessonType === LessonTypeName.Transfiguration) {
        return '<img class="card-table-cell-lesson-image" src="/images/lessons/transfiguration.svg" />';
    }
}
function GetRarityImageElement(imageName) {
    return '<img class="card-table-cell-rarity-image" src="/images/rarities/' + imageName + '" />';
}
function GetSetIconImageElement(setFileName) {
    return '<img class="card-table-cell-icon-image" src="/images/seticons/' + setFileName + '" />';
}
function RotateCardHorizontally(card) {
    card.style.transform = 'rotate(90deg)';
    card.style.position = 'relative';
    card.style.zIndex = '9999';
}
function RotateCardVertically(card) {
    card.style.transform = 'rotate(0deg)';
    card.style.zIndex = '0';
}

async function SetValuesFromQueryAndPeformCardSearch() {
    var advQuery = getParameterByName(queryParameterNames.AdvancedQuery);
    if (advQuery) {
        $(searchElementNames.SearchInputId).val(searchText);
        SearchCards();

        return;
    }

    var setId = getParameterByName(queryParameterNames.SetId);
    var searchText = getParameterByName(queryParameterNames.SearchText);
    var sortBy = getParameterByName(queryParameterNames.SortBy);
    var sortOrder = getParameterByName(queryParameterNames.SortOrder);
    var cardView = getParameterByName(queryParameterNames.CardView);

    if (searchText) {
        $(searchElementNames.SearchInputId).val(searchText);
    }
    if (sortBy) {
        $(searchElementNames.SortCardsById).val(sortBy);
    }
    if (sortOrder) {
        $(searchElementNames.SortCardsOrderId).val(sortOrder);
    }
    if (cardView) {
        $(searchElementNames.CardViewId).val(cardView);
    }

    if (setId) {
        //Set data comes from the database. We need to wait until it loads before we can
        //set the selected value, because the load is async and if we don't wait, there's
        //value to set
        await until(_ => hasSetsLoaded === true);
        $(searchElementNames.SetId).val(setId);
    }

    //This function is called on page load. If any of the query param values are passed in, we'll perform
    //the search
    if (setId || searchText) {
        SearchCards();
    }
    else {
        PopulateDefaultCards();
    }
}

function SetQueryFromValues(searchData) {
    //Only set the query string if at least one of the values have been set
    if (searchData.SetId || searchData.LessonCost || searchData.SearchText) {
        //If the existing URL has query string values, we need to ignore them so we don't add them to the existing ones.
        var baseUrl = window.location.href.split('?')[0];
        var queryValues = '?';

        if (searchData.SetId) {
            queryValues += queryParameterNames.SetId + '=' + searchData.SetId + '&';
        }
        if (searchData.SearchText) {
            queryValues += queryParameterNames.SearchText + '=' + searchData.SearchText + '&';
        }
        if (searchData.SortBy) {
            queryValues += queryParameterNames.SortBy + '=' + searchData.SortBy + '&';
        }
        if (searchData.SortOrder) {
            queryValues += queryParameterNames.SortOrder + '=' + searchData.SortOrder + '&';
        }
        if (searchData.CardView) {
            queryValues += queryParameterNames.CardView + '=' + searchData.CardView + '&';
        }

        //Since we don't know which fields the user will search, it's easiest to just to add & at the
        //end of each query value and lop the ending & once all have been set.
        queryValues = queryValues.slice('&', -1);

        history.pushState(null, null, baseUrl + queryValues);
    }
}

//Default field values were causing issues with setting the query string from the field values
//We check the default values server side, but weren't doing anything client side
//This will clear the default values before setting the search data, which will
//allow us to properly check the query string and not set a value if it's false or default.
function GetSearchData() {
    var setId = $(searchElementNames.SetId).val();
    var searchText = $(searchElementNames.SearchInputId).val().trim();
    var sortBy = $(searchElementNames.SortCardsById).val();
    var sortOrder = $(searchElementNames.SortCardsOrderId).val();
    var cardView = $(searchElementNames.CardViewId).val();

    if (setId === '00000000-0000-0000-0000-000000000000' || setId === '') {
        setId = null;
    }

    const searchData = {
        SetId: setId,
        SearchText: searchText,
        SortBy: sortBy,
        SortOrder: sortOrder,
        CardView: cardView,
    };

    return searchData;
}
function GetCardPageUrl(card) {
    var baseUrl = location.protocol + '//' + location.host;
    return baseUrl + card.cardPageUrl;
}
//This will be removed in a further update
function RedirectToCardPage(card) {
    var baseUrl = location.protocol + '//' + location.host;
    window.location.href = baseUrl + card.cardPageUrl;
}

/**
 * Modal
 * -----------------------------------------------------------------------------------------------------
 */

function InitializeModal() {
    //$("#modal-custom").iziModal();
}
function ShowCardModal(id) {
    //$('#modal-custom').iziModal('open');
}

/**
 * Crests
 * -----------------------------------------------------------------------------------------------------
 */

const crestElementNames = {
    CrestId: '#crest',
    CrestTooltipId: '#crestsTooltip',
    CrestButtonGryffindorId: '#crestButtonGryffindor',
    CrestButtonHufflepuffId: '#crestButtonHufflepuff',
    CrestButtonRavenclawId: '#crestButtonRavenclaw',
    CrestButtonSlytherinId: '#crestButtonSlytherin'
};

function InitializeCrestElements() {
    //var crestTooltipHtml = $(crestElementNames.CrestTooltipId).html();
    //tippy(crestElementNames.CrestId, {
    //    content: crestTooltipHtml,
    //    allowHTML: true,
    //    interactive: true,
    //    offset: [0, -26], //We have to offset the tooltip by because the main crest is offset
    //    trigger: 'click'
    //});

    //$('#crestButtonGryffindor').on('click', function () {
    //    //console.log($(this).html());
    //    alert('test');
    //});
}


/*
 * Misc
 * ----------------------------------------------------------------------------------------------------
 */

/*
 * Page Tools
 * ----------------------------------------------------------------------------------------------------
 */
const Page = {
    Home: '',
    Search: 'Search',
    Card: 'Card',
    Sets: 'Sets',
    Advanced: 'Advanced',
};
function GetCurrentPage() {
    return window.location.pathname.split('/')[1];
}
function GetCardFromCardId(cardId) {
    var cardVal = null;

    for (var i = 0; i < this.cards.length; i++) {
        var card = cards[i];
        if (card.cardId === cardId) {
            cardVal = card;
        }
    }

    return cardVal;
}
/*
 * Card Page Search
 * ----------------------------------------------------------------------------------------------------
 */

const singleCardSearchElementIds = {
    HoverImageClassName: '.hover-card',
};

//The search box will behave differently on the pages that aren't the search page. We'll basically just redirect to the search page
//so that'll seem like a seamless integration
function InitializeSearchBoxOnNonSearchPage() {
    //Search text press enter
    $(searchElementNames.SearchInputId).on('keypress', function (e) {
        if (e.which === 13) {
            window.location.href = '/Search?searchText=' + $(this).val() + '&sortBy=sn&cardView=images';
            e.preventDefault();
        }
    });
}

function GetLessonColorClass(card) {
    if (card.lessonCost === null || card.lessonType === null) {
        return '';
    }
    else {
        var lessonType = card.lessonType;
        if (lessonType.name === LessonTypeName.CareOfMagicalCreatures) {
            return 'lesson-color-comc';
        } else if (lessonType.name === LessonTypeName.Charms) {
            return 'lesson-color-charms';
        } else if (lessonType.name === LessonTypeName.Potions) {
            return 'lesson-color-potions';
        } else if (lessonType.name === LessonTypeName.Quidditch) {
            return 'lesson-color-quidditch';
        } else if (lessonType.name === LessonTypeName.Transfiguration) {
            return 'lesson-color-transfig';
        }
    }
}

/*
 * Sets Page
 * ------------------------------------------------------------------------------------------------------------------------------
 */

const setsPageElements = {
    SetsTableId: '#setsTable',
};
const SetsTableColumnIndex = {
    SetId: 0,
    Name: 1,
    TotalCards: 2,
    ReleaseDate: 3,
    Languages: 4,
};

var setsTable = null;
function InitializeSetsTable() {
    console.log(setsPageElements.SetsTableId);
    setsTable = $(setsPageElements.SetsTableId).DataTable({
        lengthChange: false,
        searching: false,
        paging: false,
        bInfo: false,
        columnDefs: [
            {
                //Hide the card ID column
                targets: [0],
                visible: false,
            },
            {
                //Align the name to the left of the column. The 100% class is used to extend the text
                //so row over works correctly
                targets: [1],
                className: 'fl w-100'
            },
            {
                //Cap the width of the cards and date column
                targets: [2, 3],
                width: '10%'
            },
            {
                //Align the content of the language column vertically centered
                targets: [4],
                className: 'v-mid',
            }
        ]
    });

    $(setsPageElements.SetsTableId + ' tbody').on('click', 'tr', function () {
        var data = setsTable.row(this).data();
        window.location.href = '/Search?setId=' + data[0] + '&sortBy=sn&cardView=images';
    });
}

function PopulateSetsTable() {
    $.ajax({
        type: "POST",
        url: "Sets?handler=GetSets",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("XSRF-TOKEN",
                $('input:hidden[name="__RequestVerificationToken"]').val());
        },
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                var sets = response.json;
                AddSetsToSetsTable(sets);
            }
        },
        failure: function (response) {
            alert('Catastropic error');
        }
    });
}
function AddSetsToSetsTable(sets) {
    for (var i = 0; i < sets.length; i++) {
        var set = sets[i];

        var setIdColumn = set.setId;
        var nameColumn = '<div class="flex items-center"><img class="sets-set-table-set-icon" src="/images/seticons/' + set.iconFileName + '" /><div>' + set.name + '</div></div>';
        var totalCardsColumn = set.totalCards;
        var releaseDateColumn = set.releaseDate;

        var languages = '<div class="flex items-center">';
        for (var n = 0; n < set.languages.length; n++) {
            var language = set.languages[n];
            var className = '';
            if (language.enabled) {
                className = 'set-language-enabled';
            }
            else {
                className = 'set-language-disabled';
            }

            languages += '<div class="' + className + '">' + language.code + '</div>';
        }
        languages += '</div>';

        var languageColumn = languages;

        //Add row to table. Passing in a comma separated list for each column will add the columns in that order.
        //The second column is hidden by the column definitions when the table was instantiated
        var rowNode = setsTable.row.add([
            setIdColumn, nameColumn, totalCardsColumn, releaseDateColumn, languageColumn
        ]);

        setsTable.order([SetsTableColumnIndex.ReleaseDate, 'desc']).draw();
    }
}

function ToggleLoading() {
    var loading = $('#loading');
    if (loading.hasClass('dn')) {
        loading.removeClass('dn');
    }
    else {
        loading.addClass('dn');
    }
}
function HideAllContainers() {
    var tableContainer = $(resultsContainerNames.CardTableContainerId);
    var cardContainer = $(resultsContainerNames.CardContainerId);
    var noCards = $(resultsContainerNames.NoCardsContainerId);

    if (!tableContainer.hasClass('vh')) {
        tableContainer.addClass('vh');
    }
    if (!cardContainer.hasClass('vh')) {
        cardContainer.addClass('vh');
    }
    if (!noCards.hasClass('vh')) {
        noCards.addClass('vh');
    }
}
function UnHideAllContainers() {
    var tableContainer = $(resultsContainerNames.CardTableContainerId);
    var cardContainer = $(resultsContainerNames.CardContainerId);
    var noCards = $(resultsContainerNames.NoCardsContainerId);

    if (tableContainer.hasClass('vh')) {
        tableContainer.removeClass('vh');
    }
    if (cardContainer.hasClass('vh')) {
        cardContainer.removeClass('vh');
    }
    if (noCards.hasClass('vh')) {
        noCards.removeClass('vh');
    }
}

/*
 * Advanced Search
 * -----------------------------------------------------------------------------------------------------------------------------
 **/

const advancedSearchElements = {
    CardNameId: '#cardName',
    CardTextId: '#cardText',
};

function InitializeAdvancedSearchElements() {
    $(advancedSearchElements.CardNameId + ',' + advancedSearchElements.CardTextId).on('keypress', function (e) {
        if (e.which === 13) {
            RedirectToSearchWithAdvancedSearchString();
            e.preventDefault();
        }
    });
}

function RedirectToSearchWithAdvancedSearchString() {
    var cardName = $(advancedSearchElements.CardNameId).val();
    var cardText = $(advancedSearchElements.CardTextId).val();

    var fd = new FormData();
    if (cardName) {
        fd.append('cardName', cardName);
    }
    if (cardText) {
        fd.append('cardText', cardText);
    }

    $.ajax({
        type: "POST",
        url: "Advanced?handler=GetAdvancedSearchUrlValue",
        data: fd,
        beforeSend: function (xhr) {
            xhr.setRequestHeader("XSRF-TOKEN",
                $('input:hidden[name="__RequestVerificationToken"]').val());
        },
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                var url = response.json;
                
                var baseUrl = location.protocol + '//' + location.host;
                var cardRoute = '/Search?adv=' + url;
                window.location.href = baseUrl + cardRoute;
            }
        },
        failure: function (response) {
            alert('Catastropic error');
        }
    });
}

function GetImageFromCardImages(card, imageSizeType) {
    var images = card.images;
    for (var i = 0; i < images.length; i++) {
        var image = images[i];
        if (image.size === imageSizeType) {
            return image;
        }
    }
}