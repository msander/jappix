/*

Jappix - An open social platform
These are the Jappix Mini JS scripts for Jappix

-------------------------------------------------

License: dual-licensed under AGPL and MPLv2
Authors: Val�rian Saliou, hunterjm, Camaran, regilero, Kloadut, Maranda
Last revision: 20/09/13

*/

// Jappix Mini globals
var MINI_DISCONNECT				= false;
var MINI_AUTOCONNECT			= false;
var MINI_SHOWPANE				= false;
var MINI_INITIALIZED			= false;
var MINI_ROSTER_INIT			= false;
var MINI_ROSTER_NOGROUP         = 'jm_nogroup'
var MINI_ANONYMOUS				= false;
var MINI_ANIMATE				= false;
var MINI_RANDNICK				= false;
var MINI_GROUPCHAT_PRESENCE		= false;
var MINI_DISABLE_MOBILE			= false;
var MINI_NICKNAME				= '';
var MINI_TITLE					= null;
var MINI_DOMAIN					= null;
var MINI_USER					= null;
var MINI_PASSWORD				= null;
var MINI_HASH					= null;
var MINI_ACTIVE					= null;
var MINI_RECONNECT				= 0;
var MINI_RECONNECT_MAX			= 100;
var MINI_RECONNECT_INTERVAL     = 1;
var MINI_QUEUE					= [];
var MINI_CHATS					= [];
var MINI_GROUPCHATS				= [];
var MINI_SUGGEST_CHATS			= [];
var MINI_SUGGEST_GROUPCHATS		= [];
var MINI_SUGGEST_PASSWORDS		= [];
var MINI_PASSWORDS				= [];
var MINI_PRIORITY				= 1;
var MINI_RESOURCE				= JAPPIX_RESOURCE + ' Mini';
var MINI_ERROR_LINK				= 'https://mini.jappix.com/issues';

var MINI_SMILEYS = {
    ':wink:' : 'wink'
}

// Setups connection handlers
function setupConMini(con) {
	try {
		con.registerHandler('message', handleMessageMini);
		con.registerHandler('presence', handlePresenceMini);
		con.registerHandler('iq', handleIQMini);
		con.registerHandler('onerror', handleErrorMini);
		con.registerHandler('onconnect', connectedMini);
	} catch(e) {
		Console.error('setupConMini', e);
	}
}

// Connects the user with the given logins
function connectMini(domain, user, password) {
	try {
		// We define the http binding parameters
		oArgs = new Object();
		
		if(HOST_BOSH_MINI)
			oArgs.httpbase = HOST_BOSH_MINI;
		else
			oArgs.httpbase = HOST_BOSH;
		
		// Check BOSH origin
		BOSH_SAME_ORIGIN = isSameOrigin(oArgs.httpbase);
		
		// We create the new http-binding connection
		con = new JSJaCHttpBindingConnection(oArgs);
		
		// And we handle everything that happen
		setupConMini(con);
		
		// Generate a resource
		var random_resource = getDB(MINI_HASH, 'jappix-mini', 'resource');
		
		if(!random_resource)
			random_resource = MINI_RESOURCE + ' (' + (new Date()).getTime() + ')';
		
		// We retrieve what the user typed in the login inputs
		oArgs = new Object();
		oArgs.secure = true;
		oArgs.xmllang = XML_LANG;
		oArgs.resource = random_resource;
		oArgs.domain = domain;
		
		// Store the resource (for reconnection)
		setDB(MINI_HASH, 'jappix-mini', 'resource', random_resource);
		
		// Anonymous login?
		if(MINI_ANONYMOUS) {
			// Anonymous mode disabled?
			if(!allowedAnonymous()) {
				Console.warn('Not allowed to use anonymous mode.');
				
				// Notify this error
				notifyErrorMini();
				
				return false;
			}
			
			// Bad domain?
			else if(lockHost() && (domain != HOST_ANONYMOUS)) {
				Console.warn('Not allowed to connect to this anonymous domain: ' + domain);
				
				// Notify this error
				notifyErrorMini();
				
				return false;
			}
			
			oArgs.authtype = 'saslanon';
		}
		
		// Normal login
		else {
			// Bad domain?
			if(lockHost() && (domain != HOST_MAIN)) {
				Console.warn('Not allowed to connect to this main domain: ' + domain);
				
				// Notify this error
				notifyErrorMini();
				
				return false;
			}
			
			// No nickname?
			if(!MINI_NICKNAME)
				MINI_NICKNAME = user;
			
			oArgs.username = user;
			oArgs.pass = password;
		}
		
		// We connect !
		con.connect(oArgs);
		
		Console.info('Jappix Mini is connecting...');
	}
	
	catch(e) {
		// Logs errors
		Console.error('connectMini', e);
		
		// Reset Jappix Mini
		disconnectedMini();
	}
	
	finally {
		return false;
	}
}

// When the user is connected
function connectedMini() {
	try {
		// Do not get the roster if anonymous
		if(!MINI_RECONNECT) {
			// Update the roster
			jQuery('#jappix_mini a.jm_pane.jm_button span.jm_counter').text('0');

			if(MINI_ANONYMOUS)
				initializeMini();
			else
				getRosterMini();

			Console.info('Jappix Mini is now connected.');
		} else {
			reconnectedMini();

			Console.info('Jappix Mini is now reconnected.');
		}

		// Reset reconnect var
		MINI_RECONNECT = 0;
		removeDB(MINI_HASH, 'jappix-mini', 'reconnect');

		// Execute enqueued events
		dequeueMini();
	} catch(e) {
		Console.error('connectedMini', e);
	}
}

// When the user is reconnected
function reconnectedMini() {
	try {
		var last_presence = getDB(MINI_HASH, 'jappix-mini', 'presence-last') || 'available';

		// Flush presence storage
		flushStorageMini('presence');

		// Empty groupchat messages
		jQuery('#jappix_mini div.jm_conversation.jm_type_groupchat div.jm_received-messages div.jm_group').remove();

		// Re-send all presences
		jQuery('#jappix_mini div.jm_status_picker a[data-status="' + encodeQuotes(last_presence) + '"]').click();
	} catch(e) {
		Console.error('reconnectedMini', e);
	}
}

// When the user disconnects
function saveSessionMini() {
	try {
		// Not initialized?
		if(!MINI_INITIALIZED)
			return;
		
		// Save the actual Jappix Mini DOM
		setDB(MINI_HASH, 'jappix-mini', 'dom', jQuery('#jappix_mini').html());
		setDB(MINI_HASH, 'jappix-mini', 'nickname', MINI_NICKNAME);
		
		// Save the scrollbar position
		var scroll_position = '';
		var scroll_hash = jQuery('#jappix_mini div.jm_conversation:has(a.jm_pane.jm_clicked)').attr('data-hash');
		
		if(scroll_hash)
			scroll_position = document.getElementById('received-' + scroll_hash).scrollTop + '';
		
		setDB(MINI_HASH, 'jappix-mini', 'scroll', scroll_position);
		
		// Suspend connection
		if(isConnected()) {
			con.suspend(false);
		} else {
			setDB(MINI_HASH, 'jappix-mini', 'reconnect', ((MINI_RECONNECT == 0) ? 0 : (MINI_RECONNECT - 1)));
			serializeQueueMini();
		}
		
		Console.info('Jappix Mini session save tool launched.');
	} catch(e) {
		Console.error('saveSessionMini', e);
	}
}

// Flushes Jappix Mini storage database
function flushStorageMini(r_override) {
	try {
		var i,
		    db_regex, db_current;

		db_regex = new RegExp(('^' + MINI_HASH + '_') + 'jappix\-mini' + (r_override ? ('_' + r_override) : ''));

		for(i = 0; i < storageDB.length; i++) {
			db_current = storageDB.key(i);

			if(db_regex.exec(db_current))
				storageDB.removeItem(db_current);
		}

		Console.log('Jappix Mini DB has been successfully flushed (' + (r_override ? 'partly' : 'completely') + ').');
	} catch(e) {
		Console.error('flushStorageMini', e);
	}
}

// Disconnects the connected user
function disconnectMini() {
	try {
		// No connection?
		if(!isConnected())
			return false;
		
		Console.info('Jappix Mini is disconnecting...');
		
		// Change markers
		MINI_DISCONNECT = true;
		MINI_INITIALIZED = false;

		// Flush storage
		flushStorageMini();
		
		// Add disconnection handler
		con.registerHandler('ondisconnect', function() {
			disconnectedMini();
		});
		
		// Disconnect the user
		con.disconnect();
		
		return false;
	} catch(e) {
		Console.error('disconnectMini', e);
	}
}

// When the user is disconnected
function disconnectedMini() {
	try {
		// Connection error?
		if(!MINI_DISCONNECT || MINI_INITIALIZED) {
			// Reset reconnect timer
			jQuery('#jappix_mini').stopTime();
			
			// Try to reconnect after a while
			if(MINI_INITIALIZED && (MINI_RECONNECT++ < MINI_RECONNECT_MAX)) {
				// Set timer
				jQuery('#jappix_mini').oneTime(MINI_RECONNECT_INTERVAL * 1000, function() {
					Console.debug('Trying to reconnect... (attempt: ' + MINI_RECONNECT + ' / ' + MINI_RECONNECT_MAX + ')');

					// Silently reconnect user
					connectMini(MINI_DOMAIN, MINI_USER, MINI_PASSWORD);
				});

				Console.info('Jappix Mini is encountering connectivity issues.');
			} else {
				// Remove the stored items
				flushStorageMini();

				// Notify this error
				notifyErrorMini();

				// Reset markers
				MINI_DISCONNECT = false;
				MINI_INITIALIZED = false;

				Console.info('Jappix Mini is giving up. Server seems to be down.');
			}
		}
		
		// Normal disconnection?
		else {
			launchMini(false, MINI_SHOWPANE, MINI_DOMAIN, MINI_USER, MINI_PASSWORD);

			// Reset markers
			MINI_DISCONNECT = false;
			MINI_INITIALIZED = false;

			Console.info('Jappix Mini is now disconnected.');
		}
	} catch(e) {
		Console.error('disconnectedMini', e);
	}
}

// Handles the incoming errors
function handleErrorMini(err) {
	try {
		// First level error (connection error)
		if(jQuery(err).is('error')) {
			// Notify this error
			disconnectedMini();
			
			Console.error('First level error received.');
		}
	} catch(e) {
		Console.error('handleErrorMini', e);
	}
}

// Handles the incoming messages
function handleMessageMini(msg) {
	try {
		var type = msg.getType();
		
		// This is a message Jappix can handle
		if((type == 'chat') || (type == 'normal') || (type == 'groupchat') || !type) {
			// Get the packet data
			var node = msg.getNode();
			var subject = trim(msg.getSubject());
			var body = subject ? subject : trim(msg.getBody());
			
			// Get the sender data
			var from = fullXID(getStanzaFrom(msg));
			var xid = bareXID(from);
			var hash = hex_md5(xid);
			
			// Any attached message body?
			if(body) {
				// Get more sender data
				var use_xid = xid;
				var nick = thisResource(from);
				
				// Read the delay
				var delay = readMessageDelay(node);
				var d_stamp;
				
				// Manage this delay
				if(delay) {
					time = relativeDate(delay);
					d_stamp = Date.jab2date(delay);
				}
				
				else {
					time = getCompleteTime();
					d_stamp = new Date();
				}
				
				// Get the stamp
				var stamp = extractStamp(d_stamp);
				
				// Is this a groupchat private message?
				if(exists('#jappix_mini #chat-' + hash + '[data-type="groupchat"]')) {
					// Regenerate some stuffs
					if((type == 'chat') || (type == 'normal') || !type) {
						xid = from;
						hash = hex_md5(xid);
					}
					
					// XID to use for a groupchat
					else
						use_xid = from;
				}
				
				// Message type
				var message_type = 'user-message';
				
				// Grouphat values
				if(type == 'groupchat') {
					// Old message
					if(msg.getChild('delay', NS_URN_DELAY) || msg.getChild('x', NS_DELAY))
						message_type = 'old-message';
					
					// System message?
					if(!nick || subject) {
						nick = '';
						message_type = 'system-message';
					}
				}
				
				// Chat values
				else {
					nick = jQuery('#jappix_mini a#friend-' + hash).text().revertHtmlEnc();
					
					// No nickname?
					if(!nick) {
						// If the roster does not give us any nick the user may have send us a nickname to use with his first message
						// @see http://xmpp.org/extensions/xep-0172.html
						var unknown_entry = jQuery('#jappix_mini a.jm_unknown[data-xid="' + xid + '"]');
						
						if(unknown_entry.size() > 0) {
							nick =  unknown_entry.attr('data-nick');
						} else {
							var msgnick = msg.getNick();
							nick = getXIDNick(xid);
							
							if(msgnick) {
							 	// If there is a nickname in the message which differs from the jid-extracted nick then tell it to the user
								if(nick != msgnick)
									 nick = msgnick + ' (' + nick + ')';
							}
							
							// Push that unknown guy in a temporary roster entry
							var unknown_entry = jQuery('<a class="jm_unknown jm_offline" href="#"></a>').attr('data-nick', nick).attr('data-xid', xid);
							unknown_entry.appendTo('#jappix_mini div.jm_roster div.jm_buddies');
						 }
					}
				}
				
				// Define the target div
				var target = '#jappix_mini #chat-' + hash;
				
				// Create the chat if it does not exist
				if(!exists(target) && (type != 'groupchat'))
					chatMini(type, xid, nick, hash);
				
				// Display the message
				displayMessageMini(type, body, use_xid, nick, hash, time, stamp, message_type);
				
				// Notify the user if not focused & the message is not a groupchat old one
				if((!jQuery(target + ' a.jm_chat-tab').hasClass('jm_clicked') || !isFocused() || (MINI_ACTIVE != hash)) && (message_type == 'user-message')) {
					// Play a sound
					if(type != 'groupchat')
						soundPlayMini();
					
					// Show a notification bubble
					notifyMessageMini(hash);
				}
				
				Console.log('Message received from: ' + from);
			}
			
			// Chatstate groupchat filter
			if(exists('#jappix_mini #chat-' + hash + '[data-type="groupchat"]')) {
				xid = from;
				hash = hex_md5(xid);
			}
			
			// Reset current chatstate
			resetChatstateMini(xid, hash, type);
			
			// Apply new chatstate (if supported)
			if(jQuery(node).find('active[xmlns="' + NS_CHATSTATES + '"]').size() || jQuery(node).find('composing[xmlns="' + NS_CHATSTATES + '"]').size()) {
				// Set marker to tell other user supports chatstates
				jQuery('#jappix_mini #chat-' + hash + ' input.jm_send-messages').attr('data-chatstates', 'true');
				
				// Composing?
				if(jQuery(node).find('composing[xmlns="' + NS_CHATSTATES + '"]').size())
					displayChatstateMini('composing', xid, hash, type);
			}
		}
	} catch(e) {
		Console.error('handleMessageMini', e);
	}
}

