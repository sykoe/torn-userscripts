// ==UserScript==
// @name         Chat Stalker
// @namespace    sykoe.chatstalker
// @version      1.6.3
// @description  Notifies when a user post in global or trade chat (forked from Hardy[2131687]). Does NOT work when global/trade chat is disabled via torntools.
// @author       Sykoe[2734951]
// @match        https://www.torn.com/*
// @exclude      https://www.torn.com/loader.php*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
    //add user IDs of people you want to stalk. there is a list for both and also do both chats have their own seperate list. 
	//by default Hardy[2131687], Chedburn[1], and I (Sykoe[2734951]) are added to both lists as examples
    let stalkOnAllChats = ["1", "2131687", "2734951",]
    //ONLY in GLOBAL chat
    let globalTargets = stalkOnAllChats.concat([]);
    //ONLY in TRADE chat
    let tradeTargets = stalkOnAllChats.concat([]);
	//ONLY in FACTION chat
    let factionTargets = stalkOnAllChats.concat([]);

    //add words / phrases to search for; eg "psa" (public service announcement) on all channels, "gift" on global, and "cache" on trade chat
    let messagesOnAllChats = ["psa"]
    //ONLY in GLOBAL
    let globalMessages = messagesOnAllChats.concat(["gift"]);
    //ONLY in TRADE
    let tradeMessages = messagesOnAllChats.concat(["armor cache", "cache"]);
	//ONLY in FACTION
    let factionMessages = messagesOnAllChats.concat(["attack", "chain"]);

    //DEVELOP
    const devMode = false;

    function pAlert(id, name, room, str) {
        var lastSeen = localStorage.getItem("lastStalk");
        var last;
        if (typeof lastSeen == "undefined" || lastSeen == null) {
            last = {"victims": {}};
            localStorage.setItem("lastStalk", JSON.stringify(last));
        } else {
            last = JSON.parse(lastSeen);
            if (last["victims"][id]) {
                if (Date.now() - last["victims"][id] < 2000) {
                    return;
                }
            }
        }
        let boxHtml = '<div class="stalker_modal" id="stalker_modal-'+id+'">\
                           <div class="stalker_modal-content">\
                               <p class="stalker_line">\
                                   <a href="https://www.torn.com/profiles.php?XID='+id+'">'+name+'</a>\
                                   <span style="font-size: 10px">['+room+']:</span> "'+str+'" \
                                   <button class="stalker_close-button torn-btn">x</button>\
                               </p>\
                           </div>\
                       </div>';
        $(".content-wrapper").prepend(boxHtml);
        last["victims"][id] = Date.now();
        localStorage.setItem("lastStalk", JSON.stringify(last));
    }

    function doesStrContainPhrases(string, phrases) {
		if(string && phrases) {
			for (let i = 0; i < phrases.length; i++) {
				if (string.toLowerCase().includes(phrases[i].toLowerCase())) {
					return true;
				}
			}
		}
		return false;
    }

    let chatCode = document.querySelector('script[src^="/builds/chat"]');
    let secret = chatCode.getAttribute("secret");
    let uid = chatCode.getAttribute("uid");
    let socket = new WebSocket("wss://ws-chat.torn.com/chat/ws?uid="+uid+"&secret="+secret);

    socket.onmessage = function(event) {
        let data = JSON.parse(event.data)["data"][0];
        //console.log(data);

        //checks for stalked userID
        if (data.roomId == "Trade" && tradeTargets.indexOf(data.senderId) !== -1) {
            pAlert(data.senderId, data.senderName, 'Trade', data.messageText);
        }
        //checks message for containing words/phrases
        else if (data.roomId == "Trade" && doesStrContainPhrases(data.messageText, tradeMessages) == true) {
            pAlert(data.senderId, data.senderName, 'Trade', data.messageText);
        }
		//global chat
        else if (data.roomId == "Global" && globalTargets.indexOf(data.senderId) !== -1) {
            pAlert(data.senderId, data.senderName, 'Global', data.messageText);
        } else if (data.roomId == "Global" && doesStrContainPhrases(data.messageText, globalMessages) == true){
            pAlert(data.senderId, data.senderName, 'Global', data.messageText);
        }
		//faction chat
		else if (data.roomId.split(':')[0] == "Faction" && factionTargets.indexOf(data.senderId) !== -1) {
            pAlert(data.senderId, data.senderName, 'Faction', data.messageText);
        } else if (data.roomId.split(':')[0] == "Faction" && doesStrContainPhrases(data.messageText, factionMessages) == true){
            pAlert(data.senderId, data.senderName, 'Faction', data.messageText);
        }
		//devMode just lets all messages through
        else if((data.roomId == "Global" || data.roomId == "Trade" || data.roomId.split(':')[0] == "Faction") && devMode == true && data.senderName) {
            console.log(data);
            pAlert('1337', 'DevMode', data.roomId, data.senderName + ': ' + data.messageText);
        }
    };

    document.addEventListener("click", function(e) {
        if (e.target.className == "stalker_close-button torn-btn") {
            document.querySelector(".stalker_modal").remove();
        }
    });

    GM_addStyle(`
        .stalker_modal { border-radius: 8px; background-color: rgb(242, 242, 242); animation: animate 3s linear infinite;}
		@keyframes animate { 0% { box-shadow: 0 0 0 0 rgba(255,109,74,.7), 0 0 0 0 rgba(255,109,74,.7);} 40% { box-shadow: 0 0 0 9px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,.7);} 80% { box-shadow: 0 0 0 8px rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} 100% { box-shadow: 0 0 0 0 rgba(255,109,74,0), 0 0 0 0 rgba(255,109,74,0);} }
		.stalker_modal-content { margin: 5px 0; padding: 8px 10px; line-height: 12px; }
        .stalker_line { font-size: 10px;  }
        .stalker_line a { font-size: 10px }
        .stalker_close-button.torn-btn { float: right; line-height: 10px; padding: 2px 4px; font-size: 10px; margin-top: -2px; padding-top: 3px;}
    `);

})();
