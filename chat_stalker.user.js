// ==UserScript==
// @name         Chat Stalker
// @namespace    sykoe.chatstalker
// @version      1.14
// @description  Notifies when a user post in global or trade chat (initially forked from Hardy[2131687]). Does NOT work when global/trade chat is disabled via torntools.
// @author       Sykoe[2734951]
// @match        https://www.torn.com/*
// @exclude      https://www.torn.com/loader.php*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js#sha256=eb6a241052d33d0eeaae36416805d6f801b691c67c9a3be587f1115249bf2b69
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://github.com/sykoe/torn-userscripts/raw/main/chat_stalker.user.js
// @downloadURL  https://github.com/sykoe/torn-userscripts/raw/main/chat_stalker.user.js
// ==/UserScript==
(function () {
    'use strict';
    const version = "1.14"
    //DEV MODE enables the dev mode settings and nothing else
    const devMode = false;

    setup_GM_config();
    const settings = loadSettings();
    if (settings.enable.devmode) console.log("[ChatStalker] <dev> Settings", settings);

    const menuSettingsId = GM_registerMenuCommand("Show Settings", function () {
        setup_GM_config();
        GM_config.open();
    }, "s");

    let chatCode = document.querySelector('script[src^="/builds/chat"]');
    let socket = new WebSocket("wss://ws-chat.torn.com/chat/ws?uid=" + chatCode.getAttribute("uid") + "&secret=" + chatCode.getAttribute("secret"));

    socket.onmessage = function (event) {
        let data = JSON.parse(event.data)["data"][0];
        if (data.type != 'messageReceived') return;
        if (settings.devmode.lograwdata) console.log("[ChatStalkerBeta] <log raw>", data);
        data.roomId = data.roomId.split(':')[0];
        if (isRoomDisabled(data.roomId) == true) return;

        //checks for stalked userID
        if (settings.enable.useridtracking) {
            handleUserIdTracking(data.senderId, data.senderName, data.roomId, data.messageText, data.time);
        }
        //checks message for containing words/phrases
        if (settings.enable.phrases) {
            handleWordPhraseSearch(data.senderId, data.senderName, data.roomId, data.messageText, data.time);
        }
        //devMode just lets all messages through, fakes username / id for timestamps to work        
        if (settings.enable.devmode && settings.devmode?.allmessages) {
            console.log("[ChatStalker] <dev> data passtrough", data);
            stalkAlert('1337', 'DevMode', data.roomId, data.senderName + ': ' + data.messageText, data.time);
        }
    };

    function handleUserIdTracking(senderId, senderName, room, messageText, timestamp) {
        let searchScope;
        switch (room) {
        case 'Trade':
            searchScope = settings.userids.trade;
            break;
        case 'Global':
            searchScope = settings.userids.global;
            break;
        case 'Faction':
            searchScope = settings.userids.faction;
            break;
        default:
            if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> tried handling room - '" + room + "'")
            return;
        }
        if (searchScope.indexOf(senderId) !== -1) {
            if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> handleUserIdTracking [id, name, room, search]", [senderId, senderName, room, searchScope]);
            stalkAlert(senderId, senderName, room, messageText, timestamp, senderName);
        }
    }

    function handleWordPhraseSearch(senderId, senderName, room, messageText, timestamp) {
        let searchScope;
        switch (room) {
        case 'Trade':
            searchScope = settings.phrases.trade;
            break;
        case 'Global':
            searchScope = settings.phrases.global;
            break;
        case 'Faction':
            searchScope = settings.phrases.faction;
            break;
        default:
            if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> tried handling room '" + room + "'")
            return;

        }
        let searchResult = doesStrContainPhrases(messageText, searchScope);
        if (searchResult != false) {
            stalkAlert(senderId, senderName, room, messageText, timestamp, searchScope[searchResult]);
        }
    }
    //return index or false
    function doesStrContainPhrases(string, phrases) {
        if (string && phrases) {
            for (let i = 0; i < phrases.length; i++) {
                if (string.toLowerCase().includes(phrases[i].toLowerCase())) {
                    return i;
                }
            }
        }
        return false;
    }
    //returns a [name, messageText] string array with the to be highlighted part embeded in a html element
    function determineHighlight(name, room, messageText, highlight) {
        if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> highlight", [name, room, messageText, highlight]);
        if (name == highlight) {
            name = '<span class="highlight">' + name + "</span>";
        }
        if (messageText.toLowerCase().includes(highlight)) {
            const lowerCaseMessage = messageText.toLowerCase();
            // Loop through the keywords array and search for each highlight in the messageText
            const keywordIndex = lowerCaseMessage.indexOf(highlight);
            // If the highlight is found, replace it with the same text wrapped in a <mark> tag to highlight it
            if (keywordIndex !== -1) {
                const beforeKeyword = messageText.slice(0, keywordIndex);
                const afterKeyword = messageText.slice(keywordIndex + highlight.length);
                messageText = beforeKeyword + '<span class="highlight">' + messageText.slice(keywordIndex, keywordIndex + highlight.length) + '</span>' + afterKeyword;
            }
        }
        return [name, messageText];
    }

    function stalkAlert(userId, name, room, messageText, timestamp, highlight) {
        if (handleTimestampCheck(userId, room, timestamp) != true) return;
        if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> stalkAlert", [userId, name, room, messageText, timestamp, highlight]);
        [name, messageText] = determineHighlight(name, room, messageText, highlight);
        let boxHtml = '<div class="stalker_modal" id="stalker_modal-' + userId + '">\
                           <div class="stalker_modal-content">\
                               <p class="stalker_line">\
                                   <a href="https://www.torn.com/profiles.php?XID=' + userId + '">' + name + '</a>\
                                   <span style="font-size: 10px">[' + room + ']:</span> "' + messageText + '" \
                                   <button id="stalker_close-' + userId + '" class="stalker_close-button torn-btn">x</button>\
                               </p>\
                           </div>\
                       </div>';
        $(".content-wrapper").prepend(boxHtml);
        document.addEventListener("click", function (e) {
            if (e.target.id == "stalker_close-" + userId) {
                document.querySelector("#stalker_modal-" + userId).remove();
            }
        });
    }
    //checks if a room is disabled via settings
    function isRoomDisabled(room) {
        switch (room) {
        case 'Trade':
            if (settings.roomsdisable.trade) return true;
            break;
        case 'Global':
            if (settings.roomsdisable.global) return true;
            break;
        case 'Faction':
            if (settings.roomsdisable.faction) return true;
            break;
        case 'Poker': //thought to add these if needed for other features
            return true;
        case 'Users':
            return true;
        default:
            return false;
        }
        return false;
    }
    //returns true if no timestamp found and saves it - if a timestamp is found (means it is the same or an older msg) it returns false
    function handleTimestampCheck(userId, room, timestamp) {
        var lastSeen = localStorage.getItem("chatStalkerTimestamps");
        var last;
        if (typeof lastSeen == "undefined" || lastSeen == null) {
            last = {
                "victims": {
                    "Global": {},
                    "Trade": {},
                    "Faction": {}
                }
            };
            localStorage.setItem("chatStalkerTimestamps", JSON.stringify(last));
        } else {
            last = JSON.parse(lastSeen);
            if (last["victims"][room][userId]) {
                if (last["victims"][room][userId].indexOf(timestamp) !== -1) {
                    if (settings.devmode.verbose) console.log("[ChatStalker] <verbose> found msg with ts", [timestamp, room, userId]);
                    return false;
                }
            }
        }
        if (!last["victims"][room][userId]) last["victims"][room][userId] = [];
        last["victims"][room][userId].push(timestamp);
        localStorage.setItem("chatStalkerTimestamps", JSON.stringify(last));
        return true;
    }

    function loadSavedValues(gmConfigKey) {
        let origVal = GM_config.get(gmConfigKey);
        let savedValueSplit = origVal.split(',').map(x => x.trim()).filter(x => x != "" && x != null && x.length > 0);
        if (devMode) console.log("[ChatStalker] <dev> loadSavedValues", [GM_config.get(gmConfigKey), savedValueSplit, ]);
        return savedValueSplit;
    }

    function loadSettings(settingsId = 'ChatStalker') {
        let config = {
            enable: {},
            userids: {},
            phrases: {},
            devmode: {},
            roomsdisable: {},
        };
        config.enable.useridtracking = GM_config.get('chatstalker_enable_useridtracking');
        config.enable.phrases = GM_config.get('chatstalker_enable_phrases');
        config.enable.advanced = GM_config.get('chatstalker_enable_advanced');
        if (devMode) config.enable.devmode = GM_config.get('chatstalker_enable_devmode');
        if (config.enable.useridtracking) {
            config.userids.all = loadSavedValues('userIDs_all');
            config.userids.global = config.userids.all.concat(loadSavedValues('userids_global'));
            config.userids.trade = config.userids.all.concat(loadSavedValues('userids_trade'));
            config.userids.faction = config.userids.all.concat(loadSavedValues('userids_faction'));
        }
        if (config.enable.phrases) {
            config.phrases.all = loadSavedValues('phrases_all');
            config.phrases.global = config.phrases.all.concat(loadSavedValues('phrases_global'));
            config.phrases.trade = config.phrases.all.concat(loadSavedValues('phrases_trade'));
            config.phrases.faction = config.phrases.all.concat(loadSavedValues('phrases_faction'));
        }
        if (config.enable.advanced) {
            config.roomsdisable.global = GM_config.get('roomsdisable_global');
            config.roomsdisable.trade = GM_config.get('roomsdisable_trade');
            config.roomsdisable.faction = GM_config.get('roomsdisable_faction');
        }
        if (config.enable.devmode) {
            config.devmode.allmessages = GM_config.get('chatstalker_devmode_allmessages');
            config.devmode.lograwdata = GM_config.get('chatstalker_devmode_logallwsdata');
            config.devmode.verbose = GM_config.get('chatstalker_devmode_verbose');
        }
        return config;
    }

    function setup_GM_config(settingsId = 'ChatStalker') {
        const generalSettings = {
            'id': settingsId,
            'title': 'ChatStalker - Settings',
            'fields': {
                'chatstalker_enable_useridtracking': {
                    'section': [GM_config.create('General Settings'), "(Version: " + version + ")"],
                    'label': 'Enabled alerting for userIds',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': true
                },
                'chatstalker_enable_phrases': {
                    'label': 'Enabled alerting for words/ phrases',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': true
                },
                'chatstalker_enable_advanced': {
                    'label': 'Enabled advanced settings',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
            },
            'events': {
                'close': function () {
                    if (devMode) console.log("[ChatStalker] <dev> reloading settings on gmConfig_init close event");
                    const settings = loadSettings();
                    if (devMode) console.log("[ChatStalker] <dev> Settings", settings);

                }
            }
        };
        const trackingUserIDsSettings = {
            'id': settingsId,
            'fields': {
                'userIDs_all': {
                    'section': [GM_config.create('Tracking userID'), "values need to be entered comma seperated", "you can only enter userIDs, names will not work"],
                    'label': 'ALL chats',
                    'labelPos': 'before',
                    'type': 'text',
                    'default': '1,2131687,2734951'
                },
                'userids_global': {
                    'label': 'Global chat',
                    'type': 'text',
                    'default': ''
                },
                'userids_trade': {
                    'label': 'Trade chat',
                    'type': 'text',
                    'default': ''
                },
                'userids_faction': {
                    'label': 'Faction chat',
                    'type': 'text',
                    'default': ''
                },
            }
        };
        const searchingPhrasesSettings = {
            'id': settingsId,
            'fields': {
                'phrases_all': {
                    'section': [GM_config.create('Searching for words/ whole phrases'), "values need to be entered comma seperated"],
                    'label': 'ALL chats',
                    'labelPos': 'before',
                    'type': 'text',
                    'default': 'psa,sykoe,ched,you should'
                },
                'phrases_global': {
                    'label': 'Global chat',
                    'type': 'text',
                    'default': ''
                },
                'phrases_trade': {
                    'label': 'Trade chat',
                    'type': 'text',
                    'default': ''
                },
                'phrases_faction': {
                    'label': 'Faction chat',
                    'type': 'text',
                    'default': 'bank'
                },
            }
        };
        const roomSettings = {
            'id': settingsId,
            'fields': {
                'roomsdisable_global': {
                    'section': [GM_config.create('Individual Room Settings'), "this will DISABLE the selected room(s) for all ChatStalker features"],
                    'label': 'DISABLE searching in global',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
                'roomsdisable_trade': {
                    'label': 'DISABLE searching in trade',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
                'roomsdisable_faction': {
                    'label': 'DISABLE searching in faction',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                }
            }
        };
        const devModeSettings = {
            'id': settingsId,
            'fields': {
                'chatstalker_enable_devmode': {
                    'section': [GM_config.create('Dev Mode Settings'), "hello c: how did you get here? "],
                    'label': 'Enabled developer mode',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'tooltip': 'can not be en/diabled here',
                    'save': false
                },
                'chatstalker_devmode_allmessages': {
                    'label': 'Pass through all messages to alert',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
                'chatstalker_devmode_logallwsdata': {
                    'label': 'Logs websocket data (rawchat)',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
                'chatstalker_devmode_verbose': {
                    'label': 'Logs many more things',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
                'chatstalker_devmode_highlighttest': {
                    'label': 'test chat message',
                    'labelPos': 'above',
                    'save': false,
                    'type': 'text'
                },
                'chatstalker_devmode_highlighttest_button': {
                    'label': 'Test the test chat message',
                    'labelPos': 'right',
                    'save': false,
                    'type': 'button',
                    'click': function () {
                        let message = GM_config.get('chatstalker_devmode_highlighttest', true);
                        let searchScope = GM_config.fields['phrases_all'].value.split(',');
                        searchScope = searchScope.map(x => x.trim()).filter(x => x.length > 0 && x != "" && x != null);
                        console.log("[ChatStalker] <dev> ...vars", [searchScope, doesStrContainPhrases(message, searchScope), ]);
                        console.log("[ChatStalker] <dev> ...params", ['devTrigger', 'devRooms', message, searchScope[doesStrContainPhrases(message, searchScope)]]);
                        let [highname, highmsg] = determineHighlight('devTrigger', 'devRooms', message, doesStrContainPhrases(message, searchScope));
                        console.log("[ChatStalker] <dev> ...result", [highname, highmsg]);
                        console.log("[ChatStalker] <dev> ...result", [determineHighlight('devTrigger', 'devRooms', message, doesStrContainPhrases(message, searchScope))]);
                    },
                },
            },
            'events': {
                'init': function () {
                    GM_config.set('chatstalker_enable_devmode', devMode)
                },
                'open': function () {
                    GM_config.fields['chatstalker_devmode_highlighttest'].node.addEventListener('change', function () {
                        console.log("[ChatStalker] <dev>", [GM_config.get('chatstalker_devmode_highlighttest', true), ]);
                    });
                }
            }
        };
        GM_config.init(generalSettings);
        if (GM_config.get('chatstalker_enable_useridtracking')) GM_config.init(trackingUserIDsSettings);
        if (GM_config.get('chatstalker_enable_phrases')) GM_config.init(searchingPhrasesSettings);
        if (GM_config.get('chatstalker_enable_advanced')) { //possibly multiple advanced settings
            GM_config.init(roomSettings);
        }
        if (devMode) GM_config.init(devModeSettings);
    }

    if (window.location.href.includes("/preferences.php")) {
        let preferencesHtml = '<div id="chatstalker-settings-container" class="tt-container rounding mt10">\
                                  <div class="title collapsed">\
                                    <div class="text">ChatStalker - Settings</div>\
                                    <div class="options">\
                                      <a id="chatstalker-settings-button" class="preference-button" target="_blank">Settings\
                                      </a>\
                                    </div>\
                                  </div>\
                                </div>';
        $('.preferences-container').after(preferencesHtml);
        document.addEventListener("click", function (e) {
            if (e.target.id == "chatstalker-settings-button") {
                setup_GM_config();
                GM_config.open();
            }
        });
        GM_addStyle(`
            .mt10 {margin-top: 10px;}
            .preference-button { cursor: pointer; font-size: 14px; font-weight: bold; text-shadow: rgba(255, 255, 255, 0.4) 0px 1px 0px; vertical-align: top; height: 16px; line-height: 16px; box-sizing:content-box; color: rgb(51, 51, 51) !important; background: linear-gradient(rgb(215, 215, 215), rgb(189, 189, 189) 17%, rgb(152, 152, 152) 61%, rgb(126, 126, 126) 83%, rgb(124, 124, 124) 87%, rgb(127, 127, 127) 91%, rgb(134, 134, 134) 96%, rgb(138, 138, 138)); border-width: 0px; border-style: initial; border-color: initial; border-image: initial; border-radius: 5px; padding: 3px 10px; text-decoration: none;}
            .tt-container .title .text {width: -webkit-fill-available;}
            .tt-container .title {padding-left: 10px;height: 30px;font-size: 13px;text-shadow: rgba(0, 0, 0, 0.65) 1px 1px 2px;letter-spacing: 1px;display: flex;white-space: nowrap;align-items: center;margin: initial;}
            .tt-container.rounding:not(.always-content) .title.collapsed { border-radius: 5px;}
            .tt-container .title .options {width: 100%; display: flex; flex-direction: row-reverse; margin-right: 4px; align-items: center;}
            #chatstalker-settings-container > div {color: white; background: repeating-linear-gradient(90deg, #6600ff, #6600ff 2px, #812bb2 0, #812bb2 4px); text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;}
        `);
    }

    GM_addStyle(`
        .stalker_modal { border-radius: 8px; background-color: rgb(242, 242, 242); animation: animate 3s linear infinite;}
        @keyframes animate { 0% { box-shadow: 0 0 0 0 rgba(255,109,74,.7), 0 0 0 0 rgba(255,109,74,.7);} 40% { box-shadow: 0 0 0 9px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,.7);} 80% { box-shadow: 0 0 0 8px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} 100% { box-shadow: 0 0 0 0 rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} }
        .stalker_modal-content { margin: 5px 0; padding: 8px 10px; line-height: 12px; }
        .stalker_line { font-size: 10px;  }
        .stalker_line a { font-size: 10px; text-decoration: none; color: unset; }
		span.highlight { font-size: 12px; font-weight: bold; color: red;}
        .stalker_close-button.torn-btn { float: right; line-height: 10px; padding: 2px 4px; font-size: 10px; margin-top: -2px; padding-top: 3px;}
    `);
})();