// Handles the incoming IQs
function handleIQMini(iq) {
	try {
		// Define some variables
		var iqFrom = fullXID(getStanzaFrom(iq));
		var iqID = iq.getID();
		var iqQueryXMLNS = iq.getQueryXMLNS();
		var iqType = iq.getType();
		var iqNode = iq.getNode();
		
		// Build the response
		var iqResponse = new JSJaCIQ();
		
		iqResponse.setID(iqID);
		iqResponse.setTo(iqFrom);
		iqResponse.setType('result');
		
		// Software version query
		if((iqQueryXMLNS == NS_VERSION) && (iqType == 'get')) {
			/* REF: http://xmpp.org/extensions/xep-0092.html */
			
			var iqQuery = iqResponse.setQuery(NS_VERSION);
			
			iqQuery.appendChild(iq.buildNode('name', {'xmlns': NS_VERSION}, 'Jappix Mini'));
			iqQuery.appendChild(iq.buildNode('version', {'xmlns': NS_VERSION}, JAPPIX_VERSION));
			iqQuery.appendChild(iq.buildNode('os', {'xmlns': NS_VERSION}, navigator.platform));
			
			con.send(iqResponse);
			
			Console.log('Received software version query: ' + iqFrom);
		}
		
		// Roster push
		else if((iqQueryXMLNS == NS_ROSTER) && (iqType == 'set')) {
			// Display the friend
			handleRosterMini(iq);
			
			con.send(iqResponse);
			
			Console.log('Received a roster push.');
		}
		
		// Disco info query
		else if((iqQueryXMLNS == NS_DISCO_INFO) && (iqType == 'get')) {
			/* REF: http://xmpp.org/extensions/xep-0030.html */
			
			var iqQuery = iqResponse.setQuery(NS_DISCO_INFO);
			
			// We set the name of the client
			iqQuery.appendChild(iq.appendNode('identity', {
				'category': 'client',
				'type': 'web',
				'name': 'Jappix Mini',
				'xmlns': NS_DISCO_INFO
			}));
			
			// We set all the supported features
			var fArray = new Array(
				NS_DISCO_INFO,
				NS_VERSION,
				NS_ROSTER,
				NS_MUC,
				NS_VERSION,
				NS_URN_TIME
			);
			
			for(i in fArray)
				iqQuery.appendChild(iq.buildNode('feature', {'var': fArray[i], 'xmlns': NS_DISCO_INFO}));
			
			con.send(iqResponse);
			
			Console.log('Received a disco#infos query.');
		}
		
		// User time query
		else if(jQuery(iqNode).find('time').size() && (iqType == 'get')) {
			/* REF: http://xmpp.org/extensions/xep-0202.html */
			
			var iqTime = iqResponse.appendNode('time', {'xmlns': NS_URN_TIME});
			iqTime.appendChild(iq.buildNode('tzo', {'xmlns': NS_URN_TIME}, getDateTZO()));
			iqTime.appendChild(iq.buildNode('utc', {'xmlns': NS_URN_TIME}, getXMPPTime('utc')));
			
			con.send(iqResponse);
			
			Console.log('Received local time query: ' + iqFrom);
		}
		
		// Ping
		else if(jQuery(iqNode).find('ping').size() && (iqType == 'get')) {
			/* REF: http://xmpp.org/extensions/xep-0199.html */
			
			con.send(iqResponse);
			
			Console.log('Received a ping: ' + iqFrom);
		}
		
		// Not implemented
		else if(!jQuery(iqNode).find('error').size() && ((iqType == 'get') || (iqType == 'set'))) {
			// Append stanza content
			for(var i = 0; i < iqNode.childNodes.length; i++)
				iqResponse.getNode().appendChild(iqNode.childNodes.item(i).cloneNode(true));
			
			// Append error content
			var iqError = iqResponse.appendNode('error', {'xmlns': NS_CLIENT, 'code': '501', 'type': 'cancel'});
			iqError.appendChild(iq.buildNode('feature-not-implemented', {'xmlns': NS_STANZAS}));
			iqError.appendChild(iq.buildNode('text', {'xmlns': NS_STANZAS}, _e("The feature requested is not implemented by the recipient or server and therefore cannot be processed.")));
			
			con.send(iqResponse);
			
			Console.log('Received an unsupported IQ query from: ' + iqFrom);
		}
	} catch(e) {
		Console.error('handleIQMini', e);
	}
}

// Handles the incoming presences
function handlePresenceMini(pr) {
	try {
		// Get the values
		var xml           = pr.getNode();
		var from          = fullXID(getStanzaFrom(pr));
		var xid           = bareXID(from);
		var resource      = thisResource(from);
		var resources_obj = {};

		// Is this a groupchat?
		if(exists('#jappix_mini div.jm_conversation[data-type="groupchat"][data-xid="' + encodeQuotes(xid) + '"]'))
			xid = from;

		// Store presence stanza
		setDB(MINI_HASH, 'jappix-mini', 'presence-stanza-' + from, pr.xml());
		resources_obj = addResourcePresenceMini(xid, resource);

		// Re-process presence storage for this buddy
		processPresenceMini(xid, resource, resources_obj);

		// Display that presence
		displayPresenceMini(xid);

		Console.log('Presence received from: ' + from);
	} catch(e) {
		Console.error('handlePresenceMini', e);
	}
}

// Reads a stored presence
function readPresenceMini(from) {
	try {
		var pr = getDB(MINI_HASH, 'jappix-mini', 'presence-stanza-' + from);

		if(!pr)  pr = '<presence type="unavailable"></presence>';

		return XMLFromString(pr);
	} catch(e) {
		Console.error('readPresenceMini', e);
	}
}

// Lists presence resources for an user
function resourcesPresenceMini(xid) {
	try {
		var resources_obj = {};
		var resources_db  = getDB(MINI_HASH, 'jappix-mini', 'presence-resources-' + xid);

		if(resources_db) {
			resources_obj = jQuery.evalJSON(resources_db);
		}

		return resources_obj;
	} catch(e) {
		Console.error('resourcesPresenceMini', e);
	}
}

// Adds a given presence resource for an user
function addResourcePresenceMini(xid, resource) {
	try {
		var resources_obj = resourcesPresenceMini(xid);

		resources_obj[resource] = 1;
		setDB(MINI_HASH, 'jappix-mini', 'presence-resources-' + xid, jQuery.toJSON(resources_obj));

		return resources_obj;
	} catch(e) {
		Console.error('addResourcePresenceMini', e);
	}

	return null;
}

// Removes a given presence resource for an user
function removeResourcePresenceMini(xid, resource) {
	try {
		var resources_obj = resourcesPresenceMini(xid);

		delete resources_obj[resource];
		setDB(MINI_HASH, 'jappix-mini', 'presence-resources-' + xid, jQuery.toJSON(resources_obj));

		return resources_obj;
	} catch(e) {
		Console.error('removeResourcePresenceMini', e);
	}

	return null;
}

// Process presence storage for a given contact
function processPresenceMini(xid, resource, resources_obj) {
	try {
		if(!xid) {
			Console.warn('processPresenceMini > No XID value');
			return;
		}

		// Initialize vars
		var cur_resource, cur_from, cur_pr,
		    cur_xml, cur_priority,
		    from_highest, from_highest;

		from_highest = null;
		max_priority = null;

		// Groupchat presence? (no priority here)
		if(xid.indexOf('/') !== -1) {
			from_highest = xid;

			Console.log('Processed presence for groupchat user: ' + xid);
		} else {
			if(!priorityPresenceMini(xid)) {
				from_highest = xid + '/' + resource;

				Console.log('Processed initial presence for regular user: ' + xid + ' (highest priority for: ' + (from_highest || 'none') + ')');
			} else {
				for(cur_resource in resources_obj) {
					// Read presence data
					cur_from = xid + '/' + cur_resource;
					cur_pr   = getDB(MINI_HASH, 'jappix-mini', 'presence-stanza-' + cur_from);

					if(cur_pr) {
						// Parse presence data
						cur_xml      = XMLFromString(cur_pr);
						cur_priority = jQuery(cur_xml).find('priority').text();
						cur_priority = !isNaN(cur_priority) ? parseInt(cur_priority) : 0;
						
						// Higher priority?
						if((cur_priority >= max_priority) || (max_priority == null)) {
							max_priority = cur_priority;
							from_highest = cur_from;
						}
					}
				}

				Console.log('Processed presence for regular user: ' + xid + ' (highest priority for: ' + (from_highest || 'none') + ')');
			}
		}

		if(from_highest)
			setDB(MINI_HASH, 'jappix-mini', 'presence-priority-' + xid, from_highest);
		else
			removeDB(MINI_HASH, 'jappix-mini', 'presence-priority-' + xid);
	} catch(e) {
		Console.error('processPresenceMini', e);
	}
}

// Returns highest presence priority
function priorityPresenceMini(xid) {
	try {
		return getDB(MINI_HASH, 'jappix-mini', 'presence-priority-' + xid) || '';
	} catch(e) {
		Console.error('priorityPresenceMini', e);
	}

	return null;
}

