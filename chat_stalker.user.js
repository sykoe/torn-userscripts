// ==UserScript==
// @name         Chat Stalker
// @namespace    sykoe.chatstalker
// @version      1.9.3
// @description  Notifies when a user post in global or trade chat (forked from Hardy[2131687]). Does NOT work when global/trade chat is disabled via torntools.
// @author       Sykoe[2734951]
// @match        https://www.torn.com/*
// @exclude      https://www.torn.com/loader.php*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js#sha256=eb6a241052d33d0eeaae36416805d6f801b691c67c9a3be587f1115249bf2b69
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at 		 document-idle
// ==/UserScript==
(function () {
    'use strict';	
    //DEV MODE enables the dev mode settings and nothing else
    const devMode = false;
	
	gmConfig_init();
    const settings = loadSettings();
	if(settings.enable.devmode) console.log(settings);
	
    let chatCode = document.querySelector('script[src^="/builds/chat"]');
    let socket = new WebSocket("wss://ws-chat.torn.com/chat/ws?uid=" + chatCode.getAttribute("uid") + "&secret=" + chatCode.getAttribute("secret"));
	
    socket.onmessage = function (event) {
        let data = JSON.parse(event.data)["data"][0];
		if(settings.devmode.lograwdata) console.log(data);
		data.roomId = data.roomId.split(':')[0];
		if(checkIfRoomIsDisabled(data.roomId) == true) return;
		
        //checks for stalked userID
		if (settings.enable.useridtracking){
			handleUserIdTracking(data.senderId, data.senderName, data.roomId, data.messageText, data.time);
		}
		//checks message for containing words/phrases
		if (settings.enable.phrases) {
			handleWordPhraseSearch(data.senderId, data.senderName, data.roomId, data.messageText, data.time);
		}	
		//devMode just lets all messages through, fakes username / id for timestamps to work		
		if (settings.enable.devmode && settings.devmode?.allmessages) {	
			console.log(data);
            stalkAlert('1337', 'DevMode', data.roomId, data.senderName + ': ' + data.messageText, data.time);
		}      
    };
	
	function handleUserIdTracking(senderId, senderName, room, messageText, timestamp){
		let searchScope;
		switch(room) {
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
				if(settings.enable.verbose) console.log("tried handling room: '" + room + "'")
				return;
		}
		if(settings.enable.verbose) console.log(senderId, senderName, room, searchScope);
		if(searchScope.indexOf(senderId) !== -1){
			stalkAlert(senderId, senderName, room, messageText, timestamp);
        }	
	}
	
	function handleWordPhraseSearch(senderId, senderName, room, messageText, timestamp){
		let searchScope;
		switch(room) {
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
				if(settings.enable.verbose) console.log("tried handling room" + room + "'")
				return;	
				
		}
		if(doesStrContainPhrases(messageText, searchScope) == true){
			stalkAlert(senderId, senderName, room, messageText, timestamp);
        }	
	}  
	
	function doesStrContainPhrases(string, phrases) {
        if (string && phrases) {
            for (let i = 0; i < phrases.length; i++) {
                if (string.toLowerCase().includes(phrases[i].toLowerCase())) {
                    return true;
                }
            }
        }
        return false;
    }
	   
	function stalkAlert(id, name, room, messageText, timestamp) {
        if(handleTimestampCheck(id, room, timestamp) != true) return;
        let boxHtml = '<div class="stalker_modal" id="stalker_modal-' + id + '">\
                           <div class="stalker_modal-content">\
                               <p class="stalker_line">\
                                   <a href="https://www.torn.com/profiles.php?XID=' + id + '">' + name + '</a>\
                                   <span style="font-size: 10px">[' + room + ']:</span> "' + messageText + '" \
                                   <button class="stalker_close-button torn-btn">x</button>\
                               </p>\
                           </div>\
                       </div>';
        $(".content-wrapper").prepend(boxHtml);
		document.addEventListener("click", function (e) {
			if (e.target.className == "stalker_close-button torn-btn") {
				document.querySelector(".stalker_modal").remove();
			}
		});
    }
	//checks if a room is disabled via settings
	function checkIfRoomIsDisabled(room) {
		switch(room) {
			case 'Trade':
				if(settings.roomsdisable.trade) return true;
				break;
			case 'Global':
				if(settings.roomsdisable.global) return true;
				break;
			case 'Faction':
				if(settings.roomsdisable.faction) return true;
				break;
			case 'Poker': //thought to add these if needed for other features
				return true;
			case 'User':
				return true;
			default:
				return false;
		}
		return false;
	}
	
	//returns true if no timestamp found and saves it - if a timestamp is found (means it is the same or an older msg) it returns false
	function handleTimestampCheck(id, room, timestamp){
		var lastSeen = localStorage.getItem("chatStalkerTimestamps");
        var last;
        if (typeof lastSeen == "undefined" || lastSeen == null) {
            last = {"victims": {"Global": {},"Trade": {},"Faction": {}}};
            localStorage.setItem("chatStalkerTimestamps", JSON.stringify(last));
        } else {
            last = JSON.parse(lastSeen);
            if (last["victims"][room][id]) {
                if (timestamp <= last["victims"][room][id]) {
                    return false;
                }
            }
        }		
        last["victims"][room][id] = timestamp;
        localStorage.setItem("chatStalkerTimestamps", JSON.stringify(last));
		return true;
	}

	function loadSavedValues(gmConfigKey) {
        let savedValueSplit = GM_config.get(gmConfigKey).split(',');
        let returnArray = []
        let length = savedValueSplit.length;
        for (let i = 0; i < length; i++) {
            let tmp = savedValueSplit[i].trim();
            if (tmp != "" && tmp != null) {
                returnArray.push(tmp)
            }
        }
        return returnArray;
    }
    
	function loadSettings(settingsId = 'ChatStalker') {
        let config = {enable: {}, userids: {}, phrases: {}, devmode: {}, roomsdisable: {},};
		config.enable.useridtracking = GM_config.get('chatstalker_enable_useridtracking');
		config.enable.phrases = GM_config.get('chatstalker_enable_phrases');
		config.enable.advanced = GM_config.get('chatstalker_enable_advanced');
		if(devMode) config.enable.devmode = GM_config.get('chatstalker_enable_devmode');
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
            config.roomsdisable.global = GM_config.get('roomsdiable_global');
            config.roomsdisable.trade = GM_config.get('roomsdiable_trade');
            config.roomsdisable.faction = GM_config.get('roomsdiable_faction');
        }
		if (config.enable.devmode) {
			config.devmode.allmessages = GM_config.get('chatstalker_devmode_allmessages');
			config.devmode.lograwdata = GM_config.get('chatstalker_devmode_logallwsdata');
			config.devmode.verbose = GM_config.get('chatstalker_devmode_verbose');
		}
		return config;
    }
	
    function gmConfig_init(settingsId = 'ChatStalker') {
        const generalSettings = {
            'id': settingsId,
            'title': 'ChatStalker - Settings',
            'fields': {
                'chatstalker_enable_useridtracking': {
                    'section': [GM_config.create('General Settings')],
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
            }
        };
        const trackingUserIDsSettings = {
            'id': settingsId,
            'fields': {
                'userIDs_all': {
                    'section': [GM_config.create('Tracking userID'), "values need to be entered comma seperated"],
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
                'roomsdiable_global': {
                    'section': [GM_config.create('Individual Room Settings'), "this will DISABLE the selected rooms for all stalk features"],
                    'label': 'DISABLE searching in global',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                }, 
				'roomsdiable_trade': {
                    'label': 'DISABLE searching in trade',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                }, 
				'roomsdiable_faction': {
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
                    'section': [GM_config.create('Dev Mode Settings')],
                    'label': 'Enabled developer mode',
                    'labelPos': 'above',
                    'type': 'checkbox',
					'save': false
                }, 
				'chatstalker_devmode_allmessages': {
                    'label': 'Lets all messages through',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                }, 
				'chatstalker_devmode_logallwsdata': {
                    'label': 'Logs ws data',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                }, 
				'chatstalker_devmode_verbose': {
                    'label': 'Logs many things',
                    'labelPos': 'above',
                    'type': 'checkbox',
                    'default': false
                },
            },
			'events': {
				'init': function(){
					GM_config.set('chatstalker_enable_devmode', devMode)
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
        GM_addStyle(`#chatstalker-settings-container > div {color: white; background: repeating-linear-gradient(90deg, #6600ff, #6600ff 2px, #812bb2 0, #812bb2 4px); text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;}`);
        let preferencesHtml = '<div id="chatstalker-settings-container" class="tt-container rounding mt10">\
								  <div class="title collapsed">\
									<div class="text">ChatStalker - Settings</div>\
									<div class="options">\
									  <a class="preference-button" target="_blank">Settings\
									  </a>\
									</div>\
								  </div>\
								</div>';
        $('.preferences-container').after(preferencesHtml);
        document.addEventListener("click", function (e) {
            if (e.target.className == "preference-button") {
                gmConfig_init();
                GM_config.open();
            }
        });
    }
	
    GM_addStyle(`
        .stalker_modal { border-radius: 8px; background-color: rgb(242, 242, 242); animation: animate 3s linear infinite;}
		@keyframes animate { 0% { box-shadow: 0 0 0 0 rgba(255,109,74,.7), 0 0 0 0 rgba(255,109,74,.7);} 40% { box-shadow: 0 0 0 9px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,.7);} 80% { box-shadow: 0 0 0 8px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} 100% { box-shadow: 0 0 0 0 rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} }
		.stalker_modal-content { margin: 5px 0; padding: 8px 10px; line-height: 12px; }
        .stalker_line { font-size: 10px;  }
        .stalker_line a { font-size: 10px }
        .stalker_close-button.torn-btn { float: right; line-height: 10px; padding: 2px 4px; font-size: 10px; margin-top: -2px; padding-top: 3px;}
    `);
})();