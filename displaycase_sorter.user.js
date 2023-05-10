// ==UserScript==
// @name         Sort items in display case manage view
// @namespace    sykoe.displaycase.sorter
// @version      1.3
// @description  Sort display case with one button (may need a reload to appear after switching from 'display' to 'manage' display case)
// @author       Sykoe[2734951]
// @match        https://www.torn.com/displaycase*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.addEventListener(
        "load",
        function () {
            //DOM has loaded
            setTimeout(() => addButton(), 300);
        },
        false
    );
	
    function addButton() {
        const button = `<button id="sortItems" style="color: var(--default-blue-color); cursor: pointer; margin-right: 0;">Sort!</button>`;
        $('#skip-to-content').append(button);

        $('#sortItems').on('click', (e) => {
            sortItems(e);
        });
    };

    function sortItems(e) {
        const items = Array.from(document.querySelectorAll("ul.dc-list > li"));
        var $list = $('ul.dc-list');
        var $listLi = $('ul.dc-list > li');
        $listLi.sort(function (a, b) {
            var textA = a.attributes['aria-label'].textContent.toLowerCase();
            var textB = b.attributes['aria-label'].textContent.toLowerCase();
            if (textA < textB) {
                return -1;
            }
            if (textA > textB) {
                return 1;
            }
            return 0;
        });
        $.each($listLi, function (index, row) {
            $list.append(row);
        });
        e.preventDefault();
    }
})();