// Displays a Jappix Mini presence
function displayPresenceMini(xid) {
	try {
		// Get the values
		var from     = priorityPresenceMini(xid);
		var xml      = readPresenceMini(from);
		var pr       = jQuery(xml).find('presence');
		var resource = thisResource(from);
		var bare_xid = bareXID(xid);
		var hash     = hex_md5(bare_xid);
		var type     = pr.attr('type');
		var show     = pr.find('show').text();

		// Manage the received presence values
		if((type == 'error') || (type == 'unavailable')) {
			show = 'unavailable';
		} else {
			switch(show) {
				case 'chat':
				case 'away':
				case 'xa':
				case 'dnd':
					break;
				
				default:
					show = 'available';
					
					break;
			}
		}
		
		// Is this a groupchat presence?
		var groupchat_path = '#jappix_mini #chat-' + hash + '[data-type="groupchat"]';
		var is_groupchat = false;
		
		if(exists(groupchat_path)) {
			// Groupchat exists
			is_groupchat = true;
			
			// Groupchat buddy presence (not me)
			if(resource != unescape(jQuery(groupchat_path).attr('data-nick'))) {
				// Regenerate some stuffs
				var groupchat = xid;
				var groupchat_hash = hash;
				xid = from;
				hash = hex_md5(xid);
				
				// Process this groupchat user presence
				var log_message;

				if(show == 'unavailable') {
					// Remove from roster view
					removeBuddyMini(hash, groupchat);

					// Generate log message
					log_message = printf(_e("%s left"), resource.htmlEnc());
				} else {
					// Add to roster view
					addBuddyMini(xid, hash, resource, groupchat);

					// Generate log message
					log_message = printf(_e("%s joined"), resource.htmlEnc());
				}

				// Log message in chat view
				if(MINI_GROUPCHAT_PRESENCE && log_message && (jQuery(groupchat_path).attr('data-init') == 'true'))
					displayMessageMini('groupchat', log_message, xid, '', groupchat_hash, getCompleteTime(), getTimeStamp(), 'system-message');
			}
		}
		
		// Friend path
		var chat = '#jappix_mini #chat-' + hash;
		var friend = '#jappix_mini a#friend-' + hash;
		var send_input = chat + ' input.jm_send-messages';
		
		// Is this friend online?
		if(show == 'unavailable') {
			// Offline marker
			jQuery(friend).addClass('jm_offline').removeClass('jm_online jm_hover');
			
			// Hide the friend just to be safe since the search uses .hide() and .show() which can override the CSS display attribute
			jQuery(friend).hide();
			
			// Disable the chat tools
			if(is_groupchat) {
				jQuery(chat).addClass('jm_disabled').attr('data-init', 'false');
				jQuery(send_input).blur().attr('disabled', true).attr('data-value', _e("Unavailable")).val(_e("Unavailable"));
			}
		} else {
			// Online marker
			jQuery(friend).removeClass('jm_offline').addClass('jm_online');
			
			// Check against search string
			var search = jQuery('#jappix_mini div.jm_roster div.jm_search input.jm_searchbox').val();
			var regex = new RegExp('((^)|( ))' + escapeRegex(search), 'gi');
			var nick = unescape(jQuery(friend).data('nick'));

			if(search && !nick.match(regex))
				jQuery(friend).hide();
			else
				jQuery(friend).show();
			
			// Enable the chat input
			if(is_groupchat) {
				jQuery(chat).removeClass('jm_disabled');
				jQuery(send_input).removeAttr('disabled').val('');
			}
		}
		
		// Change the show presence of this buddy
		jQuery(friend + ' span.jm_presence, ' + chat + ' span.jm_presence').attr('class', 'jm_presence jm_images jm_' + show);
		
		// Update the presence counter
		updateRosterMini();

		Console.log('Presence displayed for user: ' + xid);
	} catch(e) {
		Console.error('displayPresenceMini', e);
	}
}

// Handles the MUC main elements
function handleMUCMini(pr) {
	try {
		// We get the xml content
		var xml = pr.getNode();
		var from = fullXID(getStanzaFrom(pr));
		var room = bareXID(from);
		var hash = hex_md5(room);
		var resource = thisResource(from);
		
		// Is it a valid server presence?
		var valid = false;
		
		if(!resource || (resource == unescape(jQuery('#jappix_mini #chat-' + hash + '[data-type="groupchat"]').attr('data-nick'))))
			valid = true;
		
		// Password required?
		if(valid && jQuery(xml).find('error[type="auth"] not-authorized').size()) {
			// Create a new prompt
			openPromptMini(printf(_e("This room (%s) is protected with a password."), room));
			
			// When prompt submitted
			jQuery('#jappix_popup div.jm_prompt form').submit(function() {
				try {
					// Read the value
					var password = closePromptMini();
					
					// Any submitted chat to join?
					if(password) {
						// Send the password
						presenceMini('', '', '', '', from, password, true, handleMUCMini);
						
						// Focus on the pane again
						switchPaneMini('chat-' + hash, hash);
					}
				}
				
				catch(e) {}
				
				finally {
					return false;
				}
			});
			
			return;
		}
		
		// Nickname conflict?
		else if(valid && jQuery(xml).find('error[type="cancel"] conflict').size()) {
			// New nickname
			var nickname = resource + '_';
			
			// Send the new presence
			presenceMini('', '', '', '', room + '/' + nickname, '', true, handleMUCMini);
			
			// Update the nickname marker
			jQuery('#jappix_mini #chat-' + hash).attr('data-nick', escape(nickname));
		}
		
		// Handle normal presence
		else {
			// Start the initial timer
			jQuery('#jappix_mini #chat-' + hash).oneTime('10s', function() {
				jQuery(this).attr('data-init', 'true');
			});

			// Trigger presence handler
			handlePresenceMini(pr);
		}
	} catch(e) {
		Console.error('handleMUCMini', e);
	}
}

// Updates the user presence
function presenceMini(type, show, priority, status, to, password, limit_history, handler) {
	try {
		var pr = new JSJaCPresence();
		
		// Add the attributes
		if(to)
			pr.setTo(to);
		if(type)
			pr.setType(type);
		if(show)
			pr.setShow(show);
		if(status)
			pr.setStatus(status);

		if(priority)
			pr.setPriority(priority);
		else if(MINI_PRIORITY && !to)
			pr.setPriority(MINI_PRIORITY);

		// Special presence elements
		if(password || limit_history) {
			var x = pr.appendNode('x', {'xmlns': NS_MUC});
			
			// Any password?
			if(password)
				x.appendChild(pr.buildNode('password', {'xmlns': NS_MUC}, password));
			
			// Any history limit?
			if(limit_history)
				x.appendChild(pr.buildNode('history', {'maxstanzas': 10, 'seconds': 86400, 'xmlns': NS_MUC}));
		}
		
		// Send the packet
		if(handler)
			con.send(pr, handler);
		else
			con.send(pr);
		
		Console.info('Presence sent (to: ' + (to || 'none') + ', show: ' + (show || 'none') + ', type: ' + (type || 'none') + ')');
	} catch(e) {
		Console.error('presenceMini', e);
	}
}

// Sends a given message
function sendMessageMini(aForm) {
	try {
		var body = trim(aForm.body.value);
		var xid = aForm.xid.value;
		var type = aForm.type.value;
		var hash = hex_md5(xid);
		
		if(body && xid) {
			// Send the message
			var aMsg = new JSJaCMessage();
			
			// If the roster does not give us any nick the user may have send us a nickname to use with his first message
            // @see http://xmpp.org/extensions/xep-0172.html
            var known_roster_entry = jQuery('#jappix_mini a.jm_friend[data-xid="' + xid + '"]');
            
			if(known_roster_entry.size() == 0) {
		        var subscription = known_roster_entry.attr('data-sub');
		        
		        // The other may not know my nickname if we do not have both a roster entry, or if he doesn't have one
		        if(('both' != subscription) && ('from' != subscription))
	                aMsg.setNick(MINI_NICKNAME);
			}
			
			// Message data
			aMsg.setTo(xid);
			aMsg.setType(type);
			aMsg.setBody(body);
			
			// Chatstate
			aMsg.appendNode('active', {'xmlns': NS_CHATSTATES});
			
			// Send it!
			enqueueMini(aMsg);
			
			// Clear the input
			aForm.body.value = '';
			
			// Display the message we sent
			if(type != 'groupchat')
				displayMessageMini(type, body, getXID(), 'me', hash, getCompleteTime(), getTimeStamp(), 'user-message');
			
			Console.log('Message (' + type + ') sent to: ' + xid);
		}
	} catch(e) {
		Console.error('sendMessageMini', e);
	} finally {
		return false;
	}
}

// Enqueues a stanza (to be sent over the network)
function enqueueMini(stanza) {
	try {
		// Send stanza over the network or enqueue it?
		if(isConnected()) {
			con.send(stanza);
		} else {
			MINI_QUEUE.push(
				stanza.xml()
			);

			Console.log('Enqueued an event (to be sent when connectivity is back).');
		}
	} catch(e) {
		Console.error('enqueueMini', e);
	}
}

// Dequeues stanzas and send them over the network
function dequeueMini() {
	try {
		var stanza_str, stanza_childs,
		    stanza;

		// Execute deferred tasks
		while(MINI_QUEUE.length) {
			stanza_str = MINI_QUEUE.shift();
			stanza_childs = XMLFromString(stanza_str).childNodes;

			if(stanza_childs && stanza_childs[0]) {
				stanza = JSJaCPacket.wrapNode(stanza_childs[0]);
				con.send(stanza);
			}

			Console.log('Dequeued a stanza.');
		}
	} catch(e) {
		Console.error('dequeueMini', e);
	}
}

// Serializes and store the queue storage
function serializeQueueMini() {
	try {
		setDB(MINI_HASH, 'jappix-mini', 'queue', jQuery.toJSON(MINI_QUEUE));
	} catch(e) {
		Console.error('serializeQueueMini', e);
	}
}

// Unserializes and update the queue storage
function unserializeQueueMini() {
	try {
		var start_body, end_body,
		    start_args, end_args;

		var s_queue = getDB(MINI_HASH, 'jappix-mini', 'queue');
		removeDB(MINI_HASH, 'jappix-mini', 'queue');

		if(s_queue) {
			MINI_QUEUE = jQuery.evalJSON(s_queue);
		}
	} catch(e) {}
}

// Generates the asked smiley image
function smileyMini(image, text) {
	try {
		return ' <img class="jm_smiley jm_smiley-' + image + ' jm_images" alt="' + encodeQuotes(text) + '" src="' + JAPPIX_STATIC + 'img/others/blank.gif' + '" /> ';
	} catch(e) {
		Console.error('smileyMini', e);
	}

	return null;
}

// Notifies incoming chat messages
function notifyMessageMini(hash) {
	try {
		// Define the paths
		var tab = '#jappix_mini #chat-' + hash + ' a.jm_chat-tab';
		var notify = tab + ' span.jm_notify';
		var notify_middle = notify + ' span.jm_notify_middle';
		
		// Notification box not yet added?
		if(!exists(notify))
			jQuery(tab).append(
				'<span class="jm_notify">' + 
					'<span class="jm_notify_left jm_images"></span>' + 
					'<span class="jm_notify_middle">0</span>' + 
					'<span class="jm_notify_right jm_images"></span>' + 
				'</span>'
			);
		
		// Increment the notification number
		var number = parseInt(jQuery(notify_middle).text());
		jQuery(notify_middle).text(number + 1);
		
		// Update the notification counters
		notifyCountersMini();
	} catch(e) {
		Console.error('notifyMessageMini', e);
	}
}

// Notifies the user from a session error
function notifyErrorMini() {
	try {
		// Replace the Jappix Mini DOM content
		jQuery('#jappix_mini').html(
			'<div class="jm_starter">' + 
				'<a class="jm_pane jm_button jm_images" href="' + MINI_ERROR_LINK + '" target="_blank" title="' + _e("Click here to solve the error") + '">' + 
					'<span class="jm_counter jm_error jm_images">' + _e("Error") + '</span>' + 
				'</a>' + 
			'</div>'
		);
	} catch(e) {
		Console.error('notifyErrorMini', e);
	}
}

// Updates the global counter with the new notifications
function notifyCountersMini() {
	try {
		// Count the number of notifications
		var number = 0;
		
		jQuery('#jappix_mini span.jm_notify span.jm_notify_middle').each(function() {
			number = number + parseInt(jQuery(this).text());
		});
		
		// Update the notification link counters
		jQuery('#jappix_mini a.jm_switch').removeClass('jm_notifnav');
		
		if(number) {
			// Left?
			if(jQuery('#jappix_mini div.jm_conversation:visible:first').prevAll().find('span.jm_notify').size())
				jQuery('#jappix_mini a.jm_switch.jm_left').addClass('jm_notifnav');
			
			// Right?
			if(jQuery('#jappix_mini div.jm_conversation:visible:last').nextAll().find('span.jm_notify').size())
				jQuery('#jappix_mini a.jm_switch.jm_right').addClass('jm_notifnav');
		}
		
		// No saved title? Abort!
		if(MINI_TITLE == null)
			return;
		
		// Page title code
		var title = MINI_TITLE;
		
		// No new stuffs? Reset the title!
		if(number)
			title = '[' + number + '] ' + title;
		
		// Apply the title
		document.title = title;
	} catch(e) {
		Console.error('notifyCountersMini', e);
	}
}

// Clears the notifications
function clearNotificationsMini(hash) {
	try {
		// Not focused?
		if(!isFocused())
			return false;
		
		// Remove the notifications counter
		jQuery('#jappix_mini #chat-' + hash + ' span.jm_notify').remove();
		
		// Update the global counters
		notifyCountersMini();
		
		return true;
	} catch(e) {
		Console.error('clearNotificationsMini', e);
	}

	return false;
}

// Updates the roster counter
function updateRosterMini() {
	try {
		// Update online counter
		jQuery('#jappix_mini a.jm_button span.jm_counter').text(jQuery('#jappix_mini a.jm_online').size());
	} catch(e) {
		Console.error('updateRosterMini', e);
	}
}

