'use strict';

const COUNTDOWN = 7;
const HARROWHOLD = 9950;
let voice = null;

try { voice = require('./voice'); } catch (e){ voice = null; }

module.exports.NetworkMod = function MsgEnrage(mod){

	const cmd = mod.command;
	const settings = mod.settings;

	let boss = new Set();
	let enraged = false;
	let enrageDuration = 0;
	let hpPer = 0;
	let inHh = false;
	let nextEnrage = 0;
	let nextEnragePer = 10;
	let timeout = null;
	let timeoutCounter = null;

	// command
	cmd.add('enrage', {
		// toggle
		'$none': () => {
			settings.enable = !settings.enable;
			send(`${settings.enable ? 'En' : 'Dis'}abled`);
		},
		'countdown': () => {
			settings.countdown = !settings.countdown;
			send(`Countdown last few seconds ${settings.countdown ? 'en' : 'dis'}abled`);
		},
		'notice': () => {
			settings.notice = !settings.notice;
			send(`Notice to screen ${settings.notice ? 'en' : 'dis'}abled`);
		},
		'status': () => {
			send(
				`Enrage message : ${settings.enable}`,
				`Countdown : ${settings.countdown}`,
				`Notice to screen : ${settings.notice}`,
				`Voice : ${settings.voice}`
			);
		},
		'voice': () => {
			settings.voice = !settings.voice;
			send(`Voice ${settings.voice ? 'en' : 'dis'}abled`);
		},
		'$default': () => {
			send(`Invalid argument. usage : enrage [countdown|notice|status]`);
		}
	});

	// game state
	mod.game.me.on('change_zone', (zone) => {
		inHh = zone === HARROWHOLD;
		if(timeout || timeoutCounter){clearTimer();}
	});

	// destructor
	this.destructor = () => {
		clearTimer();
		cmd.remove('enrage');
	};

	// code
	mod.hook('S_BOSS_GAGE_INFO', 3, (e) => {
		if(settings.enable && !inHh){
			boss.add(e.id.toString());
			hpPer = Math.floor(Number(e.curHp * BigInt(10000) / e.maxHp) / 100);
			nextEnrage = (hpPer > nextEnragePer) ? (hpPer - nextEnragePer) : 0;
		}
	});

	mod.hook('S_NPC_STATUS', 2, (e) => {
		if(settings.enable && !inHh && boss.has(e.gameId.toString())){
			if(e.enraged && !enraged){
				enraged = true;
				enrageDuration = e.remainingEnrageTime - (COUNTDOWN * 1000);
				enrageDuration = (enrageDuration < 0) ? 0 : enrageDuration;
				toChat(`Boss Enrage Start`);
				if(voice && settings.voice) voice.speak("Enrage Start", 2);
				settings.countdown ? timeout = mod.setTimeout(timeRemaining, enrageDuration) : null;
			} else if(!e.enraged && enraged){
				if(hpPer === 100){return;}
				enraged = false;
				send(`Next enrage at ` + `${nextEnrage.toString()}` + `%.`);
				if(voice && settings.voice) voice.speak("Enrage End", 2);
				clearTimer();
			}
		}
	});

	mod.hook('S_DESPAWN_NPC', 3, (e) => {
		if(settings.enable && !inHh){
			if(boss.has(e.gameId.toString())){
				boss.delete(e.gameId.toString());
				clearTimer();
				enraged = false;
				hpPer = 0;
			}
		}
	});

	// helper
	function clearTimer(){
		mod.clearTimeout(timeout);
		mod.clearInterval(timeoutCounter);
		timeout = null;
		timeoutCounter = null;
	}

	function timeRemaining(){
		let i = COUNTDOWN;
		timeoutCounter = mod.setInterval(() => {
			if(enraged && i > 0){
				send(`Seconds remaining : ${i}`);
				i--;
			} else {
				mod.clearInterval(timeoutCounter);
				timeoutCounter = null;
			}
		}, 995);
	}

	function toChat(msg){
		if(settings.notice){
			mod.send('S_DUNGEON_EVENT_MESSAGE', 2, {
				type: 31, // 42 blue shiny text, 31 normal Text
				chat: false,
				channel: 27,
				message: msg
			});
		} else {
			send(msg);
		}
	}

	function send(msg){ cmd.message(': ' + msg); }

	// reload
	this.saveState = () => {
		const state = {
			boss: boss,
			enrageDuration: enrageDuration,
			inHh: inHh,
			nextEnragePer: nextEnragePer
		};
		return state;
	};

	this.loadState = (state) => {
		boss = state.boss;
		enrageDuration = state.enrageDuration;
		inHh = state.inHh;
		nextEnragePer = state.nextEnragePer;
	};

};
