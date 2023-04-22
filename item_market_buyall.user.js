// ==UserScript==
// @name         Torn: Buy all | Items market
// @namespace    sykoe.buyall
// @version      0.2.1
// @description  Buys all items from the first Item market page!
// @author       Sykoe[2734951]
// @match        https://www.torn.com/imarket.php*
// @grant        none
// ==/UserScript==
(function() {
    'use strict';

    window.addEventListener(
        "load",
        function () {
            //DOM has loaded
            setTimeout(() => addButton(), 200);
        },
        false
    );

    function addButton() {
        if ($('div.content-title > h4').size() > 0 && $('#buyAll').size() < 1) {
            const button = `<button id="buyAll" style="color: var(--default-blue-color); cursor: pointer; margin-right: 0;">Buy all!</button>`;
            $('div.content-title > h4').append(button);
            $('#buyAll').on('click', () => {
                var x = document.getElementsByClassName('buy-icon wai-btn');
                /*for(var i = x.length-1; i >= 0; i--) {
                    x[i].click();
                }*/
                for(var i = 0; i <= x.length-1; i++) {
                    x[i].click();
                }
            });
        }
    };
})();