// Updates the chat overflow
function updateOverflowMini() {
	try {
		// Process overflow
		var number_visible = parseInt((jQuery(window).width() - 380) / 140);
		var number_visible_dom = jQuery('#jappix_mini div.jm_conversation:visible').size();

		if(number_visible <= 0)
			number_visible = 1;

		// Need to reprocess?
		if(number_visible != number_visible_dom) {
			// Show hidden chats
			jQuery('#jappix_mini div.jm_conversation:hidden').show();
			
			// Get total number of chats
			var number_total = jQuery('#jappix_mini div.jm_conversation').size();
			
			// Must add the overflow switcher?
			if(number_visible < number_total) {
				// Create the overflow handler?
				if(!jQuery('#jappix_mini a.jm_switch').size()) {
					// Add the navigation links
					jQuery('#jappix_mini div.jm_conversations').before(
						'<a class="jm_switch jm_left jm_pane jm_images" href="#">' + 
							'<span class="jm_navigation jm_images"></span>' + 
						'</a>'
					);
					
					jQuery('#jappix_mini div.jm_conversations').after(
						'<a class="jm_switch jm_right jm_pane jm_images" href="#">' + 
							'<span class="jm_navigation jm_images"></span>' + 
						'</a>'
					);
					
					// Add the click events
					overflowEventsMini();
				}
				
				// Show first visible chats
				var first_visible = jQuery('#jappix_mini div.jm_conversation:visible:first').index();
				var index_visible = number_visible - first_visible - 1;

				jQuery('#jappix_mini div.jm_conversation:visible:gt(' + index_visible + ')').hide();
				
				// Close the opened chat
				if(jQuery('#jappix_mini div.jm_conversation:hidden a.jm_pane.jm_clicked').size())
					switchPaneMini();
				
				// Update navigation buttons
				jQuery('#jappix_mini a.jm_switch').removeClass('jm_nonav');
				
				if(!jQuery('#jappix_mini div.jm_conversation:visible:first').prev().size())
					jQuery('#jappix_mini a.jm_switch.jm_left').addClass('jm_nonav');
				if(!jQuery('#jappix_mini div.jm_conversation:visible:last').next().size())
					jQuery('#jappix_mini a.jm_switch.jm_right').addClass('jm_nonav');
			}
			
			// Must remove the overflow switcher?
			else {
				jQuery('#jappix_mini a.jm_switch').remove();
				jQuery('#jappix_mini div.jm_conversation:hidden').show();
			}
		}
	} catch(e) {
		Console.error('updateOverflowMini', e);
	}
}

// Click events on the chat overflow
function overflowEventsMini() {
	try {
		jQuery('#jappix_mini a.jm_switch').click(function() {
			var this_sel = jQuery(this);

			// Nothing to do?
			if(this_sel.hasClass('jm_nonav'))
				return false;
			
			var hide_this = show_this = '';
			
			// Go left?
			if(this_sel.is('.jm_left')) {
				show_this = jQuery('#jappix_mini div.jm_conversation:visible:first').prev();
				
				if(show_this.size())
					hide_this = jQuery('#jappix_mini div.jm_conversation:visible:last');
			}
			
			// Go right?
			else {
				show_this = jQuery('#jappix_mini div.jm_conversation:visible:last').next();
				
				if(show_this.size())
					hide_this = jQuery('#jappix_mini div.jm_conversation:visible:first');
			}
			
			// Update overflow content
			if(show_this && show_this.size()) {
				// Hide
				if(hide_this && hide_this.size()) {
					hide_this.hide();
					
					// Close the opened chat
					if(hide_this.find('a.jm_pane').hasClass('jm_clicked'))
						switchPaneMini();
				}
				
				// Show
				show_this.show();
				
				// Update navigation buttons
				jQuery('#jappix_mini a.jm_switch').removeClass('jm_nonav');
				
				if((this_sel.is('.jm_right') && !show_this.next().size()) || (this_sel.is('.jm_left') && !show_this.prev().size()))
					this_sel.addClass('jm_nonav');
				
				// Update notification counters
				notifyCountersMini();
			}
			
			return false;
		});
	} catch(e) {
		Console.error('overflowEventsMini', e);
	}
}

// Creates the Jappix Mini DOM content
function createMini(domain, user, password) {
	try {
		// Try to restore the DOM
	    var dom = getDB(MINI_HASH, 'jappix-mini', 'dom');
		var suspended = false;
		var resumed = false;

		// Reset DOM storage (free memory)
		removeDB(MINI_HASH, 'jappix-mini', 'dom');
		
		// Invalid stored DOM?
		if(dom && isNaN(jQuery(dom).find('a.jm_pane.jm_button span.jm_counter').text()))
			dom = null;
		
		// Old DOM? (saved session)
		if(dom) {
			// Attempt to resume connection
			con = new JSJaCHttpBindingConnection();
			setupConMini(con);
			resumed = con.resume();

			// Read the old nickname
			MINI_NICKNAME = getDB(MINI_HASH, 'jappix-mini', 'nickname');
			
			// Marker
			suspended = true;
			MINI_ROSTER_INIT = true;
		}
		
		// New DOM?
		else {
			dom = '<div class="jm_position">' + 
					'<div class="jm_conversations"></div>' + 
					
					'<div class="jm_starter">' + 
						'<div class="jm_roster">' + 
							'<div class="jm_actions">' + 
								'<a class="jm_logo jm_images" href="https://mini.jappix.com/" target="_blank"></a>' + 
								'<a class="jm_one-action jm_join jm_images" title="' + _e("Join a chat") + '" href="#"></a>' + 
								'<a class="jm_one-action jm_status" title="' + _e("Status") + '" href="#">' + 
									'<span class="jm_presence jm_images jm_available"></span>' + 
								'</a>' + 
								
								'<div class="jm_status_picker">' + 
									'<a href="#" data-status="available">' + 
										'<span class="jm_presence jm_images jm_available"></span>' + 
										'<span class="jm_show_text">' + _e("Available") + '</span>' + 
									'</a>' + 
									
									'<a href="#" data-status="away">' + 
										'<span class="jm_presence jm_images jm_away"></span>' + 
										'<span class="jm_show_text">' + _e("Away") + '</span>' + 
									'</a>' + 
									
									'<a href="#" data-status="dnd">' + 
										'<span class="jm_presence jm_images jm_dnd"></span>' + 
										'<span class="jm_show_text">' + _e("Busy") + '</span>' + 
									'</a>' + 
									
									'<a href="#" data-status="unavailable">' + 
										'<span class="jm_presence jm_images jm_unavailable"></span>' + 
										'<span class="jm_show_text">' + _e("Offline") + '</span>' + 
									'</a>' + 
								'</div>' + 
							'</div>' + 
							'<div class="jm_buddies"></div>' + 
							'<div class="jm_search">' + 
								'<input type="text" class="jm_searchbox jm_images" placeholder="' + _e("Filter") + '" data-value="" />' + 
							'</div>' + 
						'</div>' + 
						
						'<a class="jm_pane jm_button jm_images" href="#">' + 
							'<span class="jm_counter jm_images">' + _e("Please wait...") + '</span>' + 
						'</a>' + 
					'</div>' + 
				  '</div>';
		}
		
		// Create the DOM
		jQuery('body').append('<div id="jappix_mini" style="display: none;" dir="' + (isRTL() ? 'rtl' : 'ltr') + '">' + dom + '</div>');
		
		// Hide the roster picker panels
		jQuery('#jappix_mini a.jm_status.active, #jappix_mini a.jm_join.active').removeClass('active');
		jQuery('#jappix_mini div.jm_status_picker').hide();
		jQuery('#jappix_mini div.jm_chan_suggest').remove();
		
		// Chat navigation overflow events
		overflowEventsMini();

		// Delay to fix DOM lag bug (CSS file not yet loaded)
		jQuery('#jappix_mini').everyTime(10, function() {
			var this_sel = jQuery(this);

			if(this_sel.is(':visible')) {
				Console.info('CSS loaded asynchronously.');

				this_sel.stopTime();

				// Re-process chat overflow
				updateOverflowMini();

				// Adapt roster height
				adaptRosterMini();
			}
		});
		
		// CSS refresh (Safari display bug when restoring old DOM)
		jQuery('#jappix_mini div.jm_starter').css('float', 'right');
		jQuery('#jappix_mini div.jm_conversations, #jappix_mini div.jm_conversation, #jappix_mini a.jm_switch').css('float', 'left');
		
		// The click events
		jQuery('#jappix_mini a.jm_button').click(function() {
			// Using a try/catch override IE issues
			try {
				// Presence counter
				var counter = '#jappix_mini a.jm_pane.jm_button span.jm_counter';
				
				// Cannot open the roster?
				if(jQuery(counter).text() == _e("Please wait..."))
					return false;
				
				// Not yet connected?
				if(jQuery(counter).text() == _e("Chat")) {
					// Remove the animated bubble
					jQuery('#jappix_mini div.jm_starter span.jm_animate').remove();
					
					// Add a waiting marker
					jQuery(counter).text(_e("Please wait..."));
					
					// Launch the connection!
					connectMini(domain, user, password);
					
					return false;
				}
				
				// Normal actions
				if(!jQuery(this).hasClass('jm_clicked'))
					showRosterMini();
				else
					hideRosterMini();
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});

		jQuery('#jappix_mini a.jm_status').click(function() {
			// Using a try/catch override IE issues
			try {
				var this_sel = jQuery(this);
				var is_active = this_sel.hasClass('active');

				jQuery('#jappix_mini div.jm_actions a').blur().removeClass('active');
				
				if(is_active) {
					jQuery('#jappix_mini div.jm_status_picker').hide();
				} else {
					jQuery('#jappix_mini div.jm_chan_suggest').remove();
					jQuery('#jappix_mini div.jm_status_picker').show();
					this_sel.addClass('active');
				}
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});

		jQuery('#jappix_mini div.jm_status_picker a').click(function() {
			// Using a try/catch override IE issues
			try {
				var this_sel = jQuery(this);

				// Generate an array of presence change XIDs
				var pr_xid = [''];
				
				jQuery('#jappix_mini div.jm_conversation[data-type="groupchat"]').each(function() {
					pr_xid.push(unescape(this_sel.attr('data-xid')) + '/' + unescape(this_sel.attr('data-nick')));
				});
				
				// Loop on XIDs
				var new_status = this_sel.data('status');
				
				jQuery.each(pr_xid, function(key, value) {
					switch(new_status) {
						case 'available':
							presenceMini('', '', '', '', value);
							break;
						
						case 'away':
							presenceMini('', 'away', '', '', value);
							break;
						
						case 'dnd':
							presenceMini('', 'dnd', '', '', value);
							break;
						
						case 'unavailable':
							disconnectMini();
							break;
						
						default:
							presenceMini('', '', '', '', value);
							break;
					}
				});
				
				// Switch the status
				if(new_status != 'unavailable') {
					jQuery('#jappix_mini a.jm_status span').removeClass('jm_available jm_away jm_dnd jm_unavailable')
					                                       .addClass('jm_' + this_sel.data('status'));
					
					jQuery('#jappix_mini div.jm_status_picker').hide();
					jQuery('#jappix_mini a.jm_status').blur().removeClass('active');
				}
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
		
		jQuery('#jappix_mini div.jm_actions a.jm_join').click(function() {
			// Using a try/catch override IE issues
			try {
				var this_sel = jQuery(this);

				// Any suggested chat/groupchat?
				if((MINI_SUGGEST_CHATS && MINI_SUGGEST_CHATS.length) || (MINI_SUGGEST_GROUPCHATS && MINI_SUGGEST_GROUPCHATS.length)) {
					var is_active = this_sel.hasClass('active');
					jQuery('#jappix_mini div.jm_actions a').blur().removeClass('active');
					
					if(is_active) {
						jQuery('#jappix_mini div.jm_chan_suggest').remove();
					} else {
						// Button style
						jQuery('#jappix_mini div.jm_status_picker').hide();
						this_sel.addClass('active');
						
						// Generate selector code
						var chans_html = '';
						
						// Generate the groupchat links HTML
						for(var i = 0; i < MINI_SUGGEST_GROUPCHATS.length; i++) {
							// Empty value?
							if(!MINI_SUGGEST_GROUPCHATS[i])
								continue;
							
							// Using a try/catch override IE issues
							try {
								var chat_room = bareXID(generateXID(MINI_SUGGEST_GROUPCHATS[i], 'groupchat'));
								var chat_pwd = MINI_SUGGEST_PASSWORDS[i] || '';
								
								chans_html += '<a class="jm_suggest_groupchat" href="#" data-xid="' + escape(chat_room) + '" data-pwd="' + escape(chat_pwd) + '">' + 
									'<span class="jm_chan_icon jm_images"></span>' + 
									'<span class="jm_chan_name">' + getXIDNick(chat_room).htmlEnc() + '</span>' + 
								'</a>';
							}
							
							catch(e) {}
						}
						
						// Any separation space to add?
						if(chans_html)
							chans_html += '<div class="jm_space"></div>';
						
						// Generate the chat links HTML
						for(var j = 0; j < MINI_SUGGEST_CHATS.length; j++) {
							// Empty value?
							if(!MINI_SUGGEST_CHATS[j])
								continue;
							
							// Using a try/catch override IE issues
							try {
								// Read current chat values
								var chat_xid = bareXID(generateXID(MINI_SUGGEST_CHATS[j], 'chat'));
								var chat_hash = hex_md5(chat_xid);
								var chat_nick = jQuery('#jappix_mini a#friend-' + chat_hash).attr('data-nick');
								
								// Get current chat nickname
								if(!chat_nick)
									chat_nick = getXIDNick(chat_xid);
								else
									chat_nick = unescape(chat_nick);
								
								// Generate HTML for current chat
								chans_html += '<a class="jm_suggest_chat" href="#" data-xid="' + escape(chat_xid) + '">' + 
									'<span class="jm_chan_icon jm_images"></span>' + 
									'<span class="jm_chan_name">' + getXIDNick(chat_nick).htmlEnc() + '</span>' + 
								'</a>';
							}
							
							catch(e) {}
						}
						
						// Any separation space to add?
						if(chans_html)
							chans_html += '<div class="jm_space"></div>';
						
						// Append selector code
						jQuery('#jappix_mini div.jm_actions').append(
							'<div class="jm_chan_suggest">' + 
								chans_html + 
								
								'<a class="jm_suggest_prompt" href="#">' + 
									'<span class="jm_chan_icon"></span>' + 
									'<span class="jm_chan_name">' + _e("Other") + '</span>' + 
								'</a>' + 
							'</div>'
						);
						
						// Click events
						jQuery('#jappix_mini div.jm_chan_suggest a').click(function() {
							// Using a try/catch override IE issues
							try {
								var this_sub_sel = jQuery(this);

								// Chat?
								if(this_sub_sel.is('.jm_suggest_chat')) {
									var current_chat = unescape(this_sub_sel.attr('data-xid'));
									
									chatMini('chat', current_chat, this_sub_sel.find('span.jm_chan_name').text(), hex_md5(current_chat));
								}
								
								// Groupchat?
								else if(this_sub_sel.is('.jm_suggest_groupchat')) {
									var current_groupchat = unescape(this_sub_sel.attr('data-xid'));
									var current_password = this_sub_sel.attr('data-pwd') || null;
									
									if(current_password)
										current_password = unescape(current_password);
									
									chatMini('groupchat', current_groupchat, this_sub_sel.find('span.jm_chan_name').text(), hex_md5(current_groupchat), current_password);
								}
								
								// Default prompt?
								else
									groupchatPromptMini();
							}
							
							catch(e) {}
							
							finally {
								return false;
							}
						});
						
						// Adapt chan suggest height
						adaptRosterMini();
					}
				}
				
				// Default action
				else
					groupchatPromptMini();
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
		
		// Updates the roster with only searched terms
		jQuery('#jappix_mini div.jm_roster div.jm_search input.jm_searchbox').keyup(function(e) {
			var this_sel = jQuery(this);

			// Avoid buddy navigation to be reseted
			if((e.keyCode == 38) || (e.keyCode == 40))
				return;
			
			// Escape key pressed?
			if(e.keyCode == 27)
				this_sel.val('');
			
			// Save current value
			this_sel.attr('data-value', this_sel.val());
			
			// Don't filter at each key up (faster for computer)
			var self = this;
			
			typewatch(function() {
				// Using a try/catch to override IE issues
				try {
					// Get values
					var search = jQuery(self).val();
					var regex = new RegExp('((^)|( ))' + escapeRegex(search), 'gi');
					
					// Reset results
					jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
					jQuery('#jappix_mini div.jm_roster div.jm_grouped').show();
					
					// If there is no search, we don't need to loop over buddies
					if(!search) {
						jQuery('#jappix_mini div.jm_roster div.jm_buddies a.jm_online').show();
						
						return;
					}
					
					// Filter buddies
					jQuery('#jappix_mini div.jm_roster div.jm_buddies a.jm_online').each(function() {
						var this_sub_sel = jQuery(this);
						var nick = unescape(this_sub_sel.data('nick'));
						
						if(nick.match(regex))
							this_sub_sel.show();
						else
							this_sub_sel.hide();
					});
					
					// Filter groups
					jQuery('#jappix_mini div.jm_roster div.jm_grouped').each(function() {
						var this_sub_sel = jQuery(this);

						if(!this_sub_sel.find('a.jm_online:visible').size())
							this_sub_sel.hide();
					});
					
					// Focus on the first buddy
					jQuery('#jappix_mini div.jm_roster div.jm_buddies a.jm_online:visible:first').addClass('jm_hover');
				}
				
				catch(e) {}
				
				finally {
					return false;
				}
			}, 500);
		});
		
		// Roster navigation
		jQuery(document).keydown(function(e) {
			// Cannot work if roster is not opened
			if(jQuery('#jappix_mini div.jm_roster').is(':hidden'))
				return;
			
			// Up/Down keys
			if((e.keyCode == 38) || (e.keyCode == 40)) {
				// Hover the last/first buddy
				if(!jQuery('#jappix_mini a.jm_online.jm_hover').size()) {
					if(e.keyCode == 38)
						jQuery('#jappix_mini a.jm_online:visible:last').addClass('jm_hover');
					else
						jQuery('#jappix_mini a.jm_online:visible:first').addClass('jm_hover');
				}
				
				// Hover the previous/next buddy
				else if(jQuery('#jappix_mini a.jm_online:visible').size() > 1) {
					var hover_index = jQuery('#jappix_mini a.jm_online:visible').index(jQuery('a.jm_hover'));
					
					// Up (decrement) or down (increment)?
					if(e.keyCode == 38)
						hover_index--;
					else
						hover_index++;
					
					if(!hover_index)
						hover_index = 0;
					
					// No buddy before/after?
					if(!jQuery('#jappix_mini a.jm_online:visible').eq(hover_index).size()) {
						if(e.keyCode == 38)
							hover_index = jQuery('#jappix_mini a.jm_online:visible:last').index();
						else
							hover_index = 0;
					}
					
					// Hover the previous/next buddy
					jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
					jQuery('#jappix_mini a.jm_online:visible').eq(hover_index).addClass('jm_hover');
				}
				
				// Scroll to the hovered buddy (if out of limits)
				jQuery('#jappix_mini div.jm_roster div.jm_buddies').scrollTo(jQuery('#jappix_mini a.jm_online.jm_hover'), 0, {margin: true});
				
				return false;
			}
			
			// Enter key
			if((e.keyCode == 13) && jQuery('#jappix_mini a.jm_friend.jm_hover').size()) {
				jQuery('#jappix_mini a.jm_friend.jm_hover').click();
				
				return false;
			}
		});

		// Chat type re-focus
		jQuery(document).keypress(function(e) {
			// Cannot work if an input/textarea is already focused or chat is not opened
			var path = '#jappix_mini div.jm_conversation div.jm_chat-content';

			if(jQuery('input, textarea').is(':focus') || !jQuery(path).is(':visible'))
				return;

			// May cause some compatibility issues
			try {
				// Get key value
				var key_value = trim(String.fromCharCode(e.which));
				
				// Re-focus on opened chat?
				if(key_value) {
					// Path to chat input
					var path_input = path + ' input.jm_send-messages';

					// Use a timer to override the DOM lag issue
					jQuery(document).oneTime(10, function() {
						// Get input values
						select_input = jQuery(path_input);
						value_input = select_input.val();

						// Append pressed key value
						select_input.val(value_input + key_value);
						select_input.focus();

						// Put cursor at the end of input
						select_input[0].selectionStart = select_input[0].selectionEnd = value_input.length + 1;
					});
				}
			} catch(e) {}
		});
		
		// Hides the roster when clicking away of Jappix Mini
		jQuery(document).click(function(evt) {
			if(!jQuery(evt.target).parents('#jappix_mini').size() && !exists('#jappix_popup'))
				hideRosterMini();
		});
		
		// Hides all panes double clicking away of Jappix Mini
		jQuery(document).dblclick(function(evt) {
			if(!jQuery(evt.target).parents('#jappix_mini').size() && !exists('#jappix_popup'))
				switchPaneMini();
		});
		
		// Suspended session resumed?
		if(suspended) {
			// Initialized marker
			MINI_INITIALIZED = true;

			// Not resumed? (need to reconnect)
			if(!resumed) {
				// Restore previous reconnect counter
				var reconnect = getDB(MINI_HASH, 'jappix-mini', 'reconnect');

				if(!isNaN(reconnect))
					MINI_RECONNECT = parseInt(reconnect);

				// Restore queued functions
				unserializeQueueMini();

				// Simulate a network error to get the same silent reconnect effect
				disconnectedMini();
			}
			
			// Restore chat input values
			jQuery('#jappix_mini div.jm_conversation input.jm_send-messages').each(function() {
				var this_sub_sel = jQuery(this);
				var chat_value = this_sub_sel.attr('data-value');
				
				if(chat_value)
					this_sub_sel.val(chat_value);
			});
			
			// Restore roster filter value
			var search_box = jQuery('#jappix_mini div.jm_roster div.jm_search input.jm_searchbox');
			var filter_value = search_box.attr('data-value');
			
			if(filter_value)
				search_box.val(filter_value).keyup();
			
			// Restore buddy events
			eventsBuddyMini('#jappix_mini a.jm_friend');
			
			// Restore chat click events
			jQuery('#jappix_mini div.jm_conversation').each(function() {
				var this_sub_sel = jQuery(this);
				chatEventsMini(this_sub_sel.attr('data-type'), unescape(this_sub_sel.attr('data-xid')), this_sub_sel.attr('data-hash'));
			});

			// Restore init marker on all groupchats
			jQuery('#jappix_mini div.jm_conversation[data-type="groupchat"]').attr('data-init', 'true');
			
			// Scroll down to the last message
			var scroll_hash = jQuery('#jappix_mini div.jm_conversation:has(a.jm_pane.jm_clicked)').attr('data-hash');
			var scroll_position = getDB(MINI_HASH, 'jappix-mini', 'scroll');
			
			// Any scroll position?
			if(scroll_position)
				scroll_position = parseInt(scroll_position);
			
			if(scroll_hash) {
				// Use a timer to override the DOM lag issue
				jQuery(document).oneTime(200, function() {
					messageScrollMini(scroll_hash, scroll_position);
				});
			}
			
			// Update notification counters
			notifyCountersMini();
		}
		
		// Can auto-connect?
		else if(MINI_AUTOCONNECT)
			connectMini(domain, user, password);
		
		// Cannot auto-connect?
		else {
			// Chat text
			jQuery('#jappix_mini a.jm_pane.jm_button span.jm_counter').text(_e("Chat"));
			
			// Must animate?
			if(MINI_ANIMATE) {
				// Add content
				jQuery('#jappix_mini div.jm_starter').prepend(
					'<span class="jm_animate jm_images_animate"></span>'
				);
			}
		}
	} catch(e) {
		Console.error('createMini', e);
	}
}

// Buddy events
function eventsBuddyMini(path) {
	var selector = jQuery(path);

	// Restore buddy click events
	selector.click(function() {
		// Using a try/catch override IE issues
		try {
			var this_sel = jQuery(this);
			chatMini('chat', unescape(this_sel.attr('data-xid')), unescape(this_sel.attr('data-nick')), this_sel.attr('data-hash'));
		}
		
		catch(e) {}
		
		finally {
			return false;
		}
	});
	
	// Restore buddy hover events
	selector.hover(function() {
		jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
		jQuery(this).addClass('jm_hover');
	}, function() {
		jQuery(this).removeClass('jm_hover');
	});
	
	// Restore buddy mousedown events
	selector.mousedown(function() {
		jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
		jQuery(this).addClass('jm_hover');
	});
	
	// Restore buddy focus events
	selector.focus(function() {
		jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
		jQuery(this).addClass('jm_hover');
	});
	
	// Restore buddy blur events
	selector.blur(function() {
		jQuery(this).removeClass('jm_hover');
	});
}

// Displays a given message
function displayMessageMini(type, body, xid, nick, hash, time, stamp, message_type) {
	try {
		// Generate path
		var path = '#chat-' + hash;
		
		// Can scroll?
		var cont_scroll = document.getElementById('received-' + hash);
		var can_scroll = false;
		
		if(!cont_scroll.scrollTop || ((cont_scroll.clientHeight + cont_scroll.scrollTop) == cont_scroll.scrollHeight))
			can_scroll = true;
		
		// Remove the previous message border if needed
		var last = jQuery(path + ' div.jm_group:last');
		var last_stamp = parseInt(last.attr('data-stamp'));
		var last_b = jQuery(path + ' b:last');
		var last_xid = last_b.attr('data-xid');
		var last_type = last.attr('data-type');
		var grouped = false;
		var header = '';
		
		if((last_xid == xid) && (message_type == last_type) && ((stamp - last_stamp) <= 1800))
			grouped = true;
		
		else {
			// Write the message date
			if(nick)
				header += '<span class="jm_date">' + time + '</span>';
			
			// Write the buddy name at the top of the message group
			if(type == 'groupchat')
				header += '<b class="jm_name" style="color: ' + generateColor(nick) + ';" data-xid="' + encodeQuotes(xid) + '">' + nick.htmlEnc() + '</b>';
			else if(nick == 'me')
				header += '<b class="jm_name jm_me" data-xid="' + encodeQuotes(xid) + '">' + _e("You") + '</b>';
			else
				header += '<b class="jm_name jm_him" data-xid="' + encodeQuotes(xid) + '">' + nick.htmlEnc() + '</b>';
		}
		
		// Apply the /me command
		var me_command = false;
		
		if(body.match(/^\/me /i)) {
			body = body.replace(/^\/me /i, nick + ' ');
			
			// Marker
			me_command = true;
		}
		
		// HTML-encode the message
		body = body.htmlEnc();
		
		// Apply the smileys
                
                //Custom Smileys
                jQuery.each(MINI_SMILEYS,function(i,smiley) {
                    body = body.replace(smiley.pattern, smileyMini(smiley.name, '<img class="jm_smiley jm_smiley-' + smiley.alt + ' jm_images" alt="' + encodeQuotes(smiley.alt) + '" src="' + smiley.src + '" />'));
                });
		
                //Default Smileys
                body = body.replace(/(;-?\))(\s|$)/gi, smileyMini('wink', '$1'))
		           .replace(/(:-?3)(\s|$)/gi, smileyMini('waii', '$1'))
		           .replace(/(:-?\()(\s|$)/gi, smileyMini('unhappy', '$1'))
		           .replace(/(:-?P)(\s|$)/gi, smileyMini('tongue', '$1'))
		           .replace(/(:-?O)(\s|$)/gi, smileyMini('surprised', '$1'))
		           .replace(/(:-?\))(\s|$)/gi, smileyMini('smile', '$1'))
		           .replace(/(\^_?\^)(\s|$)/gi, smileyMini('happy', '$1'))
		           .replace(/(:-?D)(\s|$)/gi, smileyMini('grin', '$1'));
		
		// Format the text
		body = body.replace(/(^|\s|>|\()((\*)([^<>'"\*]+)(\*))($|\s|<|\))/gi, '$1<b>$2</b>$6')
		           .replace(/(^|\s|>|\()((\/)([^<>'"\/]+)(\/))($|\s|<|\))/gi, '$1<em>$2</em>$6')
		           .replace(/(^|\s|>|\()((_)([^<>'"_]+)(_))($|\s|<|\))/gi, '$1<span style="text-decoration: underline;">$2</span>$6');
		
		// Filter the links
		body = applyLinks(body, 'mini');
		
		// Generate the message code
		if(me_command)
			body = '<em>' + body + '</em>';
		
		body = '<p>' + body + '</p>';
		
		// Create the message
		if(grouped)
			jQuery('#jappix_mini #chat-' + hash + ' div.jm_received-messages div.jm_group:last').append(body);
		else
			jQuery('#jappix_mini #chat-' + hash + ' div.jm_chatstate_typing').before('<div class="jm_group jm_' + message_type + '" data-type="' + message_type + '" data-stamp="' + stamp + '">' + header + body + '</div>');
		
		// Scroll to this message
		if(can_scroll)
			messageScrollMini(hash);
	} catch(e) {
		Console.error('displayMessageMini', e);
	}
}

// Switches to a given point
function switchPaneMini(element, hash) {
	try {
		// Hide every item
		hideRosterMini();
		jQuery('#jappix_mini a.jm_pane').removeClass('jm_clicked');
		jQuery('#jappix_mini div.jm_chat-content').hide();
		
		// Show the asked element
		if(element && (element != 'roster')) {
			var current = '#jappix_mini #' + element;
			
			// Navigate to this chat
			if(jQuery(current).size() && jQuery(current).is(':hidden')) {
				var click_nav = '';
				
				// Before or after?
				if(jQuery('#jappix_mini div.jm_conversation:visible:first').prevAll().is('#' + element))
					click_nav = jQuery('#jappix_mini a.jm_switch.jm_left');
				else
					click_nav = jQuery('#jappix_mini a.jm_switch.jm_right');
				
				// Click previous or next
				if(click_nav) {
					while(jQuery(current).is(':hidden') && !click_nav.hasClass('jm_nonav'))
						click_nav.click();
				}
			}
			
			// Show it
			jQuery(current + ' a.jm_pane').addClass('jm_clicked');
			jQuery(current + ' div.jm_chat-content').show();
			
			// Use a timer to override the DOM lag issue
			jQuery(document).oneTime(10, function() {
				jQuery(current + ' input.jm_send-messages').focus();
			});
			
			// Scroll to the last message
			if(hash)
				messageScrollMini(hash);
		}
	} catch(e) {
		Console.error('switchPaneMini', e);
	}
}

// Scrolls to the last chat message
function messageScrollMini(hash, position) {
	try {
		var id = document.getElementById('received-' + hash);
		
		// No defined position?
		if(!position)
			position = id.scrollHeight;
		
		id.scrollTop = position;
	} catch(e) {
		Console.error('messageScrollMini', e);
	}
}

// Prompts the user with a given text
function openPromptMini(text, value) {
	try {
		// Initialize
		var prompt = '#jappix_popup div.jm_prompt';
		var input = prompt + ' form input';
		var value_input = input + '[type="text"]';
		
		// Remove the existing prompt
		closePromptMini();
		
		// Add the prompt
		jQuery('body').append(
			'<div id="jappix_popup" dir="' + (isRTL() ? 'rtl' : 'ltr') + '">' + 
				'<div class="jm_prompt">' + 
					'<form>' + 
						text + 
						'<input class="jm_text" type="text" value="" />' + 
						'<input class="jm_submit" type="submit" value="' + _e("Submit") + '" />' + 
						'<input class="jm_submit" type="reset" value="' + _e("Cancel") + '" />' + 
						'<div class="jm_clear"></div>' + 
					'</form>' + 
				'</div>' + 
			'</div>'
		);
		
		// Vertical center
		var vert_pos = '-' + ((jQuery(prompt).height() / 2) + 10) + 'px';
		jQuery(prompt).css('margin-top', vert_pos);
		
		// Apply the value?
		if(value)
			jQuery(value_input).val(value);
		
		// Focus on the input
		jQuery(document).oneTime(10, function() {
			jQuery(value_input).focus();
		});
		
		// Cancel event
		jQuery(input + '[type="reset"]').click(function() {
			try {
				closePromptMini();
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
	} catch(e) {
		Console.error('openPromptMini', e);
	}
}

// Returns the prompt value
function closePromptMini() {
	try {
		// Read the value
		var value = jQuery('#jappix_popup div.jm_prompt form input').val();
		
		// Remove the popup
		jQuery('#jappix_popup').remove();
		
		return value;
	} catch(e) {
		Console.error('closePromptMini', e);
	}
}

// Opens the new groupchat prompt
function groupchatPromptMini() {
	try {
		// Create a new prompt
		openPromptMini(_e("Please enter the group chat address to join."));
		
		// When prompt submitted
		jQuery('#jappix_popup div.jm_prompt form').submit(function() {
			try {
				// Read the value
				var join_this = closePromptMini();
				
				// Any submitted chat to join?
				if(join_this) {
					// Get the chat room to join
					chat_room = bareXID(generateXID(join_this, 'groupchat'));
					
					// Create a new groupchat
					chatMini('groupchat', chat_room, getXIDNick(chat_room), hex_md5(chat_room));
				}
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
	} catch(e) {
		Console.error('groupchatPromptMini', e);
	}
}

// Manages and creates a chat
function chatMini(type, xid, nick, hash, pwd, show_pane) {
	try {
		var current = '#jappix_mini #chat-' + hash;
		
		// Not yet added?
		if(!exists(current)) {
			// Groupchat nickname
			if(type == 'groupchat') {
				// Random nickname?
				if(!MINI_NICKNAME && MINI_RANDNICK)
					MINI_NICKNAME = randomNickMini();
				
				var nickname = MINI_NICKNAME;
				
				// No nickname?
				if(!nickname) {
					// Create a new prompt
					openPromptMini(printf(_e("Please enter your nickname to join %s."), xid));
					
					// When prompt submitted
					jQuery('#jappix_popup div.jm_prompt form').submit(function() {
						try {
							// Read the value
							var nickname = closePromptMini();
							
							// Update the stored one
							if(nickname)
								MINI_NICKNAME = nickname;
							
							// Launch it again!
							chatMini(type, xid, nick, hash, pwd);
						}
						
						catch(e) {}
						
						finally {
							return false;
						}
					});
					
					return;
				}
			}
			
			// Create the HTML markup
			var html = '<div class="jm_conversation jm_type_' + type + '" id="chat-' + hash + '" data-xid="' + escape(xid) + '" data-type="' + type + '" data-nick="' + escape(nick) + '" data-hash="' + hash + '" data-origin="' + escape(cutResource(xid)) + '">' + 
					'<div class="jm_chat-content">' + 
						'<div class="jm_actions">' + 
							'<span class="jm_nick">' + nick + '</span>';
			
			// Check if the chat/groupchat exists
			var groupchat_exists = false;
			var chat_exists = false;
			
			if((type == 'groupchat') && MINI_GROUPCHATS && MINI_GROUPCHATS.length) {
				for(g in MINI_GROUPCHATS) {
					if(xid == bareXID(generateXID(MINI_GROUPCHATS[g], 'groupchat'))) {
						groupchat_exists = true;
						
						break;
					}
				}
			}
			
			if((type == 'chat') && MINI_CHATS && MINI_CHATS.length) {
				for(c in MINI_CHATS) {
					if(xid == bareXID(generateXID(MINI_CHATS[c], 'chat'))) {
						chat_exists = true;
						
						break;
					}
				}
			}
			
			// Any close button to display?
			if(((type == 'groupchat') && !groupchat_exists) || ((type == 'chat') && !chat_exists) || ((type != 'groupchat') && (type != 'chat')))
				html += '<a class="jm_one-action jm_close jm_images" title="' + _e("Close") + '" href="#"></a>';
			
			html += '</div>' + 
					
					'<div class="jm_received-messages" id="received-' + hash + '">' + 
						'<div class="jm_chatstate_typing">' + printf(_e("%s is typing..."), nick.htmlEnc()) + '</div>' + 
					'</div>' + 
					
					'<form action="#" method="post">' + 
						'<input type="text" class="jm_send-messages" name="body" autocomplete="off" placeholder="' + _e("Chat") + '" data-value="" />' + 
						'<input type="hidden" name="xid" value="' + xid + '" />' + 
						'<input type="hidden" name="type" value="' + type + '" />' + 
					'</form>' + 
				'</div>' + 
				
				'<a class="jm_pane jm_chat-tab jm_images" href="#">' + 
					'<span class="jm_name">' + nick.htmlEnc() + '</span>' + 
				'</a>' + 
			'</div>';
			
			jQuery('#jappix_mini div.jm_conversations').prepend(html);
			
			// Get the presence of this friend
			if(type != 'groupchat') {
				var selector = jQuery('#jappix_mini a#friend-' + hash + ' span.jm_presence');
				
				// Default presence
				var show = 'available';
				
				// Read the presence
				if(selector.hasClass('jm_unavailable') || !selector.size())
					show = 'unavailable';
				else if(selector.hasClass('jm_chat'))
					show = 'chat';
				else if(selector.hasClass('jm_away'))
					show = 'away';
				else if(selector.hasClass('jm_xa'))
					show = 'xa';
				else if(selector.hasClass('jm_dnd'))
					show = 'dnd';
				
				// Create the presence marker
				jQuery(current + ' a.jm_chat-tab').prepend('<span class="jm_presence jm_images jm_' + show + '"></span>');
			}
			
			// The chat events
			chatEventsMini(type, xid, hash);
			
			// Join the groupchat
			if(type == 'groupchat') {
				// Add nickname & init values
				jQuery(current).attr('data-nick', escape(nickname))
				               .attr('data-init', 'false');
				
				// Send the first groupchat presence
				presenceMini('', '', '', '', xid + '/' + nickname, pwd, true, handleMUCMini);
			}
		}
		
		// Focus on our pane
		if(show_pane != false)
			jQuery(document).oneTime(10, function() {
				switchPaneMini('chat-' + hash, hash);
			});
		
		// Update chat overflow
		updateOverflowMini();
		
		return false;
	} catch(e) {
		Console.error('chatMini', e);
	}
}

// Events on the chat tool
function chatEventsMini(type, xid, hash) {
	try {
		var current_sel = jQuery('#jappix_mini #chat-' + hash);
		
		// Submit the form
		current_sel.find('form').submit(function() {
			return sendMessageMini(this);
		});
		
		// Click on the tab
		current_sel.find('a.jm_chat-tab').click(function() {
			// Using a try/catch override IE issues
			try {
				// Not yet opened: open it!
				if(!jQuery(this).hasClass('jm_clicked')) {
					// Show it!
					switchPaneMini('chat-' + hash, hash);
					
					// Clear the eventual notifications
					clearNotificationsMini(hash);
				} else {
					switchPaneMini();
				}
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
		
		// Click on the close button
		current_sel.find('div.jm_actions').click(function(e) {
			// Using a try/catch override IE issues
			try {
				// Close button?
				if(jQuery(e.target).is('a.jm_close')) {
					// Gone chatstate
					if(type != 'groupchat')
						sendChatstateMini('gone', xid, hash);
					
					current_sel.stopTime().remove();
					
					// Quit the groupchat?
					if(type == 'groupchat') {
						// Send an unavailable presence
						presenceMini('unavailable', '', '', '', xid + '/' + unescape(current_sel.attr('data-nick')));
						
						// Remove this groupchat!
						removeGroupchatMini(xid);
					}
					
					// Update chat overflow
					updateOverflowMini();
				} else {
					// Minimize current chat
					current_sel.find('a.jm_chat-tab.jm_clicked').click();
				}
			}
			
			catch(e) {}
			
			finally {
				return false;
			}
		});
		
		// Focus on the chat input
		current_sel.find('input.jm_send-messages').focus(function() {
			clearNotificationsMini(hash);
		})
		
		// Change on the chat input
		.keyup(function() {
			var this_sel = jQuery(this);
			this_sel.attr('data-value', this_sel.val());
		})
		
		// Chat tabulate or escape press
		.keydown(function(e) {
			// Tabulate?
			if(e.keyCode == 9) {
				switchChatMini();
				
				return false;
			}
			
			// Escape?
			if(e.keyCode == 27) {
				if(current_sel.find('a.jm_close').size()) {
					// Open next/previous chat
					if(current_sel.next('div.jm_conversation').size())
						current_sel.next('div.jm_conversation').find('a.jm_pane').click();
					else if(current_sel.prev('div.jm_conversation').size())
						current_sel.prev('div.jm_conversation').find('a.jm_pane').click();
					
					// Close current chat
					current_sel.find('a.jm_close').click();
				}
				
				return false;
			}
		});
		
		// Focus/Blur events
		jQuery('#jappix_mini #chat-' + hash + ' input.jm_send-messages').focus(function() {
			// Store active chat
			MINI_ACTIVE = hash;
		})
		
		.blur(function() {
			// Reset active chat
			if(MINI_ACTIVE == hash)
				MINI_ACTIVE = null;
		});
		
		// Chatstate events
		eventsChatstateMini(xid, hash, type);
	} catch(e) {
		Console.error('chatEventsMini', e);
	}
}

// Opens the next chat
function switchChatMini() {
	try {
		if(jQuery('#jappix_mini div.jm_conversation').size() <= 1)
			return;
		
		// Get the current chat index
		var chat_index = jQuery('#jappix_mini div.jm_conversation:has(a.jm_pane.jm_clicked)').index();
		chat_index++;
		
		if(!chat_index)
			chat_index = 0;
		
		// No chat after?
		if(!jQuery('#jappix_mini div.jm_conversation').eq(chat_index).size())
			chat_index = 0;
		
		// Avoid disabled chats
		while(jQuery('#jappix_mini div.jm_conversation').eq(chat_index).hasClass('jm_disabled'))
			chat_index++;
		
		// Show the next chat
		var chat_hash = jQuery('#jappix_mini div.jm_conversation').eq(chat_index).attr('data-hash');
		
		if(chat_hash)
			switchPaneMini('chat-' + chat_hash, chat_hash);
	} catch(e) {
		Console.error('switchChatMini', e);
	}
}

// Shows the roster
function showRosterMini() {
	try {
		switchPaneMini('roster');
		jQuery('#jappix_mini div.jm_roster').show();
		jQuery('#jappix_mini a.jm_button').addClass('jm_clicked');
		
		jQuery(document).oneTime(10, function() {
			jQuery('#jappix_mini div.jm_roster div.jm_search input.jm_searchbox').focus();
		});
	} catch(e) {
		Console.error('showRosterMini', e);
	}
}

// Hides the roster
function hideRosterMini() {
	try {
		// Close the roster pickers
		jQuery('#jappix_mini a.jm_status.active, #jappix_mini a.jm_join.active').click();
		
		// Hide the roster box
		jQuery('#jappix_mini div.jm_roster').hide();
		jQuery('#jappix_mini a.jm_button').removeClass('jm_clicked');
		
		// Clear the search box and show all online contacts
		jQuery('#jappix_mini div.jm_roster div.jm_search input.jm_searchbox').val('').attr('data-value', '');
		jQuery('#jappix_mini div.jm_roster div.jm_grouped').show();
		jQuery('#jappix_mini div.jm_roster div.jm_buddies a.jm_online').show();
		jQuery('#jappix_mini a.jm_friend.jm_hover').removeClass('jm_hover');
	} catch(e) {
		Console.error('hideRosterMini', e);
	}
}

// Removes a groupchat from DOM
function removeGroupchatMini(xid) {
	try {
		// Remove the groupchat private chats & the groupchat buddies from the roster
		jQuery('#jappix_mini div.jm_conversation[data-origin="' + escape(cutResource(xid)) + '"], #jappix_mini div.jm_roster div.jm_grouped[data-xid="' + escape(xid) + '"]').remove();
		
		// Update the presence counter
		updateRosterMini();
	} catch(e) {
		Console.error('removeGroupchatMini', e);
	}
}

// Initializes Jappix Mini
function initializeMini() {
	try {
		// Update the marker
		MINI_INITIALIZED = true;
		
		// Send the initial presence
		presenceMini();
		
		// Join the groupchats (first)
		for(var i = 0; i < MINI_GROUPCHATS.length; i++) {
			// Empty value?
			if(!MINI_GROUPCHATS[i])
				continue;
			
			// Using a try/catch override IE issues
			try {
				// Current chat room
				var chat_room = bareXID(generateXID(MINI_GROUPCHATS[i], 'groupchat'));
				
				// Open the current chat
				chatMini('groupchat', chat_room, getXIDNick(chat_room), hex_md5(chat_room), MINI_PASSWORDS[i], MINI_SHOWPANE);
			}
			
			catch(e) {}
		}
		
		// Join the chats (then)
		for(var j = 0; j < MINI_CHATS.length; j++) {
			// Empty value?
			if(!MINI_CHATS[j])
				continue;
			
			// Using a try/catch override IE issues
			try {
				// Current chat user
				var chat_xid = bareXID(generateXID(MINI_CHATS[j], 'chat'));
				var chat_hash = hex_md5(chat_xid);
				var chat_nick = jQuery('#jappix_mini a#friend-' + chat_hash).attr('data-nick');
				
				if(!chat_nick)
					chat_nick = getXIDNick(chat_xid);
				else
					chat_nick = unescape(chat_nick);
				
				// Open the current chat
				chatMini('chat', chat_xid, chat_nick, chat_hash);
			}
			
			catch(e) {}
		}
		
		// Must show the roster?
		if(!MINI_AUTOCONNECT && !MINI_GROUPCHATS.length && !MINI_CHATS.length)
			jQuery(document).oneTime(10, function() {
				showRosterMini();
			});
	} catch(e) {
		Console.error('initializeMini', e);
	}
}

// Displays a list of roster buddy
function addListBuddyMini(buddy_arr) {
	try {
		var c, b,
		    nick, hash, xid, subscription;

		var buddy_str = '';

		// Loop on groups
		for(c in buddy_arr) {
			buddy_arr[c] = buddy_arr[c].sort();

			// Group: start
			if(c != MINI_ROSTER_NOGROUP) {
				buddy_str += '<div class="jm_grouped jm_grouped_roster" data-name="' + escape(c) + '">';
				buddy_str += '<div class="jm_name">' + c.htmlEnc() + '</div>';
			}

			// Loop on buddies
			for(b in buddy_arr[c]) {
				// Current buddy data
				buddy_str += codeAddBuddyMini(
					buddy_arr[c][b][0],
					buddy_arr[c][b][1],
					buddy_arr[c][b][2],
					buddy_arr[c][b][3],
					false
				);
			}

			// Group: end
			if(c != MINI_ROSTER_NOGROUP)
				buddy_str += '</div>';
		}

		// Append code
		jQuery('#jappix_mini div.jm_roster div.jm_buddies').html(buddy_str);

		// Events on these buddies
		eventsBuddyMini('#jappix_mini a.jm_friend');

		return true;
	} catch(e) {
		Console.error('addListBuddyMini', e);
	}
}

// Displays a roster buddy
function addBuddyMini(xid, hash, nick, groupchat, subscription, group) {
	try {
		var bare_xid = bareXID(xid);

		// Element
		var element = '#jappix_mini a#friend-' + hash;
		
		// Yet added?
		if(exists(element))  jQuery(element).remove();
		
		// Generate the path
		var path = '#jappix_mini div.jm_roster div.jm_buddies';

		// Generate the groupchat group path
		if(groupchat) {
			path = '#jappix_mini div.jm_roster div.jm_grouped_groupchat[data-xid="' + escape(bare_xid) + '"]';

			// Must add a groupchat group?
			if(!exists(path)) {
				jQuery('#jappix_mini div.jm_roster div.jm_buddies').append(
					'<div class="jm_grouped jm_grouped_groupchat" data-xid="' + escape(bare_xid) + '">' + 
						'<div class="jm_name">' + getXIDNick(groupchat).htmlEnc() + '</div>' + 
					'</div>'
				);
			}
		} else if(group) {
			path = '#jappix_mini div.jm_roster div.jm_grouped_roster[data-name="' + escape(group) + '"]';

			// Must add a roster group?
			if(!exists(path)) {
				jQuery('#jappix_mini div.jm_roster div.jm_buddies').append(
					'<div class="jm_grouped jm_grouped_roster" data-name="' + escape(group) + '">' + 
						'<div class="jm_name">' + group.htmlEnc() + '</div>' + 
					'</div>'
				);
			}
		}
		
		// Append this buddy content
		var code = codeAddBuddyMini(
			nick,
			hash,
			xid,
			subscription
		);
		
		if(groupchat || group)
			jQuery(path).append(code);
		else
			jQuery(path).prepend(code);
		
		// Need to hide this buddy?
		if(jQuery('#jappix_mini div.jm_actions a.jm_toggle_view.jm_toggled').size())
			jQuery(element).filter('.jm_offline').hide();

		// Events on this buddy
		eventsBuddyMini(element);
		
		return true;
	} catch(e) {
		Console.error('addBuddyMini', e);
	}
}

// Returns the code for a single buddy to add
function codeAddBuddyMini(nick, hash, xid, subscription) {
	try {
		var buddy_str = '';

		// Buddy: start
		buddy_str += '<a class="jm_friend jm_offline jm_friend-' + hash;
		  buddy_str += '" id="friend-' + hash;
		  buddy_str += '" title="' + encodeQuotes(xid) + '"';
	      buddy_str += '" data-xid="' + escape(xid) + '"';
	      buddy_str += '" data-nick="' + escape(nick) + '"';
	      buddy_str += '" data-hash="' + hash + '"';
	      buddy_str += ' ' + (subscription ? ' data-sub="' + subscription + '" ' : '');
	    buddy_str += '>';

		// Buddy: inner
		buddy_str += '<span class="jm_presence jm_images jm_unavailable"></span>';
		buddy_str += nick.htmlEnc();
		buddy_str += '<span class="jm_jingle_icon jm_images"></span>';
	    
	    // Buddy: end
	    buddy_str += '</a>';
    } catch(e) {
		Console.error('codeAddBuddyMini', e);
	} finally {
		return buddy_str;
	}
}

// Removes a roster buddy
function removeBuddyMini(hash, groupchat) {
	try {
		// Remove the buddy from the roster
		jQuery('#jappix_mini a#friend-' + hash).remove();
		
		// Empty group?
		var group = '#jappix_mini div.jm_roster div.jm_grouped_groupchat[data-xid="' + escape(groupchat) + '"]';
		
		if(groupchat && !jQuery(group + ' a.jm_friend').size())
			jQuery(group).remove();
		
		return true;
	} catch(e) {
		Console.error('removeBuddyMini', e);
	}
}

// Gets the user's roster
function getRosterMini() {
	try {
		var iq = new JSJaCIQ();
		iq.setType('get');
		iq.setQuery(NS_ROSTER);
		con.send(iq, handleRosterMini);
		
		Console.info('Getting roster...');
	} catch(e) {
		Console.error('getRosterMini', e);
	}
}

// Handles the user's roster
function handleRosterMini(iq) {
	try {
		var buddies, pointer,
		    cur_buddy, cur_groups, cur_group,
		    current, xid, subscription,
		    nick, hash, j, c;

		// Added to sort buddies by name
	    buddies = {};
	    pointer = {};
		
		// Parse the roster
		jQuery(iq.getQuery()).find('item').each(function() {
			var this_sub_sel = jQuery(this);

			// Get the values
			current = this_sub_sel;
			xid = current.attr('jid');
			subscription = current.attr('subscription');
			
			// Not a gateway
			if(!isGateway(xid)) {
				// Read current values
				nick = current.attr('name');
				hash = hex_md5(xid);

				// No name defined?
				if(!nick)  nick = getXIDNick(xid);
				
				// Populate buddy array
				cur_buddy = [];

	            cur_buddy[0] = nick;
	            cur_buddy[1] = hash;
	            cur_buddy[2] = xid;
	            cur_buddy[3] = subscription;

	            // Append to groups this buddy belongs to
	            cur_groups = {};

	            if(this_sub_sel.find('group').size()) {
		            this_sub_sel.find('group').each(function() {
		            	cur_group = jQuery(this).text();

		            	if(cur_group)  cur_groups[cur_group] = 1;
		            });
		        } else {
		        	cur_groups[MINI_ROSTER_NOGROUP] = 1;
		        }

		        for(cur_group in cur_groups) {
		        	// Prepare multidimentional array
					if(typeof pointer[cur_group] != 'number')  pointer[cur_group] = 0;
					if(typeof buddies[cur_group] != 'object')  buddies[cur_group] = [];

					// Push buddy data
					buddies[cur_group][(pointer[cur_group])++] = cur_buddy;
		        }
			}
			
			// Increment counter
			(pointer[cur_group])++;
		});

		// No buddies? (ATM)
		if(!MINI_ROSTER_INIT) {
			MINI_ROSTER_INIT = true;

			addListBuddyMini(buddies);
		} else {
			for(c in buddies) {
				for(j = 0; j < buddies[c].length; j++) {
					if(!buddies[c][j])  continue;

					// Current buddy information
					nick = buddies[c][j][0];
					hash = buddies[c][j][1];
					xid = buddies[c][j][2];
					subscription = buddies[c][j][3];

					// Apply current buddy action
					if(subscription == 'remove')
						removeBuddyMini(hash);
					else
						addBuddyMini(xid, hash, nick, null, subscription, (c != MINI_ROSTER_NOGROUP ? c : null));
				}
			}
		}

		// Not yet initialized
		if(!MINI_INITIALIZED)
			initializeMini();
		
		Console.info('Roster got.');
	} catch(e) {
		Console.error('handleRosterMini', e);
	}
}

// Adapts the roster height to the window
function adaptRosterMini() {
	try {
		// Adapt buddy list height
		var roster_height = jQuery(window).height() - 85;
		jQuery('#jappix_mini div.jm_roster div.jm_buddies').css('max-height', roster_height);
		
		// Adapt chan suggest height
		var suggest_height = jQuery('#jappix_mini div.jm_roster').height() - 46;
		jQuery('#jappix_mini div.jm_chan_suggest').css('max-height', suggest_height);
	} catch(e) {
		Console.error('adaptRosterMini', e);
	}
}

// Generates a random nickname
function randomNickMini() {
	try {
		// First nickname block
		var first_arr = [
			'Just',
			'Bob',
			'Jar',
			'Pedr',
			'Yod',
			'Maz',
			'Vez',
			'Car',
			'Erw',
			'Tiet',
			'Iot',
			'Wal',
			'Bez',
			'Pop',
			'Klop',
			'Zaz',
			'Yoy',
			'Raz'
		];
		
		// Second nickname block
		var second_arr = [
			'io',
			'ice',
			'a',
			'u',
			'o',
			'ou',
			'oi',
			'ana',
			'oro',
			'izi',
			'ozo',
			'aza',
			'ato',
			'ito',
			'ofa',
			'oki',
			'ima',
			'omi'
		];
		
		// Last nickname block
		var last_arr = [
			't',
			'z',
			'r',
			'n',
			'tt',
			'zz',
			'pp',
			'j',
			'k',
			'v',
			'c',
			'x',
			'ti',
			'to',
			'ta',
			'ra',
			'ro',
			'ri'
		];
		
		// Select random values from the arrays
		var rand_nick = randomArrayValue(first_arr) + randomArrayValue(second_arr) + randomArrayValue(last_arr);
		
		return rand_nick;
	} catch(e) {
		Console.error('randomNickMini', e);
	}
}

// Sends a given chatstate to a given entity
function sendChatstateMini(state, xid, hash) {
	try {
		var user_type = jQuery('#jappix_mini #chat-' + hash).attr('data-type');
		var user_storage = jQuery('#jappix_mini #chat-' + hash + ' input.jm_send-messages');
		
		// If the friend client supports chatstates and is online
		if((user_type == 'groupchat') || ((user_type == 'chat') && user_storage.attr('data-chatstates') && !exists('#jappix_mini a#friend-' + hash + '.jm_offline'))) {
			// Already sent?
			if(user_storage.attr('data-chatstate') == state)
				return;
			
			// Store the state
			user_storage.attr('data-chatstate', state);
			
			// Send the state
			var aMsg = new JSJaCMessage();
			aMsg.setTo(xid);
			aMsg.setType(user_type);
			
			aMsg.appendNode(state, {'xmlns': NS_CHATSTATES});
			
			con.send(aMsg);
			
			Console.log('Sent ' + state + ' chatstate to ' + xid);
		}
	} catch(e) {
		Console.error('sendChatstateMini', e);
	}
}

// Displays a given chatstate in a given chat
function displayChatstateMini(state, xid, hash, type) {
	try {
		// Groupchat not supported
		if(type == 'groupchat')
			return;
		
		// Composing?
		if(state == 'composing')
			jQuery('#jappix_mini #chat-' + hash + ' div.jm_chatstate_typing').css('visibility', 'visible');
		else
			resetChatstateMini(xid, hash, type);
		
		Console.log('Received ' + state + ' chatstate from ' + xid);
	} catch(e) {
		Console.error('displayChatstateMini', e);
	}
}

// Resets the chatstate switcher marker
function resetChatstateMini(xid, hash, type) {
	try {
		// Groupchat not supported
		if(type == 'groupchat')
			return;
		
		jQuery('#jappix_mini #chat-' + hash + ' div.jm_chatstate_typing').css('visibility', 'hidden');
	} catch(e) {
		Console.error('resetChatstateMini', e);
	}
}

// Adds the chatstate events
function eventsChatstateMini(xid, hash, type) {
	try {
		// Groupchat not supported
		if(type == 'groupchat')
			return;
		
		jQuery('#jappix_mini #chat-' + hash + ' input.jm_send-messages').keyup(function(e) {
			var this_sel = jQuery(this);

			if(e.keyCode != 13) {
				// Composing a message
				if(this_sel.val() && (this_sel.attr('data-composing') != 'on')) {
					// We change the state detect input
					this_sel.attr('data-composing', 'on');
					
					// We send the friend a "composing" chatstate
					sendChatstateMini('composing', xid, hash);
				}
				
				// Stopped composing a message
				else if(!this_sel.val() && (this_sel.attr('data-composing') == 'on')) {
					// We change the state detect input
					this_sel.attr('data-composing', 'off');
					
					// We send the friend an "active" chatstate
					sendChatstateMini('active', xid, hash);
				}
			}
		})
		
		.change(function() {
			// Reset the composing database entry
			jQuery(this).attr('data-composing', 'off');
		})
		
		.focus(function() {
			var this_sel = jQuery(this);

			// Not needed
			if(this_sel.is(':disabled'))
				return;
			
			// Nothing in the input, user is active
			if(!this_sel.val())
				sendChatstateMini('active', xid, hash);
			else
				sendChatstateMini('composing', xid, hash);
		})
		
		.blur(function() {
			var this_sel = jQuery(this);

			// Not needed
			if(this_sel.is(':disabled'))
				return;
			
			// Nothing in the input, user is inactive
			if(!this_sel.val())
				sendChatstateMini('inactive', xid, hash);
			else
				sendChatstateMini('paused', xid, hash);
		});
	} catch(e) {
		Console.error('eventsChatstateMini', e);
	}
}

// Plays a sound
function soundPlayMini() {
	try {
		// Not supported!
		if((BrowserDetect.browser == 'Explorer') && (BrowserDetect.version < 9))
			return false;
		
		// Append the sound container
		if(!exists('#jappix_mini #jm_audio')) {
			jQuery('#jappix_mini').append(
				'<div id="jm_audio">' + 
					'<audio preload="auto">' + 
						'<source src="' + JAPPIX_STATIC + 'snd/receive-message.mp3" />' + 
						'<source src="' + JAPPIX_STATIC + 'snd/receive-message.oga" />' + 
					'</audio>' + 
				'</div>'
			);
		}
		
		// Play the sound
		var audio_select = document.getElementById('jm_audio').getElementsByTagName('audio')[0];
		
		// Avoids Safari bug (2011 and less versions)
		try {
			audio_select.load();
		} finally {
			audio_select.play();
		}
	} catch(e) {
		Console.error('soundPlayMini', e);
	} finally {
		return false;
	}
}

// TypeWatch to set a timeout to input value reading
var typewatch = (function() {
	var timer = 0;
	
	return function(callback, ms) {
	    clearTimeout(timer);
	    timer = setTimeout(callback, ms);
	}  
})();

// Plugin launcher
function launchMini(autoconnect, show_pane, domain, user, password, priority) {
	try {
		// Disabled on mobile?
		if(MINI_DISABLE_MOBILE && isMobile()) {
			Console.log('Jappix Mini disabled on mobile.');

			return;
		}

		// Save infos to reconnect
		MINI_DOMAIN = domain;
		MINI_USER = user;
		MINI_PASSWORD = password;
		MINI_HASH = 'jm.' + hex_md5(MINI_USER + '@' + MINI_DOMAIN);

		if(priority != undefined)
			MINI_PRIORITY = priority;
		
		// Anonymous mode?
		if(!user || !password)
			MINI_ANONYMOUS = true;
		else
			MINI_ANONYMOUS = false;
		
		// Autoconnect (only if storage available to avoid floods)?
		if(autoconnect && hasDB())
			MINI_AUTOCONNECT = true;
		else
			MINI_AUTOCONNECT = false;
		
		// Show pane?
		if(show_pane)
			MINI_SHOWPANE = true;
		else
			MINI_SHOWPANE = false;
		
		// Remove Jappix Mini
		jQuery('#jappix_mini').remove();
		
		// Reconnect?
		if(MINI_RECONNECT) {
			Console.log('Trying to reconnect (try: ' + MINI_RECONNECT + ')!');
			
			return createMini(domain, user, password);
		}
		
		// Append the Mini stylesheet
		jQuery('head').append('<link rel="stylesheet" href="' + JAPPIX_STATIC + 'css/mini.css' + '" type="text/css" media="all" />');
		
		// Legacy IE stylesheet
		if((BrowserDetect.browser == 'Explorer') && (BrowserDetect.version < 7))
			jQuery('head').append('<link rel="stylesheet" href="' + JAPPIX_STATIC + 'css/mini-ie.css' + '" type="text/css" media="all" />');
		
		// Disables the browser HTTP-requests stopper
		jQuery(document).keydown(function(e) {
			if((e.keyCode == 27) && !isDeveloper())
				return false;
		});
		
		// Save the page title
		MINI_TITLE = document.title;
		
		// Adapts the content to the window size
		jQuery(window).resize(function() {
			adaptRosterMini();
			updateOverflowMini();
		});
		
		// Logouts when Jappix is closed
		if(BrowserDetect.browser == 'Opera') {
			// Emulates onbeforeunload on Opera (link clicked)
			jQuery('a[href]:not([onclick])').click(function() {
				var this_sel = jQuery(this);

				// Link attributes
				var href = this_sel.attr('href') || '';
				var target = this_sel.attr('target') || '';
				
				// Not new window or JS link
				if(href && !href.match(/^#/i) && !target.match(/_blank|_new/i))
					saveSessionMini();
			});
			
			// Emulates onbeforeunload on Opera (form submitted)
			jQuery('form:not([onsubmit])').submit(saveSessionMini);
		}
		
		jQuery(window).bind('beforeunload', saveSessionMini);
		
		// Create the Jappix Mini DOM content
		createMini(domain, user, password);
		
		Console.log('Welcome to Jappix Mini! Happy coding in developer mode!');
	} catch(e) {
		Console.error('launchMini', e);
	}
}